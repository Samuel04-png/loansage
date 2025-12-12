/**
 * Multi-Branch Management
 */

import { collection, addDoc, doc, updateDoc, getDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Branch } from '../../types/features';

/**
 * Create a new branch
 */
export async function createBranch(
  agencyId: string,
  branchData: Omit<Branch, 'id' | 'createdAt'>
): Promise<Branch> {
  const branchesRef = collection(db, 'agencies', agencyId, 'branches');
  
  const branch: Omit<Branch, 'id'> = {
    ...branchData,
    createdAt: new Date(),
  };

  const docRef = await addDoc(branchesRef, {
    ...branch,
    createdAt: branch.createdAt.toISOString(),
  });

  return {
    id: docRef.id,
    ...branch,
  };
}

/**
 * Update a branch
 */
export async function updateBranch(
  agencyId: string,
  branchId: string,
  updates: Partial<Branch>
): Promise<void> {
  const branchRef = doc(db, 'agencies', agencyId, 'branches', branchId);
  await updateDoc(branchRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Get all branches
 */
export async function getBranches(agencyId: string): Promise<Branch[]> {
  const branchesRef = collection(db, 'agencies', agencyId, 'branches');
  const snapshot = await getDocs(branchesRef);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(doc.data().createdAt),
  })) as Branch[];
}

/**
 * Get active branches
 */
export async function getActiveBranches(agencyId: string): Promise<Branch[]> {
  const branches = await getBranches(agencyId);
  return branches.filter(b => b.isActive);
}

/**
 * Get a single branch
 */
export async function getBranch(agencyId: string, branchId: string): Promise<Branch | null> {
  const branchRef = doc(db, 'agencies', agencyId, 'branches', branchId);
  const snapshot = await getDoc(branchRef);
  
  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
    createdAt: snapshot.data().createdAt?.toDate() || new Date(snapshot.data().createdAt),
  } as Branch;
}

/**
 * Delete a branch
 */
export async function deleteBranch(agencyId: string, branchId: string): Promise<void> {
  const branchRef = doc(db, 'agencies', agencyId, 'branches', branchId);
  await updateDoc(branchRef, {
    isActive: false,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Get branch statistics
 */
export async function getBranchStatistics(
  agencyId: string,
  branchId: string
): Promise<{
  totalLoans: number;
  activeLoans: number;
  totalCustomers: number;
  totalRevenue: number;
  defaultRate: number;
}> {
  // Get loans for this branch
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const loansSnapshot = await getDocs(loansRef);
  const allLoans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  const branchLoans = allLoans.filter((loan: any) => loan.branchId === branchId);
  const activeLoans = branchLoans.filter((loan: any) => loan.status === 'active');
  const defaultedLoans = branchLoans.filter((loan: any) => loan.status === 'defaulted');

  // Get customers for this branch
  const customersRef = collection(db, 'agencies', agencyId, 'customers');
  const customersSnapshot = await getDocs(customersRef);
  const allCustomers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const branchCustomers = allCustomers.filter((customer: any) => customer.branchId === branchId);

  // Calculate revenue
  let totalRevenue = 0;
  for (const loan of branchLoans) {
    try {
      const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loan.id, 'repayments');
      const repaymentsSnapshot = await getDocs(repaymentsRef);
      const repayments = repaymentsSnapshot.docs.map(doc => doc.data());
      
      const paidRepayments = repayments.filter(r => r.status === 'paid');
      const revenue = paidRepayments.reduce((sum, r) => sum + Number(r.amountPaid || r.amountDue || 0), 0);
      totalRevenue += revenue;
    } catch (error) {
      // Skip if error
    }
  }

  const defaultRate = branchLoans.length > 0 ? defaultedLoans.length / branchLoans.length : 0;

  return {
    totalLoans: branchLoans.length,
    activeLoans: activeLoans.length,
    totalCustomers: branchCustomers.length,
    totalRevenue,
    defaultRate,
  };
}

