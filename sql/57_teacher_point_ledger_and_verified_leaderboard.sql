-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 57: TEACHER POINT LEDGER, SUMMARY & AUDIT REWARDS
-- Single Source of Truth, Signed Point Arithmetic, Strict RLS, and Rollback Strategy
-- Tanggal: 2026-10-02
-- Dependensi: public.users, public.teacher_point_history
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. HARDENING TABEL: public.teacher_point_history (LEDGER POIN RESMI)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Kolom status: VALID atau VOIDED
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'teacher_point_history' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.teacher_point_history ADD COLUMN status TEXT NOT NULL DEFAULT 'VALID';
  END IF;

  -- Kolom voided_at: timestamp saat log dibatalkan/void
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'teacher_point_history' AND column_name = 'voided_at'
  ) THEN
    ALTER TABLE public.teacher_point_history ADD COLUMN voided_at TIMESTAMPTZ;
  END IF;

  -- Kolom void_reason: alasan resmi pembatalan log poin
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'teacher_point_history' AND column_name = 'void_reason'
  ) THEN
    ALTER TABLE public.teacher_point_history ADD COLUMN void_reason TEXT;
  END IF;

  -- Kolom source: asal usul poin (ATTENDANCE, DUTY, MANUAL, SYSTEM, RECONCILIATION)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'teacher_point_history' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.teacher_point_history ADD COLUMN source TEXT NOT NULL DEFAULT 'SYSTEM';
  END IF;

  -- Kolom occurred_at: waktu kejadian presensi / aktivitas (Asia/Jakarta timezone)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'teacher_point_history' AND column_name = 'occurred_at'
  ) THEN
    ALTER TABLE public.teacher_point_history ADD COLUMN occurred_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Kolom idempotency_key: jaminan idempotency transaksi poin
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'teacher_point_history' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.teacher_point_history ADD COLUMN idempotency_key TEXT;
  END IF;
END $$;

-- Validasi constraint status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_teacher_point_status'
  ) THEN
    ALTER TABLE public.teacher_point_history 
      ADD CONSTRAINT chk_teacher_point_status CHECK (status IN ('VALID', 'VOIDED'));
  END IF;
END $$;

-- Indeks performa untuk agregasi bulanan & klasemen
CREATE INDEX IF NOT EXISTS idx_teacher_point_history_user_month 
  ON public.teacher_point_history (user_id, date, status);

CREATE INDEX IF NOT EXISTS idx_teacher_point_history_status_date 
  ON public.teacher_point_history (status, date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABEL BARU: public.teacher_monthly_point_summary
-- Rekapitulasi berkala poin signed per guru per bulan (YYYY-MM Asia/Jakarta)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_monthly_point_summary (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  year_month             TEXT NOT NULL, -- Format: YYYY-MM
  gross_positive_points  INTEGER NOT NULL DEFAULT 0,
  penalty_points         INTEGER NOT NULL DEFAULT 0,
  total_points_signed    INTEGER NOT NULL DEFAULT 0,
  on_time_count          INTEGER NOT NULL DEFAULT 0,
  late_count             INTEGER NOT NULL DEFAULT 0,
  early_bird_count       INTEGER NOT NULL DEFAULT 0,
  duty_count             INTEGER NOT NULL DEFAULT 0,
  active_days            INTEGER NOT NULL DEFAULT 0,
  valid_log_count        INTEGER NOT NULL DEFAULT 0,
  data_status            TEXT NOT NULL DEFAULT 'SYNCED', -- SYNCED, PARTIAL, ERROR
  calculated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_teacher_monthly_summary UNIQUE (user_id, year_month),
  CONSTRAINT chk_summary_data_status CHECK (data_status IN ('SYNCED', 'PARTIAL', 'ERROR'))
);

CREATE INDEX IF NOT EXISTS idx_monthly_summary_period_points 
  ON public.teacher_monthly_point_summary (year_month, total_points_signed DESC);

CREATE INDEX IF NOT EXISTS idx_monthly_summary_user 
  ON public.teacher_monthly_point_summary (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABEL BARU: public.teacher_point_reward_decisions
-- Rekam Keputusan Hadiah Prerogatif Kepala Sekolah (Audit Trail)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_point_reward_decisions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period                   TEXT NOT NULL, -- Format: YYYY-MM atau 'Bulan YYYY'
  teacher_user_id          TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  approved_by              TEXT NOT NULL REFERENCES public.users(id),
  approved_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  leaderboard_snapshot_id  TEXT NOT NULL,
  reason                   TEXT,
  reward_detail            TEXT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_reward_decision_period UNIQUE (period)
);

CREATE INDEX IF NOT EXISTS idx_reward_decision_teacher 
  ON public.teacher_point_reward_decisions (teacher_user_id);

CREATE INDEX IF NOT EXISTS idx_reward_decision_period 
  ON public.teacher_point_reward_decisions (period);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY (RLS) KETAT TANPA USING(TRUE) ATAU WITH CHECK(TRUE)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.teacher_point_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_monthly_point_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_point_reward_decisions ENABLE ROW LEVEL SECURITY;

-- Helper security check untuk role guru/admin/kepsek yang aktif
CREATE OR REPLACE FUNCTION public.check_is_active_staff_v2()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_is_auth BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = auth.uid()::text OR (u.auth_user_id IS NOT NULL AND u.auth_user_id = auth.uid()))
      AND u.account_status = 'ACTIVE'
      AND u.role IN ('ADMIN', 'GURU', 'KEPSEK', 'KEPALA SEKOLAH', 'OPERATOR')
  ) INTO v_is_auth;
  RETURN v_is_auth;
END;
$$;

-- Helper check untuk kepala sekolah / admin
CREATE OR REPLACE FUNCTION public.check_is_school_leader()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_is_leader BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = auth.uid()::text OR (u.auth_user_id IS NOT NULL AND u.auth_user_id = auth.uid()))
      AND u.account_status = 'ACTIVE'
      AND u.role IN ('ADMIN', 'KEPSEK', 'KEPALA SEKOLAH')
  ) INTO v_is_leader;
  RETURN v_is_leader;
END;
$$;

-- Policy RLS untuk public.teacher_point_history
DROP POLICY IF EXISTS "tph_staff_select" ON public.teacher_point_history;
CREATE POLICY "tph_staff_select" ON public.teacher_point_history
  FOR SELECT TO authenticated
  USING (public.check_is_active_staff_v2());

-- Dilarang direct INSERT/UPDATE/DELETE dari browser umum (hanya service_role atau proxy terverifikasi)
REVOKE ALL ON public.teacher_point_history FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.teacher_point_history FROM authenticated;
GRANT SELECT ON public.teacher_point_history TO authenticated;
GRANT ALL ON public.teacher_point_history TO service_role;

-- Policy RLS untuk public.teacher_monthly_point_summary
DROP POLICY IF EXISTS "tmps_staff_select" ON public.teacher_monthly_point_summary;
CREATE POLICY "tmps_staff_select" ON public.teacher_monthly_point_summary
  FOR SELECT TO authenticated
  USING (public.check_is_active_staff_v2());

REVOKE ALL ON public.teacher_monthly_point_summary FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.teacher_monthly_point_summary FROM authenticated;
GRANT SELECT ON public.teacher_monthly_point_summary TO authenticated;
GRANT ALL ON public.teacher_monthly_point_summary TO service_role;

-- Policy RLS untuk public.teacher_point_reward_decisions
DROP POLICY IF EXISTS "tprd_staff_select" ON public.teacher_point_reward_decisions;
CREATE POLICY "tprd_staff_select" ON public.teacher_point_reward_decisions
  FOR SELECT TO authenticated
  USING (public.check_is_active_staff_v2());

DROP POLICY IF EXISTS "tprd_leader_insert" ON public.teacher_point_reward_decisions;
CREATE POLICY "tprd_leader_insert" ON public.teacher_point_reward_decisions
  FOR INSERT TO authenticated
  WITH CHECK (public.check_is_school_leader());

DROP POLICY IF EXISTS "tprd_leader_update" ON public.teacher_point_reward_decisions;
CREATE POLICY "tprd_leader_update" ON public.teacher_point_reward_decisions
  FOR UPDATE TO authenticated
  USING (public.check_is_school_leader())
  WITH CHECK (public.check_is_school_leader());

REVOKE ALL ON public.teacher_point_reward_decisions FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.teacher_point_reward_decisions TO authenticated;
GRANT ALL ON public.teacher_point_reward_decisions TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC FUNCTION: public.get_verified_teacher_leaderboard
-- Agregasi peringkat terverifikasi dari ledger resmi (signed arithmetic)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_verified_teacher_leaderboard(p_year_month TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_result JSONB;
BEGIN
  -- Validasi parameter format YYYY-MM
  IF p_year_month IS NULL OR NOT (p_year_month ~ '^\d{4}-\d{2}$') THEN
    p_year_month := to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM');
  END IF;

  v_start_date := (p_year_month || '-01')::DATE;
  v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  WITH active_teachers AS (
    SELECT 
      u.id AS user_id,
      u.full_name AS name,
      u.nip,
      COALESCE(u.position, 'Guru Pengajar') AS position,
      u.avatar_url,
      u.role
    FROM public.users u
    WHERE u.account_status = 'ACTIVE'
      AND u.role = 'GURU' -- Hanya guru yang eligible masuk peringkat
  ),
  point_agg AS (
    SELECT 
      l.user_id,
      COALESCE(SUM(CASE WHEN l.points > 0 THEN l.points ELSE 0 END), 0) AS gross_positive_points,
      COALESCE(SUM(CASE WHEN l.points < 0 THEN l.points ELSE 0 END), 0) AS penalty_points,
      COALESCE(SUM(l.points), 0) AS net_points,
      COUNT(CASE WHEN l.activity_type = 'CHECK_IN_ON_TIME' THEN 1 END) AS on_time_count,
      COUNT(CASE WHEN l.activity_type = 'CHECK_IN_LATE' THEN 1 END) AS late_count,
      COUNT(CASE WHEN l.activity_type = 'EARLY_BIRD_BONUS' THEN 1 END) AS early_bird_count,
      COUNT(CASE WHEN l.activity_type = 'DUTY_PIKET' THEN 1 END) AS duty_count,
      COUNT(CASE WHEN l.activity_type = 'STREAK_MILESTONE' THEN 1 END) AS streak_count,
      COUNT(DISTINCT l.date) AS active_days,
      COUNT(l.id) AS valid_log_count
    FROM public.teacher_point_history l
    WHERE l.status = 'VALID'
      AND l.date >= v_start_date 
      AND l.date <= v_end_date
    GROUP BY l.user_id
  ),
  approved_leaves AS (
    SELECT DISTINCT lr.user_id
    FROM public.leave_requests lr
    WHERE lr.status = 'APPROVED'
      AND lr.start_date <= v_end_date
      AND lr.end_date >= v_start_date
  ),
  scored_teachers AS (
    SELECT 
      t.user_id AS id,
      t.name,
      t.nip,
      t.position,
      t.avatar_url,
      COALESCE(p.gross_positive_points, 0) AS gross_positive_points,
      COALESCE(p.penalty_points, 0) AS penalty_points,
      COALESCE(p.net_points, 0) AS total_points, -- SIGNED NET POINTS
      COALESCE(p.on_time_count, 0) AS hadir_tepat_waktu_count,
      COALESCE(p.late_count, 0) AS terlambat_count,
      COALESCE(p.early_bird_count, 0) AS early_bird_count,
      COALESCE(p.duty_count, 0) AS piket_count,
      COALESCE(p.streak_count, 0) AS streak_count,
      CASE 
        WHEN COALESCE(p.valid_log_count, 0) > 0 THEN 'ACTIVE'
        WHEN al.user_id IS NOT NULL THEN 'ON_LEAVE'
        ELSE 'NO_ACTIVITY'
      END AS status
    FROM active_teachers t
    LEFT JOIN point_agg p ON p.user_id = t.user_id
    LEFT JOIN approved_leaves al ON al.user_id = t.user_id
  ),
  ranked AS (
    SELECT 
      s.*,
      DENSE_RANK() OVER (
        ORDER BY 
          s.total_points DESC,
          s.hadir_tepat_waktu_count DESC,
          s.early_bird_count DESC,
          s.terlambat_count ASC
      ) AS rank,
      COUNT(*) OVER (
        PARTITION BY 
          s.total_points,
          s.hadir_tepat_waktu_count,
          s.early_bird_count,
          s.terlambat_count
      ) AS tie_count
    FROM scored_teachers s
  )
  SELECT jsonb_build_object(
    'year_month', p_year_month,
    'data_status', 'SYNCED',
    'calculated_at', NOW(),
    'snapshot_id', 'snap_' || p_year_month || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    'leaderboard', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'nip', r.nip,
        'position', r.position,
        'avatar_url', r.avatar_url,
        'totalPoints', r.total_points,
        'grossPositivePoints', r.gross_positive_points,
        'penaltyPoints', r.penalty_points,
        'netPoints', r.total_points,
        'hadirTepatWaktuCount', r.hadir_tepat_waktu_count,
        'terlambatCount', r.terlambat_count,
        'earlyBirdCount', r.early_bird_count,
        'piketCount', r.piket_count,
        'streakCount', r.streak_count,
        'status', r.status,
        'rank', r.rank,
        'isTie', (r.tie_count > 1),
        'level', CASE 
          WHEN r.status = 'ON_LEAVE' THEN '🏖️ Sedang Cuti Resmi'
          WHEN r.rank = 1 AND r.total_points > 0 AND r.tie_count = 1 THEN '🏆 Pendidik Teladan Utama'
          WHEN r.rank <= 3 AND r.total_points > 0 THEN '🥇 Pendidik Disiplin Emas'
          WHEN r.rank <= 6 AND r.total_points > 0 THEN '🥈 Pendidik Berdedikasi'
          ELSE '🥉 Pendidik Berkomitmen'
        END
      ) ORDER BY r.rank, r.name
    ), '[]'::JSONB)
  ) INTO v_result
  FROM ranked r;

  RETURN v_result;
END;
$$;

-- Grant eksekusi RPC ke authenticated staff
GRANT EXECUTE ON FUNCTION public.get_verified_teacher_leaderboard(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_verified_teacher_leaderboard(TEXT) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC FUNCTION: public.void_teacher_point_log (AUDIT VOID/REVERSAL)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.void_teacher_point_log(
  p_log_id TEXT,
  p_reason TEXT,
  p_actor_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated RECORD;
BEGIN
  IF NOT public.check_is_school_leader() THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya Kepala Sekolah dan Admin yang berhak membatalkan poin guru.';
  END IF;

  UPDATE public.teacher_point_history
  SET 
    status = 'VOIDED',
    voided_at = NOW(),
    void_reason = COALESCE(p_reason, 'Dibatalkan oleh Pengawas / Admin')
  WHERE id::text = p_log_id
    AND status = 'VALID'
  RETURNING id, user_id, date, points, activity_type, status, voided_at, void_reason
  INTO v_updated;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Log poin tidak ditemukan atau sudah dibatalkan sebelumnya.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_updated.id,
    'user_id', v_updated.user_id,
    'points_reverted', v_updated.points,
    'voided_at', v_updated.voided_at,
    'reason', v_updated.void_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_teacher_point_log(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_teacher_point_log(TEXT, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- STRATEGI ROLLBACK (DOKUMENTASI UNTUK DOKTER BASIS DATA)
-- ─────────────────────────────────────────────────────────────────────────────
-- Bila hendak membatalkan migrasi 57 ini tanpa merusak data:
-- 1. DROP FUNCTION IF EXISTS public.get_verified_teacher_leaderboard(TEXT);
-- 2. DROP FUNCTION IF EXISTS public.void_teacher_point_log(TEXT, TEXT, TEXT);
-- 3. DROP TABLE IF EXISTS public.teacher_point_reward_decisions CASCADE;
-- 4. DROP TABLE IF EXISTS public.teacher_monthly_point_summary CASCADE;
-- 5. ALTER TABLE public.teacher_point_history DROP CONSTRAINT IF EXISTS chk_teacher_point_status;
-- 6. ALTER TABLE public.teacher_point_history DROP COLUMN IF EXISTS status;
-- 7. ALTER TABLE public.teacher_point_history DROP COLUMN IF EXISTS voided_at;
-- 8. ALTER TABLE public.teacher_point_history DROP COLUMN IF EXISTS void_reason;
-- 9. ALTER TABLE public.teacher_point_history DROP COLUMN IF EXISTS source;
-- 10. NOTIFY pgrst, 'reload schema';
