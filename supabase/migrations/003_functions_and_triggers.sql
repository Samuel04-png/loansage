-- Function to generate unique loan number
CREATE OR REPLACE FUNCTION generate_loan_number(agency_slug TEXT)
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER;
BEGIN
    counter := 1;
    LOOP
        new_number := agency_slug || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(counter::TEXT, 6, '0');
        IF NOT EXISTS (SELECT 1 FROM loans WHERE loan_number = new_number) THEN
            RETURN new_number;
        END IF;
        counter := counter + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique customer ID
CREATE OR REPLACE FUNCTION generate_customer_id(agency_id UUID)
RETURNS TEXT AS $$
DECLARE
    agency_slug TEXT;
    new_id TEXT;
    counter INTEGER;
BEGIN
    SELECT slug INTO agency_slug FROM agencies WHERE id = agency_id;
    counter := 1;
    LOOP
        new_id := agency_slug || '-CUST-' || LPAD(counter::TEXT, 6, '0');
        IF NOT EXISTS (SELECT 1 FROM customers WHERE customers.customer_id = new_id AND customers.agency_id = generate_customer_id.agency_id) THEN
            RETURN new_id;
        END IF;
        counter := counter + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique employee ID
CREATE OR REPLACE FUNCTION generate_employee_id(agency_id UUID)
RETURNS TEXT AS $$
DECLARE
    agency_slug TEXT;
    new_id TEXT;
    counter INTEGER;
BEGIN
    SELECT slug INTO agency_slug FROM agencies WHERE id = agency_id;
    counter := 1;
    LOOP
        new_id := agency_slug || '-EMP-' || LPAD(counter::TEXT, 6, '0');
        IF NOT EXISTS (SELECT 1 FROM employees WHERE employees.employee_id = new_id AND employees.agency_id = generate_employee_id.agency_id) THEN
            RETURN new_id;
        END IF;
        counter := counter + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create user record after auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user record on auth signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to create audit log
CREATE OR REPLACE FUNCTION create_audit_log(
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_changes JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_agency_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;
    
    SELECT agency_id INTO v_agency_id FROM users WHERE id = v_user_id;
    IF v_agency_id IS NULL THEN
        RETURN;
    END IF;
    
    INSERT INTO audit_logs (agency_id, user_id, action, entity_type, entity_id, changes)
    VALUES (v_agency_id, v_user_id, p_action, p_entity_type, p_entity_id, p_changes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_link TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (p_user_id, p_type, p_title, p_message, p_link)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate loan repayment schedule
CREATE OR REPLACE FUNCTION create_loan_repayment_schedule(p_loan_id UUID)
RETURNS VOID AS $$
DECLARE
    v_loan RECORD;
    v_monthly_payment NUMERIC;
    v_due_date DATE;
    v_counter INTEGER;
BEGIN
    SELECT * INTO v_loan FROM loans WHERE id = p_loan_id;
    
    IF v_loan.start_date IS NULL THEN
        RETURN;
    END IF;
    
    -- Calculate monthly payment (simple interest)
    v_monthly_payment := (v_loan.amount * (1 + (v_loan.interest_rate / 100))) / v_loan.duration_months;
    
    -- Create repayment schedule based on frequency
    v_counter := 0;
    LOOP
        EXIT WHEN v_counter >= v_loan.duration_months;
        
        CASE v_loan.repayment_frequency
            WHEN 'weekly' THEN
                v_due_date := v_loan.start_date + (v_counter * INTERVAL '1 week');
            WHEN 'biweekly' THEN
                v_due_date := v_loan.start_date + (v_counter * INTERVAL '2 weeks');
            WHEN 'monthly' THEN
                v_due_date := v_loan.start_date + (v_counter * INTERVAL '1 month');
        END CASE;
        
        INSERT INTO loan_repayments (loan_id, amount, due_date, status)
        VALUES (p_loan_id, v_monthly_payment, v_due_date, 'pending')
        ON CONFLICT DO NOTHING;
        
        v_counter := v_counter + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create repayment schedule when loan is activated
CREATE OR REPLACE FUNCTION trigger_create_repayment_schedule()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'active' AND OLD.status != 'active' THEN
        PERFORM create_loan_repayment_schedule(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_loan_activated
    AFTER UPDATE OF status ON loans
    FOR EACH ROW
    WHEN (NEW.status = 'active' AND OLD.status != 'active')
    EXECUTE FUNCTION trigger_create_repayment_schedule();

