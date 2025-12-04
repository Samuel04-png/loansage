/**
 * PDF Generation for Loan Schedules
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

