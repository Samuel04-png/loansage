import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { applyWhitelabelStyles } from '../../lib/whitelabel';
import { useAgencyStore } from '../../stores/agencyStore';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // Use agency store directly instead of useAgency hook to avoid dependency chain
  // This makes ThemeProvider more resilient to auth errors
  const agency = useAgencyStore((state) => state.agency);
  
  // Initialize theme from localStorage or agency settings
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('tengaloans-theme') as Theme;
      if (stored && ['light', 'dark', 'auto'].includes(stored)) {
        return stored;
      }
    }
    return 'light'; // Default to light, agency settings will apply later
  });
  
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Sync with agency settings
  useEffect(() => {
    if (agency?.theme_mode) {
      setThemeState(agency.theme_mode as Theme);
      if (typeof window !== 'undefined') {
        localStorage.setItem('tengaloans-theme', agency.theme_mode);
      }
    }
  }, [agency?.theme_mode]);

  // Apply white-label colors (including tertiary)
  useEffect(() => {
    if (agency?.primary_color && agency?.secondary_color) {
      applyWhitelabelStyles(
        agency.primary_color, 
        agency.secondary_color,
        agency.tertiary_color
      );
    }
  }, [agency?.primary_color, agency?.secondary_color, agency?.tertiary_color]);

  // Apply theme with smooth transitions
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Add transition class for smooth theme changes
    root.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    
    const updateTheme = () => {
      let isDark = false;
      
      if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        isDark = prefersDark;
        setResolvedTheme(prefersDark ? 'dark' : 'light');
      } else {
        isDark = theme === 'dark';
        setResolvedTheme(theme);
      }
      
      root.classList.toggle('dark', isDark);
    };

    updateTheme();

    // Listen for system theme changes when in auto mode
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updateTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // Save theme to localStorage
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tengaloans-theme', newTheme);
    }
  }, []);

  // Toggle between light and dark (skip auto for quick toggle)
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
  }, [resolvedTheme, setTheme]);

  // Always provide a valid context value
  const contextValue: ThemeContextType = {
    theme,
    setTheme,
    resolvedTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// Default theme values for fallback
const defaultThemeContext: ThemeContextType = {
  theme: 'light',
  setTheme: () => {},
  resolvedTheme: 'light',
  toggleTheme: () => {},
};

export function useTheme() {
  const context = useContext(ThemeContext);
  
  // Return default values instead of throwing if context is not available
  // This prevents crashes during error recovery or when rendered outside provider
  if (context === undefined) {
    console.warn('useTheme called outside ThemeProvider, using defaults');
    return defaultThemeContext;
  }
  
  return context;
}
