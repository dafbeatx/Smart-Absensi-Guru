/**
 * SMART ABSENSI GURU — ATTENDANCE REMINDER SETTINGS & ACCURACY TEST SUITE
 * Memverifikasi akurasi waktu pengingat masuk (06:30) & pulang (13:00 / 11:00 Jumat)
 * serta memastikan konfigurasi pengingat di pengaturan tersimpan & tersinkronisasi.
 */

import { useSettingsStore, DEFAULT_SYSTEM_SETTINGS } from '../../store/useSettingsStore';
import { NotificationService } from '../notification-permission.service';
import { CONSTANTS } from '../../config/constants';
import { ProviderFactory } from '../../providers/provider-factory';

export const runAttendanceReminderSettingsTestSuite = async (): Promise<{
  passed: number;
  failed: number;
  results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }>;
}> => {
  const results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }> = [];
  let passed = 0;
  let failed = 0;

  const assert = (testName: string, condition: boolean, details?: string) => {
    if (condition) {
      passed++;
      results.push({ testName, status: 'PASS', details });
    } else {
      failed++;
      results.push({ testName, status: 'FAIL', details });
    }
  };

  try {
    // ── Test 1: Nilai Default Pengingat Masuk & Pulang
    assert(
      'Default Reminder Checkin: Default pengingat masuk adalah 06:30 WIB',
      CONSTANTS.DEFAULTS.REMINDER_CHECKIN_TIME === '06:30' &&
      DEFAULT_SYSTEM_SETTINGS.reminder_checkin_time === '06:30',
      `Checkin default: ${CONSTANTS.DEFAULTS.REMINDER_CHECKIN_TIME}`
    );

    assert(
      'Default Reminder Checkout: Default pengingat pulang Senin-Kamis adalah 13:00 WIB (BUKAN 14:00)',
      CONSTANTS.DEFAULTS.REMINDER_CHECKOUT_TIME === '13:00' &&
      DEFAULT_SYSTEM_SETTINGS.reminder_checkout_time === '13:00',
      `Checkout default: ${CONSTANTS.DEFAULTS.REMINDER_CHECKOUT_TIME}`
    );

    assert(
      'Default Friday Checkout: Default pengingat pulang Jumat adalah 11:00 WIB',
      CONSTANTS.DEFAULTS.REMINDER_FRIDAY_CHECKOUT_TIME === '11:00' &&
      DEFAULT_SYSTEM_SETTINGS.reminder_friday_checkout_time === '11:00',
      `Friday default: ${CONSTANTS.DEFAULTS.REMINDER_FRIDAY_CHECKOUT_TIME}`
    );

    // ── Test 2: Target Waktu Pulang Senin-Kamis (Senin = 1, Kamis = 4)
    const mondayDate = new Date('2026-11-02T08:00:00Z'); // Senin (UTC)
    const mondayTarget = NotificationService.getCheckoutTargetTimeForDate(mondayDate);
    assert(
      'Target Waktu Pulang Senin-Kamis: Harus tepat 13.00 WIB, bukan 14.00 WIB',
      mondayTarget.hours === 13 && mondayTarget.minutes === 0,
      `Hasil: ${mondayTarget.label} (hours: ${mondayTarget.hours})`
    );

    // ── Test 3: Target Waktu Pulang Hari Jumat (Jumat = 5)
    const fridayDate = new Date('2026-11-06T08:00:00Z'); // Jumat (UTC)
    const fridayTarget = NotificationService.getCheckoutTargetTimeForDate(fridayDate);
    assert(
      'Target Waktu Pulang Hari Jumat: Harus tepat 11.00 WIB',
      fridayTarget.hours === 11 && fridayTarget.minutes === 0,
      `Hasil: ${fridayTarget.label} (hours: ${fridayTarget.hours})`
    );

    // ── Test 4: Waktu Peringatan Dini H-1 Jam Kepulangan
    const mondayEarly = NotificationService.getEarlyCheckoutTargetTimeForDate(mondayDate);
    assert(
      'Peringatan Dini Senin-Kamis: Dihitung tepat 1 jam sebelum 13.00 WIB = 12.00 WIB',
      mondayEarly.hours === 12 && mondayEarly.minutes === 0,
      `Hasil: ${mondayEarly.label}`
    );

    const fridayEarly = NotificationService.getEarlyCheckoutTargetTimeForDate(fridayDate);
    assert(
      'Peringatan Dini Hari Jumat: Dihitung tepat 1 jam sebelum 11.00 WIB = 10.00 WIB',
      fridayEarly.hours === 10 && fridayEarly.minutes === 0,
      `Hasil: ${fridayEarly.label}`
    );

    // ── Test 5: Target Pengingat Masuk Pagi
    const checkinTarget = NotificationService.getCheckinTargetTimeForDate(mondayDate);
    assert(
      'Target Pengingat Masuk Pagi: Harus tepat 06.30 WIB',
      checkinTarget.hours === 6 && checkinTarget.minutes === 30,
      `Hasil: ${checkinTarget.label}`
    );

    // ── Test 6: Pembaruan Pengaturan Dinamis (Custom Jam Pulang)
    const currentSettings = useSettingsStore.getState().settings;
    await useSettingsStore.getState().updateSettings({
      ...currentSettings,
      reminder_checkout_time: '13:30',
      reminder_friday_checkout_time: '11:15',
    }, 'mock_test_token');

    const customMondayTarget = NotificationService.getCheckoutTargetTimeForDate(mondayDate);
    assert(
      'Dynamic Settings: Pengingat Senin-Kamis beradaptasi ke 13:30 sesuai pengaturan admin',
      customMondayTarget.hours === 13 && customMondayTarget.minutes === 30,
      `Hasil: ${customMondayTarget.label}`
    );

    const customMondayEarly = NotificationService.getEarlyCheckoutTargetTimeForDate(mondayDate);
    assert(
      'Dynamic Settings: Peringatan dini otomatis beradaptasi ke 12:30 (1 jam sebelum 13:30)',
      customMondayEarly.hours === 12 && customMondayEarly.minutes === 30,
      `Hasil: ${customMondayEarly.label}`
    );

    // ── Test 7: Provider Persistence & Serialization
    const provider = ProviderFactory.getProvider();
    const fetched = await provider.getSettings();
    assert(
      'Provider Persistence: Pengaturan pengingat berhasil tersimpan dan dibaca dari provider',
      Boolean(fetched && fetched.reminder_checkout_time),
      `Stored reminder_checkout_time: ${fetched?.reminder_checkout_time}`
    );

    // ── Cleanup: Kembalikan ke standar 13:00 & 11:00
    await useSettingsStore.getState().updateSettings({
      ...currentSettings,
      reminder_checkin_time: '06:30',
      reminder_checkin_enabled: true,
      reminder_checkout_time: '13:00',
      reminder_friday_checkout_time: '11:00',
      reminder_checkout_enabled: true,
      reminder_early_checkout_enabled: true,
    }, 'mock_test_token');

    const restoredMondayTarget = NotificationService.getCheckoutTargetTimeForDate(mondayDate);
    assert(
      'Cleanup & Reset: Pengaturan berhasil dikembalikan ke standar awal (13:00 WIB)',
      restoredMondayTarget.hours === 13 && restoredMondayTarget.minutes === 0,
      `Hasil setelah reset: ${restoredMondayTarget.label}`
    );

  } catch (err: any) {
    assert('Test Suite Execution: Eksekusi pengujian bebas dari runtime error', false, err?.message || String(err));
  }

  return { passed, failed, results };
};

