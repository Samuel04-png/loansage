/**
 * Data Export Utilities
 * Export data to Excel/CSV format
 */

interface ExportOptions {
  filename?: string;
  format?: 'csv' | 'xlsx';
}

/**
 * Convert data to CSV format
 */
function convertToCSV(data: any[], headers: string[]): string {
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(','));
  
  // Add data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header] || '';
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

/**
 * Download data as CSV
 */
export function exportToCSV(data: any[], headers: string[], options: ExportOptions = {}) {
  const csv = convertToCSV(data, headers);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', options.filename || `export-${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export loans to Excel/CSV
 */
export function exportLoans(loans: any[], options: ExportOptions = {}) {
  const headers = [
    'Loan ID',
    'Customer Name',
    'Customer ID',
    'Amount',
    'Interest Rate',
    'Duration (Months)',
    'Loan Type',
    'Status',
    'Disbursement Date',
    'Created Date',
  ];
  
  const data = loans.map(loan => ({
    'Loan ID': loan.id,
    'Customer Name': loan.customer?.fullName || 'N/A',
    'Customer ID': loan.customerId || 'N/A',
    'Amount': loan.amount || 0,
    'Interest Rate': loan.interestRate || 0,
    'Duration (Months)': loan.durationMonths || 0,
    'Loan Type': loan.loanType || 'N/A',
    'Status': loan.status || 'N/A',
    'Disbursement Date': loan.disbursementDate?.toDate?.()?.toLocaleDateString() || loan.disbursementDate || 'N/A',
    'Created Date': loan.createdAt?.toDate?.()?.toLocaleDateString() || loan.createdAt || 'N/A',
  }));
  
  exportToCSV(data, headers, { ...options, filename: options.filename || `loans-export-${Date.now()}.csv` });
}

/**
 * Export customers to Excel/CSV
 */
export function exportCustomers(customers: any[], options: ExportOptions = {}) {
  const headers = [
    'Customer ID',
    'Full Name',
    'Email',
    'Phone',
    'NRC/ID',
    'Address',
    'Employer',
    'Created Date',
  ];
  
  const data = customers.map(customer => ({
    'Customer ID': customer.id,
    'Full Name': customer.fullName || 'N/A',
    'Email': customer.email || 'N/A',
    'Phone': customer.phone || 'N/A',
    'NRC/ID': customer.nrc || 'N/A',
    'Address': customer.address || 'N/A',
    'Employer': customer.employer || 'N/A',
    'Created Date': customer.createdAt?.toDate?.()?.toLocaleDateString() || customer.createdAt || 'N/A',
  }));
  
  exportToCSV(data, headers, { ...options, filename: options.filename || `customers-export-${Date.now()}.csv` });
}

/**
 * Export employees to Excel/CSV
 */
export function exportEmployees(employees: any[], options: ExportOptions = {}) {
  const headers = [
    'Employee ID',
    'Name',
    'Email',
    'Role',
    'Status',
    'User ID',
    'Created Date',
  ];
  
  const data = employees.map(emp => ({
    'Employee ID': emp.id,
    'Name': emp.name || 'N/A',
    'Email': emp.email || 'N/A',
    'Role': emp.role || 'N/A',
    'Status': emp.status || 'N/A',
    'User ID': emp.userId || 'N/A',
    'Created Date': emp.createdAt?.toDate?.()?.toLocaleDateString() || emp.createdAt || 'N/A',
  }));
  
  exportToCSV(data, headers, { ...options, filename: options.filename || `employees-export-${Date.now()}.csv` });
}

/**
 * Export repayments to Excel/CSV
 */
export function exportRepayments(repayments: any[], options: ExportOptions = {}) {
  const headers = [
    'Repayment ID',
    'Loan ID',
    'Due Date',
    'Amount Due',
    'Amount Paid',
    'Status',
    'Paid Date',
  ];
  
  const data = repayments.map(repayment => ({
    'Repayment ID': repayment.id,
    'Loan ID': repayment.loanId || 'N/A',
    'Due Date': repayment.dueDate?.toDate?.()?.toLocaleDateString() || repayment.dueDate || 'N/A',
    'Amount Due': repayment.amountDue || 0,
    'Amount Paid': repayment.amountPaid || 0,
    'Status': repayment.status || 'N/A',
    'Paid Date': repayment.paidAt?.toDate?.()?.toLocaleDateString() || repayment.paidAt || 'N/A',
  }));
  
  exportToCSV(data, headers, { ...options, filename: options.filename || `repayments-export-${Date.now()}.csv` });
}

