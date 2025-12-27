/**
 * Loan Rules Engine
 * 
 * Pure functions for deriving effective rules from template + overrides + agency limits
 * Used by both frontend and Cloud Functions
 */

// Types are imported from the main src directory
// In a production setup, these would be in a shared types package
// For now, we'll use relative paths from the workspace root
import type { 
  LoanTypeTemplate, 
  LoanTypeConfig, 
  LoanTypeRules,
  LoanTypeOverrides 
} from '../../src/types/loan-config';

/**
 * Get consolidated loan rules from template and agency overrides
 */
export function getEffectiveRules(
  template: LoanTypeTemplate,
  agencyConfig?: LoanTypeConfig
): LoanTypeRules {
  const rules = { ...template.rules };
  const overrides = agencyConfig?.overrides;

  // Apply agency overrides (safe, limited)
  if (overrides?.disableGuarantor) {
    rules.allowsGuarantor = false;
    rules.requiresGuarantor = false;
  }

  if (overrides?.disableCollateralValuation) {
    rules.requiresCollateralValuation = false;
  }

  return rules;
}

/**
 * Validate loan amount against agency limits
 */
export function validateLoanAmount(
  amount: number,
  config: LoanTypeConfig
): { valid: boolean; error?: string } {
  if (amount < config.loanAmount.min) {
    return {
      valid: false,
      error: `Loan amount must be at least ${config.loanAmount.min.toLocaleString()} ${config.loanAmount.min > 0 ? 'ZMW' : ''}`,
    };
  }

  if (amount > config.loanAmount.max) {
    return {
      valid: false,
      error: `Loan amount cannot exceed ${config.loanAmount.max.toLocaleString()} ZMW`,
    };
  }

  return { valid: true };
}

/**
 * Validate interest rate against agency limits
 */
export function validateInterestRate(
  rate: number,
  config: LoanTypeConfig
): { valid: boolean; error?: string } {
  if (rate < config.interestRate.min) {
    return {
      valid: false,
      error: `Interest rate must be at least ${config.interestRate.min}%`,
    };
  }

  if (rate > config.interestRate.max) {
    return {
      valid: false,
      error: `Interest rate cannot exceed ${config.interestRate.max}%`,
    };
  }

  return { valid: true };
}

/**
 * Validate duration against agency limits
 */
export function validateDuration(
  months: number,
  config: LoanTypeConfig
): { valid: boolean; error?: string } {
  if (months < config.duration.minMonths) {
    return {
      valid: false,
      error: `Duration must be at least ${config.duration.minMonths} months`,
    };
  }

  if (months > config.duration.maxMonths) {
    return {
      valid: false,
      error: `Duration cannot exceed ${config.duration.maxMonths} months`,
    };
  }

  return { valid: true };
}

/**
 * Validate repayment frequency
 */
export function validateRepaymentFrequency(
  frequency: string,
  config: LoanTypeConfig
): { valid: boolean; error?: string } {
  if (!config.repaymentFrequency.includes(frequency as any)) {
    return {
      valid: false,
      error: `Repayment frequency must be one of: ${config.repaymentFrequency.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Check if loan type is enabled
 */
export function isLoanTypeEnabled(config: LoanTypeConfig | null): boolean {
  return config?.enabled === true;
}

