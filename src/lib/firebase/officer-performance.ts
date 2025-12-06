/**
 * Loan Officer Performance Tracking System
 * Comprehensive tracking and leaderboard functionality
 */

import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from './config';

export interface OfficerPerformanceMetrics {
  officerId: string;
  officerName: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
  startDate: Date;
  endDate: Date;
  
  // Loan metrics
  loansApproved: number;
  loansRejected: number;
  loansPending: number;
  totalLoansProcessed: number;
  
  // Financial metrics
  totalRevenueGenerated: number;
  totalPortfolioValue: number;
  totalDisbursed: number;
  totalCollections: number;
  
  // Risk metrics
  averageRiskScore: number;
  highRiskLoans: number; // Loans with risk score >= 50
  lowRiskLoans: number; // Loans with risk score < 30
  
  // Performance metrics
  averageRepaymentSuccess: number; // 0-1, percentage of successful repayments
  defaultRate: number; // 0-1, percentage of defaults
  collectionRate: number; // 0-1, percentage of expected collections
  
  // Calculated scores
  performanceScore: number; // 0-100 composite score
  rank: number; // Ranking among all officers
}

export interface OfficerLeaderboardEntry {
  officerId: string;
  officerName: string;
  performanceScore: number;
  loansApproved: number;
  totalRevenue: number;
  averageRiskScore: number;
  defaultRate: number;
  rank: number;
}

/**
 * Calculate officer performance metrics for a period
 */
export async function calculateOfficerPerformance(
  agencyId: string,
  officerId: string,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time'
): Promise<OfficerPerformanceMetrics> {
  const now = new Date();
  let startDate: Date;
  let endDate = now;

  switch (period) {
    case 'daily':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'weekly':
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'yearly':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'all_time':
      startDate = new Date(0); // Beginning of time
      break;
  }

  // Fetch officer info
  const employeesRef = collection(db, 'agencies', agencyId, 'employees');
  const employeeQuery = query(employeesRef, where('userId', '==', officerId));
  const employeeSnapshot = await getDocs(employeeQuery);
  const employee = employeeSnapshot.docs[0]?.data();
  const officerName = employee?.name || 'Unknown Officer';

  // Fetch loans
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const loansQuery = query(
    loansRef,
    where('officerId', '==', officerId),
    orderBy('createdAt', 'desc')
  );
  const loansSnapshot = await getDocs(loansQuery);
  const allLoans = loansSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Filter by date
  const periodLoans = allLoans.filter((loan: any) => {
    const loanDate = loan.createdAt?.toDate?.() || new Date(loan.createdAt);
    return loanDate >= startDate && loanDate <= endDate;
  });

  // Calculate metrics
  const loansApproved = periodLoans.filter((l: any) => 
    ['approved', 'active', 'completed'].includes(l.status)
  ).length;
  
  const loansRejected = periodLoans.filter((l: any) => 
    l.status === 'rejected'
  ).length;
  
  const loansPending = periodLoans.filter((l: any) => 
    l.status === 'pending'
  ).length;

  // Financial metrics
  const activeLoans = periodLoans.filter((l: any) => l.status === 'active');
  const totalPortfolioValue = activeLoans.reduce(
    (sum: number, loan: any) => sum + Number(loan.amount || 0),
    0
  );
  
  const totalDisbursed = periodLoans.filter((l: any) =>
    ['approved', 'active', 'completed'].includes(l.status)
  ).reduce((sum: number, loan: any) => sum + Number(loan.amount || 0), 0);

  // Calculate revenue (interest collected from completed loans)
  let totalRevenueGenerated = 0;
  let totalCollections = 0;
  let totalExpectedCollections = 0;
  let successfulRepayments = 0;
  let totalRepayments = 0;
  let defaults = 0;
  let totalRiskScore = 0;
  let riskScoreCount = 0;
  let highRiskLoans = 0;
  let lowRiskLoans = 0;

  for (const loan of periodLoans) {
    const loanAmount = Number(loan.amount || 0);
    const interestRate = Number(loan.interestRate || 0);
    const expectedInterest = loanAmount * (interestRate / 100);

    // Fetch repayments
    try {
      const repaymentsRef = collection(
        db,
        'agencies',
        agencyId,
        'loans',
        loan.id,
        'repayments'
      );
      const repaymentsSnapshot = await getDocs(repaymentsRef);
      const repayments = repaymentsSnapshot.docs.map(doc => doc.data());

      const paidRepayments = repayments.filter((r: any) => r.status === 'paid');
      const paidAmount = paidRepayments.reduce(
        (sum: number, r: any) => sum + Number(r.amountPaid || 0),
        0
      );

      totalCollections += paidAmount;
      totalExpectedCollections += loanAmount + expectedInterest;

      // Calculate interest portion (simplified)
      const interestPortion = paidAmount > loanAmount ? paidAmount - loanAmount : 0;
      totalRevenueGenerated += interestPortion;

      totalRepayments += repayments.length;
      successfulRepayments += paidRepayments.length;

      if (loan.status === 'defaulted') {
        defaults++;
      }
    } catch (error) {
      console.warn(`Failed to fetch repayments for loan ${loan.id}:`, error);
    }

    // Risk metrics
    if (loan.riskScore !== undefined) {
      totalRiskScore += Number(loan.riskScore);
      riskScoreCount++;
      
      const riskScore = Number(loan.riskScore);
      if (riskScore >= 50) {
        highRiskLoans++;
      } else if (riskScore < 30) {
        lowRiskLoans++;
      }
    }
  }

  const averageRiskScore = riskScoreCount > 0 ? totalRiskScore / riskScoreCount : 50;
  const averageRepaymentSuccess = totalRepayments > 0 
    ? successfulRepayments / totalRepayments 
    : 0;
  const defaultRate = periodLoans.length > 0 
    ? defaults / periodLoans.length 
    : 0;
  const collectionRate = totalExpectedCollections > 0
    ? totalCollections / totalExpectedCollections
    : 0;

  // Calculate performance score (0-100)
  const performanceScore = calculatePerformanceScore({
    loansApproved,
    totalRevenueGenerated,
    averageRiskScore,
    defaultRate,
    collectionRate,
    averageRepaymentSuccess,
  });

  return {
    officerId,
    officerName,
    period,
    startDate,
    endDate,
    loansApproved,
    loansRejected,
    loansPending,
    totalLoansProcessed: periodLoans.length,
    totalRevenueGenerated,
    totalPortfolioValue,
    totalDisbursed,
    totalCollections,
    averageRiskScore: Math.round(averageRiskScore),
    highRiskLoans,
    lowRiskLoans,
    averageRepaymentSuccess,
    defaultRate,
    collectionRate,
    performanceScore,
    rank: 0, // Will be set by leaderboard function
  };
}

/**
 * Generate leaderboard for all officers
 */
export async function generateOfficerLeaderboard(
  agencyId: string,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time',
  limitCount: number = 10
): Promise<OfficerLeaderboardEntry[]> {
  // Fetch all employees
  const employeesRef = collection(db, 'agencies', agencyId, 'employees');
  const employeesSnapshot = await getDocs(employeesRef);
  const employees = employeesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Calculate performance for each officer
  const performances = await Promise.all(
    employees.map(async (employee: any) => {
      const metrics = await calculateOfficerPerformance(
        agencyId,
        employee.userId,
        period
      );
      return {
        officerId: employee.userId,
        officerName: employee.name || 'Unknown',
        performanceScore: metrics.performanceScore,
        loansApproved: metrics.loansApproved,
        totalRevenue: metrics.totalRevenueGenerated,
        averageRiskScore: metrics.averageRiskScore,
        defaultRate: metrics.defaultRate,
      };
    })
  );

  // Sort by performance score
  performances.sort((a, b) => b.performanceScore - a.performanceScore);

  // Assign ranks and limit
  return performances.slice(0, limitCount).map((perf, index) => ({
    ...perf,
    rank: index + 1,
  }));
}

/**
 * Calculate performance score (0-100)
 */
function calculatePerformanceScore(metrics: {
  loansApproved: number;
  totalRevenueGenerated: number;
  averageRiskScore: number; // Lower is better
  defaultRate: number; // Lower is better
  collectionRate: number; // Higher is better
  averageRepaymentSuccess: number; // Higher is better
}): number {
  let score = 0;

  // Loan volume (0-20 points)
  if (metrics.loansApproved >= 50) score += 20;
  else if (metrics.loansApproved >= 30) score += 15;
  else if (metrics.loansApproved >= 20) score += 10;
  else if (metrics.loansApproved >= 10) score += 5;

  // Revenue generation (0-25 points)
  if (metrics.totalRevenueGenerated >= 100000) score += 25;
  else if (metrics.totalRevenueGenerated >= 50000) score += 20;
  else if (metrics.totalRevenueGenerated >= 25000) score += 15;
  else if (metrics.totalRevenueGenerated >= 10000) score += 10;
  else if (metrics.totalRevenueGenerated >= 5000) score += 5;

  // Risk management (0-20 points, lower risk score is better)
  if (metrics.averageRiskScore < 30) score += 20;
  else if (metrics.averageRiskScore < 40) score += 15;
  else if (metrics.averageRiskScore < 50) score += 10;
  else if (metrics.averageRiskScore < 60) score += 5;

  // Default rate (0-15 points, lower is better)
  if (metrics.defaultRate < 0.05) score += 15;
  else if (metrics.defaultRate < 0.10) score += 10;
  else if (metrics.defaultRate < 0.20) score += 5;

  // Collection rate (0-10 points, higher is better)
  score += metrics.collectionRate * 10;

  // Repayment success (0-10 points, higher is better)
  score += metrics.averageRepaymentSuccess * 10;

  return Math.min(100, Math.round(score));
}

