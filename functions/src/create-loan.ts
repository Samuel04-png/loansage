/**
 * Create Loan Cloud Function (Idempotent)
 * 
 * Validates and creates loans with idempotency support
 * Enforces loan type configuration and rules
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface CreateLoanRequest {
  agencyId: string;
  customerId: string;
  loanType: string;
  idempotencyKey?: string;
  payload: {
    borrower: any;
    terms: any;
    collateral?: any;
    employment?: any;
    business?: any;
    guarantor?: any;
  };
}

interface CreateLoanResponse {
  success: boolean;
  loanId?: string;
  error?: string;
  errors?: string[];
  isDuplicate?: boolean;
}

/**
 * Find existing loan by idempotency key
 */
async function findByIdempotencyKey(
  agencyId: string,
  idempotencyKey: string
): Promise<admin.firestore.DocumentSnapshot | null> {
  try {
    // Query collection group for loans with matching idempotency key
    const loansRef = db.collectionGroup('loans');
    const snapshot = await loansRef
      .where('agencyId', '==', agencyId)
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return snapshot.docs[0];
    }
    return null;
  } catch (error) {
    console.error('Error finding loan by idempotency key:', error);
    return null;
  }
}

/**
 * Get agency loan configuration
 */
async function getAgencyLoanConfig(agencyId: string): Promise<any | null> {
  try {
    const configRef = db.doc(`agencies/${agencyId}/config/loanTypes`);
    const configSnap = await configRef.get();
    
    if (!configSnap.exists) {
      return null;
    }

    return configSnap.data();
  } catch (error) {
    console.error('Error getting agency loan config:', error);
    return null;
  }
}


/**
 * Validate loan payload against loan type configuration
 */
function validateLoanPayload(payload: any, config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Basic validation
  if (!payload.borrower) {
    errors.push('Borrower information is required');
  }

  if (!payload.terms) {
    errors.push('Loan terms are required');
  }

  if (!config) {
    errors.push('Loan type configuration not found');
    return { valid: false, errors };
  }

  // Validate loan type is enabled
  if (!config.enabled) {
    errors.push(`Loan type ${config.id} is not enabled for this agency`);
  }

  // Validate amount
  if (payload.terms?.amount) {
    if (payload.terms.amount < config.loanAmount?.min) {
      errors.push(`Amount must be at least ${config.loanAmount.min.toLocaleString()}`);
    }
    if (payload.terms.amount > config.loanAmount?.max) {
      errors.push(`Amount cannot exceed ${config.loanAmount.max.toLocaleString()}`);
    }
  }

  // Validate interest rate
  if (payload.terms?.interestRate !== undefined) {
    if (payload.terms.interestRate < config.interestRate?.min) {
      errors.push(`Interest rate must be at least ${config.interestRate.min}%`);
    }
    if (payload.terms.interestRate > config.interestRate?.max) {
      errors.push(`Interest rate cannot exceed ${config.interestRate.max}%`);
    }
  }

  // Validate duration
  if (payload.terms?.durationMonths) {
    if (payload.terms.durationMonths < config.duration?.minMonths) {
      errors.push(`Duration must be at least ${config.duration.minMonths} months`);
    }
    if (payload.terms.durationMonths > config.duration?.maxMonths) {
      errors.push(`Duration cannot exceed ${config.duration.maxMonths} months`);
    }
  }

  // Validate repayment frequency
  if (payload.terms?.repaymentFrequency) {
    if (!config.repaymentFrequency?.includes(payload.terms.repaymentFrequency)) {
      errors.push(`Repayment frequency must be one of: ${config.repaymentFrequency.join(', ')}`);
    }
  }

  // Validate collateral requirement
  if (config.collateralRequirement === 'required' && !payload.collateral) {
    errors.push('Collateral is required for this loan type');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create loan Cloud Function (idempotent)
 */
export const createLoan = functions.https.onCall(
  async (data: CreateLoanRequest, context): Promise<CreateLoanResponse> => {
    // Verify authentication
    if (!context.auth) {
      return {
        success: false,
        error: 'User must be authenticated',
      };
    }

    const { agencyId, customerId, loanType, idempotencyKey, payload } = data;

    try {
      // Check idempotency
      if (idempotencyKey) {
        const existingLoan = await findByIdempotencyKey(agencyId, idempotencyKey);
        if (existingLoan) {
          return {
            success: true,
            loanId: existingLoan.id,
            isDuplicate: true,
          };
        }
      }

      // Verify user belongs to agency
      const userRef = db.doc(`users/${context.auth.uid}`);
      const userSnap = await userRef.get();
      
      if (!userSnap.exists) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      const userData = userSnap.data()!;
      if (userData.agency_id !== agencyId) {
        return {
          success: false,
          error: 'User does not belong to this agency',
        };
      }

      // Verify user is loan officer or admin
      if (userData.role !== 'admin' && userData.role !== 'employee') {
        return {
          success: false,
          error: 'Only loan officers and admins can create loans',
        };
      }

      // Get agency loan configuration
      const agencyConfig = await getAgencyLoanConfig(agencyId);
      if (!agencyConfig) {
        return {
          success: false,
          error: 'Agency loan configuration not found',
        };
      }

      // Get loan type configuration
      const loanTypeConfig = agencyConfig.loanTypes?.[loanType];
      if (!loanTypeConfig) {
        return {
          success: false,
          error: `Loan type ${loanType} not found in agency configuration`,
        };
      }

      // Validate loan payload
      const validation = validateLoanPayload(payload, loanTypeConfig);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      // Create loan in transaction
      const loanId = await db.runTransaction(async (transaction) => {
        // Check idempotency again within transaction
        if (idempotencyKey) {
          const existingLoan = await findByIdempotencyKey(agencyId, idempotencyKey);
          if (existingLoan) {
            throw new Error('DUPLICATE');
          }
        }

        // Verify customer exists
        const customerRef = db.doc(`agencies/${agencyId}/customers/${customerId}`);
        const customerSnap = await transaction.get(customerRef);
        
        if (!customerSnap.exists) {
          throw new Error('Customer not found');
        }

        // Generate loan ID
        const newLoanId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const loanRef = db.doc(`agencies/${agencyId}/loans/${newLoanId}`);

        // Build normalized loan document
        const loanData: any = {
          id: newLoanId,
          agencyId,
          customerId,
          loanType,
          category: loanTypeConfig.category,
          borrower: payload.borrower,
          terms: payload.terms,
          status: 'draft',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: context.auth?.uid || '',
        };

        // Add optional sections (null if not provided)
        loanData.collateral = payload.collateral || null;
        loanData.employment = payload.employment || null;
        loanData.business = payload.business || null;
        loanData.guarantor = payload.guarantor || null;

        // Add idempotency key if provided
        if (idempotencyKey) {
          loanData.idempotencyKey = idempotencyKey;
        }

        // Create loan document
        transaction.set(loanRef, loanData);

        return newLoanId;
      });

      return {
        success: true,
        loanId,
      };
    } catch (error: any) {
      console.error('Error creating loan:', error);
      
      if (error.message === 'DUPLICATE') {
        // This shouldn't happen due to transaction, but handle gracefully
        return {
          success: false,
          error: 'Duplicate loan detected',
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to create loan',
      };
    }
  }
);

