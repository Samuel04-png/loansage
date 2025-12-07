import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Search, Users, Loader2, UserPlus } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';

export function EmployeeCustomersPage() {
  const { profile, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Find employee by user ID
  const { data: employee } = useQuery({
    queryKey: ['employee-by-user', user?.id, profile?.agency_id],
    queryFn: async () => {
      if (!user?.id || !profile?.agency_id) return null;

      const employeesRef = collection(db, 'agencies', profile.agency_id, 'employees');
      const q = firestoreQuery(employeesRef, where('userId', '==', user.id));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    },
    enabled: !!user?.id && !!profile?.agency_id,
  });

  const { data: customers, isLoading } = useQuery({
    queryKey: ['employee-customers', employee?.id, profile?.agency_id],
    queryFn: async () => {
      if (!employee?.id || !profile?.agency_id) return [];

      const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
      const q = firestoreQuery(
        customersRef,
        where('officerId', '==', user?.id),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      }));
    },
    enabled: !!employee?.id && !!profile?.agency_id,
  });

  const filteredCustomers = customers?.filter((cust: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      cust.fullName?.toLowerCase().includes(search) ||
      cust.name?.toLowerCase().includes(search) ||
      cust.customerId?.toLowerCase().includes(search) ||
      cust.id?.toLowerCase().includes(search) ||
      cust.nrcNumber?.toLowerCase().includes(search) ||
      cust.nrc?.toLowerCase().includes(search) ||
      cust.email?.toLowerCase().includes(search) ||
      cust.phone?.toLowerCase().includes(search)
    );
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Customers</h2>
          <p className="text-slate-600">Manage your assigned customers</p>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="relative w-full max-w-md">
            <Input
              placeholder="Search customers..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : filteredCustomers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">ID</th>
                    <th className="px-6 py-3">NRC</th>
                    <th className="px-6 py-3">Risk Score</th>
                    <th className="px-6 py-3">KYC Status</th>
                    <th className="px-6 py-3">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((cust: any) => (
                    <tr
                      key={cust.id}
                      className="bg-white border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center mr-3">
                            <span className="text-xs font-bold text-slate-600">
                              {cust.fullName?.charAt(0) || cust.name?.charAt(0) || 'C'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">
                              {cust.fullName || cust.name || 'N/A'}
                            </div>
                            <div className="text-xs text-slate-500">{cust.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">{cust.customerId || cust.id}</td>
                      <td className="px-6 py-4">{cust.nrcNumber || cust.nrc || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div
                            className={`w-2 h-2 rounded-full mr-2 ${
                              (cust.riskScore || 50) >= 80
                                ? 'bg-emerald-500'
                                : (cust.riskScore || 50) >= 60
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                          ></div>
                          <span className="font-medium">{cust.riskScore || 50}/100</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {cust.kycStatus === 'verified' || cust.kycVerified ? (
                          <Badge variant="success">Verified</Badge>
                        ) : cust.kycStatus === 'pending' ? (
                          <Badge variant="warning">Pending</Badge>
                        ) : (
                          <Badge variant="destructive">Rejected</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {formatDateSafe(cust.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No customers assigned to you</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
