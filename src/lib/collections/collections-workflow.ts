/**
 * Automated Collections Workflow
 */

import { collection, addDoc, doc, updateDoc, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CollectionCase, CollectionNote } from '../../types/features';

/**
 * Create collection case for overdue loan
 */
export async function createCollectionCase(
  agencyId: string,
  loanId: string,
  customerId: string
): Promise<CollectionCase> {
  // Get loan details
  const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
  const loanSnap = await getDoc(loanRef);
  
  if (!loanSnap.exists()) {
    throw new Error('Loan not found');
  }

  const loanData = loanSnap.data();
  
  // Get overdue repayments
  const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loanId, 'repayments');
  const repaymentsSnapshot = await getDocs(repaymentsRef);
  const repayments = repaymentsSnapshot.docs.map(doc => doc.data());
  
  const overdueRepayments = repayments.filter(r => {
    if (r.status !== 'pending') return false;
    const dueDate = r.dueDate?.toDate?.() || new Date(r.dueDate);
    return dueDate < new Date();
  });

  if (overdueRepayments.length === 0) {
    throw new Error('No overdue repayments found');
  }

  const oldestOverdue = overdueRepayments.sort((a, b) => {
    const dateA = a.dueDate?.toDate?.() || new Date(a.dueDate);
    const dateB = b.dueDate?.toDate?.() || new Date(b.dueDate);
    return dateA.getTime() - dateB.getTime();
  })[0];

  const dueDate = oldestOverdue.dueDate?.toDate?.() || new Date(oldestOverdue.dueDate);
  const daysOverdue = Math.floor((new Date().getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const totalOverdue = overdueRepayments.reduce((sum, r) => sum + Number(r.amountDue || 0), 0);

  // Determine priority
  let priority: 'low' | 'medium' | 'high' | 'urgent';
  if (daysOverdue >= 90) priority = 'urgent';
  else if (daysOverdue >= 60) priority = 'high';
  else if (daysOverdue >= 30) priority = 'medium';
  else priority = 'low';

  // Check if case already exists
  const casesRef = collection(db, 'agencies', agencyId, 'collection_cases');
  const existingCaseQuery = query(casesRef, where('loanId', '==', loanId), where('status', '!=', 'resolved'));
  const existingSnapshot = await getDocs(existingCaseQuery);
  
  if (!existingSnapshot.empty) {
    // Update existing case
    const existingCase = existingSnapshot.docs[0];
    await updateDoc(doc(db, 'agencies', agencyId, 'collection_cases', existingCase.id), {
      daysOverdue,
      amount: totalOverdue,
      priority,
      updatedAt: new Date().toISOString(),
    });
    
    return {
      id: existingCase.id,
      ...existingCase.data(),
      daysOverdue,
      amount: totalOverdue,
      priority,
    } as CollectionCase;
  }

  // Create new case
  const caseData: Omit<CollectionCase, 'id'> = {
    loanId,
    customerId,
    amount: totalOverdue,
    daysOverdue,
    status: 'new',
    priority,
    notes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const docRef = await addDoc(casesRef, {
    ...caseData,
    createdAt: caseData.createdAt.toISOString(),
    updatedAt: caseData.updatedAt.toISOString(),
  });

  return {
    id: docRef.id,
    ...caseData,
  };
}

/**
 * Get collection cases
 */
export async function getCollectionCases(
  agencyId: string,
  filters?: {
    status?: CollectionCase['status'];
    priority?: CollectionCase['priority'];
    assignedTo?: string;
  }
): Promise<CollectionCase[]> {
  const casesRef = collection(db, 'agencies', agencyId, 'collection_cases');
  
  let q = query(casesRef, orderBy('daysOverdue', 'desc'));
  
  if (filters?.status) {
    q = query(q, where('status', '==', filters.status));
  }
  if (filters?.priority) {
    q = query(q, where('priority', '==', filters.priority));
  }
  if (filters?.assignedTo) {
    q = query(q, where('assignedTo', '==', filters.assignedTo));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    notes: doc.data().notes || [],
    createdAt: doc.data().createdAt?.toDate() || new Date(doc.data().createdAt),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(doc.data().updatedAt),
    nextAction: doc.data().nextAction ? {
      ...doc.data().nextAction,
      scheduledAt: doc.data().nextAction.scheduledAt?.toDate() || new Date(doc.data().nextAction.scheduledAt),
    } : undefined,
  })) as CollectionCase[];
}

/**
 * Add note to collection case
 */
export async function addCollectionNote(
  agencyId: string,
  caseId: string,
  note: Omit<CollectionNote, 'id' | 'caseId' | 'createdAt'>
): Promise<CollectionNote> {
  const caseRef = doc(db, 'agencies', agencyId, 'collection_cases', caseId);
  const caseSnap = await getDoc(caseRef);
  
  if (!caseSnap.exists()) {
    throw new Error('Collection case not found');
  }

  const caseData = caseSnap.data() as CollectionCase;
  const notes = caseData.notes || [];

  const newNote: CollectionNote = {
    id: `note-${Date.now()}`,
    caseId,
    ...note,
    createdAt: new Date(),
  };

  notes.push(newNote);

  await updateDoc(caseRef, {
    notes,
    updatedAt: new Date().toISOString(),
  });

  return newNote;
}

/**
 * Assign collection case
 */
export async function assignCollectionCase(
  agencyId: string,
  caseId: string,
  assignedTo: string
): Promise<void> {
  const caseRef = doc(db, 'agencies', agencyId, 'collection_cases', caseId);
  await updateDoc(caseRef, {
    assignedTo,
    status: 'contacted',
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Update collection case status
 */
export async function updateCollectionCaseStatus(
  agencyId: string,
  caseId: string,
  status: CollectionCase['status']
): Promise<void> {
  const caseRef = doc(db, 'agencies', agencyId, 'collection_cases', caseId);
  await updateDoc(caseRef, {
    status,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Automatically create collection cases for overdue loans
 */
export async function autoCreateCollectionCases(agencyId: string): Promise<number> {
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const loansSnapshot = await getDocs(loansRef);
  const loans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  let casesCreated = 0;

  for (const loan of loans) {
    if (loan.status !== 'active' || loan.deleted) continue;

    try {
      const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loan.id, 'repayments');
      const repaymentsSnapshot = await getDocs(repaymentsRef);
      const repayments = repaymentsSnapshot.docs.map(doc => doc.data());

      const overdueRepayments = repayments.filter(r => {
        if (r.status !== 'pending') return false;
        const dueDate = r.dueDate?.toDate?.() || new Date(r.dueDate);
        return dueDate < new Date();
      });

      if (overdueRepayments.length > 0) {
        await createCollectionCase(agencyId, loan.id, loan.customerId || loan.customer_id);
        casesCreated++;
      }
    } catch (error) {
      console.warn(`Failed to create collection case for loan ${loan.id}:`, error);
    }
  }

  return casesCreated;
}

