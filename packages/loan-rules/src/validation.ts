/**
 * Loan Validation Schemas
 * 
 * Zod schemas built from LoanTypeConfig
 * Shared between frontend and Cloud Functions
 */

import { z } from 'zod';
import type { LoanTypeConfig } from '../../src/types/loan-config';

/**
 * Build Zod schema for loan terms based on loan type configuration
 */
export function buildLoanTermsSchema(config: LoanTypeConfig) {
  return z.object({
    amount: z
      .number()
      .min(config.loanAmount.min, `Amount must be at least ${config.loanAmount.min.toLocaleString()}`)
      .max(config.loanAmount.max, `Amount cannot exceed ${config.loanAmount.max.toLocaleString()}`),
    currency: z.string().default('ZMW'),
    interestRate: z
      .number()
      .min(config.interestRate.min, `Interest rate must be at least ${config.interestRate.min}%`)
      .max(config.interestRate.max, `Interest rate cannot exceed ${config.interestRate.max}%`),
    durationMonths: z
      .number()
      .int()
      .min(config.duration.minMonths, `Duration must be at least ${config.duration.minMonths} months`)
      .max(config.duration.maxMonths, `Duration cannot exceed ${config.duration.maxMonths} months`),
    repaymentFrequency: z.enum(config.repaymentFrequency as [string, ...string[]], {
      errorMap: () => ({
        message: `Repayment frequency must be one of: ${config.repaymentFrequency.join(', ')}`,
      }),
    }),
  });
}

/**
 * Build schema for borrower information
 */
export function buildBorrowerSchema() {
  return z.object({
    fullName: z.string().min(2, 'Full name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Phone number is required'),
    nrcNumber: z.string().min(6, 'NRC number is required'),
    dateOfBirth: z.string().min(1, 'Date of birth is required'),
    address: z.string().min(5, 'Address is required'),
  });
}

/**
 * Build schema for collateral (if required)
 */
export function buildCollateralSchema() {
  return z.object({
    type: z.string().min(1, 'Collateral type is required'),
    description: z.string().min(5, 'Collateral description is required'),
    estimatedValue: z.number().min(0, 'Estimated value must be positive'),
    location: z.string().optional(),
    documents: z.array(z.string()).optional(),
  });
}

/**
 * Build schema for employment information (if required)
 */
export function buildEmploymentSchema() {
  return z.object({
    employerName: z.string().min(2, 'Employer name is required'),
    jobTitle: z.string().min(2, 'Job title is required'),
    employmentDuration: z.number().int().min(0, 'Employment duration must be non-negative'),
    monthlyIncome: z.number().min(0, 'Monthly income must be positive'),
    employmentType: z.enum(['permanent', 'contract', 'temporary', 'self-employed']),
  });
}

/**
 * Build schema for business information (if required)
 */
export function buildBusinessSchema() {
  return z.object({
    businessName: z.string().min(2, 'Business name is required'),
    businessType: z.string().min(2, 'Business type is required'),
    businessAge: z.number().int().min(0, 'Business age must be non-negative'),
    registrationNumber: z.string().optional(),
    monthlyRevenue: z.number().min(0, 'Monthly revenue must be positive').optional(),
  });
}

/**
 * Build schema for guarantor (if required)
 */
export function buildGuarantorSchema() {
  return z.object({
    fullName: z.string().min(2, 'Guarantor name is required'),
    phone: z.string().min(10, 'Guarantor phone is required'),
    nrcNumber: z.string().min(6, 'Guarantor NRC is required'),
    relationship: z.string().min(2, 'Relationship is required'),
    monthlyIncome: z.number().min(0, 'Monthly income must be positive').optional(),
  });
}

/**
 * Validate loan creation payload against loan type configuration
 */
export function validateLoanPayload(
  payload: any,
  config: LoanTypeConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate loan terms
  try {
    const termsSchema = buildLoanTermsSchema(config);
    termsSchema.parse(payload.terms);
  } catch (error: any) {
    if (error.errors) {
      errors.push(...error.errors.map((e: any) => e.message));
    }
  }

  // Validate borrower
  try {
    const borrowerSchema = buildBorrowerSchema();
    borrowerSchema.parse(payload.borrower);
  } catch (error: any) {
    if (error.errors) {
      errors.push(...error.errors.map((e: any) => e.message));
    }
  }

  // Validate collateral if required
  if (config.collateralRequirement === 'required' && !payload.collateral) {
    errors.push('Collateral is required for this loan type');
  } else if (payload.collateral) {
    try {
      const collateralSchema = buildCollateralSchema();
      collateralSchema.parse(payload.collateral);
    } catch (error: any) {
      if (error.errors) {
        errors.push(...error.errors.map((e: any) => e.message));
      }
    }
  }

  // Validate employment if required
  // Note: This would need to check rules.requiresEmployer, but for now we check collateralRequirement
  // In a full implementation, we'd check the rules object

  return {
    valid: errors.length === 0,
    errors,
  };
}

