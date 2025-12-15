/**
 * PDF Generation for Loan Schedules and Comprehensive Loan Summary Reports
 * Uses jsPDF library (needs to be installed: npm install jspdf)
 */

interface AmortizationRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

interface LoanData {
  loanId: string;
  customerName: string;
  amount: number;
  interestRate: number;
  durationMonths: number;
  disbursementDate: Date;
  schedule: AmortizationRow[];
}

export async function generateLoanSchedulePDF(loanData: LoanData): Promise<Blob> {
  // Dynamic import to avoid bundle size issues if library not installed
  try {
    const jsPDFModule = await import('jspdf');
    // Handle both default and named exports
    const jsPDF = (jsPDFModule.default || jsPDFModule.jsPDF || jsPDFModule) as any;
    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.text('Loan Repayment Schedule', 105, 20, { align: 'center' });

    // Loan Details
    doc.setFontSize(12);
    let yPos = 35;
    doc.text(`Loan ID: ${loanData.loanId}`, 20, yPos);
    yPos += 7;
    doc.text(`Customer: ${loanData.customerName}`, 20, yPos);
    yPos += 7;
    doc.text(`Loan Amount: ${loanData.amount.toLocaleString()} ZMW`, 20, yPos);
    yPos += 7;
    doc.text(`Interest Rate: ${loanData.interestRate}% per annum`, 20, yPos);
    yPos += 7;
    doc.text(`Duration: ${loanData.durationMonths} months`, 20, yPos);
    yPos += 7;
    doc.text(`Disbursement Date: ${loanData.disbursementDate.toLocaleDateString()}`, 20, yPos);
    yPos += 10;

    // Table Header
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    const tableHeaders = ['Month', 'Payment', 'Principal', 'Interest', 'Balance'];
    const colWidths = [20, 40, 40, 40, 40];
    let xPos = 20;

    tableHeaders.forEach((header, index) => {
      doc.text(header, xPos, yPos);
      xPos += colWidths[index];
    });

    yPos += 7;
    doc.setFont(undefined, 'normal');

    // Table Rows
    loanData.schedule.forEach((row) => {
      if (yPos > 270) {
        // New page if needed
        doc.addPage();
        yPos = 20;
        // Redraw headers
        xPos = 20;
        doc.setFont(undefined, 'bold');
        tableHeaders.forEach((header, index) => {
          doc.text(header, xPos, yPos);
          xPos += colWidths[index];
        });
        yPos += 7;
        doc.setFont(undefined, 'normal');
      }

      xPos = 20;
      doc.text(row.month.toString(), xPos, yPos);
      xPos += colWidths[0];
      doc.text(row.payment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), xPos, yPos);
      xPos += colWidths[1];
      doc.text(row.principal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), xPos, yPos);
      xPos += colWidths[2];
      doc.text(row.interest.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), xPos, yPos);
      xPos += colWidths[3];
      doc.text(row.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), xPos, yPos);
      yPos += 7;
    });

    // Summary
    yPos += 5;
    doc.setFont(undefined, 'bold');
    doc.text('Summary:', 20, yPos);
    yPos += 7;
    doc.setFont(undefined, 'normal');
    
    const totalPayment = loanData.schedule.reduce((sum, row) => sum + row.payment, 0);
    const totalInterest = loanData.schedule.reduce((sum, row) => sum + row.interest, 0);
    
    doc.text(`Total Payment: ${totalPayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ZMW`, 20, yPos);
    yPos += 7;
    doc.text(`Total Interest: ${totalInterest.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ZMW`, 20, yPos);
    yPos += 7;
    doc.text(`Monthly Payment: ${loanData.schedule[0]?.payment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} ZMW`, 20, yPos);

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Page ${i} of ${pageCount} • Generated on ${new Date().toLocaleDateString()}`,
        105,
        285,
        { align: 'center' }
      );
    }

    return doc.output('blob');
  } catch (error) {
    // Fallback if jsPDF is not installed
    console.warn('jsPDF not available, using fallback');
    throw new Error('PDF generation requires jsPDF library. Install it with: npm install jspdf');
  }
}

export async function downloadLoanSchedulePDF(loanData: LoanData, filename?: string) {
  try {
    const blob = await generateLoanSchedulePDF(loanData);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `loan-schedule-${loanData.loanId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error('Failed to generate PDF:', error);
    throw error;
  }
}

/**
 * Comprehensive Loan Summary PDF Data Interface
 */
export interface LoanSummaryPDFData {
  // Borrower Profile
  borrower: {
    name: string;
    nrc: string;
    phone: string;
    email?: string;
    age?: number;
    employment: string;
    profileStrength: 'weak' | 'developing' | 'stable' | 'strong' | 'very_strong';
  };
  
  // Loan Details
  loan: {
    id: string;
    amount: number;
    interestRate: number;
    durationMonths: number;
    loanType: string;
    purpose?: string;
    disbursementDate: Date;
  };
  
  // Risk Analysis
  riskAnalysis: {
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskExplanation: string;
    keyFlags: string[];
    repaymentProbability: number;
    defaultProbability: number;
  };
  
  // Collateral
  collateral?: {
    type: string;
    estimatedMarketValue: number;
    quickSaleValue: number;
    auctionPrice: number;
    ltvRatio: number;
    riskAssessment: string;
  };
  
  // Profit Projection
  profitProjection: {
    normalProfit: number;
    normalMargin: number;
    lateProfit: number;
    defaultLoss: number;
    recoveryRate: number;
  };
  
  // Recommendation
  recommendation: {
    decision: 'approve' | 'approve_with_conditions' | 'review' | 'reject';
    conditions?: string[];
    reasoning: string;
    confidence: number;
  };
  
  // Executive Summary
  executiveSummary: string;
  
  // Repayment Schedule
  schedule?: AmortizationRow[];
}

/**
 * Generate comprehensive loan summary PDF report
 */
export async function generateLoanSummaryPDF(data: LoanSummaryPDFData): Promise<Blob> {
  try {
    const jsPDFModule = await import('jspdf');
    const jsPDF = (jsPDFModule.default || jsPDFModule.jsPDF || jsPDFModule) as any;
    const doc = new jsPDF();
    
    let yPos = 20;
    
    // Header
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('LOAN ASSESSMENT REPORT', 105, yPos, { align: 'center' });
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Report ID: ${data.loan.id}`, 105, yPos, { align: 'center' });
    yPos += 5;
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, yPos, { align: 'center' });
    yPos += 15;
    
    // Executive Summary
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('EXECUTIVE SUMMARY', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const summaryLines = doc.splitTextToSize(data.executiveSummary, 170);
    doc.text(summaryLines, 20, yPos);
    yPos += summaryLines.length * 5 + 10;
    
    // Check if new page needed
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    // Borrower Profile Section
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('BORROWER PROFILE', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    doc.text(`Name: ${data.borrower.name}`, 20, yPos);
    yPos += 6;
    doc.text(`NRC: ${data.borrower.nrc}`, 20, yPos);
    yPos += 6;
    doc.text(`Contact: ${data.borrower.phone}${data.borrower.email ? ` | ${data.borrower.email}` : ''}`, 20, yPos);
    yPos += 6;
    if (data.borrower.age) {
      doc.text(`Age: ${data.borrower.age} years`, 20, yPos);
      yPos += 6;
    }
    doc.text(`Employment: ${data.borrower.employment}`, 20, yPos);
    yPos += 6;
    doc.text(`Profile Strength: ${data.borrower.profileStrength.toUpperCase().replace('_', ' ')}`, 20, yPos);
    yPos += 12;
    
    // Loan Details Section
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('LOAN DETAILS', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    doc.text(`Loan ID: ${data.loan.id}`, 20, yPos);
    yPos += 6;
    doc.text(`Amount: ${data.loan.amount.toLocaleString()} ZMW`, 20, yPos);
    yPos += 6;
    doc.text(`Interest Rate: ${data.loan.interestRate}% per annum`, 20, yPos);
    yPos += 6;
    doc.text(`Duration: ${data.loan.durationMonths} months`, 20, yPos);
    yPos += 6;
    doc.text(`Loan Type: ${data.loan.loanType}`, 20, yPos);
    yPos += 6;
    if (data.loan.purpose) {
      doc.text(`Purpose: ${data.loan.purpose}`, 20, yPos);
      yPos += 6;
    }
    doc.text(`Disbursement Date: ${data.loan.disbursementDate.toLocaleDateString()}`, 20, yPos);
    yPos += 12;
    
    // Risk Analysis Section
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('RISK ANALYSIS', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    doc.text(`Risk Score: ${data.riskAnalysis.riskScore}/100`, 20, yPos);
    yPos += 6;
    doc.text(`Risk Level: ${data.riskAnalysis.riskLevel.toUpperCase()}`, 20, yPos);
    yPos += 6;
    doc.text(`Repayment Probability: ${(data.riskAnalysis.repaymentProbability * 100).toFixed(1)}%`, 20, yPos);
    yPos += 6;
    doc.text(`Default Probability: ${(data.riskAnalysis.defaultProbability * 100).toFixed(1)}%`, 20, yPos);
    yPos += 6;
    doc.text(`Risk Explanation:`, 20, yPos);
    yPos += 6;
    const riskLines = doc.splitTextToSize(data.riskAnalysis.riskExplanation, 170);
    doc.text(riskLines, 25, yPos);
    yPos += riskLines.length * 5 + 6;
    
    if (data.riskAnalysis.keyFlags.length > 0) {
      doc.text(`Key Risk Flags:`, 20, yPos);
      yPos += 6;
      data.riskAnalysis.keyFlags.forEach(flag => {
        doc.text(`• ${flag}`, 25, yPos);
        yPos += 6;
      });
    }
    yPos += 6;
    
    // Collateral Analysis Section
    if (data.collateral) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('COLLATERAL ANALYSIS', 20, yPos);
      yPos += 8;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      
      doc.text(`Type: ${data.collateral.type}`, 20, yPos);
      yPos += 6;
      doc.text(`Estimated Market Value: ${data.collateral.estimatedMarketValue.toLocaleString()} ZMW`, 20, yPos);
      yPos += 6;
      doc.text(`Quick Sale Value: ${data.collateral.quickSaleValue.toLocaleString()} ZMW`, 20, yPos);
      yPos += 6;
      doc.text(`Auction Price: ${data.collateral.auctionPrice.toLocaleString()} ZMW`, 20, yPos);
      yPos += 6;
      doc.text(`Loan-to-Value (LTV) Ratio: ${data.collateral.ltvRatio.toFixed(1)}%`, 20, yPos);
      yPos += 6;
      const collateralLines = doc.splitTextToSize(data.collateral.riskAssessment, 170);
      doc.text(collateralLines, 20, yPos);
      yPos += collateralLines.length * 5 + 12;
    }
    
    // Profit Projection Section
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('PROFIT ESTIMATION', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    doc.text(`Normal Repayment Scenario:`, 20, yPos);
    yPos += 6;
    doc.text(`  Total Profit: ${data.profitProjection.normalProfit.toLocaleString()} ZMW`, 25, yPos);
    yPos += 6;
    doc.text(`  Profit Margin: ${data.profitProjection.normalMargin.toFixed(2)}%`, 25, yPos);
    yPos += 8;
    
    doc.text(`Late Repayment Scenario:`, 20, yPos);
    yPos += 6;
    doc.text(`  Estimated Profit: ${data.profitProjection.lateProfit.toLocaleString()} ZMW`, 25, yPos);
    yPos += 8;
    
    doc.text(`Default Scenario:`, 20, yPos);
    yPos += 6;
    doc.text(`  Estimated Loss: ${data.profitProjection.defaultLoss.toLocaleString()} ZMW`, 25, yPos);
    yPos += 6;
    doc.text(`  Recovery Rate: ${data.profitProjection.recoveryRate.toFixed(1)}%`, 25, yPos);
    yPos += 12;
    
    // Recommendation Section
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('RECOMMENDATION', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    doc.setFont(undefined, 'bold');
    doc.text(`Decision: ${data.recommendation.decision.toUpperCase().replace('_', ' ')}`, 20, yPos);
    yPos += 8;
    doc.setFont(undefined, 'normal');
    
    const reasoningLines = doc.splitTextToSize(data.recommendation.reasoning, 170);
    doc.text(reasoningLines, 20, yPos);
    yPos += reasoningLines.length * 5 + 6;
    
    if (data.recommendation.conditions && data.recommendation.conditions.length > 0) {
      doc.text(`Conditions:`, 20, yPos);
      yPos += 6;
      data.recommendation.conditions.forEach(condition => {
        doc.text(`• ${condition}`, 25, yPos);
        yPos += 6;
      });
    }
    yPos += 6;
    
    doc.text(`Confidence Level: ${(data.recommendation.confidence * 100).toFixed(0)}%`, 20, yPos);
    yPos += 12;
    
    // Repayment Schedule (if provided)
    if (data.schedule && data.schedule.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('REPAYMENT SCHEDULE', 20, yPos);
      yPos += 8;
      
      // Table Header
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      const headers = ['Month', 'Payment', 'Principal', 'Interest', 'Balance'];
      const colWidths = [20, 35, 35, 35, 35];
      let xPos = 20;
      
      headers.forEach((header, index) => {
        doc.text(header, xPos, yPos);
        xPos += colWidths[index];
      });
      
      yPos += 6;
      doc.setFont(undefined, 'normal');
      
      // Table Rows (first 20 rows)
      const rowsToShow = Math.min(20, data.schedule.length);
      for (let i = 0; i < rowsToShow; i++) {
        const row = data.schedule[i];
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        xPos = 20;
        doc.text(row.month.toString(), xPos, yPos);
        xPos += colWidths[0];
        doc.text(row.payment.toFixed(2), xPos, yPos);
        xPos += colWidths[1];
        doc.text(row.principal.toFixed(2), xPos, yPos);
        xPos += colWidths[2];
        doc.text(row.interest.toFixed(2), xPos, yPos);
        xPos += colWidths[3];
        doc.text(row.balance.toFixed(2), xPos, yPos);
        yPos += 5;
      }
      
      if (data.schedule.length > 20) {
        doc.text(`... and ${data.schedule.length - 20} more payments`, 20, yPos);
      }
    }
    
    // Terms and Conditions
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('TERMS AND CONDITIONS', 20, yPos);
    yPos += 8;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    
    const terms = [
      'This loan is subject to the terms and conditions agreed upon at loan origination.',
      'Late payments may incur penalties and late fees as per the loan agreement.',
      'Default on loan repayment may result in collateral seizure and legal action.',
      'Borrower is responsible for maintaining collateral in good condition.',
      'Interest rates are fixed for the duration of the loan term.',
      'Early repayment may be subject to early settlement fees.',
    ];
    
    terms.forEach(term => {
      const termLines = doc.splitTextToSize(term, 170);
      doc.text(termLines, 20, yPos);
      yPos += termLines.length * 4 + 3;
    });
    
    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Page ${i} of ${pageCount} • TengaLoans Loan Management System • Generated ${new Date().toLocaleString()}`,
        105,
        285,
        { align: 'center' }
      );
    }
    
    return doc.output('blob');
  } catch (error) {
    console.warn('jsPDF not available:', error);
    throw new Error('PDF generation requires jsPDF library. Install it with: npm install jspdf');
  }
}

/**
 * Download comprehensive loan summary PDF
 */
export async function downloadLoanSummaryPDF(data: LoanSummaryPDFData, filename?: string) {
  try {
    const blob = await generateLoanSummaryPDF(data);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `loan-summary-${data.loan.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error('Failed to generate loan summary PDF:', error);
    throw error;
  }
}

