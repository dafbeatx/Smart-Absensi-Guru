import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  X,
  CheckCircle2,
  EyeOff,
  Eye,
  SlidersHorizontal,
  Save,
} from 'lucide-react';
import type { ExamPeriodSettings, ExamPeriodStatus } from '../../../types/exam-schedule.types';
import { ExamPeriodRepository } from '../../../repositories/ExamPeriodRepository';
import { ExamScheduleRepository } from '../../../repositories/ExamScheduleRepository';
import { AdministrationRepository } from '../../../repositories/AdministrationRepository';
import { formatTimeForInput } from '../../../utils/time.utils';

interface ExamPeriodSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  academicYear?: string;
  onSettingsSaved?: (newSettings: ExamPeriodSettings, newStatus: ExamPeriodStatus) => void;
}

export const ExamPeriodSettingsModal: React.FC<ExamPeriodSettingsModalProps> = ({
  isOpen,
  onClose,
  academicYear,
  onSettingsSaved,
}) => {
  const activeYear = useMemo(
    () => academicYear || AdministrationRepository.getActiveAcademicYear(),
    [academicYear]
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form states
  const [isEnabled, setIsEnabled] = useState(true);
  const [autoDeactivateEnabled, setAutoDeactivateEnabled] = useState(true);
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('17:00');
  const [examTitle, setExamTitle] = useState('Asesmen Sekolah (ASTS/ASAS)');
  const [hideCommitteeBanner, setHideCommitteeBanner] = useState(true);
  const [hideExamDutiesCard, setHideExamDutiesCard] = useState(true);
  const [hideAdministrationModules, setHideAdministrationModules] = useState(true);

  // Schedule detected info
  const [detectedScheduleEndDate, setDetectedScheduleEndDate] = useState<string | null>(null);

  // Load existing settings
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const [settings, smpSched, smaSched] = await Promise.all([
          ExamPeriodRepository.getPeriodSettings(activeYear),
          ExamScheduleRepository.getSchedule(activeYear, 'ASTS', 'SMP')
            .then(async (s) => s || await ExamScheduleRepository.getSchedule(activeYear, 'ASAS', 'SMP')),
          ExamScheduleRepository.getSchedule(activeYear, 'ASTS', 'SMA')
            .then(async (s) => s || await ExamScheduleRepository.getSchedule(activeYear, 'ASAS', 'SMA')),
        ]);

        if (!isMounted) return;

        setIsEnabled(settings.isEnabled);
        setAutoDeactivateEnabled(settings.autoDeactivateEnabled);
        setEndDate(settings.endDate || '');
        setEndTime(formatTimeForInput(settings.endTime || '17:00'));
        setExamTitle(settings.examTitle || 'Asesmen Sekolah (ASTS/ASAS)');
        setHideCommitteeBanner(settings.hideCommitteeBanner !== false);
        setHideExamDutiesCard(settings.hideExamDutiesCard !== false);
        setHideAdministrationModules(settings.hideAdministrationModules !== false);

        const activeSched = smpSched || smaSched;
        if (activeSched?.config?.endDate) {
          setDetectedScheduleEndDate(activeSched.config.endDate);
          if (!settings.endDate) {
            setEndDate(activeSched.config.endDate);
          }
        }
      } catch (err) {
        console.warn('Failed to load exam period settings:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeYear]);

  // Live preview status
  const currentPreviewStatus: ExamPeriodStatus = useMemo(() => {
    const previewSettings: ExamPeriodSettings = {
      isEnabled,
      autoDeactivateEnabled,
      endDate,
      endTime,
      examTitle,
      academicYear: activeYear,
      hideCommitteeBanner,
      hideExamDutiesCard,
      hideAdministrationModules,
      updatedAt: new Date().toISOString(),
    };
    return ExamPeriodRepository.computePeriodStatus(previewSettings, new Date());
  }, [
    isEnabled,
    autoDeactivateEnabled,
    endDate,
    endTime,
    examTitle,
    activeYear,
    hideCommitteeBanner,
    hideExamDutiesCard,
    hideAdministrationModules,
  ]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: ExamPeriodSettings = {
        isEnabled,
        autoDeactivateEnabled,
        endDate,
        endTime: formatTimeForInput(endTime || '17:00'),
        examTitle: examTitle.trim() || 'Asesmen Sekolah (ASTS/ASAS)',
        academicYear: activeYear,
        hideCommitteeBanner,
        hideExamDutiesCard,
        hideAdministrationModules,
        updatedAt: new Date().toISOString(),
      };

      const ok = await ExamPeriodRepository.savePeriodSettings(payload);
      if (ok) {
        const computedStatus = ExamPeriodRepository.computePeriodStatus(payload, new Date());
        setSuccessToast('Pengaturan periode ujian & kepanitiaan berhasil disimpan! ✨');
        if (onSettingsSaved) {
          onSettingsSaved(payload, computedStatus);
        }
        setTimeout(() => {
          setSuccessToast(null);
          onClose();
        }, 800);
      }
    } catch (err) {
      console.error('Failed to save period settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkAsEndedImmediately = async () => {
    setIsEnabled(false);
    setIsSaving(true);
    try {
      const payload: ExamPeriodSettings = {
        isEnabled: false,
        autoDeactivateEnabled,
        endDate: endDate || new Date().toISOString().slice(0, 10),
        endTime: formatTimeForInput(endTime || '17:00'),
        examTitle: examTitle.trim() || 'Asesmen Sekolah (ASTS/ASAS)',
        academicYear: activeYear,
        hideCommitteeBanner,
        hideExamDutiesCard,
        hideAdministrationModules,
        updatedAt: new Date().toISOString(),
      };

      await ExamPeriodRepository.savePeriodSettings(payload);
      const computedStatus = ExamPeriodRepository.computePeriodStatus(payload, new Date());
      setSuccessToast('Ujian resmi ditandai selesai! Bagian ujian & kepanitiaan disembunyikan. 🔒');
      if (onSettingsSaved) {
        onSettingsSaved(payload, computedStatus);
      }
      setTimeout(() => {
        setSuccessToast(null);
        onClose();
      }, 900);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-period-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp">
        {/* ── MODAL HEADER ── */}
        <div className="p-4 sm:p-5 bg-linear-to-r from-[#023246] to-[#18536B] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-2xs">
              <SlidersHorizontal className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-200">
                  Kontrol Periode Ujian
                </span>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-md bg-white/10 text-cyan-100">
                  T.A. {activeYear}
                </span>
              </div>
              <h2 id="exam-period-title" className="text-base sm:text-lg font-black text-white truncate leading-tight mt-0.5">
                Masa Ujian &amp; Kepanitiaan
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-cyan-100 hover:text-white transition-all cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── MODAL BODY ── */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 sm:space-y-5 text-slate-800">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-[#023246] animate-spin" />
              <p className="text-xs font-semibold">Memuat data periode ujian...</p>
            </div>
          ) : (
            <>
              {/* Toast Feedback */}
              {successToast && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successToast}</span>
                </div>
              )}

              {/* ── STATUS HERO CARD ── */}
              <div
                className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                  currentPreviewStatus.isActive
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : currentPreviewStatus.isExpiredByTime
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : 'bg-slate-100/80 border-slate-300/80 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {currentPreviewStatus.isActive ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    )}
                    <span className="text-xs font-black tracking-wide uppercase">
                      Status Saat Ini:
                    </span>
                  </div>

                  {currentPreviewStatus.isActive ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10.5px] font-extrabold shadow-2xs flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      Masa Ujian Aktif (Ditampilkan)
                    </span>
                  ) : currentPreviewStatus.isExpiredByTime ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-[10.5px] font-extrabold shadow-2xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Ujian Telah Usai (Waktu Berakhir)
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-600 text-white text-[10.5px] font-extrabold shadow-2xs flex items-center gap-1">
                      <EyeOff className="w-3 h-3" />
                      Nonaktif Manual (Disembunyikan)
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed font-medium">
                  {currentPreviewStatus.isActive ? (
                    <>
                      Bagian administrasi ujian dan kepanitiaan <strong>sedang aktif muncul</strong> di portal guru.
                      {currentPreviewStatus.expiryFormatted ? (
                        <span className="block mt-0.5 text-emerald-800 font-semibold">
                          ⏳ Akan otomatis ditutup pada: <strong>{currentPreviewStatus.expiryFormatted}</strong>.
                        </span>
                      ) : null}
                    </>
                  ) : currentPreviewStatus.isExpiredByTime ? (
                    <>
                      Waktu pelaksanaan ujian telah melewati batas tanggal/jam. Bagian ujian dan kepanitiaan <strong>otomatis disembunyikan</strong> dari beranda guru agar tidak menumpuk.
                    </>
                  ) : (
                    <>
                      Masa ujian <strong>dinonaktifkan secara manual</strong>. Banner kepanitiaan dan kartu tugas mengawas tidak akan muncul kembali di beranda guru.
                    </>
                  )}
                </p>
              </div>

              {/* ── SECTION 1: MASTER TOGGLE ON-OFF ── */}
              <div className="bg-slate-50/80 rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <label htmlFor="master-exam-toggle" className="text-xs sm:text-sm font-black text-slate-900 cursor-pointer block">
                      Tampilkan Bagian Ujian &amp; Kepanitiaan
                    </label>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Saklar manual utama. Matikan opsi ini jika masa ujian telah usai sepenuhnya agar tidak muncul kembali.
                    </p>
                  </div>

                  {/* Switch component */}
                  <button
                    type="button"
                    id="master-exam-toggle"
                    role="switch"
                    aria-checked={isEnabled}
                    onClick={() => setIsEnabled((prev) => !prev)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#023246] ${
                      isEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* ── SECTION 2: OTOMATIS BERAKHIR SESUAI WAKTU ── */}
              <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#023246]" />
                      <label htmlFor="auto-deactivate-toggle" className="text-xs sm:text-sm font-black text-slate-900 cursor-pointer">
                        Otomatis Usai Berdasarkan Waktu
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Sistem otomatis tidak akan memunculkan bagian ujian kembali jika waktu pelaksanaan telah selesai.
                    </p>
                  </div>

                  {/* Switch */}
                  <button
                    type="button"
                    id="auto-deactivate-toggle"
                    role="switch"
                    aria-checked={autoDeactivateEnabled}
                    onClick={() => setAutoDeactivateEnabled((prev) => !prev)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#023246] ${
                      autoDeactivateEnabled ? 'bg-[#023246]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        autoDeactivateEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Sub-inputs when auto-expire is enabled */}
                {autoDeactivateEnabled && (
                  <div className="pt-2 border-t border-slate-100 space-y-3 animate-fadeIn">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Tanggal Selesai */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>Tanggal Selesai Ujian</span>
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                      </div>

                      {/* Jam Selesai */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>Jam Batas Selesai (WIB)</span>
                        </label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(formatTimeForInput(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                      </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] font-bold text-slate-400">Pintasan:</span>
                      {detectedScheduleEndDate && (
                        <button
                          type="button"
                          onClick={() => {
                            setEndDate(detectedScheduleEndDate);
                            setEndTime('17:00');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-900 text-[10px] font-extrabold border border-cyan-200/80 transition-all cursor-pointer"
                        >
                          📅 Ikuti Jadwal Resmi ({detectedScheduleEndDate})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date().toISOString().slice(0, 10);
                          setEndDate(today);
                          setEndTime('17:00');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold border border-slate-200 transition-all cursor-pointer"
                      >
                        Hari Ini 17:00
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const tmr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
                          setEndDate(tmr);
                          setEndTime('17:00');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold border border-slate-200 transition-all cursor-pointer"
                      >
                        Besok 17:00
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── SECTION 3: ELEMEN YANG DISEMBUNYIKAN ── */}
              <div className="bg-slate-50/60 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 space-y-2">
                <span className="text-[11px] font-extrabold text-slate-700 block">
                  Elemen Yang Disembunyikan Saat Ujian Usai:
                </span>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideCommitteeBanner}
                      onChange={(e) => setHideCommitteeBanner(e.target.checked)}
                      className="w-4 h-4 rounded text-[#023246] border-slate-300 focus:ring-[#023246]"
                    />
                    <span>Banner SK Kepanitiaan Ujian &amp; Badge di Beranda Guru</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideExamDutiesCard}
                      onChange={(e) => setHideExamDutiesCard(e.target.checked)}
                      className="w-4 h-4 rounded text-[#023246] border-slate-300 focus:ring-[#023246]"
                    />
                    <span>Kartu Tugas Jadwal Mengawas Asesmen Sekolah</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideAdministrationModules}
                      onChange={(e) => setHideAdministrationModules(e.target.checked)}
                      className="w-4 h-4 rounded text-[#023246] border-slate-300 focus:ring-[#023246]"
                    />
                    <span>Kategori Modul Ujian di Pusat Administrasi &amp; KBM</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div>
            {isEnabled && (
              <button
                type="button"
                onClick={handleMarkAsEndedImmediately}
                disabled={isSaving}
                className="w-full sm:w-auto h-11 px-3.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                title="Tandai ujian selesai seketika dan sembunyikan semua kartu tugas ujian"
              >
                <EyeOff className="w-4 h-4 text-rose-600" />
                <span>Tandai Ujian Usai Sekarang</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-11 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer active:scale-95 flex-1 sm:flex-none justify-center"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="h-11 px-5 rounded-xl bg-[#023246] hover:bg-[#03445e] text-white text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 flex-1 sm:flex-none disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-cyan-300" />
                  <span>Simpan Pengaturan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
