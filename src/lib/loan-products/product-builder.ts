/**
 * Loan Product Builder
 * Allows creating custom loan products with different terms and conditions
 */

import { collection, addDoc, doc, updateDoc, getDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { LoanProduct } from '../../types/features';

/**
 * Create a new loan product
 */
export async function createLoanProduct(
  agencyId: string,
  productData: Omit<LoanProduct, 'id' | 'createdAt' | 'updatedAt'>
): Promise<LoanProduct> {
  const productsRef = collection(db, 'agencies', agencyId, 'loan_products');
  
  const product: Omit<LoanProduct, 'id'> = {
    ...productData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const docRef = await addDoc(productsRef, {
    ...product,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  });

  return {
    id: docRef.id,
    ...product,
  };
}

/**
 * Update a loan product
 */
export async function updateLoanProduct(
  agencyId: string,
  productId: string,
  updates: Partial<LoanProduct>
): Promise<void> {
  const productRef = doc(db, 'agencies', agencyId, 'loan_products', productId);
  
  await updateDoc(productRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Get all loan products for an agency
 */
export async function getLoanProducts(agencyId: string): Promise<LoanProduct[]> {
  const productsRef = collection(db, 'agencies', agencyId, 'loan_products');
  const snapshot = await getDocs(productsRef);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(doc.data().createdAt),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(doc.data().updatedAt),
  })) as LoanProduct[];
}

/**
 * Get active loan products
 */
export async function getActiveLoanProducts(agencyId: string): Promise<LoanProduct[]> {
  const products = await getLoanProducts(agencyId);
  return products.filter(p => p.isActive);
}

/**
 * Get a single loan product
 */
export async function getLoanProduct(
  agencyId: string,
  productId: string
): Promise<LoanProduct | null> {
  const productRef = doc(db, 'agencies', agencyId, 'loan_products', productId);
  const snapshot = await getDoc(productRef);
  
  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
    createdAt: snapshot.data().createdAt?.toDate() || new Date(snapshot.data().createdAt),
    updatedAt: snapshot.data().updatedAt?.toDate() || new Date(snapshot.data().updatedAt),
  } as LoanProduct;
}

/**
 * Delete a loan product
 */
export async function deleteLoanProduct(agencyId: string, productId: string): Promise<void> {
  const productRef = doc(db, 'agencies', agencyId, 'loan_products', productId);
  await deleteDoc(productRef);
}

/**
 * Create default loan products
 */
export async function createDefaultLoanProducts(agencyId: string): Promise<void> {
  const defaultProducts: Omit<LoanProduct, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      name: 'Quick Loan',
      description: 'Short-term loan for urgent needs',
      interestRate: 20,
      minAmount: 1000,
      maxAmount: 50000,
      minDuration: 1,
      maxDuration: 3,
      gracePeriodDays: 3,
      lateFeeRate: 5,
      maxLateFeeRate: 20,
      interestCalculationMethod: 'simple',
      requiresCollateral: false,
      collateralTypes: [],
      eligibilityCriteria: {
        minCreditScore: 500,
      },
      isActive: true,
    },
    {
      name: 'Business Loan',
      description: 'Medium-term loan for business expansion',
      interestRate: 18,
      minAmount: 50000,
      maxAmount: 500000,
      minDuration: 6,
      maxDuration: 24,
      gracePeriodDays: 7,
      lateFeeRate: 4,
      maxLateFeeRate: 15,
      interestCalculationMethod: 'compound',
      requiresCollateral: true,
      collateralTypes: ['property', 'vehicle', 'equipment'],
      eligibilityCriteria: {
        minCreditScore: 600,
        minIncome: 10000,
        maxDebtToIncome: 0.4,
      },
      isActive: true,
    },
    {
      name: 'Personal Loan',
      description: 'Flexible personal loan with competitive rates',
      interestRate: 15,
      minAmount: 10000,
      maxAmount: 200000,
      minDuration: 3,
      maxDuration: 12,
      gracePeriodDays: 5,
      lateFeeRate: 3,
      maxLateFeeRate: 12,
      interestCalculationMethod: 'simple',
      requiresCollateral: false,
      collateralTypes: [],
      eligibilityCriteria: {
        minCreditScore: 550,
      },
      isActive: true,
    },
  ];

  for (const product of defaultProducts) {
    await createLoanProduct(agencyId, product);
  }
}

