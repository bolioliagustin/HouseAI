-- MitAI - Add personal expense support
-- Run this in Supabase SQL Editor

-- Make house_id nullable for personal expenses
ALTER TABLE public.shared_expenses 
  ALTER COLUMN house_id DROP NOT NULL;

-- Add is_shared flag to shared_expenses
ALTER TABLE public.shared_expenses 
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT TRUE;

-- Update existing expenses as shared
UPDATE public.shared_expenses SET is_shared = true WHERE is_shared IS NULL;
