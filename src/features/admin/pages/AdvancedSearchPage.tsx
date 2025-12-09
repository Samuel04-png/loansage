import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  Search,
  Filter,
  Save,
  X,
  Clock,
  Star,
  Loader2,
  DollarSign,
  User,
  FileText,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

interface SavedFilter {
  id: string;
  name: string;
  type: 'loans' | 'customers' | 'employees';
  filters: Record<string, any>;
  createdAt: Date;
}

export function AdvancedSearchPage() {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'loans' | 'customers' | 'employees'>('all');
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load saved filters from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('savedFilters');
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved filters:', e);
      }
    }

    const recent = localStorage.getItem('recentSearches');
    if (recent) {
      try {
        setRecentSearches(JSON.parse(recent));
      } catch (e) {
        console.error('Failed to load recent searches:', e);
      }
    }
  }, []);

  // Global search across all entities
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['global-search', profile?.agency_id, searchQuery, searchType, activeFilters],
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
            const matchesQuery = 
              loan.id?.toLowerCase().includes(queryLower) ||
              loan.loanNumber?.toLowerCase().includes(queryLower) ||
              loan.customerId?.toLowerCase().includes(queryLower) ||
              String(loan.amount || '').includes(queryLower) ||
              loan.status?.toLowerCase().includes(queryLower);
            
            // Apply active filters
            if (activeFilters.status && loan.status !== activeFilters.status) return false;
            if (activeFilters.minAmount && Number(loan.amount || 0) < activeFilters.minAmount) return false;
            if (activeFilters.maxAmount && Number(loan.amount || 0) > activeFilters.maxAmount) return false;
            
            return matchesQuery;
          });
      }

      // Search customers
      if (searchType === 'all' || searchType === 'customers') {
        const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
        const customersSnapshot = await getDocs(customersRef);
        results.customers = customersSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((customer: any) => {
            const matchesQuery =
              customer.id?.toLowerCase().includes(queryLower) ||
              customer.fullName?.toLowerCase().includes(queryLower) ||
              customer.name?.toLowerCase().includes(queryLower) ||
              customer.email?.toLowerCase().includes(queryLower) ||
              customer.phone?.toLowerCase().includes(queryLower) ||
              customer.nrcNumber?.toLowerCase().includes(queryLower) ||
              customer.nrc?.toLowerCase().includes(queryLower);
            
            return matchesQuery;
          });
      }

      // Search employees
      if (searchType === 'all' || searchType === 'employees') {
        const employeesRef = collection(db, 'agencies', profile.agency_id, 'employees');
        const employeesSnapshot = await getDocs(employeesRef);
        results.employees = employeesSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((employee: any) => {
            const matchesQuery =
              employee.id?.toLowerCase().includes(queryLower) ||
              employee.name?.toLowerCase().includes(queryLower) ||
              employee.email?.toLowerCase().includes(queryLower);
            
            return matchesQuery;
          });
      }

      return results;
    },
    enabled: !!profile?.agency_id && searchQuery.trim().length > 0,
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    // Save to recent searches
    const recent = [...recentSearches.filter(s => s !== searchQuery), searchQuery].slice(0, 10);
    setRecentSearches(recent);
    localStorage.setItem('recentSearches', JSON.stringify(recent));
  };

  const saveCurrentFilter = () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query first');
      return;
    }

    const newFilter: SavedFilter = {
      id: `filter-${Date.now()}`,
      name: `Filter ${savedFilters.length + 1}`,
      type: searchType === 'all' ? 'loans' : searchType,
      filters: { query: searchQuery, ...activeFilters },
      createdAt: new Date(),
    };

    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem('savedFilters', JSON.stringify(updated));
    toast.success('Filter saved successfully');
  };

  const loadFilter = (filter: SavedFilter) => {
    setSearchQuery(filter.filters.query || '');
    setSearchType(filter.type === 'loans' ? 'loans' : filter.type === 'customers' ? 'customers' : 'employees');
    setActiveFilters(filter.filters);
    toast.success(`Loaded filter: ${filter.name}`);
  };

  const clearFilters = () => {
    setActiveFilters({});
    setSearchQuery('');
    toast.success('Filters cleared');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
          <Search className="w-8 h-8 text-[#006BFF]" />
          Advanced Search & Filters
        </h1>
        <p className="text-neutral-600 mt-2">Search across loans, customers, and employees with advanced filters</p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Global Search</CardTitle>
          <CardDescription>Search across all entities in your system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
              <Input
                placeholder="Search loans, customers, employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
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
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>

          {/* Advanced Filters */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Advanced Filters
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={saveCurrentFilter}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Filter
                </Button>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>

            {searchType === 'all' || searchType === 'loans' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Status</Label>
                  <select
                    value={activeFilters.status || ''}
                    onChange={(e) => setActiveFilters({ ...activeFilters, status: e.target.value || undefined })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="active">Active</option>
                    <option value="settled">Settled</option>
                    <option value="defaulted">Defaulted</option>
                  </select>
                </div>
                <div>
                  <Label>Min Amount</Label>
                  <Input
                    type="number"
                    value={activeFilters.minAmount || ''}
                    onChange={(e) => setActiveFilters({ ...activeFilters, minAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="0"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Max Amount</Label>
                  <Input
                    type="number"
                    value={activeFilters.maxAmount || ''}
                    onChange={(e) => setActiveFilters({ ...activeFilters, maxAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="1000000"
                    className="mt-2"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Searches
              </h3>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="cursor-pointer hover:bg-neutral-100"
                    onClick={() => {
                      setSearchQuery(search);
                      handleSearch();
                    }}
                  >
                    {search}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Saved Filters */}
          {savedFilters.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Star className="w-4 h-4" />
                Saved Filters
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {savedFilters.map((filter) => (
                  <Card key={filter.id} className="cursor-pointer hover:bg-neutral-50" onClick={() => loadFilter(filter)}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{filter.name}</p>
                          <p className="text-xs text-neutral-500">{filter.type}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = savedFilters.filter(f => f.id !== filter.id);
                            setSavedFilters(updated);
                            localStorage.setItem('savedFilters', JSON.stringify(updated));
                            toast.success('Filter deleted');
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchQuery && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#006BFF]" />
            </div>
          ) : (
            <>
              {/* Loans Results */}
              {(searchType === 'all' || searchType === 'loans') && searchResults?.loans && searchResults.loans.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      Loans ({searchResults.loans.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Loan ID</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResults.loans.map((loan: any) => (
                          <TableRow key={loan.id}>
                            <TableCell className="font-mono text-sm">{loan.id.substring(0, 12)}...</TableCell>
                            <TableCell>{formatCurrency(Number(loan.amount || 0))}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{loan.status || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell>{formatDateSafe(loan.createdAt)}</TableCell>
                            <TableCell>
                              <Link to={`/admin/loans/${loan.id}`}>
                                <Button variant="ghost" size="sm">View</Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Customers Results */}
              {(searchType === 'all' || searchType === 'customers') && searchResults?.customers && searchResults.customers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Customers ({searchResults.customers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>NRC</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResults.customers.map((customer: any) => (
                          <TableRow key={customer.id}>
                            <TableCell className="font-semibold">
                              {customer.fullName || customer.name || 'N/A'}
                            </TableCell>
                            <TableCell>{customer.email || 'N/A'}</TableCell>
                            <TableCell>{customer.phone || 'N/A'}</TableCell>
                            <TableCell>{customer.nrcNumber || customer.nrc || 'N/A'}</TableCell>
                            <TableCell>
                              <Link to={`/admin/customers/${customer.id}`}>
                                <Button variant="ghost" size="sm">View</Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Employees Results */}
              {(searchType === 'all' || searchType === 'employees') && searchResults?.employees && searchResults.employees.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Employees ({searchResults.employees.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResults.employees.map((employee: any) => (
                          <TableRow key={employee.id}>
                            <TableCell className="font-semibold">{employee.name || 'N/A'}</TableCell>
                            <TableCell>{employee.email || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{employee.role || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell>
                              <Link to={`/admin/employees/${employee.id}`}>
                                <Button variant="ghost" size="sm">View</Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* No Results */}
              {searchResults && 
               (!searchResults.loans || searchResults.loans.length === 0) &&
               (!searchResults.customers || searchResults.customers.length === 0) &&
               (!searchResults.employees || searchResults.employees.length === 0) && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Search className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
                    <p className="text-neutral-600">No results found for "{searchQuery}"</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

