-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION: INVENTARIS SARANA DAN PRASARANA (SARPRAS)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
--
-- Tabel: public.inventory_sarpras
-- Menyimpan data aset, sarana, dan prasarana sekolah yang diinput oleh
-- Wakasek Sarana dan Prasarana (M. Iqbal Gustiawan) dan ditinjau oleh Kepala Sekolah.
-- Catatan: Tabel dibuat KOSONG tanpa data default agar data murni diinput dan dikelola sendiri.
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

-- Kebijakan RLS (CRUD Penuh: SELECT, INSERT, UPDATE, DELETE)
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
-- CATATAN: TIDAK ADA DATA DEFAULT (TABEL KOSONG SECARA DEFAULT)
-- Data diinput, diedit, dan dihapus langsung melalui aplikasi oleh petugas yang berwenang.
--
-- * Jika sebelumnya Anda sudah sempat mengeksekusi seed data demo di Supabase,
--   jalankan baris berikut di Supabase SQL Editor untuk mengosongkannya:
-- TRUNCATE TABLE public.inventory_sarpras;
-- ============================================================================
