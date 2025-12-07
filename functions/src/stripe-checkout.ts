import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

/**
 * Create Stripe Checkout Session
 */
export const createCheckoutSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { agencyId, priceId, successUrl, cancelUrl } = data;

  if (!agencyId || !priceId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
  }

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

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.APP_URL || 'https://loansage.com'}/admin/settings?payment=success`,
      cancel_url: cancelUrl || `${process.env.APP_URL || 'https://loansage.com'}/admin/plans?payment=cancelled`,
      metadata: {
        agencyId,
        userId: context.auth.uid,
      },
    });

    return { sessionId: session.id };
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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Stripe webhook secret not configured');
    res.status(500).send('Webhook secret not configured');
    return;
  }

  let event: Stripe.Event;

  try {
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
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    res.status(500).send(`Webhook handler error: ${error.message}`);
  }
});

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const agencyId = session.metadata?.agencyId;
  if (!agencyId) return;

  // Save payment record
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

  // Update agency subscription status
  await admin.firestore().doc(`agencies/${agencyId}`).update({
    subscriptionStatus: 'active',
    subscriptionId: session.subscription as string,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
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

  // Update agency subscription
  await admin.firestore().doc(`agencies/${agencyId}`).update({
    subscriptionStatus: 'active',
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

  // Update agency subscription status
  await admin.firestore().doc(`agencies/${agencyId}`).update({
    subscriptionStatus: 'past_due',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
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

  // Update agency subscription status
  await admin.firestore().doc(`agencies/${agencyId}`).update({
    subscriptionStatus: 'cancelled',
    subscriptionId: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

