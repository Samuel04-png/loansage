/**
 * Security Settings Page
 * 2FA, IP Whitelisting, Password Policies, etc.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { useAgency } from '../../../hooks/useAgency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Shield, Smartphone, Globe, Lock, CheckCircle2, XCircle, Plus, Trash2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { enable2FA, disable2FA, get2FAStatus } from '../../../lib/security/two-factor-auth';
import { getIPWhitelist, updateIPWhitelist } from '../../../lib/security/ip-whitelist';
import { AITaskSettings } from '../../../components/ai/AITaskSettings';
import type { SecuritySettings, TwoFactorAuth, IPWhitelist } from '../../../types/features';

const securitySettingsSchema = z.object({
  sessionTimeout: z.number().min(5).max(480),
  passwordMinLength: z.number().min(6).max(32),
  requireUppercase: z.boolean(),
  requireLowercase: z.boolean(),
  requireNumbers: z.boolean(),
  requireSpecialChars: z.boolean(),
});

type SecuritySettingsFormData = z.infer<typeof securitySettingsSchema>;

export function SecuritySettingsPage() {
  const { profile, user } = useAuth();
  const { agency } = useAgency();
  const queryClient = useQueryClient();
  const [twoFactorMethod, setTwoFactorMethod] = useState<'sms' | 'email' | 'app'>('sms');
  const [newIP, setNewIP] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // Get security settings
  const { data: securitySettings, isLoading } = useQuery({
    queryKey: ['security-settings', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return null;

      const agencyRef = doc(db, 'agencies', profile.agency_id);
      const agencySnap = await getDoc(agencyRef);
      
      if (!agencySnap.exists()) return null;

      const data = agencySnap.data();
      return data.securitySettings as SecuritySettings | null;
    },
    enabled: !!profile?.agency_id,
  });

  // Get 2FA status
  const { data: twoFactorStatus } = useQuery({
    queryKey: ['2fa-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return get2FAStatus(user.id);
    },
    enabled: !!user?.id,
  });

  // Get IP whitelist
  const { data: ipWhitelist } = useQuery({
    queryKey: ['ip-whitelist', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return null;
      return getIPWhitelist(profile.agency_id);
    },
    enabled: !!profile?.agency_id,
  });

  const form = useForm<SecuritySettingsFormData>({
    resolver: zodResolver(securitySettingsSchema),
    defaultValues: {
      sessionTimeout: securitySettings?.sessionTimeout || 60,
      passwordMinLength: securitySettings?.passwordPolicy?.minLength || 8,
      requireUppercase: securitySettings?.passwordPolicy?.requireUppercase ?? true,
      requireLowercase: securitySettings?.passwordPolicy?.requireLowercase ?? true,
      requireNumbers: securitySettings?.passwordPolicy?.requireNumbers ?? true,
      requireSpecialChars: securitySettings?.passwordPolicy?.requireSpecialChars ?? false,
    },
  });

  // Enable 2FA mutation
  const enable2FAMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not found');
      return enable2FA(user.id, twoFactorMethod);
    },
    onSuccess: (data) => {
      toast.success('2FA enabled successfully');
      if (data.secret) {
        toast.success(`Your secret key: ${data.secret}. Save your backup codes!`, { duration: 10000 });
      }
      queryClient.invalidateQueries({ queryKey: ['2fa-status'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to enable 2FA');
    },
  });

  // Disable 2FA mutation
  const disable2FAMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not found');
      return disable2FA(user.id);
    },
    onSuccess: () => {
      toast.success('2FA disabled successfully');
      queryClient.invalidateQueries({ queryKey: ['2fa-status'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to disable 2FA');
    },
  });

  // Update IP whitelist mutation
  const updateIPWhitelistMutation = useMutation({
    mutationFn: async (whitelist: IPWhitelist) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      return updateIPWhitelist(profile.agency_id, whitelist);
    },
    onSuccess: () => {
      toast.success('IP whitelist updated');
      queryClient.invalidateQueries({ queryKey: ['ip-whitelist'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update IP whitelist');
    },
  });

  // Save security settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: SecuritySettingsFormData) => {
      if (!profile?.agency_id) throw new Error('Agency not found');

      const agencyRef = doc(db, 'agencies', profile.agency_id);
      const securitySettings: SecuritySettings = {
        twoFactorAuth: twoFactorStatus || {
          enabled: false,
          method: 'sms',
        },
        ipWhitelist: ipWhitelist || {
          enabled: false,
          ips: [],
        },
        sessionTimeout: data.sessionTimeout,
        passwordPolicy: {
          minLength: data.passwordMinLength,
          requireUppercase: data.requireUppercase,
          requireLowercase: data.requireLowercase,
          requireNumbers: data.requireNumbers,
          requireSpecialChars: data.requireSpecialChars,
        },
      };

      await updateDoc(agencyRef, {
        securitySettings,
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast.success('Security settings saved');
      queryClient.invalidateQueries({ queryKey: ['security-settings'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save settings');
    },
  });

  const handleAddIP = () => {
    if (!newIP.trim()) {
      toast.error('Please enter a valid IP address');
      return;
    }

    const currentIPs = ipWhitelist?.ips || [];
    if (currentIPs.includes(newIP)) {
      toast.error('IP address already in whitelist');
      return;
    }

    updateIPWhitelistMutation.mutate({
      enabled: ipWhitelist?.enabled ?? false,
      ips: [...currentIPs, newIP],
    });

    setNewIP('');
  };

  const handleRemoveIP = (ip: string) => {
    const currentIPs = ipWhitelist?.ips || [];
    updateIPWhitelistMutation.mutate({
      enabled: ipWhitelist?.enabled ?? false,
      ips: currentIPs.filter(i => i !== ip),
    });
  };

  const handleToggleIPWhitelist = (enabled: boolean) => {
    updateIPWhitelistMutation.mutate({
      enabled,
      ips: ipWhitelist?.ips || [],
    });
  };

  const onSubmit = (data: SecuritySettingsFormData) => {
    saveSettingsMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Security Settings</h1>
        <p className="text-neutral-600 mt-1">Manage authentication, access control, and security policies</p>
      </div>

      <Tabs defaultValue="2fa" className="space-y-6">
        <TabsList>
          <TabsTrigger value="2fa">Two-Factor Authentication</TabsTrigger>
          <TabsTrigger value="ip-whitelist">IP Whitelist</TabsTrigger>
          <TabsTrigger value="password-policy">Password Policy</TabsTrigger>
          <TabsTrigger value="session">Session Settings</TabsTrigger>
          <TabsTrigger value="ai-tasks">AI Tasks</TabsTrigger>
        </TabsList>

        {/* 2FA Tab */}
        <TabsContent value="2fa" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Two-Factor Authentication
              </CardTitle>
              <CardDescription>
                Add an extra layer of security to your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">2FA Status</p>
                  <p className="text-sm text-neutral-500">
                    {twoFactorStatus?.enabled ? (
                      <span className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        Enabled ({twoFactorStatus.method.toUpperCase()})
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-neutral-500">
                        <XCircle className="w-4 h-4" />
                        Disabled
                      </span>
                    )}
                  </p>
                </div>
                {twoFactorStatus?.enabled ? (
                  <Button
                    variant="destructive"
                    onClick={() => disable2FAMutation.mutate()}
                    disabled={disable2FAMutation.isPending}
                  >
                    Disable 2FA
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Button
                        variant={twoFactorMethod === 'sms' ? 'default' : 'outline'}
                        onClick={() => setTwoFactorMethod('sms')}
                      >
                        SMS
                      </Button>
                      <Button
                        variant={twoFactorMethod === 'email' ? 'default' : 'outline'}
                        onClick={() => setTwoFactorMethod('email')}
                      >
                        Email
                      </Button>
                      <Button
                        variant={twoFactorMethod === 'app' ? 'default' : 'outline'}
                        onClick={() => setTwoFactorMethod('app')}
                      >
                        Authenticator App
                      </Button>
                    </div>
                    <Button
                      onClick={() => enable2FAMutation.mutate()}
                      disabled={enable2FAMutation.isPending}
                    >
                      Enable 2FA
                    </Button>
                  </div>
                )}
              </div>

              {twoFactorStatus?.enabled && twoFactorStatus.backupCodes && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="font-medium text-yellow-900 mb-2">Backup Codes</p>
                  <p className="text-sm text-yellow-800 mb-2">
                    Save these codes in a safe place. You can use them if you lose access to your 2FA device.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {twoFactorStatus.backupCodes.map((code, index) => (
                      <code key={index} className="p-2 bg-white rounded border text-sm">
                        {code}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* IP Whitelist Tab */}
        <TabsContent value="ip-whitelist" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                IP Whitelist
              </CardTitle>
              <CardDescription>
                Restrict access to your account from specific IP addresses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">IP Whitelist</p>
                  <p className="text-sm text-neutral-500">
                    {ipWhitelist?.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <Switch
                  checked={ipWhitelist?.enabled ?? false}
                  onCheckedChange={handleToggleIPWhitelist}
                />
              </div>

              {ipWhitelist?.enabled && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter IP address (e.g., 192.168.1.1 or 192.168.1.0/24)"
                      value={newIP}
                      onChange={(e) => setNewIP(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddIP();
                        }
                      }}
                    />
                    <Button onClick={handleAddIP}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add IP
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {ipWhitelist.ips.map((ip, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                        <code className="text-sm">{ip}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveIP(ip)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    ))}

                    {ipWhitelist.ips.length === 0 && (
                      <p className="text-sm text-neutral-500 text-center py-4">
                        No IP addresses whitelisted. Add IPs to restrict access.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password Policy Tab */}
        <TabsContent value="password-policy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Password Policy
              </CardTitle>
              <CardDescription>
                Configure password requirements for all users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label>Minimum Password Length</Label>
                    <Input
                      type="number"
                      {...form.register('passwordMinLength', { valueAsNumber: true })}
                    />
                    {form.formState.errors.passwordMinLength && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.passwordMinLength.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Require Uppercase Letters</Label>
                      <Switch {...form.register('requireUppercase')} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Require Lowercase Letters</Label>
                      <Switch {...form.register('requireLowercase')} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Require Numbers</Label>
                      <Switch {...form.register('requireNumbers')} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Require Special Characters</Label>
                      <Switch {...form.register('requireSpecialChars')} />
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={saveSettingsMutation.isPending}>
                  Save Password Policy
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Session Settings Tab */}
        <TabsContent value="session" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Session Settings
              </CardTitle>
              <CardDescription>
                Configure session timeout and security
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <Label>Session Timeout (minutes)</Label>
                  <Input
                    type="number"
                    {...form.register('sessionTimeout', { valueAsNumber: true })}
                  />
                  <p className="text-sm text-neutral-500 mt-1">
                    Users will be automatically logged out after this period of inactivity
                  </p>
                  {form.formState.errors.sessionTimeout && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.sessionTimeout.message}
                    </p>
                  )}
                </div>

                <Button type="submit" disabled={saveSettingsMutation.isPending}>
                  Save Session Settings
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Tasks Tab */}
        <TabsContent value="ai-tasks" className="space-y-6">
          <AITaskSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

