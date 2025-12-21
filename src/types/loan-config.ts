/**
 * Dynamic Loan Type Configuration System
 * 
 * This system allows agencies to configure which loan types they offer
 * and customize rules, validations, and UI behavior per loan type.
 */

import { LucideIcon } from 'lucide-react';

/**
 * Base loan type identifier
 */
export type LoanTypeId = 
  | 'collateral_based'
  | 'salary_based'
  | 'sme_business'
  | 'personal_unsecured'
  | 'asset_financing'
  | 'custom_mixed'
  | 'education'
  | 'medical'
  | 'emergency'
  | 'microfinance'
  | 'group'
  | 'equipment'
  | 'working_capital'
  | 'invoice_financing'
  | 'trade_finance'
  | 'refinancing'
  | 'construction';

/**
 * Loan type category
 */
export type LoanTypeCategory = 'secured' | 'unsecured' | 'conditional' | 'hybrid';

/**
 * Interest calculation method
 */
export type InterestCalculationMethod = 'simple' | 'compound' | 'flat' | 'reducing_balance';

/**
 * Repayment frequency options
 */
export type RepaymentFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'custom';

/**
 * Collateral requirement level
 */
export type CollateralRequirement = 'required' | 'optional' | 'conditional' | 'not_required';

/**
 * Document requirement
 */
export interface DocumentRequirement {
  type: string; // e.g., 'nrc', 'payslip', 'bank_statement', 'collateral_deed'
  label: string;
  required: boolean;
  description?: string;
}

/**
 * Field configuration for loan type
 */
export interface LoanTypeField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'file' | 'checkbox';
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: string;
  };
  options?: Array<{ value: string; label: string }>;
  description?: string;
  conditional?: {
    field: string;
    value: any;
  };
}

/**
 * Risk assessment rules for loan type
 */
export interface RiskRules {
  minCreditScore?: number;
  maxDebtToIncome?: number;
  minCollateralCoverage?: number; // Percentage (e.g., 120 = 120%)
  maxLoanToValue?: number; // Percentage
  requiredGuarantors?: number;
  maxDefaultHistory?: number;
  minBusinessAge?: number; // Months
  minMonthlyIncome?: number;
}

/**
 * Interest rate configuration
 */
export interface InterestRateConfig {
  default: number;
  min: number;
  max: number;
  tiered?: Array<{
    amountRange: { min: number; max: number };
    rate: number;
  }>;
}

/**
 * Loan amount configuration
 */
export interface LoanAmountConfig {
  min: number;
  max: number;
  default?: number;
  increments?: number; // Suggested increment amounts
}

/**
 * Duration configuration
 */
export interface DurationConfig {
  minMonths: number;
  maxMonths: number;
  defaultMonths?: number;
  allowedFrequencies: RepaymentFrequency[];
}

/**
 * Per-loan-type configuration
 */
export interface LoanTypeConfig {
  id: LoanTypeId;
  name: string;
  description: string;
  icon?: string; // Icon name or identifier
  category: LoanTypeCategory;
  enabled: boolean;
  
  // Core loan parameters
  interestRate: InterestRateConfig;
  loanAmount: LoanAmountConfig;
  duration: DurationConfig;
  repaymentFrequency: RepaymentFrequency[];
  
  // Requirements
  collateralRequirement: CollateralRequirement;
  requiredDocuments: DocumentRequirement[];
  customFields: LoanTypeField[];
  
  // Risk and validation
  riskRules: RiskRules;
  eligibilityCriteria: {
    minAge?: number;
    maxAge?: number;
    employmentTypes?: string[];
    businessTypes?: string[];
    [key: string]: any;
  };
  
  // Calculations
  interestCalculationMethod: InterestCalculationMethod;
  gracePeriodDays: number;
  lateFeeRate: number;
  maxLateFeeRate: number;
  
  // UI/UX
  displayOrder: number;
  color?: string;
  badge?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * Agency loan configuration
 * Stores which loan types an agency offers and their configurations
 */
export interface AgencyLoanConfig {
  agencyId: string;
  
  // Enabled loan types with their configurations
  loanTypes: Record<LoanTypeId, LoanTypeConfig>;
  
  // Global defaults (can be overridden per loan type)
  globalDefaults: {
    currency: string;
    defaultInterestRate: number;
    defaultGracePeriod: number;
    defaultLateFeeRate: number;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  version: number; // For migration/versioning
}

/**
 * Loan type template
 * Used to initialize loan types for new agencies
 */
export interface LoanTypeTemplate {
  id: LoanTypeId;
  name: string;
  description: string;
  category: LoanTypeCategory;
  defaultConfig: Omit<LoanTypeConfig, 'id' | 'enabled' | 'createdAt' | 'updatedAt' | 'createdBy'>;
}

/**
 * Validation result for loan application
 */
export interface LoanValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  missingDocuments: string[];
  eligibilityScore?: number; // 0-100
}

