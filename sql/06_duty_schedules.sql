-- SQL Migration: 06_duty_schedules.sql
-- Description: Create teacher_duty_schedules table for Admin Duty Schedule Management (Senin - Jumat)

CREATE TABLE IF NOT EXISTS public.teacher_duty_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5), -- 1: Senin, 2: Selasa, 3: Rabu, 4: Kamis, 5: Jumat
    teacher_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    teacher_name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_day_teacher UNIQUE (day_of_week, teacher_id)
);

-- Indexing for fast day lookup
CREATE INDEX IF NOT EXISTS idx_duty_schedules_day ON public.teacher_duty_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_duty_schedules_teacher ON public.teacher_duty_schedules(teacher_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.teacher_duty_schedules ENABLE ROW LEVEL SECURITY;

-- Policies for Supabase API access
DROP POLICY IF EXISTS "duty_schedules_select" ON public.teacher_duty_schedules;
CREATE POLICY "duty_schedules_select" ON public.teacher_duty_schedules FOR SELECT USING (true);

DROP POLICY IF EXISTS "duty_schedules_insert" ON public.teacher_duty_schedules;
CREATE POLICY "duty_schedules_insert" ON public.teacher_duty_schedules FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "duty_schedules_update" ON public.teacher_duty_schedules;
CREATE POLICY "duty_schedules_update" ON public.teacher_duty_schedules FOR UPDATE USING (true);

DROP POLICY IF EXISTS "duty_schedules_delete" ON public.teacher_duty_schedules;
CREATE POLICY "duty_schedules_delete" ON public.teacher_duty_schedules FOR DELETE USING (true);
