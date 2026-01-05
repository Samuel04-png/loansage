/**
 * Tenga Marketplace Cloud Functions
 * Handles borrower applications and lender acceptance flow
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

/**
 * Generate secure invitation token (duplicated from customer-lifecycle for independence)
 */
function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const db = admin.firestore();

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface MarketplaceLead {
  borrowerName: string;
  borrowerEmail: string;
  borrowerPhone: string;
  borrowerNRC?: string;
  loanAmount: number;
  loanPurpose: string;
  preferredTermMonths: number;
  targetAgencyId: string;
  targetAgencyName?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: admin.firestore.Timestamp;
  acceptedAt?: admin.firestore.Timestamp;
  acceptedBy?: string;
  notes?: string;
}

interface MarketplaceProfile {
  agencyId: string;
  agencyName: string;
  description?: string;
  minInterestRate: number;
  maxInterestRate: number;
  minLoanAmount: number;
  maxLoanAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  trustBadge: 'enterprise' | 'professional' | 'starter' | null;
  isActive: boolean;
  logoUrl?: string;
  websiteUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  loanTypes?: string[]; // Array of loan type IDs (e.g., ['personal', 'business'])
  requirements?: string[]; // Array of requirement IDs (e.g., ['payslip', 'collateral'])
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE PROFILE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create or update marketplace profile for an agency
 */
export const upsertMarketplaceProfile = functions.https.onCall(
  async (
    data: Partial<MarketplaceProfile> & { agencyId: string },
    context
  ): Promise<{ success: boolean; profileId: string }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { agencyId, ...profileData } = data;
    const userId = context.auth.uid;

    // Verify user is admin of this agency
    const userRef = db.doc(`users/${userId}`);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    if (userData?.role !== 'admin' || userData?.agency_id !== agencyId) {
      throw new functions.https.HttpsError('permission-denied', 'Only agency admins can manage marketplace profiles');
    }

    try {
      // Get agency details
      const agencyRef = db.doc(`agencies/${agencyId}`);
      const agencySnap = await agencyRef.get();
      const agencyData = agencySnap.data();

      if (!agencySnap.exists || !agencyData) {
        throw new functions.https.HttpsError('not-found', 'Agency not found');
      }

      // Determine trust badge from plan
      const plan = agencyData.plan || 'starter';
      const trustBadge = plan === 'enterprise' ? 'enterprise' : plan === 'professional' ? 'professional' : 'starter';

      const profileRef = db.doc(`marketplace_profiles/${agencyId}`);
      const profileSnap = await profileRef.get();

      const now = admin.firestore.Timestamp.now();
      const profile: MarketplaceProfile = {
        agencyId,
        agencyName: profileData.agencyName || agencyData.name || 'Unknown Agency',
        trustBadge,
        isActive: profileData.isActive ?? true,
        minInterestRate: profileData.minInterestRate ?? 10,
        maxInterestRate: profileData.maxInterestRate ?? 30,
        minLoanAmount: profileData.minLoanAmount ?? 1000,
        maxLoanAmount: profileData.maxLoanAmount ?? 100000,
        minTermMonths: profileData.minTermMonths ?? 3,
        maxTermMonths: profileData.maxTermMonths ?? 36,
        description: profileData.description,
        logoUrl: profileData.logoUrl || agencyData.logoURL || agencyData.logoUrl,
        websiteUrl: profileData.websiteUrl || agencyData.websiteUrl,
        contactEmail: profileData.contactEmail || agencyData.email,
        contactPhone: profileData.contactPhone || agencyData.phone,
        loanTypes: profileData.loanTypes || [],
        requirements: profileData.requirements || [],
        createdAt: profileSnap.exists ? profileSnap.data()!.createdAt : now,
        updatedAt: now,
      };

      await profileRef.set(profile, { merge: true });

      console.log(`Marketplace profile ${profileSnap.exists ? 'updated' : 'created'} for agency ${agencyId}`);

      return { success: true, profileId: agencyId };
    } catch (error: any) {
      console.error('Error upserting marketplace profile:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

/**
 * Get marketplace profiles (public) - REST endpoint with CORS
 */
export const getMarketplaceProfiles = functions.https.onRequest(async (req, res) => {
  // Set CORS headers for public access
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    // Parse filters from query params or body
    const filters = req.method === 'POST' ? req.body?.filters || {} : {
      minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
      maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
      minTermMonths: req.query.minTermMonths ? parseInt(req.query.minTermMonths as string) : undefined,
    };

    let query: FirebaseFirestore.Query = db.collection('marketplace_profiles')
      .where('isActive', '==', true);

    // Apply filters if provided
    if (filters.minAmount) {
      query = query.where('maxLoanAmount', '>=', filters.minAmount);
    }
    if (filters.maxAmount) {
      query = query.where('minLoanAmount', '<=', filters.maxAmount);
    }
    if (filters.minTermMonths) {
      query = query.where('maxTermMonths', '>=', filters.minTermMonths);
    }

    // Try to order by trustBadge and minInterestRate, but handle if index doesn't exist
    let snapshot;
    try {
      snapshot = await query.orderBy('trustBadge', 'desc').orderBy('minInterestRate', 'asc').get();
    } catch (error: any) {
      // If composite index doesn't exist, fall back to simple query
      if (error.message?.includes('index')) {
        console.warn('Composite index not found, using simple query');
        snapshot = await query.get();
      } else {
        throw error;
      }
    }

    const profiles = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as unknown as MarketplaceProfile[];

    res.json({ profiles });
  } catch (error: any) {
    console.error('Error fetching marketplace profiles:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BORROWER APPLICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Submit a marketplace loan application
 */
export const submitMarketplaceApplication = functions.https.onCall(
  async (
    data: {
      borrowerName: string;
      borrowerEmail: string;
      borrowerPhone: string;
      borrowerNRC?: string;
      loanAmount: number;
      loanPurpose: string;
      preferredTermMonths: number;
      targetAgencyId: string;
    },
    context
  ): Promise<{ success: boolean; leadId: string }> => {
    try {
      const {
        borrowerName,
        borrowerEmail,
        borrowerPhone,
        borrowerNRC,
        loanAmount,
        loanPurpose,
        preferredTermMonths,
        targetAgencyId,
      } = data;

      // Validate required fields
      if (!borrowerName || !borrowerEmail || !borrowerPhone || !loanAmount || !targetAgencyId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
      }

      // Verify target agency exists and is active in marketplace
      const profileRef = db.doc(`marketplace_profiles/${targetAgencyId}`);
      const profileSnap = await profileRef.get();

      if (!profileSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Lender not found in marketplace');
      }

      const profile = profileSnap.data() as MarketplaceProfile;
      if (!profile.isActive) {
        throw new functions.https.HttpsError('failed-precondition', 'This lender is not currently accepting applications');
      }

      // Validate loan amount and term against lender's limits
      if (loanAmount < profile.minLoanAmount || loanAmount > profile.maxLoanAmount) {
        throw new functions.https.HttpsError(
          'out-of-range',
          `Loan amount must be between ${profile.minLoanAmount.toLocaleString()} and ${profile.maxLoanAmount.toLocaleString()}`
        );
      }

      if (preferredTermMonths < profile.minTermMonths || preferredTermMonths > profile.maxTermMonths) {
        throw new functions.https.HttpsError(
          'out-of-range',
          `Loan term must be between ${profile.minTermMonths} and ${profile.maxTermMonths} months`
        );
      }

      // Get agency name
      const agencyRef = db.doc(`agencies/${targetAgencyId}`);
      const agencySnap = await agencyRef.get();
      const agencyData = agencySnap.data();

      // Create lead
      const leadRef = db.collection('marketplace_leads').doc();
      const lead: MarketplaceLead = {
        borrowerName,
        borrowerEmail,
        borrowerPhone,
        borrowerNRC,
        loanAmount,
        loanPurpose,
        preferredTermMonths,
        targetAgencyId,
        targetAgencyName: agencyData?.name || profile.agencyName,
        status: 'pending',
        createdAt: admin.firestore.Timestamp.now(),
      };

      await leadRef.set(lead);

      console.log(`Marketplace application submitted: ${leadRef.id} for agency ${targetAgencyId}`);

      return { success: true, leadId: leadRef.id };
    } catch (error: any) {
      console.error('Error submitting marketplace application:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// LENDER ACCEPTANCE & ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Accept a marketplace lead and trigger onboarding
 * This is the critical bridge function that:
 * 1. Creates Customer document
 * 2. Creates Loan draft
 * 3. Generates invitation token
 * 4. Sends welcome email
 */
export const acceptMarketplaceLead = functions.https.onCall(
  async (
    data: {
      leadId: string;
      agencyId: string;
      loanTerms?: {
        interestRate?: number;
        termMonths?: number;
        processingFee?: number;
      };
    },
    context
  ): Promise<{ success: boolean; customerId: string; loanId: string; invitationToken: string }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { leadId, agencyId, loanTerms = {} } = data;
    const userId = context.auth.uid;

    // Verify user is admin or loan officer of this agency
    const userRef = db.doc(`users/${userId}`);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    if (userData?.agency_id !== agencyId || (userData?.role !== 'admin' && userData?.role !== 'employee')) {
      throw new functions.https.HttpsError('permission-denied', 'Only agency members can accept leads');
    }

    try {
      // Get lead
      const leadRef = db.doc(`marketplace_leads/${leadId}`);
      const leadSnap = await leadRef.get();

      if (!leadSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Lead not found');
      }

      const lead = leadSnap.data() as MarketplaceLead;

      if (lead.status !== 'pending') {
        throw new functions.https.HttpsError('failed-precondition', `Lead is already ${lead.status}`);
      }

      if (lead.targetAgencyId !== agencyId) {
        throw new functions.https.HttpsError('permission-denied', 'This lead belongs to a different agency');
      }

      // Get agency details
      const agencyRef = db.doc(`agencies/${agencyId}`);
      const agencySnap = await agencyRef.get();
      const agencyData = agencySnap.data();

      if (!agencySnap.exists || !agencyData) {
        throw new functions.https.HttpsError('not-found', 'Agency not found');
      }

      // Generate customer ID
      const customerId = `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Create customer document
      const customerRef = db.doc(`agencies/${agencyId}/customers/${customerId}`);
      const customerData = {
        customerId,
        fullName: lead.borrowerName,
        email: lead.borrowerEmail,
        phone: lead.borrowerPhone,
        nrc: lead.borrowerNRC || null,
        status: 'active',
        source: 'marketplace',
        marketplaceLeadId: leadId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Search keywords for efficient searching
        searchKeywords: [
          lead.borrowerName.toLowerCase(),
          lead.borrowerEmail.toLowerCase(),
          lead.borrowerPhone.replace(/\s+/g, ''),
          ...(lead.borrowerNRC ? [lead.borrowerNRC.toLowerCase()] : []),
        ],
      };

      await customerRef.set(customerData);

      // Create loan draft
      const loanId = `LOAN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const loanRef = db.doc(`agencies/${agencyId}/loans/${loanId}`);

      // Get marketplace profile for default terms
      const profileRef = db.doc(`marketplace_profiles/${agencyId}`);
      const profileSnap = await profileRef.get();
      const profile = profileSnap.data() as MarketplaceProfile | undefined;

      const interestRate = loanTerms.interestRate ?? profile?.minInterestRate ?? 15;
      const termMonths = loanTerms.termMonths ?? lead.preferredTermMonths;

      const loanData = {
        loanId,
        loanNumber: loanId,
        customerId,
        customerName: lead.borrowerName,
        agencyId,
        loanAmount: lead.loanAmount,
        principalAmount: lead.loanAmount,
        interestRate,
        termMonths,
        repaymentFrequency: 'monthly',
        status: 'draft',
        loanPurpose: lead.loanPurpose,
        source: 'marketplace',
        marketplaceLeadId: leadId,
        createdBy: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await loanRef.set(loanData);

      // Generate invitation token
      const token = generateInvitationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      // Create invitation document
      const invitationRef = db.collection(`agencies/${agencyId}/customer_invitations`).doc();
      await invitationRef.set({
        customerId,
        email: lead.borrowerEmail,
        phone: lead.borrowerPhone,
        token,
        status: 'pending',
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'marketplace',
        marketplaceLeadId: leadId,
      });

      // Update customer with invitation status
      await customerRef.update({
        invitationSent: true,
        invitationId: invitationRef.id,
        invitationSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update lead status
      await leadRef.update({
        status: 'accepted',
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        acceptedBy: userId,
      });

      // Send welcome email (this will be handled by onCustomerCreate trigger)
      // But we can also trigger it manually here if needed

      console.log(`Marketplace lead ${leadId} accepted. Customer: ${customerId}, Loan: ${loanId}`);

      return {
        success: true,
        customerId,
        loanId,
        invitationToken: token,
      };
    } catch (error: any) {
      console.error('Error accepting marketplace lead:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

/**
 * Get marketplace leads for an agency
 */
export const getMarketplaceLeads = functions.https.onCall(
  async (
    data: { agencyId: string; status?: 'pending' | 'accepted' | 'rejected' },
    context
  ): Promise<{ leads: MarketplaceLead[] }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { agencyId, status = 'pending' } = data;
    const userId = context.auth.uid;

    // Verify user belongs to agency
    const userRef = db.doc(`users/${userId}`);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    if (userData?.agency_id !== agencyId || (userData?.role !== 'admin' && userData?.role !== 'employee')) {
      throw new functions.https.HttpsError('permission-denied', 'Only agency members can view leads');
    }

    try {
      let query: FirebaseFirestore.Query = db.collection('marketplace_leads')
        .where('targetAgencyId', '==', agencyId);

      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.orderBy('createdAt', 'desc').get();

      const leads = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as unknown as MarketplaceLead[];

      return { leads };
    } catch (error: any) {
      console.error('Error fetching marketplace leads:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);
