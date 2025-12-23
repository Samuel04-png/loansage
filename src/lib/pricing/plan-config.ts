/**
 * Pricing Plan Configuration
 * Source of truth for plan limits and features
 */

export type PlanCode = 'starter' | 'professional' | 'enterprise';

export interface PlanLimits {
  loanTypeLimit: number | null;
  maxCustomers: number | null;
  maxActiveLoans: number | null;
  maxUsers: number | null;
  storageLimitMB: number | null;
}

export interface PlanFeatures {
  aiInsights: boolean;
  collateralValuation: boolean;
  apiAccess: boolean;
  multiBranch: boolean;
  whiteLabel: boolean;
  scheduledReports: boolean;
  advancedAnalytics: boolean;
  multiUser: boolean;
}

export interface PlanConfig {
  name: string;
  price: number;
  description: string;
  limits: PlanLimits;
  features: PlanFeatures;
}

export const PLAN_CONFIG: Record<PlanCode, PlanConfig> = {
  starter: {
    name: 'Starter',
    price: 0,
    description: 'Perfect for testing and small operations',
    limits: {
      loanTypeLimit: 1,
      maxCustomers: 50,
      maxActiveLoans: 30,
      maxUsers: 1,
      storageLimitMB: 100,
    },
    features: {
      aiInsights: false,
      collateralValuation: false,
      apiAccess: false,
      multiBranch: false,
      whiteLabel: false,
      scheduledReports: false,
      advancedAnalytics: false,
      multiUser: false,
    },
  },
  professional: {
    name: 'Professional',
    price: 35,
    description: 'For growing agencies',
    limits: {
      loanTypeLimit: 3,
      maxCustomers: null, // Unlimited
      maxActiveLoans: null, // Unlimited
      maxUsers: null, // Unlimited
      storageLimitMB: 500,
    },
    features: {
      aiInsights: true,
      collateralValuation: true,
      apiAccess: false,
      multiBranch: false,
      whiteLabel: false,
      scheduledReports: false,
      advancedAnalytics: true,
      multiUser: true,
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 120,
    description: 'For large organizations',
    limits: {
      loanTypeLimit: null, // Unlimited
      maxCustomers: null, // Unlimited
      maxActiveLoans: null, // Unlimited
      maxUsers: null, // Unlimited
      storageLimitMB: 2048,
    },
    features: {
      aiInsights: true,
      collateralValuation: true,
      apiAccess: true,
      multiBranch: true,
      whiteLabel: true,
      scheduledReports: true,
      advancedAnalytics: true,
      multiUser: true,
    },
  },
};

/**
 * Normalize plan code from agency data
 * Handles both new 'plan' field and legacy 'planType' field
 */
export function normalizePlanCode(agency: any): PlanCode {
  if (!agency) return 'starter';
  
  // New plan field (primary)
  if (agency.plan === 'starter' || agency.plan === 'professional' || agency.plan === 'enterprise') {
    return agency.plan;
  }
  
  // Legacy fallback: planType free/paid
  if (agency.planType === 'paid') return 'professional';
  return 'starter';
}

/**
 * Get plan configuration for an agency
 */
export function getPlanConfig(agency: any): PlanConfig {
  const planCode = normalizePlanCode(agency);
  return PLAN_CONFIG[planCode];
}

