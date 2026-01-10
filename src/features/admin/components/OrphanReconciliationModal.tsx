/**
 * Orphan Loan Reconciliation UI Component
 * Displays unlinked loans and allows manual mapping to customers
 */

import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Card } from '../../../components/ui/card';
import {
  AlertCircle,
  CheckCircle2,
  Search,
  Loader2,
  Plus,
  Link as LinkIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getOrphanReconciliationSuggestions,
  findMatchingCustomer,
  type OrphanReconciliation,
  type CustomerMatch,
} from '../../../lib/loan-reconciliation/orphan-detection';
import { doc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';

interface OrphanReconciliationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  userId: string;
}

interface ReconciliationState {
  loanId: string;
  selectedCustomerId: string | null;
  suggestedMatch: CustomerMatch | undefined;
  searchQuery: string;
  matchingCustomers: any[];
  isLoading: boolean;
}

export function OrphanReconciliationModal({
  open,
  onOpenChange,
  agencyId,
  userId,
}: OrphanReconciliationModalProps) {
  const queryClient = useQueryClient();
  const [reconciliations, setReconciliations] = useState<OrphanReconciliation[]>([]);
  const [reconciliationStates, setReconciliationStates] = useState<
    Record<string, ReconciliationState>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  // Load orphan loans and their suggestions
  useEffect(() => {
    if (!open || !agencyId) return;

    const loadOrphans = async () => {
      setIsLoading(true);
      try {
        const orphanReconciliations =
          await getOrphanReconciliationSuggestions(agencyId);
        setReconciliations(orphanReconciliations);

        // Initialize state for each orphan
        const initialStates: Record<string, ReconciliationState> = {};
        for (const rec of orphanReconciliations) {
          initialStates[rec.loanId] = {
            loanId: rec.loanId,
            selectedCustomerId: rec.suggestedMatch?.customerId || null,
            suggestedMatch: rec.suggestedMatch,
            searchQuery: '',
            matchingCustomers: [],
            isLoading: false,
          };
        }
        setReconciliationStates(initialStates);
        setCompletedCount(0);
      } catch (error) {
        console.error('Error loading orphan loans:', error);
        toast.error('Failed to load orphan loans');
      } finally {
        setIsLoading(false);
      }
    };

    loadOrphans();
  }, [open, agencyId]);

  // Handle search for customers
  const handleSearchCustomers = async (loanId: string, searchQuery: string) => {
    const state = reconciliationStates[loanId];
    if (!state) return;

    setReconciliationStates((prev) => ({
      ...prev,
      [loanId]: { ...state, searchQuery, isLoading: true },
    }));

    try {
      const customersRef = collection(
        db,
        'agencies',
        agencyId,
        'customers'
      );

      // Search by name
      const allCustomersSnap = await getDocs(customersRef);
      const matchingCustomers = allCustomersSnap.docs
        .map((doc) => doc.data())
        .filter((customer) =>
          customer.full_name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 10);

      setReconciliationStates((prev) => ({
        ...prev,
        [loanId]: { ...state, matchingCustomers, isLoading: false },
      }));
    } catch (error) {
      console.error('Error searching customers:', error);
      toast.error('Failed to search customers');
      setReconciliationStates((prev) => ({
        ...prev,
        [loanId]: { ...state, isLoading: false },
      }));
    }
  };

  // Handle customer selection
  const handleSelectCustomer = (loanId: string, customerId: string) => {
    setReconciliationStates((prev) => ({
      ...prev,
      [loanId]: {
        ...prev[loanId],
        selectedCustomerId: customerId,
        searchQuery: '',
        matchingCustomers: [],
      },
    }));
  };

  // Handle create new customer
  const handleCreateNewCustomer = async (loanId: string) => {
    const reconciliation = reconciliations.find((r) => r.loanId === loanId);
    if (!reconciliation) return;

    const name = prompt(
      'Enter customer name:',
      reconciliation.orphanLoan.borrowerName
    );
    if (!name) return;

    try {
      setReconciliationStates((prev) => ({
        ...prev,
        [loanId]: { ...prev[loanId], isLoading: true },
      }));

      // Create new customer
      const customersRef = collection(
        db,
        'agencies',
        agencyId,
        'customers'
      );

      // Get next customer ID
      const allCustomersSnap = await getDocs(customersRef);
      const nextId = `CUST-${Date.now()}`;

      const newCustomer = {
        id: nextId,
        full_name: name,
        phone: reconciliation.orphanLoan.rawData.phone || '',
        email: reconciliation.orphanLoan.rawData.email || '',
        national_id: reconciliation.orphanLoan.rawData.national_id || '',
        address: reconciliation.orphanLoan.rawData.address || '',
        created_at: new Date().toISOString(),
        created_by: userId,
        status: 'active',
      };

      // Note: In a real implementation, you'd save this via an API endpoint
      // For now, we'll just select it
      toast.success(`Customer "${name}" would be created (implement save logic)`);

      handleSelectCustomer(loanId, nextId);
    } catch (error) {
      console.error('Error creating customer:', error);
      toast.error('Failed to create customer');
    } finally {
      setReconciliationStates((prev) => ({
        ...prev,
        [loanId]: { ...prev[loanId], isLoading: false },
      }));
    }
  };

  // Save all reconciliations
  const handleSaveReconciliations = async () => {
    const toMap = Object.entries(reconciliationStates)
      .filter(([_, state]) => state.selectedCustomerId)
      .map(([loanId, state]) => ({
        loanId,
        customerId: state.selectedCustomerId!,
      }));

    if (toMap.length === 0) {
      toast.error('Please select a customer for at least one loan');
      return;
    }

    setIsSaving(true);
    try {
      let successCount = 0;

      for (const mapping of toMap) {
        try {
          const loanRef = doc(
            db,
            'agencies',
            agencyId,
            'loans',
            mapping.loanId
          );
          await updateDoc(loanRef, {
            customer_id: mapping.customerId,
            status: 'active', // Change from requires_mapping to active
            mapped_at: new Date().toISOString(),
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to map loan ${mapping.loanId}:`, error);
        }
      }

      toast.success(`Successfully mapped ${successCount} loan(s)`);
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setCompletedCount((prev) => prev + successCount);

      // Close modal after successful save
      if (successCount === toMap.length) {
        setTimeout(() => onOpenChange(false), 1000);
      }
    } catch (error) {
      console.error('Error saving reconciliations:', error);
      toast.error('Failed to save reconciliations');
    } finally {
      setIsSaving(false);
    }
  };

  const mappedCount = Object.values(reconciliationStates).filter(
    (s) => s.selectedCustomerId
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Reconcile Orphan Loans
          </DialogTitle>
          <DialogDescription>
            {reconciliations.length} loan(s) need to be linked to customers.
            {completedCount > 0 && (
              <span className="text-green-600 font-semibold">
                {' '}
                {completedCount} already mapped.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading orphan loans...
            </div>
          ) : reconciliations.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              No orphan loans found! All loans are properly linked.
            </div>
          ) : (
            reconciliations.map((rec) => {
              const state = reconciliationStates[rec.loanId];
              if (!state) return null;

              const isMapped = !!state.selectedCustomerId;

              return (
                <Card
                  key={rec.loanId}
                  className={`p-4 transition-all ${
                    isMapped
                      ? 'border-green-200 bg-green-50'
                      : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="grid grid-cols-3 gap-4">
                    {/* Left: Loan Details */}
                    <div className="space-y-2">
                      <div className="font-semibold text-neutral-900">
                        {rec.orphanLoan.borrowerName}
                      </div>
                      <div className="text-sm text-neutral-600">
                        Amount:{' '}
                        <span className="font-semibold">
                          K{rec.orphanLoan.amount.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500">
                        {new Date(rec.orphanLoan.dateCreated).toLocaleDateString()}
                      </div>
                      {state.suggestedMatch && (
                        <Badge className="bg-blue-100 text-blue-800">
                          AI Suggestion
                        </Badge>
                      )}
                    </div>

                    {/* Middle: Suggestion or Search */}
                    <div className="space-y-2">
                      {state.suggestedMatch && !state.searchQuery && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="text-xs font-semibold text-blue-900 mb-1">
                            Suggestion:
                          </div>
                          <div className="text-sm text-blue-800">
                            {state.suggestedMatch.customerName}
                          </div>
                          <div className="text-xs text-blue-700 mt-1">
                            {state.suggestedMatch.reason}
                          </div>
                          <Badge className="mt-2 bg-blue-200 text-blue-900">
                            {(state.suggestedMatch.confidence * 100).toFixed(0)}%
                            match
                          </Badge>
                        </div>
                      )}

                      {state.searchQuery && (
                        <div className="space-y-2">
                          {state.isLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="w-4 h-4 animate-spin" />
                            </div>
                          ) : state.matchingCustomers.length > 0 ? (
                            <div className="space-y-1">
                              {state.matchingCustomers.map((customer) => (
                                <button
                                  key={customer.id}
                                  onClick={() =>
                                    handleSelectCustomer(rec.loanId, customer.id)
                                  }
                                  className="w-full text-left p-2 text-sm hover:bg-blue-100 rounded border border-neutral-200"
                                >
                                  {customer.full_name}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-neutral-500 p-2">
                              No customers found
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Selection Status or Action Buttons */}
                    <div className="flex items-center gap-2">
                      {isMapped ? (
                        <div className="flex items-center gap-2 w-full">
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-green-900 truncate">
                              Linked
                            </div>
                          </div>
                        </div>
                      ) : state.searchQuery ? (
                        <div className="w-full space-y-2">
                          <Input
                            placeholder="Search customers..."
                            value={state.searchQuery}
                            onChange={(e) =>
                              handleSearchCustomers(
                                rec.loanId,
                                e.target.value
                              )
                            }
                            className="text-sm"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreateNewCustomer(rec.loanId)}
                            className="w-full text-xs"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Create New
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2 w-full">
                          {state.suggestedMatch ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleSelectCustomer(
                                  rec.loanId,
                                  state.suggestedMatch!.customerId
                                )
                              }
                              className="flex-1"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Confirm
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setReconciliationStates((prev) => ({
                                  ...prev,
                                  [rec.loanId]: {
                                    ...prev[rec.loanId],
                                    searchQuery: '',
                                  },
                                }))
                              }
                              className="flex-1"
                            >
                              <Search className="w-3 h-3 mr-1" />
                              Search
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCreateNewCustomer(rec.loanId)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveReconciliations}
            disabled={
              isSaving || mappedCount === 0 || reconciliations.length === 0
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <LinkIcon className="w-4 h-4 mr-2" />
                Link {mappedCount} Loan(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
