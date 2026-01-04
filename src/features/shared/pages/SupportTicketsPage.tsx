/**
 * Support Tickets Page - Firebase Implementation
 * Allows users to create and view support tickets
 * Tickets are sent to hello@byteandberry.com
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Skeleton } from '../../../components/ui/skeleton';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Plus, Search, MessageSquare, CheckCircle2, Clock, AlertCircle, Loader2, Mail, X, Send, ExternalLink } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../components/ui/dialog';
import { Textarea } from '../../../components/ui/textarea';

const ticketSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  category: z.enum(['technical', 'billing', 'feature_request', 'other']),
});

type TicketFormData = z.infer<typeof ticketSchema>;

const SUPPORT_EMAIL = 'hello@byteandberry.com';

export function SupportTicketsPage() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { register, handleSubmit, formState: { errors }, reset } = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      priority: 'medium',
      category: 'technical',
    },
  });

  // Fetch tickets from Firestore
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['support-tickets', profile?.agency_id, user?.id, statusFilter],
    queryFn: async () => {
      if (!profile?.agency_id || !user?.id) return [];

      try {
        const ticketsRef = collection(db, 'agencies', profile.agency_id, 'support_tickets');
        
        // Build query based on user role
        let q;
        if (profile.role === 'admin' || profile.role === 'owner') {
          // Admins can see all agency tickets
          q = firestoreQuery(
            ticketsRef,
            ...(statusFilter !== 'all' ? [where('status', '==', statusFilter)] : []),
            orderBy('createdAt', 'desc')
          );
        } else {
          // Regular users can only see their own tickets
          q = firestoreQuery(
            ticketsRef,
            where('createdBy', '==', user.id),
            ...(statusFilter !== 'all' ? [where('status', '==', statusFilter)] : []),
            orderBy('createdAt', 'desc')
          );
        }
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (error: any) {
        console.error('Error fetching tickets:', error);
        
        // Fallback: Fetch without ordering if index doesn't exist
        try {
          const ticketsRef = collection(db, 'agencies', profile.agency_id, 'support_tickets');
          const simpleQuery = firestoreQuery(ticketsRef, where('createdBy', '==', user.id));
          const snapshot = await getDocs(simpleQuery);
          const allTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // Filter and sort client-side
          return allTickets
            .filter((t: any) => statusFilter === 'all' || t.status === statusFilter)
            .sort((a: any, b: any) => {
              const dateA = a.createdAt?.toDate?.() || new Date(0);
              const dateB = b.createdAt?.toDate?.() || new Date(0);
              return dateB.getTime() - dateA.getTime();
            });
        } catch (fallbackError) {
          console.error('Fallback query failed:', fallbackError);
          return [];
        }
      }
    },
    enabled: !!profile?.agency_id && !!user?.id,
  });

  // Create ticket mutation
  const createTicket = useMutation({
    mutationFn: async (data: TicketFormData) => {
      if (!profile?.agency_id || !user?.id) throw new Error('Not authenticated');

      const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;

      const ticketData = {
        ticketNumber,
        subject: data.subject,
        description: data.description,
        priority: data.priority,
        category: data.category,
        status: 'open',
        createdBy: user.id,
        creatorName: profile.full_name || user.email || 'Unknown',
        creatorEmail: user.email || '',
        agencyId: profile.agency_id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Support email for reference
        supportEmail: SUPPORT_EMAIL,
      };

      // Create in Firestore
      const ticketsRef = collection(db, 'agencies', profile.agency_id, 'support_tickets');
      const docRef = await addDoc(ticketsRef, ticketData);

      // Note: Email notification should be handled by a Cloud Function
      // For now, we'll show the support email to the user
      
      return { id: docRef.id, ...ticketData };
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      reset();
      setShowForm(false);
      toast.success(
        <div>
          <p className="font-medium">Ticket #{ticket.ticketNumber} created!</p>
          <p className="text-sm text-slate-500">
            Our team at {SUPPORT_EMAIL} will respond soon.
          </p>
        </div>,
        { duration: 6000 }
      );
    },
    onError: (error: any) => {
      console.error('Ticket creation error:', error);
      toast.error(error.message || 'Failed to create ticket. Please try again.');
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'high':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'low':
        return 'bg-slate-50 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'technical':
        return 'Technical Issue';
      case 'billing':
        return 'Billing';
      case 'feature_request':
        return 'Feature Request';
      case 'other':
        return 'Other';
      default:
        return category;
    }
  };

  const filteredTickets = tickets?.filter((ticket: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      ticket.subject?.toLowerCase().includes(search) ||
      ticket.ticketNumber?.toLowerCase().includes(search) ||
      ticket.description?.toLowerCase().includes(search)
    );
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">Support</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Get help from our team at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#006BFF] hover:underline">{SUPPORT_EMAIL}</a>
          </p>
        </div>
        <Button 
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Ticket
        </Button>
      </motion.div>

      {/* Control Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] overflow-hidden">
          <div className="px-6 py-4 bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 w-full sm:max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <Input
                  placeholder="Search tickets..."
                  className="pl-12 h-11 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF] text-base"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {/* Status Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                {['all', 'open', 'in_progress', 'resolved', 'closed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3.5 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
                      statusFilter === status
                        ? 'bg-[#006BFF] text-white shadow-md shadow-blue-500/25'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tickets List */}
          <div className="p-0">
            {isLoading ? (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="px-6 py-5 flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : filteredTickets.length > 0 ? (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredTickets.map((ticket: any, index: number) => (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02, duration: 0.15 }}
                    className="group px-6 py-5 hover:bg-slate-50/80 dark:hover:bg-neutral-800/40 transition-colors duration-200"
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#006BFF]/10 to-[#4F46E5]/10 dark:from-[#006BFF]/20 dark:to-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-5 h-5 text-[#006BFF]" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-slate-900 dark:text-neutral-100 font-semibold text-[15px] truncate">
                            {ticket.subject}
                          </h3>
                          <span className="text-xs text-slate-400 font-mono">
                            #{ticket.ticketNumber}
                          </span>
                        </div>
                        <p className="text-slate-500 dark:text-neutral-400 text-sm line-clamp-1 mb-2">
                          {ticket.description}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{formatDateSafe(ticket.createdAt)}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          <span>{getCategoryLabel(ticket.category)}</span>
                        </div>
                      </div>
                      
                      {/* Priority & Status */}
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={ticket.status} />
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-16 px-6 text-center">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-6">
                  <MessageSquare className="w-10 h-10 text-[#006BFF]" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-neutral-100 mb-2">
                  {searchTerm || statusFilter !== 'all' ? 'No tickets found' : 'No support tickets yet'}
                </h3>
                <p className="text-slate-500 dark:text-neutral-400 text-sm max-w-md mx-auto mb-6">
                  {searchTerm 
                    ? "No tickets match your search criteria."
                    : "Have a question or issue? Create a support ticket and we'll help you out."
                  }
                </p>
                {!searchTerm && statusFilter === 'all' && (
                  <Button 
                    onClick={() => setShowForm(true)}
                    className="bg-[#006BFF] hover:bg-[#0052CC] text-white rounded-xl"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Ticket
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Direct Contact Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 overflow-hidden bg-gradient-to-br from-[#006BFF]/5 to-[#4F46E5]/5 dark:from-[#006BFF]/10 dark:to-[#4F46E5]/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-[#006BFF] flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                  Need immediate help?
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Reach out to our support team directly
                </p>
              </div>
              <a 
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{SUPPORT_EMAIL}</span>
                <ExternalLink className="w-4 h-4 text-neutral-400" />
              </a>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Create Ticket Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#006BFF]" />
              Create Support Ticket
            </DialogTitle>
            <DialogDescription>
              Describe your issue and we'll get back to you at {SUPPORT_EMAIL}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit((data) => createTicket.mutate(data))} className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                {...register('subject')}
                placeholder="Brief summary of your issue"
                className="mt-2 rounded-xl"
              />
              {errors.subject && (
                <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Describe your issue in detail..."
                rows={4}
                className="mt-2 rounded-xl resize-none"
              />
              {errors.description && (
                <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  {...register('category')}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm mt-2"
                >
                  <option value="technical">Technical Issue</option>
                  <option value="billing">Billing</option>
                  <option value="feature_request">Feature Request</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  {...register('priority')}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm mt-2"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowForm(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createTicket.isPending}
                className="bg-[#006BFF] hover:bg-[#0052CC] text-white rounded-xl"
              >
                {createTicket.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Ticket
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
