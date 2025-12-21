import { AlertCircle, X } from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './button';

interface ErrorMessageProps {
  title?: string;
  message: string;
  actions?: {
    label: string;
    onClick: () => void;
  }[];
  onDismiss?: () => void;
  className?: string;
  variant?: 'error' | 'warning' | 'info';
}

/**
 * ErrorMessage - Human-readable error messages with actionable suggestions
 * 
 * Provides consistent error handling UX across the app:
 * - Clear title and description
 * - Suggested next steps/actions
 * - Dismissible (optional)
 */
export function ErrorMessage({
  title,
  message,
  actions,
  onDismiss,
  className,
  variant = 'error',
}: ErrorMessageProps) {
  const variantStyles = {
    error: {
      container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      icon: 'text-red-600 dark:text-red-400',
      title: 'text-red-900 dark:text-red-100',
      message: 'text-red-700 dark:text-red-300',
    },
    warning: {
      container: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
      icon: 'text-amber-600 dark:text-amber-400',
      title: 'text-amber-900 dark:text-amber-100',
      message: 'text-amber-700 dark:text-amber-300',
    },
    info: {
      container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      icon: 'text-blue-600 dark:text-blue-400',
      title: 'text-blue-900 dark:text-blue-100',
      message: 'text-blue-700 dark:text-blue-300',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        styles.container,
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className={cn('w-5 h-5 flex-shrink-0 mt-0.5', styles.icon)} />
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={cn('font-semibold mb-1', styles.title)}>
              {title}
            </h4>
          )}
          <p className={cn('text-sm', styles.message)}>
            {message}
          </p>
          {actions && actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={action.onClick}
                  className={cn(
                    'min-h-[44px] md:min-h-0',
                    variant === 'error' && 'border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30',
                    variant === 'warning' && 'border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30',
                    variant === 'info' && 'border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30',
                  )}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className={cn(
              'h-8 w-8 flex-shrink-0',
              styles.icon,
              'hover:bg-transparent'
            )}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * InlineError - Small inline error message for form fields
 */
interface InlineErrorProps {
  message: string;
  className?: string;
}

export function InlineError({ message, className }: InlineErrorProps) {
  return (
    <p className={cn('text-sm text-red-600 dark:text-red-400 mt-1', className)}>
      {message}
    </p>
  );
}

