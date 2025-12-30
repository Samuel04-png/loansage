import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { PLAN_CONFIG, getPriceIdForPlan, getPlanFromPriceId, type PlanCode } from './plan-config';

// Get Stripe secret key from environment variable
// For Vercel: Set in Vercel dashboard as STRIPE_SECRET_KEY
// For Firebase Functions: Set via firebase functions:config:set stripe.secret_key="sk_live_..."
// For local dev: Use .env.local in root or .env in functions directory
const getStripeSecretKey = () => {
  // Priority 1: Environment variable (works with Vercel, Firebase Functions runtime config, and local .env)
  if (process.env.STRIPE_SECRET_KEY) {
    return process.env.STRIPE_SECRET_KEY;
  }
  // Priority 2: Firebase Functions config (legacy method, still supported)
  const config = functions.config();
  if (config?.stripe?.secret_key) {
    return config.stripe.secret_key;
  }
  // Fallback: Return empty string (will cause error, which is better than silent failure)
  console.error('STRIPE_SECRET_KEY not found in environment variables or Firebase config');
  return '';
};

// Lazy Stripe initialization to avoid deployment timeouts
const getStripe = () => {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return new Stripe(secretKey, {
    apiVersion: '2023-10-16',
  });
};

/**
 * Create Stripe Checkout Session
 */
export const createCheckoutSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  console.log('createCheckoutSession called with data:', JSON.stringify(data, null, 2));

  const { agencyId, plan, priceId, successUrl, cancelUrl } = data as {
    agencyId?: string;
    plan?: PlanCode;
    priceId?: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  // Validate required parameters with specific error messages
  if (!agencyId || typeof agencyId !== 'string' || agencyId.trim() === '') {
    console.error('Missing or invalid agencyId:', agencyId);
    throw new functions.https.HttpsError('invalid-argument', 'Missing or invalid agencyId parameter');
  }

  // If plan is provided, use it; otherwise require priceId
  if (!plan && !priceId) {
    console.error('Missing both plan and priceId');
    throw new functions.https.HttpsError('invalid-argument', 'Missing plan or priceId parameter. Please provide either a plan code or a Stripe price ID.');
  }

  // Validate plan if provided
  if (plan && !['starter', 'professional', 'enterprise'].includes(plan)) {
    console.error('Invalid plan code:', plan);
    throw new functions.https.HttpsError('invalid-argument', `Invalid plan code: ${plan}. Must be 'starter', 'professional', or 'enterprise'.`);
  }

  // Resolve price ID from plan if provided
  const resolvedPriceId = priceId || (plan ? getPriceIdForPlan(plan) : null);
  
  if (!resolvedPriceId) {
    throw new functions.https.HttpsError('failed-precondition', 'Price ID not configured for plan. Please contact support.');
  }

  // Validate plan if provided
  const resolvedPlan: PlanCode = plan || getPlanFromPriceId(resolvedPriceId);

  try {
    // Get agency data
    const agencyDoc = await admin.firestore().doc(`agencies/${agencyId}`).get();
    if (!agencyDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Agency not found');
    }

    const agencyData = agencyDoc.data();
    const customerEmail = agencyData?.email || context.auth.token.email;

    // Create or retrieve Stripe customer
    let customerId = agencyData?.stripeCustomerId;
    
    if (!customerId) {
      const stripe = getStripe();
      const customer = await stripe.customers.create({
        email: customerEmail,
        metadata: {
          agencyId,
          userId: context.auth.uid,
        },
      });
      customerId = customer.id;
      
      // Save customer ID to agency
      await admin.firestore().doc(`agencies/${agencyId}`).update({
        stripeCustomerId: customerId,
      });
    }

    // Check if this is a starter plan (14-day trial without payment)
    const isStarterPlan = resolvedPlan === 'starter';
    
    // Create checkout session
    const stripe = getStripe();
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: resolvedPriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.APP_URL || 'https://tengaloans.com'}/admin/settings?payment=success`,
      cancel_url: cancelUrl || `${process.env.APP_URL || 'https://tengaloans.com'}/admin/plans?payment=cancelled`,
      metadata: {
        agencyId,
        plan: resolvedPlan,
        userId: context.auth.uid,
      },
    };

    // For starter plan, add 14-day trial without requiring payment method upfront
    if (isStarterPlan) {
      sessionParams.subscription_data = {
        trial_period_days: 14,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel', // Cancel subscription if no payment method added by trial end
          },
        },
      };
      // Allow trial without payment method
      sessionParams.payment_method_collection = 'if_required';
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Return the checkout URL instead of sessionId (new Stripe.js API)
    return { checkoutUrl: session.url };
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to create checkout session');
  }
});

/**
 * Stripe Webhook Handler
 */
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  
  // Get webhook secret from environment variable or Firebase Functions config
  // Priority: Environment variable (Vercel/Firebase runtime) > Firebase Functions config
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || functions.config()?.stripe?.webhook_secret;

  if (!webhookSecret) {
    console.error('Stripe webhook secret not configured');
    res.status(500).send('Webhook secret not configured');
    return;
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleTrialWillEnd(subscription);
        break;
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    res.status(500).send(`Webhook handler error: ${error.message}`);
  }
});

/**
 * Apply plan configuration to agency
 */
async function applyPlanToAgency(
  agencyId: string,
  plan: PlanCode,
  subscriptionId?: string
): Promise<void> {
  const planConfig = PLAN_CONFIG[plan];
  
  await admin.firestore().doc(`agencies/${agencyId}`).update({
    plan,
    loanTypeLimit: planConfig.limits.loanTypeLimit,
    maxCustomers: planConfig.quotas.maxCustomers,
    maxActiveLoans: planConfig.quotas.maxActiveLoans,
    features: planConfig.features,
    ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
    subscriptionStatus: 'active',
    subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
    lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const agencyId = session.metadata?.agencyId as string | undefined;
  if (!agencyId) return;

  // Get plan from metadata or resolve from subscription
  let plan: PlanCode = (session.metadata?.plan as PlanCode) || 'professional';
  
  // If no plan in metadata, try to get from subscription
  let subscription: Stripe.Subscription | null = null;
  if (session.subscription && typeof session.subscription === 'string') {
    try {
      const stripe = getStripe();
      subscription = await stripe.subscriptions.retrieve(session.subscription);
      const priceId = subscription.items.data[0]?.price?.id;
      if (priceId) {
        plan = getPlanFromPriceId(priceId);
      }
    } catch (error) {
      console.error('Error retrieving subscription:', error);
    }
  }

  // For starter plan with trial, set trial dates
  if (plan === 'starter' && subscription) {
    const trialStart = subscription.trial_start 
      ? new Date(subscription.trial_start * 1000)
      : admin.firestore.Timestamp.now().toDate();
    const trialEnd = subscription.trial_end 
      ? new Date(subscription.trial_end * 1000)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

    await admin.firestore().doc(`agencies/${agencyId}`).update({
      plan: 'starter',
      planType: 'free',
      subscriptionStatus: subscription.status === 'trialing' ? 'trialing' : 'active',
      stripeSubscriptionId: subscription.id,
      trialStartDate: admin.firestore.Timestamp.fromDate(trialStart),
      trialEndDate: admin.firestore.Timestamp.fromDate(trialEnd),
      subscriptionStartDate: subscription.current_period_start 
        ? admin.firestore.Timestamp.fromDate(new Date(subscription.current_period_start * 1000))
        : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Apply starter plan configuration
    await applyPlanToAgency(agencyId, 'starter', subscription.id);
    return;
  }

  // Save payment record (for paid plans)
  if (session.amount_total && session.amount_total > 0) {
    const paymentData = {
      id: session.id,
      amount: session.amount_total || 0,
      currency: session.currency || 'usd',
      status: session.payment_status === 'paid' ? 'succeeded' : 'pending',
      description: 'Subscription payment',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      stripeSessionId: session.id,
      stripeCustomerId: session.customer as string,
    };

    await admin.firestore()
      .collection('agencies')
      .doc(agencyId)
      .collection('payments')
      .doc(session.id)
      .set(paymentData);
  }

  // Apply plan configuration to agency
  await applyPlanToAgency(agencyId, plan, session.subscription as string);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  // Find agency by Stripe customer ID
  const agenciesSnapshot = await admin.firestore()
    .collection('agencies')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (agenciesSnapshot.empty) return;

  const agencyId = agenciesSnapshot.docs[0].id;
  
  // Get plan from subscription price
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) return;
  
  const plan = getPlanFromPriceId(priceId);
  
  // Handle different subscription statuses
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    // For starter plan, update trial dates
    if (plan === 'starter') {
      const trialStart = subscription.trial_start 
        ? admin.firestore.Timestamp.fromDate(new Date(subscription.trial_start * 1000))
        : admin.firestore.FieldValue.serverTimestamp();
      const trialEnd = subscription.trial_end 
        ? admin.firestore.Timestamp.fromDate(new Date(subscription.trial_end * 1000))
        : admin.firestore.FieldValue.serverTimestamp();

      await admin.firestore().doc(`agencies/${agencyId}`).update({
        plan: 'starter',
        planType: subscription.status === 'trialing' ? 'free' : 'paid',
        subscriptionStatus: subscription.status === 'trialing' ? 'trialing' : 'active',
        stripeSubscriptionId: subscription.id,
        trialStartDate: trialStart,
        trialEndDate: trialEnd,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await applyPlanToAgency(agencyId, plan, subscription.id);
  } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
    // Keep plan but update status
    await admin.firestore().doc(`agencies/${agencyId}`).update({
      subscriptionStatus: 'past_due',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
    // Trial expired or subscription canceled - restrict access
    await admin.firestore().doc(`agencies/${agencyId}`).update({
      subscriptionStatus: 'expired',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  // Find agency by Stripe customer ID
  const agenciesSnapshot = await admin.firestore()
    .collection('agencies')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (agenciesSnapshot.empty) return;

  const agencyId = agenciesSnapshot.docs[0].id;

  // Save payment record
  const paymentData = {
    id: invoice.id,
    amount: invoice.amount_paid || 0,
    currency: invoice.currency || 'usd',
    status: 'succeeded',
    description: invoice.description || 'Subscription payment',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    invoiceId: invoice.id,
    receiptUrl: invoice.hosted_invoice_url || null,
    stripeCustomerId: customerId,
  };

  await admin.firestore()
    .collection('agencies')
    .doc(agencyId)
    .collection('payments')
    .doc(invoice.id)
    .set(paymentData, { merge: true });

  // Update subscription status (plan should already be set from checkout or subscription.updated)
  await admin.firestore().doc(`agencies/${agencyId}`).update({
    subscriptionStatus: 'active',
    lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  const agenciesSnapshot = await admin.firestore()
    .collection('agencies')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (agenciesSnapshot.empty) return;

  const agencyId = agenciesSnapshot.docs[0].id;

  // Save failed payment record
  const paymentData = {
    id: invoice.id,
    amount: invoice.amount_due || 0,
    currency: invoice.currency || 'usd',
    status: 'failed',
    description: invoice.description || 'Subscription payment failed',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    invoiceId: invoice.id,
    stripeCustomerId: customerId,
  };

  await admin.firestore()
    .collection('agencies')
    .doc(agencyId)
    .collection('payments')
    .doc(invoice.id)
    .set(paymentData, { merge: true });

  // Update agency subscription status - payment failed
  await admin.firestore().doc(`agencies/${agencyId}`).update({
    subscriptionStatus: 'past_due',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  // Check if should downgrade to starter plan (after 35 days of no payment)
  const agencyDoc = await admin.firestore().doc(`agencies/${agencyId}`).get();
  const agencyData = agencyDoc.data();
  const lastPayment = agencyData?.lastPaymentDate?.toDate?.() || agencyData?.lastPaymentDate;
  
  if (lastPayment) {
    const daysSincePayment = (Date.now() - lastPayment.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePayment > 35) {
      // Downgrade to starter plan
      await applyPlanToAgency(agencyId, 'starter');
      await admin.firestore().doc(`agencies/${agencyId}`).update({
        subscriptionStatus: 'expired',
      });
    }
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  const agenciesSnapshot = await admin.firestore()
    .collection('agencies')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (agenciesSnapshot.empty) return;

  const agencyId = agenciesSnapshot.docs[0].id;

  // Downgrade to starter plan
  await applyPlanToAgency(agencyId, 'starter');
  await admin.firestore().doc(`agencies/${agencyId}`).update({
    subscriptionStatus: 'cancelled',
    stripeSubscriptionId: null,
  });
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  const agenciesSnapshot = await admin.firestore()
    .collection('agencies')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (agenciesSnapshot.empty) return;

  const agencyId = agenciesSnapshot.docs[0].id;

  // Update trial end date and notify that payment will be required
  const trialEnd = subscription.trial_end 
    ? admin.firestore.Timestamp.fromDate(new Date(subscription.trial_end * 1000))
    : admin.firestore.FieldValue.serverTimestamp();

  await admin.firestore().doc(`agencies/${agencyId}`).update({
    trialEndDate: trialEnd,
    subscriptionStatus: 'trialing',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // TODO: Send notification email to user about trial ending
}

