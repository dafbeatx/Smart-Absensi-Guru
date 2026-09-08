-- SQL Migration: 12_classroom_emergencies.sql
-- Description: Create classroom_emergencies table for Classroom SOS & Emergency Response (Panggilan Darurat UKS / Guru Piket)

CREATE TABLE IF NOT EXISTS public.classroom_emergencies (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    teacher_name TEXT NOT NULL,
    room_name TEXT NOT NULL,
    class_name TEXT,
    category TEXT NOT NULL CHECK (category IN ('MEDIS_UKS', 'DISIPLIN_PERKELAHIAN', 'LAB_K3', 'LAINNYA')),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESPONDED', 'RESOLVED', 'CANCELLED')),
    responded_by TEXT,
    responded_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for fast real-time queries & status filtering
CREATE INDEX IF NOT EXISTS idx_classroom_emergencies_status ON public.classroom_emergencies(status);
CREATE INDEX IF NOT EXISTS idx_classroom_emergencies_teacher_id ON public.classroom_emergencies(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classroom_emergencies_created_at ON public.classroom_emergencies(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.classroom_emergencies ENABLE ROW LEVEL SECURITY;

-- Policies for Supabase API access
DROP POLICY IF EXISTS "classroom_emergencies_select" ON public.classroom_emergencies;
CREATE POLICY "classroom_emergencies_select" ON public.classroom_emergencies FOR SELECT USING (true);

DROP POLICY IF EXISTS "classroom_emergencies_insert" ON public.classroom_emergencies;
CREATE POLICY "classroom_emergencies_insert" ON public.classroom_emergencies FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "classroom_emergencies_update" ON public.classroom_emergencies;
CREATE POLICY "classroom_emergencies_update" ON public.classroom_emergencies FOR UPDATE USING (true);

DROP POLICY IF EXISTS "classroom_emergencies_delete" ON public.classroom_emergencies;
CREATE POLICY "classroom_emergencies_delete" ON public.classroom_emergencies FOR DELETE USING (true);
