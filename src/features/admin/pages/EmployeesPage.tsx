import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Plus, Search, MoreVertical, UserPlus, Loader2, Download, Upload } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { InviteEmployeeDrawer } from '../components/InviteEmployeeDrawer';
import { exportEmployees } from '../../../lib/data-export';

export function EmployeesPage() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: employees, isLoading, refetch } = useQuery({
    queryKey: ['employees', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const employeesRef = collection(db, 'agencies', profile.agency_id, 'employees');
      const snapshot = await getDocs(employeesRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id,
  });

  const filteredEmployees = employees?.filter((emp: any) =>
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.role?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Employees</h2>
          <p className="text-slate-600">Manage your agency employees</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (employees && employees.length > 0) {
                exportEmployees(employees);
                toast.success('Employees exported successfully');
              } else {
                toast.error('No employees to export');
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !profile?.agency_id || !user?.id) return;
                
                setImporting(true);
                try {
                  const { importEmployeesFromCSV } = await import('../../../lib/data-import');
                  const { createEmployee } = await import('../../../lib/firebase/firestore-helpers');
                  const { addCollateral } = await import('../../../lib/firebase/firestore-helpers');
                  
                  const result = await importEmployeesFromCSV(
                    file,
                    profile.agency_id,
                    user.id,
                    async (agencyId, data) => {
                      await createEmployee(agencyId, data);
                    },
                    async (agencyId, loanId, data) => {
                      await addCollateral(agencyId, loanId, data);
                    }
                  );
                  
                  if (result.success > 0) {
                    toast.success(`Successfully imported ${result.success} employees`);
                  }
                  if (result.failed > 0) {
                    toast.error(`Failed to import ${result.failed} employees`);
                  }
                  if (result.errors.length > 0 && result.errors.length <= 5) {
                    result.errors.forEach((error: string) => {
                      toast.error(error, { duration: 3000 });
                    });
                  }
                  refetch();
                } catch (error: any) {
                  toast.error(error.message || 'Failed to import employees');
                } finally {
                  setImporting(false);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="mr-2 h-4 w-4" />
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </div>
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setInviteDrawerOpen(true);
            }}
            type="button"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Employee
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="relative w-full max-w-md">
            <Input
              placeholder="Search employees..."
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
          ) : filteredEmployees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Employee</th>
                    <th className="px-6 py-3">ID</th>
                    <th className="px-6 py-3">Department</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp: any) => (
                    <tr key={emp.id} className="bg-white border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center mr-3">
                            <span className="text-xs font-bold text-slate-600">
                              {emp.name?.charAt(0) || 'E'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">
                              {emp.name || 'N/A'}
                            </div>
                            <div className="text-xs text-slate-500">{emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">{emp.id}</td>
                      <td className="px-6 py-4 capitalize">{emp.role?.replace('_', ' ') || '-'}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline">
                          {emp.role || '-'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {emp.status === 'active' ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link to={`/admin/employees/${emp.id}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              No employees found
            </div>
          )}
        </CardContent>
      </Card>

      <InviteEmployeeDrawer
        open={inviteDrawerOpen}
        onOpenChange={setInviteDrawerOpen}
        onSuccess={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['employees'] });
        }}
      />
    </div>
  );
}

