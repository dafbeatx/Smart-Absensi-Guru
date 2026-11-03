-- ==============================================================================
-- MIGRATION 68: UPGRADE TEACHER VERIFIED LEADERBOARD RPC (ANTI-TIE ENGINE)
-- Meningkatkan algoritma pemutus seri (tie-breaker) deterministik dan 
-- menyelaraskan sebutan predikat resmi pada fungsi get_teacher_verified_leaderboard_v1.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_teacher_verified_leaderboard_v1(
  p_year_month VARCHAR(7) -- Format: 'YYYY-MM'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  -- 1. Validasi input format YYYY-MM
  IF p_year_month IS NULL OR p_year_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Format p_year_month tidak valid. Wajib YYYY-MM (misal: 2026-10)';
  END IF;

  v_start_date := TO_DATE(p_year_month || '-01', 'YYYY-MM-DD');
  v_end_date := (v_start_date + INTERVAL '1 month - 1 day')::DATE;

  -- 2. Bangun leaderboard terverifikasi dengan multi-level tie-breaker
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
      COUNT(CASE WHEN l.activity_type = 'CHECK_OUT' THEN 1 END) AS checkout_count,
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
      COALESCE(p.checkout_count, 0) AS checkout_count,
      COALESCE(p.early_bird_count, 0) AS early_bird_count,
      COALESCE(p.duty_count, 0) AS piket_count,
      COALESCE(p.streak_count, 0) AS streak_count,
      CASE 
        WHEN (COALESCE(p.on_time_count, 0) + COALESCE(p.late_count, 0)) > 0 THEN
          LEAST(100, ROUND((COALESCE(p.checkout_count, 0)::NUMERIC / (p.on_time_count + p.late_count)::NUMERIC) * 100))
        ELSE 100
      END AS checkout_completion_rate,
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
          s.checkout_completion_rate DESC,
          s.hadir_tepat_waktu_count DESC,
          s.early_bird_count DESC,
          s.piket_count DESC,
          s.terlambat_count ASC
      ) AS rank,
      COUNT(*) OVER (
        PARTITION BY 
          s.total_points,
          s.checkout_completion_rate,
          s.hadir_tepat_waktu_count,
          s.early_bird_count,
          s.piket_count,
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
        'checkOutCompletionRate', r.checkout_completion_rate,
        'status', r.status,
        'rank', r.rank,
        'isTie', (r.tie_count > 1),
        'level', CASE 
          WHEN r.status = 'ON_LEAVE' THEN '🏖️ Sedang Cuti Resmi'
          WHEN r.total_points <= 0 THEN '⏳ Belum Ada Aktivitas'
          WHEN r.rank = 1 THEN '🏆 Super Disiplin'
          WHEN r.rank = 2 THEN '🥈 Sangat Disiplin'
          WHEN r.rank = 3 THEN '🥉 Disiplin'
          WHEN r.rank = 4 THEN '🎖️ Cukup Disiplin'
          WHEN r.rank = 5 THEN '⭐ Tertib Waktu'
          WHEN r.rank = 6 THEN '🛡️ Berdedikasi Aktif'
          WHEN r.rank = 7 THEN '🌟 Berkomitmen Kuat'
          WHEN r.rank = 8 THEN '📈 Tumbuh Disiplin'
          WHEN r.rank = 9 THEN '🎯 Menuju Konsistensi'
          WHEN r.rank = 10 THEN '⚡ Perlu Penguatan Disiplin'
          WHEN r.rank = 11 THEN '🌱 Tahap Pembinaan Waktu'
          ELSE '⚠️ Perlu Evaluasi Kehadiran'
        END,
        'rankPredicate', CASE 
          WHEN r.status = 'ON_LEAVE' THEN 'Sedang Cuti Resmi'
          WHEN r.total_points <= 0 THEN 'Belum Ada Aktivitas'
          WHEN r.rank = 1 THEN 'Super Disiplin'
          WHEN r.rank = 2 THEN 'Sangat Disiplin'
          WHEN r.rank = 3 THEN 'Disiplin'
          WHEN r.rank = 4 THEN 'Cukup Disiplin'
          WHEN r.rank = 5 THEN 'Tertib Waktu'
          WHEN r.rank = 6 THEN 'Berdedikasi Aktif'
          WHEN r.rank = 7 THEN 'Berkomitmen Kuat'
          WHEN r.rank = 8 THEN 'Tumbuh Disiplin'
          WHEN r.rank = 9 THEN 'Menuju Konsistensi'
          WHEN r.rank = 10 THEN 'Perlu Penguatan Disiplin'
          WHEN r.rank = 11 THEN 'Tahap Pembinaan Waktu'
          ELSE 'Perlu Evaluasi Kehadiran'
        END
      ) ORDER BY r.rank, r.name
    ), '[]'::JSONB)
  ) INTO v_result
  FROM ranked r;

  RETURN v_result;
END;
$$;

