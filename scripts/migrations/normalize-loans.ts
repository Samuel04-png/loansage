/**
 * Migration Script: Normalize Loan Documents
 * 
 * Transforms existing loan documents to the new normalized structure
 * with optional sections (collateral, employment, business, guarantor)
 * 
 * Usage:
 *   npm run migrate:loans [--dry-run]
 */

import * as admin from 'firebase-admin';
import * as readline from 'readline';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface NormalizedLoan {
  agencyId: string;
  loanType: string;
  category?: string;
  borrower: any;
  terms: any;
  collateral?: any | null;
  employment?: any | null;
  business?: any | null;
  guarantor?: any | null;
  riskScore?: number;
  status: string;
  idempotencyKey?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  [key: string]: any;
}

/**
 * Normalize a single loan document
 */
function normalizeLoan(loanData: any, loanId: string): NormalizedLoan {
  const normalized: NormalizedLoan = {
    agencyId: loanData.agencyId || loanData.agency_id || '',
    loanType: loanData.loanType || loanData.loan_type || 'personal_unsecured',
    category: loanData.category,
    borrower: loanData.borrower || {
      fullName: loanData.customerName || loanData.customer_name || '',
      email: loanData.customerEmail || loanData.customer_email || '',
      phone: loanData.customerPhone || loanData.customer_phone || '',
      nrcNumber: loanData.customerNRC || loanData.customer_nrc || '',
      address: loanData.customerAddress || loanData.customer_address || '',
    },
    terms: loanData.terms || {
      amount: loanData.amount || 0,
      currency: loanData.currency || 'ZMW',
      interestRate: loanData.interestRate || loanData.interest_rate || 0,
      durationMonths: loanData.durationMonths || loanData.duration_months || 0,
      repaymentFrequency: loanData.repaymentFrequency || loanData.repayment_frequency || 'monthly',
    },
    status: loanData.status || 'draft',
    createdAt: loanData.createdAt || admin.firestore.Timestamp.now(),
    updatedAt: loanData.updatedAt || admin.firestore.Timestamp.now(),
  };

  // Extract collateral if exists
  if (loanData.collateral || loanData.collateralIncluded) {
    normalized.collateral = loanData.collateral || {
      type: loanData.collateralType || 'unknown',
      description: loanData.collateralDesc || loanData.collateral_description || '',
      estimatedValue: loanData.collateralValue || loanData.collateral_value || 0,
    };
  } else {
    normalized.collateral = null;
  }

  // Extract employment if exists
  if (loanData.employment || loanData.employer) {
    normalized.employment = loanData.employment || {
      employerName: loanData.employer || loanData.employerName || '',
      jobTitle: loanData.jobTitle || loanData.job_title || '',
      employmentDuration: loanData.employmentDuration || loanData.employment_duration || 0,
      monthlyIncome: loanData.monthlyIncome || loanData.monthly_income || 0,
    };
  } else {
    normalized.employment = null;
  }

  // Extract business if exists
  if (loanData.business || loanData.businessName) {
    normalized.business = loanData.business || {
      businessName: loanData.businessName || loanData.business_name || '',
      businessType: loanData.businessType || loanData.business_type || '',
      businessAge: loanData.businessAge || loanData.business_age || 0,
    };
  } else {
    normalized.business = null;
  }

  // Extract guarantor if exists
  if (loanData.guarantor || loanData.guarantorName) {
    normalized.guarantor = loanData.guarantor || {
      fullName: loanData.guarantorName || loanData.guarantor_name || '',
      phone: loanData.guarantorPhone || loanData.guarantor_phone || '',
      nrcNumber: loanData.guarantorNRC || loanData.guarantor_nrc || '',
      relationship: loanData.guarantorRelationship || loanData.guarantor_relationship || '',
    };
  } else {
    normalized.guarantor = null;
  }

  // Preserve other fields
  if (loanData.riskScore !== undefined) {
    normalized.riskScore = loanData.riskScore;
  }
  if (loanData.idempotencyKey) {
    normalized.idempotencyKey = loanData.idempotencyKey;
  }
  if (loanData.customerId) {
    normalized.customerId = loanData.customerId;
  }
  if (loanData.officerId) {
    normalized.officerId = loanData.officerId;
  }
  if (loanData.createdBy) {
    normalized.createdBy = loanData.createdBy;
  }

  return normalized;
}

/**
 * Migrate loans for a single agency
 */
async function migrateAgencyLoans(agencyId: string, dryRun: boolean = true): Promise<number> {
  const loansRef = db.collection(`agencies/${agencyId}/loans`);
  const snapshot = await loansRef.get();

  if (snapshot.empty) {
    console.log(`  No loans found for agency ${agencyId}`);
    return 0;
  }

  let migrated = 0;
  const batch = db.batch();
  let batchCount = 0;
  const BATCH_SIZE = 500;

  for (const doc of snapshot.docs) {
    const loanData = doc.data();
    const normalized = normalizeLoan(loanData, doc.id);

    if (dryRun) {
      console.log(`  Would migrate loan ${doc.id}`);
      migrated++;
    } else {
      batch.update(doc.ref, normalized);
      batchCount++;
      migrated++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`  Committed batch of ${batchCount} loans`);
        batchCount = 0;
      }
    }
  }

  if (!dryRun && batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount} loans`);
  }

  return migrated;
}

/**
 * Main migration function
 */
async function migrateAllLoans(dryRun: boolean = true): Promise<void> {
  console.log(`\n${dryRun ? 'DRY RUN' : 'MIGRATING'}: Normalizing loan documents...\n`);

  try {
    // Get all agencies
    const agenciesSnapshot = await db.collection('agencies').get();
    const agencies = agenciesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`Found ${agencies.length} agencies\n`);

    let totalMigrated = 0;

    for (const agency of agencies) {
      console.log(`Processing agency: ${agency.id} (${agency.name || 'Unnamed'})`);
      const migrated = await migrateAgencyLoans(agency.id, dryRun);
      totalMigrated += migrated;
      console.log(`  Migrated ${migrated} loans\n`);
    }

    console.log(`\nTotal: ${totalMigrated} loans ${dryRun ? 'would be' : ''} migrated`);
    
    if (dryRun) {
      console.log('\nTo apply migration, run: npm run migrate:loans -- --apply');
    } else {
      console.log('\nMigration completed successfully!');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// CLI interface
const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');

if (require.main === module) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question(
    dryRun
      ? 'This is a DRY RUN. No changes will be made. Continue? (y/n): '
      : 'This will modify loan documents. Are you sure? (yes/no): ',
    (answer) => {
      if (dryRun && answer.toLowerCase() === 'y') {
        migrateAllLoans(true).then(() => process.exit(0));
      } else if (!dryRun && answer.toLowerCase() === 'yes') {
        migrateAllLoans(false).then(() => process.exit(0));
      } else {
        console.log('Migration cancelled.');
        process.exit(0);
      }
      rl.close();
    }
  );
}

export { migrateAllLoans, migrateAgencyLoans, normalizeLoan };

