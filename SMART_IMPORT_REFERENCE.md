# Quick Reference: New Services & Updates

## 🔧 New Services Created

### 1. Multi-Section CSV Splitter
**Location**: `src/lib/data-import/multi-section-splitter.ts`

**Purpose**: Parse Nenji-export and other multi-section CSV dump files

**Key Functions**:
```typescript
// Main function - splits file by === SECTION === markers
splitMultiSectionCSV(content: string): SplitResult

// Get human-readable section name
getSectionDescription(section: CSVSection): string
// Example output: "Borrowers - 150 rows"

// Detect what type of data is in a section
detectSectionType(sectionName: string, headers: string[]): 'borrowers' | 'loans' | 'branches' | 'unknown'

// Export section back to valid CSV
sectionToCSV(section: CSVSection): string

// Parse CSV line handling quoted commas
parseCSVLine(line: string): string[]
```

**Usage Example**:
```typescript
import { splitMultiSectionCSV } from '@/lib/data-import/multi-section-splitter';

const fileContent = await file.text();
const result = splitMultiSectionCSV(fileContent);

if (result.hasSections && result.sections.length > 1) {
  // Multiple sections found - show section picker
  result.sections.forEach(section => {
    console.log(`${section.name}: ${section.rowCount} rows`);
  });
}
```

---

### 2. AI Data Sanitization Service
**Location**: `src/lib/data-import/ai-sanitization-service.ts`

**Purpose**: Clean and normalize messy CSV data

**Key Functions**:
```typescript
// Normalize phone to +260XXXXXXXXX format
normalizePhoneNumber(phone: string): SanitizationResult

// Detect and extract phone from email field
extractPhoneFromEmail(email: string): SanitizationResult

// Normalize email address
normalizeEmail(email: string): SanitizationResult

// Handle addresses with quoted commas
normalizeAddress(address: string): SanitizationResult

// Process complete row with all fields
sanitizeRow(rowIndex: number, data: Record<string, string>, columnMappings: Record<string, string>): RowSanitizationResult

// Batch process multiple rows
sanitizeRows(rows: Array<Record<string, string>>, columnMappings: Record<string, string>): {
  cleanedRows: RowSanitizationResult[];
  validRows: RowSanitizationResult[];
  invalidRows: RowSanitizationResult[];
  totalIssues: number;
}
```

**Usage Example**:
```typescript
import { sanitizeRows } from '@/lib/data-import/ai-sanitization-service';

const result = sanitizeRows(importData.rows, {
  'Phone': 'phone',
  'Email': 'email',
  'Name': 'name',
  'Address': 'address'
});

console.log(`Cleaned ${result.validRows.length} rows`);
console.log(`Found ${result.totalIssues} issues and fixed them`);

result.invalidRows.forEach(row => {
  console.log(`Row ${row.rowIndex}: ${row.errors.join(', ')}`);
});
```

---

## 🔄 Updated Components

### BulkImportWizard.tsx
**New Features**:
- Multi-section CSV detection
- Automatic section selector dialog
- Smart Import toggle (enabled by default)
- Integration with sanitization services

**New State Variables**:
```typescript
const [multiSections, setMultiSections] = useState<any[]>([]);
const [selectedSectionIndex, setSelectedSectionIndex] = useState<number>(0);
const [showSectionSelector, setShowSectionSelector] = useState(false);
```

**New Dialog**:
The wizard now shows a section selector when multi-section files are detected. Users can preview each section's:
- Section name
- Row count
- Column headers
- Data type (auto-detected)

---

### AdminLayout.tsx Sidebar Changes
**Changes**:
1. Loans menu moved under "Loan Management"
2. Active state highlighting now supports query parameters
3. Parent menu stays expanded when child items are active

**Active Path Logic**:
```typescript
// Handles both exact paths and query parameters
if (itemPath.includes('?')) {
  isActive = currentPath === itemPath;  // Exact match for query routes
} else {
  isActive = baseCurrentPath === basePath || baseCurrentPath.startsWith(basePath + '/');
}
```

---

## 🐛 Bug Fixes

### 1. React Error #185 - Infinite Loop (FIXED)
**Issue**: App crashed on login with "Maximum update depth exceeded"
**Cause**: `setProfile` in useAuth dependency array
**Fix**: Removed from dependencies, kept only `[initialized, initialize]`

### 2. ProtectedRoute Redirect Fights (FIXED)
**Issue**: Multiple redirects causing race conditions
**Cause**: Checking profile before auth fully initialized
**Fix**: Added proper loading state checks and role-based logic

### 3. Sidebar Active State (FIXED)
**Issue**: Sub-items didn't highlight when clicked
**Cause**: Query parameters not handled in path matching
**Fix**: Split path from query params before comparison

---

## 📊 Data Types

### CSVSection
```typescript
interface CSVSection {
  name: string;              // "BORROWERS", "LOANS", etc.
  headers: string[];         // CSV column headers
  rows: string[][];          // Parsed data rows
  startLine: number;         // First line of section
  endLine: number;           // Last line of section
  rowCount: number;          // Number of data rows
}
```

### RowSanitizationResult
```typescript
interface RowSanitizationResult {
  rowIndex: number;          // Original row number
  originalData: Record<string, string>;  // Before sanitization
  cleanedData: Record<string, string>;   // After sanitization
  issues: Array<{            // What was fixed
    field: string;
    originalValue: string;
    cleanedValue: string;
    issue: string;
  }>;
  isValid: boolean;          // Passed validation
  errors: string[];          // Reasons row failed (if any)
}
```

---

## 🚀 Usage Workflow

### Scenario: Import Nenji-export.csv

1. **User uploads file**
   ```
   File: nenji_export.csv
   Content:
   === BORROWERS ===
   Name,Phone,Email
   John,0971234567,john@email.com
   
   === LOANS ===
   LoanID,Amount,Rate
   123,5000,15%
   ```

2. **System detects sections**
   - `splitMultiSectionCSV()` finds 2 sections

3. **Shows section picker**
   - Dialog: "Select Data Section to Import"
   - User selects "BORROWERS - 1 row"

4. **Processes selected section**
   - Extracts BORROWERS section
   - Converts back to CSV format
   - Parses headers and data

5. **Sanitizes data** (if Smart Import enabled)
   - Normalizes phone: `0971234567` → `+260971234567`
   - Cleans email, address, etc.
   - Validates required fields

6. **Shows import summary**
   - "Imported 1 row successfully"
   - Any errors go to Quarantine

---

## ⚙️ Configuration

### Smart Import Toggle
**Default**: Enabled (`setUseSmartImport(true)`)
**In Wizard**: Toggle available in Import step
**Effect**: 
- ON: Enables multi-section detection and data sanitization
- OFF: Basic CSV import (no sanitization)

### Phone Number Normalization
**Input Formats Supported**:
- `0971234567` (Zambian format)
- `+260971234567` (International)
- `260971234567` (Country code prefix)
- `971234567` (No country code)
- `77...` or `09...` (Regional codes)

**Output Format**: `+260XXXXXXXXX` (always)

---

## 🧪 Testing

### Test Multi-Section CSV
Create a test file:
```csv
=== BORROWERS ===
Name,Phone,Email
John Doe,0971234567,john097555123@gmail.com
Jane Smith,0771234567,jane.smith@email.com

=== BRANCHES ===
Branch,Location,Manager
Head Office,Lusaka,Mr. M
```

### Expected Behavior
1. File uploaded → System detects 2 sections
2. Section picker shows both
3. User selects "BORROWERS"
4. Data sanitized:
   - Phones normalized
   - Invalid email fixed
   - Clean data imported

---

## 📝 Notes

- All new services are **fully typed with TypeScript**
- Services are **pure functions** (no side effects)
- **No database modifications** required
- **Backward compatible** with existing imports
- **Zero breaking changes** to existing functionality

---

## 🔗 Related Files

- `src/features/admin/pages/DataManagementPage.tsx` - Uses BulkImportWizard
- `src/features/admin/components/QuarantineReviewDialog.tsx` - Shows sanitization issues
- `src/lib/data-import/bulk-import-service.ts` - Executes the actual import
- `src/lib/data-import/smart-import-service.ts` - Coordinates smart import flow
