import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { LoanManager } from './components/LoanManager';
import { Underwriter } from './components/Underwriter';
import { BorrowerManager } from './components/BorrowerManager';
import { LoanFactory } from './components/LoanFactory';
import { UserRole } from './types';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userRole, setUserRole] = useState<UserRole>(UserRole.ADMIN);

  // Reset tab to dashboard when switching roles to avoid dead links
  const handleRoleSwitch = (newRole: UserRole) => {
    setUserRole(newRole);
    setActiveTab('dashboard');
  };

  const renderContent = () => {
    // ROUTING LOGIC
    if (activeTab === 'dashboard') return <Dashboard />;
    if (activeTab === 'borrowers') return <BorrowerManager />;
    if (activeTab === 'underwriting') return <Underwriter />;
    if (activeTab === 'loans') return <LoanManager />;
    
    // Officer Specific
    if (activeTab === 'create-loan') return <LoanFactory />;
    if (activeTab === 'tasks') return (
        <div className="flex items-center justify-center h-64 text-slate-400">
            Field Tasks Module (Coming Soon)
        </div>
    );
    if (activeTab === 'collections') return (
        <div className="flex items-center justify-center h-64 text-slate-400">
            Collections Module (Coming Soon)
        </div>
    );

    // Admin Specific
    if (activeTab === 'agencies') return (
        <div className="flex items-center justify-center h-64 text-slate-400">
            Agency Management (Admin Only)
        </div>
    );
    if (activeTab === 'reports') return (
        <div className="flex flex-col items-center justify-center h-96 text-center space-y-4">
            <div className="bg-slate-100 p-4 rounded-full"><span className="text-4xl">📊</span></div>
            <h3 className="text-lg font-semibold text-slate-900">Portfolio Analytics</h3>
            <p className="text-slate-500 max-w-sm">Deep dive into PAR30, PAR90, and yield analysis reports.</p>
        </div>
    );

    return <Dashboard />;
  };

  return (
    <Layout 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        userRole={userRole}
        onRoleSwitch={handleRoleSwitch}
    >
      {renderContent()}
    </Layout>
  );
}

export default App;