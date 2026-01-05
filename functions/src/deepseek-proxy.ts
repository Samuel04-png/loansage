/**
 * DeepSeek API Proxy Cloud Function
 * Proxies requests to DeepSeek API with rate limiting, caching, and retry logic
 */

import * as functions from 'firebase-functions';
import { enforceQuota } from './usage-ledger';
import { isInternalEmail } from './internal-bypass';
// Lazy import to prevent deployment timeout
let callDeepSeekWithRateLimit: any;

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekRequest {
  messages: DeepSeekMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  agencyId: string;
}

export const deepseekProxy = functions.https.onCall(async (data: DeepSeekRequest, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to use DeepSeek API'
    );
  }

  // Get API key from environment or config
  const apiKey = process.env.DEEP_SEEK_API_KEY || functions.config().deepseek?.api_key;
  
  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'DeepSeek API key is not configured. Please set DEEP_SEEK_API_KEY environment variable.'
    );
  }

  const { messages, temperature = 0.7, maxTokens = 2000, model = 'deepseek-chat', agencyId } = data;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Messages array is required and must not be empty'
    );
  }
  if (!agencyId) {
    throw new functions.https.HttpsError('invalid-argument', 'agencyId is required');
  }

  try {
    // Lazy load rate limiter to prevent deployment timeout
    if (!callDeepSeekWithRateLimit) {
      const rateLimiterModule = await import('./deepseek-rate-limiter');
      callDeepSeekWithRateLimit = rateLimiterModule.callDeepSeekWithRateLimit;
    }
    
    // Enforce AI calls quota unless internal (only count non-cached calls)
    // We'll check this after the cache lookup
    
    // Use rate-limited and cached API call
    const result = await callDeepSeekWithRateLimit(apiKey, messages, {
      model,
      temperature,
      maxTokens,
      agencyId,
    });
    
    // Only count quota if not from cache
    if (!result.fromCache && !isInternalEmail(context)) {
      await enforceQuota(agencyId, 'aiCalls', 1);
    }

    return {
      content: result.content,
      usage: result.usage,
      model,
      fromCache: result.fromCache,
    };
  } catch (error: any) {
    console.error('DeepSeek API proxy error:', error);
    
    // If it's already an HttpsError, re-throw it
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    // Provide more helpful error messages
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'DeepSeek API authentication failed. Please check your API key.'
      );
    } else if (
      error.message?.includes('429') || 
      error.message?.includes('rate limit') ||
      error.message?.includes('Rate limit exceeded')
    ) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        error.message || 'DeepSeek API rate limit exceeded. Please try again later.'
      );
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      throw new functions.https.HttpsError(
        'unavailable',
        'Network error connecting to DeepSeek API. Please check your internet connection.'
      );
    }
    
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'Unknown error occurred while calling DeepSeek API'
    );
  }
});

