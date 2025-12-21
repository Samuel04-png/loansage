import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Palette, Sun, Moon, Monitor, Check, Loader2 } from 'lucide-react';
import { useTheme } from '../../../components/providers/ThemeProvider';
import { useAgency } from '../../../hooks/useAgency';
import { useAuth } from '../../../hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { applyWhitelabelStyles } from '../../../lib/whitelabel';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

const themes = [
  { id: 'light', name: 'Light', icon: Sun, description: 'Clean and bright interface' },
  { id: 'dark', name: 'Dark', icon: Moon, description: 'Easy on the eyes' },
  { id: 'auto', name: 'Auto', icon: Monitor, description: 'Follows system preference' },
];

export function ThemesPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { agency, updateAgency } = useAgency();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(agency?.primary_color || '#006BFF');
  const [secondaryColor, setSecondaryColor] = useState(agency?.secondary_color || '#3B82FF');
  const [tertiaryColor, setTertiaryColor] = useState(agency?.tertiary_color || '#4F46E5');

  // Update local state when agency changes
  useEffect(() => {
    if (agency?.primary_color) setPrimaryColor(agency.primary_color);
    if (agency?.secondary_color) setSecondaryColor(agency.secondary_color);
    if (agency?.tertiary_color) setTertiaryColor(agency.tertiary_color);
  }, [agency?.primary_color, agency?.secondary_color, agency?.tertiary_color]);

  // Apply colors in real-time for preview
  useEffect(() => {
    if (primaryColor && secondaryColor) {
      applyWhitelabelStyles(primaryColor, secondaryColor, tertiaryColor);
    }
  }, [primaryColor, secondaryColor, tertiaryColor]);

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'auto') => {
    setTheme(newTheme);
    
    // Save to agency settings if admin
    if (profile?.role === 'admin' && agency?.id) {
      setSaving(true);
      try {
        await updateAgency({
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

  const handleColorSave = async () => {
    if (profile?.role !== 'admin' || !agency?.id) return;
    
    setSaving(true);
    try {
      await updateAgency({
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        tertiary_color: tertiaryColor,
      });
      
      // Immediately apply the colors to the UI
      applyWhitelabelStyles(primaryColor, secondaryColor, tertiaryColor);
      
      // Invalidate agency query to refresh data
      queryClient.invalidateQueries({ queryKey: ['agency', agency.id] });
      
      toast.success('Brand colors saved and applied successfully!');
    } catch (error: any) {
      console.error('Error saving colors:', error);
      toast.error('Failed to save brand colors');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-3">
          <Palette className="w-8 h-8 text-[#006BFF]" />
          Themes
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">Customize the appearance of your TengaLoans interface</p>
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
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{themeOption.name}</h3>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{themeOption.description}</p>
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
              <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                {theme === 'auto' ? 'Auto (System)' : theme.charAt(0).toUpperCase() + theme.slice(1)}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Currently using: {resolvedTheme.charAt(0).toUpperCase() + resolvedTheme.slice(1)} mode
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Colors */}
      {profile?.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Brand Colors</CardTitle>
            <CardDescription>Customize your agency's brand colors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="primaryColor"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-16 h-10 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#006BFF"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Used for primary buttons and accents</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="secondaryColor"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-16 h-10 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#3B82FF"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Used for secondary elements</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tertiaryColor">Tertiary Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="tertiaryColor"
                    value={tertiaryColor}
                    onChange={(e) => setTertiaryColor(e.target.value)}
                    className="w-16 h-10 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={tertiaryColor}
                    onChange={(e) => setTertiaryColor(e.target.value)}
                    placeholder="#4F46E5"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Used for accents and highlights</p>
              </div>
            </div>

            {/* Color Preview */}
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">Preview</p>
              <div className="flex gap-2">
                <div 
                  className="flex-1 h-12 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  Primary
                </div>
                <div 
                  className="flex-1 h-12 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm"
                  style={{ backgroundColor: secondaryColor }}
                >
                  Secondary
                </div>
                <div 
                  className="flex-1 h-12 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm"
                  style={{ backgroundColor: tertiaryColor }}
                >
                  Tertiary
                </div>
                <div 
                  className="flex-1 h-12 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm"
                  style={{ background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor}, ${tertiaryColor})` }}
                >
                  Gradient
                </div>
              </div>
            </div>

            <Button
              onClick={handleColorSave}
              disabled={saving}
              className="w-full bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Brand Colors'
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

