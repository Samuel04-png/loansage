import { useWhitelabel } from '../../lib/whitelabel';
import { Building2 } from 'lucide-react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className = '', size = 'md' }: LogoProps) {
  const { logoUrl, agencyName } = useWhitelabel();

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const defaultLogo = '/logo/loansagelogo.png';
  const finalLogoUrl = logoUrl || defaultLogo;
  
  return (
    <>
      <img
        src={finalLogoUrl}
        alt={agencyName}
        className={`${sizeClasses[size]} ${className} object-contain`}
        onError={(e) => {
          // Fallback to icon if image fails to load
          (e.target as HTMLImageElement).style.display = 'none';
          const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
      <div className={`${sizeClasses[size]} bg-primary-600 rounded-lg flex items-center justify-center ${className} hidden`}>
        <Building2 className="text-white" style={{ width: '60%', height: '60%' }} />
      </div>
    </>
  );
}

