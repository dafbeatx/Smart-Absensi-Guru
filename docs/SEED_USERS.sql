-- ============================================================================
-- SMART ABSENSI GURU — IMPOR / SEED DATA 11 GURU & STAF RESMI
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- 1. Pastikan kolom 'nip' boleh kosong (Nullable / Tanpa Constraint NOT NULL)
ALTER TABLE public.users ALTER COLUMN nip DROP NOT NULL;

-- 2. Insert Data 11 Guru & Staf (NPP dikosongkan '')
INSERT INTO public.users (id, nip, full_name, phone_number, pin_hash, role, position, account_status, created_at)
VALUES
('usr_guru_002', '', 'Muhammad Iqbal Gustiawan, S.Pd., G.r', '081947674030', '38d62af061a298fd3101fee578598037d2595e5e2fcdf581a5627110257f4a4a', 'GURU', 'Wakasek Sarana dan Prasarana', 'ACTIVE', NOW()),
('usr_kepsek_002', '', 'Farhan Sopian Sahid, S.Pd.I', '085716117717', 'a6ad6e117bbf431d405590344c4500342f8964072eb35d4ccb87cfc02149816e', 'KEPSEK', 'Kepala Sekolah', 'ACTIVE', NOW()),
('usr_guru_003', '', 'Adi Prasetyo, S.Pd., G.r', '081213134916', 'f1f5105fb5eb2d6b61d9d3e7dfb8d4e10b20b00fa8799d0ea5c501b48efe662e', 'GURU', 'Guru Mapel Bahasa Inggris', 'ACTIVE', NOW()),
('usr_op_002', '', 'Qodiatul Asrof Ramadhoni, S.E., G.r', '081802107009', '9906d3d119896e98863425d44ffcfa05a8956ac42c80eb214edb2cdd61998b0f', 'OPERATOR', 'Operator Sekolah', 'ACTIVE', NOW()),
('usr_guru_004', '', 'Mira Nurdianti, S.Pd', '08159185700', '48ab56cf51f95a54ac74154c0719f98bb27ccbd9d49d140a50f988b8c635e0d4', 'GURU', 'Tata Usaha (TU)', 'ACTIVE', NOW()),
('usr_guru_005', '', 'Fitri Ani Rahayu', '0881024136818', '67a4753a6f0be66abf4820e66e58e5c3a0800c30dcc9e9f144bef67e64d73f7c', 'GURU', 'Guru Mapel Matematika', 'ACTIVE', NOW()),
('usr_guru_006', '', 'Nurul Fahriya, S.Pd., G.r', '089611651623', 'c726a4d68c7f1e7d210ab2ff2055d8293a0a36cb23f37bc069a620795c7582b8', 'GURU', 'Wakasek Kurikulum', 'ACTIVE', NOW()),
('usr_guru_007', '', 'Septi Nur Aeni, S.E', '08989462357', '29004514f01ffc696e46d17605c7d5ed9e1ab06f01dcfe8ebfdba53ca82587c4', 'GURU', 'Guru Mapel B. Indonesia', 'ACTIVE', NOW()),
('usr_guru_008', '', 'Windiani, S.E., G.r', '081646035486', '0531545b927f085b3d92631dbbe69defc273420cc4b1e04c2d4efcbf31367434', 'GURU', 'Bendahara Sekolah', 'ACTIVE', NOW()),
('usr_guru_009', '', 'Widianingsih, S.Si., G.r', '085885460842', 'b803a84df15743451aba5d183cd7d987b3d9860f722bb88470de2633944e8fb3', 'GURU', 'Guru Mapel IPA', 'ACTIVE', NOW()),
('usr_guru_010', '', 'Mawar Andinia, S.Pd., G.r', '085122948690', '8a3f7293f7febafbab513adbd56d7a027efc0f89a1911aaad3f0731464922601', 'GURU', 'Bimbingan Konseling (BK)', 'ACTIVE', NOW())
ON CONFLICT (phone_number) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  nip = EXCLUDED.nip,
  pin_hash = EXCLUDED.pin_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  account_status = EXCLUDED.account_status;
