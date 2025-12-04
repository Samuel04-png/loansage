import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAgency } from '../../hooks/useAgency';
import { applyWhitelabelStyles } from '../../lib/whitelabel';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { agency } = useAgency();
  const [theme, setTheme] = useState<Theme>(
    (agency?.theme_mode as Theme) || 'light'
  );
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (agency?.theme_mode) {
      setTheme(agency.theme_mode as Theme);
    }
  }, [agency?.theme_mode]);

  // Apply white-label colors
  useEffect(() => {
    if (agency?.primary_color && agency?.secondary_color) {
      applyWhitelabelStyles(agency.primary_color, agency.secondary_color);
    }
  }, [agency?.primary_color, agency?.secondary_color]);

  useEffect(() => {
    const root = window.document.documentElement;
    
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setResolvedTheme(prefersDark ? 'dark' : 'light');
      root.classList.toggle('dark', prefersDark);
    } else {
      setResolvedTheme(theme);
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

