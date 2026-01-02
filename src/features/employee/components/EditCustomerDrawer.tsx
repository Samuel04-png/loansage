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
import { updateCustomer } from '../../../lib/firebase/firestore-helpers';
import { createAuditLog } from '../../../lib/firebase/firestore-helpers';
import toast from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';

const customerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  nrcNumber: z.string().min(5, 'NRC/ID number is required'),
  address: z.string().min(5, 'Address is required'),
  dateOfBirth: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

interface EditCustomerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  onSuccess?: () => void;
}

export function EditCustomerDrawer({ open, onOpenChange, customerId, onSuccess }: EditCustomerDrawerProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
  });

  // Load customer data when drawer opens
  useEffect(() => {
    if (open && customerId && profile?.agency_id) {
      setLoading(true);
      const loadCustomer = async () => {
        try {
          const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', customerId);
          const customerSnap = await getDoc(customerRef);
          
          if (customerSnap.exists()) {
            const data = customerSnap.data();
            setValue('fullName', data.fullName || '');
            setValue('phone', data.phone || '');
            setValue('email', data.email || '');
            setValue('nrcNumber', data.nrc || data.nrcNumber || '');
            setValue('address', data.address || '');
            setValue('dateOfBirth', data.dateOfBirth || data.date_of_birth || '');
          }
        } catch (error: any) {
          toast.error('Failed to load customer data');
        } finally {
          setLoading(false);
        }
      };
      loadCustomer();
    }
  }, [open, customerId, profile?.agency_id, setValue]);

  const updateCustomerMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (!profile?.agency_id || !user?.id) {
        throw new Error('Not authenticated');
      }

      // Update customer
      await updateCustomer(profile.agency_id, customerId, {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email || undefined,
        nrc: data.nrcNumber,
        address: data.address,
      });

      // Update date of birth if provided
      if (data.dateOfBirth) {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', customerId);
        await updateDoc(customerRef, {
          dateOfBirth: data.dateOfBirth,
          date_of_birth: data.dateOfBirth,
          updatedAt: serverTimestamp(),
        });
      }

      // Create audit log
      createAuditLog(profile.agency_id, {
        actorId: user.id,
        action: 'update_customer',
        targetCollection: 'customers',
        targetId: customerId,
        metadata: { fullName: data.fullName },
      }).catch(() => {});

      return { id: customerId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-customers'] });
      toast.success('Customer updated successfully');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update customer');
    },
  });

  const onSubmit = (data: CustomerFormData) => {
    updateCustomerMutation.mutate(data);
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
          <DrawerTitle>Edit Customer</DrawerTitle>
          <DrawerDescription>
            Update customer information
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
          </form>
        </DrawerBody>

        <DrawerFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={updateCustomerMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={updateCustomerMutation.isPending}
          >
            {updateCustomerMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Customer'
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
