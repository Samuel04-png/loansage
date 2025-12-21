/**
 * Loan Workflow Test Script
 * 
 * Tests the complete loan approval and management workflow
 * Run with: npx tsx scripts/test-loan-workflow.ts
 */

import { LoanStatus, UserRole } from '../src/types/loan-workflow';
import { 
  submitLoanForReview, 
  approveLoan, 
  rejectLoan, 
  disburseLoan,
  changeLoanStatus 
} from '../src/lib/loans/workflow';
import { canTransitionStatus, canPerformAction, getLoanPermissions } from '../src/types/loan-workflow';

// Mock data for testing
const TEST_AGENCY_ID = 'test-agency-123';
const TEST_LOAN_ID = 'test-loan-123';
const TEST_LOAN_OFFICER_ID = 'test-officer-123';
const TEST_ACCOUNTANT_ID = 'test-accountant-123';
const TEST_ADMIN_ID = 'test-admin-123';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function logTest(test: string, passed: boolean, error?: string) {
  results.push({ test, passed, error });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${test}${error ? ` - ${error}` : ''}`);
}

/**
 * Test 1: Permission Checks
 */
function testPermissions() {
  console.log('\n📋 Testing Permissions...\n');

  // Loan Officer can edit DRAFT loans
  const officerDraftPerms = getLoanPermissions(UserRole.LOAN_OFFICER, LoanStatus.DRAFT, true);
  logTest('Loan Officer can edit DRAFT loans', officerDraftPerms.canEdit);

  // Loan Officer cannot edit PENDING loans
  const officerPendingPerms = getLoanPermissions(UserRole.LOAN_OFFICER, LoanStatus.PENDING, true);
  logTest('Loan Officer cannot edit PENDING loans', !officerPendingPerms.canEdit);

  // Loan Officer can submit DRAFT loans
  logTest('Loan Officer can submit DRAFT loans', officerDraftPerms.canSubmit);

  // Accountant can approve PENDING loans
  const accountantPendingPerms = getLoanPermissions(UserRole.ACCOUNTANT, LoanStatus.PENDING, false);
  logTest('Accountant can approve PENDING loans', accountantPendingPerms.canApprove);

  // Accountant cannot disburse loans
  logTest('Accountant cannot disburse loans', !accountantPendingPerms.canDisburse);

  // Admin has full permissions
  const adminPerms = getLoanPermissions(UserRole.ADMIN, LoanStatus.APPROVED, false);
  logTest('Admin has full permissions', 
    adminPerms.canView && 
    adminPerms.canEdit && 
    adminPerms.canApprove && 
    adminPerms.canDisburse && 
    adminPerms.canOverride
  );
}

/**
 * Test 2: Status Transitions
 */
function testStatusTransitions() {
  console.log('\n🔄 Testing Status Transitions...\n');

  // Valid transitions
  logTest('DRAFT → PENDING (valid)', canTransitionStatus(LoanStatus.DRAFT, LoanStatus.PENDING, UserRole.LOAN_OFFICER));
  logTest('PENDING → UNDER_REVIEW (valid)', canTransitionStatus(LoanStatus.PENDING, LoanStatus.UNDER_REVIEW, UserRole.ACCOUNTANT));
  logTest('UNDER_REVIEW → APPROVED (valid)', canTransitionStatus(LoanStatus.UNDER_REVIEW, LoanStatus.APPROVED, UserRole.ACCOUNTANT));
  logTest('APPROVED → DISBURSED (valid)', canTransitionStatus(LoanStatus.APPROVED, LoanStatus.DISBURSED, UserRole.ADMIN));
  logTest('DISBURSED → ACTIVE (valid)', canTransitionStatus(LoanStatus.DISBURSED, LoanStatus.ACTIVE, UserRole.ADMIN));

  // Invalid transitions
  logTest('DRAFT → APPROVED (invalid - skip)', !canTransitionStatus(LoanStatus.DRAFT, LoanStatus.APPROVED, UserRole.LOAN_OFFICER));
  logTest('PENDING → DISBURSED (invalid - skip)', !canTransitionStatus(LoanStatus.PENDING, LoanStatus.DISBURSED, UserRole.ACCOUNTANT));
  logTest('REJECTED → APPROVED (invalid - terminal)', !canTransitionStatus(LoanStatus.REJECTED, LoanStatus.APPROVED, UserRole.ACCOUNTANT));

  // Admin override
  logTest('Admin can override any transition', canTransitionStatus(LoanStatus.REJECTED, LoanStatus.APPROVED, UserRole.ADMIN));
}

/**
 * Test 3: Action Permissions
 */
function testActionPermissions() {
  console.log('\n⚡ Testing Action Permissions...\n');

  // Loan Officer actions
  logTest('Loan Officer can submit DRAFT', canPerformAction('submit', UserRole.LOAN_OFFICER, LoanStatus.DRAFT, true));
  logTest('Loan Officer cannot approve', !canPerformAction('approve', UserRole.LOAN_OFFICER, LoanStatus.PENDING, false));
  logTest('Loan Officer cannot disburse', !canPerformAction('disburse', UserRole.LOAN_OFFICER, LoanStatus.APPROVED, false));

  // Accountant actions
  logTest('Accountant can approve PENDING', canPerformAction('approve', UserRole.ACCOUNTANT, LoanStatus.PENDING, false));
  logTest('Accountant can reject PENDING', canPerformAction('reject', UserRole.ACCOUNTANT, LoanStatus.PENDING, false));
  logTest('Accountant cannot disburse', !canPerformAction('disburse', UserRole.ACCOUNTANT, LoanStatus.APPROVED, false));
  logTest('Accountant can manage repayments', canPerformAction('manage_repayments', UserRole.ACCOUNTANT, LoanStatus.APPROVED, false));

  // Admin actions
  logTest('Admin can disburse', canPerformAction('disburse', UserRole.ADMIN, LoanStatus.APPROVED, false));
  logTest('Admin can close loans', canPerformAction('close', UserRole.ADMIN, LoanStatus.ACTIVE, false));
}

/**
 * Test 4: Workflow Functions (Mock)
 */
async function testWorkflowFunctions() {
  console.log('\n🔧 Testing Workflow Functions...\n');

  // Note: These are mock tests - actual functions require Firebase connection
  // In a real test environment, you would use Firebase emulators

  try {
    // Test submit loan
    logTest('submitLoanForReview function exists', typeof submitLoanForReview === 'function');
    
    // Test approve loan
    logTest('approveLoan function exists', typeof approveLoan === 'function');
    
    // Test reject loan
    logTest('rejectLoan function exists', typeof rejectLoan === 'function');
    
    // Test disburse loan
    logTest('disburseLoan function exists', typeof disburseLoan === 'function');
    
    // Test change status
    logTest('changeLoanStatus function exists', typeof changeLoanStatus === 'function');
  } catch (error: any) {
    logTest('Workflow functions accessible', false, error.message);
  }
}

/**
 * Test 5: Status Flow Validation
 */
function testStatusFlow() {
  console.log('\n📊 Testing Complete Status Flow...\n');

  const validFlow = [
    { from: LoanStatus.DRAFT, to: LoanStatus.PENDING, role: UserRole.LOAN_OFFICER },
    { from: LoanStatus.PENDING, to: LoanStatus.UNDER_REVIEW, role: UserRole.ACCOUNTANT },
    { from: LoanStatus.UNDER_REVIEW, to: LoanStatus.APPROVED, role: UserRole.ACCOUNTANT },
    { from: LoanStatus.APPROVED, to: LoanStatus.DISBURSED, role: UserRole.ADMIN },
    { from: LoanStatus.DISBURSED, to: LoanStatus.ACTIVE, role: UserRole.ADMIN },
    { from: LoanStatus.ACTIVE, to: LoanStatus.CLOSED, role: UserRole.ADMIN },
  ];

  let allValid = true;
  validFlow.forEach((step, index) => {
    const isValid = canTransitionStatus(step.from, step.to, step.role);
    if (!isValid) allValid = false;
    logTest(`Step ${index + 1}: ${step.from} → ${step.to} (${step.role})`, isValid);
  });

  logTest('Complete workflow flow is valid', allValid);
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🧪 Loan Workflow Test Suite\n');
  console.log('=' .repeat(50));

  testPermissions();
  testStatusTransitions();
  testActionPermissions();
  await testWorkflowFunctions();
  testStatusFlow();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n📈 Test Summary\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.test}${r.error ? ` - ${r.error}` : ''}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests, testPermissions, testStatusTransitions, testActionPermissions, testWorkflowFunctions, testStatusFlow };

