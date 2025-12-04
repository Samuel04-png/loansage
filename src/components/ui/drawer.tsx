import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

interface DrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  side?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

interface DrawerContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const DrawerContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}>({
  open: false,
  onOpenChange: () => {},
  side: 'right',
  size: 'md',
});

export function Drawer({ open = false, onOpenChange, children, side = 'right', size = 'md' }: DrawerProps) {
  return (
    <DrawerContext.Provider value={{ open, onOpenChange: onOpenChange || (() => {}), side, size }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function DrawerContent({ className, children, ...props }: DrawerContentProps) {
  const { open, onOpenChange, side = 'right', size = 'md' } = React.useContext(DrawerContext);

  if (!open) return null;

  const sizeClasses = {
    sm: 'w-full max-w-sm',
    md: 'w-full max-w-md',
    lg: 'w-full max-w-lg',
    xl: 'w-full max-w-2xl',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange(false)}
        style={{ zIndex: 9998 }}
      />
      
      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 z-50 bg-white shadow-xl transition-transform duration-300 ease-in-out',
          'flex flex-col overflow-hidden',
          side === 'right' ? 'right-0' : 'left-0',
          sizeClasses[size],
          className
        )}
        style={{ zIndex: 9999 }}
        {...props}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 z-10"
          onClick={() => onOpenChange(false)}
        >
          <X className="w-4 h-4" />
        </Button>
        {children}
      </div>
    </>
  );
}

export function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-4 border-b border-slate-200', className)} {...props} />;
}

export function DrawerTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold text-slate-900', className)} {...props} />;
}

export function DrawerDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-slate-600 mt-1', className)} {...props} />;
}

export function DrawerBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-y-auto px-6 py-4', className)} {...props} />;
}

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-4 border-t border-slate-200 flex gap-3', className)} {...props} />;
}

