/**
 * Data Import Utilities
 * Import data from CSV/Excel files and create Firestore collections
 */

import * as XLSX from 'xlsx';

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

/**
 * Parse CSV file with proper handling of quoted fields and commas
 */
function parseCSV(csvText: string): { headers: string[]; rows: any[] } {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  // Improved CSV parsing that handles quoted fields
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    result.push(current.trim());
    return result;
  };
  
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line);
    const row: any = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.trim().replace(/^"|"$/g, '');
      row[cleanHeader] = values[index]?.trim().replace(/^"|"$/g, '') || '';
    });
    return row;
  });
  
  return { headers, rows };
}

/**
 * Parse Excel file (.xlsx, .xls)
 */
function parseExcel(file: File): Promise<{ headers: string[]; rows: any[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        if (jsonData.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }
        
        // First row is headers
        const headers = (jsonData[0] as any[]).map((h: any) => String(h || '').trim());
        
        // Rest are rows
        const rows = jsonData.slice(1).map((row: any[]) => {
          const rowObj: any = {};
          headers.forEach((header, index) => {
            rowObj[header] = row[index] ? String(row[index]).trim() : '';
          });
          return rowObj;
        }).filter((row: any) => {
          // Filter out completely empty rows
          return Object.values(row).some(val => val !== '');
        });
        
        resolve({ headers, rows });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read Excel file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Detect file type and parse accordingly
 */
export async function parseFile(file: File): Promise<{ headers: string[]; rows: any[] }> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return await parseExcel(file);
  } else if (fileName.endsWith('.csv')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvText = e.target?.result as string;
        resolve(parseCSV(csvText));
      };
      reader.onerror = () => reject(new Error('Failed to read CSV file'));
      reader.readAsText(file);
    });
  } else {
    throw new Error('Unsupported file format. Please use CSV or Excel (.xlsx, .xls)');
  }
}

/**
 * Import customers from CSV/Excel file
 * Creates customer documents in Firestore
 */
export async function importCustomersFromCSV(
  file: File,
  agencyId: string,
  createdBy: string,
  createCustomerFn: (agencyId: string, data: any) => Promise<any>
): Promise<ImportResult> {
  try {
    const { rows } = await parseFile(file);
    
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because row 1 is header, and arrays are 0-indexed
      
      try {
        // Map CSV/Excel columns to customer data (support multiple column name variations)
        const customerData = {
          fullName: row['Full Name'] || row['fullName'] || row['Name'] || row['name'] || row['Customer Name'] || '',
          email: row['Email'] || row['email'] || row['Email Address'] || '',
          phone: row['Phone'] || row['phone'] || row['Phone Number'] || row['Mobile'] || row['mobile'] || '',
          nrc: row['NRC/ID'] || row['NRC'] || row['nrc'] || row['ID Number'] || row['ID'] || row['id'] || row['National ID'] || '',
          address: row['Address'] || row['address'] || row['Location'] || row['location'] || '',
          employer: row['Employer'] || row['employer'] || row['Company'] || row['company'] || '',
          employmentStatus: row['Employment Status'] || row['employmentStatus'] || row['Status'] || undefined,
          monthlyIncome: row['Monthly Income'] || row['monthlyIncome'] || row['Income'] ? parseFloat(String(row['Monthly Income'] || row['monthlyIncome'] || row['Income'] || '0')) : undefined,
          jobTitle: row['Job Title'] || row['jobTitle'] || row['Position'] || '',
          createdBy,
        };
        
        // Validate required fields
        if (!customerData.fullName || !customerData.phone || !customerData.nrc) {
          failed++;
          errors.push(`Row ${rowNumber}: Missing required fields (Name: "${customerData.fullName}", Phone: "${customerData.phone}", NRC: "${customerData.nrc}")`);
          continue;
        }
        
        // Create customer in Firestore
        await createCustomerFn(agencyId, customerData);
        success++;
      } catch (error: any) {
        failed++;
        errors.push(`Row ${rowNumber}: ${error.message || 'Unknown error'}`);
        console.error(`Error importing customer row ${rowNumber}:`, error);
      }
    }
    
    return { success, failed, errors };
  } catch (error: any) {
    return { 
      success: 0, 
      failed: 0, 
      errors: [`Failed to parse file: ${error.message || 'Unknown error'}`] 
    };
  }
}

/**
 * Import loans from CSV/Excel file
 * Creates loan documents in Firestore with repayments
 */
export async function importLoansFromCSV(
  file: File,
  agencyId: string,
  officerId: string,
  createLoanFn: (agencyId: string, data: any) => Promise<any>,
  getCustomerIdFn: (agencyId: string, identifier: string) => Promise<string | null>
): Promise<ImportResult> {
  try {
    const { rows } = await parseFile(file);
    
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because row 1 is header, and arrays are 0-indexed
      
      try {
        // Find customer by name, ID, phone, or NRC
        const customerIdentifier = 
          row['Customer Name'] || row['customerName'] || 
          row['Customer ID'] || row['customerId'] || 
          row['Customer Phone'] || row['customerPhone'] ||
          row['Customer NRC'] || row['customerNRC'] ||
          row['NRC'] || row['nrc'] ||
          '';
        
        if (!customerIdentifier) {
          failed++;
          errors.push(`Row ${rowNumber}: Customer identifier required (Customer Name, Customer ID, Phone, or NRC)`);
          continue;
        }
        
        const customerId = await getCustomerIdFn(agencyId, customerIdentifier);
        if (!customerId) {
          failed++;
          errors.push(`Row ${rowNumber}: Customer not found: "${customerIdentifier}"`);
          continue;
        }
        
        // Parse loan data
        const amount = parseFloat(String(row['Amount'] || row['amount'] || row['Loan Amount'] || row['Principal'] || '0'));
        const interestRate = parseFloat(String(row['Interest Rate'] || row['interestRate'] || row['Interest'] || row['Rate'] || '0'));
        const durationMonths = parseInt(String(row['Duration (Months)'] || row['durationMonths'] || row['Duration'] || row['Months'] || '0'));
        
        // Parse dates
        let disbursementDate: Date | undefined;
        if (row['Disbursement Date'] || row['disbursementDate'] || row['Start Date'] || row['startDate']) {
          const dateStr = String(row['Disbursement Date'] || row['disbursementDate'] || row['Start Date'] || row['startDate']);
          disbursementDate = new Date(dateStr);
          if (isNaN(disbursementDate.getTime())) {
            disbursementDate = undefined;
          }
        }
        
        const loanData = {
          customerId,
          officerId,
          amount,
          interestRate,
          durationMonths,
          loanType: row['Loan Type'] || row['loanType'] || row['Type'] || 'Personal Loan',
          disbursementDate: disbursementDate || new Date(),
          collateralIncluded: row['Collateral'] === 'Yes' || row['collateral'] === 'yes' || row['Has Collateral'] === 'Yes' || false,
        };
        
        // Validate required fields
        if (!loanData.amount || loanData.amount <= 0) {
          failed++;
          errors.push(`Row ${rowNumber}: Invalid or missing loan amount`);
          continue;
        }
        
        if (!loanData.interestRate || loanData.interestRate < 0) {
          failed++;
          errors.push(`Row ${rowNumber}: Invalid or missing interest rate`);
          continue;
        }
        
        if (!loanData.durationMonths || loanData.durationMonths <= 0) {
          failed++;
          errors.push(`Row ${rowNumber}: Invalid or missing duration (must be > 0 months)`);
          continue;
        }
        
        // Create loan in Firestore (this will also create repayments)
        await createLoanFn(agencyId, loanData);
        success++;
      } catch (error: any) {
        failed++;
        errors.push(`Row ${rowNumber}: ${error.message || 'Unknown error'}`);
        console.error(`Error importing loan row ${rowNumber}:`, error);
      }
    }
    
    return { success, failed, errors };
  } catch (error: any) {
    return { 
      success: 0, 
      failed: 0, 
      errors: [`Failed to parse file: ${error.message || 'Unknown error'}`] 
    };
  }
}

/**
 * Helper to find customer by name, ID, phone, or NRC
 */
export async function findCustomerByIdentifier(
  agencyId: string,
  identifier: string
): Promise<string | null> {
  try {
    const { collection, getDocs, query, where, doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase/config');
    
    const customersRef = collection(db, 'agencies', agencyId, 'customers');
    
    // Try to find by ID first
    try {
      const customerRef = doc(db, 'agencies', agencyId, 'customers', identifier);
      const customerDoc = await getDoc(customerRef);
      if (customerDoc.exists()) {
        return customerDoc.id;
      }
    } catch (error) {
      // Not found by ID, continue to search by other fields
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
    
    // Search by NRC
    const nrcQuery = query(customersRef, where('nrc', '==', identifier));
    const nrcSnapshot = await getDocs(nrcQuery);
    if (!nrcSnapshot.empty) {
      return nrcSnapshot.docs[0].id;
    }
    
    // Search by email
    const emailQuery = query(customersRef, where('email', '==', identifier));
    const emailSnapshot = await getDocs(emailQuery);
    if (!emailSnapshot.empty) {
      return emailSnapshot.docs[0].id;
    }
    
    return null;
  } catch (error) {
    console.error('Error finding customer:', error);
    return null;
  }
}
