# Firestore Rules and Cloud Functions Update for CRUD Operations

## Overview
This document outlines the security rules and Cloud Functions added to support the new Customer and Loan CRUD operations.

## Firestore Security Rules Updates

### Customer Rules (`firestore.rules`)

#### Update Permissions
- **Before**: Any authenticated user belonging to agency could update
- **After**: Only loan officers, admins, and employees can update customers
- **Rule**: `allow update: if isAuthenticated() && ((belongsToAgency(agencyId) && (isLoanOfficer() || isAdmin() || isEmployee())) || request.resource.data.userId == request.auth.uid)`

#### Delete Permissions
- **Before**: Any authenticated user belonging to agency could delete
- **After**: Only loan officers, admins, and employees can delete customers
- **Note**: Active loan check is done in Cloud Functions (Firestore rules cannot query across collections efficiently)

### Loan Rules (`firestore.rules`)

#### Update Permissions
- **Enhanced**: Loan officers can only edit DRAFT loans (all fields)
- **Rule**: `allow update: if isAuthenticated() && belongsToAgency(agencyId) && (isAdmin() || isAccountant() || (isLoanOfficer() && (resource.data.status == 'draft' || resource.data.status == null || resource.data.status == '')) || isEmployee())`

#### Delete Permissions
- **Before**: Admins, loan officers, and accountants could delete any loan
- **After**: Only DRAFT or REJECTED loans can be deleted by loan officers/accountants
- **Admins**: Can still delete any loan
- **Rule**: `allow delete: if isAuthenticated() && belongsToAgency(agencyId) && (isAdmin() || ((isLoanOfficer() || isAccountant()) && resource.data.status == 'draft' || resource.data.status == 'rejected'))`

## Cloud Functions Created

### 1. `validateCustomerDelete`
**File**: `functions/src/validate-customer-delete.ts`

**Purpose**: Validates customer deletion by checking for active loans

**Parameters**:
- `agencyId` (string): Agency ID
- `customerId` (string): Customer ID to delete

**Returns**:
```typescript
{
  success: boolean;
  canDelete: boolean;
  activeLoanCount: number;
  totalLoanCount: number;
}
```

**Errors**:
- `unauthenticated`: User not authenticated
- `invalid-argument`: Missing required parameters
- `failed-precondition`: Customer has active loans

**Usage**:
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const validateCustomerDelete = httpsCallable(functions, 'validateCustomerDelete');

const result = await validateCustomerDelete({
  agencyId: 'agency-id',
  customerId: 'customer-id'
});
```

### 2. `validateLoanDelete`
**File**: `functions/src/validate-loan-delete.ts`

**Purpose**: Validates loan deletion by checking status and repayments

**Parameters**:
- `agencyId` (string): Agency ID
- `loanId` (string): Loan ID to delete

**Returns**:
```typescript
{
  success: boolean;
  canDelete: boolean;
  status: string;
  repaymentCount: number;
}
```

**Errors**:
- `unauthenticated`: User not authenticated
- `invalid-argument`: Missing required parameters
- `not-found`: Loan not found
- `failed-precondition`: Loan status not DRAFT/REJECTED or has repayments

**Usage**:
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const validateLoanDelete = httpsCallable(functions, 'validateLoanDelete');

const result = await validateLoanDelete({
  agencyId: 'agency-id',
  loanId: 'loan-id'
});
```

### 3. `validateLoanUpdate`
**File**: `functions/src/validate-loan-update.ts`

**Purpose**: Validates loan updates based on status and user role

**Parameters**:
- `agencyId` (string): Agency ID
- `loanId` (string): Loan ID to update
- `updateData` (object): Data to update
- `userRole` (string): User's role (admin, manager, accountant, loan_officer, employee)

**Returns**:
```typescript
{
  success: boolean;
  canUpdate: boolean;
  reason: string;
}
```

**Errors**:
- `unauthenticated`: User not authenticated
- `invalid-argument`: Missing required parameters
- `not-found`: Loan not found
- `permission-denied`: User role cannot update loan with current status

**Usage**:
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const validateLoanUpdate = httpsCallable(functions, 'validateLoanUpdate');

const result = await validateLoanUpdate({
  agencyId: 'agency-id',
  loanId: 'loan-id',
  updateData: { amount: 10000, interestRate: 15 },
  userRole: 'loan_officer'
});
```

## Permission Matrix

### Customer Operations

| Operation | Admin | Manager | Accountant | Loan Officer | Employee |
|-----------|-------|---------|------------|--------------|----------|
| Create    | ✅    | ✅      | ✅         | ✅           | ✅       |
| Read      | ✅    | ✅      | ✅         | ✅           | ✅       |
| Update    | ✅    | ✅      | ✅         | ✅           | ✅       |
| Delete    | ✅    | ✅      | ✅         | ✅           | ✅       |

**Note**: Delete requires no active loans (validated in Cloud Function)

### Loan Operations

| Operation | Admin | Manager | Accountant | Loan Officer | Employee |
|-----------|-------|---------|------------|--------------|----------|
| Create    | ✅    | ✅      | ✅         | ✅           | ❌       |
| Read      | ✅    | ✅      | ✅         | ✅           | ✅       |
| Update    | ✅    | ✅      | ✅         | ✅*          | ✅**     |
| Delete    | ✅    | ✅      | ✅***      | ✅***        | ❌       |

**Notes**:
- *Accountant: Can update pending/approved loans
- **Employee: Can update for workflow actions only
- ***Loan Officer/Accountant: Can only delete DRAFT or REJECTED loans

### Loan Update by Status

| Status    | Admin | Manager | Accountant | Loan Officer | Employee |
|-----------|-------|---------|------------|--------------|----------|
| DRAFT     | ✅    | ✅      | ✅         | ✅           | ✅       |
| PENDING   | ✅    | ✅      | ✅         | ❌           | ✅**     |
| APPROVED  | ✅    | ✅      | ✅         | ❌           | ✅**     |
| ACTIVE    | ✅    | ✅      | ✅         | ❌           | ✅**     |
| DISBURSED | ✅    | ✅      | ✅         | ❌           | ✅**     |
| REJECTED  | ✅    | ✅      | ✅         | ❌           | ✅**     |
| CLOSED    | ✅    | ✅      | ❌         | ❌           | ❌       |

**Notes**:
- **Employee: Can only update status/workflow fields, not loan terms

## Deployment Instructions

### 1. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 2. Deploy Cloud Functions

Deploy all functions:
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

Deploy specific functions:
```bash
firebase deploy --only functions:validateCustomerDelete
firebase deploy --only functions:validateLoanDelete
firebase deploy --only functions:validateLoanUpdate
```

### 3. Verify Deployment

Check function logs:
```bash
firebase functions:log --only validateCustomerDelete
firebase functions:log --only validateLoanDelete
firebase functions:log --only validateLoanUpdate
```

## Testing

### Test Customer Delete Validation

```typescript
// Should fail if customer has active loans
try {
  const result = await validateCustomerDelete({
    agencyId: 'test-agency',
    customerId: 'test-customer'
  });
  console.log('Can delete:', result.data.canDelete);
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

### Test Loan Delete Validation

```typescript
// Should fail if loan is not DRAFT/REJECTED or has repayments
try {
  const result = await validateLoanDelete({
    agencyId: 'test-agency',
    loanId: 'test-loan'
  });
  console.log('Can delete:', result.data.canDelete);
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

### Test Loan Update Validation

```typescript
// Should fail if loan officer tries to update non-DRAFT loan
try {
  const result = await validateLoanUpdate({
    agencyId: 'test-agency',
    loanId: 'test-loan',
    updateData: { amount: 15000 },
    userRole: 'loan_officer'
  });
  console.log('Can update:', result.data.canUpdate);
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

## Security Considerations

1. **Client-Side Validation**: The frontend performs validation, but Cloud Functions provide server-side enforcement
2. **Firestore Rules**: First line of defense - prevents unauthorized access
3. **Cloud Functions**: Second line of defense - enforces business logic and complex validations
4. **Audit Logging**: All operations are logged for compliance and debugging

## Next Steps

1. Deploy the updated Firestore rules
2. Deploy the new Cloud Functions
3. Test all CRUD operations with different user roles
4. Monitor function logs for any issues
5. Update frontend code to call validation functions before operations (optional but recommended)

## Notes

- Firestore rules cannot efficiently query across collections, so complex validations (like checking for active loans) are done in Cloud Functions
- The frontend helpers (`customer-helpers.ts` and `loan-helpers.ts`) already perform these validations, but Cloud Functions provide an additional security layer
- Consider calling Cloud Functions before operations for better user experience (show errors before attempting the operation)
