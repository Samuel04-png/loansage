/**
 * Optimized Dashboard Helpers
 * Uses real-time listeners and efficient queries
 */

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { db } from './config';

interface DashboardStats {
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
}

/**
 * Get optimized dashboard stats with real-time updates
 */
export function subscribeToDashboardStats(
  agencyId: string,
  callback: (stats: DashboardStats) => void
): () => void {
  if (!agencyId) {
    callback({
      totalActiveLoans: 0,
      totalDisbursedThisMonth: 0,
      repaymentsDue: 0,
      repaymentsDueCount: 0,
      activeCustomers: 0,
      totalCustomers: 0,
      totalEmployees: 0,
      approvalRate: 0,
      overdueLoans: 0,
      totalLoans: 0,
      totalPortfolioValue: 0,
    });
    return () => {};
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfMonthTimestamp = Timestamp.fromDate(startOfMonth);

  // Set up real-time listeners
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const customersRef = collection(db, 'agencies', agencyId, 'customers');
  const employeesRef = collection(db, 'agencies', agencyId, 'employees');

  let loansData: any[] = [];
  let customersData: any[] = [];
  let employeesData: any[] = [];

  const updateStats = async () => {
    // Filter out deleted loans
    const activeLoansData = loansData.filter((l: any) => !l.deleted);
    
    // Calculate stats from current data
    const activeLoans = activeLoansData.filter((l: any) => l.status === 'active');
    const totalLoans = activeLoansData.length;
    
    // Total disbursed this month
    const thisMonthLoans = activeLoansData.filter((l: any) => {
      const disbursementDate = l.disbursementDate?.toDate?.() || 
                               (l.disbursementDate instanceof Timestamp ? l.disbursementDate.toDate() : null) ||
                               (l.disbursementDate ? new Date(l.disbursementDate) : null);
      return disbursementDate && disbursementDate >= startOfMonth;
    });
    const totalDisbursedThisMonth = thisMonthLoans.reduce(
      (sum, l: any) => sum + Number(l.amount || 0), 
      0
    );

    // Repayments due - optimized query
    let repaymentsDue = 0;
    let repaymentsDueCount = 0;
    const nowTimestamp = Timestamp.now();
    
    for (const loan of activeLoans.slice(0, 50)) { // Limit to prevent too many queries
      try {
        const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loan.id, 'repayments');
        const dueQuery = query(
          repaymentsRef,
          where('status', '==', 'pending'),
          where('dueDate', '<=', nowTimestamp),
          limit(10)
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
    const overdueLoans = activeLoansData.filter((l: any) => {
      return l.status === 'overdue' || l.status === 'defaulted';
    });

    // Active customers (customers with at least one active loan)
    const activeCustomerIds = new Set(activeLoans.map((l: any) => l.customerId).filter(Boolean));
    const activeCustomers = activeCustomerIds.size;
    const totalCustomers = customersData.length;

    // Total portfolio value (sum of all active loan amounts)
    const totalPortfolioValue = activeLoans.reduce(
      (sum, l: any) => sum + Number(l.amount || 0),
      0
    );

    // Approval rate - exclude deleted loans
    const approvedLoans = activeLoansData.filter((l: any) => 
      ['active', 'completed', 'paid'].includes(l.status)
    );
    const approvalRate = totalLoans > 0 ? (approvedLoans.length / totalLoans) * 100 : 0;

    callback({
      totalActiveLoans: activeLoans.length,
      totalDisbursedThisMonth,
      repaymentsDue,
      repaymentsDueCount,
      activeCustomers,
      totalCustomers,
      totalEmployees: employeesData.length,
      approvalRate,
      overdueLoans: overdueLoans.length,
      totalLoans,
      totalPortfolioValue,
    });
  };

  // Set up listeners
  const unsubscribeLoans = onSnapshot(
    query(loansRef, orderBy('createdAt', 'desc'), limit(1000)),
    (snapshot) => {
      loansData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateStats();
    },
    (error) => {
      console.error('Error listening to loans:', error);
    }
  );

  const unsubscribeCustomers = onSnapshot(
    customersRef,
    (snapshot) => {
      customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateStats();
    },
    (error) => {
      console.error('Error listening to customers:', error);
    }
  );

  const unsubscribeEmployees = onSnapshot(
    employeesRef,
    (snapshot) => {
      employeesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateStats();
    },
    (error) => {
      console.error('Error listening to employees:', error);
    }
  );

  // Return unsubscribe function
  return () => {
    unsubscribeLoans();
    unsubscribeCustomers();
    unsubscribeEmployees();
  };
}

/**
 * Get customer loans with optimized query
 */
export async function getCustomerLoans(agencyId: string, customerId: string): Promise<any[]> {
  if (!agencyId || !customerId) return [];

  try {
    const loansRef = collection(db, 'agencies', agencyId, 'loans');
    const loansQuery = query(
      loansRef,
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(loansQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching customer loans:', error);
    // Fallback: try without orderBy if index is missing
    try {
      const loansRef = collection(db, 'agencies', agencyId, 'loans');
      const loansQuery = query(loansRef, where('customerId', '==', customerId));
      const snapshot = await getDocs(loansQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      return [];
    }
  }
}

