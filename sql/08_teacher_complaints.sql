-- SQL Migration: 08_teacher_complaints.sql
-- Description: Create teacher_complaints table for Anonymous Teacher Feedback & Complaints (Kotak Aspirasi Guru)

CREATE TABLE IF NOT EXISTS public.teacher_complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL CHECK (category IN ('SARANA_PRASARANA', 'SISTEM_APLIKASI', 'KEBIJAKAN_MANAJEMEN', 'KESEJAHTERAAN', 'LAINNYA')),
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'IN_REVIEW', 'RESOLVED', 'ARCHIVED')),
    admin_response TEXT,
    responded_at TIMESTAMPTZ,
    responded_by_role TEXT CHECK (responded_by_role IN ('ADMIN', 'KEPSEK')),
    is_anonymous BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for fast query & filtering
CREATE INDEX IF NOT EXISTS idx_teacher_complaints_user_id ON public.teacher_complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_complaints_status ON public.teacher_complaints(status);
CREATE INDEX IF NOT EXISTS idx_teacher_complaints_category ON public.teacher_complaints(category);
CREATE INDEX IF NOT EXISTS idx_teacher_complaints_created_at ON public.teacher_complaints(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.teacher_complaints ENABLE ROW LEVEL SECURITY;

-- Policies for Supabase API access
DROP POLICY IF EXISTS "teacher_complaints_select" ON public.teacher_complaints;
CREATE POLICY "teacher_complaints_select" ON public.teacher_complaints FOR SELECT USING (true);

DROP POLICY IF EXISTS "teacher_complaints_insert" ON public.teacher_complaints;
CREATE POLICY "teacher_complaints_insert" ON public.teacher_complaints FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "teacher_complaints_update" ON public.teacher_complaints;
CREATE POLICY "teacher_complaints_update" ON public.teacher_complaints FOR UPDATE USING (true);

DROP POLICY IF EXISTS "teacher_complaints_delete" ON public.teacher_complaints;
CREATE POLICY "teacher_complaints_delete" ON public.teacher_complaints FOR DELETE USING (true);
