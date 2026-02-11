-- MitAI - Add is_recurring column to incomes
-- Run this in Supabase SQL Editor

-- Add is_recurring column to incomes table
ALTER TABLE public.incomes 
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;

-- Make month nullable for recurring incomes
ALTER TABLE public.incomes 
  ALTER COLUMN month DROP NOT NULL;

-- Update existing incomes to have is_recurring = false
UPDATE public.incomes SET is_recurring = false WHERE is_recurring IS NULL;
