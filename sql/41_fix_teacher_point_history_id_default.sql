-- ==============================================================================
-- 41_fix_teacher_point_history_id_default.sql
-- MEMASTIKAN DEFAULT UUID PADA KOLOM ID TABEL TEACHER_POINT_HISTORY
-- ==============================================================================

-- 1. Pastikan ekstensi pgcrypto tersedia untuk gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Pastikan kolom id memiliki DEFAULT gen_random_uuid()
ALTER TABLE public.teacher_point_history 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
