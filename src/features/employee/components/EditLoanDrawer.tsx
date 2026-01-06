import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter } from '../../../components/ui/drawer';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { updateLoan } from '../../../lib/firebase/loan-helpers';
import toast from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';

const loanSchema = z.object({
  amount: z.number().min(100, 'Minimum amount is 100'),
  interestRate: z.number().min(0).max(100, 'Interest rate cannot exceed 100%'),
  durationMonths: z.number().min(1).max(120, 'Duration cannot exceed 120 months'),
  repaymentFrequency: z.enum(['weekly', 'biweekly', 'monthly']),
});

type LoanFormData = z.infer<typeof loanSchema>;

interface EditLoanDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  onSuccess?: () => void;
}

export function EditLoanDrawer({ open, onOpenChange, loanId, onSuccess }: EditLoanDrawerProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
  });

  // Load loan data when drawer opens
  useEffect(() => {
    if (open && loanId && profile?.agency_id) {
      setLoading(true);
      const loadLoan = async () => {
        try {
          const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId);
          const loanSnap = await getDoc(loanRef);
          
          if (loanSnap.exists()) {
            const data = loanSnap.data();
            setValue('amount', data.amount || 0);
            setValue('interestRate', data.interestRate || data.interest_rate || 15);
            setValue('durationMonths', data.durationMonths || data.duration_months || 12);
            setValue('repaymentFrequency', (data.repaymentFrequency || data.repayment_frequency || 'monthly') as 'weekly' | 'biweekly' | 'monthly');
          }
        } catch (error: any) {
          toast.error('Failed to load loan data');
        } finally {
          setLoading(false);
        }
      };
      loadLoan();
    }
  }, [open, loanId, profile?.agency_id, setValue]);

  const updateLoanMutation = useMutation({
    mutationFn: async (data: LoanFormData) => {
      if (!profile?.agency_id || !user?.id) {
        throw new Error('Not authenticated');
      }

      await updateLoan(
        profile.agency_id,
        loanId,
        {
          amount: data.amount,
          interestRate: data.interestRate,
          durationMonths: data.durationMonths,
          repaymentFrequency: data.repaymentFrequency,
        },
        user.id,
        profile.employee_category || profile.role || 'employee'
      );
    },
    onSuccess: () => {
      // Invalidate all loan-related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['loan'] }); // All loan queries
      queryClient.invalidateQueries({ queryKey: ['employee-loans'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] }); // Admin loans page
      queryClient.invalidateQueries({ queryKey: ['customer-loans'] }); // Customer loans
      toast.success('Loan updated successfully');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update loan');
    },
  });

  const onSubmit = (data: LoanFormData) => {
    updateLoanMutation.mutate(data);
  };

  if (loading) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerBody className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle>Edit Loan</DrawerTitle>
          <DrawerDescription>
            Update loan terms and conditions
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Loan Amount (ZMW) *</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="10000"
                  {...register('amount', { valueAsNumber: true })}
                  className={errors.amount ? 'border-red-500' : ''}
                />
                {errors.amount && (
                  <p className="text-sm text-red-600">{errors.amount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="interestRate">Interest Rate (%) *</Label>
                <Input
                  id="interestRate"
                  type="number"
                  step="0.1"
                  placeholder="15.0"
                  {...register('interestRate', { valueAsNumber: true })}
                  className={errors.interestRate ? 'border-red-500' : ''}
                />
                {errors.interestRate && (
                  <p className="text-sm text-red-600">{errors.interestRate.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="durationMonths">Duration (Months) *</Label>
                <Input
                  id="durationMonths"
                  type="number"
                  placeholder="12"
                  {...register('durationMonths', { valueAsNumber: true })}
                  className={errors.durationMonths ? 'border-red-500' : ''}
                />
                {errors.durationMonths && (
                  <p className="text-sm text-red-600">{errors.durationMonths.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="repaymentFrequency">Repayment Frequency *</Label>
                <select
                  id="repaymentFrequency"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('repaymentFrequency')}
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                {errors.repaymentFrequency && (
                  <p className="text-sm text-red-600">{errors.repaymentFrequency.message}</p>
                )}
              </div>
            </div>
          </form>
        </DrawerBody>

        <DrawerFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={updateLoanMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={updateLoanMutation.isPending}
          >
            {updateLoanMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Loan'
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
