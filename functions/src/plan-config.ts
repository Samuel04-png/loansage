/**
 * Pricing Plan Configuration (Server-side)
 * Source of truth for plan limits and features
 */

export type PlanCode = 'starter' | 'professional' | 'enterprise';

export interface PlanQuotas {
  maxActiveLoans: number | null;
  maxCustomers: number | null;
  maxUsers: number | null;
  maxBranches: number | null;
  storageGbIncluded: number;
  perFileMbMax: number;
  collateralPhotosPerLoan: number;
  notificationsMonthly: number;
  aiRiskCallsMonthly: number;
  collateralValuationsMonthly: number;
  scheduledAiChecksPerDay: number;
  scheduledReportsPerMonth: number;
  apiReadsMonthly: number | null;
  apiWritesMonthly: number | null;
  scheduledDocsPerRun: number; // Cap documents processed per scheduled run per agency
}

export interface PlanConfig {
  limits: {
    loanTypeLimit: number | null;
    maxCustomers: number | null;
    maxActiveLoans: number | null;
  };
  features: {
    aiInsights: 'disabled' | 'rule_based' | 'deepseek';
    collateralValuation: 'disabled' | 'basic' | 'market_based';
    apiAccess: 'none' | 'read_only' | 'read_write';
    multiBranch: boolean;
    whiteLabel: boolean;
    scheduledReports: boolean;
    advancedAnalytics: boolean;
    pdfExport: boolean;
  };
  quotas: PlanQuotas;
}

export const PLAN_CONFIG: Record<PlanCode, PlanConfig> = {
  starter: {
    limits: {
      loanTypeLimit: null,
      maxCustomers: 200,
      maxActiveLoans: 100,
    },
    features: {
      aiInsights: 'rule_based', // No DeepSeek calls
      collateralValuation: 'basic',
      apiAccess: 'none',
      multiBranch: false,
      whiteLabel: false,
      scheduledReports: false,
      advancedAnalytics: false,
      pdfExport: false,
    },
    quotas: {
      maxActiveLoans: 100,
      maxCustomers: 200,
      maxUsers: 3,
      maxBranches: 1,
      storageGbIncluded: 2,
      perFileMbMax: 5,
      collateralPhotosPerLoan: 3,
      notificationsMonthly: 300,
      aiRiskCallsMonthly: 50,
      collateralValuationsMonthly: 50,
      scheduledAiChecksPerDay: 0,
      scheduledReportsPerMonth: 0,
      apiReadsMonthly: null,
      apiWritesMonthly: null,
      scheduledDocsPerRun: 0,
    },
  },
  professional: {
    limits: {
      loanTypeLimit: null,
      maxCustomers: 2000,
      maxActiveLoans: 1000,
    },
    features: {
      aiInsights: 'deepseek',
      collateralValuation: 'market_based',
      apiAccess: 'read_only',
      multiBranch: true,
      whiteLabel: false,
      scheduledReports: true,
      advancedAnalytics: true,
      pdfExport: true,
    },
    quotas: {
      maxActiveLoans: 1000,
      maxCustomers: 2000,
      maxUsers: 10,
      maxBranches: 5,
      storageGbIncluded: 25,
      perFileMbMax: 10,
      collateralPhotosPerLoan: 6,
      notificationsMonthly: 5000,
      aiRiskCallsMonthly: 500,
      collateralValuationsMonthly: 300,
      scheduledAiChecksPerDay: 50,
      scheduledReportsPerMonth: 30,
      apiReadsMonthly: 100_000,
      apiWritesMonthly: 10_000,
      scheduledDocsPerRun: 200, // batch cap per run per agency
    },
  },
  enterprise: {
    limits: {
      loanTypeLimit: null,
      maxCustomers: 20000,
      maxActiveLoans: 10000,
    },
    features: {
      aiInsights: 'deepseek',
      collateralValuation: 'market_based',
      apiAccess: 'read_write',
      multiBranch: true,
      whiteLabel: true,
      scheduledReports: true,
      advancedAnalytics: true,
      pdfExport: true,
    },
    quotas: {
      maxActiveLoans: 10_000,
      maxCustomers: 20_000,
      maxUsers: null,
      maxBranches: null,
      storageGbIncluded: 200,
      perFileMbMax: 25,
      collateralPhotosPerLoan: 12,
      notificationsMonthly: 50_000,
      aiRiskCallsMonthly: 5000,
      collateralValuationsMonthly: 2000,
      scheduledAiChecksPerDay: 1000,
      scheduledReportsPerMonth: 500,
      apiReadsMonthly: 5_000_000,
      apiWritesMonthly: 500_000,
      scheduledDocsPerRun: 2000,
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
 
