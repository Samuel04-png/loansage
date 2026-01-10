/**
 * Quarantine System for Import Data Review
 * Handles rows that need manual review before import
 */

import { collection, doc, setDoc, serverTimestamp, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { AICleaningResult } from './ai-cleaning-service';

export interface QuarantinedRow {
  id: string;
  agencyId: string;
  importBatchId: string;
  rowIndex: number;
  originalData: Record<string, any>;
  cleanedData: AICleaningResult;
  quarantineReasons: string[];
  status: 'pending' | 'approved' | 'rejected' | 'fixed';
  fixedBy?: string;
  fixedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Save row to quarantine collection
 */
export async function quarantineRow(
  agencyId: string,
  importBatchId: string,
  rowIndex: number,
  originalData: Record<string, any>,
  cleanedData: AICleaningResult,
  reasons: string[]
): Promise<string> {
  const quarantineRef = collection(db, 'agencies', agencyId, 'import_quarantine');
  const quarantineDoc = doc(quarantineRef);
  
  const quarantinedRow: Omit<QuarantinedRow, 'id'> = {
    agencyId,
    importBatchId,
    rowIndex,
    originalData,
    cleanedData,
    quarantineReasons: reasons,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  await setDoc(quarantineDoc, {
    ...quarantinedRow,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  return quarantineDoc.id;
}

/**
 * Batch quarantine multiple rows
 */
export async function quarantineRowsBatch(
  agencyId: string,
  importBatchId: string,
  rows: Array<{
    rowIndex: number;
    originalData: Record<string, any>;
    cleanedData: AICleaningResult;
    reasons: string[];
  }>
): Promise<string[]> {
  const quarantineIds: string[] = [];
  
  // Use batch write for efficiency (Firestore limit is 500)
  const batchSize = 400;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { writeBatch } = await import('firebase/firestore');
    const firestoreBatch = writeBatch(db);
    
    for (const row of batch) {
      const quarantineRef = doc(collection(db, 'agencies', agencyId, 'import_quarantine'));
      firestoreBatch.set(quarantineRef, {
        agencyId,
        importBatchId,
        rowIndex: row.rowIndex,
        originalData: row.originalData,
        cleanedData: row.cleanedData,
        quarantineReasons: row.reasons,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      quarantineIds.push(quarantineRef.id);
    }
    
    await firestoreBatch.commit();
  }
  
  return quarantineIds;
}

/**
 * Get all quarantined rows for an import batch
 */
export async function getQuarantinedRows(
  agencyId: string,
  importBatchId: string
): Promise<QuarantinedRow[]> {
  const quarantineRef = collection(db, 'agencies', agencyId, 'import_quarantine');
  const q = query(
    quarantineRef,
    where('importBatchId', '==', importBatchId),
    where('status', '==', 'pending')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
  })) as QuarantinedRow[];
}

/**
 * Update quarantined row status
 */
export async function updateQuarantinedRow(
  agencyId: string,
  quarantineId: string,
  updates: {
    status: 'pending' | 'approved' | 'rejected' | 'fixed';
    fixedBy?: string;
    notes?: string;
    cleanedData?: Partial<AICleaningResult>;
  }
): Promise<void> {
  const quarantineRef = doc(db, 'agencies', agencyId, 'import_quarantine', quarantineId);
  const { updateDoc } = await import('firebase/firestore');
  
  await updateDoc(quarantineRef, {
    ...updates,
    fixedAt: updates.status === 'fixed' || updates.status === 'approved' ? serverTimestamp() : undefined,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Remove row from quarantine (after approval/import)
 */
export async function removeFromQuarantine(
  agencyId: string,
  quarantineId: string
): Promise<void> {
  const quarantineRef = doc(db, 'agencies', agencyId, 'import_quarantine', quarantineId);
  await deleteDoc(quarantineRef);
}

/**
 * Bulk approve quarantined rows
 */
export async function bulkApproveQuarantined(
  agencyId: string,
  quarantineIds: string[],
  userId: string
): Promise<void> {
  const { writeBatch } = await import('firebase/firestore');
  const batchSize = 400;
  
  for (let i = 0; i < quarantineIds.length; i += batchSize) {
    const batch = quarantineIds.slice(i, i + batchSize);
    const firestoreBatch = writeBatch(db);
    
    for (const id of batch) {
      const quarantineRef = doc(db, 'agencies', agencyId, 'import_quarantine', id);
      firestoreBatch.update(quarantineRef, {
        status: 'approved',
        fixedBy: userId,
        fixedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    
    await firestoreBatch.commit();
  }
}

/**
 * Get all pending quarantined rows for an agency (across all batches)
 */
export async function getAllPendingQuarantinedRows(agencyId: string): Promise<QuarantinedRow[]> {
  const quarantineRef = collection(db, 'agencies', agencyId, 'import_quarantine');
  const q = query(quarantineRef, where('status', '==', 'pending'));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
  })) as QuarantinedRow[];
}
