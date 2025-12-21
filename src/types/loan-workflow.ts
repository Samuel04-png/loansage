/**
 * Controlled Loan Approval & Management Workflow Types
 * 
 * This module defines the loan status lifecycle, permissions, and workflow rules
 * for the microfinance application.
 */

/**
 * Loan Status Lifecycle
 * Draft → Pending → Under Review → Approved → Disbursed → Active → Closed
 *                                    ↓
 *                                 Rejected
 */
export enum LoanStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DISBURSED = 'disbursed',
  ACTIVE = 'active',
  OVERDUE = 'overdue',
  CLOSED = 'closed',
}

/**
 * User Roles in the system
 */
export enum UserRole {
  ADMIN = 'admin',
  LOAN_OFFICER = 'loan_officer',
  ACCOUNTANT = 'accountant',
  MANAGER = 'manager',
  COLLECTIONS = 'collections',
  UNDERWRITER = 'underwriter',
  CUSTOMER = 'customer',
}

/**
 * Loan Approval Decision
 */
export interface LoanApproval {
  decision: 'approved' | 'rejected';
  reviewedBy: string; // userId
  reviewedAt: string; // ISO timestamp
  notes: string;
  previousStatus: LoanStatus;
  newStatus: LoanStatus;
}

/**
 * Audit Log Entry
 */
export interface LoanAuditLog {
  id: string;
  loanId: string;
  action: LoanAuditAction;
  previousStatus?: LoanStatus;
  newStatus?: LoanStatus;
  performedBy: string; // userId
  performedByRole: UserRole;
  timestamp: string; // ISO timestamp
  metadata?: Record<string, any>;
  notes?: string;
}

/**
 * Audit Log Actions
 */
export enum LoanAuditAction {
  STATUS_CHANGE = 'STATUS_CHANGE',
  REPAYMENT_UPDATED = 'REPAYMENT_UPDATED',
  DISBURSEMENT = 'DISBURSEMENT',
  LOAN_CREATED = 'LOAN_CREATED',
  LOAN_EDITED = 'LOAN_EDITED',
  LOAN_SUBMITTED = 'LOAN_SUBMITTED',
  REPAYMENT_SCHEDULE_CREATED = 'REPAYMENT_SCHEDULE_CREATED',
  REPAYMENT_MARKED_PAID = 'REPAYMENT_MARKED_PAID',
  LOAN_CLOSED = 'LOAN_CLOSED',
  LOAN_REOPENED = 'LOAN_REOPENED',
}

/**
 * Status Transition Rules
 */
export const STATUS_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  [LoanStatus.DRAFT]: [LoanStatus.PENDING],
  [LoanStatus.PENDING]: [LoanStatus.UNDER_REVIEW, LoanStatus.DRAFT], // Can go back to draft
  [LoanStatus.UNDER_REVIEW]: [LoanStatus.APPROVED, LoanStatus.REJECTED, LoanStatus.PENDING], // Can go back to pending
  [LoanStatus.APPROVED]: [LoanStatus.DISBURSED, LoanStatus.REJECTED], // Can be rejected even after approval
  [LoanStatus.REJECTED]: [], // Terminal state (unless admin override)
  [LoanStatus.DISBURSED]: [LoanStatus.ACTIVE],
  [LoanStatus.ACTIVE]: [LoanStatus.OVERDUE, LoanStatus.CLOSED],
  [LoanStatus.OVERDUE]: [LoanStatus.ACTIVE, LoanStatus.CLOSED],
  [LoanStatus.CLOSED]: [], // Terminal state
};

/**
 * Permission Matrix
 * Defines what each role can do with loans in different statuses
 */
export interface LoanPermission {
  canView: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canDisburse: boolean;
  canManageRepayments: boolean;
  canClose: boolean;
  canOverride: boolean; // Admin override any status
}

/**
 * Get permissions for a role and loan status
 */
export function getLoanPermissions(
  role: UserRole,
  loanStatus: LoanStatus,
  isLoanOwner: boolean = false
): LoanPermission {
  const isAdmin = role === UserRole.ADMIN || role === UserRole.MANAGER;
  const isAccountant = role === UserRole.ACCOUNTANT;
  const isLoanOfficer = role === UserRole.LOAN_OFFICER;

  // Admin/Manager has full access
  if (isAdmin) {
    return {
      canView: true,
      canEdit: true,
      canSubmit: true,
      canApprove: true,
      canReject: true,
      canDisburse: true,
      canManageRepayments: true,
      canClose: true,
      canOverride: true,
    };
  }

  // Accountant permissions
  if (isAccountant) {
    return {
      canView: [LoanStatus.PENDING, LoanStatus.UNDER_REVIEW, LoanStatus.APPROVED, LoanStatus.DISBURSED, LoanStatus.ACTIVE, LoanStatus.OVERDUE].includes(loanStatus),
      canEdit: false, // Accountants don't edit loan details
      canSubmit: false,
      canApprove: [LoanStatus.PENDING, LoanStatus.UNDER_REVIEW, LoanStatus.APPROVED].includes(loanStatus),
      canReject: [LoanStatus.PENDING, LoanStatus.UNDER_REVIEW].includes(loanStatus),
      canDisburse: false, // Accountants cannot disburse
      canManageRepayments: [LoanStatus.APPROVED, LoanStatus.DISBURSED, LoanStatus.ACTIVE, LoanStatus.OVERDUE].includes(loanStatus),
      canClose: false,
      canOverride: false,
    };
  }

  // Loan Officer permissions
  if (isLoanOfficer) {
    const canOnlyEditDraft = loanStatus === LoanStatus.DRAFT;
    return {
      canView: true,
      canEdit: canOnlyEditDraft && isLoanOwner,
      canSubmit: canOnlyEditDraft && isLoanOwner,
      canApprove: false,
      canReject: false,
      canDisburse: false,
      canManageRepayments: false,
      canClose: false,
      canOverride: false,
    };
  }

  // Default: no permissions
  return {
    canView: false,
    canEdit: false,
    canSubmit: false,
    canApprove: false,
    canReject: false,
    canDisburse: false,
    canManageRepayments: false,
    canClose: false,
    canOverride: false,
  };
}

/**
 * Check if a status transition is allowed
 */
export function canTransitionStatus(
  fromStatus: LoanStatus,
  toStatus: LoanStatus,
  role: UserRole
): boolean {
  // Admin can override any transition
  if (role === UserRole.ADMIN || role === UserRole.MANAGER) {
    return true;
  }

  // Check if transition is in allowed list
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus] || [];
  return allowedTransitions.includes(toStatus);
}

/**
 * Check if user can perform action on loan
 */
export function canPerformAction(
  action: 'edit' | 'submit' | 'approve' | 'reject' | 'disburse' | 'manage_repayments' | 'close',
  role: UserRole,
  loanStatus: LoanStatus,
  isLoanOwner: boolean = false
): boolean {
  const permissions = getLoanPermissions(role, loanStatus, isLoanOwner);

  switch (action) {
    case 'edit':
      return permissions.canEdit;
    case 'submit':
      return permissions.canSubmit;
    case 'approve':
      return permissions.canApprove;
    case 'reject':
      return permissions.canReject;
    case 'disburse':
      return permissions.canDisburse;
    case 'manage_repayments':
      return permissions.canManageRepayments;
    case 'close':
      return permissions.canClose;
    default:
      return false;
  }
}

/**
 * Get next valid statuses for a loan
 */
export function getNextValidStatuses(
  currentStatus: LoanStatus,
  role: UserRole
): LoanStatus[] {
  const isAdmin = role === UserRole.ADMIN || role === UserRole.MANAGER;
  
  if (isAdmin) {
    // Admin can transition to any status
    return Object.values(LoanStatus);
  }

  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  
  // Filter based on role permissions
  return allowedTransitions.filter((status) => {
    if (role === UserRole.ACCOUNTANT) {
      // Accountant can move: pending → under_review → approved/rejected
      if (currentStatus === LoanStatus.PENDING) {
        return status === LoanStatus.UNDER_REVIEW;
      }
      if (currentStatus === LoanStatus.UNDER_REVIEW) {
        return status === LoanStatus.APPROVED || status === LoanStatus.REJECTED;
      }
      return false;
    }
    
    if (role === UserRole.LOAN_OFFICER) {
      // Loan officer can only: draft → pending
      return currentStatus === LoanStatus.DRAFT && status === LoanStatus.PENDING;
    }

    return true;
  });
}

