import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Calculator, Download } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { downloadLoanSchedulePDF } from '../../lib/pdf-generator';
import toast from 'react-hot-toast';

interface AmortizationRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export function LoanCalculator() {
  const [loanAmount, setLoanAmount] = useState<string>('100000');
  const [interestRate, setInterestRate] = useState<string>('15');
  const [durationMonths, setDurationMonths] = useState<string>('12');
  const [schedule, setSchedule] = useState<AmortizationRow[]>([]);
  const [calculated, setCalculated] = useState(false);

  const calculateAmortization = () => {
    const principal = parseFloat(loanAmount) || 0;
    const rate = (parseFloat(interestRate) || 0) / 100 / 12; // Monthly rate
    const months = parseInt(durationMonths) || 0;

    if (principal <= 0 || rate <= 0 || months <= 0) {
      setSchedule([]);
      setCalculated(false);
      return;
    }

    const monthlyPayment = (principal * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
    const newSchedule: AmortizationRow[] = [];
    let remainingBalance = principal;

    for (let i = 0; i < months; i++) {
      const interestPayment = remainingBalance * rate;
      const principalPayment = monthlyPayment - interestPayment;
      remainingBalance -= principalPayment;

      newSchedule.push({
        month: i + 1,
        payment: monthlyPayment,
        principal: principalPayment,
        interest: interestPayment,
        balance: Math.max(0, remainingBalance),
      });
    }

    setSchedule(newSchedule);
    setCalculated(true);
  };

  const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);
  const totalAmount = schedule.reduce((sum, row) => sum + row.payment, 0);
  const monthlyPayment = schedule.length > 0 ? schedule[0].payment : 0;

  const downloadPDF = async () => {
    if (schedule.length === 0) {
      toast.error('Please calculate the schedule first');
      return;
    }

    try {
      await downloadLoanSchedulePDF({
        loanId: 'CALC-' + Date.now(),
        customerName: 'Calculator Preview',
        amount: parseFloat(loanAmount) || 0,
        interestRate: parseFloat(interestRate) || 0,
        durationMonths: parseInt(durationMonths) || 0,
        disbursementDate: new Date(),
        schedule,
      });
      toast.success('PDF downloaded successfully');
    } catch (error: any) {
      console.error('PDF generation error:', error);
      if (error.message?.includes('jsPDF')) {
        toast.error('Please install jsPDF: npm install jspdf');
      } else {
        toast.error('Failed to generate PDF');
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Loan Calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="loanAmount">Loan Amount (ZMW)</Label>
              <Input
                id="loanAmount"
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder="100000"
              />
            </div>
            <div>
              <Label htmlFor="interestRate">Annual Interest Rate (%)</Label>
              <Input
                id="interestRate"
                type="number"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="15"
              />
            </div>
            <div>
              <Label htmlFor="durationMonths">Duration (Months)</Label>
              <Input
                id="durationMonths"
                type="number"
                value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)}
                placeholder="12"
              />
            </div>
          </div>
          <Button onClick={calculateAmortization} className="w-full">
            Calculate
          </Button>
        </CardContent>
      </Card>

      {calculated && schedule.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-slate-600">Monthly Payment</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(monthlyPayment, 'ZMW')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-slate-600">Total Interest</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(totalInterest, 'ZMW')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-slate-600">Total Amount</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(totalAmount, 'ZMW')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-slate-600">Loan Amount</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(parseFloat(loanAmount), 'ZMW')}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Amortization Schedule</CardTitle>
              <Button variant="outline" onClick={downloadPDF}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </CardHeader>
            <CardContent>
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
                    {schedule.map((row) => (
                      <tr key={row.month} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-3">{row.month}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(row.payment, 'ZMW')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(row.principal, 'ZMW')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(row.interest, 'ZMW')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(row.balance, 'ZMW')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

