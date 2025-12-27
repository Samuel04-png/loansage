/**
 * DeepSeek API Proxy Cloud Function
 * Proxies requests to DeepSeek API to avoid CORS issues
 */

import * as functions from 'firebase-functions';
import { enforceQuota } from './usage-ledger';
import { isInternalEmail } from './internal-bypass';

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
    // Enforce AI calls quota unless internal
    if (!isInternalEmail(context)) {
      await enforceQuota(agencyId, 'aiCalls', 1);
    }

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
      let errorMessage = `DeepSeek API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = `DeepSeek API error: ${errorData.error.message}`;
        }
      } catch (parseError) {
        const text = await response.text().catch(() => '');
        if (text) {
          errorMessage = `DeepSeek API error: ${text}`;
        }
      }
      
      throw new functions.https.HttpsError(
        'internal',
        errorMessage
      );
    }

    const data = await response.json();
    
    // Check for API-level errors
    if (data.error) {
      throw new functions.https.HttpsError(
        'internal',
        `DeepSeek API error: ${data.error.message || 'Unknown error'}`
      );
    }
    
    if (!data.choices || data.choices.length === 0) {
      throw new functions.https.HttpsError(
        'internal',
        'No response from DeepSeek API - empty choices array'
      );
    }

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new functions.https.HttpsError(
        'internal',
        'No content in DeepSeek API response'
      );
    }

    return {
      content,
      usage: data.usage,
      model: data.model,
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
    } else if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'DeepSeek API rate limit exceeded. Please try again later.'
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

