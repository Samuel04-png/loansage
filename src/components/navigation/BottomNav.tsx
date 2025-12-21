import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

export interface BottomNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: number;
}

interface BottomNavProps {
  items: BottomNavItem[];
  className?: string;
}

/**
 * Bottom Navigation for Mobile
 * Displays key navigation items at the bottom of the screen on mobile devices
 * Automatically hides on desktop (md breakpoint and above)
 */
export function BottomNav({ items, className }: BottomNavProps) {
  const location = useLocation();
  
  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "md:hidden",
        "bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800",
        "shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]",
        "safe-area-bottom", // For devices with notches
        className
      )}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
                          location.pathname.startsWith(item.path + '/');
          
          return (
            <Link
              key={item.id}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center",
                "flex-1 h-full min-h-[44px]",
                "transition-all duration-200",
                "relative",
                isActive
                  ? "text-[#006BFF] dark:text-blue-400"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "w-5 h-5 mb-1 transition-transform",
                    isActive && "scale-110"
                  )}
                />
                {item.badge && item.badge > 0 && (
                  <span
                    className={cn(
                      "absolute -top-1 -right-1",
                      "min-w-[18px] h-[18px] px-1",
                      "flex items-center justify-center",
                      "text-[10px] font-semibold text-white",
                      "bg-red-500 rounded-full",
                      "border-2 border-white dark:border-neutral-900"
                    )}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium mt-0.5",
                  isActive && "font-semibold"
                )}
              >
                {item.label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#006BFF] dark:bg-blue-400 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Hook to determine if bottom nav should be visible
 * Useful for adding bottom padding to content when bottom nav is shown
 */
export function useBottomNav() {
  return {
    isVisible: true, // Always visible on mobile
    height: 64, // h-16 = 64px
  };
}

