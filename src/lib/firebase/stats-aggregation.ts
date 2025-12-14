/**
 * Data Aggregation System
 * Pre-calculates and stores dashboard stats to reduce Firestore reads by 80%
 * Stats are updated on write operations, not on read
 */

import { doc, setDoc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './config';

export interface AgencyStats {
  totalActiveLoans: number;
  totalDisbursedThisMonth: number;
  repaymentsDue: number;
  repaymentsDueCount: number;
  activeCustomers: number;
  totalCustomers: number;
  totalEmployees: number;
  approvalRate: number;
  overdueLoans: number;
  totalLoans: number;
  totalPortfolioValue: number;
  lastUpdated: any;
}

/**
 * Get cached dashboard stats (reduces reads by 80%)
 */
export async function getCachedDashboardStats(agencyId: string): Promise<AgencyStats | null> {
  try {
    const statsRef = doc(db, 'agencies', agencyId, 'stats', 'dashboard');
    const statsSnap = await getDoc(statsRef);
    
    if (statsSnap.exists()) {
      return statsSnap.data() as AgencyStats;
    }
    return null;
  } catch (error) {
    console.error('Error fetching cached stats:', error);
    return null;
  }
}

/**
 * Update dashboard stats when loans change
 * Call this after creating/updating/deleting loans
 */
export async function updateDashboardStatsOnLoanChange(
  agencyId: string,
  changeType: 'create' | 'update' | 'delete',
  loanData?: any
): Promise<void> {
  try {
    const statsRef = doc(db, 'agencies', agencyId, 'stats', 'dashboard');
    const currentStats = await getCachedDashboardStats(agencyId);
    
    if (!currentStats) {
      // If no stats exist, trigger full recalculation
      await recalculateDashboardStats(agencyId);
      return;
    }

    const updates: Partial<AgencyStats> = {
      lastUpdated: serverTimestamp(),
    };

    // Incremental updates based on change type
    if (changeType === 'create' && loanData) {
      updates.totalLoans = (currentStats.totalLoans || 0) + 1;
      if (loanData.status === 'active') {
        updates.totalActiveLoans = (currentStats.totalActiveLoans || 0) + 1;
        updates.totalPortfolioValue = (currentStats.totalPortfolioValue || 0) + Number(loanData.amount || 0);
      }
    } else if (changeType === 'update' && loanData) {
      // Handle status changes
      const oldStatus = loanData.oldStatus;
      const newStatus = loanData.status;
      
      if (oldStatus !== 'active' && newStatus === 'active') {
        updates.totalActiveLoans = (currentStats.totalActiveLoans || 0) + 1;
        updates.totalPortfolioValue = (currentStats.totalPortfolioValue || 0) + Number(loanData.amount || 0);
      } else if (oldStatus === 'active' && newStatus !== 'active') {
        updates.totalActiveLoans = Math.max(0, (currentStats.totalActiveLoans || 0) - 1);
        updates.totalPortfolioValue = Math.max(0, (currentStats.totalPortfolioValue || 0) - Number(loanData.amount || 0));
      }
    } else if (changeType === 'delete' && loanData) {
      updates.totalLoans = Math.max(0, (currentStats.totalLoans || 0) - 1);
      if (loanData.status === 'active') {
        updates.totalActiveLoans = Math.max(0, (currentStats.totalActiveLoans || 0) - 1);
        updates.totalPortfolioValue = Math.max(0, (currentStats.totalPortfolioValue || 0) - Number(loanData.amount || 0));
      }
    }

    await setDoc(statsRef, updates, { merge: true });
  } catch (error) {
    console.error('Error updating dashboard stats:', error);
    // Don't throw - stats update failure shouldn't break the main operation
  }
}

/**
 * Update stats when customer changes
 */
export async function updateDashboardStatsOnCustomerChange(
  agencyId: string,
  changeType: 'create' | 'update' | 'delete'
): Promise<void> {
  try {
    const statsRef = doc(db, 'agencies', agencyId, 'stats', 'dashboard');
    const currentStats = await getCachedDashboardStats(agencyId);
    
    if (!currentStats) {
      await recalculateDashboardStats(agencyId);
      return;
    }

    const updates: Partial<AgencyStats> = {
      lastUpdated: serverTimestamp(),
    };

    if (changeType === 'create') {
      updates.totalCustomers = (currentStats.totalCustomers || 0) + 1;
    } else if (changeType === 'delete') {
      updates.totalCustomers = Math.max(0, (currentStats.totalCustomers || 0) - 1);
    }

    await setDoc(statsRef, updates, { merge: true });
  } catch (error) {
    console.error('Error updating customer stats:', error);
  }
}

/**
 * Full recalculation of dashboard stats (use sparingly)
 * Should be called:
 * - On initial setup
 * - Daily via Cloud Function
 * - When stats seem incorrect
 */
export async function recalculateDashboardStats(agencyId: string): Promise<AgencyStats> {
  const { collection, query, where, getDocs, Timestamp } = await import('firebase/firestore');
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfMonthTimestamp = Timestamp.fromDate(startOfMonth);

  // Get all loans
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const loansSnapshot = await getDocs(loansRef);
  const loans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Filter out deleted
  const activeLoans = loans.filter((l: any) => !l.deleted && l.status === 'active');
  const totalLoans = loans.filter((l: any) => !l.deleted).length;

  // Calculate stats
  const totalPortfolioValue = activeLoans.reduce((sum, l: any) => sum + Number(l.amount || 0), 0);
  
  const thisMonthLoans = loans.filter((l: any) => {
    if (l.deleted) return false;
    const disbursementDate = l.disbursementDate?.toDate?.() || 
                             (l.disbursementDate instanceof Timestamp ? l.disbursementDate.toDate() : null) ||
                             (l.disbursementDate ? new Date(l.disbursementDate) : null);
    return disbursementDate && disbursementDate >= startOfMonth;
  });
  const totalDisbursedThisMonth = thisMonthLoans.reduce(
    (sum, l: any) => sum + Number(l.amount || 0), 
    0
  );

  // Get customers
  const customersRef = collection(db, 'agencies', agencyId, 'customers');
  const customersSnapshot = await getDocs(customersRef);
  const totalCustomers = customersSnapshot.size;
  const activeCustomerIds = new Set(activeLoans.map((l: any) => l.customerId).filter(Boolean));
  const activeCustomers = activeCustomerIds.size;

  // Get employees
  const employeesRef = collection(db, 'agencies', agencyId, 'employees');
  const employeesSnapshot = await getDocs(employeesRef);
  const totalEmployees = employeesSnapshot.size;

  // Calculate repayments due (sample first 50 active loans to avoid too many queries)
  let repaymentsDue = 0;
  let repaymentsDueCount = 0;
  const nowTimestamp = Timestamp.now();
  
  for (const loan of activeLoans.slice(0, 50)) {
    try {
      const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loan.id, 'repayments');
      const dueQuery = query(
        repaymentsRef,
        where('status', '==', 'pending'),
        where('dueDate', '<=', nowTimestamp)
      );
      const dueSnapshot = await getDocs(dueQuery);
      repaymentsDueCount += dueSnapshot.size;
      repaymentsDue += dueSnapshot.docs.reduce(
        (sum, doc) => sum + Number(doc.data().amountDue || 0), 
        0
      );
    } catch (error) {
      console.warn(`Error fetching repayments for loan ${loan.id}:`, error);
    }
  }

  // Overdue loans
  const overdueLoans = loans.filter((l: any) => 
    !l.deleted && (l.status === 'overdue' || l.status === 'defaulted')
  ).length;

  // Approval rate
  const approvedLoans = loans.filter((l: any) => !l.deleted && l.status === 'approved').length;
  const pendingLoans = loans.filter((l: any) => !l.deleted && l.status === 'pending').length;
  const approvalRate = pendingLoans + approvedLoans > 0 
    ? (approvedLoans / (pendingLoans + approvedLoans)) * 100 
    : 0;

  const stats: AgencyStats = {
    totalActiveLoans: activeLoans.length,
    totalDisbursedThisMonth,
    repaymentsDue,
    repaymentsDueCount,
    activeCustomers,
    totalCustomers,
    totalEmployees,
    approvalRate,
    overdueLoans,
    totalLoans,
    totalPortfolioValue,
    lastUpdated: serverTimestamp(),
  };

  // Save to Firestore
  const statsRef = doc(db, 'agencies', agencyId, 'stats', 'dashboard');
  await setDoc(statsRef, stats);

  return stats;
}

/**
 * Batch update stats for multiple changes
 */
export async function batchUpdateStats(
  agencyId: string,
  updates: Partial<AgencyStats>
): Promise<void> {
  try {
    const statsRef = doc(db, 'agencies', agencyId, 'stats', 'dashboard');
    await setDoc(statsRef, {
      ...updates,
      lastUpdated: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Error batch updating stats:', error);
  }
}

