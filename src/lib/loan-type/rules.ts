/**
 * Loan Type Rules Helpers
 * 
 * Centralized functions for determining which sections to render
 */

import type { LoanTypeRules } from '../../types/loan-config';

/**
 * Check if collateral section should be rendered
 */
export function shouldRenderCollateral(rules: LoanTypeRules): boolean {
  return rules.requiresCollateral === true;
}

/**
 * Check if collateral valuation section should be rendered
 */
export function shouldRenderCollateralValuation(rules: LoanTypeRules): boolean {
  return rules.requiresCollateralValuation === true;
}

/**
 * Check if employment section should be rendered
 */
export function shouldRenderEmployment(rules: LoanTypeRules): boolean {
  return rules.requiresEmployer === true;
}

/**
 * Check if business section should be rendered
 */
export function shouldRenderBusiness(rules: LoanTypeRules): boolean {
  return rules.requiresBusinessInfo === true;
}

/**
 * Check if guarantor section should be rendered
 */
export function shouldRenderGuarantor(rules: LoanTypeRules): boolean {
  return rules.allowsGuarantor === true || rules.requiresGuarantor === true;
}

/**
 * Check if guarantor is required (not optional)
 */
export function isGuarantorRequired(rules: LoanTypeRules): boolean {
  return rules.requiresGuarantor === true;
}

