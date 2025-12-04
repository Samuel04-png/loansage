import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs, query as firestoreQuery, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Download, Calendar, DollarSign, FileText, Loader2 } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { downloadLoanSchedulePDF } from '../../../lib/pdf-generator';
import toast from 'react-hot-toast';

export function LoanOverviewPage() {
  const { loanId } = useParams<{ loanId: string }>();
  const { profile } = useAuth();

  const { data: loan, isLoading } = useQuery({
    queryKey: ['loan', loanId, profile?.agency_id],
    queryFn: async () => {
      if (!loanId || !profile?.agency_id) return null;

      const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId);
      const loanSnap = await getDoc(loanRef);
      
      if (!loanSnap.exists()) return null;

      const loanData = { id: loanSnap.id, ...loanSnap.data() };

      // Get customer info
      if (loanData.customerId) {
        const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', loanData.customerId);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
          loanData.customer = { id: customerSnap.id, ...customerSnap.data() };
        }
      }

      // Get repayments
      const repaymentsRef = collection(db, 'agencies', profile.agency_id, 'loans', loanId, 'repayments');
      const repaymentsSnapshot = await getDocs(repaymentsRef);
      loanData.repayments = repaymentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dueDate: doc.data().dueDate?.toDate?.() || doc.data().dueDate,
        paidAt: doc.data().paidAt?.toDate?.() || doc.data().paidAt,
      }));

      return loanData;
    },
    enabled: !!loanId && !!profile?.agency_id,
  });

  const calculateAmortization = () => {
    if (!loan) return [];

    const principal = Number(loan.amount || 0);
    const rate = Number(loan.interestRate || 0) / 100 / 12; // Monthly rate
    const months = Number(loan.durationMonths || 0);
    
    if (months === 0 || rate === 0) return [];

    const monthlyPayment = (principal * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
    const schedule = [];
    let remainingBalance = principal;

    for (let i = 0; i < months; i++) {
      const interestPayment = remainingBalance * rate;
      const principalPayment = monthlyPayment - interestPayment;
      remainingBalance -= principalPayment;

      schedule.push({
        month: i + 1,
        payment: monthlyPayment,
        principal: principalPayment,
        interest: interestPayment,
        balance: Math.max(0, remainingBalance),
      });
    }

    return schedule;
  };

  const amortizationSchedule = calculateAmortization();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Loan not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Loan Overview</h2>
        <p className="text-slate-600">Detailed information about your loan</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Loan Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-slate-600">Loan Number</span>
              <span className="font-semibold">{loan.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Status</span>
              <Badge variant={loan.status === 'active' ? 'success' : 'warning'}>
                {loan.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Loan Amount</span>
              <span className="font-semibold">{formatCurrency(Number(loan.amount || 0), 'ZMW')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Interest Rate</span>
              <span className="font-semibold">{loan.interestRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Duration</span>
              <span className="font-semibold">{loan.durationMonths} months</span>
            </div>
            {loan.disbursementDate && (
              <div className="flex justify-between">
                <span className="text-slate-600">Disbursement Date</span>
                <span className="font-semibold">
                  {formatDateSafe(loan.disbursementDate?.toDate?.() || loan.disbursementDate)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repayment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {amortizationSchedule.length > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-600">Monthly Payment</span>
                  <span className="font-semibold text-lg">
                    {formatCurrency(amortizationSchedule[0]?.payment || 0, 'ZMW')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Interest</span>
                  <span className="font-semibold">
                    {formatCurrency(
                      amortizationSchedule.reduce((sum, item) => sum + item.interest, 0),
                      'ZMW'
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Amount</span>
                  <span className="font-semibold">
                    {formatCurrency(
                      amortizationSchedule.reduce((sum, item) => sum + item.payment, 0),
                      'ZMW'
                    )}
                  </span>
                </div>
              </>
            )}
            <Button
              className="w-full mt-4"
              onClick={async () => {
                if (amortizationSchedule.length === 0) {
                  toast.error('No schedule available');
                  return;
                }
                try {
                  await downloadLoanSchedulePDF({
                    loanId: loan.id,
                    customerName: loan.customer?.fullName || 'Customer',
                    amount: Number(loan.amount || 0),
                    interestRate: Number(loan.interestRate || 0),
                    durationMonths: Number(loan.durationMonths || 0),
                    disbursementDate: loan.disbursementDate?.toDate?.() || new Date(),
                    schedule: amortizationSchedule,
                  });
                  toast.success('PDF downloaded successfully');
                } catch (error: any) {
                  console.error('PDF generation error:', error);
                  if (error.message?.includes('jsPDF')) {
                    toast.error('PDF generation requires jsPDF library');
                  } else {
                    toast.error('Failed to generate PDF');
                  }
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Schedule
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Repayment Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {amortizationSchedule.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left">Month</th>
                    <th className="px-4 py-3 text-right">Payment</th>
                    <th className="px-4 py-3 text-right">Principal</th>
                    <th className="px-4 py-3 text-right">Interest</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {amortizationSchedule.map((item) => (
                    <tr key={item.month} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3">{item.month}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(item.payment, 'ZMW')}
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.principal, 'ZMW')}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.interest, 'ZMW')}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.balance, 'ZMW')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">No schedule available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

