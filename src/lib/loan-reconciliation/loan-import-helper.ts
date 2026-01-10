/**
 * Loan Import Enhancement
 * Handles customer matching during loan import to prevent orphan loans
 */

import { findMatchingCustomer, type CustomerMatch } from './orphan-detection';

export interface LoanImportRow {
  borrower_id?: string;
  borrower_name: string;
  national_id?: string;
  amount: number;
  status?: string;
  [key: string]: any;
}

export interface LoanImportResult {
  importedCount: number;
  linkedCount: number;
  orphanCount: number;
  orphanIds: string[];
  mappingSuggestions: Record<string, CustomerMatch>;
}

/**
 * Process loan rows and link them to customers
 * Returns details about which loans were orphaned
 */
export async function processLoanImportWithMatching(
  agencyId: string,
  loanRows: LoanImportRow[]
): Promise<LoanImportResult> {
  const result: LoanImportResult = {
    importedCount: 0,
    linkedCount: 0,
    orphanCount: 0,
    orphanIds: [],
    mappingSuggestions: {},
  };

  for (const row of loanRows) {
    try {
      // Ensure borrower_name is a valid string
      const borrowerName = String(row.borrower_name || '').trim();
      if (!borrowerName) {
        result.orphanCount++;
        result.orphanIds.push(row.borrower_id || `unknown-${Date.now()}`);
        row.status = 'requires_mapping';
        row.customer_id = null;
        result.importedCount++;
        continue; // Skip to next row
      }

      // Try to find matching customer
      const match = await findMatchingCustomer(
        agencyId,
        row.borrower_id || null,
        borrowerName,
        row.national_id || null,
        0.9 // 90% fuzzy match threshold
      );

      if (match) {
        // Customer found - link the loan
        result.linkedCount++;
        row.customer_id = match.customerId; // Add to row for import
      } else {
        // No customer found - mark as orphan
        result.orphanCount++;
        result.orphanIds.push(row.borrower_id || `unknown-${Date.now()}`);
        row.status = 'requires_mapping'; // Mark for later reconciliation
        row.customer_id = null;
      }

      result.importedCount++;
    } catch (error) {
      console.error('Error processing loan row:', error);
      result.importedCount++;
    }
  }

  return result;
}

/**
 * Generate a reconciliation report after import
 */
export function generateReconciliationReport(
  result: LoanImportResult
): string {
  const lines = [
    `📊 Loan Import Report`,
    `Total Imported: ${result.importedCount}`,
    `✅ Automatically Linked: ${result.linkedCount}`,
    `⚠️  Orphan Loans (need mapping): ${result.orphanCount}`,
  ];

  if (result.orphanCount > 0) {
    lines.push(
      `\n📋 Action Required: ${result.orphanCount} loans need to be manually linked to customers.`
    );
    lines.push(
      'Click "Reconcile Orphan Loans" to fix this now or continue later from the Loans menu.'
    );
  }

  return lines.join('\n');
}
