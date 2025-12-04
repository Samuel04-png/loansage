import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useAgency } from '../../../hooks/useAgency';
import { useWhitelabel } from '../../../lib/whitelabel';
import { Button } from '../../../components/ui/button';
import {
  LayoutDashboard,
  Users,
  FileText,
  Wallet,
  ClipboardCheck,
  ShieldAlert,
  AlertTriangle,
  Bell,
  Search,
  LogOut,
  Menu,
  X,
  UserCircle,
  Calendar,
  Folder,
  MessageSquare,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useState } from 'react';
import toast from 'react-hot-toast';

export function EmployeeLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { agency } = useAgency();
  const { logoUrl, agencyName } = useWhitelabel();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Role-specific navigation based on employee category
  const getNavItems = () => {
    const baseItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/employee/dashboard' },
      { id: 'customers', label: 'My Customers', icon: Users, path: '/employee/customers' },
      { id: 'loans', label: 'My Loans', icon: FileText, path: '/employee/loans' },
    ];

    const category = profile?.employee_category;

    const sharedItems = [
      { id: 'tasks', label: 'Tasks', icon: ClipboardCheck, path: '/employee/tasks' },
      { id: 'calendar', label: 'Calendar', icon: Calendar, path: '/employee/calendar' },
      { id: 'files', label: 'Files', icon: Folder, path: '/employee/files' },
      { id: 'support', label: 'Support', icon: MessageSquare, path: '/employee/support' },
    ];

    if (category === 'loan_officer') {
      return [
        ...baseItems,
        { id: 'create-loan', label: 'Originate Loan', icon: FileText, path: '/employee/loans/create' },
        ...sharedItems,
      ];
    }

    if (category === 'collections') {
      return [
        ...baseItems,
        { id: 'collections', label: 'Collections', icon: Wallet, path: '/employee/collections' },
        { id: 'overdue', label: 'Overdue', icon: AlertTriangle, path: '/employee/overdue' },
        ...sharedItems,
      ];
    }

    if (category === 'underwriter') {
      return [
        ...baseItems,
        { id: 'underwriting', label: 'AI Assistant', icon: ShieldAlert, path: '/employee/underwriting' },
        { id: 'pending', label: 'Pending Approvals', icon: FileText, path: '/employee/loans/pending' },
        ...sharedItems,
      ];
    }

    return [...baseItems, ...sharedItems];
  };

  const navItems = getNavItems();
  const activePath = location.pathname.split('/')[2] || 'dashboard';

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth/login');
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50/50">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 bg-white fixed inset-y-0 z-30">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <img 
            src={logoUrl || '/logo/loansagelogo.png'} 
            alt={agencyName} 
            className="h-8 w-auto mr-3"
            onError={(e) => {
              // Fallback to icon if image fails to load
              (e.target as HTMLImageElement).style.display = 'none';
              const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center mr-3 hidden">
            <ShieldAlert className="text-white w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-slate-900 tracking-tight block leading-none">
              {agencyName}
            </span>
            <span className="text-[10px] font-medium text-slate-500 tracking-wider uppercase">
              EMPLOYEE PORTAL
            </span>
          </div>
        </div>

        <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="px-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Field Operations
          </div>
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              className={cn(
                'flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all group',
                activePath === item.id
                  ? 'bg-slate-100 text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              )}
            >
              <item.icon
                className={cn(
                  'w-5 h-5 mr-3 transition-colors',
                  activePath === item.id ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'
                )}
              />
              {item.label}
            </Link>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center p-2 rounded-lg border border-slate-200 bg-white mb-3 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center">
              <UserCircle className="w-5 h-5 text-slate-500" />
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-slate-900 truncate">
                {profile?.full_name || 'Employee'}
              </p>
              <p className="text-xs text-slate-500 truncate capitalize">
                {profile?.employee_category?.replace('_', ' ') || 'Employee'}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={handleSignOut}
          >
            <LogOut className="w-3 h-3 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-200 md:hidden',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-100 justify-between">
          <span className="text-lg font-bold text-slate-900">{agencyName}</span>
          <button onClick={() => setMobileMenuOpen(false)}>
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all',
                activePath === item.id
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              )}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.label}
            </Link>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-20">
          <div className="flex items-center">
            <button className="mr-4 md:hidden" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-xl font-semibold text-slate-900 capitalize">
              {activePath.replace('-', ' ')}
            </h1>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-6">
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                className="h-9 w-64 rounded-md border border-slate-200 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
              />
            </div>
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

