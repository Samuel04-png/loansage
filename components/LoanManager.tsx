import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Label } from './ui/Base';
import { Plus, Filter, MoreVertical, Calendar, DollarSign, User, XCircle } from 'lucide-react';
import { MOCK_LOANS } from '../constants';
import { Loan, LoanStatus } from '../types';

export const LoanManager = () => {
  const [loans, setLoans] = useState<Loan[]>(MOCK_LOANS);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState('');

  const filteredLoans = loans.filter(l => 
    l.borrowerName.toLowerCase().includes(filter.toLowerCase()) || 
    l.id.includes(filter)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
           <h2 className="text-2xl font-bold tracking-tight text-slate-900">Loan Applications</h2>
           <p className="text-slate-500 text-sm">Manage pending applications and active portfolio.</p>
        </div>
        <div className="flex space-x-2">
            <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
            </Button>
            <Button size="sm" className="bg-primary-600 hover:bg-primary-700" onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Application
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <div className="relative w-full max-w-sm">
                <Input 
                    placeholder="Search by name or ID..." 
                    className="pl-8"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
                <div className="absolute left-2.5 top-2.5 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <div className="relative overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-500">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-3">Loan ID</th>
                            <th className="px-6 py-3">Borrower</th>
                            <th className="px-6 py-3">Amount</th>
                            <th className="px-6 py-3">Duration</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Progress</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLoans.map((loan) => (
                            <tr key={loan.id} className="bg-white border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900">#{loan.id.split('_')[1]}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center mr-3 text-xs font-bold text-slate-600">
                                            {loan.borrowerName.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-900">{loan.borrowerName}</div>
                                            <div className="text-xs text-slate-500">ID: {loan.borrowerId}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-semibold text-slate-900">
                                    {loan.currency} {loan.amount.toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    {loan.durationMonths} months
                                    <div className="text-xs text-slate-400">{loan.interestRate}% Interest</div>
                                </td>
                                <td className="px-6 py-4">
                                     {loan.status === 'ACTIVE' && <Badge variant="success">Active</Badge>}
                                     {loan.status === 'PENDING' && <Badge variant="warning">Pending</Badge>}
                                     {loan.status === 'APPROVED' && <Badge variant="default">Approved</Badge>}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="w-full bg-slate-200 rounded-full h-2">
                                        <div className="bg-primary-600 h-2 rounded-full" style={{ width: `${loan.repaymentProgress}%` }}></div>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">{loan.repaymentProgress}% Paid</div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-slate-400 hover:text-slate-600">
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </CardContent>
      </Card>

      {/* Simplified Create Modal Overlay */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <Card className="w-full max-w-lg bg-white shadow-xl animate-in fade-in zoom-in duration-200">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                    <CardTitle>Create New Loan</CardTitle>
                    <button onClick={() => setShowCreateModal(false)}><XCircle className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label>Borrower Name</Label>
                        <Input placeholder="Search borrower..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Amount (ZMW)</Label>
                            <Input type="number" placeholder="5000" />
                        </div>
                        <div className="space-y-2">
                            <Label>Duration (Months)</Label>
                            <Input type="number" placeholder="12" />
                        </div>
                    </div>
                    <div className="space-y-2">
                         <Label>Collateral Description</Label>
                         <textarea className="w-full rounded-md border border-slate-200 p-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" rows={3} placeholder="Describe vehicle, property, etc..." />
                    </div>
                    <div className="bg-slate-50 p-3 rounded-md border border-slate-100 flex items-start">
                        <User className="w-4 h-4 text-primary-600 mt-1 mr-2" />
                        <div className="text-sm">
                            <p className="font-semibold text-slate-900">AI Risk Pre-check</p>
                            <p className="text-slate-500">Once submitted, the AI Underwriter will automatically score this application based on the borrower's history.</p>
                        </div>
                    </div>
                    <div className="pt-2 flex justify-end space-x-2">
                        <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                        <Button className="bg-primary-600 hover:bg-primary-700">Submit Application</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
};