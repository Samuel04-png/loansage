import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
  children?: ReactNode;
}

/**
 * EmptyState - Component for displaying empty states with clear CTAs
 * 
 * Provides consistent empty state design across the app with:
 * - Large icon
 * - Clear title
 * - Helpful description
 * - Optional call-to-action button
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        "py-12 md:py-16 px-4",
        "text-center",
        className
      )}
    >
      <div
        className={cn(
          "w-16 h-16 md:w-20 md:h-20",
          "rounded-full",
          "bg-neutral-100 dark:bg-neutral-800",
          "flex items-center justify-center",
          "mb-4"
        )}
      >
        <Icon className="w-8 h-8 md:w-10 md:h-10 text-neutral-400 dark:text-neutral-500" />
      </div>
      
      <h3
        className={cn(
          "text-lg md:text-xl font-semibold",
          "text-neutral-900 dark:text-neutral-100",
          "mb-2"
        )}
      >
        {title}
      </h3>
      
      {description && (
        <p
          className={cn(
            "text-sm md:text-base",
            "text-neutral-600 dark:text-neutral-400",
            "max-w-md",
            "mb-6"
          )}
        >
          {description}
        </p>
      )}
      
      {action && (
        <Button
          onClick={action.onClick}
          className="min-h-[44px] px-6"
        >
          {action.icon && <action.icon className="w-4 h-4 mr-2" />}
          {action.label}
        </Button>
      )}
      
      {children && (
        <div className="mt-6 w-full max-w-md">
          {children}
        </div>
      )}
    </div>
  );
}

