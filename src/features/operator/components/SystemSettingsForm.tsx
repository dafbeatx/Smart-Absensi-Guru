import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { CONSTANTS } from '../../../config/constants';
import { AuditLogger } from '../../../services/audit-logger.service';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    await AuditLogger.log({
      actorId: user?.id || 'op_1',
      actorRole: 'OPERATOR',
      actionType: 'UPDATE_SETTINGS',
      targetEntity: 'System_Settings',
      newValue: JSON.stringify({
        appName,
        institution,
        checkInStart,
        checkInEnd,
        checkOutStart,
        geofenceLat,
        geofenceLng,
        geofenceRadius,
      }),
      reason: 'Pembaruan Konfigurasi Jam Kerja & Geofence Sekolah oleh Operator',
    });

    setIsLoading(false);
    showToast('success', 'Pengaturan Tersimpan!', 'Konfigurasi jam kerja & geofence telah diperbarui.');
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
        <h4 className="font-bold text-xs text-slate-700">Koordinat GPS Papan QR & Radius Geofence</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Latitude Sekolah" value={geofenceLat} onChange={(e) => setGeofenceLat(e.target.value)} required />
          <Input label="Longitude Sekolah" value={geofenceLng} onChange={(e) => setGeofenceLng(e.target.value)} required />
          <Input label="Radius Izin (Meter)" type="number" value={geofenceRadius} onChange={(e) => setGeofenceRadius(e.target.value)} required />
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <Button type="submit" variant="primary" isLoading={isLoading}>
          💾 Simpan Perubahan Pengaturan
        </Button>
      </div>
    </form>
  );
};
