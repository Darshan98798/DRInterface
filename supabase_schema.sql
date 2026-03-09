-- Supabase DB Initialization Script for DR.Interface Portfolio

-- 1. Create the project_reviews table
CREATE TABLE IF NOT EXISTS public.project_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    thread JSONB DEFAULT '[]'::JSONB
);

-- Enable Row Level Security (RLS) but allow anonymous inserts and selects for public reviews
ALTER TABLE public.project_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public inserts for pending reviews" 
ON public.project_reviews FOR INSERT 
TO public 
WITH CHECK (status = 'pending');

CREATE POLICY "Allow public reads for approved reviews" 
ON public.project_reviews FOR SELECT 
TO public 
USING (status = 'approved');

-- Allow absolute control (bypass RLS) for the Service Role Keys (Admin Panel)

-- 2. Create the access_requests table
CREATE TABLE IF NOT EXISTS public.access_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for access requests
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public inserts for access requests" 
ON public.access_requests FOR INSERT 
TO public 
WITH CHECK (true);

-- No public read access policy (Admin only via Service Role Key)
-- Stats Policies
CREATE POLICY "Allow public reads for stats" ON public.project_stats FOR SELECT TO public USING (true);
CREATE POLICY "Allow public updates for stats" ON public.project_stats FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public inserts for stats" ON public.project_stats FOR INSERT TO public WITH CHECK (true);

-- 3. Create the project_stats table
CREATE TABLE IF NOT EXISTS public.project_stats (
    project_id TEXT PRIMARY KEY,
    likes INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.project_stats ENABLE ROW LEVEL SECURITY;

-- 4. Create the site_feedback table (portfolio-wide testimonials)
CREATE TABLE IF NOT EXISTS public.site_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'Visitor',
    rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    avatar_initials TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.site_feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit feedback
CREATE POLICY "Allow public inserts for feedback"
ON public.site_feedback FOR INSERT
TO public
WITH CHECK (status = 'pending');

-- Allow public to read approved feedback
CREATE POLICY "Allow public reads for approved feedback"
ON public.site_feedback FOR SELECT
TO public
USING (status = 'approved');

-- Allow service role full access (Admin Panel via node server)
