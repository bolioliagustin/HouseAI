-- MitAI - Supabase Relationships Fix v2
-- Run this in Supabase SQL Editor

-- First, drop problematic policies
DROP POLICY IF EXISTS "Users can view house members in their houses" ON public.house_members;
DROP POLICY IF EXISTS "Users can view other users in their house" ON public.users;

-- Create a security definer function to get user's house_ids (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_house_ids()
RETURNS SETOF UUID AS $$
  SELECT house_id FROM public.house_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Create a function to get user IDs in same house
CREATE OR REPLACE FUNCTION public.get_my_housemates()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT user_id FROM public.house_members 
  WHERE house_id IN (SELECT public.get_my_house_ids());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_my_house_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_housemates() TO authenticated;

-- Now create policies using the function (no recursion!)
CREATE POLICY "Users can view house members in their houses" ON public.house_members
  FOR SELECT USING (
    user_id = auth.uid() OR house_id IN (SELECT public.get_my_house_ids())
  );

CREATE POLICY "Users can view housemates" ON public.users
  FOR SELECT USING (
    id = auth.uid() OR id IN (SELECT public.get_my_housemates())
  );

-- Allow reading houses
DROP POLICY IF EXISTS "Anyone can read houses by invite code" ON public.houses;
CREATE POLICY "Anyone can read houses" ON public.houses
  FOR SELECT USING (true);

-- Grant permissions
GRANT SELECT ON public.houses TO authenticated;
GRANT SELECT ON public.house_members TO authenticated;
GRANT SELECT ON public.users TO authenticated;
