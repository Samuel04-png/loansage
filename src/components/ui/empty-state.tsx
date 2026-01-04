import * as React from 'react';
import { ReactNode } from 'react';
import { Button } from './button';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-4 text-center",
      className
    )}>
      {icon && (
        <div className="mb-5 text-neutral-400 dark:text-neutral-500">
          {typeof icon === 'string' ? icon : React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { 
            className: 'w-12 h-12',
            strokeWidth: 1.5 
          }) : icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 max-w-md leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="default" size="default">
          {action.label}
        </Button>
      )}
    </div>
  );
}
