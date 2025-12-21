import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
  showHome?: boolean;
}

/**
 * Breadcrumbs component for navigation hierarchy
 * Automatically generates breadcrumbs from current route if items not provided
 * Only shows on desktop (hidden on mobile to save space)
 */
export function Breadcrumbs({ 
  items, 
  className,
  showHome = true 
}: BreadcrumbsProps) {
  const location = useLocation();
  
  // Generate breadcrumbs from route if not provided
  const breadcrumbItems: BreadcrumbItem[] = items || (() => {
    const pathnames = location.pathname.split('/').filter((x) => x);
    const generated: BreadcrumbItem[] = [];
    
    // Add home
    if (showHome) {
      generated.push({ label: 'Home', href: '/admin/dashboard' });
    }
    
    // Generate from path segments
    let currentPath = '';
    pathnames.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathnames.length - 1;
      
      // Format label (capitalize, replace hyphens with spaces)
      const label = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      generated.push({
        label,
        href: isLast ? undefined : currentPath,
      });
    });
    
    return generated;
  })();
  
  if (breadcrumbItems.length === 0) {
    return null;
  }
  
  return (
    <nav
      className={cn(
        "hidden md:flex items-center space-x-1 text-sm text-neutral-600 dark:text-neutral-400",
        "mb-4",
        className
      )}
      aria-label="Breadcrumb"
    >
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;
        const isHome = item.label === 'Home';
        
        return (
          <div key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="w-4 h-4 mx-1 text-neutral-400" />
            )}
            
            {isLast ? (
              <span
                className={cn(
                  "font-medium text-neutral-900 dark:text-neutral-100",
                  isHome && "flex items-center gap-1"
                )}
                aria-current="page"
              >
                {isHome && <Home className="w-4 h-4" />}
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href || '#'}
                className={cn(
                  "hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors",
                  isHome && "flex items-center gap-1"
                )}
              >
                {isHome && <Home className="w-4 h-4" />}
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}

