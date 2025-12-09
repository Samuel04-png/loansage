import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { useAuth } from '../../hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Search,
  Loader2,
  DollarSign,
  User,
  FileText,
  X,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDateSafe } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'loans' | 'customers' | 'employees'>('all');

  // Global search across all entities
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['global-search', profile?.agency_id, searchQuery, searchType],
    queryFn: async () => {
      if (!profile?.agency_id || !searchQuery.trim()) return { loans: [], customers: [], employees: [] };

      const results: any = { loans: [], customers: [], employees: [] };
      const queryLower = searchQuery.toLowerCase();

      // Search loans
      if (searchType === 'all' || searchType === 'loans') {
        const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
        const loansSnapshot = await getDocs(loansRef);
        results.loans = loansSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((loan: any) => {
            if (loan.deleted) return false;
            return (
              loan.id?.toLowerCase().includes(queryLower) ||
              loan.loanNumber?.toLowerCase().includes(queryLower) ||
              loan.customerId?.toLowerCase().includes(queryLower) ||
              String(loan.amount || '').includes(queryLower) ||
              loan.status?.toLowerCase().includes(queryLower)
            );
          })
          .slice(0, 5); // Limit results
      }

      // Search customers
      if (searchType === 'all' || searchType === 'customers') {
        const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
        const customersSnapshot = await getDocs(customersRef);
        results.customers = customersSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((customer: any) => {
            return (
              customer.id?.toLowerCase().includes(queryLower) ||
              customer.fullName?.toLowerCase().includes(queryLower) ||
              customer.name?.toLowerCase().includes(queryLower) ||
              customer.email?.toLowerCase().includes(queryLower) ||
              customer.phone?.toLowerCase().includes(queryLower) ||
              customer.nrcNumber?.toLowerCase().includes(queryLower) ||
              customer.nrc?.toLowerCase().includes(queryLower)
            );
          })
          .slice(0, 5);
      }

      // Search employees
      if (searchType === 'all' || searchType === 'employees') {
        const employeesRef = collection(db, 'agencies', profile.agency_id, 'employees');
        const employeesSnapshot = await getDocs(employeesRef);
        results.employees = employeesSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((employee: any) => {
            return (
              employee.id?.toLowerCase().includes(queryLower) ||
              employee.name?.toLowerCase().includes(queryLower) ||
              employee.email?.toLowerCase().includes(queryLower)
            );
          })
          .slice(0, 5);
      }

      return results;
    },
    enabled: !!profile?.agency_id && searchQuery.trim().length > 0 && open,
  });

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
    }
  }, [open]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(true);
      }
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const totalResults = (searchResults?.loans?.length || 0) + 
                      (searchResults?.customers?.length || 0) + 
                      (searchResults?.employees?.length || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-neutral-400" />
            <DialogTitle>Search</DialogTitle>
          </div>
          <DialogDescription>
            Search across loans, customers, and employees
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 border-b">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
              <Input
                placeholder="Search loans, customers, employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchQuery.trim() && searchQuery.trim()}
                className="pl-10"
                autoFocus
              />
            </div>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as any)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="loans">Loans</option>
              <option value="customers">Customers</option>
              <option value="employees">Employees</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#006BFF]" />
            </div>
          ) : searchQuery.trim() ? (
            <>
              {totalResults === 0 ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 mx-auto mb-4 text-neutral-400 opacity-50" />
                  <p className="text-neutral-600">No results found for "{searchQuery}"</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Loans Results */}
                  {(searchType === 'all' || searchType === 'loans') && searchResults?.loans && searchResults.loans.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <DollarSign className="w-4 h-4 text-neutral-400" />
                        <h3 className="font-semibold text-sm text-neutral-700">Loans</h3>
                        <Badge variant="outline" className="text-xs">
                          {searchResults.loans.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {searchResults.loans.map((loan: any) => (
                          <Link
                            key={loan.id}
                            to={`/admin/loans/${loan.id}`}
                            onClick={() => onOpenChange(false)}
                            className="block p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 hover:border-[#006BFF] transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-neutral-900 truncate">
                                  Loan {loan.id.substring(0, 12)}...
                                </p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                                  <span>{formatCurrency(Number(loan.amount || 0))}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {loan.status || 'N/A'}
                                  </Badge>
                                </div>
                              </div>
                              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-[#006BFF] transition-colors" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Customers Results */}
                  {(searchType === 'all' || searchType === 'customers') && searchResults?.customers && searchResults.customers.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <User className="w-4 h-4 text-neutral-400" />
                        <h3 className="font-semibold text-sm text-neutral-700">Customers</h3>
                        <Badge variant="outline" className="text-xs">
                          {searchResults.customers.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {searchResults.customers.map((customer: any) => (
                          <Link
                            key={customer.id}
                            to={`/admin/customers/${customer.id}`}
                            onClick={() => onOpenChange(false)}
                            className="block p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 hover:border-[#006BFF] transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-neutral-900 truncate">
                                  {customer.fullName || customer.name || 'N/A'}
                                </p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                                  {customer.email && <span>{customer.email}</span>}
                                  {customer.phone && <span>{customer.phone}</span>}
                                </div>
                              </div>
                              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-[#006BFF] transition-colors" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Employees Results */}
                  {(searchType === 'all' || searchType === 'employees') && searchResults?.employees && searchResults.employees.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <User className="w-4 h-4 text-neutral-400" />
                        <h3 className="font-semibold text-sm text-neutral-700">Employees</h3>
                        <Badge variant="outline" className="text-xs">
                          {searchResults.employees.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {searchResults.employees.map((employee: any) => (
                          <Link
                            key={employee.id}
                            to={`/admin/employees/${employee.id}`}
                            onClick={() => onOpenChange(false)}
                            className="block p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 hover:border-[#006BFF] transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-neutral-900 truncate">
                                  {employee.name || 'N/A'}
                                </p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                                  {employee.email && <span>{employee.email}</span>}
                                  <Badge variant="outline" className="text-xs">
                                    {employee.role || 'N/A'}
                                  </Badge>
                                </div>
                              </div>
                              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-[#006BFF] transition-colors" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Search className="w-12 h-12 mx-auto mb-4 text-neutral-400 opacity-50" />
              <p className="text-neutral-600 mb-2">Start typing to search...</p>
              <p className="text-xs text-neutral-500">Press ⌘K or Ctrl+K to open search</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

