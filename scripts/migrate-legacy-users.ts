/**
 * Manual Migration Script for Legacy Starter Plan Users
 * 
 * Run this script to migrate existing $0 Starter plan users to the new
 * 14-day trial system.
 * 
 * Usage:
 *   npx tsx scripts/migrate-legacy-users.ts
 * 
 * Or with mode:
 *   npx tsx scripts/migrate-legacy-users.ts graceful
 *   npx tsx scripts/migrate-legacy-users.ts strict
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Get mode from command line args
const mode = (process.argv[2] as 'graceful' | 'strict') || 'graceful';

// Initialize Firebase Admin
// Try to find service account key
const serviceAccountPath = path.join(__dirname, '../service-account-key.json');
let serviceAccount;

if (fs.existsSync(serviceAccountPath)) {
  serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  // Use default credentials (if running on Firebase or with GOOGLE_APPLICATION_CREDENTIALS)
  console.log('No service account key found. Using default credentials...');
  admin.initializeApp();
}

async function migrateLegacyUsers() {
  const db = admin.firestore();
  const agenciesRef = db.collection('agencies');
  
  console.log(`Starting migration in ${mode} mode...`);
  
  // Find all starter plan agencies
  const starterAgencies = await agenciesRef
    .where('plan', '==', 'starter')
    .get();

  console.log(`Found ${starterAgencies.size} starter plan agencies`);

  const now = admin.firestore.Timestamp.now();
  const trialEnd = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + (14 * 24 * 60 * 60 * 1000) // 14 days
  );

  let count = 0;
  let skipped = 0;
  const batch = db.batch();

  for (const doc of starterAgencies.docs) {
    const agencyData = doc.data();
    
    // Skip if already has trial end date (already migrated)
    if (agencyData.trialEndDate) {
      skipped++;
      continue;
    }
    
    // Skip if has active subscription (already paid)
    if (agencyData.subscriptionStatus === 'active' && agencyData.stripeSubscriptionId) {
      skipped++;
      continue;
    }

    if (mode === 'graceful') {
      // Graceful migration: Start 14-day trial from today
      batch.update(doc.ref, {
        plan: 'starter',
        planType: 'free',
        subscriptionStatus: 'trialing',
        trialStartDate: now,
        trialEndDate: trialEnd,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Strict mode: Immediately require upgrade
      batch.update(doc.ref, {
        subscriptionStatus: 'expired',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    count++;

    // Firestore batch limit is 500
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`Migrated ${count} agencies...`);
    }
  }

  // Commit remaining updates
  if (count % 500 !== 0) {
    await batch.commit();
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   - Migrated: ${count} agencies`);
  console.log(`   - Skipped: ${skipped} agencies (already migrated or active)`);
  console.log(`   - Mode: ${mode}`);
  
  if (mode === 'graceful') {
    console.log(`   - Trial end date: ${trialEnd.toDate().toISOString()}`);
  }
}

// Run migration
migrateLegacyUsers()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

