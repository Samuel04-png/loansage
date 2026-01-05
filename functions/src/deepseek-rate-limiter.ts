/**
 * DeepSeek API Rate Limiter & Cache
 * Implements throttling, exponential backoff, and Firestore-based caching
 */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();

// Rate limit configuration
const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 10, // DeepSeek free tier: ~10 req/min
  maxRequestsPerHour: 300,
  retryDelays: [1000, 2000, 4000, 8000], // Exponential backoff in ms
  cacheTTL: 24 * 60 * 60 * 1000, // 24 hours cache
};

interface RateLimitState {
  requests: number[];
  lastReset: number;
}

// In-memory rate limiter (per function instance)
const rateLimiters = new Map<string, RateLimitState>();

/**
 * Generate cache key from request data
 */
function generateCacheKey(messages: any[], model: string): string {
  const content = JSON.stringify({ messages, model });
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Check if request is cached
 */
async function getCachedResponse(cacheKey: string): Promise<string | null> {
  try {
    const cacheRef = db.collection('ai_cache').doc(cacheKey);
    const cacheDoc = await cacheRef.get();
    
    if (!cacheDoc.exists) {
      return null;
    }
    
    const cacheData = cacheDoc.data();
    if (!cacheData) {
      return null;
    }
    
    const cachedAt = cacheData.cachedAt?.toMillis() || 0;
    const now = Date.now();
    
    // Check if cache is expired
    if (now - cachedAt > RATE_LIMIT_CONFIG.cacheTTL) {
      await cacheRef.delete(); // Clean up expired cache
      return null;
    }
    
    return cacheData.response as string;
  } catch (error) {
    console.warn('Cache read error:', error);
    return null;
  }
}

/**
 * Store response in cache
 */
async function setCachedResponse(cacheKey: string, response: string): Promise<void> {
  try {
    await db.collection('ai_cache').doc(cacheKey).set({
      response,
      cachedAt: admin.firestore.FieldValue.serverTimestamp(),
      ttl: admin.firestore.Timestamp.fromMillis(Date.now() + RATE_LIMIT_CONFIG.cacheTTL),
    });
  } catch (error) {
    console.warn('Cache write error:', error);
    // Don't throw - caching is best effort
  }
}

/**
 * Check rate limit (in-memory + Firestore)
 */
async function checkRateLimit(agencyId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now();
  const minuteAgo = now - 60 * 1000;
  const hourAgo = now - 60 * 60 * 1000;
  
  // Get or create rate limiter state
  let limiter = rateLimiters.get(agencyId);
  if (!limiter) {
    limiter = { requests: [], lastReset: now };
    rateLimiters.set(agencyId, limiter);
  }
  
  // Clean old requests
  limiter.requests = limiter.requests.filter(timestamp => timestamp > hourAgo);
  
  // Check per-minute limit
  const recentRequests = limiter.requests.filter(timestamp => timestamp > minuteAgo);
  if (recentRequests.length >= RATE_LIMIT_CONFIG.maxRequestsPerMinute) {
    const oldestRecent = Math.min(...recentRequests);
    const retryAfter = Math.ceil((minuteAgo + 60000 - oldestRecent) / 1000);
    return { allowed: false, retryAfter };
  }
  
  // Check per-hour limit
  if (limiter.requests.length >= RATE_LIMIT_CONFIG.maxRequestsPerHour) {
    const oldestRequest = Math.min(...limiter.requests);
    const retryAfter = Math.ceil((hourAgo + 3600000 - oldestRequest) / 1000);
    return { allowed: false, retryAfter };
  }
  
  // Record this request
  limiter.requests.push(now);
  
  return { allowed: true };
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call DeepSeek API with rate limiting, caching, and exponential backoff
 */
export async function callDeepSeekWithRateLimit(
  apiKey: string,
  messages: any[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    agencyId: string;
  }
): Promise<{ content: string; fromCache: boolean; usage?: any }> {
  const { model = 'deepseek-chat', temperature = 0.7, maxTokens = 2000, agencyId } = options;
  
  // Generate cache key
  const cacheKey = generateCacheKey(messages, model);
  
  // Check cache first
  const cachedResponse = await getCachedResponse(cacheKey);
  if (cachedResponse) {
    console.log(`[DeepSeek] Cache hit for agency ${agencyId}`);
    return {
      content: cachedResponse,
      fromCache: true,
    };
  }
  
  // Check rate limit
  const rateLimitCheck = await checkRateLimit(agencyId);
  if (!rateLimitCheck.allowed) {
    throw new Error(
      `Rate limit exceeded. Please try again in ${rateLimitCheck.retryAfter} seconds.`
    );
  }
  
  // Make API call with exponential backoff retry
  let lastError: any = null;
  
  for (let attempt = 0; attempt < RATE_LIMIT_CONFIG.retryDelays.length; attempt++) {
    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        }),
      });
      
      if (!response.ok) {
        const status = response.status;
        
        // Handle rate limit (429)
        if (status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const waitTime = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : RATE_LIMIT_CONFIG.retryDelays[attempt] || 5000;
          
          if (attempt < RATE_LIMIT_CONFIG.retryDelays.length - 1) {
            console.log(`[DeepSeek] Rate limited, retrying in ${waitTime}ms...`);
            await sleep(waitTime);
            continue;
          } else {
            throw new Error(`Rate limit exceeded. Please try again later.`);
          }
        }
        
        // Handle other errors
        let errorMessage = `DeepSeek API error: ${status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error?.message) {
            errorMessage = `DeepSeek API error: ${errorData.error.message}`;
          }
        } catch {
          // Ignore JSON parse errors
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`DeepSeek API error: ${data.error.message || 'Unknown error'}`);
      }
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from DeepSeek API - empty choices array');
      }
      
      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in DeepSeek API response');
      }
      
      // Cache the response
      await setCachedResponse(cacheKey, content);
      
      console.log(`[DeepSeek] API call successful for agency ${agencyId} (attempt ${attempt + 1})`);
      
      return {
        content,
        fromCache: false,
        usage: data.usage,
      };
      
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        throw new Error('DeepSeek API authentication failed. Please check your API key.');
      }
      
      // Check if retryable
      const isRetryable = 
        error.message?.includes('429') ||
        error.message?.includes('rate limit') ||
        error.message?.includes('503') ||
        error.message?.includes('502') ||
        error.message?.includes('network') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ETIMEDOUT');
      
      if (!isRetryable || attempt >= RATE_LIMIT_CONFIG.retryDelays.length - 1) {
        throw error;
      }
      
      // Wait before retry (exponential backoff with jitter)
      const baseDelay = RATE_LIMIT_CONFIG.retryDelays[attempt] || 1000;
      const jitter = Math.random() * 1000; // Add random jitter
      const delay = baseDelay + jitter;
      
      console.log(`[DeepSeek] Retry attempt ${attempt + 1} after ${delay}ms...`);
      await sleep(delay);
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}
