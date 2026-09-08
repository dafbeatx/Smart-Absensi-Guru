import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { LeaveRepository } from '../../../repositories/LeaveRepository';
import { GroqAIService } from '../../../services/groq-ai.service';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { logger } from '../../../utils/logger.utils';
import type { AttendanceRecord } from '../../../types/database.types';
import { CONSTANTS } from '../../../config/constants';
import { ProviderFactory } from '../../../providers/provider-factory';
import { getTodayDateInJakarta, formatTimeForInput } from '../../../utils/time.utils';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Send,
  X,
  Edit3,
  Sunset,
  Sunrise,
} from 'lucide-react';

export interface GuruCorrectionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  onSuccess?: () => void;
}

export type CorrectionScope = 'MASUK' | 'PULANG' | 'KEDUANYA';

export const GuruCorrectionRequestModal: React.FC<GuruCorrectionRequestModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  onSuccess,
}) => {
  const { token, user } = useAuthStore();
  const { showToast } = useToastStore();
  const todayStr = getTodayDateInJakarta();

  // Multi-step layer: 1 = Tanggal & Status, 2 = Jam & Alasan
  const [step, setStep] = useState<1 | 2>(1);

  // Form states
  const [date, setDate] = useState(initialDate || todayStr);
  const [checkInTime, setCheckInTime] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKIN_START);
  const [checkOutTime, setCheckOutTime] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKOUT_START);
  const [targetStatus, setTargetStatus] = useState<'HADIR' | 'IZIN' | 'SAKIT'>('HADIR');
  const [correctionScope, setCorrectionScope] = useState<CorrectionScope>('MASUK');
  const [existingRecord, setExistingRecord] = useState<AttendanceRecord | null>(null);

  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAiPolishing, setIsAiPolishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkinEnd, setCheckinEnd] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKIN_END);

  // Helper for yesterday's date
  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setErrorMsg(null);

      ProviderFactory.getProvider()
        .getSettings()
        .then((st) => {
          if (st?.work_checkin_end) setCheckinEnd(st.work_checkin_end.slice(0, 5));
        })
        .catch(() => {});

      if (initialDate) {
        setDate(initialDate);
      } else {
        setDate(todayStr);
      }
    }
  }, [isOpen, initialDate, todayStr]);

  // Fetch existing attendance data for current teacher on selected date
  useEffect(() => {
    if (isOpen && user?.id && date) {
      const userToken = token || 'MOCK_TOKEN';
      ProviderFactory.getProvider()
        .getDailyAttendance(date, userToken)
        .then((records) => {
          const rec = records.find((r) => r.user_id === user.id);
          if (rec) {
            setExistingRecord(rec);
            if (rec.status === 'HADIR' || rec.status === 'IZIN' || rec.status === 'SAKIT') {
              setTargetStatus(rec.status);
            }
            if (rec.check_in_time) setCheckInTime(formatTimeForInput(rec.check_in_time));
            if (rec.check_out_time) setCheckOutTime(formatTimeForInput(rec.check_out_time));
          } else {
            setExistingRecord(null);
            setTargetStatus('HADIR');
            setCheckInTime(CONSTANTS.DEFAULTS.WORK_CHECKIN_START);
            setCheckOutTime(CONSTANTS.DEFAULTS.WORK_CHECKOUT_START);
          }
        })
        .catch(() => {
          setExistingRecord(null);
        });
    }
  }, [isOpen, user?.id, date, token]);

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleNextToStep2 = () => {
    setErrorMsg(null);
    if (date > todayStr) {
      setErrorMsg(`Tanggal absensi (${date}) tidak boleh melebihi tanggal hari ini (${todayStr}).`);
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (date > todayStr) {
      setErrorMsg(
        `Tanggal absensi (${date}) tidak boleh melebihi tanggal hari ini (${todayStr}). Pengajuan tanggal mendatang tidak diizinkan!`
      );
      return;
    }

    if (!reason || reason.trim().length < 10) {
      setErrorMsg(
        'Alasan pengajuan koreksi wajib diisi minimal 10 karakter (misal: "Kendala GPS saat scan QR masuk").'
      );
      return;
    }

    setIsLoading(true);

    try {
      let scopeText = '';
      if (targetStatus === 'HADIR') {
        const inFormatted = formatTimeForInput(checkInTime, CONSTANTS.DEFAULTS.WORK_CHECKIN_START);
        const outFormatted = formatTimeForInput(checkOutTime, CONSTANTS.DEFAULTS.WORK_CHECKOUT_START);

        if (correctionScope === 'MASUK') {
          scopeText = ` [Target Koreksi: Jam Masuk (${inFormatted} WIB)]`;
        } else if (correctionScope === 'PULANG') {
          scopeText = ` [Target Koreksi: Jam Pulang (${outFormatted} WIB)]`;
        } else {
          scopeText = ` [Target Koreksi: Masuk (${inFormatted} WIB) & Pulang (${outFormatted} WIB)]`;
        }
      }

      const fullReason = `[Pengajuan Koreksi Absen ${date}${scopeText} menjadi ${targetStatus}]: ${reason.trim()}`;

      await LeaveRepository.submitLeave({
        token: token || 'MOCK_TOKEN',
        leave_type: 'KOREKSI_ABSEN',
        start_date: date,
        end_date: date,
        reason: fullReason,
      });

      logger.info(
        'GuruCorrectionRequestModal',
        'Correction request submitted as pending leave request for date:',
        date
      );
      showToast(
        'success',
        'Pengajuan Koreksi Terkirim!',
        'Pengajuan koreksi Anda telah masuk ke daftar persetujuan Admin/Kepsek.'
      );

      setIsLoading(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Gagal mengirimkan pengajuan koreksi absen';
      setErrorMsg(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      {/* Backdrop overlay */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Main Modal Card: Ergonomic, Multi-Step & Viewport Constrained */}
      <div className="relative w-full max-w-115 bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[85vh] sm:max-h-[88vh] overflow-hidden z-10 animate-scale-up">
        {/* ── 1. STICKY HEADER (Always visible at top, never covered) ────────── */}
        <div className="shrink-0 bg-white border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-sm">
                ✏️
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900 truncate leading-tight">
                  Ajukan Koreksi Absensi Guru
                </h3>
                <p className="text-[10px] text-slate-500 font-bold truncate">
                  {step === 1 ? 'Langkah 1/2: Tanggal & Target Status' : 'Langkah 2/2: Jam & Alasan Pengajuan'}
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

          {/* Stepper Progress Indicator */}
          <div className="flex items-center gap-2 mt-2.5 px-0.5">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                step === 1
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-black">
                1
              </span>
              <span>Pilih Tanggal &amp; Status</span>
            </button>

            <button
              type="button"
              onClick={handleNextToStep2}
              className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                step === 2
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-black ${
                  step === 2 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                }`}
              >
                2
              </span>
              <span>Jam Baru &amp; Alasan</span>
            </button>
          </div>
        </div>

        {/* ── 2. SCROLLABLE BODY (Scrolls independently between header & footer) ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ──── LAYER / STEP 1: PILIH TANGGAL & TARGET STATUS ────────────── */}
          {step === 1 && (
            <div className="space-y-3.5">
              {/* 1. Pilih Tanggal Absensi */}
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tanggal yang Ingin Dikoreksi:</span>
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setDate(todayStr)}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        date === todayStr
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(getYesterdayStr())}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        date === getYesterdayStr()
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Kemarin
                    </button>
                  </div>
                </div>

                <input
                  type="date"
                  value={date}
                  max={todayStr}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                {/* Live Preview of Existing Record on This Date */}
                <div className="mt-1 p-2 bg-white rounded-lg border border-slate-200/80 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-600">Catatan Absensi Saat Ini:</span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-black text-[10px] ${
                        existingRecord?.status === 'HADIR'
                          ? 'bg-emerald-100 text-emerald-800'
                          : existingRecord?.status === 'IZIN'
                          ? 'bg-blue-100 text-blue-800'
                          : existingRecord?.status === 'SAKIT'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {existingRecord?.status || 'Belum Ada Record (Alpha)'}
                    </span>
                  </div>

                  {existingRecord ? (
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                      <span>
                        Masuk:{' '}
                        <strong>
                          {existingRecord.check_in_time
                            ? `${existingRecord.check_in_time.slice(0, 5)} WIB`
                            : '-'}
                        </strong>
                      </span>
                      <span>
                        Pulang:{' '}
                        <strong>
                          {existingRecord.check_out_time
                            ? `${existingRecord.check_out_time.slice(0, 5)} WIB`
                            : 'Belum Pulang'}
                        </strong>
                      </span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">
                      Tidak ditemukan log presensi pada tanggal {date}.
                    </p>
                  )}
                </div>
              </div>

              {/* 2. Pilih Status yang Diharapkan (3 Cards) */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  Status Presensi yang Diajukan:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetStatus('HADIR')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      targetStatus === 'HADIR'
                        ? 'bg-emerald-50 border-2 border-emerald-500 shadow-2xs text-emerald-900 font-black'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-bold'
                    }`}
                  >
                    <span className="text-lg">✅</span>
                    <span className="text-xs leading-tight">HADIR</span>
                    <span className="text-[9px] text-slate-400 font-medium">Koreksi Jam</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetStatus('IZIN')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      targetStatus === 'IZIN'
                        ? 'bg-blue-50 border-2 border-blue-500 shadow-2xs text-blue-900 font-black'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-bold'
                    }`}
                  >
                    <span className="text-lg">📝</span>
                    <span className="text-xs leading-tight">IZIN</span>
                    <span className="text-[9px] text-slate-400 font-medium">Izin Resmi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetStatus('SAKIT')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      targetStatus === 'SAKIT'
                        ? 'bg-amber-50 border-2 border-amber-500 shadow-2xs text-amber-900 font-black'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-bold'
                    }`}
                  >
                    <span className="text-lg">🏥</span>
                    <span className="text-xs leading-tight">SAKIT</span>
                    <span className="text-[9px] text-slate-400 font-medium">Surat Dokter</span>
                  </button>
                </div>
              </div>

              {/* 3. Jika HADIR: Pilih Sesi yang Dikoreksi */}
              {targetStatus === 'HADIR' && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-black text-slate-700 block">
                    Pilih Sesi Jam yang Ingin Dikoreksi:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCorrectionScope('MASUK')}
                      className={`p-2 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                        correctionScope === 'MASUK'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-extrabold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-bold'
                      }`}
                    >
                      <Sunrise className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Jam Masuk</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCorrectionScope('PULANG')}
                      className={`p-2 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                        correctionScope === 'PULANG'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-extrabold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-bold'
                      }`}
                    >
                      <Sunset className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Jam Pulang</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCorrectionScope('KEDUANYA')}
                      className={`p-2 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                        correctionScope === 'KEDUANYA'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-extrabold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-bold'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Keduanya</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──── LAYER / STEP 2: ATUR JAM & ALASAN PENGURUSAN ─────────────── */}
          {step === 2 && (
            <form id="correction-form" onSubmit={handleSubmit} className="space-y-3.5">
              {/* Summary of Step 1 Selection */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="min-w-0">
                  <p className="font-extrabold text-slate-900 flex items-center gap-1.5 truncate">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{date}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-emerald-700">{targetStatus}</span>
                    {targetStatus === 'HADIR' && (
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({correctionScope === 'MASUK' ? 'Masuk Saja' : correctionScope === 'PULANG' ? 'Pulang Saja' : 'Masuk & Pulang'})
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-black rounded-lg border border-slate-200 flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                >
                  <Edit3 className="w-3 h-3 text-slate-500" />
                  <span>Ubah</span>
                </button>
              </div>

              {/* Input Jam (Only if Status is HADIR) */}
              {targetStatus === 'HADIR' && (
                <div className="space-y-2.5">
                  {correctionScope === 'MASUK' && (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                      <label className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                        <Sunrise className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Jam Masuk Baru yang Diajukan: *</span>
                      </label>
                      <input
                        type="time"
                        required
                        value={checkInTime}
                        onChange={(e) => setCheckInTime(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <p className="text-[10px] text-emerald-800 font-medium">
                        ℹ️ Batas toleransi masuk: <strong>{checkinEnd} WIB</strong>. Jam Pulang Anda tidak diubah.
                      </p>
                    </div>
                  )}

                  {correctionScope === 'PULANG' && (
                    <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5">
                      <label className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                        <Sunset className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Jam Pulang Baru yang Diajukan: *</span>
                      </label>
                      <input
                        type="time"
                        required
                        value={checkOutTime}
                        onChange={(e) => setCheckOutTime(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-white border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-[10px] text-indigo-800 font-medium">
                        ℹ️ Pengajuan ini hanya mengoreksi Jam Pulang. Jam Masuk Anda tetap terjaga.
                      </p>
                    </div>
                  )}

                  {correctionScope === 'KEDUANYA' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                        <label className="text-[11px] font-black text-emerald-950 flex items-center gap-1">
                          <Sunrise className="w-3 h-3 text-emerald-600" />
                          <span>Jam Masuk Baru: *</span>
                        </label>
                        <input
                          type="time"
                          required
                          value={checkInTime}
                          onChange={(e) => setCheckInTime(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs font-bold bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1">
                        <label className="text-[11px] font-black text-indigo-950 flex items-center gap-1">
                          <Sunset className="w-3 h-3 text-indigo-600" />
                          <span>Jam Pulang Baru: *</span>
                        </label>
                        <input
                          type="time"
                          required
                          value={checkOutTime}
                          onChange={(e) => setCheckOutTime(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs font-bold bg-white border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Non-HADIR Info Badge */}
              {targetStatus !== 'HADIR' && (
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Pengajuan status <strong>{targetStatus}</strong> akan tercatat untuk 1 hari penuh tanpa perlu mengisi jam masuk dan jam pulang fisik.
                  </span>
                </div>
              )}

              {/* Alasan Lengkap Koreksi + AI Polishing Button */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700">
                    Alasan Lengkap Koreksi: *
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!reason.trim()) return;
                      setIsAiPolishing(true);
                      try {
                        const res = await GroqAIService.analyzeLeaveReason(reason, 'KOREKSI_ABSEN');
                        setReason(res.polishedReason);
                        showToast('info', '✨ Kalimat Disempurnakan!', res.summary);
                      } catch {
                        // ignore error
                      } finally {
                        setIsAiPolishing(false);
                      }
                    }}
                    disabled={isAiPolishing || !reason.trim()}
                    className="text-[10px] text-emerald-700 hover:text-emerald-800 font-extrabold flex items-center gap-1 disabled:opacity-40 cursor-pointer bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 transition-all"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>{isAiPolishing ? 'Menyempurnakan...' : 'Sempurnakan AI'}</span>
                  </button>
                </div>

                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Jelaskan alasan mengapa perlu dilakukan koreksi (misal: kendala teknis kamera saat scan QR masuk, mendampingi upacara, dll)..."
                  rows={3}
                  required
                  className="w-full bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400">
                  Minimal 10 huruf. Alasan yang sopan dan jelas mempermudah persetujuan pimpinan.
                </p>
              </div>

              {/* Information Notice */}
              <div className="bg-amber-50/70 border border-amber-200 p-2 rounded-lg text-[10px] text-amber-900 leading-tight">
                💡 <strong>Info:</strong> Pengajuan akan masuk sebagai status <i>Pending</i> untuk diverifikasi oleh Admin / Kepala Sekolah.
              </div>
            </form>
          )}
        </div>

        {/* ── 3. STICKY FOOTER (Always visible at bottom, never covered) ─────── */}
        <div className="shrink-0 bg-slate-50 border-t border-slate-200/80 px-4 py-2.5 sm:py-3">
          {step === 1 ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 text-slate-600 hover:bg-slate-200/70 font-bold text-xs h-11 rounded-xl cursor-pointer"
                onClick={onClose}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs h-11 rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                onClick={handleNextToStep2}
              >
                <span>Lanjut: Atur Jam &amp; Alasan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={isLoading}
                className="flex-1 text-slate-600 hover:bg-slate-200/70 font-bold text-xs h-11 rounded-xl cursor-pointer flex items-center justify-center gap-1"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali</span>
              </Button>
              <Button
                form="correction-form"
                type="submit"
                isLoading={isLoading}
                variant="primary"
                className="flex-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs h-11 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5 border-none"
              >
                <span>Kirim Pengajuan Koreksi</span>
                <Send className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
