import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ArrowLeftRight,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  History,
  Check,
  Edit3,
} from 'lucide-react';
import type { ExamScheduleData } from '../../../types/exam-schedule.types';
import { ExamSchedulerService } from '../../../services/exam-scheduler.service';
import { ExamScheduleRepository } from '../../../repositories/ExamScheduleRepository';

const OFFICIAL_SCHOOL_SUBJECTS = [
  'PAI',
  'PKn',
  'Bahasa Indonesia',
  'Matematika',
  'IPA',
  'IPS',
  'Bahasa Inggris',
  'Informatika',
  'Seni Budaya',
  'PJOK',
  'Hadits',
  'BTQ',
  'Bahasa Arab',
  'Ekonomi',
  'Akuntansi',
  'Fisika',
  'Kimia',
  'Biologi',
];

interface SessionSlotGroup {
  key: string; // "2026-09-28_S1"
  date: string;
  dayName: string;
  sessionNumber: number;
  startTime: string;
  endTime: string;
  subject: string;
  classes: string[];
  rooms: string[];
}

interface ExamSubjectSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleData: ExamScheduleData;
  currentAdminName: string;
  initialSelectedSlot?: { date: string; sessionNumber: number };
  onSuccess: (updatedSchedule: ExamScheduleData) => void;
}

export const ExamSubjectSwapModal: React.FC<ExamSubjectSwapModalProps> = ({
  isOpen,
  onClose,
  scheduleData,
  currentAdminName,
  initialSelectedSlot,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'SWAP' | 'REPLACE' | 'HISTORY'>('SWAP');

  // Extract unique session slots from subjectSchedules
  const sessionSlots: SessionSlotGroup[] = useMemo(() => {
    if (!scheduleData?.subjectSchedules) return [];

    const slotMap = new Map<string, SessionSlotGroup>();

    scheduleData.subjectSchedules.forEach((item) => {
      const key = `${item.date}_S${item.sessionNumber}`;
      let entry = slotMap.get(key);
      if (!entry) {
        entry = {
          key,
          date: item.date,
          dayName: item.dayName,
          sessionNumber: item.sessionNumber,
          startTime: item.startTime,
          endTime: item.endTime,
          subject: item.subject,
          classes: [],
          rooms: [],
        };
        slotMap.set(key, entry);
      }
      if (!entry.classes.includes(item.className)) {
        entry.classes.push(item.className);
      }
      if (item.roomName && !entry.rooms.includes(item.roomName)) {
        entry.rooms.push(item.roomName);
      }
    });

    return Array.from(slotMap.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.sessionNumber - b.sessionNumber;
    });
  }, [scheduleData]);

  // Tab 1 (SWAP) State
  const [slotAKey, setSlotAKey] = useState<string>('');
  const [slotBKey, setSlotBKey] = useState<string>('');

  // Tab 2 (REPLACE) State
  const [targetSlotKey, setTargetSlotKey] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [customSubjectInput, setCustomSubjectInput] = useState<string>('');

  // Status & Feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync initial slot when opened
  useEffect(() => {
    if (sessionSlots.length > 0) {
      if (initialSelectedSlot) {
        const matchingKey = `${initialSelectedSlot.date}_S${initialSelectedSlot.sessionNumber}`;
        const found = sessionSlots.find((s) => s.key === matchingKey);
        if (found) {
          setSlotAKey(found.key);
          setTargetSlotKey(found.key);
          const other = sessionSlots.find((s) => s.key !== found.key);
          if (other) setSlotBKey(other.key);
          return;
        }
      }

      if (!slotAKey && sessionSlots[0]) {
        setSlotAKey(sessionSlots[0].key);
        setTargetSlotKey(sessionSlots[0].key);
      }
      if (!slotBKey && sessionSlots.length > 1) {
        setSlotBKey(sessionSlots[1].key);
      }
    }
  }, [sessionSlots, initialSelectedSlot]);

  const slotA = useMemo(() => sessionSlots.find((s) => s.key === slotAKey), [sessionSlots, slotAKey]);
  const slotB = useMemo(() => sessionSlots.find((s) => s.key === slotBKey), [sessionSlots, slotBKey]);
  const targetSlot = useMemo(() => sessionSlots.find((s) => s.key === targetSlotKey), [sessionSlots, targetSlotKey]);

  // History list (filter subject swaps)
  const subjectHistory = useMemo(() => {
    const list = scheduleData.swapHistory || [];
    return list.filter((h) => (h.reason || '').toLowerCase().includes('mapel'));
  }, [scheduleData.swapHistory]);

  if (!isOpen) return null;

  // Handle Mutual Swap
  const handleExecuteSwap = async () => {
    if (!slotA || !slotB) {
      showToast('Pilih kedua sesi (Sesi A dan Sesi B) untuk melakukan pertukaran.', 'error');
      return;
    }

    if (slotA.key === slotB.key) {
      showToast('Sesi A dan Sesi B tidak boleh merupakan sesi yang sama.', 'error');
      return;
    }

    const result = ExamSchedulerService.swapSubjectsBetweenSessions(
      scheduleData,
      { date: slotA.date, sessionNumber: slotA.sessionNumber },
      { date: slotB.date, sessionNumber: slotB.sessionNumber },
      currentAdminName
    );

    if (!result.success || !result.updatedSchedule) {
      showToast(result.error || 'Gagal menukar mata pelajaran.', 'error');
      return;
    }

    // Persist to repository
    const level = (scheduleData.educationLevel || scheduleData.config?.educationLevel || 'SMP') as 'SMP' | 'SMA';
    await ExamScheduleRepository.saveSchedule(result.updatedSchedule, level);

    showToast(
      `Sukses menukar mapel! [${slotA.dayName} Sesi ${slotA.sessionNumber}: ${slotB.subject}] ⇄ [${slotB.dayName} Sesi ${slotB.sessionNumber}: ${slotA.subject}]`,
      'success'
    );
    onSuccess(result.updatedSchedule);
  };

  // Handle Single Replace
  const handleExecuteReplace = async () => {
    if (!targetSlot) {
      showToast('Pilih sesi ujian yang ingin diganti mata pelajarannya.', 'error');
      return;
    }

    const finalSubject = (customSubjectInput.trim() || selectedSubject).trim();
    if (!finalSubject) {
      showToast('Pilih mata pelajaran baru dari daftar atau ketikkan nama mapel kustom.', 'error');
      return;
    }

    if (finalSubject.toLowerCase() === targetSlot.subject.toLowerCase()) {
      showToast('Mata pelajaran yang dipilih sama dengan mata pelajaran saat ini.', 'info');
      return;
    }

    const result = ExamSchedulerService.replaceSubjectInSession(
      scheduleData,
      { date: targetSlot.date, sessionNumber: targetSlot.sessionNumber },
      finalSubject,
      undefined,
      currentAdminName
    );

    if (!result.success || !result.updatedSchedule) {
      showToast(result.error || 'Gagal mengganti mata pelajaran.', 'error');
      return;
    }

    // Persist to repository
    const level = (scheduleData.educationLevel || scheduleData.config?.educationLevel || 'SMP') as 'SMP' | 'SMA';
    await ExamScheduleRepository.saveSchedule(result.updatedSchedule, level);

    showToast(
      `Mata pelajaran Sesi ${targetSlot.sessionNumber} (${targetSlot.dayName}) berhasil diubah menjadi ${finalSubject}.`,
      'success'
    );
    setSelectedSubject('');
    setCustomSubjectInput('');
    onSuccess(result.updatedSchedule);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="subject-swap-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* HEADER BAR */}
        <div className="px-5 py-4 bg-linear-to-r from-slate-900 via-slate-800 to-teal-950 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-5 h-5 text-teal-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 id="subject-swap-title" className="text-sm sm:text-base font-black tracking-tight text-white truncate">
                  Pergantian &amp; Pertukaran Mata Pelajaran Ujian
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-400/30 shrink-0">
                  {scheduleData.educationLevel || 'SMP'}
                </span>
              </div>
              <p className="text-[11px] text-teal-200/80 truncate">
                Ubah atau tukar susunan mapel secara instan tanpa perlu melakukan prompt ulang ke AI
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Tutup (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TOAST ALERT */}
        {toastMessage && (
          <div
            className={`px-4 py-2.5 text-xs font-bold flex items-center justify-between gap-2 shrink-0 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-b border-emerald-200'
                : toastMessage.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-b border-rose-200'
                : 'bg-sky-50 text-sky-900 border-b border-sky-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
              {toastMessage.type === 'info' && <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />}
              <span>{toastMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* TAB BUTTONS */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('SWAP')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'SWAP'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Tukar Silang (2 Sesi)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('REPLACE')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'REPLACE'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Ganti Mapel (1 Sesi)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ml-auto ${
              activeTab === 'HISTORY'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Riwayat ({subjectHistory.length})</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 overflow-y-auto space-y-5 grow bg-slate-50/50 text-slate-800">
          {/* TAB 1: SWAP 2 SESSIONS */}
          {activeTab === 'SWAP' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SELECTOR SESI A */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 font-black text-xs border border-teal-200">
                      Sesi Asal (Sesi A)
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">Pilih jadwal mapel 1</span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Pilih Sesi Ujian A</label>
                    <select
                      value={slotAKey}
                      onChange={(e) => setSlotAKey(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    >
                      {sessionSlots.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.dayName}, {s.date} (Sesi {s.sessionNumber}) • {s.subject}
                        </option>
                      ))}
                    </select>
                  </div>

                  {slotA && (
                    <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-teal-950">{slotA.subject}</span>
                        <span className="text-[10px] font-mono text-teal-700 bg-white px-2 py-0.5 rounded border border-teal-200">
                          {slotA.startTime} - {slotA.endTime} WIB
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-teal-600" />
                        <span>{slotA.dayName}, {slotA.date}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <Layers className="w-3.5 h-3.5 text-teal-600" />
                        <span>Mencakup {slotA.classes.length} Rombel: {slotA.classes.join(', ')}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* SELECTOR SESI B */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 font-black text-xs border border-blue-200">
                      Sesi Tujuan (Sesi B)
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">Pilih jadwal mapel 2</span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Pilih Sesi Ujian B</label>
                    <select
                      value={slotBKey}
                      onChange={(e) => setSlotBKey(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    >
                      {sessionSlots.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.dayName}, {s.date} (Sesi {s.sessionNumber}) • {s.subject}
                        </option>
                      ))}
                    </select>
                  </div>

                  {slotB && (
                    <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-blue-950">{slotB.subject}</span>
                        <span className="text-[10px] font-mono text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                          {slotB.startTime} - {slotB.endTime} WIB
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>{slotB.dayName}, {slotB.date}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        <span>Mencakup {slotB.classes.length} Rombel: {slotB.classes.join(', ')}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* VISUAL IMPACT PREVIEW */}
              {slotA && slotB && (
                <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Pratinjau Hasil Pertukaran:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                      <p className="text-[11px] text-slate-500">
                        {slotA.dayName}, {slotA.date} (Sesi {slotA.sessionNumber}):
                      </p>
                      <p className="font-bold flex items-center gap-1.5">
                        <span className="line-through text-slate-400">{slotA.subject}</span>
                        <span>➔</span>
                        <span className="text-emerald-700 font-black">{slotB.subject}</span>
                      </p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                      <p className="text-[11px] text-slate-500">
                        {slotB.dayName}, {slotB.date} (Sesi {slotB.sessionNumber}):
                      </p>
                      <p className="font-bold flex items-center gap-1.5">
                        <span className="line-through text-slate-400">{slotB.subject}</span>
                        <span>➔</span>
                        <span className="text-emerald-700 font-black">{slotA.subject}</span>
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    ℹ️ Roster pengawas guru pada kedua sesi ini akan otomatis memperbarui label mapelnya tanpa mengubah guru yang bertugas.
                  </p>
                </div>
              )}

              {/* ACTION BUTTON */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSwap}
                  disabled={!slotA || !slotB || slotA.key === slotB.key}
                  className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 active:scale-98 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Tukar Mapel Sesi A &amp; Sesi B</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: REPLACE SINGLE SESSION SUBJECT */}
          {activeTab === 'REPLACE' && (
            <div className="space-y-5">
              {/* TARGET SESSION SELECTOR */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 font-black text-xs border border-teal-200">
                    Sesi Ujian Target
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Pilih sesi yang ingin diganti mapelnya</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Pilih Sesi Ujian</label>
                  <select
                    value={targetSlotKey}
                    onChange={(e) => setTargetSlotKey(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  >
                    {sessionSlots.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.dayName}, {s.date} (Sesi {s.sessionNumber}) • Mapel Saat Ini: {s.subject}
                      </option>
                    ))}
                  </select>
                </div>

                {targetSlot && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Mapel Aktif Saat Ini:</span>
                      <span className="font-black text-slate-900 text-sm">{targetSlot.subject}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 block">Waktu &amp; Sesi:</span>
                      <span className="font-bold text-slate-700">{targetSlot.dayName} • Sesi {targetSlot.sessionNumber}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* QUICK SUBJECT SELECTOR (12+ OFFICIAL SUBJECTS) */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-teal-600" />
                    <span>Pilih Mata Pelajaran Baru (1-Klik)</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Mapel Kurikulum Sekolah</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {OFFICIAL_SCHOOL_SUBJECTS.map((sub) => {
                    const isSelected = selectedSubject.toLowerCase() === sub.toLowerCase();
                    const isCurrent = targetSlot?.subject.toLowerCase() === sub.toLowerCase();
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setSelectedSubject(sub);
                          setCustomSubjectInput('');
                        }}
                        className={`p-2.5 rounded-xl text-xs font-bold text-left transition-all border flex items-center justify-between gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                            : isCurrent
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-teal-300'
                        }`}
                      >
                        <span className="truncate">{sub}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                        {isCurrent && <span className="text-[9px] font-normal text-slate-400 shrink-0">(aktif)</span>}
                      </button>
                    );
                  })}
                </div>

                {/* CUSTOM SUBJECT INPUT */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Atau Ketik Nama Mapel Kustom / Muatan Lokal:
                  </label>
                  <input
                    type="text"
                    value={customSubjectInput}
                    onChange={(e) => {
                      setCustomSubjectInput(e.target.value);
                      if (e.target.value.trim()) setSelectedSubject('');
                    }}
                    placeholder="Contoh: Bahasa Sunda, Fiqih, Tahfidz, Ke-NU-an..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 font-sans"
                  />
                </div>
              </div>

              {/* ACTION BUTTON */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteReplace}
                  disabled={!targetSlot || (!selectedSubject && !customSubjectInput.trim())}
                  className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 active:scale-98 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Perubahan Mapel</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT HISTORY */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-black text-slate-800">Riwayat Perubahan &amp; Pertukaran Mata Pelajaran</span>
                <span className="text-[11px] text-slate-500">{subjectHistory.length} Perubahan Tercatat</span>
              </div>

              {subjectHistory.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-1.5">
                  <BookOpen className="w-6 h-6 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">Belum Ada Riwayat Pergantian Mapel</p>
                  <p className="text-[11px] text-slate-400">
                    Setiap kali Anda menukar atau mengganti mata pelajaran ujian, catatan audit lengkap akan tersimpan di sini.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {subjectHistory.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-teal-50 text-teal-800 border border-teal-200">
                          {item.type === 'SWAP_SUBJECTS' || item.type === 'SWAP_SLOTS' ? 'TUKAR MAPEL' : 'GANTI MAPEL'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.swappedAt).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 leading-snug">{item.reason}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                        <span>Oleh: <strong>{item.adminName}</strong></span>
                        <span>Kelas: {item.slotA?.className}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
