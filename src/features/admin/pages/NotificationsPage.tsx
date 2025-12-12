/**
 * SMS/WhatsApp Notifications Page
 * Manage notification templates and view logs
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, addDoc, doc, updateDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { MessageSquare, Send, Plus, Edit, Trash2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getNotificationTemplates,
  getNotificationLogs,
  createDefaultTemplates,
  sendNotification,
} from '../../../lib/notifications/sms-whatsapp';
import type { NotificationTemplate, NotificationLog } from '../../../types/features';

const templateSchema = z.object({
  name: z.string().min(2, 'Template name is required'),
  type: z.enum(['sms', 'whatsapp', 'email']),
  trigger: z.enum(['payment_due', 'payment_overdue', 'loan_approved', 'loan_rejected', 'payment_received', 'custom']),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  isActive: z.boolean(),
});

type TemplateFormData = z.infer<typeof templateSchema>;

export function NotificationsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [testRecipient, setTestRecipient] = useState('');

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['notification-templates', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      return getNotificationTemplates(profile.agency_id);
    },
    enabled: !!profile?.agency_id,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['notification-logs', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      return getNotificationLogs(profile.agency_id, 100);
    },
    enabled: !!profile?.agency_id,
  });

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      type: 'sms',
      trigger: 'payment_due',
      message: '',
      isActive: true,
    },
  });

  // Extract variables from message
  const message = form.watch('message');
  const variables = message.match(/\{(\w+)\}/g)?.map(v => v.slice(1, -1)) || [];

  const createTemplateMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      
      const templatesRef = collection(db, 'agencies', profile.agency_id, 'notification_templates');
      return addDoc(templatesRef, {
        ...data,
        variables,
      });
    },
    onSuccess: () => {
      toast.success('Template created successfully');
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create template');
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NotificationTemplate> }) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      
      const templateRef = doc(db, 'agencies', profile.agency_id, 'notification_templates', id);
      return updateDoc(templateRef, {
        ...data,
        variables: data.message ? (data.message.match(/\{(\w+)\}/g)?.map((v: string) => v.slice(1, -1)) || []) : undefined,
      });
    },
    onSuccess: () => {
      toast.success('Template updated successfully');
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      setDialogOpen(false);
      setEditingTemplate(null);
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update template');
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      
      const templateRef = doc(db, 'agencies', profile.agency_id, 'notification_templates', id);
      return deleteDoc(templateRef);
    },
    onSuccess: () => {
      toast.success('Template deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete template');
    },
  });

  const createDefaultsMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      return createDefaultTemplates(profile.agency_id);
    },
    onSuccess: () => {
      toast.success('Default templates created');
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create default templates');
    },
  });

  const testNotificationMutation = useMutation({
    mutationFn: async ({ templateId, recipient }: { templateId: string; recipient: string }) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      return sendNotification(profile.agency_id, templateId, recipient, {
        customerName: 'Test Customer',
        amount: '1,000',
        dueDate: new Date().toLocaleDateString(),
        daysOverdue: '5',
        remainingBalance: '5,000',
      });
    },
    onSuccess: () => {
      toast.success('Test notification sent');
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send test notification');
    },
  });

  const handleEdit = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    form.reset({
      name: template.name,
      type: template.type,
      trigger: template.trigger,
      message: template.message,
      isActive: template.isActive,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: TemplateFormData) => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  if (templatesLoading || logsLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Notifications</h1>
          <p className="text-neutral-600 mt-1">Manage SMS and WhatsApp notification templates</p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button
              variant="outline"
              onClick={() => createDefaultsMutation.mutate()}
              disabled={createDefaultsMutation.isPending}
            >
              Create Default Templates
            </Button>
          )}
          <Button onClick={() => {
            setEditingTemplate(null);
            form.reset();
            setDialogOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="logs">Notification Logs</TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{template.type.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{template.trigger.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.isActive ? 'default' : 'secondary'}>
                          {template.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(template)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this template?')) {
                                deleteTemplateMutation.mutate(template.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {templates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-neutral-500">
                        No templates found. Create your first template to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.recipient}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.type.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.status === 'sent' || log.status === 'delivered'
                              ? 'default'
                              : log.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {log.status === 'sent' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {log.status === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
                          {log.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.sentAt ? new Date(log.sentAt).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-red-600">
                        {log.error || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-neutral-500">
                        No notification logs found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              Create notification templates with variables like {'{customerName}'}, {'{amount}'}, etc.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Template Name *</Label>
                <Input {...form.register('name')} />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <Label>Type *</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...form.register('type')}
                >
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                </select>
              </div>
            </div>

            <div>
              <Label>Trigger *</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...form.register('trigger')}
              >
                <option value="payment_due">Payment Due</option>
                <option value="payment_overdue">Payment Overdue</option>
                <option value="loan_approved">Loan Approved</option>
                <option value="loan_rejected">Loan Rejected</option>
                <option value="payment_received">Payment Received</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <Label>Message *</Label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Hello {customerName}, your payment of {amount} is due on {dueDate}."
                {...form.register('message')}
              />
              {form.formState.errors.message && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.message.message}</p>
              )}
              <p className="text-xs text-neutral-500 mt-1">
                Available variables: {variables.length > 0 ? variables.join(', ') : 'None detected'}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label>Template Active</Label>
              <Switch {...form.register('isActive')} />
            </div>

            {editingTemplate && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Label className="mb-2 block">Test Notification</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter phone number (e.g., +260971234567)"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (!testRecipient) {
                        toast.error('Please enter a recipient');
                        return;
                      }
                      testNotificationMutation.mutate({
                        templateId: editingTemplate.id,
                        recipient: testRecipient,
                      });
                    }}
                    disabled={testNotificationMutation.isPending}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Test
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setEditingTemplate(null);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}>
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
