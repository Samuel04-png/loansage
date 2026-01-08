/**
 * Customer Stats Sync Utility
 * Recalculates and syncs customer statistics (totalLoans, activeLoans, totalBorrowed)
 * from actual loan data in Firestore
 */

import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc, 
  serverTimestamp,
  writeBatch 
} from 'firebase/firestore';
import { db } from './config';

export interface SyncStatsResult {
  success: boolean;
  customersUpdated: number;
  customersSkipped: number;
  errors: string[];
}

/**
 * Sync customer stats for a single customer
 * Recalculates totalLoans, activeLoans, and totalBorrowed from actual loan data
 */
export async function syncCustomerStats(
  agencyId: string,
  customerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get all loans for this customer
    const loansRef = collection(db, 'agencies', agencyId, 'loans');
    const loansQuery = query(loansRef, where('customerId', '==', customerId));
    const loansSnapshot = await getDocs(loansQuery);
    
    const loans = loansSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((loan: any) => !loan.deleted); // Exclude deleted loans
    
    // Calculate stats from actual loan data
    const totalLoans = loans.length;
    const activeLoans = loans.filter((loan: any) => 
      loan.status === 'active' || loan.status === 'approved'
    ).length;
    const totalBorrowed = loans.reduce((sum: number, loan: any) => 
      sum + Number(loan.amount || 0), 0
    );
    
    // Update customer document
    const customerRef = doc(db, 'agencies', agencyId, 'customers', customerId);
    await updateDoc(customerRef, {
      totalLoans,
      activeLoans,
      totalBorrowed,
      updatedAt: serverTimestamp(),
    });
    
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to sync stats for customer ${customerId}:`, error);
    return { success: false, error: error.message || 'Failed to sync stats' };
  }
}

/**
 * Sync customer stats for all customers in an agency
 * Use batch writes for better performance
 */
export async function syncAllCustomerStats(agencyId: string): Promise<SyncStatsResult> {
  const result: SyncStatsResult = {
    success: true,
    customersUpdated: 0,
    customersSkipped: 0,
    errors: [],
  };

  try {
    // Get all customers
    const customersRef = collection(db, 'agencies', agencyId, 'customers');
    const customersSnapshot = await getDocs(customersRef);
    const customers = customersSnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));

    // Get all loans for this agency (more efficient than querying per customer)
    const loansRef = collection(db, 'agencies', agencyId, 'loans');
    const loansSnapshot = await getDocs(loansRef);
    const allLoans = loansSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((loan: any) => !loan.deleted && loan.customerId);

    // Group loans by customerId
    const loansByCustomer: Record<string, any[]> = {};
    allLoans.forEach((loan: any) => {
      if (!loansByCustomer[loan.customerId]) {
        loansByCustomer[loan.customerId] = [];
      }
      loansByCustomer[loan.customerId].push(loan);
    });

    // Process customers in batches (Firestore batch limit is 500)
    const batchSize = 400; // Leave some margin
    const batches = [];
    let currentBatch = writeBatch(db);
    let operationCount = 0;

    for (const customer of customers) {
      const customerLoans = loansByCustomer[customer.id] || [];
      
      // Calculate stats
      const totalLoans = customerLoans.length;
      const activeLoans = customerLoans.filter((loan: any) => 
        loan.status === 'active' || loan.status === 'approved'
      ).length;
      const totalBorrowed = customerLoans.reduce((sum: number, loan: any) => 
        sum + Number(loan.amount || 0), 0
      );

      // Only update if stats changed (avoid unnecessary writes)
      const currentTotalLoans = customer.totalLoans || 0;
      const currentActiveLoans = customer.activeLoans || 0;
      const currentTotalBorrowed = customer.totalBorrowed || 0;

      if (
        totalLoans !== currentTotalLoans ||
        activeLoans !== currentActiveLoans ||
        Math.abs(totalBorrowed - currentTotalBorrowed) > 0.01 // Handle floating point comparison
      ) {
        const customerRef = doc(db, 'agencies', agencyId, 'customers', customer.id);
        currentBatch.update(customerRef, {
          totalLoans,
          activeLoans,
          totalBorrowed,
          updatedAt: serverTimestamp(),
        });
        operationCount++;
        result.customersUpdated++;

        // Commit batch if it reaches the limit
        if (operationCount >= batchSize) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      } else {
        result.customersSkipped++;
      }
    }

    // Commit remaining operations
    if (operationCount > 0) {
      batches.push(currentBatch);
    }

    // Execute all batches
    for (const batch of batches) {
      await batch.commit();
    }

    console.log(`Sync completed: ${result.customersUpdated} updated, ${result.customersSkipped} skipped`);
    return result;
  } catch (error: any) {
    console.error('Error syncing customer stats:', error);
    result.success = false;
    result.errors.push(error.message || 'Failed to sync customer stats');
    return result;
  }
}
