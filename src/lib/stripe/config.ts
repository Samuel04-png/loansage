import { loadStripe, Stripe } from '@stripe/stripe-js';

// Stripe configuration
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

// Note: Price IDs are managed in functions/src/plan-config.ts
// These are kept for reference only (Professional plan)
export const STRIPE_PRODUCT_ID = 'prod_TYWEIL2gnwQmvD'; // Professional plan product ($35/month)
export const STRIPE_PRICE_ID = 'price_1SbPCBELOV3w2OwuwlZDaIwz'; // Professional plan price ($35/month)

// Initialize Stripe
let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

// Check if Stripe is configured
export const isStripeConfigured = () => {
  return !!STRIPE_PUBLISHABLE_KEY && STRIPE_PUBLISHABLE_KEY.startsWith('pk_');
};

