import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ArrowLeftRight,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  History,
  Info,
  Sparkles,
  Check,
} from 'lucide-react';
import type {
  ExamScheduleData,
} from '../../../types/exam-schedule.types';
import type { UserProfile } from '../../../types/database.types';
import { ExamSchedulerService } from '../../../services/exam-scheduler.service';
import { ExamScheduleRepository } from '../../../repositories/ExamScheduleRepository';

interface ExamProctorSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleData: ExamScheduleData;
  otherScheduleData?: ExamScheduleData | null;
  allTeachers: UserProfile[];
  currentAdminName: string;
  initialSelectedSlotId?: string;
  onSwapSuccess: (updatedSchedule: ExamScheduleData, updatedOtherSchedule?: ExamScheduleData) => void;
}

export const ExamProctorSwapModal: React.FC<ExamProctorSwapModalProps> = ({
  isOpen,
  onClose,
  scheduleData,
  otherScheduleData,
  allTeachers,
  currentAdminName,
  initialSelectedSlotId,
  onSwapSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'SWAP' | 'REASSIGN' | 'HISTORY'>('SWAP');

  // Complementary schedule (e.g. SMA if current is SMP, or vice versa)
  const [otherSchedule, setOtherSchedule] = useState<ExamScheduleData | null>(otherScheduleData || null);

  useEffect(() => {
    if (!isOpen) return;
    if (otherScheduleData) {
      setOtherSchedule(otherScheduleData);
      return;
    }
    const currentLevel = scheduleData.config.educationLevel || scheduleData.educationLevel || 'SMP';
    const complementaryLevel = currentLevel === 'SMP' ? 'SMA' : 'SMP';
    ExamScheduleRepository.getSchedule(
      scheduleData.config.academicYear,
      scheduleData.config.examType,
      complementaryLevel
    ).then((remoteOther) => {
      if (remoteOther) setOtherSchedule(remoteOther);
    }).catch(() => {});
  }, [isOpen, otherScheduleData, scheduleData]);

  const primaryLevel = scheduleData.config.educationLevel || scheduleData.educationLevel || 'SMP';
  const otherLevel = otherSchedule?.config.educationLevel || otherSchedule?.educationLevel || (primaryLevel === 'SMP' ? 'SMA' : 'SMP');

  // Combined proctors across SMP and SMA (including Ruang 6)
  const allCombinedProctors = useMemo(() => {
    const primaryItems = (scheduleData.proctorSchedules || []).map((p) => ({
      ...p,
      educationLevel: p.educationLevel || primaryLevel,
    }));
    const otherItems = (otherSchedule?.proctorSchedules || []).map((p) => ({
      ...p,
      educationLevel: p.educationLevel || otherLevel,
    }));
    return [...primaryItems, ...otherItems];
  }, [scheduleData.proctorSchedules, otherSchedule?.proctorSchedules, primaryLevel, otherLevel]);

  // State for Swap Tab
  const [slotAId, setSlotAId] = useState<string>(
    initialSelectedSlotId || scheduleData.proctorSchedules[0]?.id || ''
  );
  const [slotBId, setSlotBId] = useState<string>('');
  const [swapReason, setSwapReason] = useState<string>('');
  const [swapFilterDay, setSwapFilterDay] = useState<string>('ALL');

  // State for Reassign Tab
  const [reassignSlotId, setReassignSlotId] = useState<string>(
    initialSelectedSlotId || scheduleData.proctorSchedules[0]?.id || ''
  );
  const [newTeacherId, setNewTeacherId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Unique exam days for fast filter chips (across both SMP and SMA)
  const availableDays = useMemo(() => {
    const daysSet = new Set<string>();
    allCombinedProctors.forEach((p) => daysSet.add(p.dayName));
    return Array.from(daysSet);
  }, [allCombinedProctors]);

  // Selected slots data (searched across all combined proctors)
  const slotA = useMemo(
    () => allCombinedProctors.find((p) => p.id === slotAId),
    [allCombinedProctors, slotAId]
  );
  const slotB = useMemo(
    () => allCombinedProctors.find((p) => p.id === slotBId),
    [allCombinedProctors, slotBId]
  );
  const reassignSlot = useMemo(
    () => allCombinedProctors.find((p) => p.id === reassignSlotId),
    [allCombinedProctors, reassignSlotId]
  );

  const selectedNewTeacher = useMemo(
    () => allTeachers.find((t) => t.id === newTeacherId),
    [allTeachers, newTeacherId]
  );

  // 1-Click Smart Recommendations for Mutual Swap (includes SMA Ruang 6)
  const smartSwapSuggestions = useMemo(() => {
    if (!slotAId) return [];
    return ExamSchedulerService.getSmartSwapCandidates(
      scheduleData,
      slotAId,
      swapFilterDay,
      allTeachers,
      otherSchedule?.proctorSchedules || []
    );
  }, [scheduleData, slotAId, swapFilterDay, allTeachers, otherSchedule?.proctorSchedules]);

  // 1-Click Smart Recommendations for Reassignment (includes SMA Ruang 6)
  const smartReassignSuggestions = useMemo(() => {
    if (!reassignSlotId) return [];
    return ExamSchedulerService.getSmartReassignCandidates(
      scheduleData,
      reassignSlotId,
      allTeachers,
      otherSchedule?.proctorSchedules || []
    );
  }, [scheduleData, reassignSlotId, allTeachers, otherSchedule?.proctorSchedules]);

  // Combined swap history across SMP and SMA
  const combinedHistory = useMemo(() => {
    const list = [...(scheduleData.swapHistory || []), ...(otherSchedule?.swapHistory || [])];
    const unique = new Map<string, (typeof list)[0]>();
    list.forEach((item) => {
      if (item && item.id) unique.set(item.id, item);
    });
    return Array.from(unique.values()).sort(
      (a, b) => new Date(b.swappedAt).getTime() - new Date(a.swappedAt).getTime()
    );
  }, [scheduleData.swapHistory, otherSchedule?.swapHistory]);

  // Helper: check if a teacher teaches the subject in a slot
  const isTeacherOfSubject = (teacherName: string, subject: string): boolean => {
    if (!teacherName || !subject) return false;
    const normT = ExamSchedulerService.normalizeTeacherName(teacherName);
    const teacher = allTeachers.find(
      (t) => ExamSchedulerService.normalizeTeacherName(t.full_name || '') === normT
    );
    if (!teacher || !teacher.teaching_assignment) return false;
    const normSubj = subject.toLowerCase().trim();
    const rawAssignment = teacher.teaching_assignment;
    const teacherSubj = Array.isArray(rawAssignment)
      ? rawAssignment.join(' ').toLowerCase()
      : String(rawAssignment || '').toLowerCase().trim();
    return teacherSubj.includes(normSubj) || normSubj.includes(teacherSubj);
  };

  // Conflict preview for SWAP (validated across SMP + SMA)
  const swapConflictWarning = useMemo(() => {
    if (!slotA || !slotB) return null;
    if (slotA.id === slotB.id) return 'Sesi asal dan sesi tujuan tidak boleh sama.';

    // Check Slot A proctor moving to Slot B time across all combined proctors
    const confA = ExamSchedulerService.checkProctorConflict(
      allCombinedProctors,
      slotA.mainProctorId,
      slotA.mainProctorName,
      slotB.date,
      slotB.sessionNumber,
      slotB.id
    );
    if (confA && confA.id !== slotA.id) {
      const confLevel = confA.educationLevel || (confA.roomName.includes('6') ? 'SMA' : 'SMP');
      return `Konflik: ${slotA.mainProctorName} sudah dijadwalkan mengawas di [${confLevel}] ${confA.roomName} pada ${confA.dayName}, Sesi ${confA.sessionNumber}.`;
    }

    // Check Slot B proctor moving to Slot A time across all combined proctors
    const confB = ExamSchedulerService.checkProctorConflict(
      allCombinedProctors,
      slotB.mainProctorId,
      slotB.mainProctorName,
      slotA.date,
      slotA.sessionNumber,
      slotA.id
    );
    if (confB && confB.id !== slotB.id) {
      const confLevel = confB.educationLevel || (confB.roomName.includes('6') ? 'SMA' : 'SMP');
      return `Konflik: ${slotB.mainProctorName} sudah dijadwalkan mengawas di [${confLevel}] ${confB.roomName} pada ${confB.dayName}, Sesi ${confB.sessionNumber}.`;
    }

    return null;
  }, [slotA, slotB, allCombinedProctors]);

  // Conflict preview for REASSIGN (validated across SMP + SMA)
  const reassignConflictWarning = useMemo(() => {
    if (!reassignSlot || !selectedNewTeacher) return null;
    const conf = ExamSchedulerService.checkProctorConflict(
      allCombinedProctors,
      selectedNewTeacher.id,
      selectedNewTeacher.full_name || '',
      reassignSlot.date,
      reassignSlot.sessionNumber,
      reassignSlot.id
    );
    if (conf) {
      const confLevel = conf.educationLevel || (conf.roomName.includes('6') ? 'SMA' : 'SMP');
      return `Konflik: ${selectedNewTeacher.full_name} sudah dijadwalkan mengawas di [${confLevel}] ${conf.roomName} pada ${conf.dayName}, Sesi ${conf.sessionNumber}.`;
    }
    return null;
  }, [reassignSlot, selectedNewTeacher, allCombinedProctors]);

  // Handlers
  const handleExecuteSwap = async () => {
    if (!slotA || !slotB) {
      setErrorMessage('Silakan pilih kedua sesi yang ingin ditukar.');
      return;
    }
    if (swapConflictWarning) {
      setErrorMessage(swapConflictWarning);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      if (otherSchedule) {
        // Cross-level or dual-schedule swap
        const result = ExamSchedulerService.swapProctorsCrossLevel(
          scheduleData,
          otherSchedule,
          slotA.id,
          slotB.id,
          currentAdminName,
          swapReason.trim() || undefined
        );

        if (!result.success || !result.updatedScheduleA || !result.updatedScheduleB) {
          setErrorMessage(result.error || 'Gagal menukar jadwal pengawas.');
          setIsSubmitting(false);
          return;
        }

        await ExamScheduleRepository.saveSchedule(
          result.updatedScheduleA,
          result.updatedScheduleA.educationLevel || scheduleData.config.educationLevel || 'SMP'
        );
        await ExamScheduleRepository.saveSchedule(
          result.updatedScheduleB,
          result.updatedScheduleB.educationLevel || otherSchedule.config.educationLevel || 'SMA'
        );

        setOtherSchedule(result.updatedScheduleB);
        onSwapSuccess(result.updatedScheduleA, result.updatedScheduleB);
        onClose();
      } else {
        // Single schedule fallback
        const result = ExamSchedulerService.swapProctorsBetweenSlots(
          scheduleData,
          slotA.id,
          slotB.id,
          currentAdminName,
          swapReason.trim() || undefined
        );

        if (!result.success || !result.updatedSchedule) {
          setErrorMessage(result.error || 'Gagal menukar jadwal pengawas.');
          setIsSubmitting(false);
          return;
        }

        await ExamScheduleRepository.saveSchedule(
          result.updatedSchedule,
          result.updatedSchedule.educationLevel || scheduleData.config.educationLevel
        );

        onSwapSuccess(result.updatedSchedule);
        onClose();
      }
    } catch (err) {
      setErrorMessage('Terjadi kesalahan saat menyimpan jadwal yang ditukar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteReassign = async () => {
    if (!reassignSlot || !selectedNewTeacher) {
      setErrorMessage('Silakan pilih sesi dan guru pengganti.');
      return;
    }
    if (reassignConflictWarning) {
      setErrorMessage(reassignConflictWarning);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const isSlotInPrimary = scheduleData.proctorSchedules.some((p) => p.id === reassignSlot.id);
      const targetSchedule = isSlotInPrimary ? scheduleData : otherSchedule;

      if (!targetSchedule) {
        setErrorMessage('Jadwal untuk sesi ini tidak ditemukan.');
        setIsSubmitting(false);
        return;
      }

      const otherProctors = isSlotInPrimary
        ? (otherSchedule?.proctorSchedules || [])
        : scheduleData.proctorSchedules;

      const result = ExamSchedulerService.reassignSingleProctor(
        targetSchedule,
        reassignSlot.id,
        {
          userId: selectedNewTeacher.id,
          fullName: selectedNewTeacher.full_name || 'Guru Pengganti',
        },
        currentAdminName,
        reassignReason.trim() || undefined,
        otherProctors
      );

      if (!result.success || !result.updatedSchedule) {
        setErrorMessage(result.error || 'Gagal mengganti pengawas.');
        setIsSubmitting(false);
        return;
      }

      await ExamScheduleRepository.saveSchedule(
        result.updatedSchedule,
        result.updatedSchedule.educationLevel || targetSchedule.config.educationLevel
      );

      if (isSlotInPrimary) {
        onSwapSuccess(result.updatedSchedule, otherSchedule || undefined);
      } else {
        setOtherSchedule(result.updatedSchedule);
        onSwapSuccess(scheduleData, result.updatedSchedule);
      }
      onClose();
    } catch (err) {
      setErrorMessage('Terjadi kesalahan saat menyimpan penggantian pengawas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-xs">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">
                Pergantian Jadwal Mengawas
              </h3>
              <p className="text-xs text-slate-300">
                Jenjang {scheduleData.config.educationLevel || 'SMP'} • T.A. {scheduleData.config.academicYear} • Hak Wewenang Admin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 pt-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5 pb-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('SWAP');
                setErrorMessage(null);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'SWAP'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Tukar Silang (2 Sesi)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('REASSIGN');
                setErrorMessage(null);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'REASSIGN'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Ganti Pengawas (1 Sesi)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('HISTORY');
                setErrorMessage(null);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'HISTORY'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat Perubahan ({combinedHistory.length})</span>
            </button>
          </div>

          <div className="pb-2 hidden sm:block">
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
              <span>✓</span> Mengawas mapel sendiri diizinkan
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-semibold">{errorMessage}</div>
            </div>
          )}

          {/* TAB 1: TUKAR SILANG (2 SESI) */}
          {activeTab === 'SWAP' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Pilih dua sesi mengawas untuk saling bertukar posisi pengawas (misal: <strong>Pak A di hari Senin</strong> bertukar dengan <strong>Bu B di hari Selasa</strong>). Jumlah total jam mengawas kedua guru tetap seimbang.
                </p>
              </div>

              {/* Slot A & Slot B Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SLOT A */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 font-black text-xs uppercase tracking-wide">
                      Sesi Asal (Slot A)
                    </span>
                    {slotA && (
                      <span className="text-[11px] text-slate-500 font-mono">
                        {slotA.dayName}, {slotA.date}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pilih Jadwal Sesi A:
                    </label>
                    <select
                      value={slotAId}
                      onChange={(e) => setSlotAId(e.target.value)}
                      className="w-full text-xs font-medium bg-white border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer"
                    >
                      {allCombinedProctors.map((p) => {
                        const lvl = p.educationLevel || (p.roomName.includes('6') ? 'SMA' : 'SMP');
                        return (
                          <option key={p.id} value={p.id}>
                            [{lvl}] {p.dayName} (Sesi {p.sessionNumber}) • {p.roomName} - {p.mainProctorName} ({p.subject})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {slotA && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100">
                        <span className="text-slate-500">Jenjang:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          (slotA.educationLevel === 'SMA' || slotA.roomName.includes('6'))
                            ? 'bg-blue-100 text-blue-900 border border-blue-300'
                            : 'bg-teal-100 text-teal-900 border border-teal-300'
                        }`}>
                          {(slotA.educationLevel === 'SMA' || slotA.roomName.includes('6')) ? '🎓 SMA Terpadu As Salaam' : '🏫 SMP Terpadu Al-Ittihadiyah'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Pengawas Saat Ini:</span>
                        <strong className="text-slate-900 font-bold">{slotA.mainProctorName}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Ruangan & Kelas:</span>
                        <span className="font-semibold text-slate-700">{slotA.roomName} (Kelas {slotA.className})</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Waktu & Mapel:</span>
                        <span className="font-semibold text-slate-700">{slotA.subject} ({slotA.startTime}-{slotA.endTime})</span>
                      </div>
                      {slotB && isTeacherOfSubject(slotB.mainProctorName, slotA.subject) && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            ℹ️ {slotB.mainProctorName} adalah guru mapel ini (diizinkan)
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* SLOT B */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-teal-100 text-teal-900 font-black text-xs uppercase tracking-wide">
                      Sesi Tujuan (Slot B)
                    </span>
                    {slotB && (
                      <span className="text-[11px] text-slate-500 font-mono">
                        {slotB.dayName}, {slotB.date}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pilih Jadwal Sesi B:
                    </label>
                    <select
                      value={slotBId}
                      onChange={(e) => setSlotBId(e.target.value)}
                      className="w-full text-xs font-medium bg-white border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer"
                    >
                      <option value="">-- Pilih Sesi Tujuan Bertukar --</option>
                      {allCombinedProctors
                        .filter((p) => p.id !== slotAId)
                        .map((p) => {
                          const lvl = p.educationLevel || (p.roomName.includes('6') ? 'SMA' : 'SMP');
                          return (
                            <option key={p.id} value={p.id}>
                              [{lvl}] {p.dayName} (Sesi {p.sessionNumber}) • {p.roomName} - {p.mainProctorName} ({p.subject})
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  {slotB ? (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100">
                        <span className="text-slate-500">Jenjang:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          (slotB.educationLevel === 'SMA' || slotB.roomName.includes('6'))
                            ? 'bg-blue-100 text-blue-900 border border-blue-300'
                            : 'bg-teal-100 text-teal-900 border border-teal-300'
                        }`}>
                          {(slotB.educationLevel === 'SMA' || slotB.roomName.includes('6')) ? '🎓 SMA Terpadu As Salaam' : '🏫 SMP Terpadu Al-Ittihadiyah'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Pengawas Saat Ini:</span>
                        <strong className="text-slate-900 font-bold">{slotB.mainProctorName}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Ruangan & Kelas:</span>
                        <span className="font-semibold text-slate-700">{slotB.roomName} (Kelas {slotB.className})</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Waktu & Mapel:</span>
                        <span className="font-semibold text-slate-700">{slotB.subject} ({slotB.startTime}-{slotB.endTime})</span>
                      </div>
                      {slotA && isTeacherOfSubject(slotA.mainProctorName, slotB.subject) && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            ℹ️ {slotA.mainProctorName} adalah guru mapel ini (diizinkan)
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 bg-white/60 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs">
                      Silakan pilih Sesi B yang ingin ditukar dengan Sesi A
                    </div>
                  )}
                </div>
              </div>

              {/* SMART SWAP SUGGESTIONS (1-CLICK NO CLASH) */}
              <div className="p-3.5 sm:p-4 bg-linear-to-br from-amber-50/70 via-white to-slate-50 rounded-2xl border border-amber-300/80 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <span>Penyaranan Cerdas Bebas Bentrok (1-Klik)</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black">
                          {smartSwapSuggestions.length} Pilihan Aman
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Pilih langsung tanpa takut bentrok jadwal. Guru A dan Guru B sama-sama senggang di waktu pertukaran.
                      </p>
                    </div>
                  </div>

                  {/* Day Filter Chips */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSwapFilterDay('ALL')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        swapFilterDay === 'ALL'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Semua Hari
                    </button>
                    {availableDays.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSwapFilterDay(day)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          swapFilterDay.toLowerCase() === day.toLowerCase()
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Suggestions Grid */}
                {smartSwapSuggestions.length === 0 ? (
                  <div className="p-4 bg-white rounded-xl border border-dashed border-slate-300 text-center text-slate-500 text-xs">
                    Tidak ditemukan sesi yang bebas bentrok untuk filter hari ini. Silakan coba filter hari lain atau pilih manual melalui dropdown Sesi B di atas.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {smartSwapSuggestions.slice(0, 6).map((cand) => {
                      const isSelected = slotBId === cand.slot.id;
                      return (
                        <div
                          key={cand.slot.id}
                          className={`p-3 rounded-xl border transition-all text-xs flex flex-col justify-between gap-2 ${
                            isSelected
                              ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/40 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-2xs'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <span className="font-extrabold text-slate-900 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                {cand.slot.dayName}, {cand.slot.date}
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                                (cand.slot.educationLevel === 'SMA' || cand.slot.roomName.includes('6'))
                                  ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                  : 'bg-teal-50 text-teal-800 border border-teal-200'
                              }`}>
                                {(cand.slot.educationLevel === 'SMA' || cand.slot.roomName.includes('6')) ? '[SMA] ' : '[SMP] '}{cand.slot.roomName}
                              </span>
                            </div>

                            <div className="pt-0.5 flex items-center justify-between gap-1">
                              <span className="font-black text-slate-800 truncate text-[11px]">
                                {cand.slot.mainProctorName}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                Sesi {cand.slot.sessionNumber} ({cand.slot.startTime}-{cand.slot.endTime})
                              </span>
                            </div>

                            <p className="text-[10px] text-slate-500 truncate">
                              Mapel: <strong className="text-slate-700">{cand.slot.subject}</strong> (Kelas {cand.slot.className})
                            </p>

                            {cand.isOwnSubjectForA && (
                              <div className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
                                ℹ️ {slotA?.mainProctorName} pengampu mapel ini (diizinkan)
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSlotBId(cand.slot.id);
                              setErrorMessage(null);
                            }}
                            className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-amber-600 text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-amber-100 text-slate-800 hover:text-amber-950 border border-slate-200 hover:border-amber-300'
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-white" />
                                <span>Terpilih sebagai Sesi B</span>
                              </>
                            ) : (
                              <>
                                <ArrowLeftRight className="w-3.5 h-3.5 text-amber-700" />
                                <span>1-Klik Pilih Sesi Ini</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Preview Comparison Card */}
              {slotA && slotB && (
                <div className="p-4 bg-linear-to-r from-amber-50/80 via-white to-teal-50/80 rounded-2xl border border-amber-200/90 shadow-2xs space-y-3">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Pratinjau Pertukaran Posisi:</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Posisi Baru 1:</span>
                      <strong className="text-teal-900 font-extrabold block text-sm">{slotB.mainProctorName}</strong>
                      <span className="text-slate-600 text-[11px] block mt-0.5">
                        Mengawas di <strong>{slotA.dayName}, {slotA.date} (Sesi {slotA.sessionNumber})</strong> • {slotA.roomName} ({slotA.subject})
                      </span>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Posisi Baru 2:</span>
                      <strong className="text-blue-900 font-extrabold block text-sm">{slotA.mainProctorName}</strong>
                      <span className="text-slate-600 text-[11px] block mt-0.5">
                        Mengawas di <strong>{slotB.dayName}, {slotB.date} (Sesi {slotB.sessionNumber})</strong> • {slotB.roomName} ({slotB.subject})
                      </span>
                    </div>
                  </div>

                  {swapConflictWarning && (
                    <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                      <span>{swapConflictWarning}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Reason input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan / Catatan Pergantian (Opsional):
                </label>
                <input
                  type="text"
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  placeholder="Contoh: Pak Ahmad izin dinas luar hari Senin, bertukar ke Selasa dengan Bu Siti"
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              {/* Action Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleExecuteSwap}
                  disabled={!slotA || !slotB || Boolean(swapConflictWarning) || isSubmitting}
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 ${
                    !slotA || !slotB || Boolean(swapConflictWarning) || isSubmitting
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-amber-600 hover:bg-amber-700 cursor-pointer'
                  }`}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>{isSubmitting ? 'Memproses Pertukaran...' : 'Tukar Kedua Jadwal Ini'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: GANTI PENGAWAS (1 SESI) */}
          {activeTab === 'REASSIGN' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200 text-teal-900 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Ganti pengawas pada satu sesi tertentu dengan guru lain (misal pelimpahan tugas karena guru berhalangan hadir atau digantikan oleh guru piket).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pick Slot */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <span className="px-2.5 py-1 rounded-lg bg-teal-100 text-teal-900 font-black text-xs uppercase tracking-wide">
                    1. Pilih Sesi Ujian
                  </span>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Sesi yang ingin diubah:
                    </label>
                    <select
                      value={reassignSlotId}
                      onChange={(e) => setReassignSlotId(e.target.value)}
                      className="w-full text-xs font-medium bg-white border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer"
                    >
                      {allCombinedProctors.map((p) => {
                        const lvl = p.educationLevel || (p.roomName.includes('6') ? 'SMA' : 'SMP');
                        return (
                          <option key={p.id} value={p.id}>
                            [{lvl}] {p.dayName} (Sesi {p.sessionNumber}) • {p.roomName} - {p.mainProctorName} ({p.subject})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {reassignSlot && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100">
                        <span className="text-slate-500">Jenjang:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          (reassignSlot.educationLevel === 'SMA' || reassignSlot.roomName.includes('6'))
                            ? 'bg-blue-100 text-blue-900 border border-blue-300'
                            : 'bg-teal-100 text-teal-900 border border-teal-300'
                        }`}>
                          {(reassignSlot.educationLevel === 'SMA' || reassignSlot.roomName.includes('6')) ? '🎓 SMA Terpadu As Salaam' : '🏫 SMP Terpadu Al-Ittihadiyah'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Pengawas Semula:</span>
                        <strong className="text-slate-900 font-bold">{reassignSlot.mainProctorName}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Hari & Tanggal:</span>
                        <span className="font-semibold text-slate-700">{reassignSlot.dayName}, {reassignSlot.date}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Ruangan & Kelas:</span>
                        <span className="font-semibold text-slate-700">{reassignSlot.roomName} (Kelas {reassignSlot.className})</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Mata Pelajaran:</span>
                        <span className="font-semibold text-slate-700">{reassignSlot.subject}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pick New Teacher */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 font-black text-xs uppercase tracking-wide">
                    2. Pilih Guru Pengganti
                  </span>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Daftar Guru Pengganti:
                    </label>
                    <select
                      value={newTeacherId}
                      onChange={(e) => setNewTeacherId(e.target.value)}
                      className="w-full text-xs font-medium bg-white border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer"
                    >
                      <option value="">-- Pilih Guru Pengganti --</option>
                      {allTeachers
                        .filter((t) => t.id !== reassignSlot?.mainProctorId)
                        .map((t) => {
                          const isBusy = reassignSlot
                            ? ExamSchedulerService.checkProctorConflict(
                                scheduleData.proctorSchedules,
                                t.id,
                                t.full_name || '',
                                reassignSlot.date,
                                reassignSlot.sessionNumber,
                                reassignSlot.id
                              )
                            : false;

                          return (
                            <option key={t.id} value={t.id} disabled={Boolean(isBusy)}>
                              {t.full_name} {isBusy ? '⛔ (Ada jadwal lain di jam ini)' : '✓ (Tersedia)'}
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  {selectedNewTeacher && reassignSlot && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Guru Pengganti:</span>
                        <strong className="text-teal-900 font-bold">{selectedNewTeacher.full_name}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">NPP / NIP:</span>
                        <span className="font-mono text-slate-700">{selectedNewTeacher.nip || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Mata Pelajaran Diampu:</span>
                        <span className="font-semibold text-slate-700">
                          {Array.isArray(selectedNewTeacher.teaching_assignment)
                            ? selectedNewTeacher.teaching_assignment.join(', ')
                            : selectedNewTeacher.teaching_assignment || '-'}
                        </span>
                      </div>
                      {isTeacherOfSubject(selectedNewTeacher.full_name || '', reassignSlot.subject) && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            ℹ️ Guru pengampu mata pelajaran ini (diizinkan)
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* SMART REASSIGN SUGGESTIONS (LIGHTEST LOAD & AVAILABLE) */}
              <div className="p-3.5 sm:p-4 bg-linear-to-br from-teal-50/70 via-white to-slate-50 rounded-2xl border border-teal-300/80 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <span>Rekomendasi Guru Pengganti (Beban Paling Ringan)</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-900 border border-teal-300 text-[10px] font-black">
                        {smartReassignSuggestions.filter((c) => c.isAvailable).length} Guru Siap
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Sistem memprioritaskan guru yang sedang senggang di jam ini dan memiliki jumlah sesi mengawas paling sedikit.
                    </p>
                  </div>
                </div>

                {smartReassignSuggestions.filter((c) => c.isAvailable).length === 0 ? (
                  <div className="p-4 bg-white rounded-xl border border-dashed border-slate-300 text-center text-slate-500 text-xs">
                    Seluruh guru sedang bertugas mengawas pada jam & sesi ini.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {smartReassignSuggestions
                      .filter((c) => c.isAvailable)
                      .slice(0, 6)
                      .map((cand) => {
                        const isSelected = newTeacherId === cand.teacherId;
                        return (
                          <div
                            key={cand.teacherId}
                            className={`p-3 rounded-xl border transition-all text-xs flex flex-col justify-between gap-2 ${
                              isSelected
                                ? 'bg-teal-50/90 border-teal-500 ring-2 ring-teal-400/40 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-teal-300 hover:shadow-2xs'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-black text-slate-900 truncate text-[11px]">
                                  {cand.teacherName}
                                </span>
                                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-bold shrink-0">
                                  {cand.currentDutyCount} Sesi
                                </span>
                              </div>

                              <p className="text-[10px] text-slate-500 truncate">
                                Mapel: {cand.teachingSubject || '-'}
                              </p>

                              {cand.isOwnSubject && (
                                <div className="text-[9px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
                                  ℹ️ Pengampu mapel ini (diizinkan)
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setNewTeacherId(cand.teacherId);
                                setErrorMessage(null);
                              }}
                              className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-teal-700 text-white shadow-2xs'
                                  : 'bg-slate-100 hover:bg-teal-100 text-slate-800 hover:text-teal-950 border border-slate-200 hover:border-teal-300'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-white" />
                                  <span>Terpilih</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3.5 h-3.5 text-teal-700" />
                                  <span>1-Klik Tugaskan</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {reassignConflictWarning && (
                <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>{reassignConflictWarning}</span>
                </div>
              )}

              {/* Reason input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan / Catatan Penggantian (Opsional):
                </label>
                <input
                  type="text"
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="Contoh: Menggantikan guru piket / izin sakit"
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                />
              </div>

              {/* Action Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleExecuteReassign}
                  disabled={!reassignSlot || !selectedNewTeacher || Boolean(reassignConflictWarning) || isSubmitting}
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 ${
                    !reassignSlot || !selectedNewTeacher || Boolean(reassignConflictWarning) || isSubmitting
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-teal-700 hover:bg-teal-800 cursor-pointer'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Pergantian Pengawas'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: RIWAYAT PERUBAHAN */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-3 animate-fadeIn">
              {combinedHistory.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <History className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">Belum Ada Riwayat Pergantian</p>
                  <p className="text-[11px] text-slate-400">
                    Seluruh aktivitas tukar atau ganti pengawas oleh admin akan tercatat secara otomatis di sini.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {combinedHistory.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              item.type === 'SWAP_SLOTS'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-teal-100 text-teal-900 border border-teal-300'
                            }`}
                          >
                            {item.type === 'SWAP_SLOTS' ? 'Tukar Silang (2 Sesi)' : 'Ganti Pengawas'}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Oleh: <strong className="text-slate-800">{item.adminName}</strong>
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.swappedAt).toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 space-y-1 text-[11px]">
                        <div>
                          <span className="text-slate-500">Sesi 1:</span>{' '}
                          <strong className="text-slate-800">{item.slotA.dayName}, {item.slotA.date}</strong> (Sesi {item.slotA.sessionNumber}, {item.slotA.roomName}) •{' '}
                          <span className="text-rose-600 line-through mr-1">{item.slotA.previousProctorName}</span>
                          <span className="text-slate-400">➔</span>
                          <span className="text-emerald-700 font-bold ml-1">{item.slotA.newProctorName}</span>
                        </div>

                        {item.slotB && (
                          <div>
                            <span className="text-slate-500">Sesi 2:</span>{' '}
                            <strong className="text-slate-800">{item.slotB.dayName}, {item.slotB.date}</strong> (Sesi {item.slotB.sessionNumber}, {item.slotB.roomName}) •{' '}
                            <span className="text-rose-600 line-through mr-1">{item.slotB.previousProctorName}</span>
                            <span className="text-slate-400">➔</span>
                            <span className="text-emerald-700 font-bold ml-1">{item.slotB.newProctorName}</span>
                          </div>
                        )}

                        {item.reason && (
                          <div className="pt-1 text-[10px] text-slate-500 italic">
                            Catatan: "{item.reason}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 font-medium hidden sm:inline">
            💡 Perubahan akan langsung sinkron ke Kartu Pengawas di Beranda Guru.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition-colors cursor-pointer ml-auto"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
