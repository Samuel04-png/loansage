/**
 * Mobile Money Integration Page
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Smartphone, Link as LinkIcon, QrCode, CheckCircle2, Clock, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { createPaymentLink, getPaymentLinks, verifyPayment } from '../../../lib/payments/mobile-money';
import { useParams } from 'react-router-dom';

export function MobileMoneyPage() {
  const { profile } = useAuth();
  const { loanId } = useParams<{ loanId: string }>();
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<'mtn' | 'airtel' | 'zamtel'>('mtn');

  const { data: paymentLinks = [], isLoading } = useQuery({
    queryKey: ['payment-links', profile?.agency_id, loanId],
    queryFn: async () => {
      if (!profile?.agency_id || !loanId) return [];
      return getPaymentLinks(profile.agency_id, loanId);
    },
    enabled: !!profile?.agency_id && !!loanId,
  });

  const createLinkMutation = useMutation({
    mutationFn: async ({ amount, provider }: { amount: number; provider: 'mtn' | 'airtel' | 'zamtel' }) => {
      if (!profile?.agency_id || !loanId) throw new Error('Missing required data');
      // Get customer ID from loan
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/config');
      const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId);
      const loanSnap = await getDoc(loanRef);
      if (!loanSnap.exists()) throw new Error('Loan not found');
      const loanData = loanSnap.data();
      const customerId = loanData.customerId || loanData.customer_id;
      if (!customerId) throw new Error('Customer not found');
      
      return createPaymentLink(profile.agency_id, loanId, customerId, amount, provider);
    },
    onSuccess: () => {
      toast.success('Payment link created successfully');
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create payment link');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Mobile Money Payments</h1>
        <p className="text-neutral-600 mt-1">Create payment links for mobile money providers</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Create Payment Link
          </CardTitle>
          <CardDescription>
            Generate a payment link that customers can use to pay via mobile money
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Select Provider</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={selectedProvider === 'mtn' ? 'default' : 'outline'}
                onClick={() => setSelectedProvider('mtn')}
              >
                MTN Mobile Money
              </Button>
              <Button
                variant={selectedProvider === 'airtel' ? 'default' : 'outline'}
                onClick={() => setSelectedProvider('airtel')}
              >
                Airtel Money
              </Button>
              <Button
                variant={selectedProvider === 'zamtel' ? 'default' : 'outline'}
                onClick={() => setSelectedProvider('zamtel')}
              >
                Zamtel
              </Button>
            </div>
          </div>

          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              placeholder="Enter payment amount"
              id="payment-amount"
            />
          </div>

          <Button
            onClick={() => {
              const amountInput = document.getElementById('payment-amount') as HTMLInputElement;
              const amount = parseFloat(amountInput.value);
              if (!amount || amount <= 0) {
                toast.error('Please enter a valid amount');
                return;
              }
              createLinkMutation.mutate({ amount, provider: selectedProvider });
            }}
            disabled={createLinkMutation.isPending}
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Create Payment Link
          </Button>
        </CardContent>
      </Card>

      {paymentLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {paymentLinks.map((link) => (
                <div key={link.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{link.provider.toUpperCase()}</p>
                      <p className="text-sm text-neutral-500">
                        Amount: {link.amount.toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        link.status === 'paid'
                          ? 'default'
                          : link.status === 'expired'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {link.status === 'paid' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {link.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                      {link.status === 'expired' && <XCircle className="w-3 h-3 mr-1" />}
                      {link.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <a 
                      href={link.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-xl text-xs font-semibold h-10 md:h-9 px-3 min-h-[44px] md:min-h-0 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 text-neutral-900 dark:text-neutral-100 transition-all duration-300"
                    >
                      <LinkIcon className="w-4 h-4 mr-2" />
                      Open Link
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!profile?.agency_id) return;
                        const result = await verifyPayment(profile.agency_id, link.id);
                        if (result.paid) {
                          toast.success('Payment verified!');
                        } else {
                          toast.info('Payment not yet received');
                        }
                        queryClient.invalidateQueries({ queryKey: ['payment-links'] });
                      }}
                    >
                      Verify Payment
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

