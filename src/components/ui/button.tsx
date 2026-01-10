import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', disabled, ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006BFF]/20 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
          {
            'bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white shadow-md hover:shadow-lg': variant === 'default',
            'bg-[#DC2626] text-white hover:bg-[#B91C1C] shadow-md hover:shadow-lg': variant === 'destructive',
            'border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 text-foreground': variant === 'outline',
            'bg-neutral-100 dark:bg-neutral-800 text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700': variant === 'secondary',
            'hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-foreground text-neutral-700 dark:text-neutral-300': variant === 'ghost',
            'text-[#006BFF] underline-offset-4 hover:underline hover:text-[#0052CC]': variant === 'link',
            'h-11 md:h-10 px-4 py-2.5 min-h-[44px] md:min-h-0': size === 'default', // 44px on mobile, 40px on desktop
            'h-10 md:h-9 px-3 py-2 text-xs min-h-[44px] md:min-h-0': size === 'sm', // 44px on mobile, 36px on desktop
            'h-12 md:h-11 px-8 py-3 text-base min-h-[44px]': size === 'lg', // 44px minimum
            'h-11 w-11 md:h-10 md:w-10 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-0': size === 'icon', // 44px on mobile, 40px on desktop
          },
          className
        )}
        ref={ref}
        disabled={disabled}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };

