import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Badge } from './ui/Base';
import { User, DollarSign, Calendar, Upload, CheckCircle2, ChevronRight, ChevronLeft, Loader2, AlertCircle, FileText } from 'lucide-react';
import { MOCK_BORROWERS } from '../constants';
import { Borrower, Loan, LoanStatus } from '../types';
import { analyzeLoanRisk } from '../services/aiService';

export const LoanFactory = () => {
  const [step, setStep] = useState(1);
  const [selectedBorrower, setSelectedBorrower] = useState<string>('');
  const [loanDetails, setLoanDetails] = useState({
    amount: '',
    duration: '',
    purpose: '',
    collateralType: 'VEHICLE',
    collateralValue: '',
    collateralDesc: ''
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const borrowers = MOCK_BORROWERS;
  const currentBorrower = borrowers.find(b => b.id === selectedBorrower);

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleRunAnalysis = async () => {
    if (!currentBorrower) return;
    setIsAnalyzing(true);
    
    // Construct a temporary loan object for analysis
    const tempLoan: Loan = {
        id: 'temp',
        borrowerId: currentBorrower.id,
        borrowerName: currentBorrower.name,
        amount: Number(loanDetails.amount),
        currency: 'ZMW',
        interestRate: 15,
        durationMonths: Number(loanDetails.duration),
        startDate: new Date().toISOString(),
        status: LoanStatus.PENDING,
        collateral: [{
            id: 'temp_col',
            type: loanDetails.collateralType as any,
            description: loanDetails.collateralDesc,
            value: Number(loanDetails.collateralValue),
            currency: 'ZMW',
            status: 'PENDING'
        }],
        repaymentProgress: 0,
        tenantId: 'tenant_A'
    };

    const result = await analyzeLoanRisk(tempLoan, currentBorrower);
    setAiAnalysis(result);
    setIsAnalyzing(false);
    handleNext(); // Move to review step
  };

  const StepIndicator = ({ num, active }: { num: number, active: boolean }) => (
    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-colors ${active ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
        {num}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex items-center justify-between px-12">
        <StepIndicator num={1} active={step >= 1} />
        <div className={`flex-1 h-0.5 mx-2 ${step >= 2 ? 'bg-primary-600' : 'bg-slate-200'}`} />
        <StepIndicator num={2} active={step >= 2} />
        <div className={`flex-1 h-0.5 mx-2 ${step >= 3 ? 'bg-primary-600' : 'bg-slate-200'}`} />
        <StepIndicator num={3} active={step >= 3} />
        <div className={`flex-1 h-0.5 mx-2 ${step >= 4 ? 'bg-primary-600' : 'bg-slate-200'}`} />
        <StepIndicator num={4} active={step >= 4} />
      </div>

      <Card className="shadow-lg border-0 ring-1 ring-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle>
                {step === 1 && "Select Borrower"}
                {step === 2 && "Loan Parameters"}
                {step === 3 && "Collateral & Assets"}
                {step === 4 && "AI Underwriting & Review"}
            </CardTitle>
        </CardHeader>
        <CardContent className="p-6 min-h-[400px]">
            {/* STEP 1: BORROWER */}
            {step === 1 && (
                <div className="space-y-4">
                    <Label>Find Customer</Label>
                    <Input placeholder="Search by name or NRC..." className="mb-4" />
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {borrowers.map(b => (
                            <div 
                                key={b.id} 
                                onClick={() => setSelectedBorrower(b.id)}
                                className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${selectedBorrower === b.id ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                            >
                                <div className="flex items-center">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold mr-3">
                                        {b.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">{b.name}</p>
                                        <p className="text-xs text-slate-500">{b.nrcNumber}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <Badge variant={b.riskScore > 80 ? 'success' : 'warning'}>Score: {b.riskScore}</Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* STEP 2: LOAN DETAILS */}
            {step === 2 && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Amount Requested (ZMW)</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input 
                                    type="number" 
                                    className="pl-9" 
                                    placeholder="50000"
                                    value={loanDetails.amount}
                                    onChange={e => setLoanDetails({...loanDetails, amount: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Duration (Months)</Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input 
                                    type="number" 
                                    className="pl-9" 
                                    placeholder="12"
                                    value={loanDetails.duration}
                                    onChange={e => setLoanDetails({...loanDetails, duration: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Purpose of Loan</Label>
                        <select 
                            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                            value={loanDetails.purpose}
                            onChange={e => setLoanDetails({...loanDetails, purpose: e.target.value})}
                        >
                            <option value="">Select purpose...</option>
                            <option value="BUSINESS">Business Expansion</option>
                            <option value="SCHOOL">School Fees</option>
                            <option value="AGRICULTURE">Agriculture / Farming</option>
                            <option value="PERSONAL">Personal Emergency</option>
                        </select>
                    </div>
                    
                    {loanDetails.amount && loanDetails.duration && (
                         <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mt-4">
                            <h4 className="text-sm font-semibold text-slate-900 mb-2">Preliminary Repayment Schedule</h4>
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>Monthly Installment:</span>
                                <span className="font-bold">ZMW {((Number(loanDetails.amount) * 1.15) / Number(loanDetails.duration)).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600 mt-1">
                                <span>Total Repayment:</span>
                                <span className="font-bold">ZMW {(Number(loanDetails.amount) * 1.15).toFixed(2)}</span>
                            </div>
                         </div>
                    )}
                </div>
            )}

            {/* STEP 3: COLLATERAL */}
            {step === 3 && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <Label>Collateral Type</Label>
                            <select 
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-950"
                                value={loanDetails.collateralType}
                                onChange={e => setLoanDetails({...loanDetails, collateralType: e.target.value})}
                            >
                                <option value="VEHICLE">Vehicle</option>
                                <option value="PROPERTY">Property / Land</option>
                                <option value="ELECTRONICS">Electronics</option>
                                <option value="JEWELRY">Jewelry</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Estimated Value (ZMW)</Label>
                            <Input 
                                type="number" 
                                placeholder="120000"
                                value={loanDetails.collateralValue}
                                onChange={e => setLoanDetails({...loanDetails, collateralValue: e.target.value})}
                            />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>Description & Details</Label>
                        <textarea 
                            className="w-full rounded-md border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-950" 
                            rows={3} 
                            placeholder="e.g. Toyota Corolla 2015, Silver, Reg # ABC 123..."
                            value={loanDetails.collateralDesc}
                            onChange={e => setLoanDetails({...loanDetails, collateralDesc: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Asset Photos</Label>
                        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer">
                            <Upload className="w-8 h-8 mb-2" />
                            <span className="text-xs">Upload Images of Collateral</span>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 4: REVIEW & AI */}
            {step === 4 && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Borrower</h4>
                            <p className="font-semibold">{currentBorrower?.name}</p>
                            <p className="text-sm text-slate-500">Score: {currentBorrower?.riskScore}</p>
                        </div>
                         <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Loan</h4>
                            <p className="font-semibold">ZMW {loanDetails.amount}</p>
                            <p className="text-sm text-slate-500">{loanDetails.duration} Months @ 15%</p>
                        </div>
                    </div>

                    {aiAnalysis ? (
                         <div className="bg-primary-50 rounded-lg border border-primary-100 p-4 animate-in fade-in">
                            <div className="flex items-center mb-3">
                                <CheckCircle2 className="w-5 h-5 text-primary-600 mr-2" />
                                <h3 className="font-bold text-primary-900">AI Risk Verdict</h3>
                            </div>
                             <div className="prose prose-sm text-slate-700 max-w-none">
                                {aiAnalysis.split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>)}
                             </div>
                        </div>
                    ) : (
                         <div className="text-center py-8 border border-slate-200 rounded-lg">
                            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-500 mb-4">Run AI Underwriting to proceed with submission.</p>
                            <Button onClick={handleRunAnalysis} disabled={isAnalyzing} className="bg-primary-600 hover:bg-primary-700">
                                {isAnalyzing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {isAnalyzing ? 'Analyzing Risk...' : 'Analyze Risk & Validate'}
                            </Button>
                        </div>
                    )}
                </div>
            )}

        </CardContent>
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between rounded-b-lg">
            <Button 
                variant="outline" 
                onClick={handleBack} 
                disabled={step === 1}
                className="w-32"
            >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            
            {step < 4 ? (
                <Button 
                    onClick={handleNext} 
                    disabled={step === 1 && !selectedBorrower || step === 2 && !loanDetails.amount}
                    className="w-32 bg-primary-600 hover:bg-primary-700"
                >
                    Next <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
            ) : (
                <Button 
                    className="w-48 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={!aiAnalysis}
                    onClick={() => alert("Loan Submitted for Manager Approval!")}
                >
                    Submit Application
                </Button>
            )}
        </div>
      </Card>
    </div>
  );
};