/**
 * Hook for fetching and managing Loan Packages (Enterprise Feature)
 */

import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { useAgency } from './useAgency';

export interface LoanPackage {
  id: string;
  name: string;
  description?: string;
  loanType: string;
  interestRate: number;
  interestRateType: 'fixed' | 'reducing';
  minAmount: number;
  maxAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  defaultTermMonths: number;
  processingFee?: number;
  processingFeeType?: 'fixed' | 'percentage';
  insuranceFee?: number;
  insuranceFeeType?: 'fixed' | 'percentage';
  collateralRequired: boolean;
  guarantorRequired: boolean;
  eligibilityCriteria?: string[];
  isActive: boolean;
}

export function useLoanPackages() {
  const { agency } = useAgency();

  const {
    data: packages = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['loanPackages', agency?.id],
    queryFn: async () => {
      if (!agency?.id) return [];

      try {
        const packagesRef = collection(db, 'agencies', agency.id, 'loan_packages');
        const q = query(
          packagesRef,
          where('isActive', '==', true),
          orderBy('name')
        );
        
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as LoanPackage[];
      } catch (error) {
        console.warn('Error fetching loan packages:', error);
        return [];
      }
    },
    enabled: !!agency?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Check if agency is on Enterprise plan
  const isEnterprise = agency?.plan === 'enterprise' || agency?.subscriptionPlan === 'enterprise';

  return {
    packages,
    isLoading,
    error,
    refetch,
    isEnterprise,
    hasPackages: packages.length > 0,
  };
}

/**
 * Get package by loan type
 */
export function getPackagesForLoanType(packages: LoanPackage[], loanType: string): LoanPackage[] {
  return packages.filter((p) => p.loanType === loanType);
}
