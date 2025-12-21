# Dynamic Loan Type System - How It Works

## 🏗️ System Architecture Overview

The loan type system is a **fully dynamic, agency-configurable** system that allows each microfinance agency to:
- Choose which loan types they offer
- Configure rules per loan type
- Have the UI and validation adapt automatically
- Get AI-powered analysis based on loan type

---

## 📊 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENCY ONBOARDING                         │
│  User selects loan types → Initialize config in Firestore    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              FIRESTORE: agencies/{id}/config/loanTypes       │
│  Stores: { loanTypes: { [typeId]: LoanTypeConfig } }        │
│  - Which types are enabled                                   │
│  - Per-type settings (amounts, rates, durations)             │
│  - Validation rules                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   SETTINGS   │ │   LOAN       │ │      AI      │
│     PAGE     │ │ ORIGINATION  │ │   SERVICE    │
│              │ │     PAGE     │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## 🔄 Step-by-Step Flow

### 1. **Agency Onboarding** (`CreateOrganizationPage.tsx`)

**What happens:**
- User creates agency → Step 1: Basic info
- Step 2: Select loan types from available templates
- System calls `initializeAgencyLoanConfig(agencyId, selectedTypes)`

**Code flow:**
```typescript
// User selects: ['collateral_based', 'salary_based', 'personal_unsecured']
await initializeAgencyLoanConfig(agencyId, selectedTypes);

// Creates Firestore document:
// agencies/{agencyId}/config/loanTypes
{
  agencyId: "...",
  loanTypes: {
    collateral_based: { enabled: true, ...config },
    salary_based: { enabled: true, ...config },
    personal_unsecured: { enabled: true, ...config }
  },
  globalDefaults: { ... }
}
```

**Key Point:** Only selected types are initialized as enabled.

---

### 2. **Settings Page - Loan Types Management** (`LoanTypeSettings.tsx`)

**Location:** Settings → Loan Settings → Loan Types Configuration

**What it does:**
- Shows enabled loan types (up to 3)
- Shows available loan types (can be enabled)
- Allows editing per-type configuration
- Enforces 3-loan-type limit

**How the 3-loan-type limit works:**

```typescript
// Before enabling, check current count
const enabledCount = Object.values(loanConfig.loanTypes)
  .filter(lt => lt.enabled).length;

if (enabledCount >= 3) {
  throw new Error('Maximum of 3 loan types can be enabled');
}

// Only then enable the new type
await toggleLoanType(agencyId, loanTypeId, true);
```

**UI Updates:**
```typescript
// When loan type is toggled:
onSuccess: () => {
  // Invalidate queries → Triggers re-fetch
  queryClient.invalidateQueries({ queryKey: ['loanConfig', agencyId] });
  queryClient.invalidateQueries({ queryKey: ['enabledLoanTypes', agencyId] });
  // UI automatically updates because React Query refetches
}
```

**Why it updates immediately:**
- React Query caches the data
- When we invalidate, it refetches
- Components using `useQuery` automatically re-render with new data
- No page refresh needed!

---

### 3. **Loan Origination Page** (`LoanOriginationPage.tsx`)

**What happens when employee creates a loan:**

#### Step 1: Fetch Enabled Loan Types
```typescript
const { data: enabledLoanTypes } = useQuery({
  queryKey: ['enabledLoanTypes', agency?.id],
  queryFn: () => getEnabledLoanTypes(agency.id),
  // This automatically refetches when query is invalidated in Settings!
});
```

#### Step 2: Display Only Enabled Types
```typescript
// Only shows loan types that are enabled for this agency
{enabledLoanTypes.map((loanTypeConfig) => (
  <LoanTypeCard 
    icon={getLoanTypeIcon(loanTypeConfig.id)}
    name={loanTypeConfig.name}
    // ... displays the type
  />
))}
```

#### Step 3: User Selects Loan Type
```typescript
setLoanType(loanTypeConfig.id);
// This triggers useEffect that updates form defaults
```

#### Step 4: Dynamic Form Defaults
```typescript
useEffect(() => {
  if (currentLoanTypeConfig) {
    // Auto-fill form with loan type's defaults
    loanTermsForm.setValue('interestRate', 
      currentLoanTypeConfig.interestRate.default);
    loanTermsForm.setValue('durationMonths', 
      currentLoanTypeConfig.duration.defaultMonths);
    // ...
  }
}, [loanType]);
```

#### Step 5: Dynamic Validation
```typescript
// When form is submitted:
const validateLoanTerms = (data) => {
  // Check against selected loan type's limits
  if (data.amount < currentLoanTypeConfig.loanAmount.min) {
    toast.error(`Amount must be at least ${min}`);
    return false;
  }
  // ... validates all fields against loan type config
};
```

#### Step 6: Conditional Collateral Step
```typescript
// Skip collateral step if not required
const needsCollateral = 
  currentLoanTypeConfig?.collateralRequirement === 'required' || 
  currentLoanTypeConfig?.collateralRequirement === 'conditional';

const totalSteps = needsCollateral ? 8 : 7; // Dynamic step count
```

---

### 4. **AI Integration** (`aiService.ts`, `risk-scoring.ts`)

**How AI uses loan type:**

```typescript
// When analyzing loan risk:
const prompt = `
  Analyze this loan application:
  Loan Type: ${loanType} (${getLoanTypeCategory(loanType)})
  - Secured loans require collateral analysis
  - Unsecured loans focus on creditworthiness
  - Conditional loans need business verification
  
  Consider loan type-specific risk factors...
`;
```

**Loan Type Categories:**
- **Secured** (collateral_based, asset_financing): Focus on LTV ratios
- **Unsecured** (salary_based, personal_unsecured): Focus on income/credit
- **Conditional** (sme_business, group): Focus on business viability

**AI adjusts analysis based on category!**

---

## 🔐 Data Storage Structure

### Firestore Document Structure:
```
agencies/{agencyId}/config/loanTypes
{
  agencyId: "abc123",
  loanTypes: {
    "collateral_based": {
      id: "collateral_based",
      name: "Collateral-Based Loan",
      enabled: true,
      interestRate: {
        default: 12,
        min: 8,
        max: 24
      },
      loanAmount: {
        min: 10000,
        max: 5000000
      },
      duration: {
        minMonths: 6,
        maxMonths: 120,
        defaultMonths: 24
      },
      collateralRequirement: "required",
      // ... more config
    },
    "salary_based": { ... },
    // Only enabled types are stored
  },
  globalDefaults: { ... },
  version: 1
}
```

---

## 🎯 Key Features Explained

### 1. **3-Loan-Type Limit**

**Why?** 
- Keeps UI manageable
- Focuses agency on core products
- Reduces complexity

**How it's enforced:**
```typescript
// Backend validation (in toggleLoanType)
if (enabled && enabledCount >= 3) {
  throw new Error('Maximum 3 types');
}

// Frontend validation (before API call)
if (!canEnableMore) {
  toast.error('Disable one first');
  return;
}
```

**UI Feedback:**
- Badge shows "2/3 Enabled"
- Warning banner when at limit
- Disable button disabled when at limit
- Clear error messages

---

### 2. **Immediate UI Updates**

**React Query Pattern:**
```typescript
// Component A (Settings) - Updates data
toggleMutation.onSuccess(() => {
  queryClient.invalidateQueries(['enabledLoanTypes', agencyId]);
  // ↑ This tells React Query: "This data is stale, refetch it"
});

// Component B (Loan Origination) - Automatically updates
const { data } = useQuery({
  queryKey: ['enabledLoanTypes', agencyId],
  // ↑ Same key! When invalidated, this refetches automatically
});
```

**Result:** Both components stay in sync without manual refresh!

---

### 3. **Dynamic Validation**

**Traditional approach:**
```typescript
// Hardcoded validation
amount: z.number().min(100).max(1000000)
```

**Our approach:**
```typescript
// Validation based on selected loan type
const validateLoanTerms = (data) => {
  const config = currentLoanTypeConfig; // From selected type
  
  if (data.amount < config.loanAmount.min) {
    // Error with specific limit from config
  }
  // ... validates all fields dynamically
};
```

**Benefits:**
- Different limits per loan type
- Requirements banner shows limits
- Real-time feedback
- No hardcoding

---

### 4. **Icon System**

**Icon Mapping:**
```typescript
// src/lib/loan-type-icons.ts
export const LOAN_TYPE_ICONS = {
  collateral_based: ShieldAlert,
  salary_based: Wallet,
  sme_business: Briefcase,
  // ... maps each type to Lucide icon
};

// Usage:
const Icon = getLoanTypeIcon(loanTypeId);
<Icon className="w-8 h-8" />
```

**Why this works:**
- Consistent icons across app
- Easy to add new types
- Type-safe (TypeScript ensures all types have icons)

---

## 🔄 Complete User Journey Example

### Scenario: Agency wants to add "Education Loan"

1. **Admin goes to Settings → Loan Settings**
   - Sees "Loan Types Configuration" section
   - Clicks "Available" tab
   - Sees "Education Loan" card

2. **Admin clicks "Enable"**
   - System checks: Currently 2/3 enabled ✓
   - Creates/updates config in Firestore
   - Invalidates queries
   - UI updates: Education Loan moves to "Enabled" tab

3. **Employee goes to create loan**
   - Loan Origination page loads
   - Fetches enabled loan types (now includes Education)
   - Sees Education Loan card with icon
   - Selects it

4. **Form adapts:**
   - Defaults: Interest 12%, Duration 24 months
   - Validation: Amount 2,000 - 500,000 ZMW
   - No collateral step (unsecured)
   - Requirements banner shows limits

5. **AI Analysis:**
   - Includes "Loan Type: Education (Unsecured)"
   - Focuses on creditworthiness (not collateral)
   - Provides type-specific recommendations

6. **Loan created:**
   - Stored with `loan_type: 'education'`
   - All future processing uses this type

---

## 🛡️ Security & Validation

### Firestore Security Rules:
```javascript
match /agencies/{agencyId}/config/{configId} {
  allow read: if belongsToAgency(agencyId);
  allow create/update: if isAdmin() && belongsToAgency(agencyId);
  // Only admins can modify loan type config
}
```

### Backend Validation:
- 3-loan-type limit enforced server-side
- Config structure validated
- Type safety with TypeScript

---

## 🎨 UI/UX Features

### Visual Feedback:
- ✅ Icons for each loan type
- ✅ Color-coded badges (Enabled/Disabled, Secured/Unsecured)
- ✅ Animated transitions
- ✅ Loading states
- ✅ Error messages
- ✅ Success toasts

### Responsive Design:
- Works on mobile/tablet/desktop
- Grid layouts adapt
- Touch-friendly buttons

---

## 📈 Benefits of This System

1. **Scalability:** Easy to add new loan types (just add to templates)
2. **Flexibility:** Each agency customizes their offering
3. **Maintainability:** Configuration-driven, not hardcoded
4. **User Experience:** UI adapts automatically
5. **AI Integration:** Better risk assessment with loan type context
6. **Validation:** Dynamic rules per loan type
7. **Real-time Updates:** Changes reflect immediately

---

## 🔧 Technical Stack

- **Frontend:** React + TypeScript
- **State Management:** React Query (TanStack Query)
- **Forms:** React Hook Form + Zod
- **Database:** Firebase Firestore
- **Icons:** Lucide React
- **Animations:** Framer Motion
- **Validation:** Zod schemas

---

## 🚀 Future Enhancements (Optional)

- Per-loan-type dashboards
- Advanced risk rules per type
- Custom fields per loan type
- Loan type-specific workflows
- Analytics per loan type

---

This system is **fully functional** and **production-ready**! 🎉

