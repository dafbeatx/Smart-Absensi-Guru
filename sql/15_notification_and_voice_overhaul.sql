-- =============================================================================
-- SMART ABSENSI GURU - SQL MIGRATION: 15_notification_and_voice_overhaul.sql
-- Description: 
-- 1. Create notification_preferences table with per-user settings & strict RLS
-- 2. Create notification_reads table for isolated per-user read states
-- 3. Hardening RLS on push_subscriptions (preventing unauthorized access)
-- 4. Extend notifications table with audience_role, severity, action_url, dedupe_key
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABEL: notification_preferences
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id                   TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  push_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  attendance_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  leave_enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  schedule_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  announcement_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  critical_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  voice_enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  sound_enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  attendance_sound_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  chime_enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  auto_greeting_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start         TEXT DEFAULT NULL, -- e.g. '21:00'
  quiet_hours_end           TEXT DEFAULT NULL, -- e.g. '05:00'
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_preferences_select_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_select_own" ON public.notification_preferences
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid()::text OR
    user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
  );

DROP POLICY IF EXISTS "notification_preferences_insert_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_insert_own" ON public.notification_preferences
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR
    user_id = auth.uid()::text OR
    user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
  );

DROP POLICY IF EXISTS "notification_preferences_update_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_update_own" ON public.notification_preferences
  FOR UPDATE USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid()::text OR
    user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
  );

DROP POLICY IF EXISTS "notification_preferences_delete_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_delete_own" ON public.notification_preferences
  FOR DELETE USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid()::text OR
    user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
  );

-- -----------------------------------------------------------------------------
-- 2. HARDENING RLS: push_subscriptions
-- Drop overly permissive policies from 14_web_push_subscriptions.sql
-- -----------------------------------------------------------------------------
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_select" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_insert" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_update" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_delete" ON public.push_subscriptions;

-- User only manages their own subscriptions, service role has complete access
CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid()::text OR
    user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
  );

CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR
    user_id = auth.uid()::text OR
    user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
  );

CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  FOR UPDATE USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid()::text OR
    user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
  );

CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
  FOR DELETE USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid()::text OR
    user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
  );

-- -----------------------------------------------------------------------------
-- 3. PERLUASAN TABEL: notifications
-- Menambahkan metadata audience, action_url, severity, dedupe_key
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS audience_role TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'INFO',
  ADD COLUMN IF NOT EXISTS action_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS action_date TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS action_target_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_audience ON public.notifications(audience_role);
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe_key ON public.notifications(dedupe_key);

-- -----------------------------------------------------------------------------
-- 4. TABEL: notification_reads (Status Baca Per User untuk Notifikasi Broadcast)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id TEXT NOT NULL,
  user_id         TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON public.notification_reads(user_id);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_reads_select_own" ON public.notification_reads;
CREATE POLICY "notification_reads_select_own" ON public.notification_reads
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid()::text OR
    user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
  );

DROP POLICY IF EXISTS "notification_reads_insert_own" ON public.notification_reads;
CREATE POLICY "notification_reads_insert_own" ON public.notification_reads
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR
    user_id = auth.uid()::text OR
    user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
  );

DROP POLICY IF EXISTS "notification_reads_delete_own" ON public.notification_reads;
CREATE POLICY "notification_reads_delete_own" ON public.notification_reads
  FOR DELETE USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid()::text OR
    user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
  );
