import { doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './config';
import { serverTimestamp } from 'firebase/firestore';
import { createAuditLog } from './firestore-helpers';

/**
 * Delete a customer (soft delete by setting status to 'deleted')
 * Also checks if customer has active loans before deletion
 */
export async function deleteCustomer(
  agencyId: string,
  customerId: string,
  userId: string
): Promise<void> {
  // Check if customer has active loans
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const activeLoansQuery = query(
    loansRef,
    where('customerId', '==', customerId),
    where('status', 'in', ['draft', 'pending', 'approved', 'active', 'disbursed'])
  );
  const activeLoansSnapshot = await getDocs(activeLoansQuery);

  if (!activeLoansSnapshot.empty) {
    throw new Error('Cannot delete customer with active loans. Please close or cancel all loans first.');
  }

  // Soft delete: Set status to 'deleted' instead of actually deleting
  const customerRef = doc(db, 'agencies', agencyId, 'customers', customerId);
  await deleteDoc(customerRef);

  // Create audit log
  await createAuditLog(agencyId, {
    actorId: userId,
    action: 'delete_customer',
    targetCollection: 'customers',
    targetId: customerId,
    metadata: { deletedAt: new Date().toISOString() },
  }).catch(() => {});
}
