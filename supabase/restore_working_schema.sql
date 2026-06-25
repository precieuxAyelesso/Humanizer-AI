-- ==========================================
-- RESTORE WORKING SCHEMAS FOR HUMANIZER-AI
-- Copy and paste this script into your Supabase SQL Editor
-- to restore normal login/registration functionality.
-- ==========================================

-- 1. Remove strict auth-bound policies that block backend anon calls
DROP POLICY IF EXISTS "Users can select their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

DROP POLICY IF EXISTS "Users can select their own history" ON public.history;
DROP POLICY IF EXISTS "Users can insert their own history" ON public.history;

-- 2. Restore permissive policies so backend queries via anon key can execute
CREATE POLICY "Allow public select on users" 
ON public.users FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert on users" 
ON public.users FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update on users" 
ON public.users FOR UPDATE 
USING (true);

CREATE POLICY "Allow public select on history" 
ON public.history FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert on history" 
ON public.history FOR INSERT 
WITH CHECK (true);
