/**
 * Automated Compliance Reporting
 */

import { collection, addDoc, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ComplianceReport, ComplianceChecklist } from '../../types/features';

/**
 * Generate regulatory report
 */
export async function generateRegulatoryReport(
  agencyId: string,
  period: { start: Date; end: Date }
): Promise<ComplianceReport> {
  // Get all loans in period
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const loansSnapshot = await getDocs(loansRef);
  const allLoans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const periodLoans = allLoans.filter((loan: any) => {
    const createdAt = loan.createdAt?.toDate?.() || new Date(loan.createdAt);
    return createdAt >= period.start && createdAt <= period.end;
  });

  // Calculate metrics
  const totalLoans = periodLoans.length;
  const totalDisbursed = periodLoans.reduce((sum, loan: any) => sum + Number(loan.amount || 0), 0);
  const totalCollected = await calculateTotalCollected(agencyId, periodLoans);
  const defaultedLoans = periodLoans.filter((loan: any) => loan.status === 'defaulted').length;

  // Get customers
  const customersRef = collection(db, 'agencies', agencyId, 'customers');
  const customersSnapshot = await getDocs(customersRef);
  const totalCustomers = customersSnapshot.docs.length;

  const reportData = {
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    },
    summary: {
      totalLoans,
      totalDisbursed,
      totalCollected,
      defaultedLoans,
      defaultRate: totalLoans > 0 ? defaultedLoans / totalLoans : 0,
      totalCustomers,
    },
    loans: periodLoans.map((loan: any) => ({
      id: loan.id,
      amount: loan.amount,
      interestRate: loan.interestRate,
      status: loan.status,
      customerId: loan.customerId || loan.customer_id,
      createdAt: loan.createdAt?.toDate?.() || new Date(loan.createdAt),
    })),
  };

  // Save report
  const reportsRef = collection(db, 'agencies', agencyId, 'compliance_reports');
  const docRef = await addDoc(reportsRef, {
    type: 'regulatory',
    name: `Regulatory Report - ${period.start.toLocaleDateString()} to ${period.end.toLocaleDateString()}`,
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    },
    status: 'generated',
    data: reportData,
    generatedAt: new Date().toISOString(),
  });

  return {
    id: docRef.id,
    type: 'regulatory',
    name: `Regulatory Report - ${period.start.toLocaleDateString()} to ${period.end.toLocaleDateString()}`,
    period,
    status: 'generated',
    data: reportData,
    generatedAt: new Date(),
  };
}

/**
 * Generate tax report
 */
export async function generateTaxReport(
  agencyId: string,
  period: { start: Date; end: Date }
): Promise<ComplianceReport> {
  // Get all repayments in period
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const loansSnapshot = await getDocs(loansRef);
  const loans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  let totalInterest = 0;
  let totalFees = 0;
  let totalRevenue = 0;

  for (const loan of loans) {
    try {
      const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loan.id, 'repayments');
      const repaymentsSnapshot = await getDocs(repaymentsRef);
      const repayments = repaymentsSnapshot.docs.map(doc => doc.data());

      for (const repayment of repayments) {
        if (repayment.status === 'paid') {
          const paidAt = repayment.paidAt?.toDate?.() || new Date(repayment.paidAt || repayment.createdAt);
          
          if (paidAt >= period.start && paidAt <= period.end) {
            const principal = Number(repayment.principalAmount || 0);
            const interest = Number(repayment.interestAmount || 0);
            const fees = Number(repayment.lateFee || 0) + Number(repayment.otherFees || 0);
            
            totalInterest += interest;
            totalFees += fees;
            totalRevenue += principal + interest + fees;
          }
        }
      }
    } catch (error) {
      // Skip if error
    }
  }

  const reportData = {
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    },
    revenue: {
      totalRevenue,
      interestIncome: totalInterest,
      fees: totalFees,
      taxableIncome: totalInterest + totalFees,
    },
  };

  // Save report
  const reportsRef = collection(db, 'agencies', agencyId, 'compliance_reports');
  const docRef = await addDoc(reportsRef, {
    type: 'tax',
    name: `Tax Report - ${period.start.toLocaleDateString()} to ${period.end.toLocaleDateString()}`,
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    },
    status: 'generated',
    data: reportData,
    generatedAt: new Date().toISOString(),
  });

  return {
    id: docRef.id,
    type: 'tax',
    name: `Tax Report - ${period.start.toLocaleDateString()} to ${period.end.toLocaleDateString()}`,
    period,
    status: 'generated',
    data: reportData,
    generatedAt: new Date(),
  };
}

/**
 * Get compliance reports
 */
export async function getComplianceReports(
  agencyId: string,
  type?: ComplianceReport['type']
): Promise<ComplianceReport[]> {
  const reportsRef = collection(db, 'agencies', agencyId, 'compliance_reports');
  
  let q = query(reportsRef, orderBy('generatedAt', 'desc'));
  if (type) {
    q = query(q, where('type', '==', type));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    period: {
      start: doc.data().period.start?.toDate?.() || new Date(doc.data().period.start),
      end: doc.data().period.end?.toDate?.() || new Date(doc.data().period.end),
    },
    generatedAt: doc.data().generatedAt?.toDate() || new Date(doc.data().generatedAt),
    submittedAt: doc.data().submittedAt?.toDate() || (doc.data().submittedAt ? new Date(doc.data().submittedAt) : undefined),
  })) as ComplianceReport[];
}

// Helper functions

async function calculateTotalCollected(agencyId: string, loans: any[]): Promise<number> {
  let total = 0;

  for (const loan of loans) {
    try {
      const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loan.id, 'repayments');
      const repaymentsSnapshot = await getDocs(repaymentsRef);
      const repayments = repaymentsSnapshot.docs.map(doc => doc.data());

      const paidRepayments = repayments.filter(r => r.status === 'paid');
      const collected = paidRepayments.reduce((sum, r) => sum + Number(r.amountPaid || r.amountDue || 0), 0);
      total += collected;
    } catch (error) {
      // Skip if error
    }
  }

  return total;
}

