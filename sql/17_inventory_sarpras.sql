-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION: INVENTARIS SARANA DAN PRASARANA (SARPRAS)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
--
-- Tabel: public.inventory_sarpras
-- Menyimpan data aset, sarana, dan prasarana sekolah yang diinput oleh
-- Wakasek Sarana dan Prasarana (M. Iqbal Gustiawan) dan ditinjau oleh Kepala Sekolah.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_sarpras (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ruangan           TEXT NOT NULL,
  nama_barang       TEXT NOT NULL,
  jumlah_total      INTEGER NOT NULL DEFAULT 1 CHECK (jumlah_total >= 0),
  merek             TEXT NOT NULL,
  tahun_perolehan   INTEGER NOT NULL,
  kondisi           TEXT NOT NULL CHECK (kondisi IN ('LAYAK', 'RUSAK')),
  yang_harus_dibeli TEXT NOT NULL DEFAULT '0',
  sumber_dana       TEXT NOT NULL,
  keterangan        TEXT,
  created_by        TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_name   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE public.inventory_sarpras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_sarpras_select" ON public.inventory_sarpras;
CREATE POLICY "inventory_sarpras_select" ON public.inventory_sarpras FOR SELECT USING (true);

DROP POLICY IF EXISTS "inventory_sarpras_insert" ON public.inventory_sarpras;
CREATE POLICY "inventory_sarpras_insert" ON public.inventory_sarpras FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "inventory_sarpras_update" ON public.inventory_sarpras;
CREATE POLICY "inventory_sarpras_update" ON public.inventory_sarpras FOR UPDATE USING (true);

DROP POLICY IF EXISTS "inventory_sarpras_delete" ON public.inventory_sarpras;
CREATE POLICY "inventory_sarpras_delete" ON public.inventory_sarpras FOR DELETE USING (true);

-- Indexing untuk kecepatan pencarian, filtering ruangan dan kondisi
CREATE INDEX IF NOT EXISTS idx_inventory_sarpras_ruangan    ON public.inventory_sarpras(ruangan);
CREATE INDEX IF NOT EXISTS idx_inventory_sarpras_kondisi    ON public.inventory_sarpras(kondisi);
CREATE INDEX IF NOT EXISTS idx_inventory_sarpras_created_at ON public.inventory_sarpras(created_at DESC);

-- ============================================================================
-- SEED DATA AWAL SARANA & PRASARANA SEKOLAH
-- Diinput oleh Wakasek Sarpras: Muhammad Iqbal Gustiawan, S.Pd., G.r (usr_guru_002)
-- ============================================================================

INSERT INTO public.inventory_sarpras (
  id, ruangan, nama_barang, jumlah_total, merek, tahun_perolehan, kondisi, yang_harus_dibeli, sumber_dana, keterangan, created_by, created_by_name, created_at, updated_at
) VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'Lab Komputer',
    'Komputer PC Client Core i5',
    25,
    'Lenovo ThinkCentre',
    2023,
    'LAYAK',
    '5 unit PC baru untuk cadangan ujian ANBK',
    'BOS Kinerja 2023',
    'Semua PC terpasang OS Windows 11 & aplikasi ujian ANBK/CBT. Kondisi prima terawat.',
    'usr_guru_002',
    'Muhammad Iqbal Gustiawan, S.Pd., G.r',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'Lab Komputer',
    'Proyektor LCD Digital',
    2,
    'Epson EB-X500',
    2022,
    'LAYAK',
    '0',
    'BOS Reguler 2022',
    'Terpasang di bracket plafon Lab Komputer 1 & 2. Lampu proyektor masih terang.',
    'usr_guru_002',
    'Muhammad Iqbal Gustiawan, S.Pd., G.r',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'Ruang Guru',
    'AC Split 1.5 PK',
    2,
    'Daikin Inverter',
    2021,
    'RUSAK',
    '1 unit AC baru pengganti unit barat yang kompresornya mati',
    'Yayasan / Komite',
    'Unit timur berfungsi normal (dingin). Unit barat kompresor macet, perlu penggantian unit.',
    'usr_guru_002',
    'Muhammad Iqbal Gustiawan, S.Pd., G.r',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '1 days'
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'Ruang Guru',
    'Meja Kerja Guru Kayu Jati',
    30,
    'Custom Jepara',
    2020,
    'LAYAK',
    '0',
    'Bantuan Pemerintah (DAK)',
    'Kondisi kayu sangat kokoh, laci meja lengkap dengan kunci masing-masing.',
    'usr_guru_002',
    'Muhammad Iqbal Gustiawan, S.Pd., G.r',
    NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    'a0000000-0000-0000-0000-000000000005',
    'Ruang Kelas 7A',
    'Papan Tulis Whiteboard Magnetik',
    1,
    'Sakana 120x240 cm',
    2024,
    'LAYAK',
    '0',
    'BOS Reguler 2024',
    'Permukaan bersih, tray spidol dan penghapus dalam kondisi bagus.',
    'usr_guru_002',
    'Muhammad Iqbal Gustiawan, S.Pd., G.r',
    NOW() - INTERVAL '10 days',
    NOW()
  ),
  (
    'a0000000-0000-0000-0000-000000000006',
    'Ruang Kelas 8B',
    'Kipas Angin Dinding (Wall Fan)',
    4,
    'Maspion 16 Inch',
    2021,
    'RUSAK',
    '2 unit kipas angin dinding baru',
    'Dana BOS Reguler',
    '2 unit berputar normal, 2 unit dinamo mati / bunyi mendengung keras.',
    'usr_guru_002',
    'Muhammad Iqbal Gustiawan, S.Pd., G.r',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '1 days'
  ),
  (
    'a0000000-0000-0000-0000-000000000007',
    'Perpustakaan',
    'Rak Buku Besi 5 Tingkat',
    6,
    'Lion Metal Works',
    2022,
    'LAYAK',
    '0',
    'Bantuan Hibah Alumni',
    'Kapasitas total memuat ~1.800 buku. Cat masih mulus tanpa karat.',
    'usr_guru_002',
    'Muhammad Iqbal Gustiawan, S.Pd., G.r',
    NOW() - INTERVAL '5 days',
    NOW()
  )
ON CONFLICT (id) DO NOTHING;
