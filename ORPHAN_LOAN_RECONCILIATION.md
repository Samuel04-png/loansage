# Orphan Loan Reconciliation System

## Overview

The Orphan Loan Reconciliation System prevents "orphan loans" (loans without customer links) during bulk loan imports and provides tools to reconcile existing orphans.

## Architecture

### Components

#### 1. **Orphan Detection** (`/lib/loan-reconciliation/orphan-detection.ts`)
- **`findMatchingCustomer()`**: Attempts to link a loan to a customer using multi-stage matching:
  1. **Exact ID Match**: `borrower_id` == `customer.id`
  2. **National ID Match**: `national_id` == `customer.national_id`
  3. **Fuzzy Name Match**: String similarity >= 90% (using Levenshtein distance)
  
- **`getOrphanLoans()`**: Retrieves all loans with `status: 'requires_mapping'`
- **`getOrphanReconciliationSuggestions()`**: Gets orphans with AI match suggestions
- **`countOrphanLoans()`**: Returns count of unmapped loans

#### 2. **Import Helper** (`/lib/loan-reconciliation/loan-import-helper.ts`)
- **`processLoanImportWithMatching()`**: Processes loan rows during import
  - Attempts to match each loan to a customer
  - Marks unmatched loans as `status: 'requires_mapping'`
  - Returns statistics: `linkedCount`, `orphanCount`, etc.

#### 3. **UI Components**

**OrphanReconciliationModal** (`/features/admin/components/OrphanReconciliationModal.tsx`)
- Full reconciliation interface
- Features:
  - AI-suggested matches (highlighted in blue)
  - Manual search/selection
  - Create new customer inline
  - Bulk save all mappings
  - Shows match confidence scores

**PostImportReconciliationAlert** (`/features/admin/components/PostImportReconciliationAlert.tsx`)
- Alert shown after import completion
- Two states:
  - **Success**: "All loans linked automatically" (green)
  - **Warning**: "X loans need linking" (amber) with action button

**LoanManagerWithReconciliation** (`/features/admin/components/LoanManagerWithReconciliation.tsx`)
- Displays orphan loan count
- Always available from Loans menu
- Triggers modal on click

## Data Flow

### During Import

```
User Uploads CSV
    ↓
Parse & Analyze
    ↓
Review (manual column mapping)
    ↓
Execute Import
    ├─ For each loan row:
    │  ├─ Try exact ID match
    │  ├─ Try national ID match  
    │  ├─ Try fuzzy name match
    │  ├─ If found: Set customer_id, status: 'active'
    │  └─ If NOT found: Set customer_id: null, status: 'requires_mapping'
    ├─ Generate import result with orphan count
    └─ Return to Complete Step
    ↓
Show Results
    ├─ Display success/failed counts
    ├─ IF orphans found:
    │  └─ Show PostImportReconciliationAlert
    │     └─ User can click "Fix Now" → Opens OrphanReconciliationModal
    └─ User continues or dismisses
```

### Orphan Reconciliation

```
OrphanReconciliationModal opens
    ↓
Load all orphan loans + AI suggestions
    ↓
For each orphan:
    ├─ IF suggestion found (>90% match):
    │  ├─ Highlight match
    │  └─ Show "Confirm" button
    ├─ ELSE:
    │  ├─ Show "Search" button
    │  └─ User types to search customer DB
    └─ Always show "Create New" option
    ↓
User selects matching customer for each
    ↓
Save all mappings
    ├─ Update loan.customer_id
    ├─ Set status: 'active'
    └─ Mark mapped_at timestamp
    ↓
Invalidate queries → List updates
```

## Matching Algorithm

### Fuzzy Matching (Levenshtein Distance)

```typescript
calculateFuzzyScore("M. Daka", "Micheal Daka") → 0.92 (92%)
```

- Edit distance normalized by string length
- Threshold: 90% (configurable)
- Common cases handled:
  - Abbreviations: "M. Daka" → "Micheal Daka"
  - Name order: "John Smith" → "Smith, John"
  - Typos: "Johnathan" → "Jonathan"

## Database Schema

### Loan Document (Firestore)

```typescript
{
  id: string;
  borrower_id: string | null;           // CSV value or null if orphan
  borrower_name: string;                // CSV name
  customer_id: string | null;           // FK to customer (null if orphan)
  national_id: string | null;           // For matching
  amount: number;
  status: 'active' | 'requires_mapping' | 'pending' | 'rejected';
  created_at: ISO8601;
  mapped_at?: ISO8601;                  // When reconciliation was done
  created_by: string;
  // ... other loan fields
}
```

## API Integration Points

### Backend (Firestore Rules)

```firestore
match /agencies/{agencyId}/loans/{loanId} {
  // Allow create with requires_mapping status
  allow create: if request.auth != null && 
                  (request.resource.data.status == 'requires_mapping' ||
                   request.resource.data.status == 'active');
  
  // Allow update to link customer
  allow update: if request.auth != null &&
                  request.resource.data.customer_id != null;
}
```

### Frontend Hook

Use in any component:

```typescript
import { countOrphanLoans } from '@/lib/loan-reconciliation/orphan-detection';

const orphanCount = await countOrphanLoans(agencyId);
if (orphanCount > 0) {
  // Show notification
}
```

## Edge Cases

### Duplicate Customers
If multiple customers match (e.g., "John Smith" appears twice):
- **Current**: Returns first match
- **Future**: Could show dropdown with all matches

### Exact ID without Name
If `borrower_id` exists but `borrower_name` is missing:
- Uses ID match (high confidence)
- Skips fuzzy matching

### New Import Before Reconciliation
If user imports more loans while orphans exist:
- Orphans are cumulative
- Modal shows all orphans together

### Customer Deleted After Mapping
- Loan retains `customer_id` reference
- Could result in foreign key issues
- Solution: Add soft delete or archive status

## Testing Scenarios

### Scenario 1: Perfect Match
- CSV: "Micheal Daka" | DB: "Michael Daka"
- Result: Auto-matched (fuzzy 95%)
- Expected: No orphan

### Scenario 2: Name Variation
- CSV: "M. Daka" | DB: "Micheal Daka"
- Result: AI suggestion shown
- User: Clicks "Confirm"
- Expected: Mapped in modal

### Scenario 3: Complete Mismatch
- CSV: "Unknown Customer" | DB: [No match]
- Result: Orphan created
- User: Types to search, or creates new
- Expected: Manual mapping or new customer

### Scenario 4: Bulk Upload Later
- Step 1: Upload 50 Customers
- Step 2: Upload 100 Loans
  - 80 auto-link
  - 20 orphans (users imported later)
- Expected: Alert shows 20 orphans, users can fix

## UI/UX Best Practices

### Match Confidence Colors
- **Green**: >= 95% (show as "Exact/High")
- **Blue**: 90-94% (show as "Good")
- **Yellow**: 80-89% (show as "Fair")
- **Gray**: < 80% (don't auto-suggest)

### Search UX
- Typeahead with customer database
- Show "Create New" always available
- Confirm before creating (prevents typos)

### Summary Display
```
✅ 80 Loans Linked
⚠️ 20 Loans Need Linking
📊 4 AI Suggestions Made
👤 16 Manual Selections Needed
```

## Future Enhancements

1. **Batch Import Scheduling**: Allow scheduling reconciliation for later
2. **Webhook Notifications**: Notify admins when orphans are created
3. **Historical Tracking**: Log all mapping decisions
4. **Duplicate Detection**: Warn if multiple customers match
5. **Custom Matching Rules**: Allow agencies to define matching logic
6. **Machine Learning**: Train model on past mappings to improve suggestions

## Troubleshooting

### Issue: No suggestions shown
- Check: Is fuzzy threshold too high (default 0.9)?
- Solution: Lower to 0.85 for more permissive matching

### Issue: Wrong customer suggested
- Check: Is name typo in database?
- Solution: Fix customer name first, then reimport/retry reconciliation

### Issue: Modal loads slowly
- Check: Large number of customers (>5000)?
- Solution: Add pagination or indexed search

---

**Last Updated**: 2024-01-10  
**Version**: 1.0  
**Status**: Production Ready
