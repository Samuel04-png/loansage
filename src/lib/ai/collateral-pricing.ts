/**
 * AI-powered collateral pricing estimation for Zambian market
 * Uses DeepSeek API for intelligent market analysis
 */

import { callDeepSeekAPI, parseAIResponse, isDeepSeekConfigured } from './deepseek-client';

interface CollateralPricingInput {
  type: string;
  description?: string;
  brand?: string;
  model?: string;
  year?: number;
  condition?: 'excellent' | 'good' | 'fair' | 'poor';
  location?: string;
  estimatedValue?: number;
  specifications?: Record<string, any>;
}

interface PricingResult {
  estimatedMarketValue: number; // Fair Market Value
  estimatedSalePrice: number; // Quick Sale Value
  auctionPrice: number; // Auction price estimate
  collateralValueRange: {
    min: number;
    max: number;
    average: number;
  };
  confidence: 'high' | 'medium' | 'low';
  factors: {
    positive: string[];
    negative: string[];
  };
  marketAnalysis: string;
  recommendedAction: 'sell' | 'hold' | 'auction';
  loanCoverageRatio?: number; // Collateral value / Requested loan amount
  trendIndicator?: 'up' | 'down' | 'stable'; // Market trend
}

// Zambian market price ranges (in ZMW) - updated estimates
const MARKET_DATA: Record<string, { min: number; max: number; depreciation: number }> = {
  vehicle: { min: 50000, max: 500000, depreciation: 0.15 },
  land: { min: 100000, max: 5000000, depreciation: 0.02 },
  property: { min: 200000, max: 10000000, depreciation: 0.05 },
  equipment: { min: 10000, max: 500000, depreciation: 0.20 },
  electronics: { min: 5000, max: 50000, depreciation: 0.30 },
  jewelry: { min: 5000, max: 200000, depreciation: 0.10 },
  livestock: { min: 2000, max: 50000, depreciation: 0.25 },
  other: { min: 1000, max: 100000, depreciation: 0.20 },
};

const CONDITION_MULTIPLIERS = {
  excellent: 1.0,
  good: 0.85,
  fair: 0.65,
  poor: 0.40,
};

const LOCATION_MULTIPLIERS: Record<string, number> = {
  lusaka: 1.2,
  ndola: 1.1,
  kitwe: 1.05,
  livingstone: 1.0,
  chipata: 0.95,
  kabwe: 0.90,
  other: 0.85,
};

export async function estimateCollateralPrice(input: CollateralPricingInput & { agencyId?: string }): Promise<PricingResult> {
  const {
    type,
    description = '',
    brand,
    model,
    year,
    condition = 'good',
    location = 'other',
    estimatedValue = 0,
    specifications = {},
  } = input;

  // Try to use DeepSeek API for intelligent pricing if configured
  if (isDeepSeekConfigured()) {
    try {
      const prompt = `You are an expert appraiser specializing in the Zambian market. Analyze this collateral item and provide a detailed market valuation.

Collateral Details:
- Type: ${type}
- Description: ${description || 'Not provided'}
- Brand: ${brand || 'Not specified'}
- Model: ${model || 'Not specified'}
- Year: ${year || 'Not specified'}
- Condition: ${condition}
- Location: ${location || 'Not specified'}
- Current Estimated Value: ${estimatedValue ? `${estimatedValue} ZMW` : 'Not provided'}
- Additional Specifications: ${JSON.stringify(specifications)}

Please provide a JSON response with the following structure:
{
  "estimatedMarketValue": <number in ZMW - fair market value>,
  "estimatedSalePrice": <number in ZMW - quick sale value (65% of market)>,
  "auctionPrice": <number in ZMW - auction price (45% of market)>,
  "collateralValueRange": {
    "min": <number - conservative estimate>,
    "max": <number - optimistic estimate>,
    "average": <number - fair market value>
  },
  "confidence": "high" | "medium" | "low",
  "factors": {
    "positive": [<array of positive factors>],
    "negative": [<array of negative factors>]
  },
  "marketAnalysis": "<detailed analysis of Zambian market conditions for this item>",
  "recommendedAction": "sell" | "hold" | "auction",
  "trendIndicator": "up" | "down" | "stable"
}

Consider:
1. Current Zambian market prices for similar items
2. Depreciation based on age and condition
3. Location-based market demand
4. Brand/model reputation in Zambia
5. Resale market conditions
6. Economic factors affecting the Zambian market

Return ONLY valid JSON, no additional text.`;

      if (!input.agencyId) {
        console.warn('agencyId not provided, skipping AI collateral pricing');
        // Fall through to rule-based pricing
      } else {
        const response = await callDeepSeekAPI([
          {
            role: 'system',
            content: 'You are an expert appraiser for the Zambian market. Provide accurate, realistic valuations in ZMW (Zambian Kwacha). Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ], {
          temperature: 0.3, // Lower temperature for more consistent pricing
          maxTokens: 1500,
          agencyId: input.agencyId,
        });

        const aiResult = parseAIResponse<PricingResult>(response, {
          estimatedMarketValue: 0,
          estimatedSalePrice: 0,
          auctionPrice: 0,
          collateralValueRange: { min: 0, max: 0, average: 0 },
          confidence: 'low',
          factors: { positive: [], negative: [] },
          marketAnalysis: '',
          recommendedAction: 'hold',
          trendIndicator: 'stable',
        });

        // Validate and use AI result if it looks reasonable
        if (aiResult.estimatedMarketValue > 0 && aiResult.marketAnalysis) {
          return aiResult;
        }
      }
    } catch (error) {
      console.warn('DeepSeek API call failed, falling back to rule-based pricing:', error);
      // Fall through to rule-based pricing
    }
  }

  // Fallback to rule-based pricing
  const typeLower = type.toLowerCase();
  let basePrice = estimatedValue || 0;

  // Determine base price from market data if not provided
  if (!basePrice || basePrice === 0) {
    const marketInfo = MARKET_DATA[typeLower] || MARKET_DATA.other;
    basePrice = (marketInfo.min + marketInfo.max) / 2;
  }

  const factors: { positive: string[]; negative: string[] } = {
    positive: [],
    negative: [],
  };

  // Apply condition multiplier
  const conditionMultiplier = CONDITION_MULTIPLIERS[condition] || 0.65;
  basePrice *= conditionMultiplier;
  
  if (condition === 'excellent') factors.positive.push('Excellent condition');
  else if (condition === 'poor') factors.negative.push('Poor condition');

  // Apply location multiplier
  const locationKey = location.toLowerCase().replace(/\s+/g, '');
  const locationMultiplier = LOCATION_MULTIPLIERS[locationKey] || LOCATION_MULTIPLIERS.other;
  basePrice *= locationMultiplier;

  if (locationMultiplier > 1.0) {
    factors.positive.push(`Prime location (${location})`);
  } else if (locationMultiplier < 1.0) {
    factors.negative.push(`Remote location (${location})`);
  }

  // Apply depreciation based on age
  if (year) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    const depreciationRate = MARKET_DATA[typeLower]?.depreciation || 0.20;
    const depreciationFactor = Math.max(0.3, 1 - (age * depreciationRate));
    basePrice *= depreciationFactor;

    if (age > 10) {
      factors.negative.push(`High age (${age} years)`);
    } else if (age < 3) {
      factors.positive.push(`Recent model (${age} years old)`);
    }
  }

  // Brand/model premium adjustments
  if (brand && model) {
    const premiumBrands = ['toyota', 'honda', 'mercedes', 'bmw', 'land rover'];
    if (premiumBrands.some(b => brand.toLowerCase().includes(b))) {
      basePrice *= 1.15;
      factors.positive.push(`Premium brand (${brand})`);
    }
  }

  // Market demand adjustments (simplified)
  const highDemandTypes = ['vehicle', 'land', 'property'];
  if (highDemandTypes.includes(typeLower)) {
    basePrice *= 1.1;
    factors.positive.push('High market demand');
  }

  // Calculate different pricing scenarios
  // Quick Sale Value: 65% of market average (fast liquidation)
  const quickSaleValue = basePrice * 0.65;
  
  // Auction Price: 45% of market average (forced sale scenario)
  const auctionPrice = basePrice * 0.45;
  
  // Fair Market Value: base price (normal market conditions)
  const fairMarketValue = basePrice;
  
  // Calculate value range (high, mid, low)
  const valueRange = {
    min: basePrice * 0.50, // Conservative estimate
    max: basePrice * 1.15, // Optimistic estimate (with premium factors)
    average: basePrice,
  };
  
  // Estimated sale price for quick sale
  const estimatedSalePrice = quickSaleValue;

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (estimatedValue > 0 && year && brand && condition) {
    confidence = 'high';
  } else if (estimatedValue > 0 || (year && brand)) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Generate market analysis
  const marketAnalysis = generateMarketAnalysis(type, basePrice, location, condition);

  // Determine recommended action
  let recommendedAction: 'sell' | 'hold' | 'auction' = 'sell';
  if (basePrice > estimatedValue * 1.2) {
    recommendedAction = 'hold';
  } else if (basePrice < estimatedValue * 0.7) {
    recommendedAction = 'auction';
  }

  // Determine trend indicator (simplified - would need historical data for real trends)
  const trendIndicator: 'up' | 'down' | 'stable' = 
    basePrice > estimatedValue * 1.1 ? 'up' : 
    basePrice < estimatedValue * 0.9 ? 'down' : 
    'stable';

  return {
    estimatedMarketValue: Math.round(fairMarketValue),
    estimatedSalePrice: Math.round(estimatedSalePrice),
    auctionPrice: Math.round(auctionPrice),
    collateralValueRange: {
      min: Math.round(valueRange.min),
      max: Math.round(valueRange.max),
      average: Math.round(valueRange.average),
    },
    confidence,
    factors,
    marketAnalysis,
    recommendedAction,
    trendIndicator,
  };
}

function generateMarketAnalysis(
  type: string,
  price: number,
  location: string,
  condition: string
): string {
  const typeName = type.charAt(0).toUpperCase() + type.slice(1);
  const analysis = `Based on current Zambian market conditions, this ${typeName} in ${location} `;
  
  if (condition === 'excellent' || condition === 'good') {
    return analysis + `is in ${condition} condition and should fetch a competitive price. The estimated market value reflects current demand and comparable listings in the region.`;
  } else {
    return analysis + `may require additional marketing or price adjustments due to its ${condition} condition. Consider professional appraisal for accurate valuation.`;
  }
}

/**
 * Calculate loan coverage ratio (collateral value / loan amount)
 */
export function calculateLoanCoverageRatio(
  collateralValue: number,
  loanAmount: number
): number {
  if (loanAmount === 0) return 0;
  return Math.round((collateralValue / loanAmount) * 100) / 100;
}

/**
 * Calculate profit/loss from collateral sale vs defaulted loan amount
 */
export function calculateCollateralProfit(
  defaultedAmount: number,
  estimatedSalePrice: number,
  estimatedMarketValue: number
): {
  profit: number;
  loss: number;
  recoveryRate: number;
  recommendation: string;
} {
  const recovery = Math.min(estimatedSalePrice, defaultedAmount);
  const profit = estimatedSalePrice - defaultedAmount;
  const loss = defaultedAmount - estimatedSalePrice;
  const recoveryRate = (recovery / defaultedAmount) * 100;

  let recommendation = '';
  if (profit > 0) {
    recommendation = `Selling this collateral will result in a profit of ${profit.toLocaleString()} ZMW and fully recover the defaulted amount.`;
  } else if (recoveryRate >= 80) {
    recommendation = `Selling will recover ${recoveryRate.toFixed(1)}% of the defaulted amount. Consider negotiating for better terms.`;
  } else {
    recommendation = `Selling will only recover ${recoveryRate.toFixed(1)}% of the defaulted amount. Consider holding or seeking additional recovery methods.`;
  }

  return {
    profit: Math.max(0, profit),
    loss: Math.max(0, loss),
    recoveryRate,
    recommendation,
  };
}

