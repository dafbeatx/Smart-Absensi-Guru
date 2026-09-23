import React, { useState, useMemo } from 'react';
import {
  X,
  ArrowLeftRight,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  History,
  Info,
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
  allTeachers: UserProfile[];
  currentAdminName: string;
  initialSelectedSlotId?: string;
  onSwapSuccess: (updatedSchedule: ExamScheduleData) => void;
}

export const ExamProctorSwapModal: React.FC<ExamProctorSwapModalProps> = ({
  isOpen,
  onClose,
  scheduleData,
  allTeachers,
  currentAdminName,
  initialSelectedSlotId,
  onSwapSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'SWAP' | 'REASSIGN' | 'HISTORY'>('SWAP');

  // State for Swap Tab
  const [slotAId, setSlotAId] = useState<string>(
    initialSelectedSlotId || scheduleData.proctorSchedules[0]?.id || ''
  );
  const [slotBId, setSlotBId] = useState<string>('');
  const [swapReason, setSwapReason] = useState<string>('');

  // State for Reassign Tab
  const [reassignSlotId, setReassignSlotId] = useState<string>(
    initialSelectedSlotId || scheduleData.proctorSchedules[0]?.id || ''
  );
  const [newTeacherId, setNewTeacherId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected slots data
  const slotA = useMemo(
    () => scheduleData.proctorSchedules.find((p) => p.id === slotAId),
    [scheduleData.proctorSchedules, slotAId]
  );
  const slotB = useMemo(
    () => scheduleData.proctorSchedules.find((p) => p.id === slotBId),
    [scheduleData.proctorSchedules, slotBId]
  );
  const reassignSlot = useMemo(
    () => scheduleData.proctorSchedules.find((p) => p.id === reassignSlotId),
    [scheduleData.proctorSchedules, reassignSlotId]
  );

  const selectedNewTeacher = useMemo(
    () => allTeachers.find((t) => t.id === newTeacherId),
    [allTeachers, newTeacherId]
  );

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

  // Conflict preview for SWAP
  const swapConflictWarning = useMemo(() => {
    if (!slotA || !slotB) return null;
    if (slotA.id === slotB.id) return 'Sesi asal dan sesi tujuan tidak boleh sama.';

    // Check Slot A proctor moving to Slot B time
    const confA = ExamSchedulerService.checkProctorConflict(
      scheduleData.proctorSchedules,
      slotA.mainProctorId,
      slotA.mainProctorName,
      slotB.date,
      slotB.sessionNumber,
      slotB.id
    );
    if (confA && confA.id !== slotA.id) {
      return `Konflik: ${slotA.mainProctorName} sudah dijadwalkan mengawas di ${confA.roomName} pada ${confA.dayName}, Sesi ${confA.sessionNumber}.`;
    }

    // Check Slot B proctor moving to Slot A time
    const confB = ExamSchedulerService.checkProctorConflict(
      scheduleData.proctorSchedules,
      slotB.mainProctorId,
      slotB.mainProctorName,
      slotA.date,
      slotA.sessionNumber,
      slotA.id
    );
    if (confB && confB.id !== slotB.id) {
      return `Konflik: ${slotB.mainProctorName} sudah dijadwalkan mengawas di ${confB.roomName} pada ${confB.dayName}, Sesi ${confB.sessionNumber}.`;
    }

    return null;
  }, [slotA, slotB, scheduleData.proctorSchedules]);

  // Conflict preview for REASSIGN
  const reassignConflictWarning = useMemo(() => {
    if (!reassignSlot || !selectedNewTeacher) return null;
    const conf = ExamSchedulerService.checkProctorConflict(
      scheduleData.proctorSchedules,
      selectedNewTeacher.id,
      selectedNewTeacher.full_name || '',
      reassignSlot.date,
      reassignSlot.sessionNumber,
      reassignSlot.id
    );
    if (conf) {
      return `Konflik: ${selectedNewTeacher.full_name} sudah dijadwalkan mengawas di ${conf.roomName} pada ${conf.dayName}, Sesi ${conf.sessionNumber}.`;
    }
    return null;
  }, [reassignSlot, selectedNewTeacher, scheduleData.proctorSchedules]);

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
      const result = ExamSchedulerService.reassignSingleProctor(
        scheduleData,
        reassignSlot.id,
        {
          userId: selectedNewTeacher.id,
          fullName: selectedNewTeacher.full_name || 'Guru Pengganti',
        },
        currentAdminName,
        reassignReason.trim() || undefined
      );

      if (!result.success || !result.updatedSchedule) {
        setErrorMessage(result.error || 'Gagal mengganti pengawas.');
        setIsSubmitting(false);
        return;
      }

      await ExamScheduleRepository.saveSchedule(
        result.updatedSchedule,
        result.updatedSchedule.educationLevel || scheduleData.config.educationLevel
      );

      onSwapSuccess(result.updatedSchedule);
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
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
              <span>Riwayat Perubahan ({scheduleData.swapHistory?.length || 0})</span>
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
                      className="w-full text-xs font-medium bg-white border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 cursor-pointer"
                    >
                      {scheduleData.proctorSchedules.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.dayName} (Sesi {p.sessionNumber}) • {p.roomName} - {p.mainProctorName} ({p.subject})
                        </option>
                      ))}
                    </select>
                  </div>

                  {slotA && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 text-xs">
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
                      className="w-full text-xs font-medium bg-white border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 cursor-pointer"
                    >
                      <option value="">-- Pilih Sesi Tujuan Bertukar --</option>
                      {scheduleData.proctorSchedules
                        .filter((p) => p.id !== slotAId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.dayName} (Sesi {p.sessionNumber}) • {p.roomName} - {p.mainProctorName} ({p.subject})
                          </option>
                        ))}
                    </select>
                  </div>

                  {slotB ? (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 text-xs">
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
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              {/* Action Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleExecuteSwap}
                  disabled={!slotA || !slotB || Boolean(swapConflictWarning) || isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white text-xs font-bold transition-all shadow-xs disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
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
                      className="w-full text-xs font-medium bg-white border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 cursor-pointer"
                    >
                      {scheduleData.proctorSchedules.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.dayName} (Sesi {p.sessionNumber}) • {p.roomName} - {p.mainProctorName} ({p.subject})
                        </option>
                      ))}
                    </select>
                  </div>

                  {reassignSlot && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 text-xs">
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
                      className="w-full text-xs font-medium bg-white border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 cursor-pointer"
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
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Action Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleExecuteReassign}
                  disabled={!reassignSlot || !selectedNewTeacher || Boolean(reassignConflictWarning) || isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white text-xs font-bold transition-all shadow-xs disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
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
              {!scheduleData.swapHistory || scheduleData.swapHistory.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <History className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">Belum Ada Riwayat Pergantian</p>
                  <p className="text-[11px] text-slate-400">
                    Seluruh aktivitas tukar atau ganti pengawas oleh admin akan tercatat secara otomatis di sini.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {scheduleData.swapHistory.map((item, idx) => (
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
