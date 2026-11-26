import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { CONSTANTS } from '../../../config/constants';
import { AuditLogger } from '../../../services/audit-logger.service';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { ProviderFactory } from '../../../providers/provider-factory';
import type { SystemSettings, AutoCheckInMode, AutoCheckoutTimeMode } from '../../../types/database.types';
import type { ServerAutoCheckoutSummary } from '../../../providers/data-provider.interface';
import { formatTimeForInput, timeToMinutes } from '../../../utils/time.utils';
import { GPSService } from '../../../services/gps.service';
import { LiveLocationMap } from '../../../components/ui/LiveLocationMap';
import { handleAppError } from '../../../utils/error.utils';
import { SlidersHorizontal, Clock, Play, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { ExamPeriodRepository, EXAM_PERIOD_CHANGED_EVENT } from '../../../repositories/ExamPeriodRepository';
import { ExamPeriodSettingsModal } from '../../administration/components/ExamPeriodSettingsModal';
import type { ExamPeriodStatus } from '../../../types/exam-schedule.types';

export const SystemSettingsForm: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const [examPeriodStatus, setExamPeriodStatus] = useState<ExamPeriodStatus | null>(null);
  const [isExamPeriodModalOpen, setIsExamPeriodModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadPeriod = async () => {
      try {
        const status = await ExamPeriodRepository.getPeriodStatus();
        if (isMounted) setExamPeriodStatus(status);
      } catch (e) {
        console.warn('Failed to load exam period in SystemSettingsForm:', e);
      }
    };
    loadPeriod();
    window.addEventListener(EXAM_PERIOD_CHANGED_EVENT, loadPeriod);
    return () => {
      isMounted = false;
      window.removeEventListener(EXAM_PERIOD_CHANGED_EVENT, loadPeriod);
    };
  }, []);

  const [appName, setAppName] = useState('Smart Absensi Guru');
  const [institution, setInstitution] = useState('SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam');
  const [checkInStart, setCheckInStart] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKIN_START);
  const [checkInEnd, setCheckInEnd] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKIN_END);
  const [checkOutStart, setCheckOutStart] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKOUT_START);
  const [fridayCheckoutStart, setFridayCheckoutStart] = useState<string>(CONSTANTS.DEFAULTS.FRIDAY_CHECKOUT_START);

  const [reminderCheckinTime, setReminderCheckinTime] = useState<string>(CONSTANTS.DEFAULTS.REMINDER_CHECKIN_TIME);
  const [reminderCheckinEnabled, setReminderCheckinEnabled] = useState<boolean>(CONSTANTS.DEFAULTS.REMINDER_CHECKIN_ENABLED);
  const [reminderCheckoutTime, setReminderCheckoutTime] = useState<string>(CONSTANTS.DEFAULTS.REMINDER_CHECKOUT_TIME);
  const [reminderFridayCheckoutTime, setReminderFridayCheckoutTime] = useState<string>(CONSTANTS.DEFAULTS.REMINDER_FRIDAY_CHECKOUT_TIME);
  const [reminderCheckoutEnabled, setReminderCheckoutEnabled] = useState<boolean>(CONSTANTS.DEFAULTS.REMINDER_CHECKOUT_ENABLED);
  const [reminderEarlyCheckoutEnabled, setReminderEarlyCheckoutEnabled] = useState<boolean>(CONSTANTS.DEFAULTS.REMINDER_EARLY_CHECKOUT_ENABLED);
  
  const [saturdayIsHoliday, setSaturdayIsHoliday] = useState<boolean>(true);
  const [sundayIsHoliday, setSundayIsHoliday] = useState<boolean>(true);

  const [geofenceLat, setGeofenceLat] = useState(String(CONSTANTS.DEFAULTS.GEOFENCE_LAT));
  const [geofenceLng, setGeofenceLng] = useState(String(CONSTANTS.DEFAULTS.GEOFENCE_LNG));
  const [geofenceRadius, setGeofenceRadius] = useState(String(CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS));

  const [adminResetPassword, setAdminResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Pengaturan Lengkap Auto Absen
  const [autoAttendanceEnabled, setAutoAttendanceEnabled] = useState<boolean>(CONSTANTS.DEFAULTS.AUTO_ATTENDANCE_ENABLED);
  const [autoCheckoutEnabled, setAutoCheckoutEnabled] = useState<boolean>(CONSTANTS.DEFAULTS.AUTO_CHECKOUT_ENABLED);
  const [autoCheckinMode, setAutoCheckinMode] = useState<AutoCheckInMode>(CONSTANTS.DEFAULTS.AUTO_CHECKIN_MODE);
  const [autoCheckoutTimeMode, setAutoCheckoutTimeMode] = useState<AutoCheckoutTimeMode>(CONSTANTS.DEFAULTS.AUTO_CHECKOUT_TIME_MODE);
  const [autoCheckoutCustomTime, setAutoCheckoutCustomTime] = useState<string>(CONSTANTS.DEFAULTS.AUTO_CHECKOUT_CUSTOM_TIME);
  const [autoCheckoutCustomFridayTime, setAutoCheckoutCustomFridayTime] = useState<string>(CONSTANTS.DEFAULTS.AUTO_CHECKOUT_CUSTOM_FRIDAY_TIME);
  const [autoCheckoutTriggerTime, setAutoCheckoutTriggerTime] = useState<string>(CONSTANTS.DEFAULTS.AUTO_CHECKOUT_TRIGGER_TIME);
  const [autoCheckinTimeMin, setAutoCheckinTimeMin] = useState<string>(CONSTANTS.DEFAULTS.AUTO_CHECKIN_TIME_MIN);
  const [autoCheckinTimeMax, setAutoCheckinTimeMax] = useState<string>(CONSTANTS.DEFAULTS.AUTO_CHECKIN_TIME_MAX);
  const [autoCheckinPoints, setAutoCheckinPoints] = useState<number>(CONSTANTS.DEFAULTS.AUTO_CHECKIN_POINTS);
  const [autoCheckoutPoints, setAutoCheckoutPoints] = useState<number>(CONSTANTS.DEFAULTS.AUTO_CHECKOUT_POINTS);
  const [autoSkipHolidays, setAutoSkipHolidays] = useState<boolean>(CONSTANTS.DEFAULTS.AUTO_ATTENDANCE_SKIP_HOLIDAYS);
  const [autoSkipLeaves, setAutoSkipLeaves] = useState<boolean>(CONSTANTS.DEFAULTS.AUTO_ATTENDANCE_SKIP_LEAVES);
  const [allowOverrideScan, setAllowOverrideScan] = useState<boolean>(CONSTANTS.DEFAULTS.AUTO_ATTENDANCE_ALLOW_OVERRIDE_SCAN);
  const [allowOverrideLeave, setAllowOverrideLeave] = useState<boolean>(CONSTANTS.DEFAULTS.AUTO_ATTENDANCE_ALLOW_OVERRIDE_LEAVE);
  const [preserveCheckInSource, setPreserveCheckInSource] = useState<boolean>(CONSTANTS.DEFAULTS.AUTO_CHECKOUT_PRESERVE_CHECKIN_SOURCE);
  const [isSavingAutoSettings, setIsSavingAutoSettings] = useState<boolean>(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [savedAutoSnapshot, setSavedAutoSnapshot] = useState<string>('');
  const [isRunningAutoCheckout, setIsRunningAutoCheckout] = useState<boolean>(false);
  const [lastAutoCheckoutResult, setLastAutoCheckoutResult] = useState<ServerAutoCheckoutSummary | null>(null);
  const [autoCheckoutExecError, setAutoCheckoutExecError] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingGps, setIsGettingGps] = useState(false);

  const sanitizeCoord = (val: unknown, isLat: boolean): string => {
    if (val === undefined || val === null || val === '') {
      return String(isLat ? CONSTANTS.DEFAULTS.GEOFENCE_LAT : CONSTANTS.DEFAULTS.GEOFENCE_LNG);
    }
    let str = String(val).trim().replace(',', '.');
    if (!str.includes('.')) {
      const raw = parseFloat(str);
      if (!isNaN(raw) && Math.abs(raw) > 180) {
        if (isLat && str.startsWith('-')) {
          str = str.substring(0, 2) + '.' + str.substring(2);
        } else if (isLat) {
          str = str.substring(0, 1) + '.' + str.substring(1);
        } else if (str.length >= 8) {
          str = str.substring(0, 3) + '.' + str.substring(3);
        }
      }
    }
    const parsed = parseFloat(str);
    return !isNaN(parsed) ? String(parsed) : String(isLat ? CONSTANTS.DEFAULTS.GEOFENCE_LAT : CONSTANTS.DEFAULTS.GEOFENCE_LNG);
  };

  const normalizeAutoSettingsFromPartial = (src: Partial<SystemSettings>) => ({
    auto_attendance_enabled: src.auto_attendance_enabled !== undefined ? src.auto_attendance_enabled !== false : CONSTANTS.DEFAULTS.AUTO_ATTENDANCE_ENABLED,
    auto_checkout_enabled: src.auto_checkout_enabled !== undefined ? src.auto_checkout_enabled !== false : CONSTANTS.DEFAULTS.AUTO_CHECKOUT_ENABLED,
    auto_checkin_mode: (src.auto_checkin_mode === 'DISABLED' || src.auto_checkin_mode === 'MANUAL_ONLY')
      ? src.auto_checkin_mode
      : CONSTANTS.DEFAULTS.AUTO_CHECKIN_MODE,
    auto_checkout_time_mode: (src.auto_checkout_time_mode === 'CUSTOM' || src.auto_checkout_time_mode === 'FOLLOW_SCHEDULE')
      ? src.auto_checkout_time_mode
      : CONSTANTS.DEFAULTS.AUTO_CHECKOUT_TIME_MODE,
    auto_checkout_custom_time: formatTimeForInput(src.auto_checkout_custom_time, CONSTANTS.DEFAULTS.AUTO_CHECKOUT_CUSTOM_TIME),
    auto_checkout_custom_friday_time: formatTimeForInput(src.auto_checkout_custom_friday_time, CONSTANTS.DEFAULTS.AUTO_CHECKOUT_CUSTOM_FRIDAY_TIME),
    auto_checkout_trigger_time: formatTimeForInput(src.auto_checkout_trigger_time, CONSTANTS.DEFAULTS.AUTO_CHECKOUT_TRIGGER_TIME),
    auto_checkin_time_min: formatTimeForInput(src.auto_checkin_time_min, CONSTANTS.DEFAULTS.AUTO_CHECKIN_TIME_MIN),
    auto_checkin_time_max: formatTimeForInput(src.auto_checkin_time_max, CONSTANTS.DEFAULTS.AUTO_CHECKIN_TIME_MAX),
    auto_checkin_points: Math.max(0, Math.min(15, Math.round(Number(src.auto_checkin_points ?? CONSTANTS.DEFAULTS.AUTO_CHECKIN_POINTS) || 0))),
    auto_checkout_points: Math.max(0, Math.min(20, Math.round(Number(src.auto_checkout_points ?? CONSTANTS.DEFAULTS.AUTO_CHECKOUT_POINTS) || 0))),
    auto_attendance_skip_holidays: src.auto_attendance_skip_holidays !== undefined ? src.auto_attendance_skip_holidays !== false : CONSTANTS.DEFAULTS.AUTO_ATTENDANCE_SKIP_HOLIDAYS,
    auto_attendance_skip_leaves: src.auto_attendance_skip_leaves !== undefined ? src.auto_attendance_skip_leaves !== false : CONSTANTS.DEFAULTS.AUTO_ATTENDANCE_SKIP_LEAVES,
    auto_attendance_allow_override_scan: src.auto_attendance_allow_override_scan !== undefined ? src.auto_attendance_allow_override_scan !== false : CONSTANTS.DEFAULTS.AUTO_ATTENDANCE_ALLOW_OVERRIDE_SCAN,
    auto_attendance_allow_override_leave: src.auto_attendance_allow_override_leave !== undefined ? src.auto_attendance_allow_override_leave !== false : CONSTANTS.DEFAULTS.AUTO_ATTENDANCE_ALLOW_OVERRIDE_LEAVE,
    auto_checkout_preserve_checkin_source: src.auto_checkout_preserve_checkin_source !== undefined ? src.auto_checkout_preserve_checkin_source !== false : CONSTANTS.DEFAULTS.AUTO_CHECKOUT_PRESERVE_CHECKIN_SOURCE,
  });

  const buildCurrentAutoSettings = () => normalizeAutoSettingsFromPartial({
    auto_attendance_enabled: autoAttendanceEnabled,
    auto_checkout_enabled: autoCheckoutEnabled,
    auto_checkin_mode: autoCheckinMode,
    auto_checkout_time_mode: autoCheckoutTimeMode,
    auto_checkout_custom_time: autoCheckoutCustomTime,
    auto_checkout_custom_friday_time: autoCheckoutCustomFridayTime,
    auto_checkout_trigger_time: autoCheckoutTriggerTime,
    auto_checkin_time_min: autoCheckinTimeMin,
    auto_checkin_time_max: autoCheckinTimeMax,
    auto_checkin_points: autoCheckinPoints,
    auto_checkout_points: autoCheckoutPoints,
    auto_attendance_skip_holidays: autoSkipHolidays,
    auto_attendance_skip_leaves: autoSkipLeaves,
    auto_attendance_allow_override_scan: allowOverrideScan,
    auto_attendance_allow_override_leave: allowOverrideLeave,
    auto_checkout_preserve_checkin_source: preserveCheckInSource,
  });

  const applyAutoSettingsToState = (src: Partial<SystemSettings>) => {
    const norm = normalizeAutoSettingsFromPartial(src);
    setAutoAttendanceEnabled(norm.auto_attendance_enabled);
    setAutoCheckoutEnabled(norm.auto_checkout_enabled);
    setAutoCheckinMode(norm.auto_checkin_mode);
    setAutoCheckoutTimeMode(norm.auto_checkout_time_mode);
    setAutoCheckoutCustomTime(norm.auto_checkout_custom_time);
    setAutoCheckoutCustomFridayTime(norm.auto_checkout_custom_friday_time);
    setAutoCheckoutTriggerTime(norm.auto_checkout_trigger_time);
    setAutoCheckinTimeMin(norm.auto_checkin_time_min);
    setAutoCheckinTimeMax(norm.auto_checkin_time_max);
    setAutoCheckinPoints(norm.auto_checkin_points);
    setAutoCheckoutPoints(norm.auto_checkout_points);
    setAutoSkipHolidays(norm.auto_attendance_skip_holidays);
    setAutoSkipLeaves(norm.auto_attendance_skip_leaves);
    setAllowOverrideScan(norm.auto_attendance_allow_override_scan);
    setAllowOverrideLeave(norm.auto_attendance_allow_override_leave);
    setPreserveCheckInSource(norm.auto_checkout_preserve_checkin_source);
    setSavedAutoSnapshot(JSON.stringify(norm));
  };

  const isAutoDirty =
    savedAutoSnapshot !== '' && JSON.stringify(buildCurrentAutoSettings()) !== savedAutoSnapshot;

  // Load existing settings from localStorage and Provider API
  useEffect(() => {
    const loadSettings = async () => {
      // 1. Try local storage first for instantaneous UI render
      const savedLocal = localStorage.getItem('smart_absensi_system_settings');
      if (savedLocal) {
        try {
          const parsed = JSON.parse(savedLocal);
          if (parsed.app_name) setAppName(parsed.app_name);
          if (parsed.institution_name) setInstitution(parsed.institution_name);
          if (parsed.work_checkin_start) setCheckInStart(formatTimeForInput(parsed.work_checkin_start, CONSTANTS.DEFAULTS.WORK_CHECKIN_START));
          if (parsed.work_checkin_end) setCheckInEnd(formatTimeForInput(parsed.work_checkin_end, CONSTANTS.DEFAULTS.WORK_CHECKIN_END));
          if (parsed.work_checkout_start) setCheckOutStart(formatTimeForInput(parsed.work_checkout_start, CONSTANTS.DEFAULTS.WORK_CHECKOUT_START));
          if (parsed.friday_checkout_start) setFridayCheckoutStart(formatTimeForInput(parsed.friday_checkout_start, CONSTANTS.DEFAULTS.FRIDAY_CHECKOUT_START));
          if (parsed.reminder_checkin_time) setReminderCheckinTime(formatTimeForInput(parsed.reminder_checkin_time, CONSTANTS.DEFAULTS.REMINDER_CHECKIN_TIME));
          if (parsed.reminder_checkin_enabled !== undefined) setReminderCheckinEnabled(Boolean(parsed.reminder_checkin_enabled));
          if (parsed.reminder_checkout_time) setReminderCheckoutTime(formatTimeForInput(parsed.reminder_checkout_time, CONSTANTS.DEFAULTS.REMINDER_CHECKOUT_TIME));
          if (parsed.reminder_friday_checkout_time) setReminderFridayCheckoutTime(formatTimeForInput(parsed.reminder_friday_checkout_time, CONSTANTS.DEFAULTS.REMINDER_FRIDAY_CHECKOUT_TIME));
          if (parsed.reminder_checkout_enabled !== undefined) setReminderCheckoutEnabled(Boolean(parsed.reminder_checkout_enabled));
          if (parsed.reminder_early_checkout_enabled !== undefined) setReminderEarlyCheckoutEnabled(Boolean(parsed.reminder_early_checkout_enabled));
          if (parsed.saturday_is_holiday !== undefined) setSaturdayIsHoliday(Boolean(parsed.saturday_is_holiday));
          if (parsed.sunday_is_holiday !== undefined) setSundayIsHoliday(Boolean(parsed.sunday_is_holiday));
          if (parsed.geofence_lat !== undefined) setGeofenceLat(sanitizeCoord(parsed.geofence_lat, true));
          if (parsed.geofence_lng !== undefined) setGeofenceLng(sanitizeCoord(parsed.geofence_lng, false));
          if (parsed.geofence_radius !== undefined) setGeofenceRadius(String(parsed.geofence_radius));
          if (parsed.admin_reset_password) {
            setAdminResetPassword(parsed.admin_reset_password);
            setConfirmResetPassword(parsed.admin_reset_password);
          }
          applyAutoSettingsToState(parsed);
        } catch (e) {
          console.error('Failed to parse local settings:', e);
        }
      } else {
        setSavedAutoSnapshot(JSON.stringify(normalizeAutoSettingsFromPartial({})));
      }

      // 2. Fetch authoritative settings from backend
      try {
        const provider = ProviderFactory.getProvider();
        const fetched = await provider.getSettings();
        if (fetched) {
          if (fetched.app_name) setAppName(fetched.app_name);
          if (fetched.institution_name) setInstitution(fetched.institution_name);
          if (fetched.work_checkin_start) setCheckInStart(formatTimeForInput(fetched.work_checkin_start, CONSTANTS.DEFAULTS.WORK_CHECKIN_START));
          if (fetched.work_checkin_end) setCheckInEnd(formatTimeForInput(fetched.work_checkin_end, CONSTANTS.DEFAULTS.WORK_CHECKIN_END));
          if (fetched.work_checkout_start) setCheckOutStart(formatTimeForInput(fetched.work_checkout_start, CONSTANTS.DEFAULTS.WORK_CHECKOUT_START));
          if (fetched.friday_checkout_start) setFridayCheckoutStart(formatTimeForInput(fetched.friday_checkout_start, CONSTANTS.DEFAULTS.FRIDAY_CHECKOUT_START));
          if (fetched.reminder_checkin_time) setReminderCheckinTime(formatTimeForInput(fetched.reminder_checkin_time, CONSTANTS.DEFAULTS.REMINDER_CHECKIN_TIME));
          if (fetched.reminder_checkin_enabled !== undefined) setReminderCheckinEnabled(Boolean(fetched.reminder_checkin_enabled));
          if (fetched.reminder_checkout_time) setReminderCheckoutTime(formatTimeForInput(fetched.reminder_checkout_time, CONSTANTS.DEFAULTS.REMINDER_CHECKOUT_TIME));
          if (fetched.reminder_friday_checkout_time) setReminderFridayCheckoutTime(formatTimeForInput(fetched.reminder_friday_checkout_time, CONSTANTS.DEFAULTS.REMINDER_FRIDAY_CHECKOUT_TIME));
          if (fetched.reminder_checkout_enabled !== undefined) setReminderCheckoutEnabled(Boolean(fetched.reminder_checkout_enabled));
          if (fetched.reminder_early_checkout_enabled !== undefined) setReminderEarlyCheckoutEnabled(Boolean(fetched.reminder_early_checkout_enabled));
          if (fetched.saturday_is_holiday !== undefined) setSaturdayIsHoliday(Boolean(fetched.saturday_is_holiday));
          if (fetched.sunday_is_holiday !== undefined) setSundayIsHoliday(Boolean(fetched.sunday_is_holiday));
          if (fetched.geofence_lat !== undefined) setGeofenceLat(sanitizeCoord(fetched.geofence_lat, true));
          if (fetched.geofence_lng !== undefined) setGeofenceLng(sanitizeCoord(fetched.geofence_lng, false));
          if (fetched.geofence_radius !== undefined) setGeofenceRadius(String(fetched.geofence_radius));
          if (fetched.admin_reset_password) {
            setAdminResetPassword(fetched.admin_reset_password);
            setConfirmResetPassword(fetched.admin_reset_password);
          }
          applyAutoSettingsToState(fetched);

          localStorage.setItem('smart_absensi_system_settings', JSON.stringify({
            ...fetched,
            geofence_lat: parseFloat(sanitizeCoord(fetched.geofence_lat, true)),
            geofence_lng: parseFloat(sanitizeCoord(fetched.geofence_lng, false)),
            work_checkin_start: formatTimeForInput(fetched.work_checkin_start, CONSTANTS.DEFAULTS.WORK_CHECKIN_START),
            work_checkin_end: formatTimeForInput(fetched.work_checkin_end, CONSTANTS.DEFAULTS.WORK_CHECKIN_END),
            work_checkout_start: formatTimeForInput(fetched.work_checkout_start, CONSTANTS.DEFAULTS.WORK_CHECKOUT_START),
            friday_checkout_start: formatTimeForInput(fetched.friday_checkout_start, CONSTANTS.DEFAULTS.FRIDAY_CHECKOUT_START),
            reminder_checkin_time: formatTimeForInput(fetched.reminder_checkin_time, CONSTANTS.DEFAULTS.REMINDER_CHECKIN_TIME),
            reminder_checkin_enabled: fetched.reminder_checkin_enabled !== false,
            reminder_checkout_time: formatTimeForInput(fetched.reminder_checkout_time, CONSTANTS.DEFAULTS.REMINDER_CHECKOUT_TIME),
            reminder_friday_checkout_time: formatTimeForInput(fetched.reminder_friday_checkout_time, CONSTANTS.DEFAULTS.REMINDER_FRIDAY_CHECKOUT_TIME),
            reminder_checkout_enabled: fetched.reminder_checkout_enabled !== false,
            reminder_early_checkout_enabled: fetched.reminder_early_checkout_enabled !== false,
            ...normalizeAutoSettingsFromPartial(fetched),
          }));
        }
      } catch (err) {
        console.warn('Backend fetch settings fallback:', err);
      }
    };

    loadSettings();
  }, []);

  const handleGetCurrentLocation = async () => {
    setIsGettingGps(true);
    try {
      const coords = await GPSService.getCurrentPosition();
      setGeofenceLat(coords.latitude.toFixed(6));
      setGeofenceLng(coords.longitude.toFixed(6));
      setIsGettingGps(false);
      showToast('success', 'Koordinat GPS Berhasil Diambil!', `Lat: ${coords.latitude.toFixed(6)}, Lng: ${coords.longitude.toFixed(6)} (Akurasi: ${Math.round(coords.accuracy)}m)`);
    } catch (err: unknown) {
      setIsGettingGps(false);
      const msg = err instanceof Error ? err.message : 'Pastikan izin akses lokasi GPS pada browser sudah diperbolehkan.';
      showToast('error', 'Gagal Mengambil GPS', msg);
    }
  };

  const handleResetAutoDefaults = () => {
    setAutoAttendanceEnabled(CONSTANTS.DEFAULTS.AUTO_ATTENDANCE_ENABLED);
    setAutoCheckoutEnabled(CONSTANTS.DEFAULTS.AUTO_CHECKOUT_ENABLED);
    setAutoCheckinMode(CONSTANTS.DEFAULTS.AUTO_CHECKIN_MODE);
    setAutoCheckoutTimeMode(CONSTANTS.DEFAULTS.AUTO_CHECKOUT_TIME_MODE);
    setAutoCheckoutCustomTime(CONSTANTS.DEFAULTS.AUTO_CHECKOUT_CUSTOM_TIME);
    setAutoCheckoutCustomFridayTime(CONSTANTS.DEFAULTS.AUTO_CHECKOUT_CUSTOM_FRIDAY_TIME);
    setAutoCheckoutTriggerTime(CONSTANTS.DEFAULTS.AUTO_CHECKOUT_TRIGGER_TIME);
    setAutoCheckinTimeMin(CONSTANTS.DEFAULTS.AUTO_CHECKIN_TIME_MIN);
    setAutoCheckinTimeMax(CONSTANTS.DEFAULTS.AUTO_CHECKIN_TIME_MAX);
    setAutoCheckinPoints(CONSTANTS.DEFAULTS.AUTO_CHECKIN_POINTS);
    setAutoCheckoutPoints(CONSTANTS.DEFAULTS.AUTO_CHECKOUT_POINTS);
    setAutoSkipHolidays(CONSTANTS.DEFAULTS.AUTO_ATTENDANCE_SKIP_HOLIDAYS);
    setAutoSkipLeaves(CONSTANTS.DEFAULTS.AUTO_ATTENDANCE_SKIP_LEAVES);
    setAllowOverrideScan(CONSTANTS.DEFAULTS.AUTO_ATTENDANCE_ALLOW_OVERRIDE_SCAN);
    setAllowOverrideLeave(CONSTANTS.DEFAULTS.AUTO_ATTENDANCE_ALLOW_OVERRIDE_LEAVE);
    setPreserveCheckInSource(CONSTANTS.DEFAULTS.AUTO_CHECKOUT_PRESERVE_CHECKIN_SOURCE);
    setLastAutoSavedAt(null);
    showToast('info', 'Setelan Auto Absen Direset', 'Nilai dikembalikan ke standar bawaan. Klik "Simpan Pengaturan Auto Absen" di bagian ini untuk menerapkan ke server.');
  };

  const handleSaveAutoSettings = async (silentSuccessToast = false): Promise<boolean> => {
    if (autoCheckinMode === 'MANUAL_ONLY' && timeToMinutes(autoCheckinTimeMin) > timeToMinutes(autoCheckinTimeMax)) {
      showToast('error', 'Rentang Jam Auto Masuk Tidak Valid', 'Jam awal acak Auto Masuk tidak boleh lebih lambat dari jam batas akhirnya.');
      return false;
    }

    setIsSavingAutoSettings(true);
    try {
      const token = useAuthStore.getState().token || '';
      const baseSettings = useSettingsStore.getState().settings;
      const autoPayload = buildCurrentAutoSettings();
      const updatedSettings: SystemSettings = {
        ...baseSettings,
        work_checkout_start: formatTimeForInput(checkOutStart, baseSettings.work_checkout_start || CONSTANTS.DEFAULTS.WORK_CHECKOUT_START),
        friday_checkout_start: formatTimeForInput(fridayCheckoutStart, baseSettings.friday_checkout_start || CONSTANTS.DEFAULTS.FRIDAY_CHECKOUT_START),
        ...autoPayload,
      };

      await useSettingsStore.getState().updateSettings(updatedSettings, token);
      setSavedAutoSnapshot(JSON.stringify(autoPayload));
      const savedClock = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastAutoSavedAt(`${savedClock} WIB`);

      await AuditLogger.log({
        actorId: user?.id || 'op_1',
        actorRole: user?.role || 'ADMIN',
        actionType: 'UPDATE_SETTINGS',
        targetEntity: 'System_Settings',
        newValue: JSON.stringify(autoPayload),
        reason: 'Pembaruan Pengaturan Auto Absen & Kebijakan Penggantian',
      });

      if (!silentSuccessToast) {
        showToast(
          'success',
          'Pengaturan Auto Absen Tersimpan!',
          'Semua kebijakan Auto Absen dan hak penggantian berhasil disimpan permanen ke server.'
        );
      }
      return true;
    } catch (err: unknown) {
      handleAppError(err, 'SystemSettingsForm.handleSaveAutoSettings', 'Gagal Menyimpan Pengaturan Auto Absen');
      return false;
    } finally {
      setIsSavingAutoSettings(false);
    }
  };

  const handleTriggerServerAutoCheckout = async () => {
    if (isAutoDirty) {
      const savedFirst = await handleSaveAutoSettings(true);
      if (!savedFirst) return;
    }

    setIsRunningAutoCheckout(true);
    setAutoCheckoutExecError(null);
    try {
      const provider = ProviderFactory.getProvider();
      if (!provider.runServerAutoCheckout) {
        throw new Error('Provider aktif belum mendukung eksekusi Auto Pulang server.');
      }
      const token = useAuthStore.getState().token || '';
      const res = await provider.runServerAutoCheckout(undefined, token);
      setLastAutoCheckoutResult(res);

      if (res.skippedReason) {
        showToast(
          'info',
          'Auto Pulang Dilewati',
          `Status hari ini (${res.date}): ${res.skippedReason}${res.holidayName ? ` (${res.holidayName})` : ''}.`
        );
      } else {
        showToast(
          'success',
          'Auto Pulang Server Selesai',
          `${res.processedCount} guru dicatat pulang otomatis pada tanggal ${res.date}.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menjalankan Auto Pulang server.';
      setAutoCheckoutExecError(msg);
      showToast('error', 'Eksekusi Auto Pulang Gagal', msg);
    } finally {
      setIsRunningAutoCheckout(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (adminResetPassword && adminResetPassword !== confirmResetPassword) {
      showToast('error', 'Password Reset Tidak Cocok', 'Konfirmasi password reset absensi tidak cocok dengan password yang Anda masukkan.');
      return;
    }

    if (autoCheckinMode === 'MANUAL_ONLY' && timeToMinutes(autoCheckinTimeMin) > timeToMinutes(autoCheckinTimeMax)) {
      showToast('error', 'Rentang Jam Auto Masuk Tidak Valid', 'Jam awal acak Auto Masuk tidak boleh lebih lambat dari jam batas akhirnya.');
      return;
    }

    setIsLoading(true);

    const parseCoord = (val: string, isLat: boolean): number => {
      let str = String(val).trim().replace(',', '.');
      if (!str.includes('.')) {
        const raw = parseFloat(str);
        if (!isNaN(raw) && Math.abs(raw) > 180) {
          if (isLat && str.startsWith('-')) {
            str = str.substring(0, 2) + '.' + str.substring(2);
          } else if (isLat) {
            str = str.substring(0, 1) + '.' + str.substring(1);
          } else if (str.length >= 8) {
            str = str.substring(0, 3) + '.' + str.substring(3);
          }
        }
      }
      const parsed = parseFloat(str);
      return !isNaN(parsed) ? parsed : (isLat ? CONSTANTS.DEFAULTS.GEOFENCE_LAT : CONSTANTS.DEFAULTS.GEOFENCE_LNG);
    };

    const finalLat = parseCoord(geofenceLat, true);
    const finalLng = parseCoord(geofenceLng, false);
    const finalRadius = parseInt(geofenceRadius, 10) || CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS;
    const autoPayload = buildCurrentAutoSettings();

    const updatedSettings: SystemSettings = {
      app_name: appName,
      institution_name: institution,
      work_checkin_start: checkInStart,
      work_checkin_end: checkInEnd,
      work_checkout_start: checkOutStart,
      friday_checkout_start: fridayCheckoutStart,
      saturday_is_holiday: saturdayIsHoliday,
      sunday_is_holiday: sundayIsHoliday,
      geofence_lat: finalLat,
      geofence_lng: finalLng,
      geofence_radius: finalRadius,
      admin_reset_password: adminResetPassword,
      reminder_checkin_time: reminderCheckinTime,
      reminder_checkin_enabled: reminderCheckinEnabled,
      reminder_checkout_time: reminderCheckoutTime,
      reminder_friday_checkout_time: reminderFridayCheckoutTime,
      reminder_checkout_enabled: reminderCheckoutEnabled,
      reminder_early_checkout_enabled: reminderEarlyCheckoutEnabled,
      ...autoPayload,
    };

    try {
      // 1. Persist to backend and update centralized settings store
      const token = useAuthStore.getState().token || '';
      await useSettingsStore.getState().updateSettings(updatedSettings, token);
      setSavedAutoSnapshot(JSON.stringify(autoPayload));
      const savedClock = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastAutoSavedAt(`${savedClock} WIB`);

      // Update state to formatted values
      setGeofenceLat(String(finalLat));
      setGeofenceLng(String(finalLng));
      setGeofenceRadius(String(finalRadius));

      // 3. Log Audit Trail
      await AuditLogger.log({
        actorId: user?.id || 'op_1',
        actorRole: user?.role || 'ADMIN',
        actionType: 'UPDATE_SETTINGS',
        targetEntity: 'System_Settings',
        newValue: JSON.stringify(updatedSettings),
        reason: 'Pembaruan Detail Jam Kerja, Waktu Notifikasi Pengingat Masuk & Pulang (13:00 / 11:00 WIB), serta Geofence Sekolah',
      });

      setIsLoading(false);
      showToast('success', 'Pengaturan Tersimpan Permanen!', 'Pengaturan jam kerja, waktu notifikasi pengingat masuk & pulang (Senin-Kamis 13:00, Jumat 11:00), serta geofence berhasil disimpan.');
    } catch (err: unknown) {
      setIsLoading(false);
      handleAppError(err, 'SystemSettingsForm.handleSave', 'Gagal Menyimpan Pengaturan Sistem');
    }
  };

  return (
    <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card space-y-6">
      <div className="space-y-1 pb-2 border-b border-slate-100">
        <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
          <span>⚙️</span> Detail Pengaturan Jam Kerja & Geofence GPS Sekolah
        </h3>
        <p className="text-xs text-slate-500">
          Atur shift absensi spesifik per hari (khusus Jumat jam 11.00), jadwal libur rutin Sabtu & Minggu, serta radius GPS sekolah.
        </p>
      </div>

      {/* Section 1: Branding Identitas */}
      <div className="space-y-3">
        <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">🏢 Identitas Aplikasi & Sekolah</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Nama Utama Aplikasi" value={appName} onChange={(e) => setAppName(e.target.value)} required />
          <Input label="Sub-Branding / Identitas Sekolah" value={institution} onChange={(e) => setInstitution(e.target.value)} required />
        </div>
      </div>

      {/* Section 2: Detail Shift Jam Kerja Spesifik Per Hari */}
      <div className="space-y-4 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">⏰ Detail Shift Jam Kerja Per Hari</h4>
          <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded-full border border-amber-200">
            ⭐ Khusus Hari Jumat: Pulang Jam 11.00 WIB
          </span>
        </div>

        {/* Senin - Kamis */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <h5 className="font-extrabold text-xs text-slate-900">Senin s/d Kamis (Hari Kerja Standard)</h5>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Jam Mulai Masuk" type="time" value={checkInStart} onChange={(e) => setCheckInStart(e.target.value)} required />
            <Input label="Batas Tepat Waktu (07.30)" type="time" value={checkInEnd} onChange={(e) => setCheckInEnd(e.target.value)} required />
            <Input label="Jam Buka Pulang (13.00)" type="time" value={checkOutStart} onChange={(e) => setCheckOutStart(e.target.value)} required />
          </div>
        </div>

        {/* Jumat */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <h5 className="font-extrabold text-xs text-emerald-950">Hari Jumat (Jadwal Khusus)</h5>
            </div>
            <span className="px-2 py-0.5 bg-emerald-600 text-white font-black text-[10px] rounded-full">
              Khusus Pulang Lebih Awal
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Jam Mulai Masuk" type="time" value={checkInStart} onChange={(e) => setCheckInStart(e.target.value)} required />
            <Input label="Batas Tepat Waktu (07.30)" type="time" value={checkInEnd} onChange={(e) => setCheckInEnd(e.target.value)} required />
            <Input
              label="Jam Buka Pulang (11.00 WIB)"
              type="time"
              value={fridayCheckoutStart}
              onChange={(e) => setFridayCheckoutStart(e.target.value)}
              required
            />
          </div>
          <p className="text-[11px] text-emerald-800 font-medium">
            💡 Pada hari Jumat, sistem akan mengizinkan guru melakukan absensi pulang mulai pukul <strong>{fridayCheckoutStart} WIB</strong> (persiapan Sholat Jumat/agenda khusus).
          </p>
        </div>

        {/* Sabtu & Minggu Libur Rutin */}
        <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
            <h5 className="font-extrabold text-xs text-purple-950">Akhir Pekan (Sabtu & Minggu)</h5>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <label className="flex items-center justify-between p-3 bg-white rounded-xl border border-purple-100 cursor-pointer shadow-xs">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900">Hari Sabtu Libur Rutin</p>
                <p className="text-[10px] text-slate-500">Non-aktifkan kewajiban absensi Sabtu</p>
              </div>
              <input
                type="checkbox"
                checked={saturdayIsHoliday}
                onChange={(e) => setSaturdayIsHoliday(e.target.checked)}
                className="w-5 h-5 accent-purple-600 rounded-md cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-white rounded-xl border border-purple-100 cursor-pointer shadow-xs">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900">Hari Minggu Libur Rutin</p>
                <p className="text-[10px] text-slate-500">Non-aktifkan kewajiban absensi Minggu</p>
              </div>
              <input
                type="checkbox"
                checked={sundayIsHoliday}
                onChange={(e) => setSundayIsHoliday(e.target.checked)}
                className="w-5 h-5 accent-purple-600 rounded-md cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Section 3: Waktu Notifikasi Pengingat Masuk & Pulang Sekolah */}
      <div className="space-y-4 pt-3 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>🔔</span> Pengaturan Waktu Notifikasi Pengingat Masuk &amp; Pulang
            </h4>
            <p className="text-[11px] text-slate-500">
              Atur waktu pengingat otomatis (Push Notification ke HP Guru &amp; Web Browser) agar tepat waktu dan tidak salah sasaran.
            </p>
          </div>
          <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-extrabold rounded-full border border-blue-200 self-start sm:self-auto">
            Standar Pulang: 13.00 WIB (Jumat 11.00 WIB)
          </span>
        </div>

        {/* Info Banner Anti Salah Sasaran */}
        <div className="p-3.5 bg-sky-50/80 rounded-2xl border border-sky-200 text-xs text-sky-900 space-y-1">
          <div className="font-extrabold flex items-center gap-1.5 text-sky-950">
            <span>ℹ️</span> Jadwal Pengingat Resmi Terintegrasi:
          </div>
          <p className="text-[11px] text-sky-900/90 leading-relaxed">
            Pengingat kepulangan sekolah aktif mulai pukul <strong>{reminderCheckoutTime} WIB</strong> (Senin s/d Kamis) dan <strong>{reminderFridayCheckoutTime} WIB</strong> (khusus Jumat). Sistem juga menyiarkan peringatan dini H-1 jam sebelumnya agar tidak ada guru yang terlewat scan kepulangan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card Pengingat Masuk */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <h5 className="font-extrabold text-xs text-slate-900">⏰ Pengingat Presensi Masuk Pagi</h5>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-600">
                  <span>Aktif</span>
                  <input
                    type="checkbox"
                    checked={reminderCheckinEnabled}
                    onChange={(e) => setReminderCheckinEnabled(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </label>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Notifikasi dikirimkan ke HP guru setiap pagi hari kerja sebelum jam pembelajaran dimulai.
              </p>
            </div>

            <div className="pt-1">
              <Input
                label="Jam Pengingat Masuk (Default: 06.30 WIB)"
                type="time"
                value={reminderCheckinTime}
                onChange={(e) => setReminderCheckinTime(e.target.value)}
                disabled={!reminderCheckinEnabled}
                required={reminderCheckinEnabled}
              />
            </div>
          </div>

          {/* Card Pengingat Pulang */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                  <h5 className="font-extrabold text-xs text-amber-950">🔔 Pengingat Presensi Pulang Sekolah</h5>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-amber-900">
                  <span>Aktif</span>
                  <input
                    type="checkbox"
                    checked={reminderCheckoutEnabled}
                    onChange={(e) => setReminderCheckoutEnabled(e.target.checked)}
                    className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                  />
                </label>
              </div>
              <p className="text-[11px] text-amber-900/80 leading-relaxed">
                Notifikasi kepulangan resmi dikirim tepat waktu agar presensi terekam utuh tanpa salah sasaran.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  label="Pulang Sen - Kam (13.00)"
                  type="time"
                  value={reminderCheckoutTime}
                  onChange={(e) => setReminderCheckoutTime(e.target.value)}
                  disabled={!reminderCheckoutEnabled}
                  required={reminderCheckoutEnabled}
                />
                <Input
                  label="Pulang Jumat (11.00)"
                  type="time"
                  value={reminderFridayCheckoutTime}
                  onChange={(e) => setReminderFridayCheckoutTime(e.target.value)}
                  disabled={!reminderCheckoutEnabled}
                  required={reminderCheckoutEnabled}
                />
              </div>

              {/* Toggle H-1 Jam */}
              <label className="flex items-center justify-between p-2.5 bg-white/80 rounded-xl border border-amber-200/70 cursor-pointer hover:bg-white transition-colors">
                <div className="pr-2 space-y-0.5">
                  <span className="font-bold text-[11px] text-amber-950 block">Peringatan 1 Jam Sebelumnya (H-1 Jam)</span>
                  <span className="text-[10px] text-slate-500 block">Kirim notifikasi persiapan 1 jam sebelum jam pulang tiba</span>
                </div>
                <input
                  type="checkbox"
                  checked={reminderEarlyCheckoutEnabled}
                  onChange={(e) => setReminderEarlyCheckoutEnabled(e.target.checked)}
                  disabled={!reminderCheckoutEnabled}
                  className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Pengaturan Lengkap Auto Absen & Fleksibilitas Guru */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#023246]" />
                <span>Pengaturan Auto Absen &amp; Kebijakan Penggantian</span>
              </h4>
              <span
                className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                  autoAttendanceEnabled
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {autoAttendanceEnabled
                  ? `${autoCheckoutEnabled ? 'Auto Pulang Aktif' : 'Auto Pulang Nonaktif'} • Masuk: ${autoCheckinMode === 'DISABLED' ? 'Nonaktif' : 'Manual Admin'}`
                  : 'Semua Auto Absen Nonaktif'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Atur kapan sistem otomatis mencatat pulang, kebijakan masuk manual Admin, rentang jam, poin, serta izin guru untuk menimpa catatan auto.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetAutoDefaults}
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Bawaan</span>
          </button>
        </div>

        {/* Master Switch & Kebijakan Masuk vs Pulang */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-900 block">Aktifkan Mesin Auto Absen</span>
              <span className="text-[11px] text-slate-500 block leading-relaxed">
                Saklar utama seluruh fitur Auto Absen (server cron maupun tombol Admin).
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoAttendanceEnabled}
              onChange={(e) => setAutoAttendanceEnabled(e.target.checked)}
              className="w-5 h-5 mt-0.5 accent-[#023246] rounded cursor-pointer shrink-0"
            />
          </label>

          <label className={`flex items-start justify-between gap-3 p-3.5 rounded-2xl border cursor-pointer ${
            autoAttendanceEnabled ? 'bg-slate-50 border-slate-200' : 'bg-slate-50/50 border-slate-200/60 opacity-60'
          }`}>
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-900 block">Auto Pulang Otomatis Server (Hanya Pulang)</span>
              <span className="text-[11px] text-slate-500 block leading-relaxed">
                Sistem otomatis mencatat pulang guru yang sudah masuk namun lupa scan pulang (tidak menyentuh guru yang belum masuk).
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoCheckoutEnabled}
              disabled={!autoAttendanceEnabled}
              onChange={(e) => setAutoCheckoutEnabled(e.target.checked)}
              className="w-5 h-5 mt-0.5 accent-[#023246] rounded cursor-pointer shrink-0"
            />
          </label>
        </div>

        {/* Mode Auto Masuk & Penentuan Jam Pulang */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!autoAttendanceEnabled ? 'opacity-55 pointer-events-none' : ''}`}>
          {/* Kebijakan Auto Masuk */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
            <h5 className="font-bold text-xs text-slate-900">Kebijakan Auto Absen Masuk</h5>
            <div className="space-y-2">
              <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                autoCheckinMode === 'MANUAL_ONLY' ? 'border-[#023246] bg-sky-50/50' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="autoCheckinMode"
                  checked={autoCheckinMode === 'MANUAL_ONLY'}
                  onChange={() => setAutoCheckinMode('MANUAL_ONLY')}
                  className="mt-0.5 accent-[#023246]"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">Manual Admin Saja (Direkomendasikan)</span>
                  <span className="text-[11px] text-slate-500 block">
                    Sistem tidak pernah auto-masuk sendiri; hanya Admin lewat menu Auto Absen.
                  </span>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                autoCheckinMode === 'DISABLED' ? 'border-[#023246] bg-sky-50/50' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="autoCheckinMode"
                  checked={autoCheckinMode === 'DISABLED'}
                  onChange={() => setAutoCheckinMode('DISABLED')}
                  className="mt-0.5 accent-[#023246]"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">Nonaktifkan Auto Masuk Sepenuhnya</span>
                  <span className="text-[11px] text-slate-500 block">
                    Opsi Auto Masuk &amp; Keduanya dikunci di Dashboard Admin (hanya Auto Pulang diizinkan).
                  </span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <Input
                label="Jam Acak Masuk Mulai"
                type="time"
                value={autoCheckinTimeMin}
                onChange={(e) => setAutoCheckinTimeMin(e.target.value)}
                disabled={autoCheckinMode === 'DISABLED'}
              />
              <Input
                label="Jam Acak Masuk Maks"
                type="time"
                value={autoCheckinTimeMax}
                onChange={(e) => setAutoCheckinTimeMax(e.target.value)}
                disabled={autoCheckinMode === 'DISABLED'}
              />
            </div>
          </div>

          {/* Jam Pulang Auto & Eksekusi */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
            <h5 className="font-bold text-xs text-slate-900">Jam Pulang &amp; Jadwal Eksekusi Server</h5>
            <div className="space-y-2">
              <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                autoCheckoutTimeMode === 'FOLLOW_SCHEDULE' ? 'border-[#023246] bg-sky-50/50' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="autoCheckoutTimeMode"
                  checked={autoCheckoutTimeMode === 'FOLLOW_SCHEDULE'}
                  onChange={() => setAutoCheckoutTimeMode('FOLLOW_SCHEDULE')}
                  className="mt-0.5 accent-[#023246]"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">Ikuti Jam Buka Pulang Sekolah</span>
                  <span className="text-[11px] text-slate-500 block">
                    Sen–Kam: {checkOutStart} WIB • Jumat: {fridayCheckoutStart} WIB.
                  </span>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                autoCheckoutTimeMode === 'CUSTOM' ? 'border-[#023246] bg-sky-50/50' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="autoCheckoutTimeMode"
                  checked={autoCheckoutTimeMode === 'CUSTOM'}
                  onChange={() => setAutoCheckoutTimeMode('CUSTOM')}
                  className="mt-0.5 accent-[#023246]"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">Atur Jam Pulang Khusus Auto</span>
                  <span className="text-[11px] text-slate-500 block">
                    Catat jam pulang spesifik tersendiri untuk seluruh Auto Pulang.
                  </span>
                </div>
              </label>
            </div>

            {autoCheckoutTimeMode === 'CUSTOM' && (
              <div className="grid grid-cols-2 gap-2.5">
                <Input
                  label="Pulang Auto Sen–Kam"
                  type="time"
                  value={autoCheckoutCustomTime}
                  onChange={(e) => setAutoCheckoutCustomTime(e.target.value)}
                />
                <Input
                  label="Pulang Auto Jumat"
                  type="time"
                  value={autoCheckoutCustomFridayTime}
                  onChange={(e) => setAutoCheckoutCustomFridayTime(e.target.value)}
                />
              </div>
            )}

            <div className="pt-1">
              <Input
                label="Batas Jam Eksekusi Server Auto Pulang (WIB)"
                type="time"
                value={autoCheckoutTriggerTime}
                onChange={(e) => setAutoCheckoutTriggerTime(e.target.value)}
                disabled={!autoCheckoutEnabled}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Cron server terjadwal berjalan pukul 16:30 WIB setiap Senin–Jumat dan hanya memproses jika waktu server sudah mencapai batas di atas.
              </p>
            </div>
          </div>
        </div>

        {/* Poin & Kebijakan Pengecualian + Override */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!autoAttendanceEnabled ? 'opacity-55 pointer-events-none' : ''}`}>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h5 className="font-bold text-xs text-slate-900">Poin Kedisiplinan Auto Absen</h5>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Poin Auto Masuk (0–15)"
                type="number"
                min={0}
                max={15}
                value={String(autoCheckinPoints)}
                onChange={(e) => setAutoCheckinPoints(Math.max(0, Math.min(15, parseInt(e.target.value || '0', 10) || 0)))}
                disabled={autoCheckinMode === 'DISABLED'}
              />
              <Input
                label="Poin Auto Pulang (0–20)"
                type="number"
                min={0}
                max={20}
                value={String(autoCheckoutPoints)}
                onChange={(e) => setAutoCheckoutPoints(Math.max(0, Math.min(20, parseInt(e.target.value || '0', 10) || 0)))}
                disabled={!autoCheckoutEnabled}
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Standar bawaan: Auto Masuk mendapat <strong>0 poin</strong> dan Auto Pulang mendapat <strong>+10 poin</strong> (bisa diubah ke 0 jika lupa pulang tidak diberi poin).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <h5 className="font-bold text-xs text-slate-900">Pengecualian &amp; Hak Penggantian oleh Guru</h5>
            <label className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer py-1">
              <span>Lewati otomatis hari libur &amp; akhir pekan</span>
              <input
                type="checkbox"
                checked={autoSkipHolidays}
                onChange={(e) => setAutoSkipHolidays(e.target.checked)}
                className="w-4 h-4 accent-[#023246] rounded cursor-pointer shrink-0"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer py-1">
              <span>Lewati guru yang sedang Izin / Sakit / Cuti</span>
              <input
                type="checkbox"
                checked={autoSkipLeaves}
                onChange={(e) => setAutoSkipLeaves(e.target.checked)}
                className="w-4 h-4 accent-[#023246] rounded cursor-pointer shrink-0"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer py-1">
              <span>Pertahankan sumber Check-In QR/Sidik Jari saat Auto Pulang</span>
              <input
                type="checkbox"
                checked={preserveCheckInSource}
                onChange={(e) => setPreserveCheckInSource(e.target.checked)}
                className="w-4 h-4 accent-[#023246] rounded cursor-pointer shrink-0"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer py-1 border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-900">Izinkan guru tiba-tiba scan QR / Sidik Jari menimpa catatan Auto</span>
              <input
                type="checkbox"
                checked={allowOverrideScan}
                onChange={(e) => setAllowOverrideScan(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer py-1">
              <span className="font-semibold text-slate-900">Izinkan Izin / Sakit / Cuti / Koreksi membatalkan poin Auto</span>
              <input
                type="checkbox"
                checked={allowOverrideLeave}
                onChange={(e) => setAllowOverrideLeave(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
              />
            </label>
          </div>
        </div>

        {/* Aksi Simpan & Eksekusi Langsung Server Auto Pulang */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-bold text-slate-900">Simpan Kebijakan &amp; Eksekusi Auto Pulang (Server)</p>
              {isAutoDirty && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  Belum Disimpan
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Simpan perubahan aturan Auto Absen di bagian ini ke server, atau jalankan Auto Pulang sekarang untuk guru yang sudah absen masuk hari ini.
            </p>
            {lastAutoSavedAt && !isAutoDirty && (
              <p className="text-[11px] font-semibold text-emerald-700">
                Pengaturan Auto Absen tersimpan permanen pukul {lastAutoSavedAt}.
              </p>
            )}
            {lastAutoCheckoutResult && (
              <p className="text-[11px] font-semibold text-emerald-700">
                Hasil ({lastAutoCheckoutResult.date}): {lastAutoCheckoutResult.skippedReason
                  ? `Dilewati (${lastAutoCheckoutResult.skippedReason})`
                  : `${lastAutoCheckoutResult.processedCount} guru diproses pulang, ${lastAutoCheckoutResult.skippedNoCheckInCount} belum masuk dilewati.`}
              </p>
            )}
            {autoCheckoutExecError && (
              <p className="text-[11px] font-semibold text-rose-700">{autoCheckoutExecError}</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full lg:w-auto">
            <button
              type="button"
              disabled={isSavingAutoSettings || isLoading}
              onClick={() => handleSaveAutoSettings()}
              className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingAutoSettings ? 'Menyimpan...' : 'Simpan Pengaturan Auto Absen'}</span>
            </button>

            <button
              type="button"
              disabled={!autoAttendanceEnabled || !autoCheckoutEnabled || isRunningAutoCheckout || isSavingAutoSettings}
              onClick={handleTriggerServerAutoCheckout}
              className="h-11 px-4 rounded-xl bg-[#023246] hover:bg-[#034560] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isRunningAutoCheckout ? 'Menjalankan...' : 'Jalankan Auto Pulang Sekarang'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 5: GPS Geofence & Auto Location */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">📍 Koordinat GPS Sekolah & Radius Geofence</h4>
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={isGettingGps}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-extrabold text-xs rounded-xl border border-blue-200 transition-all flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>{isGettingGps ? '⏳' : '📍'}</span>
            <span>{isGettingGps ? 'Mendeteksi GPS...' : 'Ambil Koordinat GPS Saya Saat Ini'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Latitude Sekolah" value={geofenceLat} onChange={(e) => setGeofenceLat(e.target.value)} required />
          <Input label="Longitude Sekolah" value={geofenceLng} onChange={(e) => setGeofenceLng(e.target.value)} required />
          <Input label="Radius Izin Absensi (Meter)" type="number" value={geofenceRadius} onChange={(e) => setGeofenceRadius(e.target.value)} required />
        </div>

        {/* Interactive OpenStreetMap Selector */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
            <span>🗺️ Pratinjau & Pilih Posisi Sekolah pada Peta Interaktif (OpenStreetMap)</span>
            <span className="text-[10px] text-emerald-600 font-normal">💡 Klik pada peta untuk ubah titik lokasi</span>
          </div>
          <LiveLocationMap
            schoolLat={parseFloat(geofenceLat) || CONSTANTS.DEFAULTS.GEOFENCE_LAT}
            schoolLng={parseFloat(geofenceLng) || CONSTANTS.DEFAULTS.GEOFENCE_LNG}
            allowedRadius={parseInt(geofenceRadius, 10) || CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS}
            interactive={true}
            onSelectLocation={({ lat, lng }) => {
              setGeofenceLat(String(lat.toFixed(6)));
              setGeofenceLng(String(lng.toFixed(6)));
            }}
            height="260px"
          />
        </div>

        <p className="text-[11px] text-slate-500">
          Guru dapat melakukan absensi jika posisi GPS berada dalam radius <strong>{geofenceRadius} meter</strong> dari koordinat di atas.
        </p>
      </div>

      {/* Section 4: Password Keamanan Reset Absensi Admin */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">🔐 Password Keamanan Reset Absensi Admin</h4>
          <span className="px-2.5 py-0.5 bg-red-100 text-red-800 text-[10px] font-extrabold rounded-full border border-red-200">
            Strict Security Admin
          </span>
        </div>
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
          Password ini dibuat khusus oleh Anda (Admin) untuk mengamankan fitur <strong>Reset Presensi Harian</strong> (menghapus status presensi per-hari personel bilamana terjadi kekeliruan).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Password Reset Absensi Baru</label>
            <div className="relative">
              <input
                type={showResetPassword ? 'text' : 'password'}
                value={adminResetPassword}
                onChange={(e) => setAdminResetPassword(e.target.value)}
                placeholder="Buat password khusus reset..."
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 pr-10 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowResetPassword(!showResetPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                {showResetPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Konfirmasi Password Reset</label>
            <div className="relative">
              <input
                type={showResetPassword ? 'text' : 'password'}
                value={confirmResetPassword}
                onChange={(e) => setConfirmResetPassword(e.target.value)}
                placeholder="Ulangi password reset..."
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 pr-10 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: Masa Pelaksanaan Ujian & Kepanitiaan (ASTS/ASAS) */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">📋 Masa Pelaksanaan Ujian &amp; Kepanitiaan (ASTS / ASAS)</h4>
          <span
            className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border ${
              examPeriodStatus?.isActive
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : 'bg-amber-100 text-amber-800 border-amber-200'
            }`}
          >
            {examPeriodStatus?.isActive ? 'Aktif' : 'Usai / Nonaktif'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
          Kontrol saklar toggle dan waktu berakhir otomatis untuk bagian administrasi ujian serta banner penugasan kepanitiaan guru di portal utama.
        </p>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#023246]" />
              <span>Status: {examPeriodStatus?.remainingText || 'Masa Ujian Sedang Berlangsung'}</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Jika dinonaktifkan atau waktu telah lewat, banner kepanitiaan dan jadwal mengawas guru otomatis disembunyikan.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsExamPeriodModalOpen(true)}
            className="h-10 px-4 rounded-xl bg-[#023246] hover:bg-[#03445e] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-300" />
            <span>Atur Masa Ujian &amp; Batas Waktu</span>
          </button>
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <Button type="submit" variant="primary" className="bg-emerald-600 hover:bg-emerald-700 font-extrabold px-6" isLoading={isLoading}>
          💾 Simpan Perubahan Pengaturan Permanen
        </Button>
      </div>

      {/* Modal Kontrol Periode Ujian & Kepanitiaan */}
      <ExamPeriodSettingsModal
        isOpen={isExamPeriodModalOpen}
        onClose={() => setIsExamPeriodModalOpen(false)}
        onSettingsSaved={(_s, status) => setExamPeriodStatus(status)}
      />
    </form>
  );
};
