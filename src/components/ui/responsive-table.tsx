import * as React from "react";
import { cn } from "../../lib/utils";

interface TableCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * TableCard - Card layout for table rows on mobile
 * Use this as a wrapper component when creating mobile-friendly tables
 */
export function TableCard({ children, onClick, className }: TableCardProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 shadow-sm",
        "md:hidden",
        onClick && "cursor-pointer active:scale-[0.98] transition-transform hover:shadow-md",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface TableCardRowProps {
  label?: string;
  value: React.ReactNode;
  className?: string;
  valueClassName?: string;
  align?: 'left' | 'right' | 'center';
}

/**
 * TableCardRow - Individual row within a table card
 * Use this to create labeled data rows in mobile card layout
 */
export function TableCardRow({ 
  label, 
  value, 
  className,
  valueClassName,
  align = 'left'
}: TableCardRowProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0", className)}>
      {label && (
        <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 flex-shrink-0">
          {label}
        </span>
      )}
      <div
        className={cn(
          "flex-1 min-w-0",
          align === 'right' && "text-right",
          align === 'center' && "text-center",
          valueClassName
        )}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * ResponsiveTableWrapper - Wraps a table to show cards on mobile
 * 
 * Usage:
 * <ResponsiveTableWrapper headers={['Name', 'Email', 'Status']}>
 *   <Table>
 *     <TableHeader>...</TableHeader>
 *     <TableBody>
 *       <TableRow>
 *         <TableCell>...</TableCell>
 *       </TableRow>
 *     </TableBody>
 *   </Table>
 *   Mobile cards section:
 *   <div className="md:hidden space-y-3">
 *     <TableCard>...</TableCard>
 *   </div>
 * </ResponsiveTableWrapper>
 */
interface ResponsiveTableWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveTableWrapper({ children, className }: ResponsiveTableWrapperProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Desktop: Show table */}
      <div className="hidden md:block overflow-x-auto">
        {React.Children.toArray(children).find((child) => 
          React.isValidElement(child) && child.type === 'table'
        )}
      </div>
      
      {/* Mobile: Show cards */}
      <div className="md:hidden">
        {React.Children.toArray(children).filter((child) =>
          React.isValidElement(child) && child.type !== 'table'
        )}
      </div>
    </div>
  );
}

