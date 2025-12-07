import { useState } from 'react';
import { Button } from '../ui/button';
import { Loader2, CreditCard } from 'lucide-react';
import { getStripe, STRIPE_PRICE_ID, isStripeConfigured } from '../../lib/stripe/config';
import { useAuth } from '../../hooks/useAuth';
import { useAgency } from '../../hooks/useAgency';
import toast from 'react-hot-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/config';

interface CheckoutButtonProps {
  priceId?: string;
  onSuccess?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function CheckoutButton({ 
  priceId = STRIPE_PRICE_ID, 
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

    setLoading(true);
    try {
      // Call Cloud Function to create checkout session
      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
      const result = await createCheckoutSession({
        agencyId: profile.agency_id,
        priceId,
        successUrl: `${window.location.origin}/admin/settings?payment=success`,
        cancelUrl: `${window.location.origin}/admin/plans?payment=cancelled`,
      });

      const { sessionId } = result.data as { sessionId: string };

      // Redirect to Stripe Checkout
      const stripe = await getStripe();
      if (stripe) {
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          toast.error(error.message || 'Failed to redirect to checkout');
        }
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout process');
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

