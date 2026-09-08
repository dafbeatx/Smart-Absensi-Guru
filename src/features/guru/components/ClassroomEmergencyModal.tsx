import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ArrowLeft,
  ArrowRight,
  X,
  Edit3,
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

  // Active view tab: 'CALL' | 'DUTY' | 'HISTORY'
  const [mainTab, setMainTab] = useState<'CALL' | 'DUTY' | 'HISTORY'>('CALL');

  // Multi-step layer within CALL: 1 = Pilih Kategori, 2 = Konfirmasi Ruang & Kirim
  const [callStep, setCallStep] = useState<1 | 2>(1);

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

    if (dutyTeachersToday.length === 0) {
      const dayOfWeek = new Date().getDay();
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

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // User's own active alert
  const myActiveAlert = useMemo(() => {
    return alerts.find(
      (a) =>
        a.teacher_id === currentUser.id &&
        (a.status === 'ACTIVE' || a.status === 'RESPONDED')
    );
  }, [alerts, currentUser.id]);

  // Handle Send SOS Emergency
  const handleSendSOS = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!roomName.trim()) {
      showToast('warning', 'Peringatan', 'Harap tentukan lokasi ruang kelas terlebih dahulu');
      return;
    }

    setIsSubmitting(true);
    try {
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

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }

      setAlerts((prev) => [newAlert, ...prev]);
      showToast('success', 'SOS Terkirim', '🚨 Panggilan Darurat Terkirim! Guru Piket telah diberi notifikasi.');
      setNotes('');
      setCallStep(1);
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

  const renderCategoryIcon = (cat: EmergencyCategory, sizeClass = 'w-4 h-4') => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      {/* Backdrop overlay click to close */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Main Modal Card: Ergonomic, Non-Overlapping & Viewport Constrained */}
      <div className="relative w-full max-w-115 bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[85vh] sm:max-h-[88vh] overflow-hidden z-10 animate-scale-up">
        {/* ── 1. STICKY HEADER (Always visible at top, never covered) ────────── */}
        <div className="shrink-0 bg-white border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <ShieldAlert className="w-4 h-4 text-amber-300" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900 truncate leading-tight">
                  Panggilan Darurat Kelas (SOS)
                </h3>
                <p className="text-[10px] text-slate-500 font-bold truncate">
                  Respon Cepat Guru Piket &amp; Tim UKS
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-500 hover:text-slate-800 font-bold transition-all cursor-pointer shrink-0"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Layer Sub-Tabs: SOS, Petugas Piket, Riwayat */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 mt-2.5 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setMainTab('CALL')}
              className={`flex-1 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mainTab === 'CALL'
                  ? 'bg-white text-rose-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Panggil SOS</span>
              {myActiveAlert && (
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMainTab('DUTY')}
              className={`flex-1 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mainTab === 'DUTY'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Piket ({dutyTeachers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setMainTab('HISTORY')}
              className={`flex-1 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mainTab === 'HISTORY'
                  ? 'bg-white text-[#023246] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat ({alerts.length})</span>
            </button>
          </div>
        </div>

        {/* ── 2. SCROLLABLE BODY (Scrolls independently between header & footer) ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* ──── LAYER A: PANGGILAN SOS ────────────────────────────────────── */}
          {mainTab === 'CALL' && (
            <div className="space-y-3">
              {/* Active SOS Ongoing Card (If user currently has an active call) */}
              {myActiveAlert && (
                <div className="p-3 rounded-xl bg-rose-50 border-2 border-rose-300 shadow-xs space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-rose-600 text-white shadow-2xs">
                        <Ambulance className="w-4 h-4 animate-bounce" />
                      </span>
                      <div>
                        <p className="text-[11px] font-black text-rose-950 uppercase tracking-wide">
                          Panggilan Darurat Anda Sedang Aktif!
                        </p>
                        <p className="text-[10px] font-bold text-rose-700">
                          {EmergencyRepository.CATEGORY_META[myActiveAlert.category]?.label}
                        </p>
                      </div>
                    </div>
                    <Badge variant="danger">
                      {myActiveAlert.status === 'RESPONDED' ? 'Sedang Dituju' : 'Memanggil'}
                    </Badge>
                  </div>

                  <div className="bg-white rounded-lg p-2.5 text-[11px] space-y-1 border border-rose-200">
                    <div className="flex items-center justify-between text-slate-700 font-bold">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-rose-600" />
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
                      <p className="text-[10px] text-slate-600 italic bg-rose-50/60 p-1.5 rounded">
                        &ldquo;{myActiveAlert.notes}&rdquo;
                      </p>
                    )}
                    {myActiveAlert.responded_by && (
                      <p className="text-[10px] font-black text-emerald-800 bg-emerald-50 p-1.5 rounded flex items-center gap-1 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Direspon oleh: <strong>{myActiveAlert.responded_by}</strong></span>
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 text-xs cursor-pointer shadow-xs"
                      onClick={() => handleResolveAlert(myActiveAlert.id)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Situasi Selesai / Aman
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-slate-600 hover:text-rose-700 hover:bg-rose-100 font-bold h-9 text-xs cursor-pointer border border-rose-200"
                      onClick={() => handleCancelAlert(myActiveAlert.id)}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Batalkan
                    </Button>
                  </div>
                </div>
              )}

              {/* ── STEP 1: PILIH KATEGORI (Layer 1) ────────────────────── */}
              {callStep === 1 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                      Langkah 1/2: Pilih Jenis Kedaruratan
                    </span>
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      Sentuh untuk lanjut
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(EmergencyRepository.CATEGORY_META) as EmergencyCategory[]).map(
                      (catKey) => {
                        const meta = EmergencyRepository.CATEGORY_META[catKey];
                        const isSelected = selectedCategory === catKey;

                        return (
                          <button
                            key={catKey}
                            type="button"
                            onClick={() => {
                              setSelectedCategory(catKey);
                              setCallStep(2); // Auto-advance to Step 2 for speed
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-19 ${
                              isSelected
                                ? 'bg-rose-50/90 border-2 border-rose-500 shadow-2xs scale-[1.01]'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-lg leading-none">{meta.emoji}</span>
                              <span
                                className={`p-1 rounded-lg ${
                                  isSelected ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-400 bg-slate-100'
                                }`}
                              >
                                {renderCategoryIcon(catKey, 'w-3.5 h-3.5')}
                              </span>
                            </div>
                            <div className="mt-1">
                              <p className="text-xs font-black text-slate-900 leading-tight">
                                {meta.shortLabel}
                              </p>
                              <p className="text-[9px] text-slate-500 font-medium leading-tight line-clamp-1 mt-0.5">
                                {meta.subtitle}
                              </p>
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}

              {/* ── STEP 2: LOKASI & KONFIRMASI (Layer 2) ────────────────── */}
              {callStep === 2 && (
                <div className="space-y-3">
                  {/* Selected Category Summary Bar */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-rose-50/80 border border-rose-200 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">
                        {EmergencyRepository.CATEGORY_META[selectedCategory]?.emoji}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-rose-950 truncate">
                          {EmergencyRepository.CATEGORY_META[selectedCategory]?.label}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCallStep(1)}
                      className="px-2 py-1 bg-white hover:bg-rose-100 text-rose-700 text-[10px] font-black rounded-lg border border-rose-200 flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Ganti</span>
                    </button>
                  </div>

                  {/* Lokasi Ruang Kelas */}
                  <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-600" />
                        <span>Ruang / Lokasi Kejadian: *</span>
                      </label>
                      {isAutoDetected && (
                        <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                          ✓ Dari Jadwal KBM
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={roomName}
                        onChange={(e) => {
                          setRoomName(e.target.value);
                          setIsAutoDetected(false);
                        }}
                        placeholder="Nama Ruang (wajib)"
                        required
                        className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                      <input
                        type="text"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        placeholder="Kelas (opsional, mis: 8A)"
                        className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    {/* Quick Room Badges (Horizontal scroll / compact wrap) */}
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {COMMON_ROOMS.slice(0, 7).map((rm) => (
                        <button
                          key={rm}
                          type="button"
                          onClick={() => {
                            setRoomName(rm);
                            setIsAutoDetected(false);
                          }}
                          className={`text-[9px] px-2 py-0.5 rounded font-bold border transition-all cursor-pointer ${
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

                  {/* Keterangan Tambahan */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                      <span>Catatan Situasi (Opsional):</span>
                      <span className="text-[9px] text-slate-400">Maks. 150 huruf</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={150}
                      rows={2}
                      placeholder="Contoh: Siswa pingsan saat olahraga, butuh tandu UKS..."
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──── LAYER B: PETUGAS PIKET HARI INI ──────────────────────────── */}
          {mainTab === 'DUTY' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  Petugas Piket Bertugas:
                </span>
                <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full">
                  {dutyTeachers.length} Guru
                </span>
              </div>

              {dutyTeachers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 space-y-1.5">
                  <Phone className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold">Belum ada jadwal guru piket hari ini.</p>
                  <p className="text-[10px] text-slate-400">
                    Jadwal piket dapat diatur oleh Admin melalui menu Jadwal Piket.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {dutyTeachers.map((dt) => (
                    <div
                      key={dt.id || dt.teacher_id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-extrabold text-slate-900 truncate">{dt.teacher_name}</p>
                        <p className="text-[10px] text-slate-500 font-medium truncate">
                          {dt.notes || 'Guru Piket Sekolah'}
                        </p>
                      </div>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `🚨 *Panggilan Bantuan Darurat Guru*\nHalo Bapak/Ibu ${dt.teacher_name}, mohon bantuan segera di: *${
                            roomName || 'ruang kelas'
                          }*.\nTerima kasih!`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-[10px] flex items-center gap-1 shrink-0 shadow-2xs transition-all"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>Hubungi WA</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ──── LAYER C: RIWAYAT PANGGILAN DARURAT ───────────────────────── */}
          {mainTab === 'HISTORY' && (
            <div className="space-y-2">
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-slate-400 space-y-1.5">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold">Belum ada catatan riwayat panggilan.</p>
                  <p className="text-[10px] text-slate-400">
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
                      className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                        isActive
                          ? 'bg-rose-50/90 border-rose-300 shadow-2xs'
                          : isResolved
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-slate-100/60 border-slate-200 opacity-70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-base shrink-0">{meta?.emoji || '🚨'}</span>
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-900 leading-tight truncate">
                              {meta?.shortLabel || alert.category}
                            </p>
                            <p className="text-[9px] text-slate-500 font-semibold truncate">
                              Pelapor: {alert.teacher_name}
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
                            ? 'Dituju'
                            : alert.status === 'RESOLVED'
                            ? 'Selesai'
                            : 'Batal'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-600 bg-white/90 p-1.5 rounded-lg border border-slate-200/70">
                        <span className="flex items-center gap-1 font-bold truncate">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          {alert.room_name}
                          {alert.class_name ? ` (${alert.class_name})` : ''}
                        </span>
                        <span className="text-[9px] text-slate-400 shrink-0 ml-1">
                          {new Date(alert.created_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {alert.notes && (
                        <p className="text-[10px] text-slate-600 italic bg-white/60 p-1.5 rounded">
                          &ldquo;{alert.notes}&rdquo;
                        </p>
                      )}

                      {isActive && (
                        <div className="flex justify-end pt-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-[10px] text-emerald-700 hover:bg-emerald-100 font-bold py-0.5 h-7"
                            onClick={() => handleResolveAlert(alert.id)}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
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

        {/* ── 3. STICKY FOOTER (Always visible at bottom, never covered) ─────── */}
        <div className="shrink-0 bg-slate-50 border-t border-slate-200/80 px-4 py-2.5 sm:py-3">
          {mainTab === 'CALL' && callStep === 1 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 text-slate-600 hover:bg-slate-200/70 font-bold text-xs h-11 rounded-xl cursor-pointer"
                onClick={onClose}
              >
                Tutup
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-2 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-black text-xs h-11 rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                onClick={() => setCallStep(2)}
              >
                <span>Lanjut: Ruang &amp; Kirim</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {mainTab === 'CALL' && callStep === 2 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 text-slate-600 hover:bg-slate-200/70 font-bold text-xs h-11 rounded-xl cursor-pointer flex items-center justify-center gap-1"
                onClick={() => setCallStep(1)}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali</span>
              </Button>
              <Button
                type="button"
                disabled={isSubmitting || !roomName.trim()}
                variant="primary"
                className="flex-2 bg-linear-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 active:scale-98 text-white font-black text-xs h-11 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5 border-none disabled:opacity-50"
                onClick={() => handleSendSOS()}
              >
                <ShieldAlert className="w-4 h-4 text-amber-300 animate-pulse shrink-0" />
                <span>{isSubmitting ? 'Mengirim...' : 'KIRIM SOS KE PIKET'}</span>
                <Send className="w-3.5 h-3.5 ml-0.5 shrink-0" />
              </Button>
            </div>
          )}

          {(mainTab === 'DUTY' || mainTab === 'HISTORY') && (
            <Button
              type="button"
              variant="primary"
              className="w-full bg-[#023246] hover:bg-[#03405a] text-white font-bold text-xs h-11 rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
              onClick={() => {
                setMainTab('CALL');
                setCallStep(1);
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Panggilan SOS</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
