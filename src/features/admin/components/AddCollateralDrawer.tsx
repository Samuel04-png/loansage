import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter } from '../../../components/ui/drawer';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Loader2, Upload, X } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { createCollateral } from '../../../lib/firebase/firestore-helpers';
import { uploadCollateralPhoto } from '../../../lib/firebase/storage-helpers';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { formatCurrency } from '../../../lib/utils';

const collateralSchema = z.object({
  type: z.enum(['vehicle', 'land', 'property', 'equipment', 'electronics', 'jewelry', 'livestock', 'other']),
  description: z.string().min(5, 'Description is required'),
  estimatedValue: z.string().min(1, 'Estimated value is required').refine((val) => parseFloat(val) > 0, 'Value must be greater than 0'),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.string().optional(),
  serialNumber: z.string().optional(),
  condition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  location: z.string().optional(),
  customerId: z.string().optional(),
  loanId: z.string().optional(),
});

type CollateralFormData = z.infer<typeof collateralSchema>;

interface AddCollateralDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialCustomerId?: string;
  initialLoanId?: string;
}

export function AddCollateralDrawer({ 
  open, 
  onOpenChange, 
  onSuccess,
  initialCustomerId,
  initialLoanId,
}: AddCollateralDrawerProps) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  // Fetch customers for selection
  const { data: customers = [] } = useQuery({
    queryKey: ['customers', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
      const snapshot = await getDocs(customersRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id && open,
  });

  // Fetch loans for selection
  const { data: loans = [] } = useQuery({
    queryKey: ['loans', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const snapshot = await getDocs(loansRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id && open,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<CollateralFormData>({
    resolver: zodResolver(collateralSchema),
    defaultValues: {
      type: 'other',
      condition: 'good',
      customerId: initialCustomerId,
      loanId: initialLoanId,
    },
  });

  const selectedLoanId = watch('loanId');

  const handleFileChange = (files: FileList | null) => {
    if (!files) return;
    setPhotoFiles((prev) => [...prev, ...Array.from(files)]);
  };

  const removeFile = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: CollateralFormData) => {
    if (!profile?.agency_id || !user?.id) {
      toast.error('Agency information not available');
      return;
    }

    setLoading(true);
    try {
      const photoURLs: string[] = [];

      // Upload photos (skip on Spark plan)
      for (const file of photoFiles) {
        try {
          const { isSparkPlan } = await import('../../../lib/firebase/config');
          if (isSparkPlan) {
            console.info('Skipping photo upload - Spark plan');
          } else {
            const photoURL = await uploadCollateralPhoto(
              profile.agency_id,
              selectedLoanId || 'standalone',
              'temp',
              file
            );
            photoURLs.push(photoURL);
          }
        } catch (error: any) {
          console.warn('Failed to upload photo:', error);
        }
      }

      // Create collateral in registry
      await createCollateral(profile.agency_id, {
        type: data.type,
        description: data.description,
        estimatedValue: parseFloat(data.estimatedValue),
        photos: photoURLs,
        brand: data.brand || undefined,
        model: data.model || undefined,
        year: data.year ? parseInt(data.year) : undefined,
        serialNumber: data.serialNumber || undefined,
        condition: data.condition || 'good',
        location: data.location || undefined,
        ownerCustomerId: data.customerId || undefined,
        loanId: data.loanId || undefined,
      });

      toast.success('Collateral created successfully!');
      reset();
      setPhotoFiles([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating collateral:', error);
      toast.error(error.message || 'Failed to create collateral');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} size="lg">
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add New Collateral</DrawerTitle>
          <DrawerDescription>
            Register a new collateral item in the system
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <form id="collateral-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Collateral Type *</Label>
                <select
                  id="type"
                  {...register('type')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                >
                  <option value="vehicle">Vehicle</option>
                  <option value="land">Land</option>
                  <option value="property">Property</option>
                  <option value="equipment">Equipment</option>
                  <option value="electronics">Electronics</option>
                  <option value="jewelry">Jewelry</option>
                  <option value="livestock">Livestock</option>
                  <option value="other">Other</option>
                </select>
                {errors.type && (
                  <p className="text-sm text-red-600 mt-1">{errors.type.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="estimatedValue">Estimated Value (ZMW) *</Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('estimatedValue')}
                  className={errors.estimatedValue ? 'border-red-500' : ''}
                />
                {errors.estimatedValue && (
                  <p className="text-sm text-red-600 mt-1">{errors.estimatedValue.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Detailed description of the collateral..."
                rows={3}
                {...register('description')}
                className={errors.description ? 'border-red-500' : ''}
              />
              {errors.description && (
                <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="brand">Brand (Optional)</Label>
                <Input
                  id="brand"
                  placeholder="e.g., Toyota, Samsung"
                  {...register('brand')}
                />
              </div>

              <div>
                <Label htmlFor="model">Model (Optional)</Label>
                <Input
                  id="model"
                  placeholder="e.g., Corolla, Galaxy S21"
                  {...register('model')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="year">Year (Optional)</Label>
                <Input
                  id="year"
                  type="number"
                  placeholder="2020"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  {...register('year')}
                />
              </div>

              <div>
                <Label htmlFor="condition">Condition</Label>
                <select
                  id="condition"
                  {...register('condition')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>

              <div>
                <Label htmlFor="serialNumber">Serial Number (Optional)</Label>
                <Input
                  id="serialNumber"
                  placeholder="Serial/Registration number"
                  {...register('serialNumber')}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location">Location (Optional)</Label>
              <Input
                id="location"
                placeholder="e.g., Lusaka, Ndola"
                {...register('location')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customerId">Owner Customer (Optional)</Label>
                <select
                  id="customerId"
                  {...register('customerId')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                >
                  <option value="">Select customer</option>
                  {customers.map((customer: any) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.fullName || customer.name || customer.id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="loanId">Linked Loan (Optional)</Label>
                <select
                  id="loanId"
                  {...register('loanId')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                >
                  <option value="">Select loan</option>
                  {loans.map((loan: any) => (
                    <option key={loan.id} value={loan.id}>
                      Loan {loan.id.substring(0, 8)} - {formatCurrency(Number(loan.amount || 0), 'ZMW')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label>Photos (Optional)</Label>
              <div className="mt-2 space-y-2">
                {photoFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                    <span className="text-sm flex-1 truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                  <Upload className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-xs text-slate-500">Upload Photos</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileChange(e.target.files)}
                  />
                </label>
              </div>
            </div>
          </form>
        </DrawerBody>
        <DrawerFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              setPhotoFiles([]);
              onOpenChange(false);
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="collateral-form"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Collateral'
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

