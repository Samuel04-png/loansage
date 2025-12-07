import { useWhitelabel } from '../lib/whitelabel';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, showText = true, size = 'md' }: LogoProps) {
  const { logoUrl, agencyName } = useWhitelabel();

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img
        src={logoUrl}
        alt={`${agencyName} Logo`}
        className={cn(
          'object-contain',
          sizeClasses[size],
          'max-w-full'
        )}
        onError={(e) => {
          // Fallback to default logo if custom logo fails to load
          const target = e.target as HTMLImageElement;
          if (!target.src.includes('/logo/loansagelogo.png')) {
            target.src = '/logo/loansagelogo.png';
          }
        }}
      />
      {showText && (
        <span className={cn('font-semibold text-neutral-900', textSizeClasses[size])}>
          {agencyName}
        </span>
      )}
    </div>
  );
}

