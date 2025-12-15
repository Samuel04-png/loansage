import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useAgency } from '../../../hooks/useAgency';
import { useWhitelabel } from '../../../lib/whitelabel';
import { Logo } from '../../../components/Logo';
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
  AlertCircle,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';
import { NotificationDropdown } from '../../../components/NotificationDropdown';
import { GlobalSearchDialog } from '../../../components/search/GlobalSearchDialog';
import { AIFloatingIndicator } from '../../../components/ai/AIFloatingIndicator';
import { AIChatPanel } from '../../../components/ai/AIChatPanel';
import { ThemeToggle } from '../../../components/ThemeToggle';
import { cn } from '../../../lib/utils';
import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader } from '../../../components/ui/dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { switchAgency } from '../../../lib/firebase/firestore-helpers';
import { AddAgencyDialog } from './AddAgencyDialog';

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { agency } = useAgency();
  const { logoUrl, agencyName } = useWhitelabel();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [updateNotificationDismissed, setUpdateNotificationDismissed] = useState(() => {
    return localStorage.getItem('update-notification-dismissed') === 'true';
  });
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [addAgencyDialogOpen, setAddAgencyDialogOpen] = useState(false);
  
  // Persist sidebar collapsed state in localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  
  // Persist AI chat panel state in localStorage (workspace-like behavior)
  const [aiChatPanelOpen, setAiChatPanelOpen] = useState(() => {
    const saved = localStorage.getItem('ai-chat-panel-open');
    return saved ? JSON.parse(saved) : false;
  });
  const [aiChatPanelWidth, setAiChatPanelWidth] = useState(0);

  // Save panel open state to localStorage
  useEffect(() => {
    localStorage.setItem('ai-chat-panel-open', JSON.stringify(aiChatPanelOpen));
  }, [aiChatPanelOpen]);
  
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

  // Global keyboard shortcut for search (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchDialogOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    { id: 'crm', label: 'CRM', icon: Users, path: '/admin/crm' },
    { id: 'invitations', label: 'Invitations', icon: Mail, path: '/admin/invitations' },
  ], []);

  const systemNav = useMemo(() => [
    { id: 'activity-logs', label: 'Activity Logs', icon: ClipboardList, path: '/admin/activity-logs' },
    { id: 'compliance', label: 'Compliance', icon: Shield, path: '/admin/compliance' },
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

  // Fetch user agencies for account switcher
  const { data: userAgencies = [], isLoading: agenciesLoading, refetch: refetchAgencies } = useQuery({
    queryKey: ['user-agencies', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { getUserAgencies } = await import('../../../lib/firebase/firestore-helpers');
      return getUserAgencies(profile.id);
    },
    enabled: !!profile?.id,
  });

  // Refresh agencies list when agency is updated (listen for storage event or use effect)
  useEffect(() => {
    const handleStorageChange = () => {
      refetchAgencies();
    };
    
    // Listen for custom event when agency is updated
    window.addEventListener('agency-updated', handleStorageChange);
    
    return () => {
      window.removeEventListener('agency-updated', handleStorageChange);
    };
  }, [refetchAgencies]);

  // Map agencies to workspace format with icons
  const workspaces = useMemo(() => {
    const icons = [Building2, Sparkles, Star, Settings, Gift, CreditCard];
    return userAgencies.map((agency, index) => ({
      id: agency.id,
      name: agency.name,
      icon: icons[index % icons.length],
      active: agency.isActive,
      memberCount: agency.memberCount,
    }));
  }, [userAgencies]);

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
            ? 'bg-white dark:bg-neutral-800 text-[#006BFF] dark:text-blue-400 font-medium shadow-sm border border-neutral-200/50 dark:border-neutral-700/50'
            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800'
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

    const hasToggle = title === 'Records' || title === 'Loan Management' || title === 'System';

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
      <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#0F172A]">
        {/* Premium Sidebar - Reference Style */}
        <aside
          className={cn(
            'hidden md:flex flex-col bg-white dark:bg-[#1E293B] fixed inset-y-0 z-30 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] transition-[width] duration-300 ease-in-out',
            sidebarCollapsed ? 'w-16' : 'w-64'
          )}
        >
          {/* Top Section - Logo/Company Name */}
          {!sidebarCollapsed && (
            <div className="h-16 flex items-center px-4 border-b border-neutral-200/50 dark:border-neutral-800/50">
              <div className="flex items-center flex-1 min-w-0">
                <Logo size="sm" showText={false} className="mr-3 flex-shrink-0" />
                <DropdownMenu open={showAccountSwitcher} onOpenChange={setShowAccountSwitcher}>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center flex-1 min-w-0 group">
                      <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {agencyName || 'TengaLoans'}
                      </span>
                      <ChevronDown className="w-4 h-4 ml-1.5 text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors flex-shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 ml-2">
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-neutral-200 dark:border-neutral-800">
                      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{profile?.email}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <RefreshCw className="w-3 h-3" />
                      </Button>
          </div>
                    <div className="py-1">
                      {agenciesLoading ? (
                        <div className="px-3 py-2 text-sm text-neutral-500">Loading...</div>
                      ) : workspaces.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-neutral-500">No agencies found</div>
                      ) : (
                        workspaces.map((workspace) => (
                          <DropdownMenuItem
                            key={workspace.id}
                            className={cn(
                              'flex items-center px-3 py-2 cursor-pointer',
                              workspace.active && 'bg-neutral-50 dark:bg-neutral-800'
                            )}
                            onClick={async () => {
                              if (!workspace.active && profile?.id) {
                                try {
                                  await switchAgency(profile.id, workspace.id);
                                  // Update user profile in auth store
                                  const { useAuthStore } = await import('../../../stores/authStore');
                                  const { setProfile } = useAuthStore.getState();
                                  setProfile({ ...profile, agency_id: workspace.id });
                                  // Refresh agency data
                                  const { useAgencyStore } = await import('../../../stores/agencyStore');
                                  const { fetchAgency } = useAgencyStore.getState();
                                  await fetchAgency(workspace.id);
                                  // Invalidate all queries to refresh data
                                  queryClient.invalidateQueries();
                                  toast.success(`Switched to ${workspace.name}`);
                                  setShowAccountSwitcher(false);
                                  // Reload page to ensure all data updates
                                  window.location.reload();
                                } catch (error: any) {
                                  toast.error(error.message || 'Failed to switch agency');
                                }
                              }
                            }}
                          >
                            <div className="w-6 h-6 rounded bg-gradient-to-br from-[#006BFF] to-[#4F46E5] flex items-center justify-center mr-3 flex-shrink-0">
                              <workspace.icon className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-neutral-900 dark:text-neutral-100 block truncate">{workspace.name}</span>
                              <span className="text-xs text-neutral-500 dark:text-neutral-400">{workspace.memberCount || 0} members</span>
                            </div>
                            {workspace.active && (
                              <Check className="w-4 h-4 text-[#006BFF] dark:text-blue-400 ml-2 flex-shrink-0" />
                            )}
                          </DropdownMenuItem>
                        ))
                      )}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="px-3 py-2 cursor-pointer"
                      onClick={() => {
                        setShowAccountSwitcher(false);
                        setAddAgencyDialogOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-3 text-neutral-400 dark:text-neutral-500" />
                      <span className="text-sm text-neutral-600 dark:text-neutral-300">Add agency</span>
                      <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">⌘A</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                  {workspaces.find(w => w.active)?.memberCount || 0} members
                </div>
                <ExternalLink className="w-3.5 h-3.5 ml-2 text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
              </div>
            </div>
          )}

          {/* Search Bar */}
          {!sidebarCollapsed && (
            <div className="px-4 py-3 border-b border-neutral-200/50">
              <button
                onClick={() => setSearchDialogOpen(true)}
                className="w-full relative"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search loans, customers, employees..."
                    readOnly
                    className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 cursor-pointer hover:border-[#006BFF] dark:hover:border-blue-500 transition-all"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400 font-mono">
                    ⌘K
                  </div>
                </div>
              </button>
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
                  title="Loan Management" 
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
          <div className="p-4 border-t border-neutral-200/50 dark:border-neutral-800/50 space-y-3">
            {/* New Version Banner */}
            {!sidebarCollapsed && !updateNotificationDismissed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 shadow-sm dark:shadow-lg relative"
              >
                <button
                  onClick={() => {
                    setUpdateNotificationDismissed(true);
                    localStorage.setItem('update-notification-dismissed', 'true');
                  }}
                  className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 rounded transition-colors"
                  aria-label="Dismiss update notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-[#006BFF] to-[#4F46E5] rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-1">New version available</h4>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
                      An improved version of TengaLoans is available. Please restart now to upgrade.
                    </p>
                    <button 
                      onClick={() => setUpdateModalOpen(true)}
                      className="text-xs font-medium text-[#006BFF] dark:text-blue-400 hover:text-[#0052CC] dark:hover:text-blue-300 transition-colors"
                    >
                      View Update →
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* User Profile */}
            <DropdownMenu open={showUserMenu} onOpenChange={setShowUserMenu}>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group">
                  <Avatar className="h-8 w-8 border-2 border-neutral-200 dark:border-neutral-700">
                    <AvatarImage src={(profile as any)?.photoURL || (profile as any)?.photo_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-[#006BFF] to-[#4F46E5] text-white text-xs font-semibold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  {!sidebarCollapsed && (
                    <>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {profile?.full_name || 'Admin User'}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{profile?.email}</p>
            </div>
                      <ChevronDown className="w-4 h-4 text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors flex-shrink-0" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 ml-2">
                <div className="px-3 py-3 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-neutral-200 dark:border-neutral-700">
                      <AvatarImage src={(profile as any)?.photoURL || (profile as any)?.photo_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-[#006BFF] to-[#4F46E5] text-white text-sm font-semibold">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                {profile?.full_name || 'Admin User'}
              </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Online</p>
                    </div>
            </div>
          </div>
                <div className="py-1">
                  <DropdownMenuItem asChild>
                    <Link to="/admin/themes" className="px-3 py-2 cursor-pointer">
                      <Palette className="w-4 h-4 mr-3 text-neutral-400 dark:text-neutral-500" />
                      <span className="text-sm text-neutral-900 dark:text-neutral-100">Themes</span>
                      <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">⌘T</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/settings" className="px-3 py-2 cursor-pointer">
                      <Settings className="w-4 h-4 mr-3 text-neutral-400 dark:text-neutral-500" />
                      <span className="text-sm text-neutral-900 dark:text-neutral-100">Settings</span>
                      <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">⌘S</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/notifications" className="px-3 py-2 cursor-pointer">
                      <Bell className="w-4 h-4 mr-3 text-neutral-400 dark:text-neutral-500" />
                      <span className="text-sm text-neutral-900 dark:text-neutral-100">Notification</span>
                      <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">⌘N</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/hotkeys" className="px-3 py-2 cursor-pointer">
                      <Keyboard className="w-4 h-4 mr-3 text-neutral-400" />
                      <span className="text-sm text-neutral-900">Hotkeys</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/download-apps" className="px-3 py-2 cursor-pointer">
                      <Download className="w-4 h-4 mr-3 text-neutral-400" />
                      <span className="text-sm text-neutral-900">Download apps</span>
                      <ChevronRight className="w-4 h-4 ml-auto text-neutral-400" />
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/referrals" className="px-3 py-2 cursor-pointer">
                      <Gift className="w-4 h-4 mr-3 text-neutral-400" />
                      <span className="text-sm text-neutral-900">Referrals</span>
                      <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                        New
                      </span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/plans" className="px-3 py-2 cursor-pointer">
                      <CreditCard className="w-4 h-4 mr-3 text-neutral-400" />
                      <span className="text-sm text-neutral-900">Plans</span>
                      <ChevronRight className="w-4 h-4 ml-auto text-neutral-400" />
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/help" className="px-3 py-2 cursor-pointer">
                      <HelpCircle className="w-4 h-4 mr-3 text-neutral-400" />
                      <span className="text-sm text-neutral-900">Help</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/trash" className="px-3 py-2 cursor-pointer">
                      <Trash2 className="w-4 h-4 mr-3 text-neutral-400" />
                      <span className="text-sm text-neutral-900">Trash</span>
                    </Link>
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
                <Logo size="sm" showText={true} />
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
                  Loan Management
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

      {/* Main Content Area with AI Panel - Fixed height container */}
      <div className={cn(
        'flex-1 flex h-screen overflow-hidden transition-[margin-left] duration-300 ease-in-out',
        sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
      )}>
        {/* Main Content - Shrinks when panel is open */}
        <main className={cn(
          'flex-1 flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out'
        )}>
        {/* Header */}
          <header
            className={cn(
              'h-16 bg-white dark:bg-[#1E293B] border-b border-neutral-200/50 dark:border-neutral-800/50 flex items-center justify-between px-4 sm:px-8 z-20 sticky top-0 transition-all duration-300',
              scrolled && 'bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-sm shadow-sm'
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
              {/* Search Button */}
              <button
                onClick={() => setSearchDialogOpen(true)}
                className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:border-[#006BFF] hover:text-[#006BFF] transition-colors"
                title="Search (⌘K)"
              >
                <Search className="w-4 h-4" />
                <span className="text-sm">Search</span>
                <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-1.5 font-mono text-[10px] font-medium text-neutral-500">
                  ⌘K
                </kbd>
              </button>
              
              {/* AI Floating Indicator - Cursor/VSCode Style */}
              <AIFloatingIndicator onChatOpen={() => setAiChatPanelOpen(!aiChatPanelOpen)} />
              
              {/* Theme Toggle */}
              <ThemeToggle />
              
              <NotificationDropdown />
              <Link
                to="/admin/settings"
                className="p-2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
              <Settings className="w-5 h-5" />
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                    <Avatar className="h-9 w-9 border-2 border-neutral-200">
                      <AvatarImage src={(profile as any)?.photoURL || (profile as any)?.photo_url || undefined} />
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

          {/* Scrollable Content Area - Independent scroll */}
          <div 
            className="flex-1 overflow-y-auto bg-[#F8FAFC] dark:bg-[#0F172A]"
            style={{ 
              overscrollBehavior: 'contain',
              // Preserve scroll position when panel opens/closes
              scrollBehavior: 'auto'
            }}
          >
            <div className="container mx-auto px-4 lg:px-8 xl:px-16 py-6 lg:py-8 max-w-7xl">
            <Outlet />
          </div>
        </div>
      </main>

      {/* AI Chat Panel - Side Panel */}
      <AIChatPanel 
        open={aiChatPanelOpen} 
        onOpenChange={setAiChatPanelOpen}
        onWidthChange={setAiChatPanelWidth}
      />
      </div>
      </div>

      {/* Update Details Modal */}
      <Dialog open={updateModalOpen} onOpenChange={setUpdateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-[#006BFF] to-[#4F46E5] rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">What's New in TengaLoans</h2>
                <p className="text-sm text-slate-600">Version 2.2.0 - Latest Updates</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Major Features */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#006BFF]" />
                Major Features
              </h3>
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <h4 className="font-semibold text-slate-900 mb-1">📊 Excel Import/Export</h4>
                  <p className="text-sm text-slate-600">
                    Import and export loans, customers, and employees using Excel (.xlsx) or CSV files. Bulk import with automatic data validation and error reporting.
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <h4 className="font-semibold text-slate-900 mb-1">💰 Bank Reconciliation</h4>
                  <p className="text-sm text-slate-600">
                    Automatically match bank statement transactions with loan repayments. Upload CSV or Excel files to reconcile payments and update loan statuses automatically.
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                  <h4 className="font-semibold text-slate-900 mb-1">🤖 Enhanced AI Features</h4>
                  <p className="text-sm text-slate-600">
                    Improved Byte&Berry Copilot AI integration with connection testing, better error handling, and AI-powered risk assessment, collateral valuation, and smart recommendations.
                  </p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                  <h4 className="font-semibold text-slate-900 mb-1">💳 Stripe Payment Integration</h4>
                  <p className="text-sm text-slate-600">
                    Seamless subscription management with Stripe. Free 30-day trial, automatic plan upgrades, and payment history tracking.
                  </p>
                </div>
              </div>
            </div>

            {/* Improvements */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-600" />
                Improvements
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>Enhanced loan management with tabbed interface and advanced filtering</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>Improved repayment system with automatic balance calculations</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>Better CSV parsing with support for quoted fields and commas</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>Enhanced bank reconciliation with intelligent transaction matching</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>Profile picture support for users and company profiles</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>AI Settings tab with connection testing and status monitoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>Improved loan details page with comprehensive overview tabs</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>Better data export with Excel format support</span>
                </li>
              </ul>
            </div>

            {/* Bug Fixes */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Bug Fixes
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>Fixed dashboard stats accuracy - portfolio value now calculated from actual loan amounts</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>Corrected active customers and total customers display on dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>Fixed chart data calculations for accurate monthly disbursement tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>Resolved total loans count to show all loans instead of just active</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>Fixed remaining balance calculation for amortized loans</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>Resolved 404 errors on loan detail pages</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>Fixed Firestore permission issues for employees</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>Corrected Stripe checkout flow and plan status updates</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                onClick={() => {
                  setUpdateModalOpen(false);
                  localStorage.setItem('update-notification-dismissed', 'true');
                  setUpdateNotificationDismissed(true);
                }}
                className="bg-gradient-to-r from-[#006BFF] to-[#4F46E5] hover:from-[#0052CC] hover:to-[#4338CA] text-white border-0"
              >
                Got it!
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Agency Dialog */}
      <AddAgencyDialog 
        open={addAgencyDialogOpen} 
        onOpenChange={(open) => {
          setAddAgencyDialogOpen(open);
          // Refresh agencies list when dialog closes (in case agency was created)
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ['user-agencies'] });
          }
        }} 
      />

      {/* Global Search Dialog */}
      <GlobalSearchDialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen} />
    </TooltipProvider>
  );
}
