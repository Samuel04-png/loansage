import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter } from '../../../components/ui/drawer';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useAgency } from '../../../hooks/useAgency';
import { createEmployeeInvitation, createAuditLog } from '../../../lib/firebase/firestore-helpers';
import toast from 'react-hot-toast';

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['loan_officer', 'manager', 'collections', 'underwriter', 'accountant', 'customer_relations'], {
    required_error: 'Please select a role',
  }),
  note: z.string().optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteEmployeeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function InviteEmployeeDrawer({ open, onOpenChange, onSuccess }: InviteEmployeeDrawerProps) {
  const { user, profile } = useAuth();
  const { agency } = useAgency();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
  });

  const onSubmit = async (data: InviteFormData) => {
    if (!agency?.id || !user?.id || !profile?.agency_id) {
      const errorMsg = 'Agency information not available. Please ensure you are logged in and have an agency.';
      toast.error(errorMsg);
      setError(errorMsg);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Create invitation in Firestore
      const invitation = await createEmployeeInvitation(profile.agency_id, {
        email: data.email,
        role: data.role,
        note: data.note,
        createdBy: user.id,
      });

      // Create audit log (non-blocking, won't fail if it errors)
      createAuditLog(profile.agency_id, {
        actorId: user.id,
        action: 'invite_employee',
        targetCollection: 'invitations',
        targetId: invitation.id,
        metadata: { email: data.email, role: data.role },
      }).catch(() => {
        // Ignore audit log errors - not critical
      });

      // Send invitation email via Cloud Function
      try {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const sendInvitationEmail = httpsCallable(functions, 'sendInvitationEmail');
        
        await sendInvitationEmail({
          agencyId: profile.agency_id,
          invitationId: invitation.id,
          email: data.email,
          role: data.role,
          inviteUrl: invitation.inviteUrl,
          note: data.note,
          agencyName: agency?.name,
        });
        
        toast.success('Invitation created and email sent!');
      } catch (emailError: any) {
        console.error('Failed to send invitation email:', emailError);
        // Still show success - invitation is created, email can be resent
        toast.success('Invitation created! Email sending failed. You can copy and share the link from the Invitations page.');
      }

      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      const errorMsg = error.message || 'Failed to create invitation';
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} size="md">
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Invite Employee</DrawerTitle>
          <DrawerDescription>
            Send an invitation to a new employee to join your agency
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          
          {!agency?.id && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-600">
                No agency found. Please create an agency first in Settings.
              </p>
            </div>
          )}

          <form id="invite-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email">Employee Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="employee@example.com"
                {...register('email')}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="role">Role *</Label>
              <select
                id="role"
                {...register('role')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a role</option>
                <option value="loan_officer">Loan Officer</option>
                <option value="manager">Manager</option>
                <option value="collections">Collections Officer</option>
                <option value="underwriter">Underwriter</option>
                <option value="accountant">Accountant</option>
                <option value="customer_relations">Customer Relations</option>
              </select>
              {errors.role && (
                <p className="text-sm text-red-600 mt-1">{errors.role.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="note">Optional Note</Label>
              <Textarea
                id="note"
                placeholder="Add a personal message (optional)"
                rows={3}
                {...register('note')}
              />
            </div>
          </form>
        </DrawerBody>

        <DrawerFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="invite-form"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Invitation'
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

