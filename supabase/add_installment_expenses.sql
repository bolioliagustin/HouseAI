-- Create installment_expenses table for shared installment purchases
CREATE TABLE IF NOT EXISTS public.installment_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  description TEXT NOT NULL,
  category TEXT DEFAULT 'muebles',
  total_amount DECIMAL(12, 2) NOT NULL,
  installments INTEGER NOT NULL, -- total number of installments
  monthly_amount DECIMAL(12, 2) NOT NULL, -- total_amount / installments
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.installment_expenses ENABLE ROW LEVEL SECURITY;

-- Policy: members of the house can view
CREATE POLICY "House members can view installments" ON public.installment_expenses
  FOR SELECT USING (
    house_id IN (
      SELECT house_id FROM public.house_members WHERE user_id = auth.uid()
    )
  );

-- Policy: authenticated users can insert for their house
CREATE POLICY "Members can create installments" ON public.installment_expenses
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    house_id IN (
      SELECT house_id FROM public.house_members WHERE user_id = auth.uid()
    )
  );

-- Policy: creator can delete
CREATE POLICY "Creator can delete installments" ON public.installment_expenses
  FOR DELETE USING (created_by = auth.uid());
