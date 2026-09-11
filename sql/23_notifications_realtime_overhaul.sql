-- ==============================================================================
-- SMART ABSENSI GURU - MIGRATION 23: NOTIFICATIONS REAL-TIME & READ-STATE OVERHAUL
-- Deskripsi:
-- 1. Standardisasi tabel public.notifications sebagai immutable event master
-- 2. Standardisasi tabel public.notification_reads sebagai single source of truth status baca per-user
-- 3. Mengaktifkan Supabase Realtime Replication pada notifications & notification_reads
-- 4. Migrasi data status baca legacy (personal notifications) ke notification_reads
-- 5. Menetapkan Row Level Security (RLS) ketat tanpa USING(true) atau WITH CHECK(true)
-- ==============================================================================

-- 1. Standardisasi Tabel public.notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  audience_role TEXT DEFAULT NULL,
  type TEXT NOT NULL DEFAULT 'INFO',
  severity TEXT NOT NULL DEFAULT 'INFO',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  action_type TEXT,
  action_date TEXT,
  action_target_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  is_read BOOLEAN NOT NULL DEFAULT FALSE, -- Hanya dipertahankan untuk backward-compatibility data lama
  expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pastikan seluruh kolom terstruktur ada pada notifications jika tabel sudah dibuat sebelumnya
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='recipient_user_id') THEN
    ALTER TABLE public.notifications ADD COLUMN recipient_user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='audience_role') THEN
    ALTER TABLE public.notifications ADD COLUMN audience_role TEXT DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='severity') THEN
    ALTER TABLE public.notifications ADD COLUMN severity TEXT NOT NULL DEFAULT 'INFO';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='action_url') THEN
    ALTER TABLE public.notifications ADD COLUMN action_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='action_type') THEN
    ALTER TABLE public.notifications ADD COLUMN action_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='action_date') THEN
    ALTER TABLE public.notifications ADD COLUMN action_date TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='action_target_id') THEN
    ALTER TABLE public.notifications ADD COLUMN action_target_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='payload') THEN
    ALTER TABLE public.notifications ADD COLUMN payload JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='dedupe_key') THEN
    ALTER TABLE public.notifications ADD COLUMN dedupe_key TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='revision') THEN
    ALTER TABLE public.notifications ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='expires_at') THEN
    ALTER TABLE public.notifications ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='resolved_at') THEN
    ALTER TABLE public.notifications ADD COLUMN resolved_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='created_by') THEN
    ALTER TABLE public.notifications ADD COLUMN created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Sinkronisasi user_id legacy ke recipient_user_id
UPDATE public.notifications
SET recipient_user_id = user_id
WHERE recipient_user_id IS NULL AND user_id IS NOT NULL;

-- Index performa untuk pencarian notifications
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created 
  ON public.notifications(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_audience_created 
  ON public.notifications(audience_role, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_key_unique 
  ON public.notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;

-- 2. Standardisasi Tabel public.notification_reads (Single Source of Truth)
CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user_date 
  ON public.notification_reads(user_id, read_at DESC);

-- 3. Migrasi Status Baca Legacy (Hanya untuk notifikasi personal agar broadcast tidak tercemar)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='is_read') THEN
    INSERT INTO public.notification_reads (notification_id, user_id, read_at)
    SELECT 
      id::TEXT AS notification_id,
      COALESCE(recipient_user_id, user_id) AS user_id,
      COALESCE(created_at, NOW()) AS read_at
    FROM public.notifications
    WHERE is_read = TRUE 
      AND COALESCE(recipient_user_id, user_id) IS NOT NULL
    ON CONFLICT (notification_id, user_id) DO NOTHING;
  END IF;
END $$;

-- 4. Enable Supabase Realtime Replication
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.notification_reads REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notification_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_reads;
  END IF;
END $$;

-- 5. Row Level Security (RLS) Policies Ketat Tanpa USING(true)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- 5.1 Policies public.notifications
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
CREATE POLICY "notifications_select_policy" ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    -- 1. Notifikasi personal ditujukan langsung ke user login
    recipient_user_id = auth.uid()::TEXT
    OR user_id = auth.uid()::TEXT
    -- 2. Notifikasi broadcast untuk semua orang
    OR audience_role = 'ALL'
    OR audience_role IS NULL
    -- 3. Notifikasi sesuai role user pemohon
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::TEXT
        AND (
          u.role = notifications.audience_role
          OR (u.role = 'OPERATOR' AND notifications.audience_role = 'ADMIN')
        )
    )
    -- 4. Backend service role bypass
    OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('ADMIN', 'KEPSEK', 'OPERATOR')
  );

DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
CREATE POLICY "notifications_insert_policy" ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Hanya Admin, Operator, atau sistem service_role yang berhak membuat master notifikasi
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::TEXT
        AND u.role IN ('ADMIN', 'OPERATOR', 'KEPSEK')
    )
    OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  );

DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
CREATE POLICY "notifications_update_policy" ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::TEXT
        AND u.role IN ('ADMIN', 'OPERATOR')
    )
    OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  );

DROP POLICY IF EXISTS "notifications_delete_policy" ON public.notifications;
CREATE POLICY "notifications_delete_policy" ON public.notifications
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::TEXT
        AND u.role = 'ADMIN'
    )
    OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  );

-- 5.2 Policies public.notification_reads (Isolasi Mutlak Status Baca Per-User)
DROP POLICY IF EXISTS "notification_reads_select_own" ON public.notification_reads;
CREATE POLICY "notification_reads_select_own" ON public.notification_reads
  FOR SELECT
  TO authenticated
  USING (
    -- Pengguna HANYA boleh membaca status bacanya sendiri
    user_id = auth.uid()::TEXT
    OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  );

DROP POLICY IF EXISTS "notification_reads_insert_own" ON public.notification_reads;
CREATE POLICY "notification_reads_insert_own" ON public.notification_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Pengguna HANYA boleh mencatat status bacanya sendiri
    user_id = auth.uid()::TEXT
    OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  );

DROP POLICY IF EXISTS "notification_reads_update_own" ON public.notification_reads;
CREATE POLICY "notification_reads_update_own" ON public.notification_reads
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()::TEXT
    OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  );

DROP POLICY IF EXISTS "notification_reads_delete_own" ON public.notification_reads;
CREATE POLICY "notification_reads_delete_own" ON public.notification_reads
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()::TEXT
    OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  );
