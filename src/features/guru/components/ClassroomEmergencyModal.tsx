import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useToastStore } from '../../../store/useToastStore';
import { SoundService } from '../../../services/audio.service';
import {
  EmergencyRepository,
  EMERGENCY_UPDATED_EVENT,
} from '../../../repositories/EmergencyRepository';
import { DutyScheduleRepository } from '../../../repositories/DutyScheduleRepository';
import type {
  UserProfile,
  TeachingSlot,
  TeacherDutySchedule,
  ClassroomEmergencyAlert,
  EmergencyCategory,
} from '../../../types/database.types';
import {
  AlertOctagon,
  Ambulance,
  ShieldAlert,
  Flame,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  Send,
  MessageCircle,
  History,
  Phone,
} from 'lucide-react';

export interface ClassroomEmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  teachingSlots?: TeachingSlot[];
  dutyTeachersToday?: TeacherDutySchedule[];
}

const COMMON_ROOMS = [
  'Lab Komputer 1',
  'Lab Komputer 2',
  'Lab IPA / Fisika',
  'Perpustakaan',
  'Lapangan Olahraga',
  'Ruang Musik / Seni',
  'UKS',
  'Aula Pertemuan',
  'Ruang Guru',
];

export const ClassroomEmergencyModal: React.FC<ClassroomEmergencyModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  teachingSlots = [],
  dutyTeachersToday = [],
}) => {
  const { showToast } = useToastStore();

  // Active view tab: 'CALL' | 'ACTIVE' | 'HISTORY'
  const [activeTab, setActiveTab] = useState<'CALL' | 'HISTORY'>('CALL');

  // Form states
  const [selectedCategory, setSelectedCategory] = useState<EmergencyCategory>('MEDIS_UKS');
  const [roomName, setRoomName] = useState<string>('');
  const [className, setClassName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isAutoDetected, setIsAutoDetected] = useState<boolean>(false);

  // Alerts data
  const [alerts, setAlerts] = useState<ClassroomEmergencyAlert[]>([]);
  const [dutyTeachers, setDutyTeachers] = useState<TeacherDutySchedule[]>(dutyTeachersToday);

  // Load and subscribe to emergency alerts
  const loadAlerts = useCallback(async () => {
    try {
      const data = await EmergencyRepository.getAlerts();
      setAlerts(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    loadAlerts();

    const handleUpdate = () => {
      loadAlerts();
    };

    window.addEventListener(EMERGENCY_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    // If dutyTeachersToday not provided, fetch them for today
    if (dutyTeachersToday.length === 0) {
      const dayOfWeek = new Date().getDay(); // 1 = Senin, ...
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        DutyScheduleRepository.getDutyTeachersForDay(dayOfWeek).then((teachers) => {
          setDutyTeachers(teachers);
        });
      }
    } else {
      setDutyTeachers(dutyTeachersToday);
    }

    return () => {
      window.removeEventListener(EMERGENCY_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [isOpen, loadAlerts, dutyTeachersToday]);

  // Auto-detect current active classroom from teacher's schedule
  useEffect(() => {
    if (!isOpen) return;

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const now = new Date();
    const todayDayName = dayNames[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const todaySlots = teachingSlots.filter((s) => s.day === todayDayName);
    let matchedSlot: TeachingSlot | undefined;

    for (const slot of todaySlots) {
      try {
        const [startStr, endStr] = slot.time.split('-').map((t) => t.trim());
        if (startStr && endStr) {
          const [sh, sm] = startStr.split(':').map((n) => parseInt(n, 10));
          const [eh, em] = endStr.split(':').map((n) => parseInt(n, 10));
          const startMin = sh * 60 + sm;
          const endMin = eh * 60 + em;

          if (currentMinutes >= startMin && currentMinutes <= endMin) {
            matchedSlot = slot;
            break;
          }
        }
      } catch {
        // ignore parse error
      }
    }

    if (matchedSlot) {
      const detectedRoom = matchedSlot.room || matchedSlot.className || '';
      setRoomName(detectedRoom);
      setClassName(matchedSlot.className || '');
      setIsAutoDetected(true);
    } else if (todaySlots.length > 0 && !roomName) {
      // Fallback ke slot pertama hari ini jika guru belum mengisi
      const first = todaySlots[0];
      setRoomName(first.room || first.className || '');
      setClassName(first.className || '');
      setIsAutoDetected(false);
    } else if (!roomName) {
      setRoomName('');
      setClassName('');
      setIsAutoDetected(false);
    }
  }, [isOpen, teachingSlots]);

  // User's own active alert
  const myActiveAlert = useMemo(() => {
    return alerts.find(
      (a) =>
        a.teacher_id === currentUser.id &&
        (a.status === 'ACTIVE' || a.status === 'RESPONDED')
    );
  }, [alerts, currentUser.id]);

  // Handle Send SOS Emergency
  const handleSendSOS = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomName.trim()) {
      showToast('warning', 'Peringatan', 'Harap tentukan lokasi ruang kelas terlebih dahulu');
      return;
    }

    setIsSubmitting(true);
    try {
      // Play emergency alert sound
      SoundService.playEmergencyAlert();

      const newAlert = await EmergencyRepository.createAlert(
        currentUser.id,
        currentUser.full_name || 'Guru Pengajar',
        {
          room_name: roomName.trim(),
          class_name: className.trim() || undefined,
          category: selectedCategory,
          notes: notes.trim() || undefined,
        }
      );

      // Trigger soft vibration on supported mobile devices
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }

      setAlerts((prev) => [newAlert, ...prev]);
      showToast('success', 'SOS Terkirim', '🚨 Panggilan Darurat Terkirim! Guru Piket telah diberi notifikasi.');
      setNotes('');
    } catch {
      showToast('error', 'Gagal', 'Gagal mengirim panggilan darurat. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Resolve
  const handleResolveAlert = async (alertId: string) => {
    try {
      await EmergencyRepository.resolveAlert(alertId, 'Situasi terkendali');
      SoundService.playSuccess();
      showToast('success', 'Selesai', 'Panggilan darurat ditandai selesai. Situasi aman.');
      loadAlerts();
    } catch {
      showToast('error', 'Gagal', 'Gagal memperbarui status darurat');
    }
  };

  // Handle Cancel
  const handleCancelAlert = async (alertId: string) => {
    if (!confirm('Apakah Anda yakin ingin membatalkan panggilan darurat ini?')) return;
    try {
      await EmergencyRepository.cancelAlert(alertId);
      showToast('info', 'Dibatalkan', 'Panggilan darurat dibatalkan.');
      loadAlerts();
    } catch {
      showToast('error', 'Gagal', 'Gagal membatalkan panggilan darurat');
    }
  };

  // Render Category Icon
  const renderCategoryIcon = (cat: EmergencyCategory, sizeClass = 'w-5 h-5') => {
    switch (cat) {
      case 'MEDIS_UKS':
        return <Ambulance className={sizeClass} />;
      case 'DISIPLIN_PERKELAHIAN':
        return <ShieldAlert className={sizeClass} />;
      case 'LAB_K3':
        return <Flame className={sizeClass} />;
      case 'LAINNYA':
      default:
        return <AlertOctagon className={sizeClass} />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🚨 Panggilan Bantuan Darurat Kelas (SOS)"
      maxWidth="md"
    >
      <div className="space-y-4 text-slate-800">
        {/* Navigation Sub-Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab('CALL')}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'CALL'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Panggil SOS</span>
            {myActiveAlert && (
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping ml-1" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'HISTORY'
                ? 'bg-white text-[#023246] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Riwayat ({alerts.length})</span>
          </button>
        </div>

        {/* ── TAB 1: PANGGILAN DARURAT (SOS) ─────────────────────────────────── */}
        {activeTab === 'CALL' && (
          <div className="space-y-4">
            {/* Active SOS Ongoing Card (If this teacher currently has an active call) */}
            {myActiveAlert && (
              <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 shadow-xs space-y-3 animate-pulse">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-rose-600 text-white shadow-2xs">
                      <Ambulance className="w-5 h-5 animate-bounce" />
                    </span>
                    <div>
                      <p className="text-xs font-black text-rose-950 uppercase tracking-wide">
                        Panggilan Darurat Sedang Aktif!
                      </p>
                      <p className="text-[11px] font-bold text-rose-700">
                        {EmergencyRepository.CATEGORY_META[myActiveAlert.category]?.label}
                      </p>
                    </div>
                  </div>
                  <Badge variant="danger">
                    {myActiveAlert.status === 'RESPONDED' ? 'Sedang Dituju' : 'Memanggil'}
                  </Badge>
                </div>

                <div className="bg-white/90 rounded-xl p-3 text-xs space-y-1.5 border border-rose-200">
                  <div className="flex items-center justify-between text-slate-600 font-bold">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-600" />
                      Lokasi: {myActiveAlert.room_name}
                      {myActiveAlert.class_name ? ` (${myActiveAlert.class_name})` : ''}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(myActiveAlert.created_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      WIB
                    </span>
                  </div>
                  {myActiveAlert.notes && (
                    <p className="text-[11px] text-slate-700 italic bg-rose-50/70 p-2 rounded-lg">
                      &ldquo;{myActiveAlert.notes}&rdquo;
                    </p>
                  )}
                  {myActiveAlert.responded_by && (
                    <p className="text-[11px] font-black text-emerald-800 bg-emerald-50 p-2 rounded-lg flex items-center gap-1.5 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        Direspon oleh: <strong>{myActiveAlert.responded_by}</strong> (Sedang
                        menuju lokasi)
                      </span>
                    </p>
                  )}
                </div>

                {/* Actions for current active SOS */}
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 cursor-pointer shadow-xs"
                    onClick={() => handleResolveAlert(myActiveAlert.id)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Situasi Aman / Selesai
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-slate-600 hover:text-rose-700 hover:bg-rose-100 font-bold h-10 cursor-pointer border border-rose-200"
                    onClick={() => handleCancelAlert(myActiveAlert.id)}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Batalkan
                  </Button>
                </div>
              </div>
            )}

            {/* Form Panggilan Baru */}
            <form onSubmit={handleSendSOS} className="space-y-4">
              {/* 1. Pilih Kategori Darurat (4 Tiles) */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Pilih Jenis Kedaruratan:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(EmergencyRepository.CATEGORY_META) as EmergencyCategory[]).map(
                    (catKey) => {
                      const meta = EmergencyRepository.CATEGORY_META[catKey];
                      const isSelected = selectedCategory === catKey;

                      return (
                        <button
                          key={catKey}
                          type="button"
                          onClick={() => setSelectedCategory(catKey)}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[90px] ${
                            isSelected
                              ? `${meta.bgClass} border-2 border-rose-500 ring-2 ring-rose-300/40 shadow-xs scale-[1.01]`
                              : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xl">{meta.emoji}</span>
                            <span
                              className={`p-1 rounded-lg ${
                                isSelected ? 'bg-white shadow-2xs text-rose-600' : 'text-slate-400'
                              }`}
                            >
                              {renderCategoryIcon(catKey, 'w-4 h-4')}
                            </span>
                          </div>
                          <div>
                            <p
                              className={`text-xs font-black leading-tight ${
                                isSelected ? 'text-slate-950' : 'text-slate-800'
                              }`}
                            >
                              {meta.shortLabel}
                            </p>
                            <p className="text-[9px] text-slate-500 font-medium leading-tight line-clamp-2 mt-0.5">
                              {meta.subtitle}
                            </p>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* 2. Lokasi Ruang Kelas (Auto-detected + Quick Select) */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-600" />
                    <span>Ruang / Lokasi Kejadian:</span>
                  </label>
                  {isAutoDetected && (
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      ✓ Terdeteksi dari Jadwal KBM
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => {
                        setRoomName(e.target.value);
                        setIsAutoDetected(false);
                      }}
                      placeholder="Nama Ruang (mis: Lab IPA 1)"
                      required
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      placeholder="Kelas (opsional, mis: 8A)"
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                {/* Quick Room Badges */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {COMMON_ROOMS.map((rm) => (
                    <button
                      key={rm}
                      type="button"
                      onClick={() => {
                        setRoomName(rm);
                        setIsAutoDetected(false);
                      }}
                      className={`text-[10px] px-2 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                        roomName === rm
                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {rm}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Catatan Tambahan (Opsional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Keterangan Situasi Singkat (Opsional):</span>
                  <span className="text-[10px] text-slate-400 font-normal">Maks. 150 huruf</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={150}
                  rows={2}
                  placeholder="Contoh: Siswa pingsan saat upacara/praktikum, butuh tandu & minyak kayu putih..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* 4. Tombol Utama Kirim SOS */}
              <Button
                type="submit"
                disabled={isSubmitting || !roomName.trim()}
                variant="primary"
                className="w-full bg-linear-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white font-black text-sm h-12 rounded-2xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
              >
                <ShieldAlert className="w-5 h-5 text-amber-300 animate-pulse" />
                <span>
                  {isSubmitting ? 'Mengirim Panggilan...' : 'KIRIM PANGGILAN DARURAT (SOS)'}
                </span>
                <Send className="w-4 h-4 ml-1" />
              </Button>
            </form>

            {/* 5. Info Petugas Piket Hari Ini */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  Guru Piket Hari Ini:
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {dutyTeachers.length} Guru Bertugas
                </span>
              </div>

              {dutyTeachers.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic px-1">
                  Jadwal piket hari ini belum diatur oleh admin.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-1.5">
                  {dutyTeachers.map((dt) => (
                    <div
                      key={dt.id || dt.teacher_id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-extrabold text-slate-800 truncate">{dt.teacher_name}</p>
                        <p className="text-[10px] text-slate-500 font-medium truncate">
                          {dt.notes || 'Guru Piket Bertugas'}
                        </p>
                      </div>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `Halo Bapak/Ibu ${dt.teacher_name}, mohon bantuan darurat di ${roomName || 'ruang kelas'}. Terima kasih!`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 shrink-0 shadow-2xs transition-all"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>Chat WA</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: RIWAYAT PANGGILAN DARURAT ──────────────────────────────── */}
        {activeTab === 'HISTORY' && (
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 space-y-2">
                <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-bold">Belum ada riwayat panggilan darurat.</p>
                <p className="text-[11px] text-slate-400">
                  Situasi KBM di sekolah aman dan terkendali.
                </p>
              </div>
            ) : (
              alerts.map((alert) => {
                const meta = EmergencyRepository.CATEGORY_META[alert.category];
                const isResolved = alert.status === 'RESOLVED';
                const isActive = alert.status === 'ACTIVE' || alert.status === 'RESPONDED';

                return (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-2xl border text-xs space-y-2 transition-all ${
                      isActive
                        ? 'bg-rose-50/80 border-rose-300 shadow-xs'
                        : isResolved
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-slate-100/60 border-slate-200 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{meta?.emoji || '🚨'}</span>
                        <div>
                          <p className="font-extrabold text-slate-900 leading-tight">
                            {meta?.shortLabel || alert.category}
                          </p>
                          <p className="text-[10px] text-slate-500 font-semibold">
                            Oleh: {alert.teacher_name}
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant={
                          alert.status === 'ACTIVE'
                            ? 'danger'
                            : alert.status === 'RESPONDED'
                            ? 'warning'
                            : alert.status === 'RESOLVED'
                            ? 'success'
                            : 'neutral'
                        }
                      >
                        {alert.status === 'ACTIVE'
                          ? 'Aktif'
                          : alert.status === 'RESPONDED'
                          ? 'Ditangani'
                          : alert.status === 'RESOLVED'
                          ? 'Selesai'
                          : 'Batal'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 bg-white/80 p-2 rounded-xl border border-slate-200/60">
                      <span className="flex items-center gap-1 font-bold">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        {alert.room_name}
                        {alert.class_name ? ` (${alert.class_name})` : ''}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(alert.created_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {alert.notes && (
                      <p className="text-[11px] text-slate-600 italic bg-white/60 p-2 rounded-lg">
                        &ldquo;{alert.notes}&rdquo;
                      </p>
                    )}

                    {alert.responded_by && (
                      <p className="text-[10px] font-bold text-emerald-800">
                        ✓ Direspon: {alert.responded_by}
                      </p>
                    )}

                    {/* Quick Resolve Button if Active and Current User is Duty Teacher or the Reporter */}
                    {isActive && (
                      <div className="flex justify-end pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-emerald-700 hover:bg-emerald-100 font-bold py-1 h-8"
                          onClick={() => handleResolveAlert(alert.id)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Tandai Selesai
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
