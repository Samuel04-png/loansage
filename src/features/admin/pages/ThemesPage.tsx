import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Palette, Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme } from '../../../components/providers/ThemeProvider';
import { useAgency } from '../../../hooks/useAgency';
import { updateAgency } from '../../../lib/firebase/firestore-helpers';
import { useAuth } from '../../../hooks/useAuth';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

const themes = [
  { id: 'light', name: 'Light', icon: Sun, description: 'Clean and bright interface' },
  { id: 'dark', name: 'Dark', icon: Moon, description: 'Easy on the eyes' },
  { id: 'auto', name: 'Auto', icon: Monitor, description: 'Follows system preference' },
];

export function ThemesPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { agency } = useAgency();
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'auto') => {
    setTheme(newTheme);
    
    // Save to agency settings if admin
    if (profile?.role === 'admin' && agency?.id) {
      setSaving(true);
      try {
        await updateAgency(agency.id, {
          theme_mode: newTheme,
        });
        toast.success('Theme preference saved');
      } catch (error: any) {
        console.error('Error saving theme:', error);
        toast.error('Failed to save theme preference');
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
          <Palette className="w-8 h-8 text-[#006BFF]" />
          Themes
        </h1>
        <p className="text-neutral-600 mt-2">Customize the appearance of your LoanSage interface</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Choose Theme</CardTitle>
          <CardDescription>Select your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {themes.map((themeOption) => {
              const Icon = themeOption.icon;
              const isSelected = theme === themeOption.id;
              
              return (
                <motion.button
                  key={themeOption.id}
                  onClick={() => handleThemeChange(themeOption.id as 'light' | 'dark' | 'auto')}
                  disabled={saving}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`
                    relative p-6 rounded-xl border-2 transition-all
                    ${isSelected 
                      ? 'border-[#006BFF] bg-[#006BFF]/5 shadow-lg' 
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }
                  `}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-[#006BFF] rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-3">
                    <div className={`
                      w-16 h-16 rounded-full flex items-center justify-center
                      ${isSelected ? 'bg-[#006BFF]' : 'bg-neutral-100'}
                    `}>
                      <Icon className={`w-8 h-8 ${isSelected ? 'text-white' : 'text-neutral-600'}`} />
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-neutral-900">{themeOption.name}</h3>
                      <p className="text-sm text-neutral-500 mt-1">{themeOption.description}</p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Theme</CardTitle>
          <CardDescription>Your active theme preference</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-lg">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center
              ${resolvedTheme === 'dark' ? 'bg-neutral-800' : 'bg-white'}
            `}>
              {resolvedTheme === 'dark' ? (
                <Moon className="w-6 h-6 text-white" />
              ) : (
                <Sun className="w-6 h-6 text-neutral-900" />
              )}
            </div>
            <div>
              <p className="font-semibold text-neutral-900">
                {theme === 'auto' ? 'Auto (System)' : theme.charAt(0).toUpperCase() + theme.slice(1)}
              </p>
              <p className="text-sm text-neutral-500">
                Currently using: {resolvedTheme.charAt(0).toUpperCase() + resolvedTheme.slice(1)} mode
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

