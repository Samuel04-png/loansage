import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Base';
import { Badge } from './ui/Base';
import { ArrowUpRight, ArrowDownRight, DollarSign, Users, FileCheck, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { MOCK_LOANS } from '../constants';

const data = [
  { name: 'Jan', amount: 4000 },
  { name: 'Feb', amount: 3000 },
  { name: 'Mar', amount: 2000 },
  { name: 'Apr', amount: 2780 },
  { name: 'May', amount: 1890 },
  { name: 'Jun', amount: 2390 },
];

const StatCard = ({ title, value, change, trend, icon: Icon }: any) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center justify-between space-y-0 pb-2">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="flex items-baseline space-x-2">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <span className={cn("text-xs font-medium flex items-center", trend === 'up' ? "text-emerald-600" : "text-red-600")}>
          {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          {change}
        </span>
      </div>
    </CardContent>
  </Card>
);

// Helper for cn in StatCard
function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Active Loans" value="ZMW 1.2M" change="+12.5%" trend="up" icon={DollarSign} />
        <StatCard title="Active Borrowers" value="342" change="+4.1%" trend="up" icon={Users} />
        <StatCard title="Approval Rate" value="68%" change="-1.2%" trend="down" icon={FileCheck} />
        <StatCard title="At Risk (PAR 30)" value="4.2%" change="+0.5%" trend="down" icon={AlertTriangle} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Disbursement Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `K${value}`} />
                <Tooltip 
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                />
                <Bar dataKey="amount" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {MOCK_LOANS.slice(0, 3).map((loan) => (
                <div key={loan.id} className="flex items-center">
                  <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                    <span className="text-xs font-bold text-slate-700">{loan.borrowerName.charAt(0)}</span>
                  </div>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">{loan.borrowerName}</p>
                    <p className="text-xs text-slate-500">Loan #{loan.id.split('_')[1]}</p>
                  </div>
                  <div className="ml-auto font-medium text-sm">
                    {loan.status === 'ACTIVE' && <Badge variant="success">Active</Badge>}
                    {loan.status === 'PENDING' && <Badge variant="warning">Pending</Badge>}
                    {loan.status === 'APPROVED' && <Badge variant="default">Approved</Badge>}
                  </div>
                </div>
              ))}
              <button className="w-full text-center text-xs text-slate-500 hover:text-primary-600 mt-4">View All Activity</button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
