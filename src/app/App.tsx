import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryProvider } from '../components/providers/QueryProvider';
import { AuthProvider } from '../components/providers/AuthProvider';
import { ThemeProvider } from '../components/providers/ThemeProvider';
import { ProtectedRoute } from '../components/guards/ProtectedRoute';
import { RoleGuard } from '../components/guards/RoleGuard';
import { PWAInstallPrompt } from '../components/PWAInstallPrompt';
import { OfflineIndicator } from '../components/offline/OfflineIndicator';
import { useOfflineToast } from '../hooks/useOfflineToast';

// Auth pages
import { LoginPage } from '../features/auth/pages/LoginPage';
import { SignUpPage } from '../features/auth/pages/SignUpPage';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '../features/auth/pages/VerifyEmailPage';
import { CreateOrganizationPage } from '../features/auth/pages/CreateOrganizationPage';
import { AcceptInvitePage } from '../features/invitations/pages/AcceptInvitePage';

// Public pages
import { LandingPage } from '../features/public/pages/LandingPage';
import { AboutPage } from '../features/public/pages/AboutPage';
import { ContactPage } from '../features/public/pages/ContactPage';
import { PrivacyPage } from '../features/public/pages/PrivacyPage';
import { TermsPage } from '../features/public/pages/TermsPage';

// Admin pages
import { AdminLayout } from '../features/admin/components/AdminLayout';
import { AdminDashboard } from '../features/admin/pages/DashboardPage';
import { SettingsPage } from '../features/admin/pages/SettingsPage';
import { InvitationsPage } from '../features/admin/pages/InvitationsPage';
import { EmployeesPage } from '../features/admin/pages/EmployeesPage';
import { CustomersPage } from '../features/admin/pages/CustomersPage';
import { LoansPage } from '../features/admin/pages/LoansPage';
import { ReportsPage } from '../features/admin/pages/ReportsPage';
import { ActivityLogsPage } from '../features/admin/pages/ActivityLogsPage';
import { AccountingPage } from '../features/admin/pages/AccountingPage';
import { EmployeeDetailPage } from '../features/admin/pages/EmployeeDetailPage';
import { CustomerDetailPage } from '../features/admin/pages/CustomerDetailPage';
import { DataManagementPage } from '../features/admin/pages/DataManagementPage';
import { CollateralDetailPage } from '../features/admin/pages/CollateralDetailPage';
import { LoanDetailPage } from '../features/admin/pages/LoanDetailPage';
import { LoanAnalysisPage } from '../features/admin/pages/LoanAnalysisPage';
import { CollateralsPage } from '../features/admin/pages/CollateralsPage';
import { ThemesPage } from '../features/admin/pages/ThemesPage';
import { HotkeysPage } from '../features/admin/pages/HotkeysPage';
import { DownloadAppsPage } from '../features/admin/pages/DownloadAppsPage';
import { ReferralsPage } from '../features/admin/pages/ReferralsPage';
import { PlansPage } from '../features/admin/pages/PlansPage';
import { HelpPage } from '../features/admin/pages/HelpPage';
import { TrashPage } from '../features/admin/pages/TrashPage';
import { NotificationsPage as AdminNotificationsPage } from '../features/admin/pages/NotificationsPage';
import { PendingApprovalsPage as AdminPendingApprovalsPage } from '../features/admin/pages/PendingApprovalsPage';
import { LoanDisbursementPage } from '../features/admin/pages/LoanDisbursementPage';
import { OutstandingBorrowersPage } from '../features/admin/pages/OutstandingBorrowersPage';
import { CRMPage } from '../features/admin/pages/CRMPage';
import { CompliancePage } from '../features/admin/pages/CompliancePage';
import { CurrencySettingsPage } from '../features/admin/pages/CurrencySettingsPage';
import { SecuritySettingsPage } from '../features/admin/pages/SecuritySettingsPage';
import { LoanProductsPage } from '../features/admin/pages/LoanProductsPage';
import { NotificationsPage as NotificationsManagementPage } from '../features/admin/pages/NotificationsPage';
import { MobileMoneyPage } from '../features/admin/pages/MobileMoneyPage';
import { CreditScoringPage } from '../features/admin/pages/CreditScoringPage';
import { AnalyticsPage } from '../features/admin/pages/AnalyticsPage';
import { BranchesPage } from '../features/admin/pages/BranchesPage';
import { CollectionsPage as AdminCollectionsPage } from '../features/admin/pages/CollectionsPage';

// Employee pages
import { EmployeeLayout } from '../features/employee/components/EmployeeLayout';
import { EmployeeDashboard } from '../features/employee/pages/DashboardPage';
import { LoanOriginationPage } from '../features/employee/pages/LoanOriginationPage';
import { UnderwriterPage } from '../features/employee/pages/UnderwriterPage';
import { EmployeeLoansPage } from '../features/employee/pages/LoansPage';
import { EmployeeCustomersPage } from '../features/employee/pages/CustomersPage';
import { CollectionsPage } from '../features/employee/pages/CollectionsPage';
import { OverduePage } from '../features/employee/pages/OverduePage';
import { PendingApprovalsPage } from '../features/employee/pages/PendingApprovalsPage';
import { CollateralPage } from '../features/employee/pages/CollateralPage';
import { LoanDetailPage as EmployeeLoanDetailPage } from '../features/admin/pages/LoanDetailPage';

// Customer pages
import { CustomerLayout } from '../features/customer/components/CustomerLayout';
import { CustomerDashboard } from '../features/customer/pages/DashboardPage';
import { CustomerLoansPage } from '../features/customer/pages/LoansPage';
import { LoanOverviewPage } from '../features/customer/pages/LoanOverviewPage';
import { PaymentsPage } from '../features/customer/pages/PaymentsPage';
import { DocumentsPage } from '../features/customer/pages/DocumentsPage';
import { NotificationsPage } from '../features/customer/pages/NotificationsPage';
import { CustomerSettingsPage } from '../features/customer/pages/SettingsPage';

// Shared features
import { MessagesPage } from '../features/messaging/pages/MessagesPage';
import { TasksPage } from '../features/tasks/pages/TasksPage';
import { CalendarPage } from '../features/shared/pages/CalendarPage';
import { FileManagerPage } from '../features/shared/pages/FileManagerPage';
import { SupportTicketsPage } from '../features/shared/pages/SupportTicketsPage';

// Error pages
import { NotFoundPage } from '../pages/NotFoundPage';
import { ErrorPage } from '../pages/ErrorPage';
import { UnauthorizedPage } from '../pages/UnauthorizedPage';
import { DemoModeBanner } from '../components/DemoModeBanner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Watermark } from '../components/Watermark';


function AppContent() {
  useOfflineToast();
  
  return (
    <>
      <DemoModeBanner />
      <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />

              {/* Auth routes */}
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/signup" element={<SignUpPage />} />
              <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
              <Route
                path="/auth/create-organization"
                element={
                  <ProtectedRoute>
                    <CreateOrganizationPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/auth/accept-invite" element={<AcceptInvitePage />} />

              {/* Admin routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <RoleGuard allowedRoles={['admin']}>
                      <AdminLayout />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              >
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="employees" element={<EmployeesPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="loans" element={<LoansPage />} />
                <Route path="loans/:loanId" element={<LoanDetailPage />} />
                <Route path="loans/:loanId/analysis" element={<LoanAnalysisPage />} />
                <Route path="loans/:loanId/collateral/:collateralId" element={<CollateralDetailPage />} />
                <Route path="collateral/:collateralId" element={<CollateralDetailPage />} />
                <Route path="collaterals" element={<CollateralsPage />} />
                <Route path="accounting" element={<AccountingPage />} />
                <Route path="employees/:employeeId" element={<EmployeeDetailPage />} />
                <Route path="customers/:customerId" element={<CustomerDetailPage />} />
                <Route path="data-management" element={<DataManagementPage />} />
                <Route path="invitations" element={<InvitationsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="activity-logs" element={<ActivityLogsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="themes" element={<ThemesPage />} />
                <Route path="hotkeys" element={<HotkeysPage />} />
                <Route path="download-apps" element={<DownloadAppsPage />} />
                <Route path="referrals" element={<ReferralsPage />} />
                <Route path="plans" element={<PlansPage />} />
                <Route path="help" element={<HelpPage />} />
                <Route path="trash" element={<TrashPage />} />
                <Route path="notifications" element={<AdminNotificationsPage />} />
                <Route path="loans/pending" element={<AdminPendingApprovalsPage />} />
                <Route path="loans/disbursement" element={<LoanDisbursementPage />} />
                <Route path="loans/outstanding" element={<OutstandingBorrowersPage />} />
                <Route path="crm" element={<CRMPage />} />
                <Route path="compliance" element={<CompliancePage />} />
                <Route path="settings/currency" element={<CurrencySettingsPage />} />
                <Route path="settings/security" element={<SecuritySettingsPage />} />
                <Route path="loan-products" element={<LoanProductsPage />} />
                <Route path="notifications-management" element={<NotificationsManagementPage />} />
                <Route path="mobile-money/:loanId" element={<MobileMoneyPage />} />
                <Route path="credit-scoring/:customerId" element={<CreditScoringPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="branches" element={<BranchesPage />} />
                <Route path="collections" element={<AdminCollectionsPage />} />
                <Route index element={<AdminDashboard />} />
              </Route>

              {/* Employee routes */}
              <Route
                path="/employee"
                element={
                  <ProtectedRoute>
                    <RoleGuard allowedRoles={['employee']}>
                      <EmployeeLayout />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              >
                <Route path="dashboard" element={<EmployeeDashboard />} />
                <Route path="customers" element={<EmployeeCustomersPage />} />
                <Route path="loans" element={<EmployeeLoansPage />} />
                <Route path="loans/:loanId" element={<EmployeeLoanDetailPage />} />
                <Route path="loans/create" element={<LoanOriginationPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="files" element={<FileManagerPage />} />
                <Route path="support" element={<SupportTicketsPage />} />
                <Route path="collections" element={<CollectionsPage />} />
                <Route path="overdue" element={<OverduePage />} />
                <Route path="underwriting" element={<UnderwriterPage />} />
                <Route path="loans/pending" element={<PendingApprovalsPage />} />
                <Route path="collateral" element={<CollateralPage />} />
                <Route index element={<EmployeeDashboard />} />
              </Route>

              {/* Customer routes */}
              <Route
                path="/customer"
                element={
                  <ProtectedRoute>
                    <RoleGuard allowedRoles={['customer']}>
                      <CustomerLayout />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              >
                <Route path="dashboard" element={<CustomerDashboard />} />
                <Route path="loans" element={<CustomerLoansPage />} />
                <Route path="loans/:loanId" element={<LoanOverviewPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="messages" element={<MessagesPage />} />
                <Route path="support" element={<SupportTicketsPage />} />
                <Route path="settings" element={<CustomerSettingsPage />} />
                <Route index element={<CustomerDashboard />} />
              </Route>

              {/* Error pages */}
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="/500" element={<ErrorPage />} />

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/404" replace />} />
              </Routes>
              <Toaster position="top-right" />
              <PWAInstallPrompt />
      <OfflineIndicator />
      <Watermark />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <ThemeProvider>
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <AppContent />
            </BrowserRouter>
          </ThemeProvider>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;

