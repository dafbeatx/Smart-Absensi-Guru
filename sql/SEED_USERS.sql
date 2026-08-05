-- ============================================================================
-- SMART ABSENSI GURU — IMPOR / SEED DATA 11 GURU & STAF RESMI
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- 1. Lepaskan batasan NOT NULL dan UNIQUE constraint pada kolom 'nip' (NPP)
ALTER TABLE public.users ALTER COLUMN nip DROP NOT NULL;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_nip_key;

-- 2. Insert Data 11 Guru & Staf Resmi (NPP NULL)
--    Default PIN: 123456  →  SHA-256: 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
INSERT INTO public.users (id, nip, full_name, phone_number, pin_hash, role, position, account_status, created_at)
VALUES
('usr_guru_002', NULL, 'Muhammad Iqbal Gustiawan, S.Pd., G.r', '081947674030', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'GURU', 'Wakasek Sarana dan Prasarana', 'ACTIVE', NOW()),
('usr_kepsek_002', NULL, 'Farhan Sopian Sahid, S.Pd.I', '085716117717', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'KEPSEK', 'Kepala Sekolah', 'ACTIVE', NOW()),
('usr_guru_003', NULL, 'Adi Prasetyo, S.Pd., G.r', '081213134916', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'GURU', 'Guru Mapel Bahasa Inggris', 'ACTIVE', NOW()),
('usr_op_002', NULL, 'Qodiatul Asrof Ramadhoni, S.E., G.r', '081802107009', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'OPERATOR', 'Operator Sekolah', 'ACTIVE', NOW()),
('usr_guru_004', NULL, 'Mira Nurdianti, S.Pd', '08159185700', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'GURU', 'Tata Usaha (TU)', 'ACTIVE', NOW()),
('usr_guru_005', NULL, 'Fitri Ani Rahayu', '0881024136818', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'GURU', 'Guru Mapel Matematika', 'ACTIVE', NOW()),
('usr_guru_006', NULL, 'Nurul Fahriya, S.Pd., G.r', '089611651623', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'GURU', 'Wakasek Kurikulum', 'ACTIVE', NOW()),
('usr_guru_007', NULL, 'Septi Nur Aeni, S.E', '08989462357', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'GURU', 'Guru Mapel B. Indonesia', 'ACTIVE', NOW()),
('usr_guru_008', NULL, 'Windiani, S.E., G.r', '081646035486', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'GURU', 'Bendahara Sekolah', 'ACTIVE', NOW()),
('usr_guru_009', NULL, 'Widianingsih, S.Si., G.r', '085885460842', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'GURU', 'Guru Mapel IPA', 'ACTIVE', NOW()),
('usr_guru_010', NULL, 'Mawar Andinia, S.Pd., G.r', '085122948690', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'GURU', 'Bimbingan Konseling (BK)', 'ACTIVE', NOW())

ON CONFLICT (phone_number) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  nip = EXCLUDED.nip,
  pin_hash = EXCLUDED.pin_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  account_status = EXCLUDED.account_status;
