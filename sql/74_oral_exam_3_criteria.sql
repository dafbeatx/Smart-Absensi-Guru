-- ==============================================================================
-- SMART ABSENSI GURU — MIGRATION 74: ORAL EXAM 3 CRITERIA SCORING SUPPORT
-- Menambahkan kolom `criteria_labels` pada `public.oral_exam_sessions` agar nama
-- 3 kriteria penilaian (Ujian Bahasa & Ujian BTQ) tersimpan langsung secara native.
-- Script ini idempotent dan aman dijalankan ulang di Supabase SQL Editor.
-- ==============================================================================

ALTER TABLE IF EXISTS public.oral_exam_sessions
  ADD COLUMN IF NOT EXISTS criteria_labels JSONB;

ALTER TABLE IF EXISTS public.oral_exam_sessions
  ALTER COLUMN total_questions SET DEFAULT 3;
