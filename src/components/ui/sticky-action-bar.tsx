import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface StickyActionBarProps {
  children: ReactNode;
  className?: string;
  /**
   * Whether to show on mobile only (default: true)
   * Set to false to show on all screen sizes
   */
  mobileOnly?: boolean;
  /**
   * Additional padding bottom to account for bottom navigation
   * Default: true (adds pb-20 to account for bottom nav)
   */
  accountForBottomNav?: boolean;
}

/**
 * StickyActionBar - Sticky bottom bar for primary actions on mobile
 * 
 * Use this for primary actions that should be easily accessible on mobile.
 * Examples: "Create Loan", "Add Payment", "Save Changes"
 * 
 * Automatically hides on desktop (md breakpoint and above) unless mobileOnly is false
 */
export function StickyActionBar({ 
  children, 
  className,
  mobileOnly = true,
  accountForBottomNav = true,
}: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40",
        mobileOnly && "md:hidden",
        "bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800",
        "shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]",
        "px-4 py-3",
        "safe-area-bottom", // For devices with notches
        accountForBottomNav && "pb-20", // Account for bottom navigation
        className
      )}
    >
      <div className="container mx-auto max-w-7xl">
        {children}
      </div>
    </div>
  );
}

/**
 * Utility component to add bottom padding to content when sticky action bar is present
 */
export function StickyActionBarSpacer({ 
  mobileOnly = true,
  accountForBottomNav = true,
}: { 
  mobileOnly?: boolean;
  accountForBottomNav?: boolean;
}) {
  return (
    <div
      className={cn(
        mobileOnly && "md:hidden",
        accountForBottomNav ? "h-24" : "h-16" // pb-20 = 80px, but we use h-24 = 96px for better spacing
      )}
    />
  );
}

