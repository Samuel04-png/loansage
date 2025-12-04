-- Seed data for development/testing
-- This file contains sample data to help with development

-- Insert a test agency
INSERT INTO agencies (id, name, slug, primary_color, secondary_color, theme_mode)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Demo Microfinance', 'demo-mf', '#0ea5e9', '#0284c7', 'light')
ON CONFLICT (id) DO NOTHING;

-- Note: Users will be created through Supabase Auth
-- This seed file is for reference only
-- In production, agencies and users are created through the application flow

