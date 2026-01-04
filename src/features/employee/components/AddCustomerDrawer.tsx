import { useState } from 'react';
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
import { createCustomer } from '../../../lib/firebase/firestore-helpers';
import { generateCustomerId } from '../../../lib/firebase/helpers';
import { createAuditLog } from '../../../lib/firebase/firestore-helpers';
import toast from 'react-hot-toast';

const customerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  nrcNumber: z.string().min(5, 'NRC/ID number is required'),
  address: z.string().min(5, 'Address is required'),
  dateOfBirth: z.string().optional(),
  // Additional fields matching Admin form
  employer: z.string().optional(),
  employmentStatus: z.enum(['employed', 'self-employed', 'unemployed', 'retired', 'student']).optional(),
  monthlyIncome: z.string().optional(),
  jobTitle: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

interface AddCustomerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddCustomerDrawer({ open, onOpenChange, onSuccess }: AddCustomerDrawerProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      nrcNumber: '',
      address: '',
      dateOfBirth: '',
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (!profile?.agency_id || !user?.id) {
        throw new Error('Not authenticated');
      }

      // Generate customer ID
      const customerId = await generateCustomerId(profile.agency_id);

      // Create customer with all fields
      const customer = await createCustomer(profile.agency_id, {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email || undefined,
        nrc: data.nrcNumber,
        address: data.address,
        createdBy: user.id,
        employer: data.employer || undefined,
        employmentStatus: data.employmentStatus || undefined,
        monthlyIncome: data.monthlyIncome ? parseFloat(data.monthlyIncome) : undefined,
        jobTitle: data.jobTitle || undefined,
      });

      // Assign to current employee
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/config');
      const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', customer.id);
      await updateDoc(customerRef, {
        officerId: user.id,
        customerId: customerId || `CUST-${Date.now()}`,
        dateOfBirth: data.dateOfBirth || null,
        updatedAt: (await import('firebase/firestore')).serverTimestamp(),
      });

      // Create audit log
      createAuditLog(profile.agency_id, {
        actorId: user.id,
        action: 'create_customer',
        targetCollection: 'customers',
        targetId: customer.id,
        metadata: { fullName: data.fullName },
      }).catch(() => {});

      return customer;
    },
    onSuccess: () => {
      // Invalidate all relevant customer queries
      queryClient.invalidateQueries({ queryKey: ['employee-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer created successfully');
      reset();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create customer');
    },
  });

  const onSubmit = (data: CustomerFormData) => {
    createCustomerMutation.mutate(data);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle>Add New Customer</DrawerTitle>
          <DrawerDescription>
            Create a new customer profile and assign them to yourself
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  {...register('fullName')}
                  className={errors.fullName ? 'border-red-500' : ''}
                />
                {errors.fullName && (
                  <p className="text-sm text-red-600">{errors.fullName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+260 123 456 789"
                  {...register('phone')}
                  className={errors.phone ? 'border-red-500' : ''}
                />
                {errors.phone && (
                  <p className="text-sm text-red-600">{errors.phone.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  {...register('email')}
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nrcNumber">NRC Number *</Label>
                <Input
                  id="nrcNumber"
                  placeholder="123456/78/9"
                  {...register('nrcNumber')}
                  className={errors.nrcNumber ? 'border-red-500' : ''}
                />
                {errors.nrcNumber && (
                  <p className="text-sm text-red-600">{errors.nrcNumber.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                placeholder="Street address, City, Country"
                {...register('address')}
                className={errors.address ? 'border-red-500' : ''}
              />
              {errors.address && (
                <p className="text-sm text-red-600">{errors.address.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                {...register('dateOfBirth')}
              />
            </div>

            {/* Employment Information - Matching Admin Form */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-4">Employment Information (Optional)</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employmentStatus">Employment Status</Label>
                  <select
                    id="employmentStatus"
                    {...register('employmentStatus')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Select status</option>
                    <option value="employed">Employed</option>
                    <option value="self-employed">Self-Employed</option>
                    <option value="unemployed">Unemployed</option>
                    <option value="retired">Retired</option>
                    <option value="student">Student</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employer">Employer</Label>
                  <Input
                    id="employer"
                    placeholder="Company name"
                    {...register('employer')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title</Label>
                  <Input
                    id="jobTitle"
                    placeholder="Position"
                    {...register('jobTitle')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthlyIncome">Monthly Income (ZMW)</Label>
                  <Input
                    id="monthlyIncome"
                    type="number"
                    placeholder="0.00"
                    {...register('monthlyIncome')}
                  />
                </div>
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
            disabled={createCustomerMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={createCustomerMutation.isPending}
          >
            {createCustomerMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Customer'
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
