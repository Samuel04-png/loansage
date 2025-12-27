/**
 * Collateral Value Market Estimation Callable Function
 * Uses AI to estimate market value of collateral
 */

import * as functions from 'firebase-functions';
import { enforceQuota } from './usage-ledger';
import { isInternalEmail } from './internal-bypass';

// Removed unused db reference

interface CollateralEstimationRequest {
  agencyId: string;
  collateralId: string;
  type: string;
  description: string;
  brand?: string;
  model?: string;
  year?: number;
  condition?: string;
  location?: string;
}

interface CollateralEstimationResponse {
  estimatedMarketValue: number;
  estimatedSalePrice: number;
  auctionPrice: number;
  confidence: 'high' | 'medium' | 'low';
  marketAnalysis: string;
  recommendedAction: 'sell' | 'hold' | 'auction';
}

export const estimateCollateralValue = functions.https.onCall(
  async (
    data: CollateralEstimationRequest,
    context: any
  ): Promise<CollateralEstimationResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { agencyId, type, brand, model, year, condition, location } = data;

    try {
      // Enforce per-day quota for collateral valuation unless internal
      if (!isInternalEmail(context)) {
        await enforceQuota(agencyId, 'collateralValuations', 1);
      }

      // This would integrate with your AI service
      // For now, using a simplified calculation
      let basePrice = 0;

      // Base pricing by type (Zambian market estimates)
      const typePricing: Record<string, number> = {
        vehicle: 50000,
        land: 100000,
        electronics: 5000,
        equipment: 20000,
        other: 10000,
      };

      basePrice = typePricing[type] || 10000;

      // Adjustments
      if (year) {
        const currentYear = new Date().getFullYear();
        const age = currentYear - year;
        const depreciation = Math.min(0.5, age * 0.05); // Max 50% depreciation
        basePrice *= 1 - depreciation;
      }

      if (condition === 'excellent') basePrice *= 1.1;
      else if (condition === 'good') basePrice *= 1.0;
      else if (condition === 'fair') basePrice *= 0.8;
      else if (condition === 'poor') basePrice *= 0.6;

      // Calculate different price points
      const estimatedMarketValue = Math.round(basePrice);
      const estimatedSalePrice = Math.round(basePrice * 0.65); // Quick sale
      const auctionPrice = Math.round(basePrice * 0.45); // Auction

      const confidence: 'high' | 'medium' | 'low' =
        brand && model && year ? 'high' : brand || model ? 'medium' : 'low';

      const marketAnalysis = `Based on ${type} type${brand ? `, brand: ${brand}` : ''}${
        model ? `, model: ${model}` : ''
      }${year ? `, year: ${year}` : ''}${condition ? `, condition: ${condition}` : ''}${
        location ? `, location: ${location}` : ''
      }. Estimated market value for Zambian market conditions.`;

      const recommendedAction: 'sell' | 'hold' | 'auction' =
        estimatedMarketValue > 100000 ? 'hold' : estimatedMarketValue > 50000 ? 'sell' : 'auction';

      return {
        estimatedMarketValue,
        estimatedSalePrice,
        auctionPrice,
        confidence,
        marketAnalysis,
        recommendedAction,
      };
    } catch (error: any) {
      console.error('Collateral estimation error:', error);
      throw new functions.https.HttpsError('internal', 'Estimation failed', error.message);
    }
  }
);

