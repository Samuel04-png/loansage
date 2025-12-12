import { useAgency } from '../hooks/useAgency';

export function useWhitelabel() {
  const { agency } = useAgency();

  const getPrimaryColor = () => {
    return agency?.primary_color || '#0ea5e9';
  };

  const getSecondaryColor = () => {
    return agency?.secondary_color || '#0284c7';
  };

  const getLogoUrl = () => {
    return agency?.logo_url || agency?.logoURL || '/logo/loansagelogo.png';
  };

  const getAgencyName = () => {
    return agency?.name || 'LoanSage';
  };

  return {
    primaryColor: getPrimaryColor(),
    secondaryColor: getSecondaryColor(),
    logoUrl: getLogoUrl(),
    agencyName: getAgencyName(),
    agency,
  };
}

export function applyWhitelabelStyles(
  primaryColor: string, 
  secondaryColor: string,
  tertiaryColor?: string
) {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  try {
    // Convert hex to HSL and set CSS variables
    const primaryHsl = hexToHsl(primaryColor);
    const secondaryHsl = hexToHsl(secondaryColor);
    const tertiaryHsl = tertiaryColor ? hexToHsl(tertiaryColor) : secondaryHsl;
    
    // Set HSL values for Tailwind
    root.style.setProperty('--primary', primaryHsl);
    root.style.setProperty('--primary-foreground', '0 0% 100%');
    root.style.setProperty('--secondary', secondaryHsl);
    root.style.setProperty('--tertiary', tertiaryHsl);
    root.style.setProperty('--accent', tertiaryHsl);
    root.style.setProperty('--ring', primaryHsl);
    
    // Also set as hex values for direct use
    root.style.setProperty('--agency-primary', primaryColor);
    root.style.setProperty('--agency-secondary', secondaryColor);
    root.style.setProperty('--agency-tertiary', tertiaryColor || secondaryColor);
    
    // Generate lighter/darker variants for dark mode
    const primaryHslValues = primaryHsl.split(' ');
    const primaryLight = `${primaryHslValues[0]} ${primaryHslValues[1]} ${Math.min(95, parseInt(primaryHslValues[2]) + 10)}%`;
    const primaryDark = `${primaryHslValues[0]} ${primaryHslValues[1]} ${Math.max(20, parseInt(primaryHslValues[2]) - 10)}%`;
    
    root.style.setProperty('--primary-light', primaryLight);
    root.style.setProperty('--primary-dark', primaryDark);
  } catch (error) {
    console.warn('Failed to apply whitelabel styles:', error);
  }
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

