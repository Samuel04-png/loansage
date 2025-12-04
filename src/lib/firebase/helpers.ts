import { db } from './config';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

// Helper function to generate employee ID
export async function generateEmployeeId(agencyId: string): Promise<string> {
  try {
    // Get the last employee for this agency
    const employeesRef = collection(db, 'employees');
    const q = query(
      employeesRef,
      where('agency_id', '==', agencyId),
      orderBy('employee_id', 'desc'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return 'EMP-001';
    }
    
    const lastEmployee = snapshot.docs[0].data();
    const lastId = lastEmployee.employee_id || 'EMP-000';
    const lastNumber = parseInt(lastId.split('-')[1] || '0');
    const newNumber = lastNumber + 1;
    
    return `EMP-${newNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    // Fallback if query fails
    return `EMP-${Date.now()}`;
  }
}

// Helper function to generate customer ID
export async function generateCustomerId(agencyId: string): Promise<string> {
  try {
    // Get the last customer for this agency
    const customersRef = collection(db, 'customers');
    const q = query(
      customersRef,
      where('agency_id', '==', agencyId),
      orderBy('customer_id', 'desc'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return 'CUST-001';
    }
    
    const lastCustomer = snapshot.docs[0].data();
    const lastId = lastCustomer.customer_id || 'CUST-000';
    const lastNumber = parseInt(lastId.split('-')[1] || '0');
    const newNumber = lastNumber + 1;
    
    return `CUST-${newNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    // Fallback if query fails
    return `CUST-${Date.now()}`;
  }
}

// Helper function to generate loan number
export async function generateLoanNumber(agencyId: string): Promise<string> {
  try {
    const loansRef = collection(db, 'loans');
    const q = query(
      loansRef,
      where('agency_id', '==', agencyId),
      orderBy('loan_number', 'desc'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      const year = new Date().getFullYear();
      return `LOAN-${year}-001`;
    }
    
    const lastLoan = snapshot.docs[0].data();
    const lastNumber = lastLoan.loan_number || '';
    const parts = lastNumber.split('-');
    
    if (parts.length === 3) {
      const year = parts[1];
      const number = parseInt(parts[2] || '0');
      const newNumber = number + 1;
      return `LOAN-${year}-${newNumber.toString().padStart(3, '0')}`;
    }
    
    // Fallback
    const year = new Date().getFullYear();
    return `LOAN-${year}-001`;
  } catch (error) {
    // Fallback if query fails
    const year = new Date().getFullYear();
    return `LOAN-${year}-${Date.now()}`;
  }
}

