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
    sm: 'md:w-full md:max-w-sm',
    md: 'md:w-full md:max-w-md',
    lg: 'md:w-full md:max-w-lg',
    xl: 'md:w-full md:max-w-2xl',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-neutral-900/80 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange(false)}
        style={{ zIndex: 9998 }}
      />
      
      {/* Drawer - Full screen on mobile, side drawer on desktop */}
      <div
        className={cn(
          'fixed inset-y-0 z-50',
          'bg-white dark:bg-neutral-900 shadow-xl transition-transform duration-300 ease-in-out',
          'flex flex-col overflow-hidden',
          'w-full', // Full width on mobile
          side === 'right' ? 'right-0' : 'left-0',
          sizeClasses[size], // Apply max-width only on desktop
          className
        )}
        style={{ zIndex: 9999 }}
        {...props}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 z-10 h-11 w-11 md:h-10 md:w-10"
          onClick={() => onOpenChange(false)}
          aria-label="Close drawer"
        >
          <X className="w-5 h-5 md:w-4 md:h-4" />
        </Button>
        {children}
      </div>
    </>
  );
}

export function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        'px-4 md:px-6 py-4 border-b border-neutral-200 dark:border-neutral-800',
        'safe-area-top', // Account for device notches
        className
      )} 
      {...props} 
    />
  );
}

export function DrawerTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
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

export function DrawerDescription({
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

export function DrawerBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        'flex-1 overflow-y-auto px-4 md:px-6 py-4',
        className
      )} 
      {...props} 
    />
  );
}

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        'px-4 md:px-6 py-4 border-t border-neutral-200 dark:border-neutral-800',
        'flex flex-col sm:flex-row gap-3',
        'safe-area-bottom', // Account for device notches
        className
      )} 
      {...props} 
    />
  );
}

