/**
 * Post-Import Reconciliation Alert
 * Shown after loan import if orphan loans are detected
 */

import { AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import toast from 'react-hot-toast';
import type { LoanImportResult } from '../../../lib/loan-reconciliation/loan-import-helper';

interface PostImportReconciliationAlertProps {
  importResult: LoanImportResult;
  onOpenReconciliation: () => void;
  onDismiss: () => void;
}

export function PostImportReconciliationAlert({
  importResult,
  onOpenReconciliation,
  onDismiss,
}: PostImportReconciliationAlertProps) {
  if (importResult.orphanCount === 0) {
    return (
      <Card className="p-4 border-l-4 border-green-500 bg-green-50">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-900">
              ✅ All {importResult.linkedCount} loans linked successfully!
            </h3>
            <p className="text-sm text-green-800 mt-1">
              All imported loans were automatically matched to existing customers.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 border-l-4 border-amber-500 bg-amber-50">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900">
              ⚠️ {importResult.orphanCount} Loan(s) Need Linking
            </h3>
            <p className="text-sm text-amber-800 mt-1">
              {importResult.linkedCount} loans were automatically linked, but{' '}
              <span className="font-semibold">{importResult.orphanCount}</span> couldn't be
              matched to existing customers and need manual mapping.
            </p>
            <p className="text-xs text-amber-700 mt-2">
              You can fix this now or come back later from the Loans menu. Unmapped loans
              will remain in a "Requires Mapping" status until linked.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => {
              onOpenReconciliation();
              toast.success('Opening reconciliation tool...');
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            Fix Now ({importResult.orphanCount})
          </Button>
          <Button size="sm" variant="outline" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </Card>
  );
}
