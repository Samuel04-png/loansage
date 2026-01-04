/**
 * Customer Details Drawer - Premium Slide-Over Panel
 * Shows customer details, active loans, collateral, and documents in tabs
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../../components/ui/sheet';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { EmptyState } from '../../../components/ui/empty-state';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { LoanStatusBadge } from '../../../components/loans/LoanStatusBadge';
import { motion } from 'framer-motion';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Briefcase, 
  FileText, 
  CreditCard, 
  Shield, 
  Calendar,
  Building2,
  DollarSign,
  Package,
  Clock,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface CustomerDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
}

export function CustomerDetailsDrawer({ open, onOpenChange, customerId }: CustomerDetailsDrawerProps) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch customer details
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer-details', customerId, profile?.agency_id],
    queryFn: async () => {
      if (!customerId || !profile?.agency_id) return null;
      
      const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', customerId);
      const customerSnap = await getDoc(customerRef);
      
      if (!customerSnap.exists()) return null;
      return { id: customerSnap.id, ...customerSnap.data() };
    },
    enabled: open && !!customerId && !!profile?.agency_id,
  });

  // Fetch customer's loans
  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ['customer-loans', customerId, profile?.agency_id],
    queryFn: async () => {
      if (!customerId || !profile?.agency_id) return [];
      
      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const q = firestoreQuery(loansRef, where('customerId', '==', customerId));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: open && !!customerId && !!profile?.agency_id,
  });

  // Fetch customer's collateral (across all loans)
  const { data: collateral, isLoading: collateralLoading } = useQuery({
    queryKey: ['customer-collateral', customerId, profile?.agency_id, loans],
    queryFn: async () => {
      if (!customerId || !profile?.agency_id || !loans?.length) return [];
      
      const allCollateral: any[] = [];
      
      for (const loan of loans) {
        const collateralRef = collection(db, 'agencies', profile.agency_id, 'loans', loan.id, 'collateral');
        const snapshot = await getDocs(collateralRef);
        
        snapshot.docs.forEach(doc => {
          allCollateral.push({ 
            id: doc.id, 
            loanId: loan.id,
            loanNumber: (loan as any).loanNumber || loan.id,
            ...doc.data() 
          });
        });
      }
      
      return allCollateral;
    },
    enabled: open && !!customerId && !!profile?.agency_id && !!loans?.length,
  });

  // Fetch customer's documents
  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ['customer-documents', customerId, profile?.agency_id],
    queryFn: async () => {
      if (!customerId || !profile?.agency_id) return [];
      
      const docsRef = collection(db, 'agencies', profile.agency_id, 'customers', customerId, 'documents');
      const snapshot = await getDocs(docsRef);
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: open && !!customerId && !!profile?.agency_id,
  });

  const getRiskColor = (score: number | null | undefined) => {
    if (score == null) return 'bg-slate-100 text-slate-600';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 60) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        {customerLoading ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : customer ? (
          <>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-gradient-to-br from-[#006BFF] to-[#4F46E5] text-white p-6">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-bold">
                    {(customer as any)?.fullName?.charAt(0)?.toUpperCase() || 'C'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold truncate">
                    {(customer as any)?.fullName || (customer as any)?.name || 'Customer'}
                  </h2>
                  <p className="text-white/80 text-sm truncate">
                    ID: {(customer as any)?.customerId || customer.id}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRiskColor((customer as any)?.riskScore)}`}>
                      Risk: {(customer as any)?.riskScore ?? 'N/A'}
                    </span>
                    {(customer as any)?.status === 'active' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white/70">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="sticky top-[152px] z-10 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                <TabsList className="w-full justify-start h-12 rounded-none bg-transparent p-0 px-2">
                  <TabsTrigger 
                    value="overview" 
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#006BFF] data-[state=active]:text-[#006BFF] rounded-none h-12 px-4"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger 
                    value="loans" 
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#006BFF] data-[state=active]:text-[#006BFF] rounded-none h-12 px-4"
                  >
                    Loans ({loans?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="collateral" 
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#006BFF] data-[state=active]:text-[#006BFF] rounded-none h-12 px-4"
                  >
                    Collateral ({collateral?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="documents" 
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#006BFF] data-[state=active]:text-[#006BFF] rounded-none h-12 px-4"
                  >
                    Docs ({documents?.length || 0})
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Overview Tab */}
              <TabsContent value="overview" className="p-6 space-y-6 mt-0">
                {/* Personal Info */}
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#006BFF]" />
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoItem icon={Phone} label="Phone" value={(customer as any)?.phone} />
                    <InfoItem icon={Mail} label="Email" value={(customer as any)?.email} />
                    <InfoItem icon={FileText} label="NRC" value={(customer as any)?.nrc || (customer as any)?.nrcNumber} />
                    <InfoItem icon={Calendar} label="Joined" value={formatDateSafe((customer as any)?.createdAt)} />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#006BFF]" />
                    Address
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                    {(customer as any)?.address || 'No address provided'}
                  </p>
                </div>

                {/* Employment */}
                {((customer as any)?.employer || (customer as any)?.employmentStatus) && (
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-[#006BFF]" />
                      Employment
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoItem icon={Building2} label="Employer" value={(customer as any)?.employer} />
                      <InfoItem icon={Briefcase} label="Status" value={(customer as any)?.employmentStatus} />
                      <InfoItem icon={DollarSign} label="Monthly Income" value={(customer as any)?.monthlyIncome ? formatCurrency((customer as any)?.monthlyIncome, 'ZMW') : undefined} />
                      <InfoItem icon={Clock} label="Duration" value={(customer as any)?.employmentDuration} />
                    </div>
                  </div>
                )}

                {/* Guarantor */}
                {(customer as any)?.guarantorName && (
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[#006BFF]" />
                      Guarantor
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoItem icon={User} label="Name" value={(customer as any)?.guarantorName} />
                      <InfoItem icon={Phone} label="Phone" value={(customer as any)?.guarantorPhone} />
                      <InfoItem icon={FileText} label="NRC" value={(customer as any)?.guarantorNRC} />
                      <InfoItem icon={User} label="Relationship" value={(customer as any)?.guarantorRelationship} />
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Active Loans Tab */}
              <TabsContent value="loans" className="p-6 mt-0">
                {loansLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                  </div>
                ) : loans && loans.length > 0 ? (
                  <div className="space-y-3">
                    {loans.map((loan: any, index: number) => (
                      <motion.div
                        key={loan.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Link 
                          to={`/employee/loans/${loan.id}`}
                          className="block p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {loan.loanNumber || loan.id}
                            </span>
                            <LoanStatusBadge status={loan.status} size="sm" />
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-neutral-500">{loan.loanType || 'Loan'}</span>
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {formatCurrency(loan.amount || 0, loan.currency || 'ZMW')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-neutral-400 mt-2">
                            <span>Created {formatDateSafe(loan.createdAt)}</span>
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<CreditCard className="w-10 h-10 mx-auto text-neutral-400" />}
                    title="No Loans"
                    description="This customer has no loan applications yet."
                  />
                )}
              </TabsContent>

              {/* Collateral Tab */}
              <TabsContent value="collateral" className="p-6 mt-0">
                {collateralLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                  </div>
                ) : collateral && collateral.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {collateral.map((item: any, index: number) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl"
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-neutral-900 dark:text-neutral-100">
                              {item.name || item.type || 'Collateral'}
                            </div>
                            <div className="text-sm text-neutral-500 mt-0.5">
                              Type: {item.type || 'Other'}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-neutral-400">
                                Loan: {item.loanNumber}
                              </span>
                              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                {formatCurrency(item.estimatedValue || 0, 'ZMW')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Package className="w-10 h-10 mx-auto text-neutral-400" />}
                    title="No Collateral"
                    description="No collateral assets registered for this customer."
                  />
                )}
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="p-6 mt-0">
                {documentsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : documents && documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc: any, index: number) => (
                      <motion.a
                        key={doc.id}
                        href={doc.fileURL || doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                            {doc.name || doc.type || 'Document'}
                          </div>
                          <div className="text-xs text-neutral-500">
                            Uploaded {formatDateSafe(doc.createdAt || doc.uploadedAt)}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-400" />
                      </motion.a>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<FileText className="w-10 h-10 mx-auto text-neutral-400" />}
                    title="No Documents"
                    description="No documents uploaded for this customer."
                  />
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="p-6">
            <EmptyState
              icon={<AlertCircle className="w-10 h-10 mx-auto text-neutral-400" />}
              title="Customer Not Found"
              description="Unable to load customer details."
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Helper component for info items
function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{label}</p>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {value || '-'}
        </p>
      </div>
    </div>
  );
}
