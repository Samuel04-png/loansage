# LoanSage Codebase Inventory

## Complete Page & Component Analysis

### 📋 Table of Contents
1. [Public Pages](#public-pages)
2. [Authentication Pages](#authentication-pages)
3. [Admin Pages](#admin-pages)
4. [Employee Pages](#employee-pages)
5. [Customer Pages](#customer-pages)
6. [Shared Pages](#shared-pages)
7. [Error Pages](#error-pages)
8. [Layout Components](#layout-components)
9. [Reusable Components](#reusable-components)
10. [UI Components](#ui-components)

---

## Public Pages

### 1. LandingPage (`src/features/public/pages/LandingPage.tsx`)
**Purpose**: Marketing homepage
**Components Used**:
- Card, Button, Badge
- Framer Motion animations
- Hero section, features, testimonials, CTA

### 2. AboutPage (`src/features/public/pages/AboutPage.tsx`)
**Purpose**: About the company
**Components Used**:
- Card, Button
- Content sections

### 3. ContactPage (`src/features/public/pages/ContactPage.tsx`)
**Purpose**: Contact form
**Components Used**:
- Card, Button, Input, Label
- react-hook-form + zod
- Form validation

### 4. PrivacyPage (`src/features/public/pages/PrivacyPage.tsx`)
**Purpose**: Privacy policy
**Components Used**:
- Content display

### 5. TermsPage (`src/features/public/pages/TermsPage.tsx`)
**Purpose**: Terms of service
**Components Used**:
- Content display

---

## Authentication Pages

### 6. LoginPage (`src/features/auth/pages/LoginPage.tsx`)
**Purpose**: User login
**Components Used**:
- Card, CardHeader, CardTitle, CardContent, CardDescription
- Button, Input, Label
- react-hook-form + zod
- Framer Motion animations
- Eye/EyeOff icons for password toggle

### 7. SignUpPage (`src/features/auth/pages/SignUpPage.tsx`)
**Purpose**: User registration
**Components Used**:
- Card, Button, Input, Label
- react-hook-form + zod
- Role selection (admin/employee)
- Password confirmation
- Framer Motion animations

### 8. ForgotPasswordPage (`src/features/auth/pages/ForgotPasswordPage.tsx`)
**Purpose**: Password reset request
**Components Used**:
- Card, Button, Input, Label
- Form validation

### 9. ResetPasswordPage (`src/features/auth/pages/ResetPasswordPage.tsx`)
**Purpose**: Password reset form
**Components Used**:
- Card, Button, Input, Label
- Form validation

### 10. VerifyEmailPage (`src/features/auth/pages/VerifyEmailPage.tsx`)
**Purpose**: Email verification
**Components Used**:
- Card, Button
- Status display

### 11. CreateOrganizationPage (`src/features/auth/pages/CreateOrganizationPage.tsx`)
**Purpose**: Agency/organization creation
**Components Used**:
- Card, Button, Input, Label
- react-hook-form + zod
- Multi-step form
- Logo upload

### 12. AcceptInvitePage (`src/features/invitations/pages/AcceptInvitePage.tsx`)
**Purpose**: Accept employee/customer invitation
**Components Used**:
- Card, Button, Input, Label
- Form validation

---

## Admin Pages

### 13. AdminDashboard (`src/features/admin/pages/DashboardPage.tsx`)
**Purpose**: Admin overview with stats and charts
**Components Used**:
- Card, CardContent, CardHeader, CardTitle
- Button, Badge
- StatCard component (custom)
- Recharts (BarChart, PieChart)
- InviteEmployeeDrawer, AddCustomerDrawer, NewLoanDrawer
- Real-time stats subscription
- Quick actions section

**Features**:
- Total Active Loans
- Disbursed This Month
- Repayments Due
- Active Customers
- Employees count
- Approval Rate
- Overdue Loans
- Disbursement chart (6 months)
- Loan status distribution (pie chart)
- Top performing officers table

### 14. CustomersPage (`src/features/admin/pages/CustomersPage.tsx`)
**Purpose**: Customer list and management
**Components Used**:
- Card, CardContent, CardHeader, CardTitle
- Button, Input, Badge
- AddCustomerDrawer
- Search functionality
- Export/Import CSV
- Table view with customer cards
- Link to customer details

**Features**:
- Search by name, ID, NRC
- Customer cards with key info
- Export customers
- Import from CSV
- Add new customer button

### 15. CustomerDetailPage (`src/features/admin/pages/CustomerDetailPage.tsx`)
**Purpose**: Individual customer details
**Components Used**:
- Card, CardContent, CardHeader, CardTitle
- Button, Badge
- Loan history table
- Customer information display
- Document display

**Features**:
- Customer profile info
- Employment details
- Guarantor information
- Loan history
- Documents
- Edit customer

### 16. LoansPage (`src/features/admin/pages/LoansPage.tsx`)
**Purpose**: Loan portfolio management
**Components Used**:
- Card, CardContent, CardHeader, CardTitle
- Button, Input, Badge
- NewLoanDrawer
- LoanStatusDialog
- Search and filter
- Table view
- Export functionality

**Features**:
- Search loans
- Status filter (all, active, pending, etc.)
- Loan table with customer info
- Status badges
- Quick actions (edit status)
- Export loans
- Link to loan details

### 17. LoanDetailPage (`src/features/admin/pages/LoanDetailPage.tsx`)
**Purpose**: Individual loan details
**Components Used**:
- Card, CardContent, CardHeader, CardTitle
- Button, Badge
- Repayment schedule table
- Loan information display
- Transaction history
- Collateral display

**Features**:
- Loan details
- Customer info
- Repayment schedule
- Payment history
- Collateral information
- Status management
- Record payment

### 18. EmployeesPage (`src/features/admin/pages/EmployeesPage.tsx`)
**Purpose**: Employee management
**Components Used**:
- Card, CardContent, CardHeader, CardTitle
- Button, Input, Badge
- InviteEmployeeDrawer
- Search functionality
- Export/Import CSV
- Table view

**Features**:
- Employee list
- Search employees
- Invite new employee
- Export employees
- Import from CSV
- Employee cards/table
- Link to employee details

### 19. EmployeeDetailPage (`src/features/admin/pages/EmployeeDetailPage.tsx`)
**Purpose**: Individual employee details
**Components Used**:
- Card, CardContent, CardHeader, CardTitle
- Button, Badge
- Employee information display
- Assigned loans/customers

**Features**:
- Employee profile
- Role and category
- Assigned loans
- Assigned customers
- Performance metrics

### 20. CollateralsPage (`src/features/admin/pages/CollateralsPage.tsx`)
**Purpose**: Collateral management
**Components Used**:
- Card, Button, Badge
- Search and filter
- Table/card view

**Features**:
- Collateral list
- Search collaterals
- Filter by status
- Collateral details

### 21. CollateralDetailPage (`src/features/admin/pages/CollateralDetailPage.tsx`)
**Purpose**: Individual collateral details
**Components Used**:
- Card, CardContent, CardHeader, CardTitle
- Button, Badge
- Collateral information
- Valuation display

**Features**:
- Collateral details
- Valuation information
- Related loan
- Documents

### 22. AccountingPage (`src/features/admin/pages/AccountingPage.tsx`)
**Purpose**: Financial accounting and reports
**Components Used**:
- Card, CardContent, CardHeader, CardTitle
- Button, Input
- Charts (Recharts)
- Tables

**Features**:
- Financial overview
- Revenue tracking
- Expense tracking
- Reports
- Bank reconciliation

### 23. ReportsPage (`src/features/admin/pages/ReportsPage.tsx`)
**Purpose**: Generate and view reports
**Components Used**:
- Card, Button
- Report cards
- Export functionality

**Features**:
- Report generation
- Report history
- Export reports (PDF/CSV)
- Custom date ranges

### 24. ActivityLogsPage (`src/features/admin/pages/ActivityLogsPage.tsx`)
**Purpose**: Audit log viewer
**Components Used**:
- Card, CardContent, CardHeader, CardTitle
- Input (search)
- Table view
- Badge

**Features**:
- Activity log list
- Search logs
- Filter by action type
- User activity tracking
- Timestamp display

### 25. InvitationsPage (`src/features/admin/pages/InvitationsPage.tsx`)
**Purpose**: Manage employee/customer invitations
**Components Used**:
- Card, Button, Badge
- InviteEmployeeDrawer
- Table view

**Features**:
- Invitation list
- Send invitations
- View invitation status
- Resend invitations

### 26. SettingsPage (`src/features/admin/pages/SettingsPage.tsx`)
**Purpose**: Agency and account settings
**Components Used**:
- Card, CardContent, CardHeader, CardTitle, CardDescription
- Button, Input, Label
- Badge
- react-hook-form + zod
- Tab interface (custom)
- InviteEmployeeDrawer, AddCustomerDrawer
- File upload (logo)

**Features**:
- Agency settings (name, email, phone, address, logo)
- Employee management tab
- Account settings (profile, password)
- Data management (export/import)
- White-label settings

### 27. DataManagementPage (`src/features/admin/pages/DataManagementPage.tsx`)
**Purpose**: Data export/import
**Components Used**:
- Card, Button
- File upload
- Export functionality

**Features**:
- Export data (customers, loans, employees)
- Import data from CSV
- Data backup/restore

---

## Employee Pages

### 28. EmployeeDashboard (`src/features/employee/pages/DashboardPage.tsx`)
**Purpose**: Employee overview
**Components Used**:
- Card, CardContent, CardHeader, CardTitle
- Badge, Button
- Stat cards
- Recent loans list

**Features**:
- Total loans
- Active loans
- Pending loans
- Approved loans
- Total customers
- Pending approvals
- Overdue count
- Portfolio value
- Recent loans

### 29. EmployeeCustomersPage (`src/features/employee/pages/CustomersPage.tsx`)
**Purpose**: Employee's assigned customers
**Components Used**:
- Card, Button, Input, Badge
- Search functionality
- Customer cards/table

**Features**:
- Assigned customers list
- Search customers
- Customer details
- Link to customer profile

### 30. EmployeeLoansPage (`src/features/employee/pages/LoansPage.tsx`)
**Purpose**: Employee's assigned loans
**Components Used**:
- Card, Button, Input, Badge
- Search and filter
- Loan table/cards

**Features**:
- Assigned loans list
- Search loans
- Status filter
- Loan details

### 31. LoanOriginationPage (`src/features/employee/pages/LoanOriginationPage.tsx`)
**Purpose**: Create new loan (multi-step wizard)
**Components Used**:
- Card, CardContent, CardHeader, CardTitle
- Button, Input, Label, Badge
- react-hook-form + zod
- Multi-step form
- File upload
- AI risk analysis component

**Features**:
- Step 1: Borrower lookup/create
- Step 2: KYC verification
- Step 3: Loan type selection
- Step 4: Loan terms
- Step 5: Collateral
- Step 6: Documents
- Step 7: AI risk assessment
- Step 8: Preview and submit

### 32. UnderwriterPage (`src/features/employee/pages/UnderwriterPage.tsx`)
**Purpose**: AI underwriting assistant
**Components Used**:
- Card, Button
- AI risk analysis
- Loan review interface

**Features**:
- Loan review queue
- AI risk assessment
- Approval/rejection
- Risk scoring

### 33. CollectionsPage (`src/features/employee/pages/CollectionsPage.tsx`)
**Purpose**: Collections management
**Components Used**:
- Card, Button, Badge
- Payment recording
- Collections list

**Features**:
- Collections queue
- Payment recording
- Overdue tracking
- Customer contact

### 34. OverduePage (`src/features/employee/pages/OverduePage.tsx`)
**Purpose**: Overdue loans management
**Components Used**:
- Card, Button, Badge
- Overdue loans list
- Alert indicators

**Features**:
- Overdue loans list
- Days overdue
- Contact customer
- Payment recording

### 35. PendingApprovalsPage (`src/features/employee/pages/PendingApprovalsPage.tsx`)
**Purpose**: Loans pending approval
**Components Used**:
- Card, Button, Badge
- Approval queue
- Review interface

**Features**:
- Pending loans list
- Review loan details
- Approve/reject actions
- Comments/notes

---

## Customer Pages

### 36. CustomerDashboard (`src/features/customer/pages/DashboardPage.tsx`)
**Purpose**: Customer overview
**Components Used**:
- Card, CardContent, CardHeader, CardTitle
- Badge, Button
- Stat cards
- Loan summary

**Features**:
- Outstanding balance
- Next payment info
- Active loans count
- Loan history (recent)
- Quick actions

### 37. CustomerLoansPage (`src/features/customer/pages/LoansPage.tsx`)
**Purpose**: Customer's loan list
**Components Used**:
- Card, Button, Badge
- Loan cards/table
- Status display

**Features**:
- All customer loans
- Loan status
- Outstanding amounts
- Link to loan details

### 38. LoanOverviewPage (`src/features/customer/pages/LoanOverviewPage.tsx`)
**Purpose**: Individual loan details for customer
**Components Used**:
- Card, CardContent, CardHeader, CardTitle
- Button, Badge
- Repayment schedule table
- LoanCalculator component

**Features**:
- Loan details
- Repayment summary
- Full amortization schedule
- Download schedule (PDF)
- Payment history

### 39. PaymentsPage (`src/features/customer/pages/PaymentsPage.tsx`)
**Purpose**: Payment history and processing
**Components Used**:
- Card, Button, Badge
- Payment history table
- Payment form

**Features**:
- Payment history
- Upcoming payments
- Make payment (UI)
- Payment receipts

### 40. DocumentsPage (`src/features/customer/pages/DocumentsPage.tsx`)
**Purpose**: Document management
**Components Used**:
- Card, Button
- Document list
- File upload

**Features**:
- View documents
- Upload documents
- Download documents
- Document categories

### 41. NotificationsPage (`src/features/customer/pages/NotificationsPage.tsx`)
**Purpose**: Customer notifications
**Components Used**:
- Card, Button, Badge
- Notification list
- Mark as read

**Features**:
- Notification list
- Filter by type
- Mark as read/unread
- Real-time updates

### 42. CustomerSettingsPage (`src/features/customer/pages/SettingsPage.tsx`)
**Purpose**: Customer account settings
**Components Used**:
- Card, Button, Input, Label
- react-hook-form + zod
- Profile form
- Password form

**Features**:
- Profile update
- Password change
- Notification preferences

---

## Shared Pages

### 43. MessagesPage (`src/features/messaging/pages/MessagesPage.tsx`)
**Purpose**: Internal messaging
**Components Used**:
- Card, Button, Input
- Chat interface
- Message list

**Features**:
- Message threads
- Send messages
- File attachments
- Read receipts

### 44. TasksPage (`src/features/tasks/pages/TasksPage.tsx`)
**Purpose**: Task management
**Components Used**:
- Card, Button, Badge
- Task list
- Task form

**Features**:
- Task list
- Create tasks
- Assign tasks
- Task status tracking

### 45. CalendarPage (`src/features/shared/pages/CalendarPage.tsx`)
**Purpose**: Calendar view
**Components Used**:
- Card, Button
- Calendar component

**Features**:
- Calendar view
- Events/appointments
- Due dates
- Schedule management

### 46. FileManagerPage (`src/features/shared/pages/FileManagerPage.tsx`)
**Purpose**: File management
**Components Used**:
- Card, Button
- File list
- File upload

**Features**:
- File browser
- Upload files
- Download files
- File organization

### 47. SupportTicketsPage (`src/features/shared/pages/SupportTicketsPage.tsx`)
**Purpose**: Support ticket system
**Components Used**:
- Card, CardContent, CardHeader, CardTitle
- Button, Input, Label, Badge
- react-hook-form + zod
- Ticket list
- Ticket form

**Features**:
- Create tickets
- Ticket list
- Ticket status
- Priority levels
- Ticket details

---

## Error Pages

### 48. NotFoundPage (`src/pages/NotFoundPage.tsx`)
**Purpose**: 404 error page
**Components Used**:
- Card, Button
- Error message

### 49. ErrorPage (`src/pages/ErrorPage.tsx`)
**Purpose**: 500 error page
**Components Used**:
- Card, Button
- Error message

### 50. UnauthorizedPage (`src/pages/UnauthorizedPage.tsx`)
**Purpose**: 403 unauthorized page
**Components Used**:
- Card, Button
- Error message

---

## Layout Components

### 51. AdminLayout (`src/features/admin/components/AdminLayout.tsx`)
**Purpose**: Admin portal layout
**Components Used**:
- Sidebar navigation
- Header with search, notifications, settings
- Mobile menu
- User profile section
- NotificationDropdown

**Navigation Items**:
- Dashboard
- Employees
- Customers
- Loan Portfolio
- Collaterals
- Accounting
- Data Management
- Reports
- Activity Logs
- Settings

### 52. EmployeeLayout (`src/features/employee/components/EmployeeLayout.tsx`)
**Purpose**: Employee portal layout
**Components Used**:
- Sidebar navigation
- Header
- Mobile menu
- Role-specific navigation

**Navigation Items** (varies by category):
- Dashboard
- My Customers
- My Loans
- Originate Loan (loan officers)
- Collections (collections officers)
- Overdue (collections officers)
- AI Assistant (underwriters)
- Pending Approvals (underwriters)
- Tasks
- Calendar
- Files
- Support

### 53. CustomerLayout (`src/features/customer/components/CustomerLayout.tsx`)
**Purpose**: Customer portal layout
**Components Used**:
- Sidebar navigation
- Header
- Mobile menu

**Navigation Items**:
- Dashboard
- My Loans
- Payments
- Documents
- Messages
- Support
- Settings

---

## Reusable Components

### 54. AddCustomerDrawer (`src/features/admin/components/AddCustomerDrawer.tsx`)
**Purpose**: Add/edit customer form
**Components Used**:
- Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter
- Button, Input, Label, Textarea
- react-hook-form + zod
- File upload (photo, ID documents)
- NRCLookupDialog
- Collateral creation

**Fields**:
- Basic info (name, phone, email, NRC, address)
- Employment details
- Guarantor information
- Profile photo
- ID documents (front/back)
- Collateral details

### 55. NewLoanDrawer (`src/features/admin/components/NewLoanDrawer.tsx`)
**Purpose**: Create new loan
**Components Used**:
- Drawer components
- Button, Input, Label, Select
- react-hook-form + zod
- Multi-step form
- Customer selection
- Loan calculator

**Fields**:
- Customer selection
- Loan amount
- Interest rate
- Term
- Loan type
- Disbursement date
- Repayment schedule

### 56. InviteEmployeeDrawer (`src/features/admin/components/InviteEmployeeDrawer.tsx`)
**Purpose**: Invite employee
**Components Used**:
- Drawer components
- Button, Input, Label, Select
- react-hook-form + zod

**Fields**:
- Email
- Name
- Role
- Category
- Permissions

### 57. AddCollateralDrawer (`src/features/admin/components/AddCollateralDrawer.tsx`)
**Purpose**: Add collateral to loan
**Components Used**:
- Drawer components
- Button, Input, Label
- File upload
- react-hook-form + zod

### 58. LoanStatusDialog (`src/features/admin/components/LoanStatusDialog.tsx`)
**Purpose**: Change loan status
**Components Used**:
- Dialog components
- Button, Select
- Form validation

### 59. NotificationDropdown (`src/components/NotificationDropdown.tsx`)
**Purpose**: Notification bell dropdown
**Components Used**:
- Dropdown menu
- Badge (unread count)
- Notification list
- Real-time updates

### 60. NRCLookupDialog (`src/components/nrc/NRCLookupDialog.tsx`)
**Purpose**: NRC risk analysis
**Components Used**:
- Dialog components
- Button, Input
- AI risk analysis display
- Risk score
- Recommendations

### 61. LoanCalculator (`src/components/loan/LoanCalculator.tsx`)
**Purpose**: Calculate loan payments
**Components Used**:
- Card, Button, Input, Label
- Table (amortization schedule)
- PDF download

---

## UI Components (Shadcn)

### Currently Installed:
- `button.tsx` - Button component
- `card.tsx` - Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- `dialog.tsx` - Dialog components
- `drawer.tsx` - Drawer components
- `input.tsx` - Input component
- `label.tsx` - Label component
- `badge.tsx` - Badge component
- `skeleton.tsx` - Skeleton loader
- `textarea.tsx` - Textarea component
- `select.tsx` - Select component
- `loading.tsx` - Loading spinner

### Missing Components (Need Installation):
- `form.tsx` - Form wrapper for react-hook-form
- `tabs.tsx` - Tab interface
- `sheet.tsx` - Sheet/drawer (alternative to drawer)
- `popover.tsx` - Popover component
- `dropdown-menu.tsx` - Dropdown menu
- `avatar.tsx` - Avatar component
- `table.tsx` - Table components
- `separator.tsx` - Separator line
- `scroll-area.tsx` - Scrollable area
- `tooltip.tsx` - Tooltip component
- `progress.tsx` - Progress bar
- `switch.tsx` - Toggle switch
- `checkbox.tsx` - Checkbox
- `radio-group.tsx` - Radio buttons
- `slider.tsx` - Slider input
- `calendar.tsx` - Date picker
- `command.tsx` - Command palette
- `toast.tsx` - Toast notifications (optional, currently using react-hot-toast)

---

## Component Usage Patterns

### Forms
- **Pattern**: react-hook-form + zod validation
- **UI**: Input, Label, Button, Card
- **Missing**: Shadcn Form component wrapper
- **Pages Using Forms**: Login, SignUp, CreateOrganization, AddCustomer, NewLoan, InviteEmployee, Settings, Contact, SupportTickets, CustomerSettings

### Tables
- **Pattern**: Custom table implementation with Card wrapper
- **Missing**: Shadcn Table component
- **Pages Using Tables**: CustomersPage, LoansPage, EmployeesPage, ActivityLogsPage, LoanDetailPage, CustomerDetailPage, EmployeeDetailPage, Repayment schedules

### Data Display
- **Pattern**: Card components with stat displays
- **Charts**: Recharts (BarChart, PieChart, LineChart)
- **Pages Using Charts**: AdminDashboard, AccountingPage

### Modals/Drawers
- **Pattern**: Drawer component for forms, Dialog for confirmations
- **Components**: AddCustomerDrawer, NewLoanDrawer, InviteEmployeeDrawer, AddCollateralDrawer, LoanStatusDialog, NRCLookupDialog

### Navigation
- **Pattern**: Custom sidebar with Link components
- **Missing**: Sheet component for mobile drawer
- **Layouts**: AdminLayout, EmployeeLayout, CustomerLayout

---

## Summary Statistics

- **Total Pages**: 50
- **Public Pages**: 5
- **Auth Pages**: 7
- **Admin Pages**: 15
- **Employee Pages**: 8
- **Customer Pages**: 7
- **Shared Pages**: 5
- **Error Pages**: 3

- **Layout Components**: 3
- **Reusable Components**: 11
- **Shadcn UI Components Installed**: 11
- **Shadcn UI Components Missing**: 18

---

## UI Upgrade Priorities

### High Priority (Most Visible)
1. **Layouts** (AdminLayout, EmployeeLayout, CustomerLayout)
2. **Dashboards** (Admin, Employee, Customer)
3. **List Pages** (CustomersPage, LoansPage, EmployeesPage)
4. **Forms** (All drawer forms, auth forms)

### Medium Priority
5. **Detail Pages** (LoanDetailPage, CustomerDetailPage, EmployeeDetailPage)
6. **Settings Pages** (SettingsPage, CustomerSettingsPage)
7. **Charts** (Dashboard charts, AccountingPage)

### Low Priority (Still Important)
8. **Shared Pages** (Messages, Tasks, Calendar, FileManager, SupportTickets)
9. **Public Pages** (Landing, About, Contact, Privacy, Terms)
10. **Error Pages** (404, 500, Unauthorized)

