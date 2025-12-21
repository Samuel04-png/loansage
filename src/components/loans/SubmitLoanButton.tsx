/**
 * Submit Loan Button Component
 * 
 * Allows loan officers to submit draft loans for review
 */

import { useState } from 'react';
import { Button } from '../ui/button';
import { Send, Loader2 } from 'lucide-react';
import { submitLoanForReview } from '../../lib/loans/workflow';
import { UserRole } from '../../types/loan-workflow';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useAgency } from '../../hooks/useAgency';

interface SubmitLoanButtonProps {
  loanId: string;
  onSuccess?: () => void;
  className?: string;
}

export function SubmitLoanButton({ loanId, onSuccess, className }: SubmitLoanButtonProps) {
  const { user, profile } = useAuth();
  const { agency } = useAgency();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user?.id || !profile?.agency_id || !agency?.id) {
      toast.error('Not authenticated');
      return;
    }

    const userRole = (profile?.role === 'admin' ? UserRole.ADMIN :
                     profile?.employee_category === 'loan_officer' ? UserRole.LOAN_OFFICER :
                     UserRole.LOAN_OFFICER) as UserRole;

    setLoading(true);
    try {
      const result = await submitLoanForReview({
        loanId,
        agencyId: agency.id,
        userId: user.id,
        userRole,
      });

      if (result.success) {
        toast.success('Loan submitted for review successfully!');
        onSuccess?.();
      } else {
        toast.error(result.error || 'Failed to submit loan');
      }
    } catch (error: any) {
      console.error('Error submitting loan:', error);
      toast.error(error.message || 'Failed to submit loan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSubmit}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Submitting...
        </>
      ) : (
        <>
          <Send className="mr-2 h-4 w-4" />
          Submit for Review
        </>
      )}
    </Button>
  );
}

