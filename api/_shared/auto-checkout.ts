// api/_shared/auto-checkout.ts
// Shared server-side Auto Check-Out helper (ONLY checks out teachers who already checked in).
// Respects dynamic Admin settings stored in system_settings.
// Kept inside api/_shared/ so it counts 0 toward Vercel's 12 serverless function limit.

import crypto from 'node:crypto';

export interface AutoCheckoutResult {
  ok: boolean;
  date: string;
  skippedReason?: 'WEEKEND' | 'HOLIDAY' | 'DISABLED_BY_SETTINGS' | 'AUTO_CHECKOUT_DISABLED' | 'BEFORE_TRIGGER_TIME';
  holidayName?: string;
  checkoutTimeApplied?: string;
  pointsAwardedPerTeacher?: number;
  processedCount: number;
  skippedNoCheckInCount: number;
  skippedAlreadyCheckedOutCount: number;
  skippedLeaveCount: number;
  updatedUserIds: string[];
  errors: string[];
}

function parseHhMmToMinutes(timeStr: string | null | undefined, fallbackMin: number): number {
  if (!timeStr) return fallbackMin;
  const clean = String(timeStr).trim().slice(0, 5);
  const parts = clean.split(':');
  if (parts.length < 2) return fallbackMin;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return fallbackMin;
  return h * 60 + m;
}

function minutesToHhMmSs(totalMin: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMin));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function getJakartaDateTimeInfo(targetDateStr?: string): { dateStr: string; dayOfWeek: number; currentHhMm: string; todayStr: string } {
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
  const currentHhMm = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour12: false, hour: '2-digit', minute: '2-digit' }).slice(0, 5);

  if (targetDateStr && /^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
    const [y, m, d] = targetDateStr.split('-').map(Number);
    return {
      dateStr: targetDateStr,
      dayOfWeek: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
      currentHhMm,
      todayStr,
    };
  }

  const [y, m, d] = todayStr.split('-').map(Number);
  return {
    dateStr: todayStr,
    dayOfWeek: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
    currentHhMm,
    todayStr,
  };
}

function isHolidayRowOffDay(h: any): boolean {
  if (!h) return false;
  if (h.category_type === 'SCHEDULE' || h.is_holiday === false) return false;
  if (
    h.is_holiday === undefined &&
    ['RAPAT', 'UJIAN', 'UPACARA', 'WORKSHOP', 'OTHER'].includes(String(h.type || '').toUpperCase())
  ) {
    return false;
  }
  return true;
}

function isBlockingLeaveRow(leave: any): boolean {
  if (!leave) return false;
  const status = String(leave.status || leave.approval_status || 'PENDING').toUpperCase().trim();
  const activeStatuses = ['APPROVED', 'APPROVED_BY_KEPSEK', 'PENDING', 'SUBMITTED', 'UNDER_REVIEW'];
  if (!activeStatuses.includes(status)) return false;

  const lType = String(leave.type || leave.leave_type || 'IZIN').toUpperCase().trim();
  if (lType !== 'KOREKSI_ABSEN') {
    return true; // SAKIT, IZIN, CUTI, DINAS_LUAR
  }

  const reason = String(leave.reason || '').toUpperCase();
  return (
    reason.includes('MENJADI SAKIT') ||
    reason.includes('MENJADI IZIN') ||
    reason.includes('MENJADI CUTI') ||
    reason.includes('MENJADI DINAS_LUAR') ||
    reason.includes('MENJADI ALFA')
  );
}

/**
 * Menjalankan Auto Absen Pulang (CHECK_OUT saja) pada hari kerja aktif sesuai Pengaturan Sistem Admin.
 * - Guru yang SUDAH absen masuk (HADIR / TERLAMBAT) dan belum pulang akan diisi check_out_time.
 * - Guru yang BELUM absen masuk TIDAK di-auto check-in (tetap mengikuti jalur manual Admin / absen mandiri).
 * - Menghormati toggle auto_attendance_enabled, auto_checkout_enabled, custom time, poin, libur, & izin.
 */
export async function runAutoCheckout(
  supabaseClient: any,
  options?: { targetDateStr?: string; forceRun?: boolean }
): Promise<AutoCheckoutResult> {
  const { dateStr, dayOfWeek, currentHhMm, todayStr } = getJakartaDateTimeInfo(options?.targetDateStr);
  const errors: string[] = [];

  // 1. Load system_settings including complete Auto Absen configuration
  let saturdayIsHoliday = true;
  let sundayIsHoliday = true;
  let workCheckoutStart = '12:00';
  let fridayCheckoutStart = '10:00';

  let autoAttendanceEnabled = true;
  let autoCheckoutEnabled = true;
  let autoCheckoutTimeMode: 'FOLLOW_SCHEDULE' | 'CUSTOM' = 'FOLLOW_SCHEDULE';
  let autoCheckoutCustomTime = '13:00';
  let autoCheckoutCustomFridayTime = '11:00';
  let autoCheckoutTriggerTime = '16:30';
  let autoCheckoutPoints = 10;
  let autoSkipHolidays = true;
  let autoSkipLeaves = true;
  let preserveCheckInSource = true;

  try {
    const { data: settingsRows } = await supabaseClient.from('system_settings').select('key, value');
    if (Array.isArray(settingsRows)) {
      const map: Record<string, string> = {};
      for (const row of settingsRows) {
        if (row?.key && row?.value !== undefined) {
          map[row.key] = String(row.value);
        }
      }
      if (map.saturday_is_holiday !== undefined) saturdayIsHoliday = map.saturday_is_holiday !== 'false';
      if (map.sunday_is_holiday !== undefined) sundayIsHoliday = map.sunday_is_holiday !== 'false';
      if (map.work_checkout_start) workCheckoutStart = map.work_checkout_start.slice(0, 5);
      if (map.friday_checkout_start) fridayCheckoutStart = map.friday_checkout_start.slice(0, 5);

      if (map.auto_attendance_enabled !== undefined) autoAttendanceEnabled = map.auto_attendance_enabled !== 'false';
      if (map.auto_checkout_enabled !== undefined) autoCheckoutEnabled = map.auto_checkout_enabled !== 'false';
      if (map.auto_checkout_time_mode === 'CUSTOM') autoCheckoutTimeMode = 'CUSTOM';
      if (map.auto_checkout_custom_time) autoCheckoutCustomTime = map.auto_checkout_custom_time.slice(0, 5);
      if (map.auto_checkout_custom_friday_time) autoCheckoutCustomFridayTime = map.auto_checkout_custom_friday_time.slice(0, 5);
      if (map.auto_checkout_trigger_time) autoCheckoutTriggerTime = map.auto_checkout_trigger_time.slice(0, 5);
      if (map.auto_checkout_points !== undefined) {
        const parsedPts = parseInt(map.auto_checkout_points, 10);
        if (!isNaN(parsedPts)) autoCheckoutPoints = Math.max(0, Math.min(20, parsedPts));
      }
      if (map.auto_attendance_skip_holidays !== undefined) autoSkipHolidays = map.auto_attendance_skip_holidays !== 'false';
      if (map.auto_attendance_skip_leaves !== undefined) autoSkipLeaves = map.auto_attendance_skip_leaves !== 'false';
      if (map.auto_checkout_preserve_checkin_source !== undefined) preserveCheckInSource = map.auto_checkout_preserve_checkin_source !== 'false';
    }
  } catch (err: any) {
    errors.push(`Warning loading system_settings: ${err?.message || String(err)}`);
  }

  // 1b. Respect master switches from Pengaturan
  if (!autoAttendanceEnabled) {
    return {
      ok: true,
      date: dateStr,
      skippedReason: 'DISABLED_BY_SETTINGS',
      processedCount: 0,
      skippedNoCheckInCount: 0,
      skippedAlreadyCheckedOutCount: 0,
      skippedLeaveCount: 0,
      updatedUserIds: [],
      errors,
    };
  }

  if (!autoCheckoutEnabled && !options?.forceRun) {
    return {
      ok: true,
      date: dateStr,
      skippedReason: 'AUTO_CHECKOUT_DISABLED',
      processedCount: 0,
      skippedNoCheckInCount: 0,
      skippedAlreadyCheckedOutCount: 0,
      skippedLeaveCount: 0,
      updatedUserIds: [],
      errors,
    };
  }

  // Respect trigger time only when executing live for TODAY via cron (skip when testing specific targetDateStr or forceRun)
  if (!options?.forceRun && !options?.targetDateStr && dateStr === todayStr) {
    if (parseHhMmToMinutes(currentHhMm, 0) < parseHhMmToMinutes(autoCheckoutTriggerTime, 16 * 60 + 30)) {
      return {
        ok: true,
        date: dateStr,
        skippedReason: 'BEFORE_TRIGGER_TIME',
        processedCount: 0,
        skippedNoCheckInCount: 0,
        skippedAlreadyCheckedOutCount: 0,
        skippedLeaveCount: 0,
        updatedUserIds: [],
        errors,
      };
    }
  }

  // 2. Weekend Guard
  if (autoSkipHolidays && ((dayOfWeek === 6 && saturdayIsHoliday) || (dayOfWeek === 0 && sundayIsHoliday))) {
    return {
      ok: true,
      date: dateStr,
      skippedReason: 'WEEKEND',
      processedCount: 0,
      skippedNoCheckInCount: 0,
      skippedAlreadyCheckedOutCount: 0,
      skippedLeaveCount: 0,
      updatedUserIds: [],
      errors,
    };
  }

  // 3. Holiday Guard
  if (autoSkipHolidays) {
    try {
      const { data: holidayRows } = await supabaseClient
        .from('holidays')
        .select('id, date, name, type, category_type, is_holiday')
        .eq('date', dateStr);

      const activeHoliday = Array.isArray(holidayRows) ? holidayRows.find(isHolidayRowOffDay) : null;
      if (activeHoliday) {
        return {
          ok: true,
          date: dateStr,
          skippedReason: 'HOLIDAY',
          holidayName: activeHoliday.name || 'Hari Libur',
          processedCount: 0,
          skippedNoCheckInCount: 0,
          skippedAlreadyCheckedOutCount: 0,
          skippedLeaveCount: 0,
          updatedUserIds: [],
          errors,
        };
      }
    } catch (err: any) {
      errors.push(`Warning checking holidays: ${err?.message || String(err)}`);
    }
  }

  // 4. Load active users, leaves, and today's attendance
  const { data: usersRows, error: usersErr } = await supabaseClient
    .from('users')
    .select('id, full_name, role, account_status');

  if (usersErr) {
    throw new Error(`Gagal membaca daftar user aktif: ${usersErr.message}`);
  }

  const activeUserById = new Map<string, { id: string; full_name: string }>();
  for (const u of usersRows || []) {
    if (!u?.id) continue;
    if (u.account_status && u.account_status !== 'ACTIVE') continue;
    const role = String(u.role || 'GURU').toUpperCase();
    if (role === 'GURU' || role === 'KEPSEK' || role === 'ADMIN' || role === 'OPERATOR' || role === '') {
      activeUserById.set(u.id, { id: u.id, full_name: u.full_name || 'Guru' });
    }
  }

  const leaveExcludedUserIds = new Set<string>();
  if (autoSkipLeaves) {
    try {
      const { data: leavesRows } = await supabaseClient
        .from('leaves')
        .select('id, user_id, type, status, start_date, end_date, reason')
        .lte('start_date', dateStr)
        .gte('end_date', dateStr);

      for (const l of leavesRows || []) {
        if (l?.user_id && isBlockingLeaveRow(l)) {
          leaveExcludedUserIds.add(l.user_id);
        }
      }
    } catch (err: any) {
      errors.push(`Warning checking leaves: ${err?.message || String(err)}`);
    }
  }

  const { data: attendanceRows, error: attErr } = await supabaseClient
    .from('attendance')
    .select('id, user_id, date, status, check_in_time, check_out_time, verification_method, attendance_source, notes')
    .eq('date', dateStr);

  if (attErr) {
    throw new Error(`Gagal membaca data presensi ${dateStr}: ${attErr.message}`);
  }

  const isFriday = dayOfWeek === 5;
  const officialCheckoutHhMm =
    autoCheckoutTimeMode === 'CUSTOM'
      ? (isFriday ? autoCheckoutCustomFridayTime : autoCheckoutCustomTime)
      : (isFriday ? fridayCheckoutStart : workCheckoutStart);
  const officialCheckoutMin = parseHhMmToMinutes(officialCheckoutHhMm, isFriday ? 10 * 60 : 12 * 60);

  const attendanceByUserId = new Map<string, any>();
  for (const row of attendanceRows || []) {
    if (row?.user_id) {
      attendanceByUserId.set(row.user_id, row);
    }
  }

  const updatedUserIds: string[] = [];
  let skippedNoCheckInCount = 0;
  let skippedAlreadyCheckedOutCount = 0;
  let skippedLeaveCount = 0;

  for (const [userId, user] of activeUserById.entries()) {
    if (autoSkipLeaves && leaveExcludedUserIds.has(userId)) {
      skippedLeaveCount++;
      continue;
    }

    const att = attendanceByUserId.get(userId);
    if (!att || !att.check_in_time) {
      skippedNoCheckInCount++;
      continue;
    }

    if (att.check_out_time) {
      skippedAlreadyCheckedOutCount++;
      continue;
    }

    const st = String(att.status || '').toUpperCase();
    if (st !== 'HADIR' && st !== 'TERLAMBAT') {
      skippedLeaveCount++;
      continue;
    }

    const checkInMin = parseHhMmToMinutes(att.check_in_time, 7 * 60);
    let targetCheckoutMin = officialCheckoutMin;
    if (checkInMin >= officialCheckoutMin) {
      targetCheckoutMin = Math.max(16 * 60 + 30, Math.min(23 * 60 + 55, checkInMin + 5));
    }

    const finalCheckOutTime = minutesToHhMmSs(targetCheckoutMin);
    const displayCheckout = finalCheckOutTime.slice(0, 5);
    const autoNoteTag = `Auto Pulang (${displayCheckout} WIB)`;
    const nextNotes = att.notes ? `${att.notes} • ${autoNoteTag}` : `Presensi pulang otomatis sistem (${autoNoteTag})`;

    const updatePayload: Record<string, unknown> = {
      check_out_time: finalCheckOutTime,
      notes: nextNotes,
    };

    if (!preserveCheckInSource) {
      updatePayload.verification_method = 'SYSTEM_AUTO';
      updatePayload.attendance_source = 'SYSTEM_AUTO';
    }

    let { error: updErr } = await supabaseClient
      .from('attendance')
      .update(updatePayload)
      .eq('id', att.id);

    if (updErr && (String(updErr.message || '').includes('notes') || String(updErr.message || '').includes('column'))) {
      delete updatePayload.notes;
      delete updatePayload.verification_method;
      delete updatePayload.attendance_source;
      const retry = await supabaseClient
        .from('attendance')
        .update({ check_out_time: finalCheckOutTime })
        .eq('id', att.id);
      updErr = retry.error;
    }

    if (updErr) {
      errors.push(`Gagal update auto checkout ${userId}: ${updErr.message}`);
      continue;
    }

    updatedUserIds.push(userId);

    // Idempotent CHECK_OUT points ledger entry based on configured auto_checkout_points
    try {
      const idempotencyKey = `att:${userId}:${dateStr}:CHECK_OUT`;
      const { data: existingPoint } = await supabaseClient
        .from('teacher_point_history')
        .select('id')
        .eq('user_id', userId)
        .eq('date', dateStr)
        .eq('activity_type', 'CHECK_OUT')
        .maybeSingle();

      if (!existingPoint) {
        const pointId = typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `pt_co_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        await supabaseClient.from('teacher_point_history').insert({
          id: pointId,
          user_id: userId,
          teacher_name: user.full_name,
          date: dateStr,
          points: autoCheckoutPoints,
          activity_type: 'CHECK_OUT',
          title: autoCheckoutPoints > 0
            ? 'Presensi Pulang Tuntas Bertugas'
            : 'Presensi Pulang Otomatis (0 Poin)',
          description: `Tercatat presensi pulang otomatis sistem pada pukul ${displayCheckout} WIB`,
          idempotency_key: idempotencyKey,
          status: 'VALID',
          source: 'SYSTEM',
          occurred_at: dateStr,
          created_at: new Date().toISOString(),
        });
      }
    } catch (ptErr: any) {
      const msg = String(ptErr?.message || '');
      if (!msg.includes('duplicate') && !msg.includes('23505')) {
        errors.push(`Warning recording checkout point ${userId}: ${msg}`);
      }
    }
  }

  return {
    ok: true,
    date: dateStr,
    checkoutTimeApplied: `${officialCheckoutHhMm}:00`,
    pointsAwardedPerTeacher: autoCheckoutPoints,
    processedCount: updatedUserIds.length,
    skippedNoCheckInCount,
    skippedAlreadyCheckedOutCount,
    skippedLeaveCount,
    updatedUserIds,
    errors,
  };
}
