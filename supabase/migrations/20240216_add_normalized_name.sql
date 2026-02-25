-- Add normalized_name to receipt_items for price tracking
ALTER TABLE public.receipt_items 
ADD COLUMN IF NOT EXISTS normalized_name text;

-- Create an index to speed up price history lookups
CREATE INDEX IF NOT EXISTS idx_receipt_items_normalized_name 
ON public.receipt_items(normalized_name);

-- Comment: normalized_name will store the generic product name
-- e.g. "Coca Cola 1.5L" instead of "COCA COLA 1.5 DESC"
