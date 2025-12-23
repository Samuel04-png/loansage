/**
 * Multi-Branch Management Page
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { Badge } from '../../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { Building2, Plus, Edit, Trash2, TrendingUp, Users, DollarSign, FileText, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createBranch,
  getBranches,
  updateBranch,
  deleteBranch,
  getBranchStatistics,
} from '../../../lib/branches/branch-manager';
import type { Branch } from '../../../types/features';
import { useFeatureGate } from '../../../hooks/useFeatureGate';
import { UpgradeModal } from '../../../components/pricing/UpgradeModal';

const branchSchema = z.object({
  name: z.string().min(2, 'Branch name is required'),
  code: z.string().min(2, 'Branch code is required'),
  address: z.string().min(5, 'Address is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email('Valid email is required'),
  managerId: z.string().optional(),
  isActive: z.boolean(),
});

type BranchFormData = z.infer<typeof branchSchema>;

export function BranchesPage() {
  const { profile } = useAuth();
  const { features, plan } = useFeatureGate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  
  const hasMultiBranch = features.multiBranch;

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      return getBranches(profile.agency_id);
    },
    enabled: !!profile?.agency_id,
  });

  const form = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: '',
      code: '',
      address: '',
      phone: '',
      email: '',
      managerId: '',
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: BranchFormData) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      return createBranch(profile.agency_id, {
        ...data,
        settings: {
          timezone: 'Africa/Lusaka',
          currency: 'ZMW',
          operatingHours: {},
        },
      });
    },
    onSuccess: () => {
      toast.success('Branch created successfully');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create branch');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Branch> }) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      return updateBranch(profile.agency_id, id, data);
    },
    onSuccess: () => {
      toast.success('Branch updated successfully');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setDialogOpen(false);
      setEditingBranch(null);
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update branch');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      return deleteBranch(profile.agency_id, id);
    },
    onSuccess: () => {
      toast.success('Branch deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete branch');
    },
  });

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    form.reset({
      name: branch.name,
      code: branch.code,
      address: branch.address,
      phone: branch.phone,
      email: branch.email,
      managerId: branch.managerId || '',
      isActive: branch.isActive,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: BranchFormData) => {
    if (editingBranch) {
      updateMutation.mutate({ id: editingBranch.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!hasMultiBranch) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Lock className="w-16 h-16 mx-auto mb-4 text-neutral-400" />
            <h2 className="text-2xl font-bold mb-2">Multi-Branch Support</h2>
            <p className="text-neutral-600 mb-6">
              This feature is available on the Enterprise plan. Upgrade to manage multiple branch locations.
            </p>
            <Button onClick={() => setUpgradeModalOpen(true)}>
              Upgrade to Enterprise
            </Button>
          </CardContent>
        </Card>
        <UpgradeModal
          open={upgradeModalOpen}
          onOpenChange={setUpgradeModalOpen}
          feature="Multi-Branch Support"
          currentPlan={plan}
          requiredPlan="enterprise"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Branches</h1>
          <p className="text-neutral-600 mt-1">Manage multiple branch locations</p>
        </div>
        <Button onClick={() => {
          setEditingBranch(null);
          form.reset();
          setDialogOpen(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          New Branch
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((branch) => (
          <BranchCard
            key={branch.id}
            branch={branch}
            agencyId={profile?.agency_id || ''}
            onEdit={handleEdit}
            onDelete={(id) => {
              if (confirm('Are you sure you want to delete this branch?')) {
                deleteMutation.mutate(id);
              }
            }}
          />
        ))}
        {branches.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <p className="text-neutral-500">No branches found. Create your first branch to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingBranch ? 'Edit Branch' : 'Create Branch'}
            </DialogTitle>
            <DialogDescription>
              Add a new branch location to your agency
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Branch Name *</Label>
                <Input {...form.register('name')} />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <Label>Branch Code *</Label>
                <Input {...form.register('code')} placeholder="e.g., BR001" />
                {form.formState.errors.code && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.code.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label>Address *</Label>
              <Input {...form.register('address')} />
              {form.formState.errors.address && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.address.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone *</Label>
                <Input {...form.register('phone')} />
                {form.formState.errors.phone && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.phone.message}</p>
                )}
              </div>

              <div>
                <Label>Email *</Label>
                <Input type="email" {...form.register('email')} />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Branch Active</Label>
              <Switch {...form.register('isActive')} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setEditingBranch(null);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingBranch ? 'Update Branch' : 'Create Branch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BranchCard({
  branch,
  agencyId,
  onEdit,
  onDelete,
}: {
  branch: Branch;
  agencyId: string;
  onEdit: (branch: Branch) => void;
  onDelete: (id: string) => void;
}) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['branch-stats', agencyId, branch.id],
    queryFn: async () => {
      if (!agencyId) return null;
      return getBranchStatistics(agencyId, branch.id);
    },
    enabled: !!agencyId,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {branch.name}
          </CardTitle>
          <Badge variant={branch.isActive ? 'default' : 'secondary'}>
            {branch.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <CardDescription>{branch.code}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <p className="text-neutral-600">{branch.address}</p>
          <p className="text-neutral-600">{branch.phone}</p>
          <p className="text-neutral-600">{branch.email}</p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 bg-neutral-200 rounded animate-pulse" />
            <div className="h-4 bg-neutral-200 rounded animate-pulse" />
          </div>
        ) : stats && (
          <div className="grid grid-cols-2 gap-2 pt-4 border-t">
            <div>
              <p className="text-xs text-neutral-500">Loans</p>
              <p className="font-semibold">{stats.totalLoans}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Customers</p>
              <p className="font-semibold">{stats.totalCustomers}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Revenue</p>
              <p className="font-semibold">{stats.totalRevenue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Default Rate</p>
              <p className="font-semibold">{(stats.defaultRate * 100).toFixed(1)}%</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={() => onEdit(branch)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDelete(branch.id)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

