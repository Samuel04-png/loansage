/**
 * Tier configuration and quotas (derived daily caps from monthly limits).
 * Starter should remain useful but bounded; Professional enables automation with caps; Enterprise is high and overage-billable.
 */
export type Plan = 'starter' | 'professional' | 'enterprise';

export interface PerDayLimits {
  aiCalls: number; // Risk scoring and other AI inferences (derived from monthly)
  collateralValuations: number; // Market-based collateral valuations (derived from monthly)
  notificationsSent: number; // Email/FCM notifications (derived from monthly)
  loanValidations: number; // Callable loan validations guardrail
  analysisCalcs: number; // Non-AI heavy calculations (e.g., collateral profit projections)
  apiReads: number; // Derived daily cap from monthly API reads
  apiWrites: number; // Derived daily cap from monthly API writes
  pdfExports: number; // Derived daily cap for PDF generations
}

export interface AutomationCaps {
  enabled: boolean;
  scheduledAIEnabled: boolean;
  // Maximum number of documents processed per scheduled job run per agency (guardrail)
  scheduledDocsPerRun: number;
}

export interface TierLimits {
  perDay: PerDayLimits;
  automation: AutomationCaps;
  pdfEnabled: boolean;
}

export const TIER_LIMITS: Record<Plan, TierLimits> = {
  starter: {
    perDay: {
      // Monthly → Daily ceilings (ceil)
      aiCalls: 2, // 50 / 30
      collateralValuations: 2, // 50 / 30
      notificationsSent: 10, // 300 / 30
      loanValidations: 200,
      analysisCalcs: 20,
      apiReads: 0, // No API access
      apiWrites: 0,
      pdfExports: 0,
    },
    automation: {
      enabled: false,
      scheduledAIEnabled: false,
      scheduledDocsPerRun: 0,
    },
    pdfEnabled: false,
  },
  professional: {
    perDay: {
      aiCalls: 17, // 500 / 30
      collateralValuations: 10, // 300 / 30
      notificationsSent: 167, // 5000 / 30
      loanValidations: 1000,
      analysisCalcs: 100,
      apiReads: 3334, // 100k / 30
      apiWrites: 334, // 10k / 30
      pdfExports: 5, // 30 / 30 ~ 1/day; allow small burst
    },
    automation: {
      enabled: true,
      scheduledAIEnabled: true,
      scheduledDocsPerRun: 3000,
    },
    pdfEnabled: true,
  },
  enterprise: {
    perDay: {
      aiCalls: 167, // 5000 / 30
      collateralValuations: 67, // 2000 / 30
      notificationsSent: 1667, // 50000 / 30
      loanValidations: 5000,
      analysisCalcs: 1000,
      apiReads: 166667, // 5,000,000 / 30
      apiWrites: 16667, // 500,000 / 30
      pdfExports: 50, // generous daily cap; overage possible via billing
    },
    automation: {
      enabled: true,
      scheduledAIEnabled: true,
      scheduledDocsPerRun: 20000,
    },
    pdfEnabled: true,
  },
};

export function formatDateUTC(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}


