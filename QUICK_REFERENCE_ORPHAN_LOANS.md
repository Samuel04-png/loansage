# Quick Reference: Orphan Loan Reconciliation

## For Developers

### Use in Your Component
```typescript
import { countOrphanLoans, getOrphanLoans } from '@/lib/loan-reconciliation/orphan-detection';

// Check if orphans exist
const count = await countOrphanLoans(agencyId);
if (count > 0) {
  // Show notification or badge
}

// Get full orphan details
const orphans = await getOrphanLoans(agencyId);
orphans.forEach(orphan => {
  console.log(`Orphan: ${orphan.borrowerName} ($${orphan.amount})`);
});
```

### Open Reconciliation Modal
```typescript
import { OrphanReconciliationModal } from '@/features/admin/components/OrphanReconciliationModal';

<OrphanReconciliationModal
  open={isOpen}
  onOpenChange={setIsOpen}
  agencyId={profile.agency_id}
  userId={profile.id}
/>
```

### Process Loans During Import
```typescript
import { processLoanImportWithMatching } from '@/lib/loan-reconciliation/loan-import-helper';

const result = await processLoanImportWithMatching(agencyId, loanRows);
console.log(`Linked: ${result.linkedCount}, Orphans: ${result.orphanCount}`);

if (result.orphanCount > 0) {
  // Show alert or trigger reconciliation
}
```

---

## For Admins/End Users

### Import Loans Process
1. Go to **Loans** > **Bulk Import**
2. Upload CSV with loan data
3. Review and map columns
4. Click "Import"
5. Wait for results...

### If Orphans Found
You'll see: **⚠️ 20 loans need linking**

**Option A: Fix Now**
- Click blue "Fix Now" button
- See list of unmatched loans
- For each loan:
  - ✅ Accept AI suggestion (if shown in blue)
  - 🔍 Search manually
  - ➕ Create new customer
- Click "Link 20 Loans" when done

**Option B: Fix Later**
- Dismiss alert
- Go to **Loans** > **Loan Management**
- See badge: "⚠️ 20 Need Linking"
- Click to open reconciliation anytime

---

## Matching Explanation

### Why Some Loans Auto-Link
We check THREE ways:

1. **Exact ID Match**: `Loan ID = Customer ID` ✓
2. **National ID**: `Loan NRC = Customer NRC` ✓
3. **Fuzzy Name**: `"M. Daka" = "Micheal Daka"` ✓

If any match, loan links automatically.

### Why Some Don't
- Name is completely different
- Customer not uploaded yet
- Typo in database

### What AI Suggests
If the name is **>90% similar**, we show it with blue highlight:
- "M. Daka" vs "Micheal Daka" = 92% match ✓ Suggest
- "John Smith" vs "Jane Smith" = 85% match ✗ Don't suggest

---

## FAQs

**Q: I imported loans but can't find them**
A: They're there but marked "requires mapping". Go to Loans menu, find "⚠️ X Need Linking" badge.

**Q: Why are my loans orphaned?**
A: Customer name in CSV doesn't match database. Common causes:
- Abbreviations: "M. Daka" vs "Micheal Daka"
- Full name vs nickname: "James" vs "Jim"
- Different name order: "John Smith" vs "Smith, John"

**Q: Can I create customers from loans?**
A: Yes! In reconciliation modal, click "+ Create New" button.

**Q: What if I have 1000 orphans?**
A: Modal shows all of them. Use search to find customers faster. Or create new customers as needed.

**Q: Can I undo a mapping?**
A: Not in the modal. But you can manually edit the loan in the database or contact admin.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No suggestions shown | Check database for customer name with similar spelling |
| Wrong customer suggested | Verify customer name is correct in database |
| Loan won't link | Try searching for customer manually |
| Modal slow to load | Customer database is large, wait or try search box |
| Can't find customer | Create new customer from loan data |

---

## System Status
- ✅ Sidebar Navigation: Correct
- ✅ Auto-Matching: 3-stage (ID, NRC, Fuzzy)
- ✅ Reconciliation Modal: Full UI
- ✅ Search: Real-time customer lookup
- ✅ Create New: Inline customer creation
- ✅ Integration: Built into BulkImportWizard

---

## Support
For issues or questions, contact your system admin.
