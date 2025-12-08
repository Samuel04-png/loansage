/**
 * Subscription and Plan Management Helpers
 * Handles free trial (30 days) and paid plan logic
 */

import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

export type PlanType = 'free' | 'paid';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing' | 'expired';

export interface AgencySubscription {
  planType: PlanType;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionId?: string;
  stripeCustomerId?: string;
  trialStartDate?: Date;
  trialEndDate?: Date;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  lastPaymentDate?: Date;
  nextPaymentDate?: Date;
}

/**
 * Check if agency is on free plan (30-day trial)
 */
export function isFreePlan(subscription: AgencySubscription | null): boolean {
  if (!subscription) return true; // Default to free if no subscription data
  
  // If explicitly set to paid and has active subscription, it's paid
  if (subscription.planType === 'paid' && subscription.subscriptionStatus === 'active') {
    return false;
  }
  
  // If on free plan, check if trial is still valid (30 days)
  if (subscription.planType === 'free' || !subscription.planType) {
    if (subscription.trialEndDate) {
      const trialEnd = subscription.trialEndDate instanceof Date 
        ? subscription.trialEndDate 
        : new Date(subscription.trialEndDate);
      return new Date() < trialEnd;
    }
    // If no trial end date, check if created within last 30 days
    if (subscription.trialStartDate) {
      const trialStart = subscription.trialStartDate instanceof Date 
        ? subscription.trialStartDate 
        : new Date(subscription.trialStartDate);
      const daysSinceStart = (Date.now() - trialStart.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceStart < 30;
    }
    // Default: assume free trial if no dates set
    return true;
  }
  
  return false;
}

/**
 * Check if agency should be downgraded to free plan
 * (paid plan but payment is past due or subscription cancelled)
 */
export function shouldDowngradeToFree(subscription: AgencySubscription | null): boolean {
  if (!subscription) return false;
  
  // If already on free plan, no need to downgrade
  if (subscription.planType === 'free' || isFreePlan(subscription)) {
    return false;
  }
  
  // If on paid plan but subscription is past_due, cancelled, or expired
  if (subscription.planType === 'paid') {
    const status = subscription.subscriptionStatus;
    if (status === 'past_due' || status === 'cancelled' || status === 'expired') {
      return true;
    }
    
    // If no payment in last 35 days (grace period after 30-day billing cycle)
    if (subscription.lastPaymentDate) {
      const lastPayment = subscription.lastPaymentDate instanceof Date 
        ? subscription.lastPaymentDate 
        : new Date(subscription.lastPaymentDate);
      const daysSincePayment = (Date.now() - lastPayment.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePayment > 35) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get current plan status for an agency by fetching from Firestore (async version)
 * @deprecated Use getAgencyPlanStatus with agency object instead
 */
export async function getAgencyPlanStatusAsync(agencyId: string): Promise<{
  planType: PlanType;
  status: SubscriptionStatus;
  isActive: boolean;
  daysRemaining?: number;
  shouldDowngrade: boolean;
}> {
  try {
    const agencyRef = doc(db, 'agencies', agencyId);
    const agencyDoc = await getDoc(agencyRef);
    
    if (!agencyDoc.exists()) {
      return {
        planType: 'free',
        status: 'trialing',
        isActive: true,
        shouldDowngrade: false,
      };
    }
    
    const agencyData = agencyDoc.data();
    const subscription: AgencySubscription = {
      planType: (agencyData.planType as PlanType) || 'free',
      subscriptionStatus: agencyData.subscriptionStatus as SubscriptionStatus,
      subscriptionId: agencyData.subscriptionId,
      stripeCustomerId: agencyData.stripeCustomerId,
      trialStartDate: agencyData.trialStartDate?.toDate?.() || agencyData.trialStartDate,
      trialEndDate: agencyData.trialEndDate?.toDate?.() || agencyData.trialEndDate,
      subscriptionStartDate: agencyData.subscriptionStartDate?.toDate?.() || agencyData.subscriptionStartDate,
      subscriptionEndDate: agencyData.subscriptionEndDate?.toDate?.() || agencyData.subscriptionEndDate,
      lastPaymentDate: agencyData.lastPaymentDate?.toDate?.() || agencyData.lastPaymentDate,
      nextPaymentDate: agencyData.nextPaymentDate?.toDate?.() || agencyData.nextPaymentDate,
    };
    
    // Check if should downgrade
    const shouldDowngrade = shouldDowngradeToFree(subscription);
    
    // If should downgrade, update the agency
    if (shouldDowngrade) {
      await updateDoc(agencyRef, {
        planType: 'free',
        subscriptionStatus: 'expired',
        updatedAt: serverTimestamp(),
      });
      subscription.planType = 'free';
      subscription.subscriptionStatus = 'expired';
    }
    
    const isFree = isFreePlan(subscription);
    const status = subscription.subscriptionStatus || (isFree ? 'trialing' : 'active');
    
    // Calculate days remaining for free trial
    let daysRemaining: number | undefined;
    if (isFree && subscription.trialEndDate) {
      const trialEnd = subscription.trialEndDate instanceof Date 
        ? subscription.trialEndDate 
        : new Date(subscription.trialEndDate);
      const now = new Date();
      daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) daysRemaining = 0;
    }
    
    return {
      planType: isFree ? 'free' : 'paid',
      status,
      isActive: status === 'active' || status === 'trialing',
      daysRemaining,
      shouldDowngrade,
    };
  } catch (error) {
    console.error('Error getting agency plan status:', error);
    // Default to free plan on error
    return {
      planType: 'free',
      status: 'trialing',
      isActive: true,
      shouldDowngrade: false,
    };
  }
}

/**
 * Get plan status from an Agency object (synchronous version - uses existing agency data)
 */
export function getAgencyPlanStatus(agency: any): {
  planType: PlanType;
  daysRemaining: number | null;
  isTrialing: boolean;
  isExpired: boolean;
  subscriptionStatus: SubscriptionStatus;
} {
  if (!agency) {
    return {
      planType: 'free',
      daysRemaining: null,
      isTrialing: false,
      isExpired: true,
      subscriptionStatus: 'expired',
    };
  }

  const planType = agency.planType || 'free';
  const subscriptionStatus = agency.subscriptionStatus || 'expired';
  let daysRemaining: number | null = null;
  let isTrialing = false;
  let isExpired = false;

  if (planType === 'free' && agency.trialEndDate) {
    const now = new Date();
    const trialEnd = agency.trialEndDate?.toDate?.() || agency.trialEndDate;
    const trialEndDate = trialEnd instanceof Date ? trialEnd : new Date(trialEnd);
    const diffTime = trialEndDate.getTime() - now.getTime();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    isTrialing = daysRemaining > 0;
    isExpired = daysRemaining <= 0;
  }

  return {
    planType,
    daysRemaining,
    isTrialing,
    isExpired,
    subscriptionStatus,
  };
}

/**
 * Initialize free trial for a new agency
 */
export async function initializeFreeTrial(agencyId: string): Promise<void> {
  try {
    const agencyRef = doc(db, 'agencies', agencyId);
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 30); // 30 days from now
    
    await updateDoc(agencyRef, {
      planType: 'free',
      subscriptionStatus: 'trialing',
      trialStartDate: serverTimestamp(),
      trialEndDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error initializing free trial:', error);
    throw error;
  }
}

