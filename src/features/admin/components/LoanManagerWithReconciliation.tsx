/**
 * Loans Manager with Orphan Reconciliation
 * Displays loans and provides access to orphan reconciliation
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAgency } from '../../../hooks/useAgency';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Loader2, AlertCircle } from 'lucide-react';
import { OrphanReconciliationModal } from './OrphanReconciliationModal';
import { countOrphanLoans } from '../../../lib/loan-reconciliation/orphan-detection';
import { useQuery } from '@tanstack/react-query';

export function LoanManagerWithReconciliation() {
  const { profile } = useAuth();
  const { agency } = useAgency();
  const [reconciliationOpen, setReconciliationOpen] = useState(false);
  const [orphanCount, setOrphanCount] = useState(0);

  // Query orphan loan count
  const { data: orphanLoans = 0, isLoading: loadingOrphans, refetch } = useQuery({
    queryKey: ['orphan-loans-count', agency?.id],
    queryFn: async () => {
      if (!agency?.id) return 0;
      return countOrphanLoans(agency.id);
    },
    enabled: !!agency?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  useEffect(() => {
    setOrphanCount(orphanLoans);
  }, [orphanLoans]);

  if (!profile || !agency) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Orphan Loans Alert Card */}
      {orphanCount > 0 && (
        <Card className="p-4 border-l-4 border-amber-500 bg-amber-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-900">
                  ⚠️ {orphanCount} Loan(s) Need Linking
                </h3>
                <p className="text-sm text-amber-800">
                  These loans couldn't be automatically matched to customers.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setReconciliationOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Fix Now
            </Button>
          </div>
        </Card>
      )}

      {/* Your existing loans list/table would go here */}
      <Card className="p-4">
        <p className="text-neutral-600">
          Loans list would be displayed here with filtering by status (Pending, Approved,
          Rejected, etc.)
        </p>
      </Card>

      {/* Reconciliation Modal */}
      <OrphanReconciliationModal
        open={reconciliationOpen}
        onOpenChange={setReconciliationOpen}
        agencyId={agency.id}
        userId={profile.id}
      />
    </div>
  );
}
