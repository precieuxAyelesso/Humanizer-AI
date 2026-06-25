-- ==========================================
-- SCHEMA DEFINITION FOR HUMANIZER-AI
-- Copy and paste this script into the Supabase SQL Editor to initialize your database
-- ==========================================

-- 1. Create the Users table
CREATE TABLE IF NOT EXISTS public.users (
    uid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    is_sms_verified BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    google_id TEXT,
    provider TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create the History table
CREATE TABLE IF NOT EXISTS public.history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uid TEXT REFERENCES public.users(uid) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    result TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for Users
CREATE POLICY "Allow public select on users" 
ON public.users FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert on users" 
ON public.users FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update on users" 
ON public.users FOR UPDATE 
USING (true);

-- 5. Create RLS Policies for History
CREATE POLICY "Allow public select on history" 
ON public.history FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert on history" 
ON public.history FOR INSERT 
WITH CHECK (true);

-- 6. Create Indexes for optimization
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_history_user_uid ON public.history(user_uid);
