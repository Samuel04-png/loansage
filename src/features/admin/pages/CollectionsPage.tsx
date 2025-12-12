/**
 * Automated Collections Workflow Page
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { AlertCircle, Phone, Mail, MessageSquare, User, DollarSign, Calendar, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getCollectionCases,
  addCollectionNote,
  assignCollectionCase,
  updateCollectionCaseStatus,
  autoCreateCollectionCases,
} from '../../../lib/collections/collections-workflow';
import type { CollectionCase, CollectionNote } from '../../../types/features';
import { Link } from 'react-router-dom';

export function CollectionsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<CollectionCase['status'] | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<CollectionCase['priority'] | 'all'>('all');
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CollectionCase | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<'call' | 'visit' | 'email' | 'sms' | 'other'>('call');
  const [noteOutcome, setNoteOutcome] = useState<'no_answer' | 'promised_payment' | 'refused' | 'other'>('no_answer');

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['collection-cases', profile?.agency_id, statusFilter, priorityFilter],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const filters: any = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (priorityFilter !== 'all') filters.priority = priorityFilter;
      return getCollectionCases(profile.agency_id, filters);
    },
    enabled: !!profile?.agency_id,
  });

  const autoCreateMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      return autoCreateCollectionCases(profile.agency_id);
    },
    onSuccess: (count) => {
      toast.success(`Created ${count} collection cases`);
      queryClient.invalidateQueries({ queryKey: ['collection-cases'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create collection cases');
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.agency_id || !selectedCase) throw new Error('Missing data');
      return addCollectionNote(profile.agency_id, selectedCase.id, {
        authorId: profile.id || '',
        type: noteType,
        content: noteContent,
        outcome: noteOutcome,
      });
    },
    onSuccess: () => {
      toast.success('Note added successfully');
      queryClient.invalidateQueries({ queryKey: ['collection-cases'] });
      setNoteDialogOpen(false);
      setNoteContent('');
      setSelectedCase(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add note');
    },
  });

  const assignCaseMutation = useMutation({
    mutationFn: async ({ caseId, assignedTo }: { caseId: string; assignedTo: string }) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      return assignCollectionCase(profile.agency_id, caseId, assignedTo);
    },
    onSuccess: () => {
      toast.success('Case assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['collection-cases'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to assign case');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ caseId, status }: { caseId: string; status: CollectionCase['status'] }) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      return updateCollectionCaseStatus(profile.agency_id, caseId, status);
    },
    onSuccess: () => {
      toast.success('Case status updated');
      queryClient.invalidateQueries({ queryKey: ['collection-cases'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update status');
    },
  });

  const getPriorityColor = (priority: CollectionCase['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Collections</h1>
          <p className="text-neutral-600 mt-1">Manage overdue loan collections</p>
        </div>
        <Button
          onClick={() => autoCreateMutation.mutate()}
          disabled={autoCreateMutation.isPending}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Auto-Create Cases
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Collection Cases</CardTitle>
            <div className="flex gap-2">
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="negotiating">Negotiating</option>
                <option value="resolved">Resolved</option>
                <option value="escalated">Escalated</option>
                <option value="written_off">Written Off</option>
              </select>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Days Overdue</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((caseItem) => (
                <TableRow key={caseItem.id}>
                  <TableCell>
                    <Link
                      to={`/admin/loans/${caseItem.loanId}`}
                      className="text-[#006BFF] hover:underline"
                    >
                      {caseItem.loanId.substring(0, 12)}...
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/admin/customers/${caseItem.customerId}`}
                      className="text-[#006BFF] hover:underline"
                    >
                      View Customer
                    </Link>
                  </TableCell>
                  <TableCell>{caseItem.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={caseItem.daysOverdue > 60 ? 'destructive' : 'secondary'}>
                      {caseItem.daysOverdue} days
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPriorityColor(caseItem.priority)}>
                      {caseItem.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{caseItem.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {caseItem.assignedTo ? (
                      <span className="text-sm">{caseItem.assignedTo}</span>
                    ) : (
                      <span className="text-sm text-neutral-500">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCase(caseItem);
                          setNoteDialogOpen(true);
                        }}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <select
                        className="text-xs rounded border px-2 py-1"
                        value={caseItem.status}
                        onChange={(e) => {
                          updateStatusMutation.mutate({
                            caseId: caseItem.id,
                            status: e.target.value as CollectionCase['status'],
                          });
                        }}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="negotiating">Negotiating</option>
                        <option value="resolved">Resolved</option>
                        <option value="escalated">Escalated</option>
                        <option value="written_off">Written Off</option>
                      </select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {cases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-neutral-500">
                    No collection cases found. Click "Auto-Create Cases" to generate cases for overdue loans.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Collection Note</DialogTitle>
            <DialogDescription>
              Record interaction with customer for collection case
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Interaction Type</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as any)}
              >
                <option value="call">Phone Call</option>
                <option value="visit">Visit</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <Label>Outcome</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={noteOutcome}
                onChange={(e) => setNoteOutcome(e.target.value as any)}
              >
                <option value="no_answer">No Answer</option>
                <option value="promised_payment">Promised Payment</option>
                <option value="refused">Refused</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <Label>Notes</Label>
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Enter details about the interaction..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNoteDialogOpen(false);
                setNoteContent('');
                setSelectedCase(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => addNoteMutation.mutate()}
              disabled={addNoteMutation.isPending || !noteContent.trim()}
            >
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

