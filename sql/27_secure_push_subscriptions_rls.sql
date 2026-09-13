-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 27: HARDENING WEB PUSH SUBSCRIPTIONS & RLS
-- Fitur: Keamanan Web Push Notification (Zero-Trust Backend Proxy)
-- Tabel Terkait: public.push_subscriptions
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PEMBARUAN STRUKTUR TABEL push_subscriptions (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    device_type TEXT DEFAULT 'MOBILE' CHECK (device_type IN ('MOBILE', 'DESKTOP', 'TABLET', 'UNKNOWN')),
    user_agent TEXT,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tambahkan kolom audit yang mungkin belum ada di instalasi lama
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'MOBILE' CHECK (device_type IN ('MOBILE', 'DESKTOP', 'TABLET', 'UNKNOWN')),
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Pastikan constraint UNIQUE pada endpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_endpoint_key'
  ) THEN
    ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Indexes untuk pencarian cepat berdasarkan user_id, endpoint, dan timestamp
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_last_seen ON public.push_subscriptions(last_seen_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. AKTIFKAN ROW LEVEL SECURITY (RLS) & BERSIHKAN POLICY LAMA
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop seluruh policy lama (baik permissive maupun yang bermasalah)
DROP POLICY IF EXISTS "push_subscriptions_select" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_insert" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_update" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_delete" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_service_role_all" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_user_own_select" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_user_own_insert" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_user_own_update" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_user_own_delete" ON public.push_subscriptions;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. KEBIJAKAN RLS KETAT BARU (Zero-Trust Backend Proxy Pattern)
-- ─────────────────────────────────────────────────────────────────────────────

-- A. Akses Penuh untuk Backend Serverless (Service Role / Supabase Admin)
-- Endpoint /api/push-subscriptions dan /api/send-push menggunakan service role
CREATE POLICY "push_subscriptions_service_role_all" ON public.push_subscriptions
  FOR ALL
  TO public
  USING (
    current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
    OR auth.role() = 'service_role'
  );

-- B. Kebijakan untuk Supabase Auth Session (Jika user memiliki session Auth aktif)
CREATE POLICY "push_subscriptions_user_own_select" ON public.push_subscriptions
  FOR SELECT
  TO public
  USING (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()::text
          AND UPPER(u.role) IN ('ADMIN', 'OPERATOR')
      )
    )
  );

CREATE POLICY "push_subscriptions_user_own_insert" ON public.push_subscriptions
  FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() IS NOT NULL AND user_id = auth.uid()::text
  );

CREATE POLICY "push_subscriptions_user_own_update" ON public.push_subscriptions
  FOR UPDATE
  TO public
  USING (
    auth.uid() IS NOT NULL AND user_id = auth.uid()::text
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND user_id = auth.uid()::text
  );

CREATE POLICY "push_subscriptions_user_own_delete" ON public.push_subscriptions
  FOR DELETE
  TO public
  USING (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()::text
          AND UPPER(u.role) IN ('ADMIN', 'OPERATOR')
      )
    )
  );

-- Catatan Keamanan:
-- Untuk koneksi klien anonim (auth.role() = 'anon'), RLS ini otomatis menerapkan DENY-BY-DEFAULT.
-- Browser tidak diizinkan melakukan bypass langsung ke tabel push_subscriptions,
-- melainkan WAJIB melalui server-side proxy terautentikasi: POST /api/push-subscriptions.

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
