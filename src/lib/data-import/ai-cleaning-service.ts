/**
 * AI Data Cleaning Service
 * Uses LLM (Gemini) to intelligently clean and structure messy CSV data
 */

// Import GoogleGenAI dynamically to avoid bundle issues
// This will be loaded when AI cleaning is actually used
import { normalizeRowData, NormalizedData, validateNormalizedData } from './data-normalization';

const SYSTEM_PROMPT = `You are a data cleaning expert for a microfinance loan management system. 
Your task is to clean and normalize customer/borrower data from messy CSV imports.

Key Rules:
1. Extract and normalize phone numbers to +260XXXXXXXXX format (Zambian format)
2. Fix email addresses: remove phone numbers embedded in emails (e.g., "john097123456@gmail.com" -> "john@gmail.com")
3. Standardize names: capitalize properly, remove extra spaces
4. Extract phone numbers from email fields when phone field is empty
5. Validate NRC numbers (National Registration Card) format
6. Preserve data integrity - don't invent data, only clean what's there

Return ONLY valid JSON in this exact format:
{
  "phone": "+260974549846" or null,
  "email": "clean.email@gmail.com" or null,
  "fullName": "John Doe" or null,
  "nrc": "123456/78/1" or null,
  "address": "Cleaned address" or null,
  "confidence": 0.95,
  "warnings": ["Phone extracted from email"],
  "fixedFields": ["email", "phone"]
}`;

interface AICleaningResult extends NormalizedData {
  fixedFields: string[];
  aiSuggestions: string[];
}

interface BatchCleaningOptions {
  batchSize?: number;
  useAI?: boolean; // Feature flag to enable/disable AI
  confidenceThreshold?: number; // Minimum confidence to auto-approve
}

/**
 * Initialize Gemini AI client (async for dynamic import)
 */
async function getAIClient(): Promise<any | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || import.meta.env.API_KEY;
  
  if (!apiKey) {
    console.warn('Gemini API key not found. AI cleaning will be disabled.');
    return null;
  }
  
  try {
    const module = await import('@google/genai');
    const GoogleGenAI = module.GoogleGenAI;
    return new GoogleGenAI({ apiKey });
  } catch (error) {
    console.error('Failed to initialize AI client:', error);
    return null;
  }
}

/**
 * Clean a single row using AI
 */
async function cleanRowWithAI(
  row: Record<string, any>,
  fieldMappings: {
    phone?: string[];
    email?: string[];
    fullName?: string[];
    nrc?: string[];
    address?: string[];
  }
): Promise<AICleaningResult> {
  const ai = await getAIClient();
  
  if (!ai) {
    // Fallback to rule-based normalization
    const normalized = normalizeRowData(row, fieldMappings);
    return {
      ...normalized,
      fixedFields: [],
      aiSuggestions: ['AI service unavailable, using rule-based cleaning'],
    };
  }
  
  // Prepare data for AI
  const rowSummary = Object.entries(row)
    .filter(([key]) => !key.match(/^(normalized|_originalRow)$/))
    .map(([key, value]) => `${key}: ${String(value).slice(0, 100)}`)
    .join('\n');
  
  const prompt = `Clean this customer data row:
${rowSummary}

Field mappings:
- Phone: ${fieldMappings.phone?.join(', ') || 'auto-detect'}
- Email: ${fieldMappings.email?.join(', ') || 'auto-detect'}
- Name: ${fieldMappings.fullName?.join(', ') || 'auto-detect'}
- NRC: ${fieldMappings.nrc?.join(', ') || 'auto-detect'}
- Address: ${fieldMappings.address?.join(', ') || 'auto-detect'}

Clean the data according to the rules and return JSON only.`;

  try {
    const model = 'gemini-2.0-flash-exp'; // Fast and cost-effective for data cleaning
    
    // Call Gemini API with retry logic
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.1, // Low temperature for consistent cleaning
        maxOutputTokens: 500,
      },
    });
    
    // Handle different response formats
    let responseText = '';
    if (typeof response.text === 'function') {
      responseText = await response.text();
    } else if (typeof response.text === 'string') {
      responseText = response.text;
    } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      responseText = response.candidates[0].content.parts[0].text;
    } else {
      responseText = String(response) || '';
    }
    
    // Extract JSON from response (AI sometimes adds markdown formatting)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }
    
    const cleaned = JSON.parse(jsonMatch[0]) as Partial<AICleaningResult>;
    
    // Merge with rule-based normalization for safety
    const ruleBased = normalizeRowData(row, fieldMappings);
    
    return {
      phone: cleaned.phone || ruleBased.phone || undefined,
      email: cleaned.email || ruleBased.email || undefined,
      fullName: cleaned.fullName || ruleBased.fullName || undefined,
      nrc: cleaned.nrc || ruleBased.nrc || undefined,
      address: cleaned.address || ruleBased.address || undefined,
      originalData: row,
      confidence: cleaned.confidence ?? ruleBased.confidence,
      warnings: [...(cleaned.warnings || []), ...ruleBased.warnings],
      fixedFields: cleaned.fixedFields || [],
      aiSuggestions: cleaned.warnings || [],
    };
  } catch (error: any) {
    console.warn('AI cleaning failed, falling back to rule-based:', error);
    // Fallback to rule-based normalization
    const normalized = normalizeRowData(row, fieldMappings);
    return {
      ...normalized,
      fixedFields: [],
      aiSuggestions: [`AI error: ${error.message}`],
    };
  }
}

/**
 * Clean rows in batches (for efficiency and rate limiting)
 */
export async function cleanRowsBatch(
  rows: Record<string, any>[],
  fieldMappings: {
    phone?: string[];
    email?: string[];
    fullName?: string[];
    nrc?: string[];
    address?: string[];
  },
  options: BatchCleaningOptions = {}
): Promise<Array<AICleaningResult & { rowIndex: number }>> {
  const {
    batchSize = 10,
    useAI = true,
    confidenceThreshold = 0.7,
  } = options;
  
  const results: Array<AICleaningResult & { rowIndex: number }> = [];
  
  // Process in batches to respect rate limits
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (row, batchIndex) => {
      const rowIndex = i + batchIndex;
      
      if (useAI) {
        const aiClient = await getAIClient();
        if (aiClient) {
          // Use AI cleaning
          const cleaned = await cleanRowWithAI(row, fieldMappings);
          return { ...cleaned, rowIndex };
        }
      }
      
      // Fallback to rule-based
      {
        // Use rule-based only
        const normalized = normalizeRowData(row, fieldMappings);
        return {
          ...normalized,
          fixedFields: [],
          aiSuggestions: [],
          rowIndex,
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < rows.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * Determine if a row should be quarantined
 */
export function shouldQuarantineRow(
  cleaned: AICleaningResult,
  requiredFields: ('phone' | 'email' | 'fullName' | 'nrc')[] = ['fullName', 'phone']
): { shouldQuarantine: boolean; reasons: string[] } {
  const validation = validateNormalizedData(cleaned, requiredFields);
  const reasons: string[] = [];
  
  if (!validation.isValid) {
    reasons.push(`Missing required fields: ${validation.missingFields.join(', ')}`);
  }
  
  if (cleaned.confidence < 0.6) {
    reasons.push(`Low confidence score: ${cleaned.confidence.toFixed(2)}`);
  }
  
  if (cleaned.warnings.length > 2) {
    reasons.push(`Multiple warnings: ${cleaned.warnings.join('; ')}`);
  }
  
  // Check for suspicious patterns
  if (cleaned.fullName && cleaned.fullName.length < 3) {
    reasons.push('Name too short or invalid');
  }
  
  if (cleaned.phone && !cleaned.phone.startsWith('+260')) {
    reasons.push('Phone number not in expected format');
  }
  
  return {
    shouldQuarantine: reasons.length > 0 || !validation.isValid,
    reasons,
  };
}
