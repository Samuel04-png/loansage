/**
 * NRC Lookup Dialog Component
 * Allows users to search for NRC and get risk analysis
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Loader2, Search, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, DollarSign, FileText } from 'lucide-react';
import { lookupNRC } from '../../lib/ai/nrc-lookup';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../lib/utils';
import toast from 'react-hot-toast';

interface NRCLookupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectNRC?: (nrc: string, analysis: any) => void;
}

export function NRCLookupDialog({ open, onOpenChange, onSelectNRC }: NRCLookupDialogProps) {
  const { profile } = useAuth();
  const [nrc, setNrc] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const handleSearch = async () => {
    if (!nrc.trim() || !profile?.agency_id) {
      toast.error('Please enter a valid NRC number');
      return;
    }

    setLoading(true);
    try {
      const result = await lookupNRC(profile.agency_id, nrc.trim());
      setAnalysis(result);
    } catch (error: any) {
      console.error('NRC lookup error:', error);
      toast.error(error.message || 'Failed to lookup NRC');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    if (analysis && onSelectNRC) {
      onSelectNRC(nrc, analysis);
      onOpenChange(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 30) return 'text-emerald-600 bg-emerald-50';
    if (score < 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getRiskLabel = (score: number) => {
    if (score < 30) return 'Low Risk';
    if (score < 60) return 'Moderate Risk';
    return 'High Risk';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>NRC Risk Lookup</DialogTitle>
          <DialogDescription>
            Search for an NRC number to view loan history and risk analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="nrc">NRC Number</Label>
              <Input
                id="nrc"
                placeholder="123456/78/9"
                value={nrc}
                onChange={(e) => setNrc(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={loading || !nrc.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </div>

          {analysis && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Risk Analysis</h3>
                    <Badge className={getRiskColor(analysis.riskScore)}>
                      {getRiskLabel(analysis.riskScore)} ({analysis.riskScore}/100)
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-slate-500">Total Loans</p>
                      <p className="text-2xl font-bold">{analysis.totalLoans}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Active Loans</p>
                      <p className="text-2xl font-bold text-blue-600">{analysis.activeLoans}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Completed</p>
                      <p className="text-2xl font-bold text-emerald-600">{analysis.completedLoans}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Defaulted</p>
                      <p className="text-2xl font-bold text-red-600">{analysis.defaultedLoans}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-slate-500">On-Time Rate</p>
                      <p className="text-xl font-semibold">
                        {(analysis.repaymentBehavior.onTimeRate * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Default Probability</p>
                      <p className="text-xl font-semibold text-red-600">
                        {(analysis.defaultProbability * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Debt-to-Income</p>
                      <p className="text-xl font-semibold">
                        {(analysis.debtToIncomeRatio * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-slate-500 mb-2">Recommended Max Loan Size</p>
                    <p className="text-2xl font-bold text-primary-600">
                      {formatCurrency(analysis.recommendedMaxLoanSize, 'ZMW')}
                    </p>
                  </div>

                  {analysis.analysis && (
                    <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-700">{analysis.analysis}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {analysis.factors.positive.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-emerald-600 mb-2 flex items-center">
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Positive Factors
                        </p>
                        <ul className="space-y-1">
                          {analysis.factors.positive.map((factor: string, idx: number) => (
                            <li key={idx} className="text-sm text-slate-600">• {factor}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysis.factors.negative.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-red-600 mb-2 flex items-center">
                          <AlertTriangle className="w-4 h-4 mr-1" />
                          Risk Factors
                        </p>
                        <ul className="space-y-1">
                          {analysis.factors.negative.map((factor: string, idx: number) => (
                            <li key={idx} className="text-sm text-slate-600">• {factor}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                {onSelectNRC && (
                  <Button onClick={handleSelect}>
                    Use This NRC
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

