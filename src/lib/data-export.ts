/**
 * Data Export Utilities
 * Export data to Excel/CSV format
 */

import * as XLSX from 'xlsx';

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
  csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));
  
  // Add data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header] || '';
      // Escape commas, quotes, and newlines
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

/**
 * Download data as CSV
 */
function exportToCSV(data: any[], headers: string[], options: ExportOptions = {}) {
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
 * Download data as Excel
 */
function exportToExcel(data: any[], headers: string[], options: ExportOptions = {}) {
  // Create workbook
  const workbook = XLSX.utils.book_new();
  
  // Convert data to worksheet format
  const worksheetData = [
    headers, // Header row
    ...data.map(row => headers.map(header => row[header] || ''))
  ];
  
  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  
  // Set column widths
  const colWidths = headers.map((_, index) => {
    const maxLength = Math.max(
      headers[index].length,
      ...data.map(row => String(row[headers[index]] || '').length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
  });
  worksheet['!cols'] = colWidths;
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  
  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', options.filename || `export-${Date.now()}.xlsx`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data (CSV or Excel based on format option)
 */
function exportData(data: any[], headers: string[], options: ExportOptions = {}) {
  const format = options.format || 'xlsx'; // Default to Excel
  
  if (format === 'xlsx') {
    exportToExcel(data, headers, options);
  } else {
    exportToCSV(data, headers, options);
  }
}

/**
 * Export loans to Excel/CSV
 */
export function exportLoans(loans: any[], options: ExportOptions = {}) {
  const headers = [
    'Loan ID',
    'Customer Name',
    'Customer ID',
    'Customer Phone',
    'Customer NRC',
    'Amount',
    'Interest Rate (%)',
    'Duration (Months)',
    'Loan Type',
    'Status',
    'Amount Repaid',
    'Amount Owed',
    'Disbursement Date',
    'Created Date',
  ];
  
  const data = loans.map(loan => {
    // Handle Firestore Timestamp
    const formatDate = (date: any) => {
      if (!date) return 'N/A';
      if (date.toDate) return date.toDate().toLocaleDateString();
      if (date instanceof Date) return date.toLocaleDateString();
      return String(date);
    };
    
    return {
      'Loan ID': loan.id || 'N/A',
      'Customer Name': loan.customer?.fullName || loan.customerName || 'N/A',
      'Customer ID': loan.customerId || 'N/A',
      'Customer Phone': loan.customer?.phone || 'N/A',
      'Customer NRC': loan.customer?.nrc || 'N/A',
      'Amount': loan.amount || loan.principal || 0,
      'Interest Rate (%)': loan.interestRate || 0,
      'Duration (Months)': loan.durationMonths || loan.duration || 0,
      'Loan Type': loan.loanType || loan.type || 'N/A',
      'Status': loan.status || 'N/A',
      'Amount Repaid': loan.amountRepaid || loan.totalPaid || 0,
      'Amount Owed': loan.amountOwed || loan.remainingBalance || 0,
      'Disbursement Date': formatDate(loan.disbursementDate || loan.startDate),
      'Created Date': formatDate(loan.createdAt),
    };
  });
  
  exportData(data, headers, { ...options, filename: options.filename || `loans-export-${Date.now()}.${options.format || 'xlsx'}` });
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
    'Employment Status',
    'Monthly Income',
    'Job Title',
    'Created Date',
  ];
  
  const data = customers.map(customer => {
    const formatDate = (date: any) => {
      if (!date) return 'N/A';
      if (date.toDate) return date.toDate().toLocaleDateString();
      if (date instanceof Date) return date.toLocaleDateString();
      return String(date);
    };
    
    return {
      'Customer ID': customer.id || 'N/A',
      'Full Name': customer.fullName || 'N/A',
      'Email': customer.email || 'N/A',
      'Phone': customer.phone || 'N/A',
      'NRC/ID': customer.nrc || customer.nrcNumber || 'N/A',
      'Address': customer.address || 'N/A',
      'Employer': customer.employer || 'N/A',
      'Employment Status': customer.employmentStatus || 'N/A',
      'Monthly Income': customer.monthlyIncome || 0,
      'Job Title': customer.jobTitle || 'N/A',
      'Created Date': formatDate(customer.createdAt),
    };
  });
  
  exportData(data, headers, { ...options, filename: options.filename || `customers-export-${Date.now()}.${options.format || 'xlsx'}` });
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
  
  const data = employees.map(emp => {
    const formatDate = (date: any) => {
      if (!date) return 'N/A';
      if (date.toDate) return date.toDate().toLocaleDateString();
      if (date instanceof Date) return date.toLocaleDateString();
      return String(date);
    };
    
    return {
      'Employee ID': emp.id || 'N/A',
      'Name': emp.name || 'N/A',
      'Email': emp.email || 'N/A',
      'Role': emp.role || 'N/A',
      'Status': emp.status || 'N/A',
      'User ID': emp.userId || 'N/A',
      'Created Date': formatDate(emp.createdAt),
    };
  });
  
  exportData(data, headers, { ...options, filename: options.filename || `employees-export-${Date.now()}.${options.format || 'xlsx'}` });
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
    'Payment Method',
    'Notes',
  ];
  
  const data = repayments.map(repayment => {
    const formatDate = (date: any) => {
      if (!date) return 'N/A';
      if (date.toDate) return date.toDate().toLocaleDateString();
      if (date instanceof Date) return date.toLocaleDateString();
      return String(date);
    };
    
    return {
      'Repayment ID': repayment.id || 'N/A',
      'Loan ID': repayment.loanId || 'N/A',
      'Due Date': formatDate(repayment.dueDate),
      'Amount Due': repayment.amountDue || 0,
      'Amount Paid': repayment.amountPaid || 0,
      'Status': repayment.status || 'N/A',
      'Paid Date': formatDate(repayment.paidAt || repayment.recordedAt),
      'Payment Method': repayment.paymentMethod || 'N/A',
      'Notes': repayment.notes || 'N/A',
    };
  });
  
  exportData(data, headers, { ...options, filename: options.filename || `repayments-export-${Date.now()}.${options.format || 'xlsx'}` });
}
