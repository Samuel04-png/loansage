/**
 * Loan Type Settings Component
 * Allows agencies to configure which loan types they offer and customize their settings
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Switch } from '../../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Edit2, 
  Save, 
  X,
  ShieldAlert,
  DollarSign,
  Calendar,
  FileText,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAgency } from '../../../hooks/useAgency';
import { useFeatureGate } from '../../../hooks/useFeatureGate';
import {
  getAgencyLoanConfig,
  toggleLoanType,
  updateLoanTypeConfig,
  DEFAULT_LOAN_TYPE_TEMPLATES,
} from '../../../lib/firebase/loan-type-config';
import type { LoanTypeConfig, LoanTypeId } from '../../../types/loan-config';
import { motion, AnimatePresence } from 'framer-motion';
import { getLoanTypeIcon } from '../../../lib/loan-type-icons';

export function LoanTypeSettings() {
  const { agency } = useAgency();
  const { loanTypeLimit } = useFeatureGate();
  const queryClient = useQueryClient();
  const [editingType, setEditingType] = useState<LoanTypeId | null>(null);
  const [editedConfig, setEditedConfig] = useState<Partial<LoanTypeConfig> | null>(null);

  const { data: loanConfig, isLoading } = useQuery({
    queryKey: ['loanConfig', agency?.id],
    queryFn: async () => {
      if (!agency?.id) return null;
      return await getAgencyLoanConfig(agency.id);
    },
    enabled: !!agency?.id,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ loanTypeId, enabled }: { loanTypeId: LoanTypeId; enabled: boolean }) => {
      if (!agency?.id) throw new Error('Agency not found');
      
      // Check plan limit
      if (enabled && loanTypeLimit !== null) {
        const currentConfig = await getAgencyLoanConfig(agency.id);
        if (currentConfig) {
          const enabledCount = Object.values(currentConfig.loanTypes).filter(lt => lt.enabled).length;
          if (enabledCount >= loanTypeLimit) {
            throw new Error(`Maximum of ${loanTypeLimit} loan type${loanTypeLimit > 1 ? 's' : ''} can be enabled. Please disable one first or upgrade to Enterprise for unlimited loan types.`);
          }
        }
      }
      
      await toggleLoanType(agency.id, loanTypeId, enabled);
    },
    onSuccess: () => {
      // Invalidate all related queries to update UI immediately
      queryClient.invalidateQueries({ queryKey: ['loanConfig', agency?.id] });
      queryClient.invalidateQueries({ queryKey: ['enabledLoanTypes', agency?.id] });
      // Also invalidate any queries that might use loan types
      queryClient.invalidateQueries({ queryKey: ['loanTypes'] });
      toast.success('Loan type updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update loan type');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ loanTypeId, updates }: { loanTypeId: LoanTypeId; updates: Partial<LoanTypeConfig> }) => {
      if (!agency?.id) throw new Error('Agency not found');
      await updateLoanTypeConfig(agency.id, loanTypeId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loanConfig', agency?.id] });
      toast.success('Loan type configuration updated');
      setEditingType(null);
      setEditedConfig(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update configuration');
    },
  });

  const handleEdit = (loanType: LoanTypeConfig) => {
    setEditingType(loanType.id);
    setEditedConfig({ ...loanType });
  };

  const handleSave = () => {
    if (!editingType || !editedConfig) return;
    updateMutation.mutate({ loanTypeId: editingType, updates: editedConfig });
  };

  const handleCancel = () => {
    setEditingType(null);
    setEditedConfig(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!loanConfig) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">Loan configuration not found</p>
          <Button
            onClick={async () => {
              if (!agency?.id) return;
              try {
                const { initializeAgencyLoanConfig } = await import('../../../lib/firebase/loan-type-config');
                await initializeAgencyLoanConfig(agency.id);
                queryClient.invalidateQueries({ queryKey: ['loanConfig', agency.id] });
                toast.success('Loan configuration initialized');
              } catch (error: any) {
                toast.error(error.message || 'Failed to initialize');
              }
            }}
          >
            Initialize Configuration
          </Button>
        </CardContent>
      </Card>
    );
  }

  const enabledLoanTypes = Object.values(loanConfig.loanTypes).filter(lt => lt.enabled);
  const allTemplates = Object.values(DEFAULT_LOAN_TYPE_TEMPLATES);
  // Use plan limit (null = unlimited for Enterprise)
  const maxEnabled = loanTypeLimit ?? Infinity;
  const canEnableMore = maxEnabled === null || enabledLoanTypes.length < maxEnabled;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] bg-white dark:bg-[#1E293B]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#006BFF]" />
                Loan Types Configuration
              </CardTitle>
              <CardDescription className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Enable or disable loan types and configure their settings. You can enable up to {maxEnabled} loan types at a time. Changes apply to new loans only.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm px-3 py-1">
              {enabledLoanTypes.length}/{maxEnabled} Enabled
            </Badge>
          </div>
          {enabledLoanTypes.length >= maxEnabled && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg"
            >
              <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                Maximum of {maxEnabled} loan types enabled. Disable one to enable another.
              </p>
            </motion.div>
          )}
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="enabled" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">
              <TabsTrigger 
                value="enabled"
                className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-700 data-[state=active]:text-[#006BFF] dark:data-[state=active]:text-blue-400"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Enabled ({enabledLoanTypes.length})
              </TabsTrigger>
              <TabsTrigger 
                value="available"
                className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-700 data-[state=active]:text-[#006BFF] dark:data-[state=active]:text-blue-400"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Available ({allTemplates.length - enabledLoanTypes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="enabled" className="space-y-4 mt-4">
              <AnimatePresence>
                {enabledLoanTypes.map((loanType) => (
                  <motion.div
                    key={loanType.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <LoanTypeCard
                      loanType={loanType}
                      isEditing={editingType === loanType.id}
                      editedConfig={editingType === loanType.id ? editedConfig : null}
                      onEdit={() => handleEdit(loanType)}
                      onSave={handleSave}
                      onCancel={handleCancel}
                      onToggle={(enabled) => {
                        if (enabled && enabledLoanTypes.length >= maxEnabled) {
                          toast.error(`Maximum of ${maxEnabled} loan types can be enabled. Please disable one first.`);
                          return;
                        }
                        toggleMutation.mutate({ loanTypeId: loanType.id, enabled });
                      }}
                      onConfigChange={setEditedConfig}
                      isSaving={updateMutation.isPending}
                      canEnableMore={canEnableMore}
                      maxEnabled={maxEnabled}
                      enabledCount={enabledLoanTypes.length}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </TabsContent>

            <TabsContent value="available" className="space-y-4 mt-4">
              <AnimatePresence>
                {allTemplates
                  .filter(template => !loanConfig.loanTypes[template.id]?.enabled)
                  .map((template) => (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <Card className="border-2 border-neutral-200 dark:border-neutral-700 hover:border-[#006BFF]/50 transition-colors">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                {(() => {
                                  const Icon = getLoanTypeIcon(template.id);
                                  return <Icon className="w-6 h-6 text-[#006BFF]" />;
                                })()}
                                <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">{template.name}</h4>
                              </div>
                              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{template.description}</p>
                              <div className="flex gap-2 mt-3">
                                <Badge variant="outline" className="text-xs">{template.category}</Badge>
                                {template.defaultConfig.collateralRequirement === 'required' && (
                                  <Badge variant="secondary" className="text-xs">Secured</Badge>
                                )}
                                {template.defaultConfig.collateralRequirement === 'not_required' && (
                                  <Badge variant="outline" className="text-xs">Unsecured</Badge>
                                )}
                              </div>
                              <div className="mt-3 text-xs text-neutral-500 dark:text-neutral-500">
                                Amount: {template.defaultConfig.loanAmount.min.toLocaleString()} - {template.defaultConfig.loanAmount.max.toLocaleString()} ZMW
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                if (!canEnableMore) {
                                  toast.error(`Maximum of ${maxEnabled} loan types can be enabled. Please disable one first.`);
                                  return;
                                }
                                toggleMutation.mutate({ loanTypeId: template.id, enabled: true });
                              }}
                              disabled={toggleMutation.isPending || !canEnableMore}
                              className="ml-4 bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white"
                            >
                              {toggleMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Enable
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

interface LoanTypeCardProps {
  loanType: LoanTypeConfig;
  isEditing: boolean;
  editedConfig: Partial<LoanTypeConfig> | null;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onToggle: (enabled: boolean) => void;
  onConfigChange: (config: Partial<LoanTypeConfig>) => void;
  isSaving: boolean;
  canEnableMore?: boolean;
  maxEnabled?: number;
  enabledCount?: number;
}

function LoanTypeCard({
  loanType,
  isEditing,
  editedConfig,
  onEdit,
  onSave,
  onCancel,
  onToggle,
  onConfigChange,
  isSaving,
  canEnableMore = true,
  maxEnabled = 3,
  enabledCount = 0,
}: LoanTypeCardProps) {
  const config = isEditing && editedConfig ? editedConfig : loanType;
  const Icon = getLoanTypeIcon(loanType.id);

  return (
    <Card className="border-2 border-neutral-200 dark:border-neutral-700 hover:border-[#006BFF]/50 transition-all shadow-sm hover:shadow-md">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <div className="p-2 rounded-lg bg-[#006BFF]/10">
                  <Icon className="w-6 h-6 text-[#006BFF]" />
                </div>
                <h4 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{config.name}</h4>
                <Badge 
                  variant={loanType.enabled ? 'default' : 'secondary'}
                  className={loanType.enabled ? 'bg-green-500 hover:bg-green-600' : ''}
                >
                  {loanType.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
                <Badge variant="outline" className="text-xs">{config.category}</Badge>
                {config.collateralRequirement === 'required' && (
                  <Badge variant="secondary" className="text-xs">Secured</Badge>
                )}
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">{config.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end gap-1">
                <Switch
                  checked={loanType.enabled}
                  onCheckedChange={(checked) => {
                    if (checked && !canEnableMore && enabledCount >= maxEnabled) {
                      toast.error(`Maximum of ${maxEnabled} loan types can be enabled. Please disable one first.`);
                      return;
                    }
                    onToggle(checked);
                  }}
                  disabled={!loanType.enabled && !canEnableMore}
                />
                <span className="text-xs text-muted-foreground">
                  {loanType.enabled ? 'Active' : 'Inactive'}
                </span>
              </div>
              {!isEditing && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={onEdit}
                  className="border-neutral-300 dark:border-neutral-600"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          {isEditing ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-700"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Min Amount (ZMW)</Label>
                  <Input
                    type="number"
                    value={config.loanAmount?.min || ''}
                    onChange={(e) => onConfigChange({
                      ...editedConfig!,
                      loanAmount: { ...config.loanAmount!, min: Number(e.target.value) },
                    })}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Max Amount (ZMW)</Label>
                  <Input
                    type="number"
                    value={config.loanAmount?.max || ''}
                    onChange={(e) => onConfigChange({
                      ...editedConfig!,
                      loanAmount: { ...config.loanAmount!, max: Number(e.target.value) },
                    })}
                    className="rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Default Interest Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={config.interestRate?.default || ''}
                    onChange={(e) => onConfigChange({
                      ...editedConfig!,
                      interestRate: { ...config.interestRate!, default: Number(e.target.value) },
                    })}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Min Duration (Months)</Label>
                  <Input
                    type="number"
                    value={config.duration?.minMonths || ''}
                    onChange={(e) => onConfigChange({
                      ...editedConfig!,
                      duration: { ...config.duration!, minMonths: Number(e.target.value) },
                    })}
                    className="rounded-lg"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={onSave} 
                  disabled={isSaving} 
                  size="sm"
                  className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button onClick={onCancel} variant="outline" size="sm">
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <span className="text-xs text-neutral-500 dark:text-neutral-400 block mb-1">Amount Range</span>
                <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {config.loanAmount?.min?.toLocaleString()} - {config.loanAmount?.max?.toLocaleString()} ZMW
                </p>
              </div>
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <span className="text-xs text-neutral-500 dark:text-neutral-400 block mb-1">Interest Rate</span>
                <p className="font-semibold text-neutral-900 dark:text-neutral-100">{config.interestRate?.default}%</p>
              </div>
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <span className="text-xs text-neutral-500 dark:text-neutral-400 block mb-1">Duration</span>
                <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {config.duration?.minMonths} - {config.duration?.maxMonths} months
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

