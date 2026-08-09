-- SQL Migration: 05_teacher_moods.sql
-- Description: Create teacher_moods table for Daily Mood Check-in & Kepsek Burnout Analytics

CREATE TABLE IF NOT EXISTS public.teacher_moods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    mood TEXT NOT NULL CHECK (mood IN ('VERY_HAPPY', 'HAPPY', 'NEUTRAL', 'TIRED', 'STRESSED')),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_date_mood UNIQUE (user_id, date)
);

-- Indexing for fast analytics & teacher lookup
CREATE INDEX IF NOT EXISTS idx_teacher_moods_date ON public.teacher_moods(date);
CREATE INDEX IF NOT EXISTS idx_teacher_moods_user_date ON public.teacher_moods(user_id, date);

-- Enable Row Level Security (RLS)
ALTER TABLE public.teacher_moods ENABLE ROW LEVEL SECURITY;

-- Policies for Supabase API access
DROP POLICY IF EXISTS "teacher_moods_select" ON public.teacher_moods;
CREATE POLICY "teacher_moods_select" ON public.teacher_moods FOR SELECT USING (true);

DROP POLICY IF EXISTS "teacher_moods_insert" ON public.teacher_moods;
CREATE POLICY "teacher_moods_insert" ON public.teacher_moods FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "teacher_moods_update" ON public.teacher_moods;
CREATE POLICY "teacher_moods_update" ON public.teacher_moods FOR UPDATE USING (true);

DROP POLICY IF EXISTS "teacher_moods_delete" ON public.teacher_moods;
CREATE POLICY "teacher_moods_delete" ON public.teacher_moods FOR DELETE USING (true);

