/**
 * Advanced Analytics and Forecasting
 */

import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ForecastData, PortfolioHealth } from '../../types/features';

/**
 * Generate revenue forecast
 */
export async function generateRevenueForecast(
  agencyId: string,
  months: number = 12
): Promise<ForecastData[]> {
  // Get historical loan data
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const loansSnapshot = await getDocs(loansRef);
  const loans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Get historical repayments
  const allRepayments: any[] = [];
  for (const loan of loans) {
    try {
      const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loan.id, 'repayments');
      const repaymentsSnapshot = await getDocs(repaymentsRef);
      const loanRepayments = repaymentsSnapshot.docs.map(doc => ({
        loanId: loan.id,
        ...doc.data(),
      }));
      allRepayments.push(...loanRepayments);
    } catch (error) {
      // Skip if repayments don't exist
    }
  }

  // Calculate historical averages
  const monthlyRevenue = calculateMonthlyRevenue(loans, allRepayments);
  const trend = calculateTrend(monthlyRevenue);

  // Generate forecast
  const forecast: ForecastData[] = [];
  const lastMonth = monthlyRevenue[monthlyRevenue.length - 1] || { revenue: 0, loans: 0, defaults: 0 };

  for (let i = 1; i <= months; i++) {
    const month = new Date();
    month.setMonth(month.getMonth() + i);
    const period = month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    // Simple linear forecast (in production, use more sophisticated models)
    const predictedRevenue = lastMonth.revenue * (1 + trend.revenueGrowth);
    const predictedLoans = lastMonth.loans * (1 + trend.loanGrowth);
    const predictedDefaults = lastMonth.defaults * (1 + trend.defaultGrowth);

    forecast.push({
      period,
      predictedRevenue: Math.round(predictedRevenue),
      predictedLoans: Math.round(predictedLoans),
      predictedDefaults: Math.round(predictedDefaults),
      confidence: Math.max(0.5, 1 - (i * 0.05)), // Confidence decreases over time
    });
  }

  return forecast;
}

/**
 * Calculate portfolio health
 */
export async function calculatePortfolioHealth(agencyId: string): Promise<PortfolioHealth> {
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const loansSnapshot = await getDocs(loansRef);
  const loans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Filter out deleted loans
  const activeLoans = loans.filter((l: any) => !l.deleted && l.status === 'active');

  // Calculate metrics
  const totalLoans = loans.length;
  const defaultedLoans = loans.filter((l: any) => l.status === 'defaulted').length;
  const defaultRate = totalLoans > 0 ? defaultedLoans / totalLoans : 0;

  // Calculate collection rate
  let totalDue = 0;
  let totalCollected = 0;

  for (const loan of activeLoans) {
    try {
      const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loan.id, 'repayments');
      const repaymentsSnapshot = await getDocs(repaymentsRef);
      const repayments = repaymentsSnapshot.docs.map(doc => doc.data());

      for (const repayment of repayments) {
        totalDue += Number(repayment.amountDue || 0);
        if (repayment.status === 'paid') {
          totalCollected += Number(repayment.amountPaid || repayment.amountDue || 0);
        }
      }
    } catch (error) {
      // Skip if repayments don't exist
    }
  }

  const collectionRate = totalDue > 0 ? totalCollected / totalDue : 1;

  // Calculate average days to repay
  const averageDaysToRepay = calculateAverageDaysToRepay(loans, agencyId);

  // Calculate portfolio at risk (PAR)
  const par = calculatePortfolioAtRisk(activeLoans, agencyId);

  // Calculate profitability
  const profitability = calculateProfitability(loans, agencyId);

  // Calculate overall score
  const overallScore = Math.round(
    (1 - defaultRate) * 30 +
    collectionRate * 30 +
    (1 - Math.min(par, 1)) * 20 +
    profitability * 20
  );

  // Determine trends
  const trends = await calculateTrends(agencyId);

  // Generate alerts
  const alerts: string[] = [];
  if (defaultRate > 0.15) {
    alerts.push('Default rate is above 15%');
  }
  if (collectionRate < 0.8) {
    alerts.push('Collection rate is below 80%');
  }
  if (par > 0.2) {
    alerts.push('Portfolio at risk is above 20%');
  }
  if (profitability < 0.1) {
    alerts.push('Profitability is below 10%');
  }

  return {
    overallScore,
    metrics: {
      defaultRate,
      collectionRate,
      averageDaysToRepay,
      portfolioAtRisk: par,
      profitability,
    },
    trends,
    alerts,
  };
}

// Helper functions

function calculateMonthlyRevenue(loans: any[], repayments: any[]): Array<{ month: string; revenue: number; loans: number; defaults: number }> {
  const monthly: Record<string, { revenue: number; loans: number; defaults: number }> = {};

  // Group by month
  loans.forEach(loan => {
    const createdAt = loan.createdAt?.toDate?.() || new Date(loan.createdAt);
    const month = createdAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    if (!monthly[month]) {
      monthly[month] = { revenue: 0, loans: 0, defaults: 0 };
    }
    
    monthly[month].loans += 1;
    if (loan.status === 'defaulted') {
      monthly[month].defaults += 1;
    }
  });

  repayments.forEach(repayment => {
    if (repayment.status === 'paid') {
      const paidAt = repayment.paidAt?.toDate?.() || new Date(repayment.paidAt || repayment.createdAt);
      const month = paidAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!monthly[month]) {
        monthly[month] = { revenue: 0, loans: 0, defaults: 0 };
      }
      
      monthly[month].revenue += Number(repayment.amountPaid || repayment.amountDue || 0);
    }
  });

  return Object.entries(monthly).map(([month, data]) => ({ month, ...data }));
}

function calculateTrend(monthlyData: Array<{ revenue: number; loans: number; defaults: number }>): {
  revenueGrowth: number;
  loanGrowth: number;
  defaultGrowth: number;
} {
  if (monthlyData.length < 2) {
    return { revenueGrowth: 0, loanGrowth: 0, defaultGrowth: 0 };
  }

  const recent = monthlyData.slice(-3);
  const older = monthlyData.slice(-6, -3);

  const avgRecentRevenue = recent.reduce((sum, m) => sum + m.revenue, 0) / recent.length;
  const avgOlderRevenue = older.length > 0 ? older.reduce((sum, m) => sum + m.revenue, 0) / older.length : avgRecentRevenue;

  const avgRecentLoans = recent.reduce((sum, m) => sum + m.loans, 0) / recent.length;
  const avgOlderLoans = older.length > 0 ? older.reduce((sum, m) => sum + m.loans, 0) / older.length : avgRecentLoans;

  const avgRecentDefaults = recent.reduce((sum, m) => sum + m.defaults, 0) / recent.length;
  const avgOlderDefaults = older.length > 0 ? older.reduce((sum, m) => sum + m.defaults, 0) / older.length : avgRecentDefaults;

  return {
    revenueGrowth: avgOlderRevenue > 0 ? (avgRecentRevenue - avgOlderRevenue) / avgOlderRevenue : 0,
    loanGrowth: avgOlderLoans > 0 ? (avgRecentLoans - avgOlderLoans) / avgOlderLoans : 0,
    defaultGrowth: avgOlderDefaults > 0 ? (avgRecentDefaults - avgOlderDefaults) / avgOlderDefaults : 0,
  };
}

async function calculateAverageDaysToRepay(loans: any[], agencyId: string): Promise<number> {
  const completedLoans = loans.filter(l => l.status === 'paid' || l.status === 'completed');
  let totalDays = 0;
  let count = 0;

  for (const loan of completedLoans) {
    try {
      const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loan.id, 'repayments');
      const repaymentsSnapshot = await getDocs(repaymentsRef);
      const repayments = repaymentsSnapshot.docs.map(doc => doc.data());

      const lastPayment = repayments
        .filter(r => r.status === 'paid')
        .sort((a, b) => {
          const dateA = a.paidAt?.toDate?.() || new Date(a.paidAt);
          const dateB = b.paidAt?.toDate?.() || new Date(b.paidAt);
          return dateB.getTime() - dateA.getTime();
        })[0];

      if (lastPayment) {
        const disbursementDate = loan.disbursementDate?.toDate?.() || new Date(loan.disbursementDate);
        const lastPaymentDate = lastPayment.paidAt?.toDate?.() || new Date(lastPayment.paidAt);
        const days = Math.floor((lastPaymentDate.getTime() - disbursementDate.getTime()) / (1000 * 60 * 60 * 24));
        totalDays += days;
        count++;
      }
    } catch (error) {
      // Skip if error
    }
  }

  return count > 0 ? Math.round(totalDays / count) : 0;
}

async function calculatePortfolioAtRisk(activeLoans: any[], agencyId: string): Promise<number> {
  let totalAtRisk = 0;
  let totalPortfolio = 0;

  for (const loan of activeLoans) {
    totalPortfolio += Number(loan.amount || 0);

    try {
      const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loan.id, 'repayments');
      const repaymentsSnapshot = await getDocs(repaymentsRef);
      const repayments = repaymentsSnapshot.docs.map(doc => doc.data());

      const overdueRepayments = repayments.filter(r => {
        if (r.status !== 'pending') return false;
        const dueDate = r.dueDate?.toDate?.() || new Date(r.dueDate);
        return dueDate < new Date();
      });

      if (overdueRepayments.length > 0) {
        const overdueAmount = overdueRepayments.reduce((sum, r) => sum + Number(r.amountDue || 0), 0);
        totalAtRisk += overdueAmount;
      }
    } catch (error) {
      // Skip if error
    }
  }

  return totalPortfolio > 0 ? totalAtRisk / totalPortfolio : 0;
}

async function calculateProfitability(loans: any[], agencyId: string): Promise<number> {
  let totalRevenue = 0;
  let totalPrincipal = 0;

  for (const loan of loans) {
    totalPrincipal += Number(loan.amount || 0);

    try {
      const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loan.id, 'repayments');
      const repaymentsSnapshot = await getDocs(repaymentsRef);
      const repayments = repaymentsSnapshot.docs.map(doc => doc.data());

      const paidRepayments = repayments.filter(r => r.status === 'paid');
      const totalPaid = paidRepayments.reduce((sum, r) => sum + Number(r.amountPaid || r.amountDue || 0), 0);
      totalRevenue += totalPaid;
    } catch (error) {
      // Skip if error
    }
  }

  return totalPrincipal > 0 ? (totalRevenue - totalPrincipal) / totalPrincipal : 0;
}

async function calculateTrends(agencyId: string): Promise<PortfolioHealth['trends']> {
  // This would compare current metrics with previous period
  // For now, return stable trends
  return {
    defaultRate: 'stable',
    collectionRate: 'stable',
    profitability: 'stable',
  };
}

