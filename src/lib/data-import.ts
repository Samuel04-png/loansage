/**
 * Data Import Utilities
 * Import data from CSV/Excel files
 */

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

/**
 * Parse CSV file
 */
function parseCSV(csvText: string): { headers: string[]; rows: any[] } {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
  
  return { headers, rows };
}

/**
 * Import customers from CSV file
 */
export async function importCustomersFromCSV(
  file: File,
  agencyId: string,
  createdBy: string,
  createCustomerFn: (agencyId: string, data: any) => Promise<any>
): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvText = e.target?.result as string;
      const { rows } = parseCSV(csvText);
      
      let success = 0;
      let failed = 0;
      const errors: string[] = [];
      
      for (const row of rows) {
        try {
          // Map CSV columns to customer data
          const customerData = {
            fullName: row['Full Name'] || row['fullName'] || row['Name'] || '',
            email: row['Email'] || row['email'] || '',
            phone: row['Phone'] || row['phone'] || '',
            nrc: row['NRC/ID'] || row['NRC'] || row['nrc'] || row['ID Number'] || '',
            address: row['Address'] || row['address'] || '',
            employer: row['Employer'] || row['employer'] || '',
            createdBy,
          };
          
          // Validate required fields
          if (!customerData.fullName || !customerData.phone || !customerData.nrc) {
            failed++;
            errors.push(`Row ${success + failed}: Missing required fields (Name, Phone, or NRC)`);
            continue;
          }
          
          await createCustomerFn(agencyId, customerData);
          success++;
        } catch (error: any) {
          failed++;
          errors.push(`Row ${success + failed}: ${error.message || 'Unknown error'}`);
        }
      }
      
      resolve({ success, failed, errors });
    };
    
    reader.onerror = () => {
      resolve({ success: 0, failed: 0, errors: ['Failed to read file'] });
    };
    
    reader.readAsText(file);
  });
}

/**
 * Import loans from CSV file
 */
export async function importLoansFromCSV(
  file: File,
  agencyId: string,
  officerId: string,
  createLoanFn: (agencyId: string, data: any) => Promise<any>,
  getCustomerIdFn: (agencyId: string, identifier: string) => Promise<string | null>
): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvText = e.target?.result as string;
      const { rows } = parseCSV(csvText);
      
      let success = 0;
      let failed = 0;
      const errors: string[] = [];
      
      for (const row of rows) {
        try {
          // Find customer by name or ID
          const customerIdentifier = row['Customer Name'] || row['Customer ID'] || row['customerName'] || row['customerId'] || '';
          if (!customerIdentifier) {
            failed++;
            errors.push(`Row ${success + failed}: Customer identifier required`);
            continue;
          }
          
          const customerId = await getCustomerIdFn(agencyId, customerIdentifier);
          if (!customerId) {
            failed++;
            errors.push(`Row ${success + failed}: Customer not found: ${customerIdentifier}`);
            continue;
          }
          
          const loanData = {
            customerId,
            officerId,
            amount: parseFloat(row['Amount'] || row['amount'] || '0'),
            interestRate: parseFloat(row['Interest Rate'] || row['interestRate'] || '0'),
            durationMonths: parseInt(row['Duration (Months)'] || row['durationMonths'] || '0'),
            loanType: row['Loan Type'] || row['loanType'] || 'Personal Loan',
            disbursementDate: row['Disbursement Date'] ? new Date(row['Disbursement Date']) : new Date(),
          };
          
          if (!loanData.amount || !loanData.interestRate || !loanData.durationMonths) {
            failed++;
            errors.push(`Row ${success + failed}: Missing required loan fields`);
            continue;
          }
          
          await createLoanFn(agencyId, loanData);
          success++;
        } catch (error: any) {
          failed++;
          errors.push(`Row ${success + failed}: ${error.message || 'Unknown error'}`);
        }
      }
      
      resolve({ success, failed, errors });
    };
    
    reader.onerror = () => {
      resolve({ success: 0, failed: 0, errors: ['Failed to read file'] });
    };
    
    reader.readAsText(file);
  });
}

/**
 * Import employees from CSV file
 * If employee file contains collateral data, it will extract and create collateral records
 */
export async function importEmployeesFromCSV(
  file: File,
  agencyId: string,
  createdBy: string,
  createEmployeeFn: (agencyId: string, data: any) => Promise<any>,
  addCollateralFn?: (agencyId: string, loanId: string, data: any) => Promise<any>
): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvText = e.target?.result as string;
      const { rows } = parseCSV(csvText);
      
      let success = 0;
      let failed = 0;
      const errors: string[] = [];
      const collateralToCreate: any[] = [];
      
      for (const row of rows) {
        try {
          // Map CSV columns to employee data
          const employeeData = {
            userId: row['User ID'] || row['userId'] || '',
            email: row['Email'] || row['email'] || '',
            name: row['Name'] || row['name'] || row['Full Name'] || '',
            role: (row['Role'] || row['role'] || 'loan_officer') as any,
          };
          
          // Validate required fields
          if (!employeeData.email || !employeeData.name) {
            failed++;
            errors.push(`Row ${success + failed}: Missing required fields (Email or Name)`);
            continue;
          }
          
          // Create employee if function provided
          if (createEmployeeFn) {
            await createEmployeeFn(agencyId, employeeData);
          }
          
          // Check for collateral data in employee row
          if (row['Collateral Type'] || row['collateralType']) {
            const collateralData = {
              type: (row['Collateral Type'] || row['collateralType'] || 'other') as any,
              description: row['Collateral Description'] || row['collateralDescription'] || '',
              estimatedValue: parseFloat(row['Collateral Value'] || row['collateralValue'] || '0'),
              photos: row['Collateral Photos'] ? row['Collateral Photos'].split(',').map((p: string) => p.trim()) : [],
            };
            
            // Store collateral to create later (needs loanId)
            if (row['Loan ID'] || row['loanId']) {
              collateralToCreate.push({
                loanId: row['Loan ID'] || row['loanId'],
                ...collateralData,
              });
            }
          }
          
          success++;
        } catch (error: any) {
          failed++;
          errors.push(`Row ${success + failed}: ${error.message || 'Unknown error'}`);
        }
      }
      
      // Create collateral records if function provided
      if (addCollateralFn && collateralToCreate.length > 0) {
        for (const collateral of collateralToCreate) {
          try {
            await addCollateralFn(agencyId, collateral.loanId, {
              type: collateral.type,
              description: collateral.description,
              estimatedValue: collateral.estimatedValue,
              photos: collateral.photos,
            });
          } catch (error: any) {
            errors.push(`Collateral creation failed for loan ${collateral.loanId}: ${error.message}`);
          }
        }
      }
      
      resolve({ success, failed, errors });
    };
    
    reader.onerror = () => {
      resolve({ success: 0, failed: 0, errors: ['Failed to read file'] });
    };
    
    reader.readAsText(file);
  });
}

/**
 * Helper to find customer by name or ID
 */
export async function findCustomerByIdentifier(
  agencyId: string,
  identifier: string
): Promise<string | null> {
  try {
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const { db } = await import('./firebase/config');
    
    const customersRef = collection(db, 'agencies', agencyId, 'customers');
    
    // Try to find by ID first
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const customerRef = doc(db, 'agencies', agencyId, 'customers', identifier);
      const customerDoc = await getDoc(customerRef);
      if (customerDoc.exists()) {
        return customerDoc.id;
      }
    } catch (error) {
      // Not found by ID, continue to search by name
    }
    
    // Search by full name
    const nameQuery = query(customersRef, where('fullName', '==', identifier));
    const nameSnapshot = await getDocs(nameQuery);
    
    if (!nameSnapshot.empty) {
      return nameSnapshot.docs[0].id;
    }
    
    // Search by phone
    const phoneQuery = query(customersRef, where('phone', '==', identifier));
    const phoneSnapshot = await getDocs(phoneQuery);
    
    if (!phoneSnapshot.empty) {
      return phoneSnapshot.docs[0].id;
    }
    
    return null;
  } catch (error) {
    console.error('Error finding customer:', error);
    return null;
  }
}

