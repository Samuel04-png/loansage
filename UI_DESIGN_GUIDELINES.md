# UI Design Guidelines - Reference Style Implementation

This document contains the detailed design specifications for the TengaLoans UI overhaul, based on the YowStay reference screenshot and modern SaaS design principles.

## 🎨 1. DESIGN STYLE GUIDELINES (REFERENCE-DRIVEN)

### General Aesthetic

- **Clean, bright white surfaces** with subtle shadows
- **Soft gradients** (blue → purple preferred)
- **High contrast, bold headings**
- **Soft card edges** (rounded-2xl)
- **Micro-interactions**: hover rise, fade, scale, smooth transitions
- **Balanced whitespace** (breathing space everywhere)

### Typography

- **Headings**: Semi-bold, modern, spacious
- **Body**: 15–16px, grey-600
- **Accent color**: #006BFF – #4B4BFF gradient style
- Use Tailwind font utilities consistently

### Color Palette

```css
Primary: #006BFF
Primary Light: #3B82FF
Accent Gradient: linear-gradient(#006BFF → #4F46E5)
Neutral 900: #0E0E0F
Neutral 700: #4B5563
Neutral 500: #6B7280
Neutral 300: #D1D5DB
Background: #F8FAFC
Card BG: #FFFFFF
Success: #22C55E
Warning: #FACC15
Error: #EF4444
```

## 🧩 2. COMPONENTS (SHADCN-BASED)

Use ShadCN components but redesign them visually with:

- **Smoother radius**: `rounded-2xl` (16px)
- **Lighter borders**: `border-neutral-200`
- **Soft shadows**: `shadow-[0_8px_30px_rgb(0,0,0,0.06)]`
- **Better spacing**: `p-6`, `gap-6`
- **Gradient buttons** for primary actions
- **Ghost buttons** for secondary actions
- **Animated dropdowns and drawers**
- **Responsive stacking** (mobile → column)

## 📱 3. RESPONSIVE LAYOUT RULES

Every page must:

- Use **max-width containers** with centered layout
- Use **12-column grid logic**
- **Collapse gracefully** to single-column on mobile
- **Reflow hero section** with centered text on small screens
- Make **cards stack vertically** at <900px
- Make **charts scroll horizontally** if needed
- Keep **form fields full width** (`w-full`)

## ✨ 4. MICRO-INTERACTIONS

Every interactive element must include:

- **Hover**: `scale-[1.02]`
- **Smooth transitions**: `transition-all duration-300`
- **Card hover "lift"**: Enhanced shadow on hover
- **Animated tab switch**: Smooth fade/slide
- **Buttons**: Ripple or subtle glow effect
- **Modal**: Fade + scale animation
- **Toasts**: Cleaner and more premium styling

## 📄 5. PAGES TO REDESIGN

### 🔹 Landing Page (Marketing site)

- Hero with large bold headline
- Subheading paragraph
- Two CTA buttons (primary + secondary)
- Dashboard mockup preview
- Benefits row
- Feature sections with icons
- Pricing table with highlight plan
- FAQ section
- Footer with links

### 🔹 Dashboard

- Clean left sidebar
- Fluid grid with metric cards
- Charts styled similar to reference
- Smooth loading states
- Animated skeleton loaders
- Subtle shadows + glass effect for cards

### 🔹 Loan Management Pages

- Customer list redesigned
- Loan detail panels modernized
- Better spacing + card layout
- Timeline/history component

### 🔹 Settings Page

- Located under top-right gear icon
- Sections: profile, security, company, data management
- Modern form UI
- Clean two-column layout

### 🔹 Authentication (Login / Signup)

- Full center layout
- Logo displayed correctly (not squished)
- Clean card with soft shadows
- Social login buttons (optional)

## 🔔 6. Additional UI Features Required

### Notification Badge System

Alerts for:
- Near-due loans
- Defaults
- Overdue

### Data Optimization

- Realtime dashboard metrics fixed
- Data loading optimized
- Loan history must pull correct linked records

## 🛠️ 7. SHADCN + TAILWIND IMPLEMENTATION RULES

- Use **ShadCN components everywhere** (dropdowns, tables, sheets, dialogs, inputs, cards)
- Use **Server Components + Client Components** where appropriate
- Use **Zustand or Context** for UI state
- Use **class-variance-authority** for component styling
- Use **Lucide icons** exclusively
- All components **reusable and isolated** in `/components/ui/*`

## 📐 8. OUTPUT EXPECTATIONS

When working on any file:

- ✅ Improve layout spacing
- ✅ Clean code structure
- ✅ Remove unused imports
- ✅ Add meaningful comments
- ✅ Follow the design system
- ✅ Ensure fast load + no layout shift
- ✅ Keep code accessible (ARIA attributes)
- ✅ Always rewrite the UI to match the reference screenshot's modern, world-class aesthetic

## 🎯 Implementation Checklist

### Phase 1: Design System ✅
- [x] Create components.json
- [x] Update CSS variables with reference colors
- [x] Update Tailwind config with design tokens
- [x] Install missing ShadCN components (form, tabs, sheet, dropdown-menu, avatar, table, skeleton)
- [x] Create typography utility classes

### Phase 2: Layout Components ✅
- [x] Upgrade AdminLayout with reference style
- [x] Upgrade EmployeeLayout with reference style
- [x] Upgrade CustomerLayout with reference style
- [x] Add Sheet component for mobile sidebar
- [x] Add DropdownMenu for user menu
- [x] Add Avatar component

### Phase 3: Dashboard ✅
- [x] Redesign stat cards with floating effect
- [x] Add animated number counters
- [x] Style charts to match reference
- [x] Add skeleton loaders
- [x] Improve spacing and grid layout

### Phase 4: Forms 🔄
- [ ] Convert all forms to ShadCN Form component
- [x] Add validation states (in SettingsPage)
- [x] Add success animations
- [x] Improve spacing and layout
- [ ] Add stepper UI for multi-step forms

### Phase 5: Tables ✅
- [x] Replace all tables with ShadCN Table (Customers, Loans, Employees pages)
- [x] Add row actions dropdown
- [x] Add loading states
- [ ] Add sorting and filtering (enhancement)
- [ ] Add pagination (enhancement)

### Phase 6: Pages ✅
- [ ] Landing page redesign (if exists)
- [x] All list pages (Customers, Loans, Employees)
- [ ] Detail pages (Loan, Customer, Employee) - needs upgrade
- [x] Settings page
- [x] Authentication pages (Login)

### Phase 7: Micro-interactions ✅
- [x] Card hover effects
- [x] Button animations
- [x] Page transitions (framer-motion)
- [x] Loading states (skeleton loaders)
- [x] Empty states

### Phase 8: Responsive 🔄
- [x] Mobile optimization (Sheet sidebar, responsive grids)
- [x] Tablet optimization
- [x] Desktop & 4K optimization (container classes)
- [ ] Final responsive testing

### Phase 9: Visual Polish ✅
- [x] Spacing consistency (generous padding, gap-6)
- [x] Typography refinement (font-semibold, proper sizes)
- [x] Color system consistency (#006BFF primary)
- [x] Icon consistency (Lucide icons)

### Phase 10: Accessibility & Performance 🔄
- [x] Keyboard navigation (focus states)
- [ ] WCAG AA compliance (needs audit)
- [ ] Performance optimization
- [ ] Code splitting

