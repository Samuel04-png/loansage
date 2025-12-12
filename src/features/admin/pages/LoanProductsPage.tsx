/**
 * Loan Products Page
 * Create and manage custom loan products
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
import { Plus, Edit, Trash2, Package, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createLoanProduct,
  getLoanProducts,
  updateLoanProduct,
  deleteLoanProduct,
  createDefaultLoanProducts,
} from '../../../lib/loan-products/product-builder';
import type { LoanProduct } from '../../../types/features';

const loanProductSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  interestRate: z.number().min(0).max(100, 'Interest rate must be between 0 and 100%'),
  minAmount: z.number().min(0, 'Minimum amount must be positive'),
  maxAmount: z.number().min(0, 'Maximum amount must be positive'),
  minDuration: z.number().min(1, 'Minimum duration must be at least 1 month'),
  maxDuration: z.number().min(1, 'Maximum duration must be at least 1 month'),
  gracePeriodDays: z.number().min(0).max(30, 'Grace period must be between 0 and 30 days'),
  lateFeeRate: z.number().min(0).max(10, 'Late fee rate must be between 0 and 10%'),
  maxLateFeeRate: z.number().min(0).max(50, 'Max late fee rate must be between 0 and 50%'),
  interestCalculationMethod: z.enum(['simple', 'compound']),
  requiresCollateral: z.boolean(),
  collateralTypes: z.array(z.string()),
  eligibilityCriteria: z.object({
    minCreditScore: z.number().optional(),
    minIncome: z.number().optional(),
    maxDebtToIncome: z.number().optional(),
  }).optional(),
  isActive: z.boolean(),
}).refine((data) => data.maxAmount >= data.minAmount, {
  message: 'Maximum amount must be greater than or equal to minimum amount',
  path: ['maxAmount'],
}).refine((data) => data.maxDuration >= data.minDuration, {
  message: 'Maximum duration must be greater than or equal to minimum duration',
  path: ['maxDuration'],
});

type LoanProductFormData = z.infer<typeof loanProductSchema>;

export function LoanProductsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LoanProduct | null>(null);
  const [collateralTypeInput, setCollateralTypeInput] = useState('');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['loan-products', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      return getLoanProducts(profile.agency_id);
    },
    enabled: !!profile?.agency_id,
  });

  const form = useForm<LoanProductFormData>({
    resolver: zodResolver(loanProductSchema),
    defaultValues: {
      name: '',
      description: '',
      interestRate: 15,
      minAmount: 1000,
      maxAmount: 100000,
      minDuration: 1,
      maxDuration: 12,
      gracePeriodDays: 3,
      lateFeeRate: 5,
      maxLateFeeRate: 20,
      interestCalculationMethod: 'simple',
      requiresCollateral: false,
      collateralTypes: [],
      eligibilityCriteria: {},
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: LoanProductFormData) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      return createLoanProduct(profile.agency_id, data);
    },
    onSuccess: () => {
      toast.success('Loan product created successfully');
      queryClient.invalidateQueries({ queryKey: ['loan-products'] });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create loan product');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<LoanProduct> }) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      return updateLoanProduct(profile.agency_id, id, data);
    },
    onSuccess: () => {
      toast.success('Loan product updated successfully');
      queryClient.invalidateQueries({ queryKey: ['loan-products'] });
      setDialogOpen(false);
      setEditingProduct(null);
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update loan product');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      return deleteLoanProduct(profile.agency_id, id);
    },
    onSuccess: () => {
      toast.success('Loan product deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['loan-products'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete loan product');
    },
  });

  const createDefaultsMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      return createDefaultLoanProducts(profile.agency_id);
    },
    onSuccess: () => {
      toast.success('Default loan products created');
      queryClient.invalidateQueries({ queryKey: ['loan-products'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create default products');
    },
  });

  const handleEdit = (product: LoanProduct) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      description: product.description,
      interestRate: product.interestRate,
      minAmount: product.minAmount,
      maxAmount: product.maxAmount,
      minDuration: product.minDuration,
      maxDuration: product.maxDuration,
      gracePeriodDays: product.gracePeriodDays,
      lateFeeRate: product.lateFeeRate,
      maxLateFeeRate: product.maxLateFeeRate,
      interestCalculationMethod: product.interestCalculationMethod,
      requiresCollateral: product.requiresCollateral,
      collateralTypes: product.collateralTypes,
      eligibilityCriteria: product.eligibilityCriteria,
      isActive: product.isActive,
    });
    setDialogOpen(true);
  };

  const handleAddCollateralType = () => {
    if (!collateralTypeInput.trim()) return;
    const currentTypes = form.getValues('collateralTypes');
    if (!currentTypes.includes(collateralTypeInput)) {
      form.setValue('collateralTypes', [...currentTypes, collateralTypeInput]);
    }
    setCollateralTypeInput('');
  };

  const handleRemoveCollateralType = (type: string) => {
    const currentTypes = form.getValues('collateralTypes');
    form.setValue('collateralTypes', currentTypes.filter(t => t !== type));
  };

  const onSubmit = (data: LoanProductFormData) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Loan Products</h1>
          <p className="text-neutral-600 mt-1">Create and manage custom loan products</p>
        </div>
        <div className="flex gap-2">
          {products.length === 0 && (
            <Button
              variant="outline"
              onClick={() => createDefaultsMutation.mutate()}
              disabled={createDefaultsMutation.isPending}
            >
              Create Default Products
            </Button>
          )}
          <Button onClick={() => {
            setEditingProduct(null);
            form.reset();
            setDialogOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            New Product
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Interest Rate</TableHead>
                <TableHead>Amount Range</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-neutral-500">{product.description}</p>
                    </div>
                  </TableCell>
                  <TableCell>{product.interestRate}%</TableCell>
                  <TableCell>
                    {product.minAmount.toLocaleString()} - {product.maxAmount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {product.minDuration}-{product.maxDuration} months
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.isActive ? 'default' : 'secondary'}>
                      {product.isActive ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this product?')) {
                            deleteMutation.mutate(product.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-neutral-500">
                    No loan products found. Create your first product to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Loan Product' : 'Create Loan Product'}
            </DialogTitle>
            <DialogDescription>
              Configure the terms and conditions for this loan product
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Product Name *</Label>
                <Input {...form.register('name')} />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <Label>Interest Rate (%) *</Label>
                <Input type="number" step="0.1" {...form.register('interestRate', { valueAsNumber: true })} />
                {form.formState.errors.interestRate && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.interestRate.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label>Description *</Label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...form.register('description')}
              />
              {form.formState.errors.description && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Minimum Amount *</Label>
                <Input type="number" {...form.register('minAmount', { valueAsNumber: true })} />
                {form.formState.errors.minAmount && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.minAmount.message}</p>
                )}
              </div>

              <div>
                <Label>Maximum Amount *</Label>
                <Input type="number" {...form.register('maxAmount', { valueAsNumber: true })} />
                {form.formState.errors.maxAmount && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.maxAmount.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Minimum Duration (months) *</Label>
                <Input type="number" {...form.register('minDuration', { valueAsNumber: true })} />
                {form.formState.errors.minDuration && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.minDuration.message}</p>
                )}
              </div>

              <div>
                <Label>Maximum Duration (months) *</Label>
                <Input type="number" {...form.register('maxDuration', { valueAsNumber: true })} />
                {form.formState.errors.maxDuration && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.maxDuration.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Grace Period (days)</Label>
                <Input type="number" {...form.register('gracePeriodDays', { valueAsNumber: true })} />
              </div>

              <div>
                <Label>Late Fee Rate (%)</Label>
                <Input type="number" step="0.1" {...form.register('lateFeeRate', { valueAsNumber: true })} />
              </div>

              <div>
                <Label>Max Late Fee Rate (%)</Label>
                <Input type="number" step="0.1" {...form.register('maxLateFeeRate', { valueAsNumber: true })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Interest Calculation Method *</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...form.register('interestCalculationMethod')}
                >
                  <option value="simple">Simple Interest</option>
                  <option value="compound">Compound Interest</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-6">
                <Label>Requires Collateral</Label>
                <Switch {...form.register('requiresCollateral')} />
              </div>
            </div>

            {form.watch('requiresCollateral') && (
              <div>
                <Label>Collateral Types</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Add collateral type (e.g., vehicle, property)"
                    value={collateralTypeInput}
                    onChange={(e) => setCollateralTypeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCollateralType();
                      }
                    }}
                  />
                  <Button type="button" onClick={handleAddCollateralType}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.watch('collateralTypes').map((type, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {type}
                      <button
                        type="button"
                        onClick={() => handleRemoveCollateralType(type)}
                        className="ml-1 hover:text-red-600"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Product Active</Label>
              <Switch {...form.register('isActive')} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setEditingProduct(null);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingProduct ? 'Update Product' : 'Create Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

