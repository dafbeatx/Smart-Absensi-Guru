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

export const SystemSettingsForm: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const [appName, setAppName] = useState('Smart Absensi Guru');
  const [institution, setInstitution] = useState('SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam');
  const [checkInStart, setCheckInStart] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKIN_START);
  const [checkInEnd, setCheckInEnd] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKIN_END);
  const [checkOutStart, setCheckOutStart] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKOUT_START);
  const [geofenceLat, setGeofenceLat] = useState(String(CONSTANTS.DEFAULTS.GEOFENCE_LAT));
  const [geofenceLng, setGeofenceLng] = useState(String(CONSTANTS.DEFAULTS.GEOFENCE_LNG));
  const [geofenceRadius, setGeofenceRadius] = useState(String(CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS));
  const [isLoading, setIsLoading] = useState(false);

  // Load existing settings from localStorage and Provider API
  useEffect(() => {
    const loadSettings = async () => {
      const savedLocal = localStorage.getItem('smart_absensi_system_settings');
      if (savedLocal) {
        try {
          const parsed = JSON.parse(savedLocal);
          if (parsed.app_name) setAppName(parsed.app_name);
          if (parsed.institution_name) setInstitution(parsed.institution_name);
          if (parsed.work_checkin_start) setCheckInStart(formatTimeForInput(parsed.work_checkin_start, CONSTANTS.DEFAULTS.WORK_CHECKIN_START));
          if (parsed.work_checkin_end) setCheckInEnd(formatTimeForInput(parsed.work_checkin_end, CONSTANTS.DEFAULTS.WORK_CHECKIN_END));
          if (parsed.work_checkout_start) setCheckOutStart(formatTimeForInput(parsed.work_checkout_start, CONSTANTS.DEFAULTS.WORK_CHECKOUT_START));
          if (parsed.geofence_lat !== undefined) setGeofenceLat(String(parsed.geofence_lat));
          if (parsed.geofence_lng !== undefined) setGeofenceLng(String(parsed.geofence_lng));
          if (parsed.geofence_radius !== undefined) setGeofenceRadius(String(parsed.geofence_radius));
        } catch (e) {
          console.error('Failed to parse local settings:', e);
        }
      }

      try {
        const provider = ProviderFactory.getProvider();
        const fetched = await provider.getSettings();
        if (fetched) {
          if (fetched.app_name) setAppName(fetched.app_name);
          if (fetched.institution_name) setInstitution(fetched.institution_name);
          if (fetched.work_checkin_start) setCheckInStart(formatTimeForInput(fetched.work_checkin_start, CONSTANTS.DEFAULTS.WORK_CHECKIN_START));
          if (fetched.work_checkin_end) setCheckInEnd(formatTimeForInput(fetched.work_checkin_end, CONSTANTS.DEFAULTS.WORK_CHECKIN_END));
          if (fetched.work_checkout_start) setCheckOutStart(formatTimeForInput(fetched.work_checkout_start, CONSTANTS.DEFAULTS.WORK_CHECKOUT_START));
          if (fetched.geofence_lat !== undefined) setGeofenceLat(String(fetched.geofence_lat));
          if (fetched.geofence_lng !== undefined) setGeofenceLng(String(fetched.geofence_lng));
          if (fetched.geofence_radius !== undefined) setGeofenceRadius(String(fetched.geofence_radius));

          localStorage.setItem('smart_absensi_system_settings', JSON.stringify({
            ...fetched,
            work_checkin_start: formatTimeForInput(fetched.work_checkin_start, CONSTANTS.DEFAULTS.WORK_CHECKIN_START),
            work_checkin_end: formatTimeForInput(fetched.work_checkin_end, CONSTANTS.DEFAULTS.WORK_CHECKIN_END),
            work_checkout_start: formatTimeForInput(fetched.work_checkout_start, CONSTANTS.DEFAULTS.WORK_CHECKOUT_START),
          }));
        }
      } catch (err) {
        console.warn('Backend fetch settings fallback:', err);
      }
    };

    loadSettings();
  }, []);

  const [isGettingGps, setIsGettingGps] = useState(false);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('error', 'GPS Tidak Didukung', 'Browser Anda tidak mendukung fitur Geolocation GPS.');
      return;
    }

    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeofenceLat(pos.coords.latitude.toFixed(6));
        setGeofenceLng(pos.coords.longitude.toFixed(6));
        setIsGettingGps(false);
        showToast('success', 'Koordinat GPS Berhasil Diambil!', `Lat: ${pos.coords.latitude.toFixed(6)}, Lng: ${pos.coords.longitude.toFixed(6)}`);
      },
      (err) => {
        setIsGettingGps(false);
        showToast('error', 'Gagal Mengambil GPS', err.message || 'Pastikan izin akses lokasi GPS pada browser sudah diperbolehkan.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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

    setGeofenceLat(String(finalLat));
    setGeofenceLng(String(finalLng));
    setGeofenceRadius(String(finalRadius));

    const updatedSettings: SystemSettings = {
      app_name: appName,
      institution_name: institution,
      work_checkin_start: checkInStart,
      work_checkin_end: checkInEnd,
      work_checkout_start: checkOutStart,
      geofence_lat: finalLat,
      geofence_lng: finalLng,
      geofence_radius: finalRadius,
    };

    // 1. Persist to localStorage
    localStorage.setItem('smart_absensi_system_settings', JSON.stringify(updatedSettings));

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
      actorRole: user?.role || 'OPERATOR',
      actionType: 'UPDATE_SETTINGS',
      targetEntity: 'System_Settings',
      newValue: JSON.stringify(updatedSettings),
      reason: 'Pembaruan Konfigurasi Jam Kerja & Geofence Sekolah oleh Operator Website',
    });

    setIsLoading(false);
    showToast('success', 'Pengaturan Tersimpan Permanen!', 'Konfigurasi jam kerja & geofence telah diperbarui dan disimpan.');
  };

  return (
    <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card space-y-5">
      <div>
        <h3 className="font-bold text-slate-900 text-sm">⚙️ Pengaturan Jam Kerja & Geofence Sekolah</h3>
        <p className="text-xs text-slate-500">Konfigurasi batas jam absensi, toleransi keterlambatan, dan radius GPS sekolah.</p>
      </div>

      {/* Section 1: Branding Identitas */}
      <div className="space-y-3 pt-1 border-t border-slate-100">
        <h4 className="font-bold text-xs text-slate-700">Identitas Aplikasi & Sekolah</h4>
        <Input label="Nama Utama Aplikasi" value={appName} onChange={(e) => setAppName(e.target.value)} required />
        <Input label="Sub-Branding / Identitas Sekolah" value={institution} onChange={(e) => setInstitution(e.target.value)} required />
      </div>

      {/* Section 2: Shift Jam Kerja */}
      <div className="space-y-3 pt-1 border-t border-slate-100">
        <h4 className="font-bold text-xs text-slate-700">Batas Waktu Shift Absensi</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Jam Mulai Masuk" type="time" value={checkInStart} onChange={(e) => setCheckInStart(e.target.value)} required />
          <Input label="Batas Tepat Waktu (07.15)" type="time" value={checkInEnd} onChange={(e) => setCheckInEnd(e.target.value)} required />
          <Input label="Jam Buka Pulang (15.30)" type="time" value={checkOutStart} onChange={(e) => setCheckOutStart(e.target.value)} required />
        </div>
      </div>

      {/* Section 3: GPS Geofence */}
      <div className="space-y-3 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs text-slate-700">Koordinat GPS Papan QR & Radius Geofence</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGetCurrentLocation}
            isLoading={isGettingGps}
            className="text-xs py-1 px-3 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            📍 Ambil Lokasi GPS Saat Ini
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Latitude Sekolah" value={geofenceLat} onChange={(e) => setGeofenceLat(e.target.value)} required />
          <Input label="Longitude Sekolah" value={geofenceLng} onChange={(e) => setGeofenceLng(e.target.value)} required />
          <Input label="Radius Izin (Meter)" type="number" value={geofenceRadius} onChange={(e) => setGeofenceRadius(e.target.value)} required />
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <Button type="submit" variant="primary" isLoading={isLoading}>
          💾 Simpan Perubahan Pengaturan Permanen
        </Button>
      </div>
    </form>
  );
};
