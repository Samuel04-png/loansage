import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useAgency } from '../../../hooks/useAgency';
import { useWhitelabel } from '../../../lib/whitelabel';
import { Button } from '../../../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../../components/ui/sheet';
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
  Settings,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { BottomNav, BottomNavItem } from '../../../components/navigation/BottomNav';

export function EmployeeLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { agency } = useAgency();
  const { logoUrl, agencyName } = useWhitelabel();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getUserInitials = () => {
    const name = profile?.full_name || 'Employee';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#0F172A]">
      {/* Sidebar - Desktop - Reference Style */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-[#1E293B] fixed inset-y-0 z-30 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
        {/* Logo Section */}
        <div className="h-16 flex items-center px-6 border-b border-neutral-200/50 dark:border-neutral-800/50">
          <img 
            src={logoUrl || '/logo/tengaloanlogo.png'} 
            alt={agencyName} 
            className="h-20 w-auto mr-3 max-h-20 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="flex-1 min-w-0">
            <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight block leading-tight truncate">
              {agencyName}
            </span>
            <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 tracking-wider uppercase">
              EMPLOYEE PORTAL
            </span>
          </div>
        </div>

        {/* Navigation - Reference Style */}
        <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="px-3 mb-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            Field Operations
          </div>
          {navItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={item.path}
                className={cn(
                  'flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group relative',
                  activePath === item.id
                    ? 'bg-[#006BFF]/10 dark:bg-blue-900/30 text-[#006BFF] dark:text-blue-400 font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                )}
              >
                <item.icon
                  className={cn(
                    'w-5 h-5 mr-3 transition-colors',
                    activePath === item.id ? 'text-[#006BFF] dark:text-blue-400' : 'text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300'
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {activePath === item.id && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute right-2 w-1.5 h-1.5 rounded-full bg-[#006BFF]"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            </motion.div>
          ))}
        </div>

        {/* User Profile Section - Reference Style */}
        <div className="p-4 border-t border-neutral-200/50 dark:border-neutral-800/50 bg-white dark:bg-[#1E293B]">
          <div className="flex items-center p-3 rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 bg-white dark:bg-neutral-800 mb-3 shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-xl transition-shadow">
            <Avatar className="h-10 w-10 border-2 border-neutral-200 dark:border-neutral-700">
              <AvatarImage src={(profile as any)?.avatar_url || (profile as any)?.photoURL || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-[#006BFF] to-[#4F46E5] text-white font-semibold">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="ml-3 flex-1 overflow-hidden min-w-0">
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                {profile?.full_name || 'Employee'}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate capitalize">
                {profile?.employee_category?.replace('_', ' ') || 'Employee'}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Sidebar - Using Sheet Component */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="px-6 py-4 border-b border-neutral-200/50 dark:border-neutral-800/50">
            <SheetTitle className="text-left">
              <div className="flex items-center">
                <img 
                  src={logoUrl || '/logo/tengaloanlogo.png'} 
                  alt={agencyName} 
                  className="h-12 w-auto mr-3 max-h-12 object-contain"
                />
                <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{agencyName}</span>
              </div>
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 py-6 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all',
                  activePath === item.id
                    ? 'bg-[#006BFF]/10 dark:bg-blue-900/30 text-[#006BFF] dark:text-blue-400 font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                )}
              >
                <item.icon className={cn(
                  'w-5 h-5 mr-3',
                  activePath === item.id ? 'text-[#006BFF]' : 'text-neutral-400'
                )} />
                {item.label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-0 overflow-hidden">
        {/* Header - Reference Style */}
        <header className={cn(
          "h-16 bg-white dark:bg-[#1E293B] border-b border-neutral-200/50 dark:border-neutral-800/50 flex items-center justify-between px-4 sm:px-8 z-20 sticky top-0 transition-all duration-300",
          scrolled && "bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-sm shadow-sm"
        )}>
          <div className="flex items-center gap-4">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                >
                  <Menu className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                </Button>
              </SheetTrigger>
            </Sheet>
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 capitalize">
              {activePath.replace('-', ' ')}
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            {/* Search - Reference Style */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 dark:text-neutral-500" />
              <input
                type="text"
                placeholder="Search..."
                className="h-9 w-64 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 pl-9 pr-4 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#006BFF]/20 dark:focus:ring-blue-500/30 focus:border-[#006BFF] dark:focus:border-blue-500 transition-all"
              />
            </div>
            
            {/* Notifications */}
            <button className="relative p-2 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-neutral-900" />
            </button>
            
            {/* User Menu - Reference Style */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                  <Avatar className="h-9 w-9 border-2 border-neutral-200 dark:border-neutral-700">
                    <AvatarImage src={(profile as any)?.avatar_url || (profile as any)?.photoURL || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-[#006BFF] to-[#4F46E5] text-white text-xs font-semibold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold">{profile?.full_name || 'Employee'}</p>
                    <p className="text-xs text-neutral-500 capitalize">
                      {profile?.employee_category?.replace('_', ' ') || 'Employee'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/employee/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Scrollable Area - Reference Style */}
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] dark:bg-[#0F172A]">
          <div className="container mx-auto px-4 lg:px-8 xl:px-16 py-6 lg:py-8 max-w-7xl pb-20 md:pb-8">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Bottom Navigation for Mobile */}
      <BottomNav
        items={useMemo(() => {
          const bottomNavItems: BottomNavItem[] = [
            { id: 'dashboard', label: 'Home', icon: LayoutDashboard, path: '/employee/dashboard' },
            { id: 'customers', label: 'Customers', icon: Users, path: '/employee/customers' },
            { id: 'loans', label: 'Loans', icon: FileText, path: '/employee/loans' },
            { id: 'tasks', label: 'Tasks', icon: ClipboardCheck, path: '/employee/tasks' },
            { id: 'support', label: 'Support', icon: MessageSquare, path: '/employee/support' },
          ];
          return bottomNavItems;
        }, [])}
      />
    </div>
  );
}

