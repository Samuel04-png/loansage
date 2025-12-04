import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useAgency } from '../../../hooks/useAgency';
import { useWhitelabel } from '../../../lib/whitelabel';
import { Button } from '../../../components/ui/button';
import {
  LayoutDashboard,
  Users,
  FileText,
  PieChart,
  Settings,
  Building2,
  Briefcase,
  Bell,
  Search,
  LogOut,
  Menu,
  X,
  UserCircle,
  Calculator
} from 'lucide-react';
import { NotificationDropdown } from '../../../components/NotificationDropdown';
import { cn } from '../../../lib/utils';
import { useState } from 'react';
import toast from 'react-hot-toast';

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { agency } = useAgency();
  const { logoUrl, agencyName } = useWhitelabel();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { id: 'employees', label: 'Employees', icon: Briefcase, path: '/admin/employees' },
    { id: 'customers', label: 'Customers', icon: Users, path: '/admin/customers' },
    { id: 'loans', label: 'Loan Portfolio', icon: FileText, path: '/admin/loans' },
    { id: 'collaterals', label: 'Collaterals', icon: FileText, path: '/admin/collaterals' },
    { id: 'accounting', label: 'Accounting', icon: Calculator, path: '/admin/accounting' },
    { id: 'data-management', label: 'Data Management', icon: FileText, path: '/admin/data-management' },
    { id: 'reports', label: 'Reports', icon: PieChart, path: '/admin/reports' },
    { id: 'activity-logs', label: 'Activity Logs', icon: FileText, path: '/admin/activity-logs' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings' },
  ];

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
            <Building2 className="text-white w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-slate-900 tracking-tight block leading-none">
              {agencyName}
            </span>
            <span className="text-[10px] font-medium text-slate-500 tracking-wider uppercase">
              ADMIN PORTAL
            </span>
          </div>
        </div>

        <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="px-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Administration
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
                {profile?.full_name || 'Admin User'}
              </p>
              <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
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

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
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
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-20">
          <div className="flex items-center">
            <button
              className="mr-4 md:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
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
                placeholder="Global search..."
                className="h-9 w-64 rounded-md border border-slate-200 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
              />
            </div>
            <NotificationDropdown />
            <Link
              to="/admin/settings"
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

