import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config';
import { isDemoMode, isSparkPlan } from './config';

/**
 * Get all agencies that a user has access to
 * Returns agencies where user is a member (via agency_id) or creator
 */
export async function getUserAgencies(userId: string): Promise<Array<{
  id: string;
  name: string;
  memberCount: number;
  isActive: boolean;
  createdBy?: string;
}>> {
  if (isDemoMode) {
    return [
      { id: 'demo-agency-id', name: 'Demo Agency', memberCount: 5, isActive: true },
    ];
  }

  try {
    const agencies: Array<{
      id: string;
      name: string;
      memberCount: number;
      isActive: boolean;
      createdBy?: string;
    }> = [];

    // Get user document to find their current agency_id
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const userAgencyId = userSnap.data()?.agency_id;

    // Get all agencies where user is a member (via employees collection) or creator
    const agenciesRef = collection(db, 'agencies');
    const agenciesSnapshot = await getDocs(agenciesRef);

    for (const agencyDoc of agenciesSnapshot.docs) {
      const agencyData = agencyDoc.data();
      const agencyId = agencyDoc.id;

      // Check if user created this agency (most common case for admins)
      const isCreator = agencyData.createdBy === userId;
      
      // Check if this is the user's current agency
      const isCurrentAgency = agencyId === userAgencyId;
      
      // Check if user is an employee of this agency
      let isMember = false;
      try {
        const employeesRef = collection(db, 'agencies', agencyId, 'employees');
        const employeeQuery = query(employeesRef, where('userId', '==', userId));
        const employeeSnapshot = await getDocs(employeeQuery);
        isMember = !employeeSnapshot.empty;
      } catch (error) {
        // If employees collection doesn't exist or query fails, continue
        console.warn(`Could not check employees for agency ${agencyId}:`, error);
      }

      // Include agency if user is creator OR member OR if it's their current agency
      if (isCreator || isMember || isCurrentAgency) {
        // Get employee count for this agency
        const allEmployeesRef = collection(db, 'agencies', agencyId, 'employees');
        const allEmployeesSnapshot = await getDocs(allEmployeesRef);
        const memberCount = allEmployeesSnapshot.size;

        agencies.push({
          id: agencyId,
          name: agencyData.name || 'Unnamed Agency',
          memberCount,
          isActive: agencyId === userAgencyId,
          createdBy: agencyData.createdBy,
        });
      }
    }

    // Sort: active agency first, then by name
    return agencies.sort((a, b) => {
      if (a.isActive) return -1;
      if (b.isActive) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error('Error fetching user agencies:', error);
    return [];
  }
}

/**
 * Switch user's active agency
 */
export async function switchAgency(userId: string, agencyId: string): Promise<void> {
  if (isDemoMode) {
    return;
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      agency_id: agencyId,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error switching agency:', error);
    throw error;
  }
}
import { trackPendingWrite, removePendingWrite } from './offline-helpers';

/**
 * Firestore structure helpers following the specified schema
 */

// Generate unique IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Agency helpers
export async function createAgency(data: {
  name: string;
  email: string;
  phone: string;
  address: string;
  createdBy: string;
  logoURL?: string;
  settings?: {
    theme?: 'light' | 'dark';
    allowCustomerPortal?: boolean;
    allowCustomerInvite?: boolean;
  };
}) {
  if (isDemoMode) {
    return { id: 'demo-agency-id', ...data };
  }

  const agencyId = generateId();
  const agencyRef = doc(db, 'agencies', agencyId);
  
  await setDoc(agencyRef, {
    ...data,
    id: agencyId,
    logoURL: data.logoURL || null,
    settings: {
      theme: 'light',
      allowCustomerPortal: false,
      allowCustomerInvite: false,
      ...data.settings,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: agencyId, ...data };
}

export async function updateAgency(agencyId: string, updates: any) {
  // Filter out undefined values - Firestore doesn't allow undefined
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, value]) => value !== undefined)
  );
  
  if (Object.keys(cleanUpdates).length === 0) {
    return; // Nothing to update
  }
  if (isDemoMode) return;

  const agencyRef = doc(db, 'agencies', agencyId);
  await updateDoc(agencyRef, {
    ...cleanUpdates,
    updatedAt: serverTimestamp(),
  });
}

// Employee helpers
export async function createEmployeeInvitation(
  agencyId: string,
  data: {
    email: string;
    role: 'loan_officer' | 'manager' | 'collections' | 'underwriter';
    note?: string;
    createdBy: string;
  }
) {
  if (isDemoMode) {
    return { id: 'demo-invite-id', token: 'demo-token', ...data };
  }

  const inviteId = generateId();
  const token = `${Date.now()}-${Math.random().toString(36).substr(2, 16)}`;
  const inviteRef = doc(db, 'agencies', agencyId, 'invitations', inviteId);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  // Add timeout to prevent hanging
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Invitation creation timeout')), 10000)
  );

  await Promise.race([
    setDoc(inviteRef, {
      id: inviteId,
      email: data.email,
      role: data.role,
      note: data.note || null,
      token,
      createdBy: data.createdBy,
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
    }),
    timeoutPromise
  ]);

  return { id: inviteId, token, ...data };
}

export async function getInvitationByToken(token: string) {
  if (isDemoMode) return null;

  // Search across all agencies for the token
  const agenciesRef = collection(db, 'agencies');
  const agenciesSnapshot = await getDocs(agenciesRef);

  for (const agencyDoc of agenciesSnapshot.docs) {
    const invitationsRef = collection(db, 'agencies', agencyDoc.id, 'invitations');
    const q = query(invitationsRef, where('token', '==', token), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const invite = snapshot.docs[0].data();
      return {
        ...invite,
        agencyId: agencyDoc.id,
        id: snapshot.docs[0].id,
      };
    }
  }

  return null;
}

export async function acceptInvitation(agencyId: string, inviteId: string, userId: string) {
  if (isDemoMode) return;

  const inviteRef = doc(db, 'agencies', agencyId, 'invitations', inviteId);
  await updateDoc(inviteRef, {
    status: 'accepted',
    acceptedBy: userId,
    acceptedAt: serverTimestamp(),
  });
}

export async function createEmployee(
  agencyId: string,
  data: {
    userId: string;
    email: string;
    name: string;
    role: 'admin' | 'loan_officer' | 'manager' | 'collections' | 'underwriter';
  }
) {
  if (isDemoMode) {
    return { id: 'demo-employee-id', ...data };
  }

  const employeeId = generateId();
  const employeeRef = doc(db, 'agencies', agencyId, 'employees', employeeId);
  
  await setDoc(employeeRef, {
    id: employeeId,
    ...data,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: employeeId, ...data };
}

// Customer helpers
export async function createCustomer(
  agencyId: string,
  data: {
    fullName: string;
    phone: string;
    email?: string;
    nrc: string;
    address: string;
    employer?: string;
    employmentStatus?: 'employed' | 'self-employed' | 'unemployed' | 'retired' | 'student';
    monthlyIncome?: number;
    jobTitle?: string;
    employmentDuration?: string;
    guarantorName?: string;
    guarantorPhone?: string;
    guarantorNRC?: string;
    guarantorRelationship?: string;
    createdBy: string;
  }
) {
  if (isDemoMode) {
    return { id: 'demo-customer-id', ...data };
  }

  const customerId = generateId();
  const customerRef = doc(db, 'agencies', agencyId, 'customers', customerId);
  
  await setDoc(customerRef, {
    id: customerId,
    ...data,
    email: data.email || null,
    employer: data.employer || null,
    employmentStatus: data.employmentStatus || null,
    monthlyIncome: data.monthlyIncome || null,
    jobTitle: data.jobTitle || null,
    employmentDuration: data.employmentDuration || null,
    guarantorName: data.guarantorName || null,
    guarantorPhone: data.guarantorPhone || null,
    guarantorNRC: data.guarantorNRC || null,
    guarantorRelationship: data.guarantorRelationship || null,
    status: 'active',
    profilePhotoURL: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: customerId, ...data };
}

export async function uploadCustomerDocument(
  agencyId: string,
  customerId: string,
  documentData: {
    type: 'id-front' | 'id-back' | 'selfie' | 'payslip' | 'proof-of-residence';
    fileURL: string;
    uploadedBy: string;
  }
) {
  if (isDemoMode) {
    return { id: 'demo-doc-id', ...documentData };
  }

  const documentId = generateId();
  const docRef = doc(db, 'agencies', agencyId, 'customers', customerId, 'documents', documentId);
  
  await setDoc(docRef, {
    id: documentId,
    ...documentData,
    uploadedAt: serverTimestamp(),
  });

  return { id: documentId, ...documentData };
}

// Loan helpers
export async function createLoan(
  agencyId: string,
  data: {
    customerId: string;
    officerId: string;
    amount: number;
    interestRate: number;
    durationMonths: number;
    loanType: string;
    disbursementDate?: Date;
    collateralIncluded?: boolean;
  }
) {
  if (isDemoMode) {
    return { id: 'demo-loan-id', ...data, status: 'pending' };
  }

  const loanId = generateId();
  const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
  
  await setDoc(loanRef, {
    id: loanId,
    ...data,
    status: 'pending',
    disbursementDate: data.disbursementDate ? Timestamp.fromDate(data.disbursementDate) : null,
    collateralIncluded: data.collateralIncluded || false,
    hasDocuments: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: loanId, ...data, status: 'pending' };
}

export async function uploadLoanDocument(
  agencyId: string,
  loanId: string,
  documentData: {
    type: 'contract' | 'id' | 'collateral' | 'other';
    fileURL: string;
    uploadedBy: string;
  }
) {
  if (isDemoMode) {
    return { id: 'demo-loan-doc-id', ...documentData };
  }

  const documentId = generateId();
  const docRef = doc(db, 'agencies', agencyId, 'loans', loanId, 'documents', documentId);
  
  await setDoc(docRef, {
    id: documentId,
    ...documentData,
    uploadedAt: serverTimestamp(),
  });

  // Update loan hasDocuments flag
  const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
  await updateDoc(loanRef, {
    hasDocuments: true,
    updatedAt: serverTimestamp(),
  });

  return { id: documentId, ...documentData };
}

export async function addCollateral(
  agencyId: string,
  loanId: string,
  data: {
    type: 'vehicle' | 'land' | 'electronics' | 'equipment' | 'other';
    description: string;
    estimatedValue: number;
    photos: string[];
    serialNumber?: string;
    brand?: string;
    model?: string;
    year?: number;
    condition?: 'excellent' | 'good' | 'fair' | 'poor';
    location?: string;
  }
) {
  if (isDemoMode) {
    return { id: 'demo-collateral-id', ...data };
  }

  const collateralId = generateId();
  const collateralRef = doc(db, 'agencies', agencyId, 'loans', loanId, 'collateral', collateralId);
  
  await setDoc(collateralRef, {
    id: collateralId,
    ...data,
    loanId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Also add to top-level collateral registry
  const registryRef = doc(db, 'agencies', agencyId, 'collateral', collateralId);
  await setDoc(registryRef, {
    id: collateralId,
    loanId,
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Update loan collateralIncluded flag
  const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
  await updateDoc(loanRef, {
    collateralIncluded: true,
    updatedAt: serverTimestamp(),
  });

  return { id: collateralId, ...data };
}

/**
 * Create collateral in the registry (standalone, not linked to a loan initially)
 */
export async function createCollateral(
  agencyId: string,
  data: {
    type: 'vehicle' | 'land' | 'electronics' | 'equipment' | 'other';
    description: string;
    estimatedValue: number;
    photos?: string[];
    serialNumber?: string;
    brand?: string;
    model?: string;
    year?: number;
    condition?: 'excellent' | 'good' | 'fair' | 'poor';
    location?: string;
    customerId?: string;
    loanId?: string;
    ownerCustomerId?: string;
  }
) {
  if (isDemoMode) {
    return { id: 'demo-collateral-id', ...data };
  }

  const collateralId = generateId();
  const registryRef = doc(db, 'agencies', agencyId, 'collateral', collateralId);
  
  // Filter out undefined values - Firestore doesn't allow undefined
  const cleanData: any = {
    id: collateralId,
    type: data.type,
    description: data.description,
    estimatedValue: data.estimatedValue,
    photos: data.photos || [],
    status: 'available',
    verificationStatus: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  // Only add optional fields if they have values
  if (data.serialNumber) cleanData.serialNumber = data.serialNumber;
  if (data.brand) cleanData.brand = data.brand;
  if (data.model) cleanData.model = data.model;
  if (data.year) cleanData.year = data.year;
  if (data.condition) cleanData.condition = data.condition;
  if (data.location) cleanData.location = data.location;
  if (data.customerId) cleanData.customerId = data.customerId;
  if (data.loanId) cleanData.loanId = data.loanId;
  if (data.ownerCustomerId) cleanData.ownerCustomerId = data.ownerCustomerId;
  
  await setDoc(registryRef, cleanData);

  // If linked to a loan, also add to loan's collateral subcollection
  if (data.loanId) {
    const loanCollateralRef = doc(db, 'agencies', agencyId, 'loans', data.loanId, 'collateral', collateralId);
    await setDoc(loanCollateralRef, cleanData);
  }

  return { id: collateralId, ...data };
}

// Helper to safely update or create user document
export async function updateUserDocument(
  userId: string,
  updates: Record<string, any>
) {
  if (isDemoMode) return;

  try {
    const userRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userRef);
    
    if (userDocSnap.exists()) {
      // Update existing document
      await updateDoc(userRef, {
        ...updates,
        updated_at: new Date().toISOString(),
      });
    } else {
      // Create new document with all required fields
      await setDoc(userRef, {
        id: userId,
        email: updates.email || '',
        full_name: updates.full_name || null,
        role: updates.role || 'admin',
        employee_category: updates.employee_category || null,
        agency_id: updates.agency_id || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...updates,
      });
    }
  } catch (error: any) {
    // If update fails, try to create with merge
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        id: userId,
        email: updates.email || '',
        full_name: updates.full_name || null,
        role: updates.role || 'admin',
        employee_category: updates.employee_category || null,
        agency_id: updates.agency_id || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...updates,
      }, { merge: true });
    } catch (mergeError) {
      console.error('Failed to update/create user document:', mergeError);
      throw mergeError;
    }
  }
}

// Audit log helper - Non-blocking, won't fail the main operation
export async function createAuditLog(
  agencyId: string,
  data: {
    actorId: string;
    action: string;
    targetCollection: string;
    targetId: string;
    metadata?: any;
  }
) {
  if (isDemoMode) return;

  // Run audit log creation in background, don't block on errors
  Promise.resolve().then(async () => {
    try {
      const logId = generateId();
      const logRef = doc(db, 'agencies', agencyId, 'audit_logs', logId);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Audit log timeout')), 3000)
      );
      
      await Promise.race([
        setDoc(logRef, {
          id: logId,
          ...data,
          createdAt: serverTimestamp(),
        }),
        timeoutPromise
      ]);
    } catch (error) {
      // Silently fail - audit logs are not critical
      console.warn('Failed to create audit log (non-critical):', error);
    }
  }).catch(() => {
    // Ignore errors
  });
}

