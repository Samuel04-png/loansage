/**
 * Collateral Risk Rating System
 * Assesses risk level, liquidity, depreciation, and theft risk for collateral
 */

export interface CollateralData {
  type: string;
  value: number;
  brand?: string;
  model?: string;
  year?: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  location?: string;
  verificationStatus?: 'verified' | 'pending' | 'rejected';
  documentationComplete?: boolean;
}

export interface CollateralRiskRating {
  riskLevel: 'low' | 'medium' | 'high';
  liquidityScore: number; // 0-100, higher is more liquid
  depreciationRiskScore: number; // 0-100, higher means faster depreciation
  theftRiskScore: number; // 0-100, higher means higher theft risk
  overallRiskScore: number; // 0-100, composite score
  factors: {
    positive: string[];
    negative: string[];
  };
  recommendations: string[];
}

// Liquidity factors by collateral type (higher = more liquid)
const LIQUIDITY_SCORES: Record<string, number> = {
  vehicle: 85,
  land: 60,
  property: 55,
  jewelry: 90,
  electronics: 75,
  equipment: 40,
  livestock: 50,
  other: 30,
};

// Depreciation rates by type (per year)
const DEPRECIATION_RATES: Record<string, number> = {
  vehicle: 0.15,
  electronics: 0.30,
  equipment: 0.20,
  jewelry: 0.05,
  land: 0.02,
  property: 0.05,
  livestock: 0.25,
  other: 0.15,
};

// Theft risk by type and location
const THEFT_RISK_FACTORS: Record<string, number> = {
  vehicle: 0.25,
  electronics: 0.30,
  jewelry: 0.35,
  equipment: 0.15,
  livestock: 0.40,
  land: 0.05,
  property: 0.10,
  other: 0.20,
};

/**
 * Calculate comprehensive collateral risk rating
 */
export function calculateCollateralRiskRating(data: CollateralData): CollateralRiskRating {
  const type = data.type.toLowerCase();
  
  // Calculate liquidity score
  const liquidityScore = calculateLiquidityScore(data, type);

  // Calculate depreciation risk
  const depreciationRiskScore = calculateDepreciationRisk(data, type);

  // Calculate theft risk
  const theftRiskScore = calculateTheftRisk(data, type);

  // Calculate overall risk (weighted)
  const overallRiskScore = calculateOverallRisk(
    liquidityScore,
    depreciationRiskScore,
    theftRiskScore,
    data
  );

  // Determine risk level
  const riskLevel = determineRiskLevel(overallRiskScore);

  // Generate factors and recommendations
  const { factors, recommendations } = generateRiskAnalysis(
    data,
    liquidityScore,
    depreciationRiskScore,
    theftRiskScore,
    riskLevel
  );

  return {
    riskLevel,
    liquidityScore,
    depreciationRiskScore,
    theftRiskScore,
    overallRiskScore,
    factors,
    recommendations,
  };
}

/**
 * Calculate liquidity score (0-100)
 */
function calculateLiquidityScore(data: CollateralData, type: string): number {
  let score = LIQUIDITY_SCORES[type] || 30;

  // Adjust based on condition
  const conditionMultipliers = {
    excellent: 1.0,
    good: 0.95,
    fair: 0.85,
    poor: 0.70,
  };
  score *= conditionMultipliers[data.condition];

  // Adjust based on brand/model recognition
  if (data.brand && isPremiumBrand(data.brand, type)) {
    score *= 1.1; // Premium brands are more liquid
  }

  // Adjust based on location (urban areas have better liquidity)
  if (data.location) {
    const urbanLocations = ['lusaka', 'ndola', 'kitwe', 'livingstone'];
    if (urbanLocations.some(loc => data.location?.toLowerCase().includes(loc))) {
      score *= 1.05;
    }
  }

  // Value affects liquidity (very high or very low values may be less liquid)
  if (data.value > 500000) {
    score *= 0.95; // Large values may take longer to sell
  } else if (data.value < 5000) {
    score *= 0.90; // Very low values may have limited market
  }

  return Math.min(100, Math.round(score));
}

/**
 * Calculate depreciation risk score (0-100, higher = faster depreciation)
 */
function calculateDepreciationRisk(data: CollateralData, type: string): number {
  const baseDepreciation = DEPRECIATION_RATES[type] || 0.15;
  let riskScore = baseDepreciation * 100; // Convert to 0-100 scale

  // Adjust based on age
  if (data.year) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - data.year;
    riskScore += age * 2; // Older items depreciate more
  }

  // Adjust based on condition
  const conditionFactors = {
    excellent: -10,
    good: 0,
    fair: 15,
    poor: 30,
  };
  riskScore += conditionFactors[data.condition];

  // Some types have stable value (land, property)
  if (type === 'land' || type === 'property') {
    riskScore *= 0.3; // Much lower depreciation risk
  }

  // Electronics and vehicles depreciate faster
  if (type === 'electronics' || type === 'vehicle') {
    riskScore *= 1.2;
  }

  return Math.min(100, Math.max(0, Math.round(riskScore)));
}

/**
 * Calculate theft risk score (0-100)
 */
function calculateTheftRisk(data: CollateralData, type: string): number {
  let riskScore = THEFT_RISK_FACTORS[type] || 0.20;
  riskScore *= 100; // Convert to 0-100 scale

  // Adjust based on location
  if (data.location) {
    const highCrimeLocations = ['high_density', 'informal_settlement', 'unsecured_area'];
    if (highCrimeLocations.some(area => data.location?.toLowerCase().includes(area))) {
      riskScore += 20;
    } else {
      const secureLocations = ['gated', 'secure', 'commercial'];
      if (secureLocations.some(area => data.location?.toLowerCase().includes(area))) {
        riskScore -= 15;
      }
    }
  }

  // Portable items have higher theft risk
  if (['electronics', 'jewelry'].includes(type)) {
    riskScore += 10;
  }

  // Verification status affects risk
  if (data.verificationStatus === 'verified') {
    riskScore -= 10;
  } else if (data.verificationStatus === 'rejected') {
    riskScore += 20;
  }

  // Documentation reduces risk
  if (data.documentationComplete) {
    riskScore -= 5;
  }

  return Math.min(100, Math.max(0, Math.round(riskScore)));
}

/**
 * Calculate overall risk score
 */
function calculateOverallRisk(
  liquidityScore: number,
  depreciationRiskScore: number,
  theftRiskScore: number,
  data: CollateralData
): number {
  // Lower liquidity = higher risk
  const liquidityRisk = 100 - liquidityScore;

  // Higher depreciation = higher risk
  const depreciationRisk = depreciationRiskScore;

  // Higher theft risk = higher overall risk
  const theftRisk = theftRiskScore;

  // Weighted average
  const weights = {
    liquidity: 0.40, // Liquidity is most important
    depreciation: 0.35,
    theft: 0.25,
  };

  let overallRisk = 
    liquidityRisk * weights.liquidity +
    depreciationRisk * weights.depreciation +
    theftRisk * weights.theft;

  // Adjust based on verification status
  if (data.verificationStatus === 'verified') {
    overallRisk *= 0.90;
  } else if (data.verificationStatus === 'rejected') {
    overallRisk *= 1.30;
  }

  return Math.min(100, Math.round(overallRisk));
}

/**
 * Determine risk level
 */
function determineRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score < 40) return 'low';
  if (score < 70) return 'medium';
  return 'high';
}

/**
 * Generate risk analysis
 */
function generateRiskAnalysis(
  data: CollateralData,
  liquidityScore: number,
  depreciationRiskScore: number,
  theftRiskScore: number,
  riskLevel: 'low' | 'medium' | 'high'
): {
  factors: { positive: string[]; negative: string[] };
  recommendations: string[];
} {
  const factors: { positive: string[]; negative: string[] } = {
    positive: [],
    negative: [],
  };

  const recommendations: string[] = [];

  // Liquidity factors
  if (liquidityScore >= 70) {
    factors.positive.push('High liquidity - easy to sell quickly');
  } else if (liquidityScore < 50) {
    factors.negative.push('Low liquidity - may take time to sell');
    recommendations.push('Consider requiring additional collateral for better liquidity coverage');
  }

  // Depreciation factors
  if (depreciationRiskScore < 30) {
    factors.positive.push('Low depreciation risk - value remains stable');
  } else if (depreciationRiskScore >= 60) {
    factors.negative.push(`High depreciation risk (${depreciationRiskScore}%) - value decreases quickly`);
    recommendations.push('Monitor collateral value regularly and consider periodic revaluation');
  }

  // Theft risk factors
  if (theftRiskScore < 30) {
    factors.positive.push('Low theft risk - well-secured collateral');
  } else if (theftRiskScore >= 50) {
    factors.negative.push(`High theft risk (${theftRiskScore}%)`);
    recommendations.push('Ensure proper insurance coverage and secure storage');
  }

  // Verification status
  if (data.verificationStatus === 'verified') {
    factors.positive.push('Collateral verified and documented');
  } else if (data.verificationStatus === 'pending') {
    factors.negative.push('Collateral verification pending');
    recommendations.push('Complete collateral verification before loan approval');
  } else if (data.verificationStatus === 'rejected') {
    factors.negative.push('Collateral verification rejected');
    recommendations.push('Require alternative collateral or reject application');
  }

  // Condition
  if (data.condition === 'poor') {
    factors.negative.push('Poor condition reduces value and liquidity');
    recommendations.push('Consider lower valuation or requiring repair');
  }

  // Overall recommendations
  if (riskLevel === 'high') {
    recommendations.push('HIGH RISK COLLATERAL: Require additional safeguards or higher LTV margin');
  } else if (riskLevel === 'medium') {
    recommendations.push('Monitor collateral value and market conditions');
  }

  return { factors, recommendations };
}

/**
 * Check if brand is premium
 */
function isPremiumBrand(brand: string, type: string): boolean {
  const premiumBrands: Record<string, string[]> = {
    vehicle: ['toyota', 'honda', 'mercedes', 'bmw', 'land rover', 'lexus'],
    electronics: ['apple', 'samsung', 'sony', 'dell', 'hp'],
    jewelry: ['tiffany', 'cartier', 'bulgari'],
  };

  const brands = premiumBrands[type] || [];
  return brands.some(pb => brand.toLowerCase().includes(pb.toLowerCase()));
}

