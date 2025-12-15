import React, { useState } from 'react';
import { LayoutDashboard, Users, FileText, PieChart, Bell, Search, Settings, ShieldAlert, LogOut, Menu, X, Briefcase, Layers, ClipboardCheck, Wallet, UserCircle, Building2 } from 'lucide-react';
import { cn } from './ui/Base';
import { UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole: UserRole;
  onRoleSwitch: (role: UserRole) => void;
}

const NavItem: React.FC<{ icon: any, label: string, active: boolean, onClick: () => void }> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all group",
      active 
        ? "bg-slate-100 text-slate-900 shadow-sm" 
        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
    )}
  >
    <Icon className={cn("w-5 h-5 mr-3 transition-colors", active ? "text-primary-600" : "text-slate-400 group-hover:text-slate-600")} />
    {label}
  </button>
);

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, userRole, onRoleSwitch }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const adminNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'agencies', label: 'Agencies', icon: Building2 },
    { id: 'officers', label: 'Loan Officers', icon: Briefcase },
    { id: 'borrowers', label: 'Customers', icon: Users },
    { id: 'loans', label: 'Loan Portfolio', icon: FileText },
    { id: 'reports', label: 'Reports', icon: PieChart },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const officerNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'borrowers', label: 'My Customers', icon: Users },
    { id: 'create-loan', label: 'Originate Loan', icon: Layers },
    { id: 'loans', label: 'My Loans', icon: FileText },
    { id: 'collections', label: 'Collections', icon: Wallet },
    { id: 'tasks', label: 'Tasks', icon: ClipboardCheck },
    { id: 'underwriting', label: 'AI Assistant', icon: ShieldAlert },
  ];

  const currentNav = userRole === UserRole.ADMIN ? adminNav : officerNav;

  return (
    <div className="min-h-screen flex bg-slate-50/50">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 bg-white fixed inset-y-0 z-30">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center mr-3 shadow-sm">
             <ShieldAlert className="text-white w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-slate-900 tracking-tight block leading-none">TengaLoans</span>
            <span className="text-[10px] font-medium text-slate-500 tracking-wider uppercase">{userRole} PORTAL</span>
          </div>
        </div>

        <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="px-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {userRole === UserRole.ADMIN ? 'Administration' : 'Field Operations'}
          </div>
          {currentNav.map((item) => (
             <NavItem 
                key={item.id}
                icon={item.icon} 
                label={item.label} 
                active={activeTab === item.id} 
                onClick={() => onTabChange(item.id)} 
             />
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center p-2 rounded-lg border border-slate-200 bg-white mb-3 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center">
                <UserCircle className="w-5 h-5 text-slate-500" />
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-slate-900 truncate">Demo User</p>
              <p className="text-xs text-slate-500 truncate capitalize">{userRole.toLowerCase()}</p>
            </div>
          </div>
          
          {/* Role Switcher for Demo */}
          <div className="flex gap-1 mb-2">
            <button 
                onClick={() => onRoleSwitch(UserRole.ADMIN)}
                className={cn("flex-1 text-[10px] font-bold py-1 rounded border", userRole === UserRole.ADMIN ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200")}
            >
                ADMIN
            </button>
            <button 
                onClick={() => onRoleSwitch(UserRole.OFFICER)}
                className={cn("flex-1 text-[10px] font-bold py-1 rounded border", userRole === UserRole.OFFICER ? "bg-primary-600 text-white border-primary-600" : "bg-white text-slate-500 border-slate-200")}
            >
                OFFICER
            </button>
          </div>

          <button className="flex items-center w-full px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-red-600 transition-colors">
            <LogOut className="w-3 h-3 mr-2" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}
      
      {/* Mobile Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-200 md:hidden",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
         <div className="h-16 flex items-center px-6 border-b border-slate-100 justify-between">
          <span className="text-lg font-bold text-slate-900">TengaLoans</span>
          <button onClick={() => setMobileMenuOpen(false)}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-4 space-y-1">
          {currentNav.map((item) => (
             <NavItem 
                key={item.id}
                icon={item.icon} 
                label={item.label} 
                active={activeTab === item.id} 
                onClick={() => {onTabChange(item.id); setMobileMenuOpen(false)}} 
             />
          ))}
        </div>
        <div className="p-4 border-t mt-auto">
             <p className="text-xs text-center text-slate-400 mb-2">Switch View</p>
             <div className="flex gap-1">
                <button 
                    onClick={() => onRoleSwitch(UserRole.ADMIN)}
                    className={cn("flex-1 text-[10px] py-2 rounded border", userRole === UserRole.ADMIN ? "bg-slate-800 text-white" : "bg-slate-100")}
                >
                    ADMIN
                </button>
                <button 
                    onClick={() => onRoleSwitch(UserRole.OFFICER)}
                    className={cn("flex-1 text-[10px] py-2 rounded border", userRole === UserRole.OFFICER ? "bg-primary-600 text-white" : "bg-slate-100")}
                >
                    OFFICER
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-20">
          <div className="flex items-center">
             <button className="mr-4 md:hidden" onClick={() => setMobileMenuOpen(true)}>
               <Menu className="w-5 h-5 text-slate-600" />
             </button>
             <h1 className="text-xl font-semibold text-slate-900 capitalize flex items-center gap-2">
                {activeTab.replace('-', ' ')}
                {userRole === UserRole.OFFICER && activeTab === 'dashboard' && (
                    <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium border border-primary-100">Field Agent View</span>
                )}
             </h1>
          </div>
          
          <div className="flex items-center space-x-3 sm:space-x-6">
             <div className="relative hidden sm:block">
               <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
               <input 
                  type="text" 
                  placeholder="Global search..." 
                  className="h-9 w-64 rounded-md border border-slate-200 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
               />
             </div>
             <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
               <Bell className="w-5 h-5" />
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
             </button>
             <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
               <Settings className="w-5 h-5" />
             </button>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
           <div className="max-w-7xl mx-auto">
             {children}
           </div>
        </div>
      </main>
    </div>
  );
};