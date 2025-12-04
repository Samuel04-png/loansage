import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { Plus, Search, MoreVertical, UserPlus, Loader2, Download, Upload, Eye } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { InviteEmployeeDrawer } from '../components/InviteEmployeeDrawer';
import { exportEmployees } from '../../../lib/data-export';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';

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

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'E';
  };

  return (
    <div className="space-y-6">
      {/* Header - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-1">Employees</h2>
          <p className="text-sm text-neutral-600">Manage your agency employees</p>
        </div>
        <div className="flex flex-wrap gap-3">
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
            className="rounded-xl border-neutral-200 hover:bg-neutral-50"
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
              className="rounded-xl border-neutral-200 hover:bg-neutral-50"
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
            className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Employee
          </Button>
        </div>
      </motion.div>

      {/* Search and Table - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
          <CardHeader className="pb-4 border-b border-neutral-200/50">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                placeholder="Search employees..."
                className="pl-9 rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredEmployees.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-neutral-200">
                    <TableHead className="font-semibold text-neutral-700">Employee</TableHead>
                    <TableHead className="font-semibold text-neutral-700">ID</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Department</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Category</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Status</TableHead>
                    <TableHead className="font-semibold text-neutral-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp: any, index: number) => (
                    <motion.tr
                      key={emp.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors"
                    >
                      <TableCell>
                        <Link to={`/admin/employees/${emp.id}`} className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-neutral-200">
                            <AvatarImage src={emp.avatar_url} />
                            <AvatarFallback className="bg-gradient-to-br from-[#006BFF] to-[#4F46E5] text-white text-xs font-semibold">
                              {getInitials(emp.name || 'Employee')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-neutral-900">
                              {emp.name || 'N/A'}
                            </div>
                            <div className="text-xs text-neutral-500">{emp.email}</div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium text-neutral-700">{emp.id}</TableCell>
                      <TableCell className="capitalize text-neutral-700">{emp.role?.replace('_', ' ') || '-'}</TableCell>
                      <TableCell>
                        <Badge className="bg-neutral-100 text-neutral-600 border-neutral-200">
                          {emp.employee_category?.replace('_', ' ') || emp.role || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {emp.status === 'active' ? (
                          <Badge className="bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20">Active</Badge>
                        ) : (
                          <Badge className="bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/admin/employees/${emp.id}`} className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-16 text-neutral-500">
                <UserPlus className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                <p className="text-lg font-medium mb-2">No employees found</p>
                <p className="text-sm text-neutral-400 mb-6">
                  {searchTerm ? 'Try adjusting your search terms' : 'Get started by inviting your first employee'}
                </p>
                {!searchTerm && (
                  <Button
                    onClick={() => setInviteDrawerOpen(true)}
                    className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite Employee
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

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

