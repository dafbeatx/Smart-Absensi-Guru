import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { CONSTANTS } from '../../../config/constants';
import { AuditLogger } from '../../../services/audit-logger.service';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { ProviderFactory } from '../../../providers/provider-factory';
import type { SystemSettings } from '../../../types/database.types';
import { formatTimeForInput } from '../../../utils/time.utils';
import { GPSService } from '../../../services/gps.service';
import { LiveLocationMap } from '../../../components/ui/LiveLocationMap';

export const SystemSettingsForm: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const [appName, setAppName] = useState('Smart Absensi Guru');
  const [institution, setInstitution] = useState('SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam');
  const [checkInStart, setCheckInStart] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKIN_START);
  const [checkInEnd, setCheckInEnd] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKIN_END);
  const [checkOutStart, setCheckOutStart] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKOUT_START);
  const [fridayCheckoutStart, setFridayCheckoutStart] = useState<string>(CONSTANTS.DEFAULTS.FRIDAY_CHECKOUT_START);
  
  const [saturdayIsHoliday, setSaturdayIsHoliday] = useState<boolean>(true);
  const [sundayIsHoliday, setSundayIsHoliday] = useState<boolean>(true);

  const [geofenceLat, setGeofenceLat] = useState(String(CONSTANTS.DEFAULTS.GEOFENCE_LAT));
  const [geofenceLng, setGeofenceLng] = useState(String(CONSTANTS.DEFAULTS.GEOFENCE_LNG));
  const [geofenceRadius, setGeofenceRadius] = useState(String(CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS));
  
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
          if (parsed.saturday_is_holiday !== undefined) setSaturdayIsHoliday(Boolean(parsed.saturday_is_holiday));
          if (parsed.sunday_is_holiday !== undefined) setSundayIsHoliday(Boolean(parsed.sunday_is_holiday));
          if (parsed.geofence_lat !== undefined) setGeofenceLat(sanitizeCoord(parsed.geofence_lat, true));
          if (parsed.geofence_lng !== undefined) setGeofenceLng(sanitizeCoord(parsed.geofence_lng, false));
          if (parsed.geofence_radius !== undefined) setGeofenceRadius(String(parsed.geofence_radius));
        } catch (e) {
          console.error('Failed to parse local settings:', e);
        }
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
          if (fetched.saturday_is_holiday !== undefined) setSaturdayIsHoliday(Boolean(fetched.saturday_is_holiday));
          if (fetched.sunday_is_holiday !== undefined) setSundayIsHoliday(Boolean(fetched.sunday_is_holiday));
          if (fetched.geofence_lat !== undefined) setGeofenceLat(sanitizeCoord(fetched.geofence_lat, true));
          if (fetched.geofence_lng !== undefined) setGeofenceLng(sanitizeCoord(fetched.geofence_lng, false));
          if (fetched.geofence_radius !== undefined) setGeofenceRadius(String(fetched.geofence_radius));

          localStorage.setItem('smart_absensi_system_settings', JSON.stringify({
            ...fetched,
            geofence_lat: parseFloat(sanitizeCoord(fetched.geofence_lat, true)),
            geofence_lng: parseFloat(sanitizeCoord(fetched.geofence_lng, false)),
            work_checkin_start: formatTimeForInput(fetched.work_checkin_start, CONSTANTS.DEFAULTS.WORK_CHECKIN_START),
            work_checkin_end: formatTimeForInput(fetched.work_checkin_end, CONSTANTS.DEFAULTS.WORK_CHECKIN_END),
            work_checkout_start: formatTimeForInput(fetched.work_checkout_start, CONSTANTS.DEFAULTS.WORK_CHECKOUT_START),
            friday_checkout_start: formatTimeForInput(fetched.friday_checkout_start, CONSTANTS.DEFAULTS.FRIDAY_CHECKOUT_START),
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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

    // Update state to formatted values
    setGeofenceLat(String(finalLat));
    setGeofenceLng(String(finalLng));
    setGeofenceRadius(String(finalRadius));

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
    };

    // 1. Persist to localStorage
    localStorage.setItem('smart_absensi_system_settings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('smart_absensi_settings_updated'));

    // 2. Persist to backend / Google Sheets
    try {
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      await provider.updateSettings(updatedSettings, token);
    } catch (err) {
      console.warn('Failed to sync settings to backend:', err);
    }

    // 3. Log Audit Trail
    await AuditLogger.log({
      actorId: user?.id || 'op_1',
      actorRole: user?.role || 'ADMIN',
      actionType: 'UPDATE_SETTINGS',
      targetEntity: 'System_Settings',
      newValue: JSON.stringify(updatedSettings),
      reason: 'Pembaruan Detail Jam Kerja Hari Jumat & Geofence Sekolah oleh Admin Website',
    });

    setIsLoading(false);
    showToast('success', 'Pengaturan Tersimpan Permanen!', 'Pengaturan jam kerja per hari (Jumat 11:00, Sabtu-Minggu Libur) & geofence berhasil disimpan.');
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

      {/* Section 3: GPS Geofence & Auto Location */}
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

      <div className="pt-2 flex justify-end">
        <Button type="submit" variant="primary" className="bg-emerald-600 hover:bg-emerald-700 font-extrabold px-6" isLoading={isLoading}>
          💾 Simpan Perubahan Pengaturan Permanen
        </Button>
      </div>
    </form>
  );
};
