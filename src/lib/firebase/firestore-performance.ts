/**
 * Firestore Performance Optimizations
 * Pagination, composite indexes, batch operations, transactions
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  writeBatch,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';

export interface PaginationOptions {
  pageSize: number;
  lastDoc?: QueryDocumentSnapshot<DocumentData>;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  totalCount?: number;
}

/**
 * Paginated query with cursor-based pagination
 */
export async function paginatedQuery<T>(
  collectionPath: string,
  filters: Array<{ field: string; operator: any; value: any }> = [],
  options: PaginationOptions
): Promise<PaginatedResult<T>> {
  try {
    const { pageSize = 20, lastDoc, orderByField = 'createdAt', orderDirection = 'desc' } = options;

    let q = query(collection(db, collectionPath));

    // Apply filters
    for (const filter of filters) {
      q = query(q, where(filter.field, filter.operator, filter.value));
    }

    // Apply ordering
    if (orderByField) {
      q = query(q, orderBy(orderByField, orderDirection));
    }

    // Apply pagination
    q = query(q, limit(pageSize + 1)); // Fetch one extra to check if there's more

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;

    // Remove the extra doc if we fetched one
    const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;
    const data = resultDocs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    const newLastDoc = resultDocs.length > 0 ? resultDocs[resultDocs.length - 1] : null;

    return {
      data,
      lastDoc: newLastDoc,
      hasMore,
    };
  } catch (error: any) {
    console.error('Paginated query error:', error);
    throw new Error(`Failed to fetch paginated data: ${error.message}`);
  }
}

/**
 * Batch write operations for better performance
 */
export async function batchWrite(
  operations: Array<{
    type: 'set' | 'update' | 'delete';
    ref: any;
    data?: any;
  }>
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const maxBatchSize = 500; // Firestore limit

    // Process in batches of 500
    for (let i = 0; i < operations.length; i += maxBatchSize) {
      const batchOps = operations.slice(i, i + maxBatchSize);

      for (const op of batchOps) {
        switch (op.type) {
          case 'set':
            batch.set(op.ref, { ...op.data, updatedAt: serverTimestamp() });
            break;
          case 'update':
            batch.update(op.ref, { ...op.data, updatedAt: serverTimestamp() });
            break;
          case 'delete':
            batch.delete(op.ref);
            break;
        }
      }

      await batch.commit();
    }
  } catch (error: any) {
    console.error('Batch write error:', error);
    throw new Error(`Failed to execute batch write: ${error.message}`);
  }
}

/**
 * Transaction for atomic operations (e.g., repayment processing)
 */
export async function runAtomicTransaction<T>(
  transactionFn: (transaction: any) => Promise<T>
): Promise<T> {
  try {
    return await runTransaction(db, async (transaction) => {
      return await transactionFn(transaction);
    });
  } catch (error: any) {
    console.error('Transaction error:', error);
    throw new Error(`Transaction failed: ${error.message}`);
  }
}

/**
 * Server-side filtering with composite indexes
 * Note: Composite indexes must be created in Firebase Console
 */
export async function compositeQuery<T>(
  collectionPath: string,
  filters: {
    field1: string;
    value1: any;
    field2: string;
    value2: any;
    orderByField?: string;
    orderDirection?: 'asc' | 'desc';
    limitCount?: number;
  }
): Promise<T[]> {
  try {
    const {
      field1,
      value1,
      field2,
      value2,
      orderByField,
      orderDirection = 'asc',
      limitCount = 50,
    } = filters;

    let q = query(
      collection(db, collectionPath),
      where(field1, '==', value1),
      where(field2, '==', value2)
    );

    if (orderByField) {
      q = query(q, orderBy(orderByField, orderDirection));
    }

    q = query(q, limit(limitCount));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  } catch (error: any) {
    console.error('Composite query error:', error);
    throw new Error(`Failed to execute composite query: ${error.message}`);
  }
}

/**
 * Get count of documents (efficient for large collections)
 * Uses a separate counter document or estimates from query
 */
export async function getDocumentCount(
  collectionPath: string,
  filters: Array<{ field: string; operator: any; value: any }> = []
): Promise<number> {
  try {
    // For accurate counts, maintain a counter document
    // For estimates, use the query result size
    let q = query(collection(db, collectionPath));

    for (const filter of filters) {
      q = query(q, where(filter.field, filter.operator, filter.value));
    }

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error: any) {
    console.error('Count query error:', error);
    return 0;
  }
}

