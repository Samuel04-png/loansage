-- Migration to expand loan types to support more loan business types
-- This migration updates the CHECK constraint on loan_type to include new loan types

-- Drop the existing constraint
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_loan_type_check;

-- Add new constraint with expanded loan types
ALTER TABLE loans ADD CONSTRAINT loans_loan_type_check 
  CHECK (loan_type IN (
    'personal',
    'business',
    'agriculture',
    'vehicle',
    'property',
    'education',
    'medical',
    'emergency',
    'salary_advance',
    'microfinance',
    'group',
    'equipment',
    'working_capital',
    'invoice_financing',
    'trade_finance',
    'refinancing',
    'asset_finance',
    'construction'
  ));

-- Add comment to document the change
COMMENT ON COLUMN loans.loan_type IS 'Type of loan: personal, business, agriculture, vehicle, property, education, medical, emergency, salary_advance, microfinance, group, equipment, working_capital, invoice_financing, trade_finance, refinancing, asset_finance, construction';

