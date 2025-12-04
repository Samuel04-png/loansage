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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip';
import {
  LayoutDashboard,
  Users,
  FileText,
  PieChart,
  Settings,
  Building2,
  Bell,
  Search,
  LogOut,
  Menu,
  X,
  Calculator,
  ChevronRight,
  ChevronDown,
  Mail,
  Star,
  Folder,
  Check,
  Plus,
  RefreshCw,
  Palette,
  Keyboard,
  Download,
  Gift,
  CreditCard,
  HelpCircle,
  Trash2,
  ExternalLink,
  Sparkles,
  Shield,
  ClipboardList,
} from 'lucide-react';
import { NotificationDropdown } from '../../../components/NotificationDropdown';
import { cn } from '../../../lib/utils';
import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { agency } = useAgency();
  const { logoUrl, agencyName } = useWhitelabel();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  // Persist sidebar collapsed state in localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  // Persist expanded sections state in localStorage
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sidebarExpandedSections');
    return saved ? JSON.parse(saved) : {
      records: true,
      management: true,
      system: true,
    };
  });

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  // Navigation structure - Only real pages that exist (memoized to prevent re-renders)
  const primaryNav = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { id: 'reports', label: 'Reports', icon: PieChart, path: '/admin/reports' },
    { id: 'accounting', label: 'Accounting', icon: Calculator, path: '/admin/accounting' },
  ], []);

  const recordsNav = useMemo(() => [
    { id: 'customers', label: 'Customers', icon: Building2, path: '/admin/customers' },
    { id: 'employees', label: 'Employees', icon: Users, path: '/admin/employees' },
  ], []);

  const managementNav = useMemo(() => [
    { id: 'loans', label: 'Loans', icon: FileText, path: '/admin/loans' },
    { id: 'collaterals', label: 'Collaterals', icon: Shield, path: '/admin/collaterals' },
    { id: 'invitations', label: 'Invitations', icon: Mail, path: '/admin/invitations' },
  ], []);

  const systemNav = useMemo(() => [
    { id: 'activity-logs', label: 'Activity Logs', icon: ClipboardList, path: '/admin/activity-logs' },
    { id: 'data-management', label: 'Data Management', icon: Folder, path: '/admin/data-management' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings' },
  ], []);

  // Get active path - handle nested routes like /admin/loans/:id
  // Memoize to prevent unnecessary recalculations
  const activePath = useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    return pathSegments[1] || 'dashboard';
  }, [location.pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth/login');
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const getUserInitials = () => {
    const name = profile?.full_name || 'Admin User';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Mock workspaces for account switcher
  const workspaces = [
    { id: '1', name: agencyName || 'LoanSage', icon: Building2, active: true },
    { id: '2', name: 'Vortex Innovations', icon: Sparkles, active: false },
    { id: '3', name: 'Proxima Ventures', icon: Star, active: false },
    { id: '4', name: 'Nexora Labs', icon: Settings, active: false },
  ];

  // Memoized NavItem component to prevent re-renders
  const NavItem = memo(({ item, collapsed, currentPath }: { item: any; collapsed: boolean; currentPath: string }) => {
    // Check if current path starts with the item path for nested routes
    const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
    const Icon = item.icon;
    
    const content = (
      <Link
        to={item.path}
        className={cn(
          'flex items-center w-full px-3 py-2 rounded-lg transition-colors duration-200 group relative',
          collapsed ? 'justify-center' : '',
          isActive
            ? 'bg-white text-[#006BFF] font-medium shadow-sm border border-neutral-200/50'
            : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
        )}
        onClick={(e) => {
          // Prevent navigation if already on this page to avoid flickering
          if (currentPath === item.path) {
            e.preventDefault();
          }
        }}
      >
        <Icon
          className={cn(
            'flex-shrink-0 transition-colors duration-200',
            collapsed ? 'w-5 h-5' : 'w-4 h-4 mr-3',
            isActive ? 'text-[#006BFF]' : 'text-neutral-400 group-hover:text-neutral-600'
          )}
        />
        {!collapsed && (
          <>
            <span className="flex-1 text-sm">{item.label}</span>
            {item.badge && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {content}
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-neutral-900 text-white text-xs">
              {item.label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return content;
  });
  NavItem.displayName = 'NavItem';

  // Memoized NavSection component
  const NavSection = memo(({ 
    title, 
    items, 
    collapsed, 
    sectionKey,
    currentPath,
    isExpanded,
    onToggle
  }: { 
    title: string; 
    items: any[]; 
    collapsed: boolean;
    sectionKey: string;
    currentPath: string;
    isExpanded: boolean;
    onToggle: (key: string) => void;
  }) => {
    if (collapsed) {
      return (
        <div className="space-y-1">
          {items.map((item) => (
            <NavItem key={item.id} item={item} collapsed={true} currentPath={currentPath} />
          ))}
        </div>
      );
    }

    const hasToggle = title === 'Records' || title === 'Management' || title === 'System';

    return (
      <div className="mb-4">
        {hasToggle ? (
          <button
            onClick={() => onToggle(sectionKey)}
            className="flex items-center w-full px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider hover:text-neutral-700 transition-colors"
          >
            <span className="flex-1 text-left">{title}</span>
            <ChevronDown
              className={cn(
                'w-4 h-4 transition-transform duration-200',
                isExpanded ? 'rotate-0' : '-rotate-90'
              )}
            />
          </button>
        ) : (
          <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            {title}
          </div>
        )}
        {(!hasToggle || isExpanded) && (
          <div className="space-y-1">
            {items.map((item) => (
              <NavItem key={item.id} item={item} collapsed={false} currentPath={currentPath} />
            ))}
          </div>
        )}
      </div>
    );
  });
  NavSection.displayName = 'NavSection';

  return (
    <TooltipProvider>
      <div className="min-h-screen flex bg-[#F8FAFC]">
        {/* Premium Sidebar - Reference Style */}
        <aside
          className={cn(
            'hidden md:flex flex-col bg-white fixed inset-y-0 z-30 shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-[width] duration-300 ease-in-out',
            sidebarCollapsed ? 'w-16' : 'w-64'
          )}
        >
          {/* Top Section - Logo/Company Name */}
          {!sidebarCollapsed && (
            <div className="h-16 flex items-center px-4 border-b border-neutral-200/50">
              <div className="flex items-center flex-1 min-w-0">
                <div className="w-8 h-8 bg-gradient-to-br from-[#006BFF] to-[#4F46E5] rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <DropdownMenu open={showAccountSwitcher} onOpenChange={setShowAccountSwitcher}>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center flex-1 min-w-0 group">
                      <span className="text-sm font-semibold text-neutral-900 truncate">
                        {agencyName || 'LoanSage'}
                      </span>
                      <ChevronDown className="w-4 h-4 ml-1.5 text-neutral-400 group-hover:text-neutral-600 transition-colors flex-shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 ml-2">
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-neutral-200">
                      <span className="text-xs font-medium text-neutral-600">{profile?.email}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="py-1">
                      {workspaces.map((workspace) => (
                        <DropdownMenuItem
                          key={workspace.id}
                          className={cn(
                            'flex items-center px-3 py-2 cursor-pointer',
                            workspace.active && 'bg-neutral-50'
                          )}
                        >
                          <div className="w-6 h-6 rounded bg-gradient-to-br from-[#006BFF] to-[#4F46E5] flex items-center justify-center mr-3 flex-shrink-0">
                            <workspace.icon className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="flex-1 text-sm text-neutral-900">{workspace.name}</span>
                          {workspace.active && (
                            <Check className="w-4 h-4 text-[#006BFF] ml-2" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="px-3 py-2 cursor-pointer">
                      <Plus className="w-4 h-4 mr-3 text-neutral-400" />
                      <span className="text-sm text-neutral-600">New account</span>
                      <span className="ml-auto text-xs text-neutral-400">⌘A</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="ml-2 text-xs text-neutral-500">
                  {agency?.membersCount || 21} members
                </div>
                <ExternalLink className="w-3.5 h-3.5 ml-2 text-neutral-400 flex-shrink-0" />
              </div>
            </div>
          )}

          {/* Search Bar */}
          {!sidebarCollapsed && (
            <div className="px-4 py-3 border-b border-neutral-200/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF] transition-all"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400 font-mono">
                  ⌘K
                </div>
              </div>
            </div>
          )}

          {/* Navigation - Scrollable */}
          <div className="flex-1 overflow-y-auto px-3 py-4">
            {!sidebarCollapsed ? (
              <>
                <NavSection 
                  title="Primary" 
                  items={primaryNav} 
                  collapsed={false} 
                  sectionKey="primary"
                  currentPath={location.pathname}
                  isExpanded={true}
                  onToggle={toggleSection}
                />
                <NavSection 
                  title="Records" 
                  items={recordsNav} 
                  collapsed={false} 
                  sectionKey="records"
                  currentPath={location.pathname}
                  isExpanded={expandedSections.records ?? true}
                  onToggle={toggleSection}
                />
                <NavSection 
                  title="Management" 
                  items={managementNav} 
                  collapsed={false} 
                  sectionKey="management"
                  currentPath={location.pathname}
                  isExpanded={expandedSections.management ?? true}
                  onToggle={toggleSection}
                />
                <NavSection 
                  title="System" 
                  items={systemNav} 
                  collapsed={false} 
                  sectionKey="system"
                  currentPath={location.pathname}
                  isExpanded={expandedSections.system ?? true}
                  onToggle={toggleSection}
                />
              </>
            ) : (
              <div className="space-y-1">
                {[...primaryNav, ...recordsNav, ...managementNav, ...systemNav].map((item) => (
                  <NavItem key={item.id} item={item} collapsed={true} currentPath={location.pathname} />
                ))}
              </div>
            )}
          </div>

          {/* Bottom Section */}
          <div className="p-4 border-t border-neutral-200/50 space-y-3">
            {/* New Version Banner */}
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-neutral-200 rounded-lg p-3 shadow-sm relative"
              >
                <button
                  onClick={() => {}}
                  className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-neutral-600 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-[#006BFF] to-[#4F46E5] rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-neutral-900 mb-1">New version available</h4>
                    <p className="text-xs text-neutral-600 mb-2">
                      An improved version of LoanSage is available. Please restart now to upgrade.
                    </p>
                    <button className="text-xs font-medium text-[#006BFF] hover:text-[#0052CC] transition-colors">
                      Update →
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* User Profile */}
            <DropdownMenu open={showUserMenu} onOpenChange={setShowUserMenu}>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 transition-colors group">
                  <Avatar className="h-8 w-8 border-2 border-neutral-200">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-[#006BFF] to-[#4F46E5] text-white text-xs font-semibold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  {!sidebarCollapsed && (
                    <>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-neutral-900 truncate">
                          {profile?.full_name || 'Admin User'}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">{profile?.email}</p>
                      </div>
                      <ChevronDown className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors flex-shrink-0" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 ml-2">
                <div className="px-3 py-3 border-b border-neutral-200">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-neutral-200">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback className="bg-gradient-to-br from-[#006BFF] to-[#4F46E5] text-white text-sm font-semibold">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 truncate">
                        {profile?.full_name || 'Admin User'}
                      </p>
                      <p className="text-xs text-neutral-500">Online</p>
                    </div>
                  </div>
                </div>
                <div className="py-1">
                  <DropdownMenuItem className="px-3 py-2 cursor-pointer">
                    <Palette className="w-4 h-4 mr-3 text-neutral-400" />
                    <span className="text-sm text-neutral-900">Themes</span>
                    <span className="ml-auto text-xs text-neutral-400">⌘T</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/settings" className="px-3 py-2 cursor-pointer">
                      <Settings className="w-4 h-4 mr-3 text-neutral-400" />
                      <span className="text-sm text-neutral-900">Settings</span>
                      <span className="ml-auto text-xs text-neutral-400">⌘S</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="px-3 py-2 cursor-pointer">
                    <Bell className="w-4 h-4 mr-3 text-neutral-400" />
                    <span className="text-sm text-neutral-900">Notification</span>
                    <span className="ml-auto text-xs text-neutral-400">⌘N</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="px-3 py-2 cursor-pointer">
                    <Keyboard className="w-4 h-4 mr-3 text-neutral-400" />
                    <span className="text-sm text-neutral-900">Hotkeys</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="px-3 py-2 cursor-pointer">
                    <Download className="w-4 h-4 mr-3 text-neutral-400" />
                    <span className="text-sm text-neutral-900">Download apps</span>
                    <ChevronRight className="w-4 h-4 ml-auto text-neutral-400" />
                  </DropdownMenuItem>
                  <DropdownMenuItem className="px-3 py-2 cursor-pointer">
                    <Gift className="w-4 h-4 mr-3 text-neutral-400" />
                    <span className="text-sm text-neutral-900">Referrals</span>
                    <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                      New
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="px-3 py-2 cursor-pointer">
                    <CreditCard className="w-4 h-4 mr-3 text-neutral-400" />
                    <span className="text-sm text-neutral-900">Plans</span>
                    <ChevronRight className="w-4 h-4 ml-auto text-neutral-400" />
                  </DropdownMenuItem>
                  <DropdownMenuItem className="px-3 py-2 cursor-pointer">
                    <HelpCircle className="w-4 h-4 mr-3 text-neutral-400" />
                    <span className="text-sm text-neutral-900">Help</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="px-3 py-2 cursor-pointer">
                    <Trash2 className="w-4 h-4 mr-3 text-neutral-400" />
                    <span className="text-sm text-neutral-900">Trash</span>
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="px-3 py-2 cursor-pointer text-red-600 focus:text-red-600"
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  <span className="text-sm">Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-neutral-200 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow z-40"
          >
            <ChevronRight
              className={cn(
                'w-3.5 h-3.5 text-neutral-600 transition-transform duration-200',
                sidebarCollapsed && 'rotate-180'
              )}
            />
          </button>
        </aside>

        {/* Mobile Sidebar */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="px-4 py-4 border-b border-neutral-200/50">
              <SheetTitle className="text-left">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-[#006BFF] to-[#4F46E5] rounded-lg flex items-center justify-center mr-3">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-neutral-900">{agencyName || 'LoanSage'}</span>
                </div>
              </SheetTitle>
            </SheetHeader>
            <div className="px-3 py-4 space-y-1">
              {primaryNav.map((item) => (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center w-full px-3 py-2 rounded-lg transition-all',
                    activePath === item.id
                      ? 'bg-white text-[#006BFF] font-medium shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                  )}
                >
                  <item.icon className="w-4 h-4 mr-3" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              ))}
              <div className="pt-2 mt-2 border-t border-neutral-200">
                <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Records
                </div>
                {recordsNav.map((item) => (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center w-full px-3 py-2 rounded-lg transition-all',
                      activePath === item.id
                        ? 'bg-white text-[#006BFF] font-medium shadow-sm'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                    )}
                  >
                    <item.icon className="w-4 h-4 mr-3" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                ))}
              </div>
              <div className="pt-2 mt-2 border-t border-neutral-200">
                <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Management
                </div>
                {managementNav.map((item) => (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center w-full px-3 py-2 rounded-lg transition-all',
                      activePath === item.id
                        ? 'bg-white text-[#006BFF] font-medium shadow-sm'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                    )}
                  >
                    <item.icon className="w-4 h-4 mr-3" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                ))}
              </div>
              <div className="pt-2 mt-2 border-t border-neutral-200">
                <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  System
                </div>
                {systemNav.map((item) => (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center w-full px-3 py-2 rounded-lg transition-all',
                      activePath === item.id
                        ? 'bg-white text-[#006BFF] font-medium shadow-sm'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                    )}
                  >
                    <item.icon className="w-4 h-4 mr-3" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <main className={cn(
          'flex-1 flex flex-col min-h-0 overflow-hidden transition-[margin-left] duration-300 ease-in-out',
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        )}>
          {/* Header */}
          <header
            className={cn(
              'h-16 bg-white border-b border-neutral-200/50 flex items-center justify-between px-4 sm:px-8 z-20 sticky top-0 transition-all duration-300',
              scrolled && 'bg-white/95 backdrop-blur-sm shadow-sm'
            )}
          >
            <div className="flex items-center gap-4">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5 text-neutral-600" />
                  </Button>
                </SheetTrigger>
              </Sheet>
              <h1 className="text-xl font-semibold text-neutral-900 capitalize">
                {activePath.replace('-', ' ')}
              </h1>
            </div>

            <div className="flex items-center gap-3 sm:gap-6">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Global search..."
                  className="h-9 w-64 rounded-lg border border-neutral-200 bg-white pl-9 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF] transition-all"
                />
              </div>
              <NotificationDropdown />
              <Link
                to="/admin/settings"
                className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors rounded-lg hover:bg-neutral-50"
              >
                <Settings className="w-5 h-5" />
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                    <Avatar className="h-9 w-9 border-2 border-neutral-200">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback className="bg-gradient-to-br from-[#006BFF] to-[#4F46E5] text-white text-xs font-semibold">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold">{profile?.full_name || 'Admin User'}</p>
                      <p className="text-xs text-neutral-500">{profile?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin/settings" className="cursor-pointer">
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

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
            <div className="container mx-auto px-4 lg:px-8 xl:px-16 py-6 lg:py-8 max-w-7xl">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
