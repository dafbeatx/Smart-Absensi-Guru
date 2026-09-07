-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION: BIOMETRIC FINGERPRINT ATTENDANCE COLUMNS
-- Jalankan script SQL ini di Supabase SQL Editor:
-- Menambahkan kolom verification_method & attendance_source pada tabel attendance,
-- serta biometric_credential_id pada tabel users untuk otentikasi sidik jari HP.
-- ============================================================================

-- 1. Tambah kolom verifikasi pada tabel attendance
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'QR_GPS';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS attendance_source TEXT DEFAULT 'QR';

-- 2. Tambah kolom penyimpanan credential ID biometrik pada tabel users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS biometric_credential_id TEXT;

-- 3. Verifikasi Index
CREATE INDEX IF NOT EXISTS idx_attendance_verification_method ON public.attendance(verification_method);
