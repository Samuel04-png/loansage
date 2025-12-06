/**
 * Profit Projection on Collateral Liquidation
 * Calculates profit/loss from selling collateral vs defaulted loan
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface CollateralProfitRequest {
  agencyId: string;
  loanId: string;
  collateralId: string;
}

interface CollateralProfitResponse {
  loanAmount: number;
  totalOwed: number;
  collateralValue: number;
  quickSaleValue: number;
  auctionValue: number;
  profitQuickSale: number;
  profitAuction: number;
  lossQuickSale: number;
  lossAuction: number;
  recommendation: string;
}

export const calculateCollateralProfit = functions.https.onCall(
  async (data: CollateralProfitRequest, context: any): Promise<CollateralProfitResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { agencyId, loanId, collateralId } = data;

    try {
      // Get loan data
      const loanRef = db.doc(`agencies/${agencyId}/loans/${loanId}`);
      const loanSnap = await loanRef.get();

      if (!loanSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Loan not found');
      }

      const loan = loanSnap.data()!;
      const principal = loan.amount || 0;
      const interestRate = loan.interestRate || 0;
      const durationMonths = loan.durationMonths || 12;

      // Calculate total owed
      const totalInterest = principal * (interestRate / 100) * (durationMonths / 12);
      const totalOwed = principal + totalInterest;

      // Get collateral data
      const collateralRef = db.doc(`agencies/${agencyId}/collateral/${collateralId}`);
      const collateralSnap = await collateralRef.get();

      if (!collateralSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Collateral not found');
      }

      const collateral = collateralSnap.data()!;
      const collateralValue = collateral.estimatedValue || 0;

      // Calculate sale values
      const quickSaleValue = Math.round(collateralValue * 0.65); // 65% for quick sale
      const auctionValue = Math.round(collateralValue * 0.45); // 45% for auction

      // Calculate profit/loss
      const profitQuickSale = quickSaleValue - totalOwed;
      const profitAuction = auctionValue - totalOwed;
      const lossQuickSale = Math.max(0, totalOwed - quickSaleValue);
      const lossAuction = Math.max(0, totalOwed - auctionValue);

      // Generate recommendation
      let recommendation = '';
      if (profitQuickSale > 0) {
        recommendation = `Quick sale recommended. Profit: ${profitQuickSale.toLocaleString()} ZMW`;
      } else if (profitAuction > 0) {
        recommendation = `Auction recommended. Profit: ${profitAuction.toLocaleString()} ZMW`;
      } else if (lossQuickSale < lossAuction) {
        recommendation = `Quick sale minimizes loss. Loss: ${lossQuickSale.toLocaleString()} ZMW`;
      } else {
        recommendation = `Auction minimizes loss. Loss: ${lossAuction.toLocaleString()} ZMW`;
      }

      return {
        loanAmount: principal,
        totalOwed: Math.round(totalOwed),
        collateralValue,
        quickSaleValue,
        auctionValue,
        profitQuickSale: Math.round(profitQuickSale),
        profitAuction: Math.round(profitAuction),
        lossQuickSale: Math.round(lossQuickSale),
        lossAuction: Math.round(lossAuction),
        recommendation,
      };
    } catch (error: any) {
      console.error('Collateral profit calculation error:', error);
      throw new functions.https.HttpsError('internal', 'Calculation failed', error.message);
    }
  }
);

