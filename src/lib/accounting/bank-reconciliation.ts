/**
 * Bank Reconciliation Utilities
 * Handles CSV/Excel parsing and matching payments with repayments
 */

import * as XLSX from 'xlsx';

export interface BankTransaction {
  date: string;
  description: string;
  amount: number;
  reference?: string;
  account?: string;
}

export interface ReconciliationMatch {
  bankTransaction: BankTransaction;
  repayment?: any;
  matchConfidence: 'high' | 'medium' | 'low';
  matchReason: string;
}

/**
 * Parse CSV with proper handling of quoted fields and commas
 */
function parseCSVLine(line: string): string[] {
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
}

/**
 * Parse bank statement CSV
 * Supports common formats: date, description, amount, reference
 * Handles quoted fields and commas in values
 */
export function parseBankStatementCSV(csvText: string): BankTransaction[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const transactions: BankTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 3) continue;

    const transaction: BankTransaction = {
      date: '',
      description: '',
      amount: 0,
    };

    headers.forEach((header, index) => {
      const value = (values[index] || '').trim().replace(/^"|"$/g, '');
      
      if (header.includes('date')) {
        transaction.date = value;
      } else if (header.includes('description') || header.includes('narration') || header.includes('details') || header.includes('memo') || header.includes('particulars')) {
        transaction.description = value;
      } else if (header.includes('amount') || header.includes('debit') || header.includes('credit') || header.includes('value')) {
        // Handle currency symbols and formatting
        const cleanValue = value.replace(/[^0-9.-]/g, '');
        const amount = parseFloat(cleanValue);
        transaction.amount = isNaN(amount) ? 0 : Math.abs(amount);
      } else if (header.includes('reference') || header.includes('ref') || header.includes('transaction') || header.includes('transaction id')) {
        transaction.reference = value;
      } else if (header.includes('account') || header.includes('account number')) {
        transaction.account = value;
      }
    });

    // Only add if we have essential fields
    if (transaction.date && transaction.amount > 0) {
      transactions.push(transaction);
    }
  }

  return transactions;
}

/**
 * Parse Excel file for bank statements
 */
export function parseBankStatementExcel(file: File): Promise<BankTransaction[]> {
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
        
        if (jsonData.length < 2) {
          resolve([]);
          return;
        }
        
        // First row is headers
        const headers = (jsonData[0] as any[]).map((h: any) => String(h || '').trim().toLowerCase());
        const transactions: BankTransaction[] = [];
        
        // Process rows
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;
          
          const transaction: BankTransaction = {
            date: '',
            description: '',
            amount: 0,
          };
          
          headers.forEach((header, index) => {
            const value = String(row[index] || '').trim();
            
            if (header.includes('date')) {
              // Handle Excel date serial numbers
              if (typeof row[index] === 'number') {
                const excelDate = XLSX.SSF.parse_date_code(row[index]);
                transaction.date = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
              } else {
                transaction.date = value;
              }
            } else if (header.includes('description') || header.includes('narration') || header.includes('details') || header.includes('memo') || header.includes('particulars')) {
              transaction.description = value;
            } else if (header.includes('amount') || header.includes('debit') || header.includes('credit') || header.includes('value')) {
              const amount = typeof row[index] === 'number' ? row[index] : parseFloat(String(row[index]).replace(/[^0-9.-]/g, ''));
              transaction.amount = isNaN(amount) ? 0 : Math.abs(amount);
            } else if (header.includes('reference') || header.includes('ref') || header.includes('transaction') || header.includes('transaction id')) {
              transaction.reference = value;
            } else if (header.includes('account') || header.includes('account number')) {
              transaction.account = value;
            }
          });
          
          if (transaction.date && transaction.amount > 0) {
            transactions.push(transaction);
          }
        }
        
        resolve(transactions);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read Excel file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse bank statement file (CSV or Excel)
 */
export async function parseBankStatementFile(file: File): Promise<BankTransaction[]> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return await parseBankStatementExcel(file);
  } else if (fileName.endsWith('.csv')) {
    const text = await file.text();
    return parseBankStatementCSV(text);
  } else {
    throw new Error('Unsupported file format. Please use CSV or Excel (.xlsx, .xls)');
  }
}

/**
 * Match bank transactions with repayments
 * Improved matching logic with better date handling and amount tolerance
 */
export function matchBankTransactions(
  bankTransactions: BankTransaction[],
  repayments: any[]
): ReconciliationMatch[] {
  const matches: ReconciliationMatch[] = [];
  const usedRepayments = new Set<string>(); // Track which repayments have been matched

  for (const bankTx of bankTransactions) {
    let bestMatch: any = null;
    let bestConfidence: 'high' | 'medium' | 'low' = 'low';
    let matchReason = 'No match found';

    // Parse bank transaction date
    const txDate = parseDate(bankTx.date);
    if (!txDate) {
      matches.push({
        bankTransaction: bankTx,
        repayment: undefined,
        matchConfidence: 'low',
        matchReason: 'Invalid date format',
      });
      continue;
    }

    // Try to match by reference/transaction ID (highest confidence)
    if (bankTx.reference) {
      const refMatch = repayments.find((r: any) => 
        !usedRepayments.has(r.id) &&
        (r.transactionId === bankTx.reference ||
         r.id === bankTx.reference ||
         r.reference === bankTx.reference ||
         String(r.id).includes(bankTx.reference) ||
         String(bankTx.reference).includes(r.id))
      );
      if (refMatch) {
        bestMatch = refMatch;
        bestConfidence = 'high';
        matchReason = 'Matched by reference/transaction ID';
        usedRepayments.add(refMatch.id);
      }
    }

    // Try to match by amount and date (within 5 days) - medium confidence
    if (!bestMatch) {
      const amountTolerance = 0.01; // Allow 1 cent difference
      const dateToleranceDays = 5;
      
      const candidates = repayments
        .filter((r: any) => {
          if (usedRepayments.has(r.id)) return false;
          
          const repaymentDate = r.dueDate?.toDate?.() || r.paidAt?.toDate?.() || parseDate(r.dueDate) || parseDate(r.paidAt);
          if (!repaymentDate) return false;
          
          const daysDiff = Math.abs((txDate.getTime() - repaymentDate.getTime()) / (1000 * 60 * 60 * 24));
          const repaymentAmount = Number(r.amountDue || r.amountPaid || 0);
          const amountDiff = Math.abs(repaymentAmount - bankTx.amount);
          
          return daysDiff <= dateToleranceDays && amountDiff <= amountTolerance;
        })
        .map((r: any) => {
          const repaymentDate = r.dueDate?.toDate?.() || r.paidAt?.toDate?.() || parseDate(r.dueDate) || parseDate(r.paidAt);
          const daysDiff = Math.abs((txDate.getTime() - repaymentDate.getTime()) / (1000 * 60 * 60 * 24));
          const repaymentAmount = Number(r.amountDue || r.amountPaid || 0);
          const amountDiff = Math.abs(repaymentAmount - bankTx.amount);
          
          return {
            repayment: r,
            daysDiff,
            amountDiff,
            score: (1 / (daysDiff + 1)) * (1 / (amountDiff + 0.01)), // Higher score = better match
          };
        })
        .sort((a, b) => b.score - a.score);

      if (candidates.length > 0 && candidates[0].score > 0.1) {
        bestMatch = candidates[0].repayment;
        bestConfidence = 'medium';
        matchReason = `Matched by amount and date (${Math.round(candidates[0].daysDiff)} days, ${candidates[0].amountDiff.toFixed(2)} difference)`;
        usedRepayments.add(bestMatch.id);
      }
    }

    // Try to match by amount only (low confidence) - only for pending repayments
    if (!bestMatch) {
      const amountTolerance = 0.01;
      const amountMatch = repayments.find((r: any) => 
        !usedRepayments.has(r.id) &&
        Math.abs(Number(r.amountDue || 0) - bankTx.amount) <= amountTolerance &&
        (r.status === 'pending' || r.status === 'overdue')
      );
      if (amountMatch) {
        bestMatch = amountMatch;
        bestConfidence = 'low';
        matchReason = 'Matched by amount only (pending repayment)';
        usedRepayments.add(amountMatch.id);
      }
    }

    matches.push({
      bankTransaction: bankTx,
      repayment: bestMatch,
      matchConfidence: bestConfidence,
      matchReason,
    });
  }

  return matches;
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string | Date | undefined): Date | null {
  if (!dateStr) return null;
  
  if (dateStr instanceof Date) {
    return isNaN(dateStr.getTime()) ? null : dateStr;
  }
  
  const str = String(dateStr).trim();
  if (!str) return null;
  
  // Try ISO format first
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Try common formats: DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY, YYYY-MM-DD
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  ];
  
  for (const format of formats) {
    const match = str.match(format);
    if (match) {
      let year: number, month: number, day: number;
      
      if (match[0].includes('/')) {
        // DD/MM/YYYY or MM/DD/YYYY - try both
        const d = parseInt(match[1]);
        const m = parseInt(match[2]);
        const y = parseInt(match[3]);
        
        // Heuristic: if first number > 12, it's DD/MM/YYYY
        if (d > 12) {
          day = d;
          month = m - 1; // JS months are 0-indexed
          year = y;
        } else {
          // Could be either, default to MM/DD/YYYY
          month = d - 1;
          day = m;
          year = y;
        }
      } else if (match[0].startsWith(match[3])) {
        // YYYY-MM-DD
        year = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        day = parseInt(match[3]);
      } else {
        // DD-MM-YYYY
        day = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        year = parseInt(match[3]);
      }
      
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  
  return null;
}

/**
 * Generate reconciliation report
 */
export function generateReconciliationReport(matches: ReconciliationMatch[]) {
  const matched = matches.filter(m => m.repayment).length;
  const unmatched = matches.filter(m => !m.repayment).length;
  const highConfidence = matches.filter(m => m.matchConfidence === 'high').length;
  const mediumConfidence = matches.filter(m => m.matchConfidence === 'medium').length;
  const lowConfidence = matches.filter(m => m.matchConfidence === 'low' && m.repayment).length;
  const totalAmount = matches.reduce((sum, m) => sum + m.bankTransaction.amount, 0);
  const matchedAmount = matches
    .filter(m => m.repayment)
    .reduce((sum, m) => sum + m.bankTransaction.amount, 0);

  return {
    totalTransactions: matches.length,
    matched,
    unmatched,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    totalAmount,
    matchedAmount,
    unmatchedAmount: totalAmount - matchedAmount,
    matchRate: matches.length > 0 ? (matched / matches.length) * 100 : 0,
  };
}
