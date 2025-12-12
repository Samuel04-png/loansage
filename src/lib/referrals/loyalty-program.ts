/**
 * Referral and Loyalty Program
 */

import { collection, addDoc, doc, updateDoc, getDoc, getDocs, query, where, increment } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ReferralProgram, LoyaltyPoints, LoyaltyTransaction } from '../../types/features';

/**
 * Get referral program settings
 */
export async function getReferralProgram(agencyId: string): Promise<ReferralProgram | null> {
  const agencyRef = doc(db, 'agencies', agencyId);
  const agencySnap = await getDoc(agencyRef);
  
  if (!agencySnap.exists()) {
    return null;
  }

  const agencyData = agencySnap.data();
  return agencyData.referralProgram as ReferralProgram | null;
}

/**
 * Update referral program settings
 */
export async function updateReferralProgram(
  agencyId: string,
  program: ReferralProgram
): Promise<void> {
  const agencyRef = doc(db, 'agencies', agencyId);
  await updateDoc(agencyRef, {
    referralProgram: program,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Get loyalty points for a customer
 */
export async function getLoyaltyPoints(
  agencyId: string,
  customerId: string
): Promise<LoyaltyPoints | null> {
  const pointsRef = doc(db, 'agencies', agencyId, 'loyalty_points', customerId);
  const pointsSnap = await getDoc(pointsRef);
  
  if (!pointsSnap.exists()) {
    // Initialize with zero points
    return {
      customerId,
      totalPoints: 0,
      availablePoints: 0,
      usedPoints: 0,
      transactions: [],
    };
  }

  const data = pointsSnap.data();
  return {
    customerId,
    totalPoints: data.totalPoints || 0,
    availablePoints: data.availablePoints || 0,
    usedPoints: data.usedPoints || 0,
    transactions: (data.transactions || []).map((t: any) => ({
      ...t,
      createdAt: t.createdAt?.toDate() || new Date(t.createdAt),
    })),
  };
}

/**
 * Award loyalty points
 */
export async function awardLoyaltyPoints(
  agencyId: string,
  customerId: string,
  points: number,
  reason: string,
  loanId?: string
): Promise<void> {
  const pointsRef = doc(db, 'agencies', agencyId, 'loyalty_points', customerId);
  const pointsSnap = await getDoc(pointsRef);

  const transaction: LoyaltyTransaction = {
    id: `txn-${Date.now()}`,
    type: 'earned',
    points,
    reason,
    loanId,
    createdAt: new Date(),
  };

  if (pointsSnap.exists()) {
    const currentData = pointsSnap.data();
    const transactions = currentData.transactions || [];
    transactions.push(transaction);

    await updateDoc(pointsRef, {
      totalPoints: increment(points),
      availablePoints: increment(points),
      transactions,
      updatedAt: new Date().toISOString(),
    });
  } else {
    await addDoc(collection(db, 'agencies', agencyId, 'loyalty_points'), {
      customerId,
      totalPoints: points,
      availablePoints: points,
      usedPoints: 0,
      transactions: [transaction],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

/**
 * Redeem loyalty points
 */
export async function redeemLoyaltyPoints(
  agencyId: string,
  customerId: string,
  points: number,
  reason: string
): Promise<void> {
  const pointsRef = doc(db, 'agencies', agencyId, 'loyalty_points', customerId);
  const pointsSnap = await getDoc(pointsRef);

  if (!pointsSnap.exists()) {
    throw new Error('No loyalty points available');
  }

  const currentData = pointsSnap.data();
  if (currentData.availablePoints < points) {
    throw new Error('Insufficient points');
  }

  const transaction: LoyaltyTransaction = {
    id: `txn-${Date.now()}`,
    type: 'redeemed',
    points: -points,
    reason,
    createdAt: new Date(),
  };

  const transactions = currentData.transactions || [];
  transactions.push(transaction);

  await updateDoc(pointsRef, {
    availablePoints: increment(-points),
    usedPoints: increment(points),
    transactions,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Process referral reward
 */
export async function processReferralReward(
  agencyId: string,
  referrerId: string,
  referredId: string,
  loanId: string
): Promise<void> {
  const program = await getReferralProgram(agencyId);
  
  if (!program || !program.enabled) {
    return; // Referral program not enabled
  }

  // Award points to referrer
  if (program.rewardType === 'points') {
    await awardLoyaltyPoints(
      agencyId,
      referrerId,
      program.referralReward,
      `Referral reward for referring customer`,
      loanId
    );
  }

  // Award points to referee
  if (program.rewardType === 'points') {
    await awardLoyaltyPoints(
      agencyId,
      referredId,
      program.refereeReward,
      `Welcome bonus for being referred`,
      loanId
    );
  }

  // Record referral
  const referralsRef = collection(db, 'agencies', agencyId, 'referrals');
  await addDoc(referralsRef, {
    referrerId,
    referredId,
    loanId,
    referrerReward: program.referralReward,
    refereeReward: program.refereeReward,
    rewardType: program.rewardType,
    status: 'completed',
    createdAt: new Date().toISOString(),
  });
}

