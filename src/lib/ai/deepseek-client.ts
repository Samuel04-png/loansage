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
  choices: Array<{
    message: {
      content: string;
    };
  }>;
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
    throw new Error('DeepSeek API key is not configured. Please add VITE_DEEP_SEEK_API_KEY=sk-your-key to your .env file. Note: Vite requires the VITE_ prefix for client-side environment variables.');
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
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || 
        `DeepSeek API error: ${response.status} ${response.statusText}`
      );
    }

    const data: DeepSeekResponse = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from DeepSeek API');
    }

    return data.choices[0].message.content;
  } catch (error: any) {
    console.error('DeepSeek API error:', error);
    throw error;
  }
}

/**
 * Parse JSON response from DeepSeek, with fallback
 */
export function parseAIResponse<T>(response: string, fallback: T): T {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    // Try to parse as direct JSON
    return JSON.parse(response);
  } catch (error) {
    console.warn('Failed to parse AI response as JSON, using fallback:', error);
    return fallback;
  }
}

/**
 * Check if DeepSeek API is configured
 */
export function isDeepSeekConfigured(): boolean {
  return !!DEEP_SEEK_API_KEY && DEEP_SEEK_API_KEY.length > 0;
}

