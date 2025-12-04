-- Enable Row Level Security on all tables
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE collateral ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's agency_id
CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS UUID AS $$
    SELECT agency_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
    SELECT role = 'admin' FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get employee_id from user_id
CREATE OR REPLACE FUNCTION get_employee_id()
RETURNS UUID AS $$
    SELECT id FROM employees WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get customer_id from user_id
CREATE OR REPLACE FUNCTION get_customer_id()
RETURNS UUID AS $$
    SELECT id FROM customers WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- AGENCIES POLICIES
-- Users can view their own agency
CREATE POLICY "Users can view own agency"
    ON agencies FOR SELECT
    USING (id = get_user_agency_id());

-- Admins can update their own agency
CREATE POLICY "Admins can update own agency"
    ON agencies FOR UPDATE
    USING (id = get_user_agency_id() AND is_admin());

-- USERS POLICIES
-- Users can view users in their agency
CREATE POLICY "Users can view agency users"
    ON users FOR SELECT
    USING (agency_id = get_user_agency_id());

-- Admins can update users in their agency
CREATE POLICY "Admins can update agency users"
    ON users FOR UPDATE
    USING (agency_id = get_user_agency_id() AND is_admin());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (id = auth.uid());

-- EMPLOYEES POLICIES
-- Users can view employees in their agency
CREATE POLICY "Users can view agency employees"
    ON employees FOR SELECT
    USING (agency_id = get_user_agency_id());

-- Admins can manage employees in their agency
CREATE POLICY "Admins can manage agency employees"
    ON employees FOR ALL
    USING (agency_id = get_user_agency_id() AND is_admin());

-- Employees can view their own record
CREATE POLICY "Employees can view own record"
    ON employees FOR SELECT
    USING (user_id = auth.uid());

-- CUSTOMERS POLICIES
-- Admins can view all customers in their agency
CREATE POLICY "Admins can view all agency customers"
    ON customers FOR SELECT
    USING (agency_id = get_user_agency_id() AND is_admin());

-- Employees can view assigned customers
CREATE POLICY "Employees can view assigned customers"
    ON customers FOR SELECT
    USING (
        agency_id = get_user_agency_id() 
        AND (
            assigned_officer_id = get_employee_id()
            OR get_user_role() = 'admin'
        )
    );

-- Customers can view their own record
CREATE POLICY "Customers can view own record"
    ON customers FOR SELECT
    USING (user_id = auth.uid());

-- Admins and employees can create customers
CREATE POLICY "Admins and employees can create customers"
    ON customers FOR INSERT
    WITH CHECK (
        agency_id = get_user_agency_id() 
        AND get_user_role() IN ('admin', 'employee')
    );

-- Admins and assigned employees can update customers
CREATE POLICY "Admins and assigned employees can update customers"
    ON customers FOR UPDATE
    USING (
        agency_id = get_user_agency_id() 
        AND (
            is_admin() 
            OR assigned_officer_id = get_employee_id()
        )
    );

-- LOANS POLICIES
-- Admins can view all loans in their agency
CREATE POLICY "Admins can view all agency loans"
    ON loans FOR SELECT
    USING (agency_id = get_user_agency_id() AND is_admin());

-- Employees can view loans they created or are assigned to
CREATE POLICY "Employees can view relevant loans"
    ON loans FOR SELECT
    USING (
        agency_id = get_user_agency_id() 
        AND (
            created_by = get_employee_id()
            OR customer_id IN (
                SELECT id FROM customers WHERE assigned_officer_id = get_employee_id()
            )
            OR approved_by = get_employee_id()
        )
    );

-- Customers can view their own loans
CREATE POLICY "Customers can view own loans"
    ON loans FOR SELECT
    USING (customer_id = get_customer_id());

-- Admins and employees can create loans
CREATE POLICY "Admins and employees can create loans"
    ON loans FOR INSERT
    WITH CHECK (
        agency_id = get_user_agency_id() 
        AND get_user_role() IN ('admin', 'employee')
    );

-- Admins and employees can update loans
CREATE POLICY "Admins and employees can update loans"
    ON loans FOR UPDATE
    USING (
        agency_id = get_user_agency_id() 
        AND get_user_role() IN ('admin', 'employee')
    );

-- LOAN REPAYMENTS POLICIES
-- Users can view repayments for loans they have access to
CREATE POLICY "Users can view accessible loan repayments"
    ON loan_repayments FOR SELECT
    USING (
        loan_id IN (
            SELECT id FROM loans WHERE agency_id = get_user_agency_id()
        )
    );

-- Customers can only view their own loan repayments
CREATE POLICY "Customers can view own repayments"
    ON loan_repayments FOR SELECT
    USING (
        loan_id IN (
            SELECT id FROM loans WHERE customer_id = get_customer_id()
        )
    );

-- Admins and employees can manage repayments
CREATE POLICY "Admins and employees can manage repayments"
    ON loan_repayments FOR ALL
    USING (
        loan_id IN (
            SELECT id FROM loans WHERE agency_id = get_user_agency_id()
        )
        AND get_user_role() IN ('admin', 'employee')
    );

-- COLLATERAL POLICIES
-- Users can view collateral for loans they have access to
CREATE POLICY "Users can view accessible collateral"
    ON collateral FOR SELECT
    USING (
        loan_id IN (
            SELECT id FROM loans WHERE agency_id = get_user_agency_id()
        )
    );

-- Admins and employees can manage collateral
CREATE POLICY "Admins and employees can manage collateral"
    ON collateral FOR ALL
    USING (
        loan_id IN (
            SELECT id FROM loans WHERE agency_id = get_user_agency_id()
        )
        AND get_user_role() IN ('admin', 'employee')
    );

-- DOCUMENTS POLICIES
-- Users can view documents for entities they have access to
CREATE POLICY "Users can view accessible documents"
    ON documents FOR SELECT
    USING (
        CASE entity_type
            WHEN 'customer' THEN entity_id IN (
                SELECT id FROM customers WHERE agency_id = get_user_agency_id()
            )
            WHEN 'loan' THEN entity_id IN (
                SELECT id FROM loans WHERE agency_id = get_user_agency_id()
            )
            WHEN 'collateral' THEN entity_id IN (
                SELECT id FROM collateral WHERE loan_id IN (
                    SELECT id FROM loans WHERE agency_id = get_user_agency_id()
                )
            )
        END
    );

-- Customers can only view their own documents
CREATE POLICY "Customers can view own documents"
    ON documents FOR SELECT
    USING (
        entity_type = 'customer' 
        AND entity_id = get_customer_id()
    );

-- Admins and employees can manage documents
CREATE POLICY "Admins and employees can manage documents"
    ON documents FOR ALL
    USING (get_user_role() IN ('admin', 'employee'));

-- INVITATIONS POLICIES
-- Users can view invitations for their agency
CREATE POLICY "Users can view agency invitations"
    ON invitations FOR SELECT
    USING (agency_id = get_user_agency_id());

-- Admins can manage invitations
CREATE POLICY "Admins can manage invitations"
    ON invitations FOR ALL
    USING (agency_id = get_user_agency_id() AND is_admin());

-- Anyone can view invitation by token (for acceptance)
CREATE POLICY "Anyone can view invitation by token"
    ON invitations FOR SELECT
    USING (true);

-- NOTIFICATIONS POLICIES
-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());

-- Users can update their own notifications
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (user_id = auth.uid());

-- System can create notifications (via service role)
CREATE POLICY "System can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- MESSAGES POLICIES
-- Users can view messages they sent or received
CREATE POLICY "Users can view own messages"
    ON messages FOR SELECT
    USING (
        agency_id = get_user_agency_id() 
        AND (from_user_id = auth.uid() OR to_user_id = auth.uid())
    );

-- Users can create messages in their agency
CREATE POLICY "Users can create messages"
    ON messages FOR INSERT
    WITH CHECK (
        agency_id = get_user_agency_id() 
        AND from_user_id = auth.uid()
    );

-- Users can update messages they received (mark as read)
CREATE POLICY "Users can update received messages"
    ON messages FOR UPDATE
    USING (to_user_id = auth.uid());

-- TASKS POLICIES
-- Users can view tasks in their agency
CREATE POLICY "Users can view agency tasks"
    ON tasks FOR SELECT
    USING (agency_id = get_user_agency_id());

-- Employees can view tasks assigned to them
CREATE POLICY "Employees can view assigned tasks"
    ON tasks FOR SELECT
    USING (assigned_to = get_employee_id());

-- Admins and managers can create tasks
CREATE POLICY "Admins and managers can create tasks"
    ON tasks FOR INSERT
    WITH CHECK (
        agency_id = get_user_agency_id() 
        AND (
            is_admin() 
            OR get_user_role() = 'employee' 
            AND EXISTS (
                SELECT 1 FROM users 
                WHERE id = auth.uid() 
                AND employee_category = 'manager'
            )
        )
    );

-- Assigned employees can update their tasks
CREATE POLICY "Assigned employees can update tasks"
    ON tasks FOR UPDATE
    USING (assigned_to = get_employee_id());

-- AUDIT LOGS POLICIES
-- Admins can view audit logs for their agency
CREATE POLICY "Admins can view agency audit logs"
    ON audit_logs FOR SELECT
    USING (agency_id = get_user_agency_id() AND is_admin());

-- System can create audit logs (via service role)
CREATE POLICY "System can create audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (true);

