import { useQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { useAgency } from '../../../hooks/useAgency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { History, CreditCard, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Skeleton } from '../../../components/ui/skeleton';
import { CheckoutButton } from '../../../components/stripe/CheckoutButton';

export function PaymentHistoryTab() {
  const { profile } = useAuth();
  const { agency } = useAgency();

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payment-history', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const paymentsRef = collection(db, 'agencies', profile.agency_id, 'payments');
      const q = query(paymentsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      }));
    },
    enabled: !!profile?.agency_id,
  });

  const totalPaid = payments.reduce((sum: number, p: any) => 
    sum + (p.status === 'succeeded' ? Number(p.amount || 0) : 0), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#006BFF]" />
            Subscription & Payments
          </CardTitle>
          <CardDescription>Manage your subscription and view payment history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-neutral-50 rounded-lg">
              <p className="text-sm text-neutral-500 mb-1">Current Plan</p>
              <p className="text-2xl font-bold text-neutral-900">
                {agency?.plan ? agency.plan.charAt(0).toUpperCase() + agency.plan.slice(1) : 'Starter'}
              </p>
              <p className="text-sm text-neutral-500 mt-1">
                {agency?.plan === 'starter' 
                  ? '$15/month' 
                  : agency?.plan === 'enterprise'
                  ? '$499.99/month'
                  : '$35/month'}
              </p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-lg">
              <p className="text-sm text-neutral-500 mb-1">Total Paid</p>
              <p className="text-2xl font-bold text-neutral-900">{formatCurrency(totalPaid / 100)}</p>
              <p className="text-sm text-neutral-500 mt-1">{payments.length} payment{payments.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-lg">
              <p className="text-sm text-neutral-500 mb-1">Status</p>
              <p className="text-2xl font-bold text-green-600">Active</p>
              <p className="text-sm text-neutral-500 mt-1">Next billing: Next month</p>
            </div>
          </div>
          
          <CheckoutButton className="w-full">
            Update Payment Method
          </CheckoutButton>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#006BFF]" />
            Payment History
          </CardTitle>
          <CardDescription>View all your past payments and transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">No payment history</h3>
              <p className="text-neutral-500 mb-4">Your payment history will appear here</p>
              <CheckoutButton>Subscribe Now</CheckoutButton>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment: any) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      payment.status === 'succeeded' ? 'bg-green-100' : 
                      payment.status === 'pending' ? 'bg-yellow-100' : 
                      'bg-red-100'
                    }`}>
                      <CreditCard className={`w-6 h-6 ${
                        payment.status === 'succeeded' ? 'text-green-600' : 
                        payment.status === 'pending' ? 'text-yellow-600' : 
                        'text-red-600'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-neutral-900">
                          {payment.description || 'Subscription Payment'}
                        </p>
                        {getStatusBadge(payment.status)}
                      </div>
                      <p className="text-sm text-neutral-500">
                        {formatDateSafe(payment.createdAt)}
                        {payment.invoiceId && ` • Invoice: ${payment.invoiceId}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-neutral-900">
                      {formatCurrency((payment.amount || 0) / 100)}
                    </p>
                    {payment.receiptUrl && (
                      <a
                        href={payment.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#006BFF] hover:underline"
                      >
                        View Receipt
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

