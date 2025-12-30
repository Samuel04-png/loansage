import { useState } from 'react';
import { Button } from '../ui/button';
import { Loader2, CreditCard } from 'lucide-react';
import { isStripeConfigured } from '../../lib/stripe/config';
import { useAuth } from '../../hooks/useAuth';
import { useAgency } from '../../hooks/useAgency';
import toast from 'react-hot-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/config';

import { type PlanCode } from '../../lib/pricing/plan-config';

interface CheckoutButtonProps {
  plan?: PlanCode;
  priceId?: string;
  onSuccess?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function CheckoutButton({ 
  plan,
  priceId,
  onSuccess,
  className,
  children 
}: CheckoutButtonProps) {
  const { profile } = useAuth();
  const { agency } = useAgency();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!isStripeConfigured()) {
      toast.error('Stripe is not configured. Please contact support.');
      return;
    }

    if (!profile?.agency_id || !agency?.id) {
      toast.error('Agency information not found');
      return;
    }

    // Require either plan or priceId
    if (!plan && !priceId) {
      toast.error('Plan or price ID is required');
      return;
    }

    // Starter plan now requires checkout for 14-day trial (no payment upfront)
    // Allow checkout for starter plan

    setLoading(true);
    try {
      // Prepare parameters object - ensure all values are properly defined
      const params = {
        agencyId: profile.agency_id,
        ...(plan && { plan }),
        ...(priceId && { priceId }),
        successUrl: `${window.location.origin}/admin/settings?payment=success`,
        cancelUrl: `${window.location.origin}/admin/plans?payment=cancelled`,
      };

      // Validate before sending
      if (!params.agencyId) {
        toast.error('Agency ID is missing. Please refresh the page and try again.');
        setLoading(false);
        return;
      }

      if (!params.plan && !params.priceId) {
        toast.error('Plan information is missing. Please try again.');
        setLoading(false);
        return;
      }

      console.log('Sending checkout request with params:', params);

      // Call Cloud Function to create checkout session
      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
      const result = await createCheckoutSession(params);

      const { checkoutUrl } = result.data as { checkoutUrl: string };

      // Redirect to Stripe Checkout using the URL directly (new Stripe.js API)
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        toast.error('Failed to get checkout URL');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      
      // Provide more specific error messages
      if (error.code === 'functions/invalid-argument') {
        toast.error(error.message || 'Invalid parameters. Please refresh the page and try again.');
      } else if (error.code === 'functions/failed-precondition') {
        toast.error(error.message || 'Unable to process checkout. Please contact support.');
      } else {
        toast.error(error.message || 'Failed to start checkout process. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCheckout}
      disabled={loading || !isStripeConfigured()}
      className={className}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4 mr-2" />
          {children || 'Subscribe Now'}
        </>
      )}
    </Button>
  );
}

