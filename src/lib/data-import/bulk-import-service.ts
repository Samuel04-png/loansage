/**
 * Bulk Import Service
 * Handles transactional bulk imports with Firebase as the source of truth
 * All ID generation and data persistence happens here
 */

import { 
  writeBatch, 
  doc, 
  collection, 
  serverTimestamp, 
  runTransaction,
  getDoc,
  query,
  where,
  getDocs,
  increment,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { createLoanTransaction } from '../firebase/loan-transactions';
import { createCustomer } from '../firebase/firestore-helpers';

export interface ImportRow {
  rowIndex: number;
  data: any;
  status: 'ready' | 'needs_review' | 'invalid';
  errors: string[];
  customerId?: string; // For linking loans
  action: 'create' | 'link' | 'skip';
}

export interface BulkImportResult {
  batchId: string;
  success: number;
  failed: number;
  skipped: number;
  created: {
    customers: number;
    loans: number;
  };
  linked: {
    customers: number;
    loans: number;
  };
  errors: Array<{
    rowIndex: number;
    error: string;
  }>;
  auditLog: {
    userId: string;
    timestamp: Date;
    fileSize: number;
    fileName: string;
  };
}

/**
 * Execute bulk import with Firebase transactions
 * Firebase is the source of truth for all IDs and relationships
 */
export async function executeBulkImport(
  agencyId: string,
  userId: string,
  rows: ImportRow[],
  type: 'customers' | 'loans' | 'mixed',
  fileName: string,
  fileSize: number,
  dryRun: boolean = false
): Promise<BulkImportResult> {
  const batchId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const result: BulkImportResult = {
    batchId,
    success: 0,
    failed: 0,
    skipped: 0,
    created: { customers: 0, loans: 0 },
    linked: { customers: 0, loans: 0 },
    errors: [],
    auditLog: {
      userId,
      timestamp: new Date(),
      fileSize,
      fileName,
    },
  };

  console.log('executeBulkImport called:', {
    agencyId,
    userId,
    rowCount: rows.length,
    type,
    dryRun,
    fileName
  });

  // Helper function to check if a row has loan data (check both mapped and original data)
  const hasLoanData = (row: ImportRow): boolean => {
    const originalRow = row.data._originalRow || {};
    return !!(
      row.data.amount || row.data.interestRate || row.data.durationMonths || row.data.loanType ||
      originalRow['Amount'] || originalRow['amount'] || originalRow['Loan Amount'] ||
      originalRow['Interest Rate'] || originalRow['interestRate'] || originalRow['Rate'] ||
      originalRow['Duration'] || originalRow['duration'] || originalRow['Months'] ||
      originalRow['Loan Type'] || originalRow['loanType']
    );
  };

  // Helper function to check if a row has customer data (check both mapped and original data)
  const hasCustomerData = (row: ImportRow): boolean => {
    const originalRow = row.data._originalRow || {};
    return !!(
      row.data.fullName || row.data.phone || row.data.nrc || row.data.email ||
      originalRow['Full Name'] || originalRow['fullName'] || originalRow['Name'] || originalRow['name'] ||
      originalRow['Customer Name'] || originalRow['Phone'] || originalRow['phone'] ||
      originalRow['Phone Number'] || originalRow['Mobile'] || originalRow['NRC'] || originalRow['nrc'] ||
      originalRow['NRC/ID'] || originalRow['ID Number'] || originalRow['ID'] || originalRow['Email']
    );
  };

  if (dryRun) {
    console.log('Running in DRY RUN mode - no data will be saved');
    // Simulate import without writing
    rows.forEach(row => {
      if (row.action !== 'skip') {
        result.success++;
        if (row.action === 'create') {
          if (type === 'customers' || type === 'mixed') {
            if (hasCustomerData(row)) result.created.customers++;
          }
          if (type === 'loans' || type === 'mixed') {
            if (hasLoanData(row)) result.created.loans++;
          }
        } else if (row.action === 'link') {
          if (type === 'customers' || type === 'mixed') {
            result.linked.customers++;
          }
          if (type === 'loans' || type === 'mixed') {
            result.linked.loans++;
          }
        }
      } else {
        result.skipped++;
      }
    });
    console.log('Dry run result:', result);
    return result;
  }

  console.log('Running LIVE import - data will be saved to Firestore');

  console.log('Row filtering - Total rows:', rows.length);
  console.log('Row statuses:', rows.map(r => ({ idx: r.rowIndex, status: r.status, action: r.action })));

  // Group rows by type for batch processing
  // Process rows that aren't explicitly set to skip, even if status is not 'ready'
  // This allows processing rows with warnings
  const customerRows = rows.filter(r => {
    if (r.action === 'skip') {
      console.log(`Skipping row ${r.rowIndex} - action is skip`);
      return false;
    }
    if (type === 'customers') {
      console.log(`Including row ${r.rowIndex} as customer row (type: customers)`);
      return true;
    }
    if (type === 'mixed') {
      // In mixed imports, customer-only rows have customer data but no loan data
      const hasCustomer = hasCustomerData(r);
      const hasLoan = hasLoanData(r);
      const isCustomerRow = hasCustomer && !hasLoan;
      if (isCustomerRow) {
        console.log(`Including row ${r.rowIndex} as customer row (mixed type, has customer data, no loan data)`);
      }
      return isCustomerRow;
    }
    return false;
  });

  const loanRows = rows.filter(r => {
    if (r.action === 'skip') {
      console.log(`Skipping row ${r.rowIndex} - action is skip`);
      return false;
    }
    if (type === 'loans') {
      // For loans type, all rows are loan rows (customer should be identified by ID or search)
      console.log(`Including row ${r.rowIndex} as loan row (type: loans)`);
      return true;
    }
    if (type === 'mixed') {
      // In mixed imports, loan rows have loan data (may also have customer data)
      const hasLoan = hasLoanData(r);
      if (hasLoan) {
        console.log(`Including row ${r.rowIndex} as loan row (mixed type, has loan data)`);
      }
      return hasLoan;
    }
    return false;
  });

  console.log(`Filtered ${customerRows.length} customer rows and ${loanRows.length} loan rows`);

  // Process customers first (loans depend on customers)
  console.log(`Processing ${customerRows.length} customer rows`);
  for (const row of customerRows) {
    try {
      if (row.action === 'link' && row.customerId) {
        // Just link, don't create
        result.linked.customers++;
        result.success++;
        continue;
      }

      if (row.action === 'create') {
        // Get original row data if available (fallback to mapped data)
        const originalRow = row.data._originalRow || {};
        
        // Helper function to extract value from either mapped data or original row
        const getValue = (mappedKey: string, originalKeys: string[]): string => {
          // First try mapped data
          if (row.data[mappedKey] && String(row.data[mappedKey]).trim().length > 0) {
            return String(row.data[mappedKey]).trim();
          }
          // Then try original row with various possible column names
          for (const key of originalKeys) {
            if (originalRow[key] && String(originalRow[key]).trim().length > 0) {
              return String(originalRow[key]).trim();
            }
          }
          return '';
        };
        
        // Extract customer data from row (check both mapped fields and original row)
        const customerData = {
          fullName: getValue('fullName', ['Full Name', 'fullName', 'Name', 'name', 'Customer Name', 'Customer Name']),
          phone: getValue('phone', ['Phone', 'phone', 'Phone Number', 'Mobile', 'mobile', 'MSISDN', 'Tel']),
          email: getValue('email', ['Email', 'email', 'Email Address']) || undefined,
          nrc: getValue('nrc', ['NRC/ID', 'NRC', 'nrc', 'ID Number', 'ID', 'id', 'National ID', 'National ID Number']),
          address: getValue('address', ['Address', 'address', 'Location', 'location']) || undefined,
          employmentStatus: row.data.employmentStatus || originalRow['Employment Status'] || originalRow['employmentStatus'] || undefined,
          monthlyIncome: row.data.monthlyIncome ? parseFloat(String(row.data.monthlyIncome)) : 
                       (originalRow['Monthly Income'] || originalRow['monthlyIncome'] || originalRow['Income']) ? 
                       parseFloat(String(originalRow['Monthly Income'] || originalRow['monthlyIncome'] || originalRow['Income'])) : undefined,
          employer: row.data.employer || originalRow['Employer'] || originalRow['employer'] || originalRow['Company'] || undefined,
          jobTitle: row.data.jobTitle || originalRow['Job Title'] || originalRow['jobTitle'] || originalRow['Position'] || undefined,
        };

        console.log(`Creating customer for row ${row.rowIndex}:`, customerData);

        // Validate required fields
        if (!customerData.fullName || !customerData.phone || !customerData.nrc) {
          throw new Error(`Missing required fields: fullName="${customerData.fullName}", phone="${customerData.phone}", nrc="${customerData.nrc}"`);
        }

        // Create new customer
        const customerId = await createCustomerInTransaction(
          agencyId,
          userId,
          customerData
        );
        
        console.log(`Created customer ${customerId} for row ${row.rowIndex}`);
        result.created.customers++;
        result.success++;
        
        // Update row with created customer ID for loan linking
        row.customerId = customerId;
      }
    } catch (error: any) {
      console.error(`Failed to process customer row ${row.rowIndex}:`, error);
      result.failed++;
      result.errors.push({
        rowIndex: row.rowIndex,
        error: error.message || 'Failed to create customer',
      });
    }
  }

  // Process loans (after customers are created)
  console.log(`Processing ${loanRows.length} loan rows`);
  for (const row of loanRows) {
    try {
      let customerId = row.customerId || row.data.customerId;

      if (row.action === 'link') {
        // For link action, customerId must already be set from match suggestion
        if (!customerId) {
          throw new Error('Customer ID is required for linking. Please ensure customer exists or use create action.');
        }
        // Link to existing loan (if applicable)
        result.linked.loans++;
        result.success++;
        continue;
      }

      // For create action: if no customerId is set, create customer from row data
      if (!customerId && row.action === 'create' && (type === 'mixed' || type === 'loans') && hasCustomerData(row)) {
        try {
          // Get original row data if available (fallback to mapped data)
          const originalRow = row.data._originalRow || {};
          
          // Helper function to extract value from either mapped data or original row
          const getValue = (mappedKey: string, originalKeys: string[]): string => {
            // First try mapped data
            if (row.data[mappedKey]) return String(row.data[mappedKey]).trim();
            // Then try original row with various possible column names
            for (const key of originalKeys) {
              if (originalRow[key]) return String(originalRow[key]).trim();
            }
            return '';
          };
          
          // Extract customer data from row (check both mapped fields and original row)
          const customerData = {
            fullName: getValue('fullName', ['Full Name', 'fullName', 'Name', 'name', 'Customer Name', 'Customer Name']),
            phone: getValue('phone', ['Phone', 'phone', 'Phone Number', 'Mobile', 'mobile', 'MSISDN']),
            email: getValue('email', ['Email', 'email', 'Email Address']),
            nrc: getValue('nrc', ['NRC/ID', 'NRC', 'nrc', 'ID Number', 'ID', 'id', 'National ID']),
            address: getValue('address', ['Address', 'address', 'Location', 'location']) || undefined,
            employmentStatus: row.data.employmentStatus || originalRow['Employment Status'] || originalRow['employmentStatus'] || undefined,
            monthlyIncome: row.data.monthlyIncome ? parseFloat(String(row.data.monthlyIncome)) : 
                         (originalRow['Monthly Income'] || originalRow['monthlyIncome'] || originalRow['Income']) ? 
                         parseFloat(String(originalRow['Monthly Income'] || originalRow['monthlyIncome'] || originalRow['Income'])) : undefined,
            employer: row.data.employer || originalRow['Employer'] || originalRow['employer'] || originalRow['Company'] || undefined,
            jobTitle: row.data.jobTitle || originalRow['Job Title'] || originalRow['jobTitle'] || originalRow['Position'] || undefined,
          };

          // Validate required customer fields
          if (!customerData.fullName || !customerData.phone || !customerData.nrc) {
            throw new Error('Customer data incomplete: fullName, phone, and nrc are required');
          }

          // Create customer
          customerId = await createCustomerInTransaction(
            agencyId,
            userId,
            customerData
          );
          
          result.created.customers++;
          row.customerId = customerId;
        } catch (error: any) {
          throw new Error(`Failed to create customer: ${error.message}`);
        }
      }

      if (!customerId) {
        throw new Error('Customer ID is required for loan. Please ensure customer data is provided or customer exists.');
      }

      if (row.action === 'create') {
        // Extract loan data with fallback to original row
        const originalRow = row.data._originalRow || {};
        const amount = parseFloat(String(row.data.amount || originalRow['Amount'] || originalRow['amount'] || originalRow['Loan Amount'] || 0));
        const interestRate = parseFloat(String(row.data.interestRate || originalRow['Interest Rate'] || originalRow['interestRate'] || originalRow['Rate'] || 15));
        const durationMonths = parseInt(String(row.data.durationMonths || originalRow['Duration (Months)'] || originalRow['durationMonths'] || originalRow['Duration'] || originalRow['Months'] || 12));
        const loanType = String(row.data.loanType || originalRow['Loan Type'] || originalRow['loanType'] || originalRow['Type'] || 'Personal Loan');

        console.log(`Creating loan for row ${row.rowIndex}:`, {
          customerId,
          amount,
          interestRate,
          durationMonths,
          loanType
        });

        // Create new loan
        const loanResult = await createLoanTransaction({
          agencyId,
          customerId: customerId,
          officerId: userId,
          amount,
          interestRate,
          durationMonths,
          loanType,
          disbursementDate: row.data.disbursementDate ? new Date(row.data.disbursementDate) : undefined,
          collateralIncluded: Boolean(row.data.collateralIncluded || originalRow['Collateral'] === 'Yes'),
        });

        if (loanResult.success) {
          console.log(`Created loan ${loanResult.loanId} for row ${row.rowIndex}`);
          
          // Update customer stats after loan creation
          // Note: Loans created via bulk import start as 'draft' status
          // We increment totalLoans and totalBorrowed immediately
          // activeLoans will be updated when loan status changes to 'active' or 'approved'
          try {
            const customerRef = doc(db, 'agencies', agencyId, 'customers', customerId);
            
            // Use Firestore increment to update customer stats atomically
            // This handles both initialization (if stats don't exist) and increment (if they do)
            const statsUpdate: any = {
              totalLoans: increment(1),
              totalBorrowed: increment(amount),
              updatedAt: serverTimestamp(),
            };
            
            // Note: Loans created via createLoanTransaction start as 'draft' status
            // We only increment totalLoans and totalBorrowed here
            // activeLoans will be updated when loan status changes to 'active' or 'approved'
            // Use the "Sync Customer Stats" button in Data Management to recalculate if needed
            
            await updateDoc(customerRef, statsUpdate);
            console.log(`Updated customer stats for customer ${customerId}: totalLoans +1, totalBorrowed +${amount}`);
          } catch (statsError: any) {
            // Don't fail the import if stats update fails - log and continue
            console.warn(`Failed to update customer stats for customer ${customerId}:`, statsError);
          }
          
          result.created.loans++;
          result.success++;
        } else {
          throw new Error(loanResult.error || 'Failed to create loan');
        }
      }
    } catch (error: any) {
      result.failed++;
      result.errors.push({
        rowIndex: row.rowIndex,
        error: error.message || 'Failed to create loan',
      });
    }
  }

  // Count skipped rows
  result.skipped = rows.filter(r => r.action === 'skip').length;

  // Final summary
  console.log('Import completed:', {
    batchId,
    totalRows: rows.length,
    success: result.success,
    failed: result.failed,
    skipped: result.skipped,
    created: result.created,
    linked: result.linked,
    errors: result.errors.length
  });

  if (result.errors.length > 0) {
    console.warn('Import errors:', result.errors);
  }

  // Create audit log
  try {
    await createImportAuditLog(agencyId, batchId, result, userId);
    console.log('Import audit log created');
  } catch (error) {
    console.error('Failed to create audit log (non-fatal):', error);
    // Don't throw - audit log failure shouldn't break import
  }

  return result;
}

/**
 * Create customer in Firestore transaction
 * Firebase generates the ID
 */
async function createCustomerInTransaction(
  agencyId: string,
  createdBy: string,
  data: any
): Promise<string> {
  return await runTransaction(db, async (transaction) => {
    // Generate customer ID (Firebase will use this)
    const customersRef = collection(db, 'agencies', agencyId, 'customers');
    const customerRef = doc(customersRef);
    const customerId = customerRef.id;

    // Prepare customer data
    // IMPORTANT: Include status: 'active' and agencyId for proper filtering in Customers table
    const customerData = {
      fullName: String(data.fullName || '').trim(),
      phone: String(data.phone || '').trim(),
      email: String(data.email || '').trim() || null,
      nrc: String(data.nrc || '').trim(),
      address: String(data.address || '').trim() || null,
      employmentStatus: data.employmentStatus || null,
      monthlyIncome: data.monthlyIncome ? parseFloat(String(data.monthlyIncome)) : null,
      employer: data.employer || null,
      jobTitle: data.jobTitle || null,
      createdBy,
      agencyId: agencyId, // Required for queries that filter by agencyId
      status: 'active', // Required: Customers table filters by status != 'archived'
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      loanIds: [],
      // Initialize stats for proper display
      totalLoans: 0,
      activeLoans: 0,
      totalBorrowed: 0,
    };

    // Check for duplicates (by phone or NRC)
    const phoneQuery = query(customersRef, where('phone', '==', customerData.phone));
    const phoneSnapshot = await getDocs(phoneQuery);
    if (!phoneSnapshot.empty) {
      throw new Error(`Customer with phone ${customerData.phone} already exists`);
    }

    const nrcQuery = query(customersRef, where('nrc', '==', customerData.nrc));
    const nrcSnapshot = await getDocs(nrcQuery);
    if (!nrcSnapshot.empty) {
      throw new Error(`Customer with NRC ${customerData.nrc} already exists`);
    }

    // Create customer
    transaction.set(customerRef, customerData);

    return customerId;
  });
}

/**
 * Create audit log for import
 */
async function createImportAuditLog(
  agencyId: string,
  batchId: string,
  result: BulkImportResult,
  userId: string
): Promise<void> {
  try {
    const auditLogRef = doc(db, 'agencies', agencyId, 'import_logs', batchId);
    const batch = writeBatch(db);
    batch.set(auditLogRef, {
      id: batchId,
      userId,
      fileName: result.auditLog.fileName,
      fileSize: result.auditLog.fileSize,
      timestamp: serverTimestamp(),
      result: {
        success: result.success,
        failed: result.failed,
        skipped: result.skipped,
        created: result.created,
        linked: result.linked,
      },
      errors: result.errors,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    console.error('Failed to create import audit log:', error);
    // Don't throw - audit log failure shouldn't break import
  }
}

/**
 * Get import history
 */
export async function getImportHistory(
  agencyId: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const importLogsRef = collection(db, 'agencies', agencyId, 'import_logs');
    const { query: firestoreQuery, orderBy, limit: limitFn } = await import('firebase/firestore');
    const q = firestoreQuery(importLogsRef, orderBy('timestamp', 'desc'), limitFn(limit));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Failed to fetch import history:', error);
    return [];
  }
}

