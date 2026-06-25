-- ==========================================
-- SECURE SCHEMA POLICIES FOR HUMANIZER-AI
-- Copy and paste this script into your Supabase SQL Editor
-- to fix the security linter warnings.
-- ==========================================

-- 1. Clean up old permissive policies
DROP POLICY IF EXISTS "Allow public select on users" ON public.users;
DROP POLICY IF EXISTS "Allow public insert on users" ON public.users;
DROP POLICY IF EXISTS "Allow public update on users" ON public.users;
DROP POLICY IF EXISTS "allow_all_on_users_dev" ON public.users;

DROP POLICY IF EXISTS "Allow public select on history" ON public.history;
DROP POLICY IF EXISTS "Allow public insert on history" ON public.history;
DROP POLICY IF EXISTS "allow_all_on_history_dev" ON public.history;
DROP POLICY IF EXISTS "allow_all_on_sessions_dev" ON public.sessions;

-- 2. Create secure policies for users table
-- Allow users to read, insert, and update ONLY their own rows matching their auth.uid()
CREATE POLICY "Users can select their own profile"
ON public.users FOR SELECT
USING (auth.uid()::text = uid);

CREATE POLICY "Users can insert their own profile"
ON public.users FOR INSERT
WITH CHECK (auth.uid()::text = uid);

CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE
USING (auth.uid()::text = uid);

-- 3. Create secure policies for history table
-- Allow users to read and insert history ONLY linked to their own auth.uid()
CREATE POLICY "Users can select their own history"
ON public.history FOR SELECT
USING (auth.uid()::text = user_uid);

CREATE POLICY "Users can insert their own history"
ON public.history FOR INSERT
WITH CHECK (auth.uid()::text = user_uid);

-- 4. Fix Security Definer function warning
-- Switch the has_role function to SECURITY INVOKER so it executes with the caller's privileges
ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;
