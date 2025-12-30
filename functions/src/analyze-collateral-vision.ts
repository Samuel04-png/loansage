/**
 * AI-Powered Collateral Value Analysis with Vision
 * Uses Gemini Vision API to analyze collateral images and search for market prices
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { enforceQuota } from './usage-ledger';
import { isInternalEmail } from './internal-bypass';

const db = admin.firestore();

interface AnalyzeCollateralRequest {
  agencyId: string;
  collateralId: string;
  imageUrl: string;
  type?: string;
  description?: string;
  location?: string;
}

interface MarketSource {
  title: string;
  url: string;
  price?: number;
  currency?: string;
}

interface AnalyzeCollateralResponse {
  success: boolean;
  identifiedItem: {
    name: string;
    brand?: string;
    model?: string;
    condition?: string;
    year?: string;
    features: string[];
  };
  marketAnalysis: {
    averagePrice: number;
    priceRange: { min: number; max: number };
    currency: string;
    confidence: 'high' | 'medium' | 'low';
    sources: MarketSource[];
  };
  recommendation: string;
  rawAnalysis?: string;
}

// Gemini API client
async function callGeminiVision(imageUrl: string, prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || functions.config().gemini?.api_key;
  
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Set GEMINI_API_KEY in environment.');
  }

  // Fetch image and convert to base64
  const fetch = (await import('node-fetch')).default;
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.buffer();
  const base64Image = imageBuffer.toString('base64');
  const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

  // Call Gemini Vision API
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Search for market prices using SerpAPI or fallback estimation
async function searchMarketPrices(
  itemName: string,
  location: string = 'Zambia'
): Promise<{ averagePrice: number; sources: MarketSource[]; priceRange: { min: number; max: number } }> {
  const serpApiKey = process.env.SERPAPI_KEY || functions.config().serpapi?.api_key;
  
  // If no SERP API key, use AI-estimated pricing
  if (!serpApiKey) {
    console.log('No SerpAPI key, using AI-estimated pricing');
    return estimatePriceWithAI(itemName, location);
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const query = encodeURIComponent(`${itemName} price ${location} used`);
    const url = `https://serpapi.com/search.json?q=${query}&api_key=${serpApiKey}&gl=zm&hl=en`;
    
    const response = await fetch(url);
    const data = await response.json() as any;
    
    const sources: MarketSource[] = [];
    const prices: number[] = [];

    // Parse shopping results if available
    if (data.shopping_results) {
      for (const result of data.shopping_results.slice(0, 5)) {
        const price = parsePrice(result.price);
        if (price > 0) {
          prices.push(price);
          sources.push({
            title: result.title,
            url: result.link || '',
            price,
            currency: 'ZMW',
          });
        }
      }
    }

    // Parse organic results for price mentions
    if (data.organic_results && prices.length < 3) {
      for (const result of data.organic_results.slice(0, 5)) {
        const priceMatch = (result.snippet || '').match(/K\s*[\d,]+(?:\.\d{2})?|ZMW\s*[\d,]+(?:\.\d{2})?|\$\s*[\d,]+(?:\.\d{2})?/gi);
        if (priceMatch) {
          const price = parsePrice(priceMatch[0]);
          if (price > 0 && price < 1000000) {
            prices.push(price);
            sources.push({
              title: result.title,
              url: result.link || '',
              price,
              currency: 'ZMW',
            });
          }
        }
      }
    }

    if (prices.length > 0) {
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      return {
        averagePrice: Math.round(avgPrice),
        sources,
        priceRange: {
          min: Math.round(Math.min(...prices)),
          max: Math.round(Math.max(...prices)),
        },
      };
    }

    // Fallback to AI estimation
    return estimatePriceWithAI(itemName, location);
  } catch (error) {
    console.error('Market search error:', error);
    return estimatePriceWithAI(itemName, location);
  }
}

// Parse price string to number (handles K, ZMW, $ formats)
function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

// AI-powered price estimation when no market data is available
async function estimatePriceWithAI(
  itemName: string,
  location: string
): Promise<{ averagePrice: number; sources: MarketSource[]; priceRange: { min: number; max: number } }> {
  const apiKey = process.env.GEMINI_API_KEY || functions.config().gemini?.api_key;
  
  if (!apiKey) {
    // Fallback to basic estimation
    return {
      averagePrice: 5000,
      sources: [{ title: 'AI Estimation', url: '', price: 5000, currency: 'ZMW' }],
      priceRange: { min: 3000, max: 8000 },
    };
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const prompt = `Estimate the market value for a used "${itemName}" in ${location}. 
    Return ONLY a JSON object with this exact format:
    {"averagePrice": 5000, "minPrice": 3000, "maxPrice": 8000}
    Use Zambian Kwacha (ZMW) values. Be realistic based on ${location} market conditions.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
        }),
      }
    );

    const data = await response.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        averagePrice: parsed.averagePrice || 5000,
        sources: [{ title: 'AI Market Estimation', url: '', price: parsed.averagePrice, currency: 'ZMW' }],
        priceRange: {
          min: parsed.minPrice || parsed.averagePrice * 0.7,
          max: parsed.maxPrice || parsed.averagePrice * 1.3,
        },
      };
    }
  } catch (error) {
    console.error('AI price estimation error:', error);
  }

  // Default fallback
  return {
    averagePrice: 5000,
    sources: [{ title: 'Default Estimation', url: '', price: 5000, currency: 'ZMW' }],
    priceRange: { min: 3000, max: 8000 },
  };
}

export const analyzeCollateralVision = functions.https.onCall(
  async (data: AnalyzeCollateralRequest, context): Promise<AnalyzeCollateralResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { agencyId, collateralId, imageUrl, type, description, location } = data;

    if (!imageUrl) {
      throw new functions.https.HttpsError('invalid-argument', 'Image URL is required');
    }

    try {
      // Enforce quota unless internal user
      if (!isInternalEmail(context)) {
        await enforceQuota(agencyId, 'aiCalls', 1);
      }

      // Step 1: Analyze image with Gemini Vision
      const visionPrompt = `Analyze this collateral item image and extract:
1. Item identification (specific brand, model, variant)
2. Estimated condition (excellent/good/fair/poor)
3. Estimated year/age if applicable
4. Key visual features that affect value
5. Any damage or wear visible

Context: This is a ${type || 'item'} being used as loan collateral.
${description ? `Description provided: ${description}` : ''}

Return a JSON object with this exact format:
{
  "itemName": "Full item name with brand and model",
  "brand": "Brand name",
  "model": "Model name/number",
  "condition": "good",
  "year": "2021",
  "features": ["Feature 1", "Feature 2"],
  "damageNotes": "Any visible damage"
}`;

      const visionResult = await callGeminiVision(imageUrl, visionPrompt);
      
      // Parse vision result
      let identifiedItem = {
        name: 'Unknown Item',
        brand: undefined as string | undefined,
        model: undefined as string | undefined,
        condition: 'good' as string,
        year: undefined as string | undefined,
        features: [] as string[],
      };

      try {
        const jsonMatch = visionResult.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          identifiedItem = {
            name: parsed.itemName || 'Unknown Item',
            brand: parsed.brand,
            model: parsed.model,
            condition: parsed.condition || 'good',
            year: parsed.year,
            features: parsed.features || [],
          };
        }
      } catch (e) {
        console.warn('Failed to parse vision result:', e);
        // Try to extract item name from raw text
        const nameMatch = visionResult.match(/(?:iPhone|Samsung|Toyota|Honda|Dell|HP|Lenovo|MacBook|iPad|TV|Television|Refrigerator|Laptop|Phone)[\w\s\d\-]+/i);
        if (nameMatch) {
          identifiedItem.name = nameMatch[0].trim();
        }
      }

      // Step 2: Search for market prices
      const searchQuery = identifiedItem.brand && identifiedItem.model
        ? `${identifiedItem.brand} ${identifiedItem.model} ${identifiedItem.year || ''}`.trim()
        : identifiedItem.name;

      const marketData = await searchMarketPrices(searchQuery, location || 'Zambia');

      // Adjust price based on condition
      const conditionMultiplier: Record<string, number> = {
        excellent: 1.1,
        good: 1.0,
        fair: 0.8,
        poor: 0.6,
      };
      const multiplier = conditionMultiplier[identifiedItem.condition] || 1.0;
      const adjustedPrice = Math.round(marketData.averagePrice * multiplier);

      // Calculate confidence based on data quality
      const confidence: 'high' | 'medium' | 'low' = 
        marketData.sources.length >= 3 && identifiedItem.brand && identifiedItem.model ? 'high' :
        marketData.sources.length >= 1 || identifiedItem.brand ? 'medium' : 'low';

      // Generate recommendation
      const recommendation = adjustedPrice > 10000
        ? `This ${identifiedItem.name} has good market value. Consider as primary collateral.`
        : adjustedPrice > 3000
        ? `This item has moderate resale value. Suitable as supplementary collateral.`
        : `This item has limited resale value. Consider requesting additional collateral.`;

      // Save analysis to Firestore
      if (collateralId) {
        try {
          const collateralRef = db.collection('agencies').doc(agencyId)
            .collection('collateral').doc(collateralId);
          
          await collateralRef.update({
            aiAnalysis: {
              identifiedItem,
              marketValue: adjustedPrice,
              confidence,
              analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            marketValue: adjustedPrice,
          });
        } catch (e) {
          console.warn('Failed to update collateral with analysis:', e);
        }
      }

      return {
        success: true,
        identifiedItem,
        marketAnalysis: {
          averagePrice: adjustedPrice,
          priceRange: {
            min: Math.round(marketData.priceRange.min * multiplier),
            max: Math.round(marketData.priceRange.max * multiplier),
          },
          currency: 'ZMW',
          confidence,
          sources: marketData.sources,
        },
        recommendation,
        rawAnalysis: visionResult,
      };
    } catch (error: any) {
      console.error('Collateral vision analysis error:', error);
      throw new functions.https.HttpsError('internal', error.message || 'Analysis failed');
    }
  }
);

