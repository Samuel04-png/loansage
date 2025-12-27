/**
 * Loan Flow Engine
 * 
 * Builds dynamic loan creation flows based on templates and agency overrides
 */

import type { 
  LoanTypeTemplate, 
  LoanTypeConfig, 
  LoanStep, 
  LoanTypeRules,
  LoanTypeOverrides 
} from '../../types/loan-config';

/**
 * Get consolidated loan rules from template and agency overrides
 */
export function getLoanRules(
  template: LoanTypeTemplate,
  overrides?: LoanTypeOverrides
): LoanTypeRules {
  const rules = { ...template.rules };

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
 * Check if a step should be visible based on rules
 */
export function isStepVisible(step: LoanStep, rules: LoanTypeRules): boolean {
  // Always show required steps
  if (!step.optional) {
    return true;
  }

  // Handle optional steps based on rules
  switch (step.id) {
    case 'collateral':
      return rules.requiresCollateral === true;
    
    case 'collateral_valuation':
      return rules.requiresCollateralValuation === true;
    
    case 'employment':
      return rules.requiresEmployer === true;
    
    case 'business':
      return rules.requiresBusinessInfo === true;
    
    case 'guarantor_optional':
      return rules.allowsGuarantor === true || rules.requiresGuarantor === true;
    
    default:
      return true;
  }
}

/**
 * Build loan flow from template and agency configuration
 */
export function buildLoanFlow(
  template: LoanTypeTemplate,
  agencyConfig?: LoanTypeConfig
): LoanStep[] {
  const overrides = agencyConfig?.overrides;
  const rules = getLoanRules(template, overrides);

  // Filter steps based on rules
  const visibleSteps = template.flow.steps.filter(step => isStepVisible(step, rules));

  return visibleSteps;
}

/**
 * Get step index by step ID
 */
export function getStepIndex(steps: LoanStep[], stepId: string): number {
  return steps.findIndex(step => step.id === stepId);
}

/**
 * Get next step ID
 */
export function getNextStepId(steps: LoanStep[], currentStepId: string): string | null {
  const currentIndex = getStepIndex(steps, currentStepId);
  if (currentIndex === -1 || currentIndex === steps.length - 1) {
    return null;
  }
  return steps[currentIndex + 1].id;
}

/**
 * Get previous step ID
 */
export function getPreviousStepId(steps: LoanStep[], currentStepId: string): string | null {
  const currentIndex = getStepIndex(steps, currentStepId);
  if (currentIndex <= 0) {
    return null;
  }
  return steps[currentIndex - 1].id;
}

/**
 * Check if step can be skipped
 */
export function canSkipStep(step: LoanStep): boolean {
  return step.skippable === true;
}

