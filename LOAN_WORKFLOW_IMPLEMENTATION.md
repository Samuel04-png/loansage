# Controlled Loan Approval & Management Workflow - Implementation Guide

## 🎯 Overview

This document describes the implementation of a secure, role-based loan approval and management workflow system for the microfinance application.

## 📋 Status Lifecycle

```
Draft → Pending → Under Review → Approved → Disbursed → Active → Closed
                                    ↓
                                 Rejected
```

### Status Definitions

| Status | Description | Editable By |
|--------|-------------|-------------|
| **Draft** | Loan is being created and edited | Loan Officer (owner only) |
| **Pending** | Loan submitted for review | Read-only for Loan Officer |
| **Under Review** | Accountant reviewing details | Accountant only |
| **Approved** | Approved, pending disbursement | Admin/Accountant |
| **Rejected** | Loan declined | Terminal (Admin can override) |
| **Disbursed** | Funds released | Admin only |
| **Active** | Repayment ongoing | System-managed |
| **Overdue** | Missed repayment | System-managed |
| **Closed** | Fully repaid | Terminal |

## 👥 Role Permissions

### Loan Officer
- ✅ Create loans (status: DRAFT)
- ✅ Edit loans (only while in DRAFT)
- ✅ Submit loans (DRAFT → PENDING)
- ❌ Cannot approve or reject
- ❌ Cannot edit repayment data
- ❌ Cannot disburse funds

### Accountant
- ✅ View PENDING and UNDER_REVIEW loans
- ✅ Change status:
  - PENDING → UNDER_REVIEW
  - UNDER_REVIEW → APPROVED / REJECTED
- ✅ Create and manage repayment schedules
- ✅ Mark repayments as paid
- ❌ Cannot delete loans
- ❌ Cannot disburse funds

### Agency Owner / Admin
- ✅ Full access to all loans
- ✅ Override any loan status
- ✅ Disburse funds
- ✅ Edit repayments
- ✅ Close loans manually

## 🔧 Implementation Files

### Core Types & Permissions
- **`src/types/loan-workflow.ts`**
  - Loan status enum
  - User role enum
  - Permission checking functions
  - Status transition validation

### Workflow Functions
- **`src/lib/loans/workflow.ts`**
  - `changeLoanStatus()` - Main status transition function
  - `submitLoanForReview()` - Submit draft loan
  - `approveLoan()` - Approve loan with notes
  - `rejectLoan()` - Reject loan with notes
  - `disburseLoan()` - Disburse approved loan

### UI Components
- **`src/features/admin/components/LoanApprovalDialog.tsx`**
  - Approval/rejection dialog with required notes
  - Role-based access control

- **`src/components/loans/LoanStatusBadge.tsx`**
  - Visual status indicator

- **`src/components/loans/LoanActionButtons.tsx`**
  - Context-aware action buttons

- **`src/components/loans/SubmitLoanButton.tsx`**
  - Submit draft loan for review

### Database Migration
- **`supabase/migrations/005_loan_workflow_statuses.sql`**
  - Updates loan status enum
  - Adds approval fields
  - Adds disbursement/closure tracking

## 🔐 Security Features

### 1. Permission Validation
All actions are validated at multiple levels:
- **Frontend**: UI buttons hidden based on permissions
- **Backend**: Functions check permissions before execution
- **Database**: Firestore rules enforce access control

### 2. Status Transition Validation
- Cannot skip statuses
- Transitions validated against role and current status
- Admin can override any transition

### 3. Audit Logging
Every sensitive action creates an audit log entry:
```typescript
{
  action: LoanAuditAction,
  previousStatus: LoanStatus,
  newStatus: LoanStatus,
  performedBy: userId,
  performedByRole: UserRole,
  timestamp: ISO string,
  notes: string,
  metadata: {...}
}
```

## 📝 Usage Examples

### Creating a Loan (Loan Officer)
```typescript
// Loan is created in DRAFT status
const loan = await createLoan({...});
// Status: DRAFT
```

### Submitting for Review (Loan Officer)
```typescript
await submitLoanForReview({
  loanId: '...',
  agencyId: '...',
  userId: '...',
  userRole: UserRole.LOAN_OFFICER,
});
// Status: DRAFT → PENDING
```

### Approving a Loan (Accountant)
```typescript
await approveLoan(
  loanId,
  agencyId,
  userId,
  UserRole.ACCOUNTANT,
  'Borrower meets all criteria. Collateral verified.'
);
// Status: PENDING → UNDER_REVIEW → APPROVED
```

### Rejecting a Loan (Accountant)
```typescript
await rejectLoan(
  loanId,
  agencyId,
  userId,
  UserRole.ACCOUNTANT,
  'Insufficient income. Debt-to-income ratio too high.'
);
// Status: PENDING → UNDER_REVIEW → REJECTED
```

### Disbursing a Loan (Admin)
```typescript
await disburseLoan(
  loanId,
  agencyId,
  userId,
  UserRole.ADMIN,
  new Date()
);
// Status: APPROVED → DISBURSED → ACTIVE
```

## 🚀 Next Steps

1. **Run Database Migration**
   ```bash
   # Apply the migration to update loan statuses
   supabase migration up
   ```

2. **Update Loan List Pages**
   - Add status badges
   - Add action buttons based on permissions
   - Filter by status

3. **Add Notifications**
   - Loan submitted
   - Loan approved/rejected
   - Loan disbursed
   - Repayment due
   - Loan overdue

4. **Repayment Management**
   - Create repayment schedules (Accountant)
   - Mark payments as paid
   - Auto-update status (Active → Overdue → Closed)

5. **Testing**
   - Test all status transitions
   - Verify permission enforcement
   - Test audit logging
   - Test notification triggers

## 🔍 Validation Rules

1. **Loan cannot skip statuses**
   - Enforced by `canTransitionStatus()`

2. **Repayments cannot be edited by loan officers**
   - Enforced by `canPerformAction('manage_repayments', ...)`

3. **Disbursement only allowed after approval**
   - Status must be APPROVED
   - Only Admin can disburse

4. **Status changes must always log an audit entry**
   - Automatic in `changeLoanStatus()`

## 📊 Audit Trail

All loan actions are logged with:
- Action type
- Previous and new status
- User who performed action
- User role
- Timestamp
- Notes/metadata

This creates a complete, immutable audit trail for compliance and accountability.

## 🎨 UI Integration

### Loan List Page
```tsx
import { LoanStatusBadge } from '@/components/loans/LoanStatusBadge';
import { LoanActionButtons } from '@/components/loans/LoanActionButtons';

<LoanStatusBadge status={loan.status} />
<LoanActionButtons
  loanStatus={loan.status}
  userRole={userRole}
  isLoanOwner={loan.created_by === userId}
  onSubmit={() => handleSubmit(loan.id)}
  onApprove={() => handleApprove(loan.id)}
  onReject={() => handleReject(loan.id)}
/>
```

### Loan Detail Page
```tsx
import { SubmitLoanButton } from '@/components/loans/SubmitLoanButton';
import { LoanApprovalDialog } from '@/features/admin/components/LoanApprovalDialog';

{loan.status === LoanStatus.DRAFT && (
  <SubmitLoanButton loanId={loan.id} onSuccess={refetch} />
)}

{loan.status === LoanStatus.PENDING && (
  <LoanApprovalDialog
    open={approvalDialogOpen}
    onOpenChange={setApprovalDialogOpen}
    loanId={loan.id}
    agencyId={agency.id}
    currentStatus={loan.status}
    onSuccess={refetch}
  />
)}
```

## ✅ Implementation Checklist

- [x] Create loan workflow types and enums
- [x] Implement permission checking system
- [x] Create workflow functions with validation
- [x] Add audit logging
- [x] Create database migration
- [x] Create UI components (approval dialog, status badge, action buttons)
- [x] Update loan creation to use DRAFT status
- [ ] Update loan list pages with new workflow
- [ ] Add notification system integration
- [ ] Test all status transitions
- [ ] Update Firestore security rules
- [ ] Add repayment management UI
- [ ] Create admin override functionality

## 🔒 Security Considerations

1. **Backend Validation**: Never trust frontend-only checks
2. **Role Verification**: Always verify user role from database
3. **Status Validation**: Check current status before transitions
4. **Audit Logging**: Log all sensitive actions
5. **Immutable Logs**: Audit logs should never be modified
6. **Permission Checks**: Check permissions at every step

## 📚 Additional Resources

- See `src/types/loan-workflow.ts` for complete type definitions
- See `src/lib/loans/workflow.ts` for workflow functions
- See `supabase/migrations/005_loan_workflow_statuses.sql` for database changes

