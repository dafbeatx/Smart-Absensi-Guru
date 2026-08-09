-- SQL Migration: 05_teacher_moods.sql
-- Description: Create teacher_moods table for Daily Mood Check-in & Kepsek Burnout Analytics

CREATE TABLE IF NOT EXISTS public.teacher_moods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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

-- Policies:
-- 1. Teachers can insert/update their own mood log
CREATE POLICY "Users can manage their own mood log"
ON public.teacher_moods
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Kepsek / Admin can read anonymized / all mood logs for analytics
CREATE POLICY "Kepsek and Admin can view mood logs"
ON public.teacher_moods
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role IN ('KEPSEK', 'ADMIN')
    )
);
