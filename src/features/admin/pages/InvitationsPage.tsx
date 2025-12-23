import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, deleteDoc, query as firestoreQuery, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { Skeleton } from '../../../components/ui/skeleton';
import { Mail, Copy, CheckCircle2, XCircle, Loader2, Trash2, Send, MoreVertical, User, Clock, ExternalLink } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { InviteEmployeeDrawer } from '../components/InviteEmployeeDrawer';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';

export function InvitationsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);

  const { data: invitations, isLoading, refetch } = useQuery({
    queryKey: ['invitations', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const invitationsRef = collection(db, 'agencies', profile.agency_id, 'invitations');
      const snapshot = await getDocs(invitationsRef);
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        expires_at: doc.data().expiresAt?.toDate?.() || doc.data().expires_at,
        created_at: doc.data().createdAt?.toDate?.() || doc.data().created_at,
      }));
    },
    enabled: !!profile?.agency_id,
  });

  const deleteInvitation = useMutation({
    mutationFn: async (inviteId: string) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      const inviteRef = doc(db, 'agencies', profile.agency_id, 'invitations', inviteId);
      await deleteDoc(inviteRef);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      refetch();
      toast.success('Invitation deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete invitation');
    },
  });

  const copyInviteLink = (inv: any) => {
    // Use stored inviteUrl if available, otherwise generate from token
    const inviteUrl = inv.inviteUrl || `${window.location.origin}/auth/accept-invite?token=${inv.token}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success('Invite link copied to clipboard!');
  };

  const resendInviteEmail = async (inv: any) => {
    if (!profile?.agency_id) {
      toast.error('Agency not found');
      return;
    }

    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const sendInvitationEmail = httpsCallable(functions, 'sendInvitationEmail');
      
      const inviteUrl = inv.inviteUrl || `${window.location.origin}/auth/accept-invite?token=${inv.token}`;
      
      await sendInvitationEmail({
        agencyId: profile.agency_id,
        invitationId: inv.id,
        email: inv.email,
        role: inv.role,
        inviteUrl: inviteUrl,
        note: inv.note,
      });
      
      toast.success('Invitation email sent successfully!');
    } catch (error: any) {
      console.error('Failed to send invitation email:', error);
      // Fallback to copying link
      const inviteUrl = inv.inviteUrl || `${window.location.origin}/auth/accept-invite?token=${inv.token}`;
      navigator.clipboard.writeText(inviteUrl);
      toast.error(`Email sending failed: ${error.message || 'Unknown error'}. Link copied to clipboard.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">Invitations</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Manage employee and customer invitations</p>
        </div>
        <Button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setInviteDrawerOpen(true);
          }}
          type="button"
          className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
        >
          <Mail className="mr-2 h-4 w-4" />
          Invite Employee
        </Button>
      </motion.div>

      {/* Invitations Table */}
      <Card className="border-neutral-200 dark:border-neutral-800 shadow-sm">
        <CardHeader className="border-b border-neutral-200 dark:border-neutral-800">
          <CardTitle className="text-lg font-semibold">Active Invitations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : invitations && invitations.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-neutral-200 dark:border-neutral-800">
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Email</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Role</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Category</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Status</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Expires</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Invite Link</TableHead>
                    <TableHead className="font-semibold text-right text-neutral-700 dark:text-neutral-300 w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv: any, index: number) => {
                    const expiresAt = inv.expires_at instanceof Date 
                      ? inv.expires_at 
                      : inv.expires_at?.toDate?.() 
                      ? inv.expires_at.toDate() 
                      : new Date(inv.expires_at);
                    const isExpired = expiresAt < new Date();
                    const isAccepted = inv.status === 'accepted' || !!inv.acceptedAt;
                    const inviteUrl = inv.inviteUrl || `${window.location.origin}/auth/accept-invite?token=${inv.token}`;
                    const roleDisplay = inv.role === 'customer' ? 'Customer' : inv.employee_category 
                      ? inv.employee_category.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                      : inv.role?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || inv.role;

                    return (
                      <motion.tr
                        key={inv.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          "border-b border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                        )}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-neutral-400" />
                            <span className="text-neutral-900 dark:text-neutral-100">{inv.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className="capitalize border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
                          >
                            <User className="w-3 h-3 mr-1" />
                            {roleDisplay}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-neutral-600 dark:text-neutral-400 max-w-[200px] truncate">
                            {inv.note || (inv.role === 'customer' 
                              ? `You've been invited to join ${profile?.agency_name || 'the organization'} as a customer.`
                              : `You've been invited to join ${profile?.agency_name || 'the organization'} as ${roleDisplay}.`
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isAccepted ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Accepted
                            </Badge>
                          ) : isExpired ? (
                            <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
                              <XCircle className="w-3 h-3 mr-1" />
                              Expired
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                              <Clock className="w-3 h-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                            <Clock className="w-3 h-3" />
                            {formatDateSafe(expiresAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {!isAccepted && !isExpired ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <code className="text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-mono block truncate max-w-[200px]">
                                  {inviteUrl.replace(`${window.location.origin}`, '')}
                                </code>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyInviteLink(inv)}
                                  title="Copy invite link"
                                  className="h-8 w-8 p-0"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => resendInviteEmail(inv)}
                                  title="Resend email invitation"
                                  className="h-8 w-8 p-0"
                                >
                                  <Send className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-400">
                              {isAccepted ? 'Accepted' : 'Expired'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl">
                              {!isAccepted && !isExpired && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => copyInviteLink(inv)}
                                    className="cursor-pointer rounded-lg"
                                  >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy Link
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => resendInviteEmail(inv)}
                                    className="cursor-pointer rounded-lg"
                                  >
                                    <Send className="mr-2 h-4 w-4" />
                                    Resend Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => window.open(inviteUrl, '_blank')}
                                    className="cursor-pointer rounded-lg"
                                  >
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open Link
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuItem
                                onClick={() => deleteInvitation.mutate(inv.id)}
                                disabled={deleteInvitation.isPending}
                                className="cursor-pointer text-red-600 focus:text-red-600 rounded-lg"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-16 text-neutral-500">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <Mail className="w-8 h-8 text-neutral-400" />
              </div>
              <p className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-1">No invitations yet</p>
              <p className="text-sm text-neutral-500">Get started by inviting your first employee</p>
            </div>
          )}
        </CardContent>
      </Card>

      <InviteEmployeeDrawer
        open={inviteDrawerOpen}
        onOpenChange={setInviteDrawerOpen}
        onSuccess={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['invitations'] });
        }}
      />
    </div>
  );
}
