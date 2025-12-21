/**
 * Byte&Berry Copilot API Client
 * Handles all AI-powered features using Byte&Berry Copilot via Cloud Function proxy
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

// Cloud Function reference
const deepseekProxyFunction = httpsCallable(functions, 'deepseekProxy');

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: Array<{
    index?: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message: string;
    type: string;
    code?: string;
  };
}

/**
 * Call DeepSeek API with a prompt via Cloud Function proxy
 * Includes retry logic for temporary failures
 */
export async function callDeepSeekAPI(
  messages: DeepSeekMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
    retries?: number;
  } = {}
): Promise<string> {
  const {
    temperature = 0.7,
    maxTokens = 2000,
    model = 'deepseek-chat',
    retries = 2, // Default to 2 retries
  } = options;

  let lastError: any = null;
  
  // Retry logic with exponential backoff
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await deepseekProxyFunction({
        messages,
        temperature,
        maxTokens,
        model,
      });

      const data = result.data as { content: string; usage?: any; model?: string };
      
      if (!data || !data.content) {
        throw new Error('No content in Byte&Berry Copilot API response');
      }

      return data.content;
    } catch (error: any) {
      lastError = error;
      console.error(`Byte&Berry Copilot API error (attempt ${attempt + 1}/${retries + 1}):`, error);
      
      // Don't retry on certain errors
      if (error.code === 'functions/unauthenticated') {
        throw new Error('You must be logged in to use DeepSeek API.');
      } else if (error.code === 'functions/failed-precondition') {
        throw new Error('DeepSeek API key is not configured on the server. Please contact support.');
      }
      
      // Check if error is retryable (service busy, network errors, etc.)
      const errorMessage = error?.message || error?.toString() || '';
      const isRetryable = 
        errorMessage.includes('Service is too busy') ||
        errorMessage.includes('too busy') ||
        errorMessage.includes('unavailable') ||
        errorMessage.includes('network') ||
        errorMessage.includes('CORS') ||
        errorMessage.includes('Failed to fetch') ||
        error.code === 'functions/unavailable' ||
        error.code === 'functions/deadline-exceeded';
      
      // If this is the last attempt or error is not retryable, throw
      if (attempt >= retries || !isRetryable) {
        break;
      }
      
      // Wait before retrying (exponential backoff: 1s, 2s, 4s...)
      const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000); // Max 5 seconds
      console.log(`Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // All retries failed, throw the last error with user-friendly message
  const errorMessage = lastError?.message || lastError?.toString() || 'Unknown error';
  
  // Handle Firebase Functions errors
  if (lastError?.code === 'functions/resource-exhausted') {
    throw new Error('DeepSeek API rate limit exceeded. Please try again later.');
  } else if (lastError?.code === 'functions/unavailable') {
    throw new Error('Network error connecting to DeepSeek API. Please check your internet connection.');
  } else if (errorMessage.includes('Service is too busy') || errorMessage.includes('too busy')) {
    throw new Error('DeepSeek API error: Service is too busy. We advise users to temporarily switch to alternative LLM API service providers.');
  } else if (errorMessage) {
    // Use the error message from the Cloud Function
    throw new Error(errorMessage);
  }
  
  throw new Error('Unknown error occurred while calling DeepSeek API');
}

/**
 * Parse JSON response from DeepSeek, with fallback
 * Handles various response formats including markdown code blocks
 */
export function parseAIResponse<T>(response: string, fallback: T): T {
  if (!response || typeof response !== 'string') {
    console.warn('Invalid response format, using fallback');
    return fallback;
  }

  try {
    // Try to extract JSON from markdown code blocks (```json ... ```)
    const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.warn('Failed to parse JSON from code block:', e);
      }
    }
    
    // Try to extract JSON from any code block
    const anyCodeBlockMatch = response.match(/```[a-z]*\s*(\{[\s\S]*?\})\s*```/);
    if (anyCodeBlockMatch && anyCodeBlockMatch[1]) {
      try {
        return JSON.parse(anyCodeBlockMatch[1]);
      } catch (e) {
        console.warn('Failed to parse JSON from code block:', e);
      }
    }
    
    // Try to find JSON object in the response
    const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch && jsonObjectMatch[0]) {
      try {
        return JSON.parse(jsonObjectMatch[0]);
      } catch (e) {
        console.warn('Failed to parse JSON object:', e);
      }
    }
    
    // Try to parse as direct JSON
    return JSON.parse(response);
  } catch (error) {
    console.warn('Failed to parse AI response as JSON, using fallback:', error);
    console.warn('Response was:', response.substring(0, 200));
    return fallback;
  }
}

/**
 * Check if Byte&Berry Copilot API is configured
 * Note: The API key is now stored on the server, so we can't check it from the client
 * This function always returns true if Firebase Functions are available
 */
export function isDeepSeekConfigured(): boolean {
  // Since the API key is now on the server, we assume it's configured
  // The actual check happens on the server side
  return true;
}

/**
 * Test Byte&Berry Copilot API connection
 * Returns true if API is working, false otherwise
 */
export async function testDeepSeekConnection(): Promise<{ success: boolean; message: string }> {
  if (!isDeepSeekConfigured()) {
    return {
      success: false,
      message: 'Byte&Berry Copilot API key is not configured. Please configure it on the server via Firebase Functions.',
    };
  }

  try {
    const response = await callDeepSeekAPI([
      {
        role: 'system',
        content: 'You are a helpful assistant. Respond briefly.',
      },
      {
        role: 'user',
        content: 'Say "Hello" if you can read this.',
      },
    ], {
      temperature: 0.1,
      maxTokens: 10,
    });

    if (response && response.toLowerCase().includes('hello')) {
      return {
        success: true,
        message: 'Byte&Berry Copilot is working correctly!',
      };
    }

    return {
      success: true,
      message: 'Byte&Berry Copilot responded, but response format was unexpected.',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Byte&Berry Copilot test failed: ${error.message || 'Unknown error'}`,
    };
  }
}
