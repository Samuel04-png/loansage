import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-xl text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006BFF]/20 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
          {
            'bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white shadow-md hover:shadow-lg': variant === 'default',
            'bg-[#EF4444] text-white hover:bg-[#DC2626] shadow-md hover:shadow-lg': variant === 'destructive',
            'border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-neutral-300 text-neutral-900': variant === 'outline',
            'bg-neutral-100 text-neutral-900 hover:bg-neutral-200': variant === 'secondary',
            'hover:bg-neutral-100 hover:text-neutral-900 text-neutral-700': variant === 'ghost',
            'text-[#006BFF] underline-offset-4 hover:underline hover:text-[#0052CC]': variant === 'link',
            'h-10 px-4 py-2': size === 'default',
            'h-9 px-3 text-xs': size === 'sm',
            'h-11 px-8 text-base': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };

