/**
 * Orphan Loan Detection & Matching
 * Detects loans without matching customers and suggests/creates mappings
 */

import { db } from '../firebase/config';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export interface OrphanLoan {
  loanId: string;
  borrowerId: string | null;
  borrowerName: string;
  amount: number;
  status: 'requires_mapping';
  dateCreated: string;
  rawData: Record<string, any>;
}

export interface CustomerMatch {
  customerId: string;
  customerName: string;
  matchType: 'exact' | 'national_id' | 'fuzzy' | 'none';
  confidence: number;
  reason: string;
}

export interface OrphanReconciliation {
  loanId: string;
  orphanLoan: OrphanLoan;
  suggestedMatch?: CustomerMatch;
  manualMatch?: string; // customer_id
}

/**
 * Calculate fuzzy match score between two strings
 * Returns 0-1, where 1 is perfect match
 */
function calculateFuzzyScore(str1: any, str2: any): number {
  // Convert to strings and handle null/undefined
  const s1 = String(str1 || '').toLowerCase().trim();
  const s2 = String(str2 || '').toLowerCase().trim();

  // If either is empty, no match
  if (!s1 || !s2) return 0;

  // Exact match
  if (s1 === s2) return 1;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.95;

  // Levenshtein distance
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1;

  const editDistance = getLevenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function getLevenshteinDistance(s1: string, s2: string): number {
  // Type guard
  if (typeof s1 !== 'string' || typeof s2 !== 'string') {
    return 0;
  }

  const s1Str = String(s1);
  const s2Str = String(s2);
  const costs: number[] = [];

  for (let k = 0; k <= s2Str.length; k++) costs[k] = k;

  let rowA = 1;
  while (rowA <= s1Str.length) {
    costs[0] = rowA;
    let rowB = 1;
    while (rowB <= s2Str.length) {
      const baa = costs[rowB];
      costs[rowB] = Math.min(
        costs[rowB] + 1,
        costs[rowB - 1] + 1,
        baa + (s1Str[rowA - 1] === s2Str[rowB - 1] ? 0 : 1)
      );
      rowB += 1;
    }
    rowA += 1;
  }

  return costs[s2Str.length];
}

/**
 * Attempt to find a matching customer for a loan
 * Tries in order: exact match, national_id match, fuzzy name match
 */
export async function findMatchingCustomer(
  agencyId: string,
  borrowerId: string | null,
  borrowerName: string,
  nationalId: string | null,
  fuzzyThreshold: number = 0.9
): Promise<CustomerMatch | null> {
  try {
    // Ensure borrowerName is a string
    const borrowerNameStr = String(borrowerName || '').trim();
    if (!borrowerNameStr) return null;

    const customersRef = collection(db, 'agencies', agencyId, 'customers');

    // 1. Try exact borrower_id match
    if (borrowerId) {
      const exactQuery = query(customersRef, where('id', '==', borrowerId));
      const exactSnap = await getDocs(exactQuery);
      if (!exactSnap.empty) {
        const customer = exactSnap.docs[0].data();
        return {
          customerId: customer.id,
          customerName: customer.full_name,
          matchType: 'exact',
          confidence: 1,
          reason: `Exact ID match: ${borrowerId}`,
        };
      }
    }

    // 2. Try national_id match
    if (nationalId) {
      const nrcQuery = query(customersRef, where('national_id', '==', nationalId));
      const nrcSnap = await getDocs(nrcQuery);
      if (!nrcSnap.empty) {
        const customer = nrcSnap.docs[0].data();
        return {
          customerId: customer.id,
          customerName: customer.full_name,
          matchType: 'national_id',
          confidence: 0.95,
          reason: `National ID match: ${nationalId}`,
        };
      }
    }

    // 3. Try fuzzy name match against all customers
    const allCustomersSnap = await getDocs(customersRef);
    let bestMatch: CustomerMatch | null = null;
    let bestScore = 0;

    for (const customerDoc of allCustomersSnap.docs) {
      const customer = customerDoc.data();
      const customerName = String(customer.full_name || '').trim();
      
      if (!customerName) continue; // Skip if no customer name
      
      const score = calculateFuzzyScore(borrowerNameStr, customerName);

      if (score > bestScore && score >= fuzzyThreshold) {
        bestScore = score;
        bestMatch = {
          customerId: customer.id,
          customerName: customerName,
          matchType: 'fuzzy',
          confidence: score,
          reason: `Fuzzy name match: "${borrowerNameStr}" ≈ "${customerName}" (${(score * 100).toFixed(0)}%)`,
        };
      }
    }

    return bestMatch;
  } catch (error) {
    console.error('Error finding matching customer:', error);
    return null;
  }
}

/**
 * Get all orphan loans for an agency
 */
export async function getOrphanLoans(agencyId: string): Promise<OrphanLoan[]> {
  try {
    const loansRef = collection(db, 'agencies', agencyId, 'loans');
    const orphanQuery = query(
      loansRef,
      where('status', '==', 'requires_mapping')
    );

    const orphanSnap = await getDocs(orphanQuery);
    const orphans: OrphanLoan[] = [];

    for (const doc of orphanSnap.docs) {
      const loan = doc.data();
      orphans.push({
        loanId: loan.id,
        borrowerId: loan.borrower_id || null,
        borrowerName: loan.borrower_name,
        amount: loan.amount,
        status: 'requires_mapping',
        dateCreated: loan.created_at || new Date().toISOString(),
        rawData: loan,
      });
    }

    return orphans;
  } catch (error) {
    console.error('Error getting orphan loans:', error);
    return [];
  }
}

/**
 * Get reconciliation suggestions for orphan loans
 */
export async function getOrphanReconciliationSuggestions(
  agencyId: string
): Promise<OrphanReconciliation[]> {
  const orphans = await getOrphanLoans(agencyId);
  const reconciliations: OrphanReconciliation[] = [];

  for (const orphan of orphans) {
    const suggestedMatch = await findMatchingCustomer(
      agencyId,
      orphan.borrowerId,
      orphan.borrowerName,
      orphan.rawData.national_id
    );

    reconciliations.push({
      loanId: orphan.loanId,
      orphanLoan: orphan,
      suggestedMatch: suggestedMatch || undefined,
    });
  }

  return reconciliations;
}

/**
 * Count orphan loans that need mapping
 */
export async function countOrphanLoans(agencyId: string): Promise<number> {
  try {
    const loansRef = collection(db, 'agencies', agencyId, 'loans');
    const orphanQuery = query(
      loansRef,
      where('status', '==', 'requires_mapping')
    );

    const orphanSnap = await getDocs(orphanQuery);
    return orphanSnap.size;
  } catch (error) {
    console.error('Error counting orphan loans:', error);
    return 0;
  }
}
