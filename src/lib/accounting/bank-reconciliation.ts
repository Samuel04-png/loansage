/**
 * Bank Reconciliation Utilities
 * Handles CSV parsing and matching payments with repayments
 */

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
 * Parse bank statement CSV
 * Supports common formats: date, description, amount, reference
 */
export function parseBankStatementCSV(csvText: string): BankTransaction[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const transactions: BankTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length < 3) continue;

    const transaction: BankTransaction = {
      date: '',
      description: '',
      amount: 0,
    };

    headers.forEach((header, index) => {
      const value = values[index] || '';
      
      if (header.includes('date')) {
        transaction.date = value;
      } else if (header.includes('description') || header.includes('narration') || header.includes('details')) {
        transaction.description = value;
      } else if (header.includes('amount') || header.includes('debit') || header.includes('credit')) {
        const amount = parseFloat(value.replace(/[^0-9.-]/g, ''));
        transaction.amount = isNaN(amount) ? 0 : Math.abs(amount);
      } else if (header.includes('reference') || header.includes('ref')) {
        transaction.reference = value;
      } else if (header.includes('account')) {
        transaction.account = value;
      }
    });

    if (transaction.date && transaction.amount > 0) {
      transactions.push(transaction);
    }
  }

  return transactions;
}

/**
 * Match bank transactions with repayments
 */
export function matchBankTransactions(
  bankTransactions: BankTransaction[],
  repayments: any[]
): ReconciliationMatch[] {
  const matches: ReconciliationMatch[] = [];

  for (const bankTx of bankTransactions) {
    let bestMatch: any = null;
    let bestConfidence: 'high' | 'medium' | 'low' = 'low';
    let matchReason = 'No match found';

    // Try to match by reference/transaction ID
    if (bankTx.reference) {
      const refMatch = repayments.find((r: any) => 
        r.transactionId === bankTx.reference ||
        r.id === bankTx.reference ||
        r.reference === bankTx.reference
      );
      if (refMatch) {
        bestMatch = refMatch;
        bestConfidence = 'high';
        matchReason = 'Matched by reference/transaction ID';
      }
    }

    // Try to match by amount and date (within 7 days)
    if (!bestMatch) {
      const txDate = new Date(bankTx.date);
      const amountMatch = repayments
        .filter((r: any) => {
          const dueDate = r.dueDate?.toDate?.() || new Date(r.dueDate);
          const daysDiff = Math.abs((txDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          const amountMatch = Math.abs(Number(r.amountDue || 0) - bankTx.amount) < 1;
          return daysDiff <= 7 && amountMatch;
        })
        .sort((a: any, b: any) => {
          const dateA = a.dueDate?.toDate?.() || new Date(a.dueDate);
          const dateB = b.dueDate?.toDate?.() || new Date(b.dueDate);
          const diffA = Math.abs((txDate.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24));
          const diffB = Math.abs((txDate.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24));
          return diffA - diffB;
        })[0];

      if (amountMatch) {
        bestMatch = amountMatch;
        bestConfidence = 'medium';
        matchReason = 'Matched by amount and date proximity';
      }
    }

    // Try to match by amount only
    if (!bestMatch) {
      const amountMatch = repayments.find((r: any) => 
        Math.abs(Number(r.amountDue || 0) - bankTx.amount) < 1 &&
        r.status === 'pending'
      );
      if (amountMatch) {
        bestMatch = amountMatch;
        bestConfidence = 'low';
        matchReason = 'Matched by amount only';
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
 * Generate reconciliation report
 */
export function generateReconciliationReport(matches: ReconciliationMatch[]) {
  const matched = matches.filter(m => m.repayment).length;
  const unmatched = matches.filter(m => !m.repayment).length;
  const highConfidence = matches.filter(m => m.matchConfidence === 'high').length;
  const totalAmount = matches.reduce((sum, m) => sum + m.bankTransaction.amount, 0);
  const matchedAmount = matches
    .filter(m => m.repayment)
    .reduce((sum, m) => sum + m.bankTransaction.amount, 0);

  return {
    totalTransactions: matches.length,
    matched,
    unmatched,
    highConfidence,
    totalAmount,
    matchedAmount,
    matchRate: matches.length > 0 ? (matched / matches.length) * 100 : 0,
  };
}

