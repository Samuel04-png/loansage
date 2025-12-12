/**
 * Feature Gating Hook
 * Controls access to features based on subscription plan
 * 
 * DECEMBER SPECIAL: All features free until January 15, 2025
 */

import { useMemo } from 'react';
import { useAgency } from './useAgency';
import { getAgencyPlanStatus } from '../lib/firebase/subscription-helpers';

// December special end date - all features free until this date
const DECEMBER_SPECIAL_END_DATE = new Date('2025-01-15T23:59:59');

/**
 * Check if December special is still active (all features free)
 */
function isDecemberSpecialActive(): boolean {
  return new Date() < DECEMBER_SPECIAL_END_DATE;
}

export type FeatureKey =
  | 'unlimited_loans'
  | 'unlimited_team'
  | 'advanced_analytics'
  | 'real_time_collaboration'
  | 'api_access'
  | 'custom_integrations'
  | 'advanced_reporting'
  | 'bulk_operations'
  | 'export_capabilities'
  | 'automated_workflows'
  | 'priority_support'
  | 'advanced_offline_sync'
  | 'white_label'
  | 'custom_development'
  | 'sla_guarantee'
  | 'on_premise'
  | 'training_onboarding'
  | 'advanced_security'
  | 'custom_workflows'
  | 'advanced_audit_logs';

interface FeatureConfig {
  free: boolean;
  professional: boolean;
  enterprise: boolean;
}

const FEATURE_CONFIG: Record<FeatureKey, FeatureConfig> = {
  unlimited_loans: {
    free: false,
    professional: true,
    enterprise: true,
  },
  unlimited_team: {
    free: false,
    professional: true,
    enterprise: true,
  },
  advanced_analytics: {
    free: false,
    professional: true,
    enterprise: true,
  },
  real_time_collaboration: {
    free: false,
    professional: true,
    enterprise: true,
  },
  api_access: {
    free: false,
    professional: true,
    enterprise: true,
  },
  custom_integrations: {
    free: false,
    professional: true,
    enterprise: true,
  },
  advanced_reporting: {
    free: false,
    professional: true,
    enterprise: true,
  },
  bulk_operations: {
    free: false,
    professional: true,
    enterprise: true,
  },
  export_capabilities: {
    free: false,
    professional: true,
    enterprise: true,
  },
  automated_workflows: {
    free: false,
    professional: true,
    enterprise: true,
  },
  priority_support: {
    free: false,
    professional: true,
    enterprise: true,
  },
  advanced_offline_sync: {
    free: false,
    professional: true,
    enterprise: true,
  },
  white_label: {
    free: false,
    professional: false,
    enterprise: true,
  },
  custom_development: {
    free: false,
    professional: false,
    enterprise: true,
  },
  sla_guarantee: {
    free: false,
    professional: false,
    enterprise: true,
  },
  on_premise: {
    free: false,
    professional: false,
    enterprise: true,
  },
  training_onboarding: {
    free: false,
    professional: false,
    enterprise: true,
  },
  advanced_security: {
    free: false,
    professional: false,
    enterprise: true,
  },
  custom_workflows: {
    free: false,
    professional: false,
    enterprise: true,
  },
  advanced_audit_logs: {
    free: false,
    professional: false,
    enterprise: true,
  },
};

export interface FeatureGateResult {
  hasFeature: (feature: FeatureKey) => boolean;
  planType: 'free' | 'paid' | 'enterprise';
  isTrialing: boolean;
  daysRemaining: number | null;
  upgradeRequired: (feature: FeatureKey) => boolean;
  isDecemberSpecial: boolean;
  daysUntilGating: number | null;
}

/**
 * Hook to check feature access based on subscription plan
 */
export function useFeatureGate(): FeatureGateResult {
  const { agency } = useAgency();
  
  const planStatus = useMemo(() => {
    if (!agency) {
      return {
        planType: 'free' as const,
        isTrialing: false,
        daysRemaining: null,
      };
    }
    
    return getAgencyPlanStatus(agency);
  }, [agency]);
  
  const planType = useMemo(() => {
    if (planStatus.planType === 'free') return 'free';
    // Check if enterprise (would need additional field in agency)
    if (agency?.planType === 'enterprise') return 'enterprise';
    return 'paid';
  }, [planStatus, agency]);
  
  const hasFeature = (feature: FeatureKey): boolean => {
    // December special: All features free until January 15, 2025
    if (isDecemberSpecialActive()) {
      return true;
    }
    
    const config = FEATURE_CONFIG[feature];
    if (!config) return false;
    
    switch (planType) {
      case 'enterprise':
        return config.enterprise;
      case 'paid':
        return config.professional;
      case 'free':
        return config.free;
      default:
        return false;
    }
  };
  
  const upgradeRequired = (feature: FeatureKey): boolean => {
    return !hasFeature(feature);
  };
  
  const isDecemberSpecial = isDecemberSpecialActive();
  const daysUntilGating = isDecemberSpecial
    ? Math.ceil((DECEMBER_SPECIAL_END_DATE.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  
  return {
    hasFeature,
    planType,
    isTrialing: planStatus.isTrialing,
    daysRemaining: planStatus.daysRemaining,
    upgradeRequired,
    isDecemberSpecial,
    daysUntilGating,
  };
}

