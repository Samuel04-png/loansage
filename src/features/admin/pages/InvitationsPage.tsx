import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, deleteDoc, query as firestoreQuery, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Mail, Copy, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { InviteEmployeeDrawer } from '../components/InviteEmployeeDrawer';

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

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/auth/accept-invite?token=${token}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success('Invite link copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Invitations</h2>
          <p className="text-slate-600">Manage employee invitations</p>
        </div>
        <Button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setInviteDrawerOpen(true);
          }}
          type="button"
        >
          <Mail className="mr-2 h-4 w-4" />
          Invite Employee
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Invitations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : invitations && invitations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Expires</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv: any) => {
                    const expiresAt = inv.expires_at instanceof Date 
                      ? inv.expires_at 
                      : inv.expires_at?.toDate?.() 
                      ? inv.expires_at.toDate() 
                      : new Date(inv.expires_at);
                    const isExpired = expiresAt < new Date();
                    const isAccepted = inv.status === 'accepted' || !!inv.acceptedAt;

                    return (
                      <tr
                        key={inv.id}
                        className="bg-white border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-6 py-4 font-medium">{inv.email}</td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="capitalize">
                            {inv.role?.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          {inv.note ? (
                            <span className="text-xs text-slate-500">{inv.note}</span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isAccepted ? (
                            <Badge variant="success">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Accepted
                            </Badge>
                          ) : isExpired ? (
                            <Badge variant="destructive">
                              <XCircle className="w-3 h-3 mr-1" />
                              Expired
                            </Badge>
                          ) : (
                            <Badge variant="warning">Pending</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {formatDateSafe(expiresAt)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isAccepted && !isExpired && inv.token && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyInviteLink(inv.token)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteInvitation.mutate(inv.id)}
                              disabled={deleteInvitation.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Mail className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No invitations yet</p>
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
