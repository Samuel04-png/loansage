import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Label } from './ui/Base';
import { Search, ChevronRight, Phone, Mail, FileText, ArrowLeft, ShieldCheck, AlertTriangle, Wallet, Activity, Loader2, Sparkles, X, Upload, Pencil, Briefcase, Car } from 'lucide-react';
import { MOCK_BORROWERS, MOCK_LOANS } from '../constants';
import { Borrower, Loan } from '../types';
import { analyzeBorrowerProfile } from '../services/aiService';

export const BorrowerManager = () => {
  const [borrowers, setBorrowers] = useState<Borrower[]>(MOCK_BORROWERS.map(b => ({...b, kycStatus: 'VERIFIED', documents: []} as Borrower)));
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'loans' | 'docs' | 'collateral'>('overview');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBorrower, setNewBorrower] = useState({ name: '', email: '', phone: '', nrcNumber: '' });

  // Filter logic
  const filteredBorrowers = borrowers.filter(b => 
    b.name.toLowerCase().includes(filter.toLowerCase()) || 
    b.nrcNumber.includes(filter)
  );

  const handleSelectBorrower = (borrower: Borrower) => {
    setSelectedBorrower(borrower);
    setActiveTab('overview');
    setAiAnalysis(null);
  };

  const handleRunAnalysis = async () => {
    if (!selectedBorrower) return;
    setIsAnalyzing(true);
    const borrowerLoans = MOCK_LOANS.filter(l => l.borrowerId === selectedBorrower.id);
    const result = await analyzeBorrowerProfile(selectedBorrower, borrowerLoans);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  // View: List
  if (!selectedBorrower) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
             <h2 className="text-2xl font-bold tracking-tight text-slate-900">Customer Directory</h2>
             <p className="text-slate-500 text-sm">Manage borrower identities, KYC status, and risk profiles.</p>
          </div>
          <Button className="bg-primary-600 hover:bg-primary-700" onClick={() => setShowCreateModal(true)}>
             + Add Customer
          </Button>
        </div>

        <Card>
          <CardHeader className="p-4 border-b border-slate-100">
            <div className="relative w-full max-w-md">
                <Input 
                    placeholder="Search by name, NRC, or phone..." 
                    className="pl-9"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
             <div className="relative overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-500">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-3">Identity</th>
                            <th className="px-6 py-3">Contact</th>
                            <th className="px-6 py-3">Risk Score</th>
                            <th className="px-6 py-3">KYC Status</th>
                            <th className="px-6 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBorrowers.map((borrower) => (
                            <tr 
                                key={borrower.id} 
                                onClick={() => handleSelectBorrower(borrower)}
                                className="bg-white border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors group"
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="h-10 w-10 rounded-full bg-slate-200 overflow-hidden mr-3 flex items-center justify-center font-bold text-slate-500">
                                            {borrower.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-900 group-hover:text-primary-600 transition-colors">{borrower.name}</div>
                                            <div className="text-xs text-slate-500">NRC: {borrower.nrcNumber}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center text-xs text-slate-600">
                                            <Mail className="w-3 h-3 mr-1" /> {borrower.email}
                                        </div>
                                        <div className="flex items-center text-xs text-slate-600">
                                            <Phone className="w-3 h-3 mr-1" /> {borrower.phone}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className={`w-2 h-2 rounded-full mr-2 ${borrower.riskScore >= 80 ? 'bg-emerald-500' : borrower.riskScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                                        <span className="font-medium">{borrower.riskScore}/100</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <Badge variant="success">Verified</Badge>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary-500 inline-block" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
          </CardContent>
        </Card>
        
        {showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                <Card className="w-full max-w-lg bg-white shadow-xl animate-in fade-in zoom-in duration-200">
                    <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                        <CardTitle>Add New Customer</CardTitle>
                        <button onClick={() => setShowCreateModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            <Label>Full Name</Label>
                            <Input value={newBorrower.name} onChange={e => setNewBorrower({...newBorrower, name: e.target.value})} />
                            <Label>NRC Number</Label>
                            <Input value={newBorrower.nrcNumber} onChange={e => setNewBorrower({...newBorrower, nrcNumber: e.target.value})} />
                            <div className="grid grid-cols-2 gap-4">
                                <div><Label>Phone</Label><Input value={newBorrower.phone} onChange={e => setNewBorrower({...newBorrower, phone: e.target.value})} /></div>
                                <div><Label>Email</Label><Input value={newBorrower.email} onChange={e => setNewBorrower({...newBorrower, email: e.target.value})} /></div>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <Button className="bg-primary-600 hover:bg-primary-700">Create Profile</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}
      </div>
    );
  }

  // View: Detail
  const activeLoans = MOCK_LOANS.filter(l => l.borrowerId === selectedBorrower.id);

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        {/* Navigation */}
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <Button variant="outline" size="icon" onClick={() => setSelectedBorrower(null)}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">{selectedBorrower.name}</h2>
                    <div className="flex items-center space-x-2 text-sm text-slate-500">
                        <span>ID: {selectedBorrower.id}</span>
                        <span className="w-1 h-1 bg-slate-400 rounded-full" />
                        <span>Active since 2023</span>
                    </div>
                </div>
            </div>
            <div className="flex space-x-2">
                <Button variant="outline" size="sm"><Pencil className="w-4 h-4 mr-2" /> Edit</Button>
            </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                {['overview', 'loans', 'docs', 'collateral'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`${
                            activeTab === tab
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
                    >
                        {tab === 'docs' ? 'Documents' : tab}
                    </button>
                ))}
            </nav>
        </div>

        {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Identity & KYC</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                             <div className="flex items-center justify-center p-4 bg-slate-50 rounded-lg">
                                <div className="text-center">
                                    <div className="h-20 w-20 rounded-full bg-slate-200 mx-auto flex items-center justify-center font-bold text-2xl text-slate-500 mb-2">
                                        {selectedBorrower.name.charAt(0)}
                                    </div>
                                    <Badge variant="success">KYC Verified</Badge>
                                </div>
                             </div>
                             <div className="space-y-2 text-sm">
                                <div className="flex justify-between py-2 border-b border-slate-50">
                                    <span className="text-slate-500">NRC</span>
                                    <span className="font-medium">{selectedBorrower.nrcNumber}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-slate-50">
                                    <span className="text-slate-500">Phone</span>
                                    <span className="font-medium">{selectedBorrower.phone}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-slate-50">
                                    <span className="text-slate-500">Email</span>
                                    <span className="font-medium">{selectedBorrower.email}</span>
                                </div>
                             </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900 text-white border-none">
                        <CardHeader><CardTitle className="text-base text-white">Risk Score</CardTitle></CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold mb-2">{selectedBorrower.riskScore}</div>
                            <div className="w-full bg-slate-700 h-1.5 rounded-full mb-4">
                                <div className="bg-emerald-500 h-1.5 rounded-full" style={{width: `${selectedBorrower.riskScore}%`}}></div>
                            </div>
                            <p className="text-xs text-slate-400">Analysis based on repayment history and collateral LTV.</p>
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-2 space-y-6">
                     <Card className="border-primary-100">
                         <CardHeader className="bg-primary-50/50 border-b border-primary-100 flex flex-row items-center justify-between py-3">
                             <CardTitle className="text-base text-primary-900 flex items-center">
                                 <Sparkles className="w-4 h-4 mr-2 text-primary-600" /> AI Risk Narrative
                             </CardTitle>
                             <Button size="sm" variant="outline" onClick={handleRunAnalysis} disabled={isAnalyzing}>
                                {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Update Analysis'}
                             </Button>
                         </CardHeader>
                         <CardContent className="pt-4 min-h-[150px]">
                            {aiAnalysis ? (
                                <div className="prose prose-sm text-slate-700">{aiAnalysis.split('\n').map((l, i) => <p key={i}>{l}</p>)}</div>
                            ) : (
                                <p className="text-slate-500 text-sm text-center py-8">Click Update to generate a fresh AI risk profile.</p>
                            )}
                         </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {[1,2].map(i => (
                                    <div key={i} className="flex items-center justify-between pb-4 border-b border-slate-50 last:border-0">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center mr-3">
                                                <Wallet className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">Repayment Received</p>
                                                <p className="text-xs text-slate-500">Loan #L_101 • Yesterday</p>
                                            </div>
                                        </div>
                                        <span className="text-sm font-bold text-slate-900">+ ZMW 1,500</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )}

        {activeTab === 'loans' && (
             <Card>
                 <CardHeader><CardTitle>Loan History</CardTitle></CardHeader>
                 <CardContent>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-6 py-3">ID</th>
                                <th className="px-6 py-3">Amount</th>
                                <th className="px-6 py-3">Start Date</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Progress</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeLoans.map(l => (
                                <tr key={l.id} className="border-b border-slate-100">
                                    <td className="px-6 py-4 font-medium">#{l.id}</td>
                                    <td className="px-6 py-4">{l.currency} {l.amount}</td>
                                    <td className="px-6 py-4">{l.startDate}</td>
                                    <td className="px-6 py-4"><Badge variant="default">{l.status}</Badge></td>
                                    <td className="px-6 py-4">{l.repaymentProgress}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </CardContent>
             </Card>
        )}

        {activeTab === 'docs' && (
            <Card>
                <CardHeader><CardTitle>Identity Documents</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="border rounded-lg p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 cursor-pointer">
                            <FileText className="w-8 h-8 text-slate-400 mb-2" />
                            <span className="text-sm font-medium">NRC_Front.pdf</span>
                        </div>
                        <div className="border rounded-lg p-4 flex flex-col items-center justify-center text-center border-dashed border-slate-300 text-slate-400 hover:text-primary-600 hover:border-primary-400 cursor-pointer">
                            <Upload className="w-8 h-8 mb-2" />
                            <span className="text-sm">Upload New</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )}

        {activeTab === 'collateral' && (
             <Card>
                <CardHeader><CardTitle>Registered Assets</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid gap-4">
                        {activeLoans.flatMap(l => l.collateral).map(c => (
                            <div key={c.id} className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="flex items-center">
                                    <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center mr-4">
                                        <Car className="w-5 h-5 text-slate-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-900">{c.description}</p>
                                        <p className="text-xs text-slate-500">{c.type}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-900">{c.currency} {c.value}</p>
                                    <Badge variant="outline" className="text-[10px]">Verified</Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )}
    </div>
  );
};