-- Create shopping_items table
CREATE TABLE IF NOT EXISTS public.shopping_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  house_id uuid NOT NULL,
  name text NOT NULL,
  is_checked boolean DEFAULT false,
  added_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shopping_items_pkey PRIMARY KEY (id),
  CONSTRAINT shopping_items_house_id_fkey FOREIGN KEY (house_id) REFERENCES public.houses(id),
  CONSTRAINT shopping_items_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id)
);

-- Enable RLS
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

-- Policy: Members can view items in their house
CREATE POLICY "Members can view shopping items" 
  ON public.shopping_items FOR SELECT 
  USING (
    auth.uid() IN (
      SELECT user_id FROM house_members WHERE house_id = shopping_items.house_id
    )
  );

-- Policy: Members can insert items
CREATE POLICY "Members can insert shopping items" 
  ON public.shopping_items FOR INSERT 
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM house_members WHERE house_id = shopping_items.house_id
    )
  );

-- Policy: Members can update items (check/uncheck)
CREATE POLICY "Members can update shopping items" 
  ON public.shopping_items FOR UPDATE 
  USING (
    auth.uid() IN (
      SELECT user_id FROM house_members WHERE house_id = shopping_items.house_id
    )
  );

-- Policy: Members can delete items
CREATE POLICY "Members can delete shopping items" 
  ON public.shopping_items FOR DELETE 
  USING (
    auth.uid() IN (
      SELECT user_id FROM house_members WHERE house_id = shopping_items.house_id
    )
  );
