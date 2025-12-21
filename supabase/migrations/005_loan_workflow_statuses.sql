-- Migration: Add new loan workflow statuses and approval fields
-- This migration updates the loans table to support the new controlled workflow

-- First, drop the existing check constraint
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_status_check;

-- Add new statuses to the enum (PostgreSQL doesn't support ALTER TYPE easily, so we recreate)
-- Note: This is a simplified approach. In production, you might want to use a more sophisticated migration

-- Update status check constraint with new statuses
ALTER TABLE loans 
  ADD CONSTRAINT loans_status_check 
  CHECK (status IN (
    'draft',
    'pending',
    'under_review',
    'approved',
    'rejected',
    'disbursed',
    'active',
    'overdue',
    'closed'
  ));

-- Add approval fields
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS approval JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assigned_accountant UUID REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS disbursed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disbursed_by UUID REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES employees(id);

-- Add index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_assigned_accountant ON loans(assigned_accountant) WHERE assigned_accountant IS NOT NULL;

-- Add comment to approval field
COMMENT ON COLUMN loans.approval IS 'Stores approval/rejection decision with reviewer, timestamp, and notes';

-- Update existing loans to new status if needed
-- Map old statuses to new ones
UPDATE loans 
SET status = CASE
  WHEN status = 'paid' THEN 'closed'
  WHEN status = 'defaulted' THEN 'overdue'
  ELSE status
END
WHERE status IN ('paid', 'defaulted');

