/**
 * Import Approved Quarantine Rows
 * Processes quarantined rows that have been approved/fixed by the user
 */

import { getAllPendingQuarantinedRows, removeFromQuarantine } from './quarantine-system';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { executeBulkImport, ImportRow } from './bulk-import-service';
import { validateNormalizedData } from './data-normalization';

export interface ImportQuarantineResult {
  success: number;
  failed: number;
  errors: Array<{ quarantineId: string; error: string }>;
}

/**
 * Import approved quarantined rows by their IDs
 */
export async function importApprovedQuarantineRows(
  agencyId: string,
  userId: string,
  quarantineIds: string[],
  type: 'customers' | 'loans' | 'mixed'
): Promise<ImportQuarantineResult> {
  const result: ImportQuarantineResult = {
    success: 0,
    failed: 0,
    errors: [],
  };

  // Fetch individual quarantined rows by ID
  const rowsToImport = await Promise.all(
    quarantineIds.map(async (id) => {
      try {
        const quarantineRef = doc(db, 'agencies', agencyId, 'import_quarantine', id);
        const snapshot = await getDoc(quarantineRef);
        if (snapshot.exists()) {
          return {
            id: snapshot.id,
            ...snapshot.data(),
            createdAt: snapshot.data().createdAt?.toDate?.() || new Date(),
            updatedAt: snapshot.data().updatedAt?.toDate?.() || new Date(),
          };
        }
        return null;
      } catch (error) {
        console.error(`Failed to fetch quarantine row ${id}:`, error);
        return null;
      }
    })
  );
  
  const validRows = rowsToImport.filter((row): row is any => 
    row !== null && (row.status === 'approved' || row.status === 'fixed')
  );

  if (validRows.length === 0) {
    return result;
  }

  // Convert quarantined rows to ImportRow format
  const importRows: ImportRow[] = validRows.map((row: any) => {
    const cleaned = row.cleanedData || row.fixedData || {};
    const validation = validateNormalizedData(cleaned, ['fullName', 'phone']);
    
    return {
      rowIndex: row.rowIndex,
      data: {
        ...row.originalData,
        // Use cleaned/fixed data
        phone: cleaned.phone || row.originalData.phone,
        email: cleaned.email || row.originalData.email,
        fullName: cleaned.fullName || row.originalData.fullName,
        nrc: cleaned.nrc || row.originalData.nrc,
        address: cleaned.address || row.originalData.address,
        _fromQuarantine: true,
        _quarantineId: row.id,
      },
      status: validation.isValid ? 'ready' : 'needs_review',
      action: 'create',
      errors: validation.isValid ? [] : [`Missing: ${validation.missingFields.join(', ')}`],
    };
  });

  if (importRows.length === 0) {
    return result;
  }

  // Execute import
  try {
    const importResult = await executeBulkImport(
      agencyId,
      userId,
      importRows,
      type,
      'quarantine-import',
      0,
      false
    );

    result.success = importResult.success;
    result.failed = importResult.failed;

    // Remove successfully imported rows from quarantine
    for (const row of validRows) {
      if (row && importResult.success > 0) {
        try {
          await removeFromQuarantine(agencyId, row.id);
        } catch (error) {
          console.warn(`Failed to remove quarantine row ${row.id}:`, error);
        }
      }
    }
  } catch (error: any) {
    result.failed = importRows.length;
    result.errors.push({
      quarantineId: 'batch',
      error: error.message || 'Failed to import approved rows',
    });
  }

  return result;
}
