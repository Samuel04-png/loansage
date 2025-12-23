/**
 * Pricing Plan Configuration (Server-side)
 * Source of truth for plan limits and features
 */

export type PlanCode = 'starter' | 'professional' | 'enterprise';

export interface PlanConfig {
  limits: {
    loanTypeLimit: number | null;
    maxCustomers: number | null;
    maxActiveLoans: number | null;
  };
  features: {
    aiInsights: boolean;
    collateralValuation: boolean;
    apiAccess: boolean;
    multiBranch: boolean;
    whiteLabel: boolean;
    scheduledReports: boolean;
    advancedAnalytics: boolean;
  };
}

export const PLAN_CONFIG: Record<PlanCode, PlanConfig> = {
  starter: {
    limits: {
      loanTypeLimit: 1,
      maxCustomers: 50,
      maxActiveLoans: 30,
    },
    features: {
      aiInsights: false,
      collateralValuation: false,
      apiAccess: false,
      multiBranch: false,
      whiteLabel: false,
      scheduledReports: false,
      advancedAnalytics: false,
    },
  },
  professional: {
    limits: {
      loanTypeLimit: 3,
      maxCustomers: null, // Unlimited
      maxActiveLoans: null, // Unlimited
    },
    features: {
      aiInsights: true,
      collateralValuation: true,
      apiAccess: false,
      multiBranch: false,
      whiteLabel: false,
      scheduledReports: false,
      advancedAnalytics: true,
    },
  },
  enterprise: {
    limits: {
      loanTypeLimit: null, // Unlimited
      maxCustomers: null, // Unlimited
      maxActiveLoans: null, // Unlimited
    },
    features: {
      aiInsights: true,
      collateralValuation: true,
      apiAccess: true,
      multiBranch: true,
      whiteLabel: true,
      scheduledReports: true,
      advancedAnalytics: true,
    },
  },
};

/**
 * Stripe Product and Price IDs
 */
const STRIPE_PRICE_IDS = {
  professional: 'price_1SbPCBELOV3w2OwuwlZDaIwz', // $35/month
  enterprise: 'price_1ShY04ELOV3w2OwuftyGsVwD', // $120/month
} as const;

const STRIPE_PRODUCT_IDS = {
  professional: 'prod_TYWEIL2gnwQmvD', // $35/month product
  enterprise: 'prod_TerjZdXL909Mxh', // $125/month product
} as const;

/**
 * Get Stripe Price ID for a plan
 */
export function getPriceIdForPlan(plan: PlanCode): string | null {
  switch (plan) {
    case 'starter':
      return null; // Starter is free, no Stripe price
    case 'professional':
      return STRIPE_PRICE_IDS.professional;
    case 'enterprise':
      return STRIPE_PRICE_IDS.enterprise;
    default:
      return null;
  }
}

/**
 * Get Stripe Product ID for a plan
 */
export function getProductIdForPlan(plan: PlanCode): string | null {
  switch (plan) {
    case 'starter':
      return null; // Starter is free, no Stripe product
    case 'professional':
      return STRIPE_PRODUCT_IDS.professional;
    case 'enterprise':
      return STRIPE_PRODUCT_IDS.enterprise;
    default:
      return null;
  }
}

/**
 * Get plan code from Stripe Price ID
 */
export function getPlanFromPriceId(priceId: string): PlanCode {
  if (!priceId) return 'starter';
  
  if (priceId === STRIPE_PRICE_IDS.professional) return 'professional';
  if (priceId === STRIPE_PRICE_IDS.enterprise) return 'enterprise';
  
  // Default fallback - if it's a paid price but unknown, assume professional
  // This handles edge cases where price IDs might not match exactly
  return 'professional';
}

