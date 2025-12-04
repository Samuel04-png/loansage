-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Agencies table (Multi-tenant root)
CREATE TABLE agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#0ea5e9',
    secondary_color TEXT DEFAULT '#0284c7',
    theme_mode TEXT DEFAULT 'light' CHECK (theme_mode IN ('light', 'dark', 'auto')),
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'employee', 'customer')),
    employee_category TEXT CHECK (employee_category IN ('loan_officer', 'field_officer', 'collections', 'underwriter', 'accountant', 'manager')),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees table
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL,
    department TEXT,
    position TEXT,
    hire_date DATE,
    manager_id UUID REFERENCES employees(id),
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agency_id, employee_id)
);

-- Customers table (borrowers)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL,
    nrc_number TEXT,
    date_of_birth DATE,
    address JSONB DEFAULT '{}'::jsonb,
    employment_status TEXT,
    monthly_income NUMERIC(12, 2),
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    assigned_officer_id UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agency_id, customer_id)
);

-- Loans table
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_number TEXT UNIQUE NOT NULL,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    loan_type TEXT NOT NULL CHECK (loan_type IN ('personal', 'business', 'agriculture', 'vehicle', 'property')),
    amount NUMERIC(12, 2) NOT NULL,
    currency TEXT DEFAULT 'ZMW',
    interest_rate NUMERIC(5, 2) NOT NULL,
    duration_months INTEGER NOT NULL,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'active', 'rejected', 'paid', 'defaulted')),
    repayment_frequency TEXT DEFAULT 'monthly' CHECK (repayment_frequency IN ('weekly', 'biweekly', 'monthly')),
    created_by UUID REFERENCES employees(id),
    approved_by UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loan repayments table
CREATE TABLE loan_repayments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'waived')),
    payment_method TEXT,
    transaction_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collateral table
CREATE TABLE collateral (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('vehicle', 'property', 'electronics', 'jewelry', 'other')),
    description TEXT NOT NULL,
    estimated_value NUMERIC(12, 2) NOT NULL,
    currency TEXT DEFAULT 'ZMW',
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    images TEXT[] DEFAULT '{}',
    documents TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('customer', 'loan', 'collateral')),
    entity_id UUID NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('nrc', 'utility', 'payslip', 'contract', 'other')),
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invitations table
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('employee', 'customer')),
    employee_category TEXT CHECK (employee_category IN ('loan_officer', 'field_officer', 'collections', 'underwriter', 'accountant', 'manager')),
    token TEXT UNIQUE NOT NULL,
    invited_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('loan_approved', 'payment_due', 'overdue', 'message', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
    subject TEXT,
    body TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES employees(id),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('field_visit', 'collection', 'call', 'follow_up')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    related_loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    changes JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support tickets table
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    assigned_to UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_agency_id ON users(agency_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_employees_agency_id ON employees(agency_id);
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_customers_agency_id ON customers(agency_id);
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_loans_agency_id ON loans(agency_id);
CREATE INDEX idx_loans_customer_id ON loans(customer_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loan_repayments_loan_id ON loan_repayments(loan_id);
CREATE INDEX idx_loan_repayments_status ON loan_repayments(status);
CREATE INDEX idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);
CREATE INDEX idx_messages_agency_id ON messages(agency_id);
CREATE INDEX idx_messages_from_user ON messages(from_user_id);
CREATE INDEX idx_messages_to_user ON messages(to_user_id);
CREATE INDEX idx_tasks_agency_id ON tasks(agency_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_audit_logs_agency_id ON audit_logs(agency_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_agency_id ON invitations(agency_id);
CREATE INDEX idx_support_tickets_agency_id ON support_tickets(agency_id);
CREATE INDEX idx_support_tickets_created_by ON support_tickets(created_by);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON agencies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loan_repayments_updated_at BEFORE UPDATE ON loan_repayments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_collateral_updated_at BEFORE UPDATE ON collateral FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

