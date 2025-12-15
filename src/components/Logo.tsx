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
    sm: 'h-14 w-14',
    md: 'h-20 w-20',
    lg: 'h-24 w-24',
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
          if (!target.src.includes('/logo/tengaloanlogo.png')) {
            target.src = '/logo/tengaloanlogo.png';
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

