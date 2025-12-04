import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Plus, Search, MessageSquare, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';;
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const ticketSchema = z.object({
  subject: z.string().min(5, 'Subject is required'),
  description: z.string().min(10, 'Description is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

type TicketFormData = z.infer<typeof ticketSchema>;

export function SupportTicketsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { register, handleSubmit, formState: { errors }, reset } = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      priority: 'medium',
    },
  });

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tickets', profile?.id, statusFilter],
    queryFn: async () => {
      if (!profile?.id) return [];

      let query = supabase
        .from('support_tickets')
        .select('*, created_by:users!support_tickets_created_by_id(full_name, email)')
        .eq('created_by', profile.id)
        .order('created_at', { ascending: false }) as any;

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const createTicket = useMutation({
    mutationFn: async (data: TicketFormData) => {
      if (!profile?.id || !profile?.agency_id) throw new Error('Not authenticated');

      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          agency_id: profile.agency_id,
          created_by: profile.id,
          subject: data.subject,
          description: data.description,
          priority: data.priority,
          status: 'open',
        } as any)
        .select()
        .single();

      if (error) throw error;
      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      reset();
      setShowForm(false);
      toast.success('Support ticket created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create ticket');
    },
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge variant="warning">High</Badge>;
      case 'medium':
        return <Badge variant="default">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return (
          <Badge variant="success">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Resolved
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="default">
            <Clock className="w-3 h-3 mr-1" />
            In Progress
          </Badge>
        );
      case 'open':
        return (
          <Badge variant="warning">
            <AlertCircle className="w-3 h-3 mr-1" />
            Open
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredTickets = tickets?.filter((ticket: any) =>
    ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.description.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Support Tickets</h2>
          <p className="text-slate-600">Get help and track your support requests</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          New Ticket
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Support Ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((data) => createTicket.mutate(data))} className="space-y-4">
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" {...register('subject')} />
                {errors.subject && (
                  <p className="text-sm text-red-600 mt-1">{errors.subject.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('description')}
                />
                {errors.description && (
                  <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('priority')}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createTicket.isPending}>
                  {createTicket.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Create Ticket
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setShowForm(false);
                  reset();
                }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search tickets..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            </div>
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : filteredTickets.length > 0 ? (
            <div className="divide-y">
              {filteredTickets.map((ticket: any) => (
                <div key={ticket.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900">{ticket.subject}</h3>
                        {getPriorityBadge(ticket.priority)}
                        {getStatusBadge(ticket.status)}
                      </div>
                      <p className="text-sm text-slate-600 mb-3">{ticket.description}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Created: {formatDateTime(ticket.created_at)}</span>
                        {ticket.updated_at && ticket.updated_at !== ticket.created_at && (
                          <span>Updated: {formatDateTime(ticket.updated_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No support tickets found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

