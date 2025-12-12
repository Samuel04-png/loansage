/**
 * Mobile Money Integration Service
 * Supports MTN Mobile Money, Airtel Money, and other providers
 */

import { collection, addDoc, doc, updateDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { MobileMoneyProvider, PaymentLink } from '../../types/features';

// Mobile Money API configurations (should be in environment variables)
const MTN_API_KEY = import.meta.env.VITE_MTN_API_KEY || '';
const MTN_API_SECRET = import.meta.env.VITE_MTN_API_SECRET || '';
const AIRTEL_API_KEY = import.meta.env.VITE_AIRTEL_API_KEY || '';
const AIRTEL_API_SECRET = import.meta.env.VITE_AIRTEL_API_SECRET || '';

/**
 * Generate payment link for MTN Mobile Money
 */
async function generateMTNPaymentLink(
  amount: number,
  phoneNumber: string,
  reference: string
): Promise<{ link: string; transactionId: string }> {
  // This is a placeholder - actual implementation would call MTN API
  // MTN Mobile Money API documentation: https://momodeveloper.mtn.com/
  
  if (!MTN_API_KEY || !MTN_API_SECRET) {
    throw new Error('MTN Mobile Money API credentials not configured');
  }

  // Simulated API call - replace with actual MTN API integration
  const transactionId = `MTN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const link = `https://pay.mtn.com/${transactionId}`;

  return { link, transactionId };
}

/**
 * Generate payment link for Airtel Money
 */
async function generateAirtelPaymentLink(
  amount: number,
  phoneNumber: string,
  reference: string
): Promise<{ link: string; transactionId: string }> {
  // This is a placeholder - actual implementation would call Airtel API
  // Airtel Money API documentation: https://developer.airtel.com/
  
  if (!AIRTEL_API_KEY || !AIRTEL_API_SECRET) {
    throw new Error('Airtel Money API credentials not configured');
  }

  // Simulated API call - replace with actual Airtel API integration
  const transactionId = `AIRTEL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const link = `https://pay.airtel.com/${transactionId}`;

  return { link, transactionId };
}

/**
 * Create payment link
 */
export async function createPaymentLink(
  agencyId: string,
  loanId: string,
  customerId: string,
  amount: number,
  provider: 'mtn' | 'airtel' | 'zamtel'
): Promise<PaymentLink> {
  // Get customer phone number
  const customerRef = doc(db, 'agencies', agencyId, 'customers', customerId);
  const customerSnap = await getDoc(customerRef);
  
  if (!customerSnap.exists()) {
    throw new Error('Customer not found');
  }

  const customerData = customerSnap.data();
  const phoneNumber = customerData.phone || customerData.phoneNumber;
  
  if (!phoneNumber) {
    throw new Error('Customer phone number not found');
  }

  // Generate payment link based on provider
  let linkData: { link: string; transactionId: string };
  const reference = `LOAN-${loanId}-${Date.now()}`;

  if (provider === 'mtn') {
    linkData = await generateMTNPaymentLink(amount, phoneNumber, reference);
  } else if (provider === 'airtel') {
    linkData = await generateAirtelPaymentLink(amount, phoneNumber, reference);
  } else {
    // Zamtel or other providers - similar implementation
    const transactionId = `ZAMTEL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    linkData = {
      link: `https://pay.zamtel.com/${transactionId}`,
      transactionId,
    };
  }

  // Create payment link record
  const paymentLinksRef = collection(db, 'agencies', agencyId, 'payment_links');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // Expires in 24 hours

  const paymentLink: Omit<PaymentLink, 'id'> = {
    loanId,
    customerId,
    amount,
    provider,
    link: linkData.link,
    expiresAt,
    status: 'pending',
  };

  const docRef = await addDoc(paymentLinksRef, {
    ...paymentLink,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    id: docRef.id,
    ...paymentLink,
  };
}

/**
 * Verify payment status
 */
export async function verifyPayment(
  agencyId: string,
  paymentLinkId: string
): Promise<{ paid: boolean; transactionId?: string; paidAt?: Date }> {
  const paymentLinkRef = doc(db, 'agencies', agencyId, 'payment_links', paymentLinkId);
  const paymentLinkSnap = await getDoc(paymentLinkRef);
  
  if (!paymentLinkSnap.exists()) {
    throw new Error('Payment link not found');
  }

  const paymentLink = paymentLinkSnap.data() as PaymentLink;

  // In production, this would call the mobile money provider's API to verify payment
  // For now, we'll simulate checking the status
  // You would implement webhook handlers to receive payment confirmations

  if (paymentLink.status === 'paid') {
    return {
      paid: true,
      transactionId: paymentLink.transactionId,
      paidAt: paymentLink.paidAt,
    };
  }

  return { paid: false };
}

/**
 * Get payment links for a loan
 */
export async function getPaymentLinks(
  agencyId: string,
  loanId: string
): Promise<PaymentLink[]> {
  const paymentLinksRef = collection(db, 'agencies', agencyId, 'payment_links');
  const q = query(paymentLinksRef, where('loanId', '==', loanId));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    expiresAt: doc.data().expiresAt?.toDate(),
    paidAt: doc.data().paidAt?.toDate(),
  })) as PaymentLink[];
}

/**
 * Update payment link status (called by webhook)
 */
export async function updatePaymentLinkStatus(
  agencyId: string,
  paymentLinkId: string,
  status: PaymentLink['status'],
  transactionId?: string
): Promise<void> {
  const paymentLinkRef = doc(db, 'agencies', agencyId, 'payment_links', paymentLinkId);
  
  const updateData: any = {
    status,
    updatedAt: new Date().toISOString(),
  };

  if (status === 'paid') {
    updateData.paidAt = new Date().toISOString();
    if (transactionId) {
      updateData.transactionId = transactionId;
    }
  }

  await updateDoc(paymentLinkRef, updateData);
}

