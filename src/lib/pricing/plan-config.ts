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
  aiInsights: boolean; // Starter: rule-based; Pro/Ent: DeepSeek-enabled
  collateralValuation: boolean; // Starter: basic; Pro/Ent: market-based
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
    description: 'Core loan CRM with on-demand insights and manual workflows',
    limits: {
      loanTypeLimit: null,
      maxCustomers: 200,
      maxActiveLoans: 100,
      maxUsers: 3,
      storageLimitMB: 2048, // 2 GB
    },
    features: {
      aiInsights: true, // rule-based only
      collateralValuation: true, // basic only
      apiAccess: false,
      multiBranch: false,
      whiteLabel: false,
      scheduledReports: false,
      advancedAnalytics: false,
      multiUser: true,
    },
  },
  professional: {
    name: 'Professional',
    price: 35,
    description: 'Automation, PDF export, and AI insights for growing agencies',
    limits: {
      loanTypeLimit: null,
      maxCustomers: 2000,
      maxActiveLoans: 1000,
      maxUsers: 10,
      storageLimitMB: 25600, // 25 GB
    },
    features: {
      aiInsights: true, // DeepSeek-enabled with caps
      collateralValuation: true, // market-based with caps
      apiAccess: true, // read-only
      multiBranch: true, // up to 5 branches
      whiteLabel: false,
      scheduledReports: true,
      advancedAnalytics: true,
      multiUser: true,
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 120,
    description: 'For large organizations',
    limits: {
      loanTypeLimit: null,
      maxCustomers: 20000,
      maxActiveLoans: 10000,
      maxUsers: null,
      storageLimitMB: 204800, // 200 GB
    },
    features: {
      aiInsights: true,
      collateralValuation: true,
      apiAccess: true, // read/write + webhooks
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

