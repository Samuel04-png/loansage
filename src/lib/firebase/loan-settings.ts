/**
 * Loan Settings Helper
 * Fetches and manages agency loan calculation settings
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from './config';
import { isDemoMode } from './config';

export interface LoanSettings {
  defaultInterestRate: number;
  gracePeriodDays: number;
  lateFeeRate: number;
  maxLateFeeRate: number;
  minLoanAmount: number;
  maxLoanAmount: number;
  defaultLoanDuration: number;
  interestCalculationMethod: 'simple' | 'compound';
  updatedAt?: any;
}

export const DEFAULT_LOAN_SETTINGS: LoanSettings = {
  defaultInterestRate: 15,
  gracePeriodDays: 7,
  lateFeeRate: 2.5,
  maxLateFeeRate: 25,
  minLoanAmount: 1000,
  maxLoanAmount: 1000000,
  defaultLoanDuration: 12,
  interestCalculationMethod: 'simple',
};

/**
 * Get loan settings for an agency
 * Returns default settings if none are configured
 */
export async function getLoanSettings(agencyId: string): Promise<LoanSettings> {
  if (isDemoMode || !agencyId) {
    return DEFAULT_LOAN_SETTINGS;
  }

  try {
    const agencyRef = doc(db, 'agencies', agencyId);
    const agencySnap = await getDoc(agencyRef);

    if (agencySnap.exists()) {
      const agencyData = agencySnap.data();
      const loanSettings = agencyData.settings?.loanSettings;

      if (loanSettings) {
        return {
          defaultInterestRate: loanSettings.defaultInterestRate ?? DEFAULT_LOAN_SETTINGS.defaultInterestRate,
          gracePeriodDays: loanSettings.gracePeriodDays ?? DEFAULT_LOAN_SETTINGS.gracePeriodDays,
          lateFeeRate: loanSettings.lateFeeRate ?? DEFAULT_LOAN_SETTINGS.lateFeeRate,
          maxLateFeeRate: loanSettings.maxLateFeeRate ?? DEFAULT_LOAN_SETTINGS.maxLateFeeRate,
          minLoanAmount: loanSettings.minLoanAmount ?? DEFAULT_LOAN_SETTINGS.minLoanAmount,
          maxLoanAmount: loanSettings.maxLoanAmount ?? DEFAULT_LOAN_SETTINGS.maxLoanAmount,
          defaultLoanDuration: loanSettings.defaultLoanDuration ?? DEFAULT_LOAN_SETTINGS.defaultLoanDuration,
          interestCalculationMethod: loanSettings.interestCalculationMethod ?? DEFAULT_LOAN_SETTINGS.interestCalculationMethod,
          updatedAt: loanSettings.updatedAt,
        };
      }
    }
  } catch (error) {
    console.warn('Failed to fetch loan settings, using defaults:', error);
  }

  return DEFAULT_LOAN_SETTINGS;
}

/**
 * Get late fee configuration from loan settings
 */
export async function getLateFeeConfig(agencyId: string) {
  const settings = await getLoanSettings(agencyId);
  return {
    gracePeriodDays: settings.gracePeriodDays,
    lateFeeRate: settings.lateFeeRate,
    maxLateFeeRate: settings.maxLateFeeRate,
  };
}

