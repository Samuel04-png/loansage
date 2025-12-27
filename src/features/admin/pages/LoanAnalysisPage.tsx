/**
 * Comprehensive Loan Analysis Page
 * Combines all analysis features in one place
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Badge } from '../../../components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { RiskAssessmentCard } from '../../../components/loan/RiskAssessmentCard';
import { ProfitProjectionCard } from '../../../components/loan/ProfitProjectionCard';
import { LoanPlanComparison } from '../../../components/loan/LoanPlanComparison';
import { runStressTests } from '../../../lib/ai/loan-stress-test';
import { generateLoanSummary } from '../../../lib/ai/loan-summary-generator';
import { downloadLoanSummaryPDF } from '../../../lib/pdf-generator';
import { Button } from '../../../components/ui/button';
import { FileDown } from 'lucide-react';
import toast from 'react-hot-toast';

export function LoanAnalysisPage() {
  const { loanId } = useParams<{ loanId: string }>();
  const { profile } = useAuth();
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Fetch loan data
  const { data: loan, isLoading } = useQuery({
    queryKey: ['loan-analysis', profile?.agency_id, loanId],
    queryFn: async () => {
      if (!profile?.agency_id || !loanId) return null;
      const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId);
      const loanSnap = await getDoc(loanRef);
      if (!loanSnap.exists()) return null;
      return { id: loanSnap.id, ...loanSnap.data() };
    },
    enabled: !!profile?.agency_id && !!loanId,
  });

  // Fetch customer data
  const { data: customer } = useQuery({
    queryKey: ['customer-for-loan', profile?.agency_id, loan?.customerId],
    queryFn: async () => {
      if (!profile?.agency_id || !loan?.customerId) return null;
      const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', loan.customerId);
      const customerSnap = await getDoc(customerRef);
      if (!customerSnap.exists()) return null;
      return { id: customerSnap.id, ...customerSnap.data() };
    },
    enabled: !!profile?.agency_id && !!loan?.customerId,
  });

  const handleGeneratePDF = async () => {
    if (!loan || !customer) return;
    
    setGeneratingPDF(true);
    try {
      const summary = await generateLoanSummary({
        agencyId: profile?.agency_id,
        borrower: {
          name: customer.fullName || customer.name,
          nrc: customer.nrc || '',
          phone: customer.phone || '',
          email: customer.email,
          age: customer.age,
          monthlyIncome: customer.monthlyIncome,
          monthlyExpenses: customer.monthlyExpenses,
          employmentStatus: customer.employmentStatus,
          employmentStability: customer.employmentStability,
        },
        loan: {
          id: loan.id,
          amount: loan.amount,
          interestRate: loan.interestRate,
          durationMonths: loan.durationMonths,
          loanType: loan.loanType,
          disbursementDate: loan.disbursementDate?.toDate?.() || new Date(),
        },
        history: loan.customerHistory,
        collateral: loan.collateral?.[0] ? {
          type: loan.collateral[0].type,
          description: loan.collateral[0].description,
          estimatedValue: loan.collateral[0].value,
        } : undefined,
      });

      await downloadLoanSummaryPDF({
        borrower: summary.borrowerSummary,
        loan: summary.recommendedLoan,
        riskAnalysis: summary.riskAnalysis,
        collateralAnalysis: summary.collateralAnalysis,
        profitProjection: summary.profitProjection,
        recommendation: summary.recommendation,
        executiveSummary: summary.executiveSummary,
        schedule: [],
      } as any);

      toast.success('PDF generated successfully!');
    } catch (error: any) {
      toast.error('Failed to generate PDF: ' + error.message);
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!loan || !customer) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">Loan not found</p>
        </CardContent>
      </Card>
    );
  }

  const riskFactors = {
    nrc: customer.nrc,
    phoneNumber: customer.phone,
    customerHistory: loan.customerHistory,
    loanDetails: {
      amount: loan.amount,
      interestRate: loan.interestRate,
      durationMonths: loan.durationMonths,
      loanType: loan.loanType,
    },
    customerProfile: {
      monthlyIncome: customer.monthlyIncome,
      monthlyExpenses: customer.monthlyExpenses,
      employmentStatus: customer.employmentStatus,
      employmentStability: customer.employmentStability,
      age: customer.age,
    },
    collateral: loan.collateral?.[0] ? {
      value: loan.collateral[0].value,
      type: loan.collateral[0].type,
      verificationStatus: loan.collateral[0].status,
    } : undefined,
  };

  const profitInput = {
    principal: loan.amount,
    interestRate: loan.interestRate,
    durationMonths: loan.durationMonths,
    collateralValue: loan.collateral?.[0]?.value,
  };

  const planComparisonInput = {
    requestedAmount: loan.amount,
    monthlyIncome: customer.monthlyIncome || 0,
    monthlyExpenses: customer.monthlyExpenses || 0,
    riskScore: loan.riskScore || 50,
    creditHistory: loan.customerHistory,
    collateralValue: loan.collateral?.[0]?.value,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Loan Analysis</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive risk assessment and profitability analysis
          </p>
        </div>
        <Button onClick={handleGeneratePDF} disabled={generatingPDF}>
          {generatingPDF ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileDown className="mr-2 h-4 w-4" />
              Generate PDF Report
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="risk" className="space-y-4">
        <TabsList>
          <TabsTrigger value="risk">Risk Assessment</TabsTrigger>
          <TabsTrigger value="profit">Profit Projection</TabsTrigger>
          <TabsTrigger value="plans">Loan Plans</TabsTrigger>
          <TabsTrigger value="stress">Stress Testing</TabsTrigger>
          <TabsTrigger value="summary">AI Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="risk">
          <RiskAssessmentCard riskFactors={riskFactors} />
        </TabsContent>

        <TabsContent value="profit">
          <ProfitProjectionCard input={profitInput} />
        </TabsContent>

        <TabsContent value="plans">
          <LoanPlanComparison input={planComparisonInput} />
        </TabsContent>

        <TabsContent value="stress">
          <StressTestTab loan={loan} customer={customer} />
        </TabsContent>

        <TabsContent value="summary">
          <LoanSummaryTab loan={loan} customer={customer} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StressTestTab({ loan, customer }: any) {
  const [stressResults, setStressResults] = useState<any>(null);

  const runStressTest = () => {
    const results = runStressTests({
      principal: loan.amount,
      interestRate: loan.interestRate,
      durationMonths: loan.durationMonths,
      collateralValue: loan.collateral?.[0]?.value,
      monthlyIncome: customer.monthlyIncome,
      monthlyExpenses: customer.monthlyExpenses,
    });
    setStressResults(results);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan Stress Testing</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={runStressTest} className="mb-4">
          Run Stress Tests
        </Button>
        {stressResults && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="font-semibold mb-2">Overall Risk: {stressResults.overallRisk.toUpperCase()}</p>
              <p className="text-sm text-gray-700">{stressResults.summary}</p>
            </div>
            {stressResults.stressTests.map((test: any, idx: number) => (
              <Card key={idx}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold">{test.factor.name}</p>
                      <p className="text-sm text-gray-600">{test.factor.description}</p>
                    </div>
                    <Badge className={
                      test.factor.severity === 'critical' ? 'bg-red-600' :
                      test.factor.severity === 'high' ? 'bg-orange-600' :
                      test.factor.severity === 'medium' ? 'bg-yellow-600' :
                      'bg-green-600'
                    }>
                      {test.factor.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-gray-600">Impact on Profit</p>
                      <p className="font-semibold">
                        {test.impact.onProfit >= 0 ? '+' : ''}{test.impact.onProfit.toLocaleString()} ZMW
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Default Risk Change</p>
                      <p className="font-semibold">
                        {test.impact.onDefault >= 0 ? '+' : ''}{(test.impact.onDefault * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  {test.warnings.length > 0 && (
                    <div className="mt-3 p-2 bg-yellow-50 rounded text-sm text-yellow-800">
                      {test.warnings[0]}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoanSummaryTab({ loan, customer }: any) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();

  const generateSummary = async () => {
    setLoading(true);
    try {
      const result = await generateLoanSummary({
        agencyId: profile?.agency_id,
        borrower: {
          name: customer.fullName || customer.name,
          nrc: customer.nrc || '',
          phone: customer.phone || '',
          email: customer.email,
          age: customer.age,
          monthlyIncome: customer.monthlyIncome,
          monthlyExpenses: customer.monthlyExpenses,
          employmentStatus: customer.employmentStatus,
          employmentStability: customer.employmentStability,
        },
        loan: {
          id: loan.id,
          amount: loan.amount,
          interestRate: loan.interestRate,
          durationMonths: loan.durationMonths,
          loanType: loan.loanType,
          disbursementDate: loan.disbursementDate?.toDate?.() || new Date(),
        },
        history: loan.customerHistory,
      });
      setSummary(result);
    } catch (error: any) {
      toast.error('Failed to generate summary: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Loan Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={generateSummary} disabled={loading} className="mb-4">
          {loading ? 'Generating...' : 'Generate AI Summary'}
        </Button>
        {summary && (
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="font-semibold mb-2">Executive Summary</p>
              <p className="text-sm">{summary.executiveSummary}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Risk Score</p>
                <p className="text-2xl font-bold">{summary.riskAnalysis.riskScore}/100</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Recommendation</p>
                <p className="text-lg font-semibold">{summary.recommendation.decision.toUpperCase()}</p>
              </div>
            </div>
            <div>
              <p className="font-semibold mb-2">Recommendation Reasoning</p>
              <p className="text-sm text-gray-700">{summary.recommendation.reasoning}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

