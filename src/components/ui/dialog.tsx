import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const DialogContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({
  open: false,
  onOpenChange: () => {},
});

export function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange: onOpenChange || (() => {}) }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogContent({ className, children, ...props }: DialogContentProps) {
  const { open, onOpenChange } = React.useContext(DialogContext);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-0">
      <div
        className="fixed inset-0 bg-slate-900/50 dark:bg-neutral-900/80 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          'relative z-50 w-full',
          'bg-white dark:bg-neutral-900 rounded-lg md:rounded-lg shadow-lg dark:shadow-2xl',
          'p-4 md:p-6',
          'border border-neutral-200 dark:border-neutral-800',
          'max-w-lg', // Constrain width on desktop
          'max-h-[90vh] md:max-h-[85vh] overflow-y-auto', // Prevent overflow on mobile
          className
        )}
        {...props}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 md:right-4 md:top-4 h-11 w-11 md:h-10 md:w-10"
          onClick={() => onOpenChange(false)}
          aria-label="Close dialog"
        >
          <X className="w-5 h-5 md:w-4 md:h-4" />
        </Button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 pr-8 md:pr-0', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 
      className={cn(
        'text-lg md:text-xl font-semibold text-neutral-900 dark:text-neutral-100',
        className
      )} 
      {...props} 
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p 
      className={cn(
        'text-sm text-neutral-600 dark:text-neutral-400 mt-1',
        className
      )} 
      {...props} 
    />
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        'flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6',
        className
      )} 
      {...props} 
    />
  );
}

