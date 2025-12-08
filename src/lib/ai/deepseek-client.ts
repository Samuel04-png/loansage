/**
 * DeepSeek API Client
 * Handles all AI-powered features using DeepSeek API
 */

/// <reference types="vite/client" />

const DEEP_SEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
// Note: Vite requires VITE_ prefix for client-side environment variables
// Vite automatically loads from .env.local, .env, etc.
const DEEP_SEEK_API_KEY = (import.meta.env as any).VITE_DEEP_SEEK_API_KEY || '';

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
 * Call DeepSeek API with a prompt
 */
export async function callDeepSeekAPI(
  messages: DeepSeekMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  } = {}
): Promise<string> {
  if (!DEEP_SEEK_API_KEY) {
    console.warn('DeepSeek API key not configured');
    throw new Error('DeepSeek API key is not configured. Please add VITE_DEEP_SEEK_API_KEY=sk-your-key to your .env.local file. Note: Vite requires the VITE_ prefix for client-side environment variables.');
  }

  const {
    temperature = 0.7,
    maxTokens = 2000,
    model = 'deepseek-chat',
  } = options;

  try {
    const response = await fetch(DEEP_SEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEP_SEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false, // Ensure we get a complete response
      }),
    });

    if (!response.ok) {
      let errorMessage = `DeepSeek API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorData: DeepSeekResponse = await response.json();
        if (errorData.error?.message) {
          errorMessage = `DeepSeek API error: ${errorData.error.message}`;
        }
      } catch (parseError) {
        // If JSON parsing fails, use the status text
        const text = await response.text().catch(() => '');
        if (text) {
          errorMessage = `DeepSeek API error: ${text}`;
        }
      }
      
      throw new Error(errorMessage);
    }

    const data: DeepSeekResponse = await response.json();
    
    // Check for API-level errors
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

    return content;
  } catch (error: any) {
    console.error('DeepSeek API error:', error);
    
    // Provide more helpful error messages
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      throw new Error('DeepSeek API authentication failed. Please check your API key.');
    } else if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      throw new Error('DeepSeek API rate limit exceeded. Please try again later.');
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      throw new Error('Network error connecting to DeepSeek API. Please check your internet connection.');
    }
    
    throw error;
  }
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
 * Check if DeepSeek API is configured
 */
export function isDeepSeekConfigured(): boolean {
  return !!DEEP_SEEK_API_KEY && DEEP_SEEK_API_KEY.length > 0 && DEEP_SEEK_API_KEY.startsWith('sk-');
}

/**
 * Test DeepSeek API connection
 * Returns true if API is working, false otherwise
 */
export async function testDeepSeekConnection(): Promise<{ success: boolean; message: string }> {
  if (!isDeepSeekConfigured()) {
    return {
      success: false,
      message: 'DeepSeek API key is not configured. Please add VITE_DEEP_SEEK_API_KEY to your .env.local file.',
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
        message: 'DeepSeek API is working correctly!',
      };
    }

    return {
      success: true,
      message: 'DeepSeek API responded, but response format was unexpected.',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `DeepSeek API test failed: ${error.message || 'Unknown error'}`,
    };
  }
}
