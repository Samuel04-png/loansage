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
import { isDemoMode } from './config';
import { initializeFreeTrial } from './subscription-helpers';

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
    const agencyIds = new Set<string>();

    // Get user document to find their current agency_id (with error handling)
    let userAgencyId: string | undefined;
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      userAgencyId = userSnap.data()?.agency_id;
      if (userAgencyId) {
        agencyIds.add(userAgencyId);
      }
    } catch (userError) {
      console.warn('Could not fetch user document for getUserAgencies:', userError);
    }

    // Query 1: Get agencies where user is the creator
    // Note: This requires a Firestore index on agencies.createdBy
    try {
      const agenciesRef = collection(db, 'agencies');
      const creatorQuery = query(agenciesRef, where('createdBy', '==', userId));
      const creatorSnapshot = await getDocs(creatorQuery);
      creatorSnapshot.docs.forEach(doc => {
        agencyIds.add(doc.id);
      });
    } catch (error: any) {
      // If index is missing, we'll skip this query and rely on other methods
      if (error.code === 'failed-precondition') {
        console.warn('Firestore index missing for agencies.createdBy. Please create the index or the query will be skipped.');
      } else {
        console.warn('Could not query agencies by creator:', error);
      }
    }

    // Query 2: Find agencies where user is an employee
    // We need to query all agencies and check employees subcollection
    // But we'll use a more targeted approach - get the user's current agency first
    if (userAgencyId) {
      try {
        const employeesRef = collection(db, 'agencies', userAgencyId, 'employees');
        const employeeQuery = query(employeesRef, where('userId', '==', userId));
        const employeeSnapshot = await getDocs(employeeQuery);
        if (!employeeSnapshot.empty) {
          agencyIds.add(userAgencyId);
        }
      } catch (error) {
        console.warn(`Could not check employees for agency ${userAgencyId}:`, error);
      }
    }

    // If no agencies found yet, but user has an agency_id, try to get that agency directly
    if (agencyIds.size === 0 && userAgencyId) {
      agencyIds.add(userAgencyId);
    }

    // Now fetch details for each agency the user has access to
    for (const agencyId of agencyIds) {
      try {
        const agencyRef = doc(db, 'agencies', agencyId);
        const agencySnap = await getDoc(agencyRef);
        
        if (agencySnap.exists()) {
          const agencyData = agencySnap.data();
          
          // Get employee count for this agency
          let memberCount = 0;
          try {
            const allEmployeesRef = collection(db, 'agencies', agencyId, 'employees');
            const allEmployeesSnapshot = await getDocs(allEmployeesRef);
            memberCount = allEmployeesSnapshot.size;
          } catch (error) {
            // If we can't get employees, continue with 0 count
            console.debug(`Could not get employee count for agency ${agencyId} (non-critical):`, error);
          }

          agencies.push({
            id: agencyId,
            name: agencyData.name || 'Unnamed Agency',
            memberCount,
            isActive: agencyId === userAgencyId,
            createdBy: agencyData.createdBy,
          });
        }
      } catch (error: any) {
        // If permission denied, log but continue
        if (error.code === 'permission-denied') {
          console.warn(`Permission denied for agency ${agencyId}. User may not have access.`);
        } else {
          console.warn(`Could not fetch agency ${agencyId}:`, error);
        }
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
  
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 30); // 30 days free trial

  await setDoc(agencyRef, {
    ...data,
    id: agencyId,
    name: data.name, // Ensure name is explicitly set
    logoURL: data.logoURL || null,
    logo_url: data.logoURL || null, // Also set logo_url for compatibility
    planType: 'free',
    subscriptionStatus: 'trialing',
    trialStartDate: serverTimestamp(),
    trialEndDate: Timestamp.fromDate(trialEnd),
    settings: {
      theme: 'light',
      allowCustomerPortal: false,
      allowCustomerInvite: false,
      aiEnabled: true, // Enable AI by default
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

  // Generate invite URL - use environment variable or current origin
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin
    : (process.env.VITE_APP_URL || 'https://tengaloans.com');
  const inviteUrl = `${baseUrl}/auth/accept-invite?token=${token}`;

  await Promise.race([
    setDoc(inviteRef, {
      id: inviteId,
      email: data.email,
      role: data.role,
      note: data.note || null,
      token,
      inviteUrl, // Store invite URL for easy retrieval
      createdBy: data.createdBy,
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
    }),
    timeoutPromise
  ]);

  return { id: inviteId, token, inviteUrl, ...data };
}

// Customer invitation helper
export async function createCustomerInvitation(
  agencyId: string,
  customerId: string,
  data: {
    email: string;
    note?: string;
    createdBy: string;
  }
) {
  if (isDemoMode) {
    return { id: 'demo-invite-id', token: 'demo-token', inviteUrl: 'demo-url', ...data };
  }

  const inviteId = generateId();
  const token = `${Date.now()}-${Math.random().toString(36).substr(2, 16)}`;
  const inviteRef = doc(db, 'agencies', agencyId, 'invitations', inviteId);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  // Generate invite URL - use environment variable or current origin
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin
    : (process.env.VITE_APP_URL || 'https://tengaloans.com');
  const inviteUrl = `${baseUrl}/auth/accept-invite?token=${token}`;

  // Add timeout to prevent hanging
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Invitation creation timeout')), 10000)
  );

  await Promise.race([
    setDoc(inviteRef, {
      id: inviteId,
      email: data.email,
      role: 'customer',
      customerId: customerId,
      note: data.note || null,
      token,
      inviteUrl, // Store invite URL for easy retrieval
      createdBy: data.createdBy,
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
    }),
    timeoutPromise
  ]);

  return { id: inviteId, token, inviteUrl, ...data };
}

export async function getInvitationByToken(token: string) {
  if (isDemoMode) return null;

  try {
    // Search across all agencies for the token
    // Note: This requires Firestore rules to allow reading pending invitations
    const agenciesRef = collection(db, 'agencies');
    const agenciesSnapshot = await getDocs(agenciesRef);

    for (const agencyDoc of agenciesSnapshot.docs) {
      try {
        const invitationsRef = collection(db, 'agencies', agencyDoc.id, 'invitations');
        const q = query(invitationsRef, where('token', '==', token), where('status', '==', 'pending'));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const invite = snapshot.docs[0].data();
          let expiresAt: Date | null = null;
          
          // Handle different date formats
          if (invite.expiresAt?.toDate) {
            expiresAt = invite.expiresAt.toDate();
          } else if (invite.expiresAt instanceof Date) {
            expiresAt = invite.expiresAt;
          } else if (invite.expiresAt) {
            expiresAt = new Date(invite.expiresAt);
          }
          
          // Check if expired
          if (expiresAt && expiresAt < new Date()) {
            continue; // Skip expired invitations
          }

          return {
            ...invite,
            agencyId: agencyDoc.id,
            id: snapshot.docs[0].id,
            expiresAt: expiresAt,
          };
        }
      } catch (error: any) {
        // Continue searching other agencies if this one fails
        // Only log if it's not a permission error (which is expected for some agencies)
        if (!error.message?.includes('permission') && error.code !== 'permission-denied') {
          console.warn(`Failed to search invitations in agency ${agencyDoc.id}:`, error);
        }
        continue;
      }
    }

    return null;
  } catch (error: any) {
    console.error('Error fetching invitation by token:', error);
    throw new Error('Failed to fetch invitation. Please check the invitation link.');
  }
}

export async function acceptInvitation(agencyId: string, inviteId: string, userId: string) {
  if (isDemoMode) return;

  try {
    const inviteRef = doc(db, 'agencies', agencyId, 'invitations', inviteId);
    await updateDoc(inviteRef, {
      status: 'accepted',
      acceptedBy: userId,
      acceptedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    throw new Error(`Failed to accept invitation: ${error.message}`);
  }
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
  // Validation: Ensure required employee fields are present
  if (!data.userId || !data.email || !data.name || !data.role) {
    throw new Error('Missing required employee fields: userId, email, name, and role are required');
  }

  // Validation: Ensure role is a valid employee role (not customer)
  const validEmployeeRoles = ['admin', 'loan_officer', 'manager', 'collections', 'underwriter'];
  if (!validEmployeeRoles.includes(data.role)) {
    throw new Error(`Invalid employee role: ${data.role}. Must be one of: ${validEmployeeRoles.join(', ')}`);
  }

  if (isDemoMode) {
    return { id: 'demo-employee-id', ...data };
  }

  const employeeId = generateId();
  // Explicitly use 'employees' subcollection to avoid any confusion
  const employeeRef = doc(db, 'agencies', agencyId, 'employees', employeeId);
  
  await setDoc(employeeRef, {
    id: employeeId,
    userId: data.userId,
    email: data.email,
    name: data.name,
    role: data.role,
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
    lastEmploymentDate?: string;
    unemploymentReason?: string;
    guarantorName?: string;
    guarantorPhone?: string;
    guarantorNRC?: string;
    guarantorRelationship?: string;
    createdBy: string;
  }
) {
  // Validation: Ensure required customer fields are present
  if (!data.fullName || !data.phone || !data.nrc || !data.address || !data.createdBy) {
    throw new Error('Missing required customer fields: fullName, phone, nrc, address, and createdBy are required');
  }

  // Validation: Ensure employee-specific fields are not present (userId, role)
  if ((data as any).userId) {
    throw new Error('Customer cannot have userId field. Use createEmployee instead.');
  }
  if ((data as any).role) {
    throw new Error('Customer cannot have role field. Use createEmployee instead.');
  }

  if (isDemoMode) {
    return { id: 'demo-customer-id', ...data };
  }

  const customerId = generateId();
  // Explicitly use 'customers' subcollection to avoid any confusion
  const customerRef = doc(db, 'agencies', agencyId, 'customers', customerId);
  
  await setDoc(customerRef, {
    id: customerId,
    fullName: data.fullName,
    phone: data.phone,
    email: data.email || null,
    nrc: data.nrc,
    address: data.address,
    employer: data.employer || null,
    employmentStatus: data.employmentStatus || null,
    monthlyIncome: data.monthlyIncome || null,
    jobTitle: data.jobTitle || null,
    employmentDuration: data.employmentDuration || null,
    lastEmploymentDate: data.lastEmploymentDate || null,
    unemploymentReason: data.unemploymentReason || null,
    guarantorName: data.guarantorName || null,
    guarantorPhone: data.guarantorPhone || null,
    guarantorNRC: data.guarantorNRC || null,
    guarantorRelationship: data.guarantorRelationship || null,
    createdBy: data.createdBy,
    status: 'active',
    profilePhotoURL: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: customerId, ...data };
}

/**
 * Update customer information
 */
export async function updateCustomer(
  agencyId: string,
  customerId: string,
  data: {
    fullName?: string;
    phone?: string;
    email?: string;
    nrc?: string;
    address?: string;
    employer?: string;
    employmentStatus?: 'employed' | 'self-employed' | 'unemployed' | 'retired' | 'student';
    monthlyIncome?: number;
    jobTitle?: string;
    employmentDuration?: string;
    lastEmploymentDate?: string;
    unemploymentReason?: string;
    guarantorName?: string;
    guarantorPhone?: string;
    guarantorNRC?: string;
    guarantorRelationship?: string;
    profilePhotoURL?: string;
  }
) {
  if (isDemoMode) {
    return { id: customerId, ...data };
  }

  const customerRef = doc(db, 'agencies', agencyId, 'customers', customerId);
  
  const updateData: any = {
    updatedAt: serverTimestamp(),
  };

  // Only include fields that are provided
  if (data.fullName !== undefined) updateData.fullName = data.fullName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email || null;
  if (data.nrc !== undefined) updateData.nrc = data.nrc;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.employer !== undefined) updateData.employer = data.employer || null;
  if (data.employmentStatus !== undefined) updateData.employmentStatus = data.employmentStatus || null;
  if (data.monthlyIncome !== undefined) updateData.monthlyIncome = data.monthlyIncome || null;
  if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle || null;
  if (data.employmentDuration !== undefined) updateData.employmentDuration = data.employmentDuration || null;
  if (data.lastEmploymentDate !== undefined) updateData.lastEmploymentDate = data.lastEmploymentDate || null;
  if (data.unemploymentReason !== undefined) updateData.unemploymentReason = data.unemploymentReason || null;
  if (data.guarantorName !== undefined) updateData.guarantorName = data.guarantorName || null;
  if (data.guarantorPhone !== undefined) updateData.guarantorPhone = data.guarantorPhone || null;
  if (data.guarantorNRC !== undefined) updateData.guarantorNRC = data.guarantorNRC || null;
  if (data.guarantorRelationship !== undefined) updateData.guarantorRelationship = data.guarantorRelationship || null;
  if (data.profilePhotoURL !== undefined) updateData.profilePhotoURL = data.profilePhotoURL || null;

  await updateDoc(customerRef, updateData);

  return { id: customerId, ...updateData };
}

// Link customer to user after invitation acceptance
export async function linkCustomerToUser(
  agencyId: string,
  customerId: string,
  userId: string
) {
  if (isDemoMode) return;

  const customerRef = doc(db, 'agencies', agencyId, 'customers', customerId);
  await updateDoc(customerRef, {
    userId: userId,
    updatedAt: serverTimestamp(),
  });
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
    type: 'vehicle' | 'land' | 'property' | 'electronics' | 'equipment' | 'jewelry' | 'livestock' | 'other';
    name: string;
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
    type: 'vehicle' | 'land' | 'property' | 'electronics' | 'equipment' | 'jewelry' | 'livestock' | 'other';
    name: string;
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
    name: data.name,
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

