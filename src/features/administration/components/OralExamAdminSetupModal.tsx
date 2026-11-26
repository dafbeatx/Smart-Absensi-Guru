/**
 * SMART ABSENSI GURU — PENGATURAN PENGUJI & PENEMPATAN UJIAN LISAN (KHUSUS ADMIN)
 * Memungkinkan Admin/Operator/Panitia menetapkan siapa yang menjadi penguji,
 * ruangan, kelas, mata uji (Bahasa / BTQ), dan daftar siswa per kelompok penguji.
 * Disinkronkan ke Cloud Supabase agar Guru tinggal siap pakai di HP masing-masing.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Languages,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { AdministrationRepository } from '../../../repositories/AdministrationRepository';
import { OralExamAssignmentRepository } from '../../../repositories/OralExamAssignmentRepository';
import { StudentRepository } from '../../../repositories/StudentRepository';
import { AuditLogger } from '../../../services/audit-logger.service';
import {
  getDefaultOralExamAssignments,
  hydrateOralExamAssignmentsWithTeachers,
} from '../../../data/oral-exam-groups';
import { areClassCodesEqual, normalizeClassCode } from '../../../utils/class.utils';
import type { StudentItem, UserProfile } from '../../../types/database.types';
import type {
  OralExamAssignment,
  OralExamBahasaScope,
  OralExamBtqScope,
  OralExamTrack,
} from '../../../types/oral-exam.types';

export interface OralExamAdminSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  academicYear?: string;
}

const AVAILABLE_CLASSES = ['7', '8A', '8B', '9A', '9B', 'SMA', '10', '11', '12'];

export const OralExamAdminSetupModal: React.FC<OralExamAdminSetupModalProps> = ({
  isOpen,
  onClose,
  academicYear: propAcademicYear,
}) => {
  const { user, token } = useAuthStore();
  const { showToast } = useToastStore();

  const activeAcademicYear = useMemo(
    () => propAcademicYear || AdministrationRepository.getActiveAcademicYear(),
    [propAcademicYear]
  );

  const [assignments, setAssignments] = useState<OralExamAssignment[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [masterStudents, setMasterStudents] = useState<StudentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [syncedWithStaffCount, setSyncedWithStaffCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Focused edit state
  const [editingGroup, setEditingGroup] = useState<OralExamAssignment | null>(null);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [useManualExaminerInput, setUseManualExaminerInput] = useState(false);
  const [manualStudentDraft, setManualStudentDraft] = useState('');
  const [showMasterPicker, setShowMasterPicker] = useState(false);
  const [selectedMasterIds, setSelectedMasterIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const loadAllData = useCallback(async (preserveEditing = false) => {
    if (!preserveEditing) setIsLoading(true);
    try {
      const [loadedAssignments, loadedStaff, loadedStudents] = await Promise.all([
        OralExamAssignmentRepository.getAssignments(activeAcademicYear),
        OralExamAssignmentRepository.getStaffDirectory(token || ''),
        StudentRepository.getStudents(token || '').catch(() => []),
      ]);
      const hydrated = hydrateOralExamAssignmentsWithTeachers(loadedAssignments, loadedStaff);
      const changedCount = hydrated.reduce((acc, item, idx) => {
        const orig = loadedAssignments[idx];
        if (
          !orig ||
          orig.examinerUserId !== item.examinerUserId ||
          orig.examinerName !== item.examinerName ||
          (orig.examinerNpp || null) !== (item.examinerNpp || null)
        ) {
          return acc + 1;
        }
        return acc;
      }, 0);

      setTeachers(loadedStaff);
      setMasterStudents(loadedStudents || []);
      if (!preserveEditing) {
        setAssignments(hydrated);
        setSyncedWithStaffCount(changedCount);
        setHasUnsavedChanges(changedCount > 0);
        setEditingGroup(null);
      } else {
        setAssignments((prev) => hydrateOralExamAssignmentsWithTeachers(prev, loadedStaff));
      }
    } finally {
      if (!preserveEditing) setIsLoading(false);
    }
  }, [activeAcademicYear, token]);

  useEffect(() => {
    if (!isOpen) return;
    loadAllData(false);
    const handleTeachersUpdated = () => {
      loadAllData(true);
    };
    window.addEventListener('smart_absensi_teachers_updated', handleTeachersUpdated);
    return () => {
      window.removeEventListener('smart_absensi_teachers_updated', handleTeachersUpdated);
    };
  }, [isOpen, loadAllData]);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearchQuery.trim().toLowerCase();
    const list = !q
      ? teachers
      : teachers.filter((t) => {
          const subject = Array.isArray(t.teaching_assignment)
            ? t.teaching_assignment.join(' ')
            : String(t.teaching_assignment || '');
          return (
            t.full_name.toLowerCase().includes(q) ||
            (t.nip && t.nip.toLowerCase().includes(q)) ||
            (t.position && t.position.toLowerCase().includes(q)) ||
            subject.toLowerCase().includes(q) ||
            t.role.toLowerCase().includes(q)
          );
        });
    if (editingGroup?.examinerUserId) {
      const selected = teachers.find((t) => t.id === editingGroup.examinerUserId);
      if (selected && !list.some((t) => t.id === selected.id)) {
        return [selected, ...list];
      }
    }
    return list;
  }, [teachers, teacherSearchQuery, editingGroup?.examinerUserId]);

  const selectedEditingTeacher = useMemo(
    () => (editingGroup?.examinerUserId ? teachers.find((t) => t.id === editingGroup.examinerUserId) || null : null),
    [teachers, editingGroup?.examinerUserId]
  );

  const filteredAssignments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter(
      (a) =>
        a.examinerName.toLowerCase().includes(q) ||
        a.roomNumber.toLowerCase().includes(q) ||
        a.className.toLowerCase().includes(q) ||
        a.students.some((s) => s.studentName.toLowerCase().includes(q))
    );
  }, [assignments, searchTerm]);

  const masterStudentsForEditingClass = useMemo(() => {
    if (!editingGroup) return [];
    const target = editingGroup.className;
    const normTarget = normalizeClassCode(target);
    return masterStudents.filter((st) => {
      if (areClassCodesEqual(st.className, target)) return true;
      const normSt = normalizeClassCode(st.className);
      if (normTarget === '7' && (normSt === '7' || normSt === '7A' || normSt === '7B')) return true;
      return false;
    });
  }, [editingGroup, masterStudents]);

  const handleSaveToCloud = async () => {
    setIsSaving(true);
    try {
      const ok = await OralExamAssignmentRepository.saveAssignments(
        assignments,
        activeAcademicYear,
        token || undefined
      );
      if (!ok) {
        showToast(
          'error',
          'Gagal Menyimpan ke Server',
          'Pastikan Anda masuk sebagai Admin/Operator yang aktif lalu coba kembali.'
        );
        return;
      }
      setHasUnsavedChanges(false);
      setSyncedWithStaffCount(0);
      await AuditLogger.log({
        actorId: user?.id || 'admin',
        actorRole: user?.role || 'ADMIN',
        actionType: 'UPDATE_SETTINGS',
        targetEntity: 'Oral_Exam_Assignments',
        newValue: JSON.stringify({ count: assignments.length, academicYear: activeAcademicYear }),
        reason: 'Pengaturan penguji dan penempatan siswa ujian lisan',
      }).catch(() => {});
      showToast(
        'success',
        'Penempatan Penguji Tersimpan!',
        'Guru penguji sekarang dapat langsung membuka menu Ujian Lisan dan siap menilai di HP.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    const defaults = getDefaultOralExamAssignments(activeAcademicYear, teachers);
    setAssignments(defaults);
    const linked = defaults.filter((d) => Boolean(d.examinerUserId)).length;
    setSyncedWithStaffCount(linked);
    setHasUnsavedChanges(true);
    showToast(
      'info',
      'Dimuat ke 12 Kelompok Resmi',
      linked > 0
        ? `${linked} nama penguji otomatis disinkronkan dari Manajemen Guru & Staf. Tekan Simpan untuk menerapkan.`
        : 'Tekan "Simpan Penempatan ke Server" untuk menerapkan pengaturan resmi ke semua perangkat guru.'
    );
  };

  const handleAddNewGroup = () => {
    const newGrp: OralExamAssignment = {
      id: `oral_grp_custom_${Date.now()}`,
      examinerUserId: null,
      examinerName: '',
      examinerNpp: null,
      roomNumber: 'Ruang 01',
      className: '7',
      examTracks: ['BAHASA', 'BTQ'],
      bahasaScope: 'ENGLISH_ONLY',
      btqScope: 'BOTH',
      students: [],
      academicYear: activeAcademicYear,
      isActive: true,
      updatedAt: new Date().toISOString(),
    };
    setEditingGroup(newGrp);
    setTeacherSearchQuery('');
    setUseManualExaminerInput(false);
    setManualStudentDraft('');
    setShowMasterPicker(false);
  };

  const handleSelectTeacherForGroup = (teacherId: string) => {
    if (!editingGroup) return;
    if (!teacherId) {
      setEditingGroup({ ...editingGroup, examinerUserId: null, examinerNpp: null });
      return;
    }
    const found = teachers.find((t) => t.id === teacherId);
    if (found) {
      setEditingGroup({
        ...editingGroup,
        examinerUserId: found.id,
        examinerName: found.full_name,
        examinerNpp: found.nip || null,
      });
      setUseManualExaminerInput(false);
    }
  };

  const handleToggleTrack = (track: OralExamTrack) => {
    if (!editingGroup) return;
    const exists = editingGroup.examTracks.includes(track);
    const nextTracks = exists
      ? editingGroup.examTracks.filter((t) => t !== track)
      : [...editingGroup.examTracks, track];
    if (nextTracks.length === 0) {
      showToast('warning', 'Minimal 1 Jenis Ujian', 'Pilih minimal Ujian Bahasa atau Ujian BTQ.');
      return;
    }
    setEditingGroup({ ...editingGroup, examTracks: nextTracks });
  };

  const handleAddManualStudentToGroup = () => {
    if (!editingGroup) return;
    const clean = manualStudentDraft.trim();
    if (!clean) return;
    const nextStudents = [
      ...editingGroup.students,
      {
        studentId: `oral_std_${Date.now()}_${editingGroup.students.length + 1}`,
        studentName: clean,
        className: editingGroup.className,
      },
    ];
    setEditingGroup({ ...editingGroup, students: nextStudents });
    setManualStudentDraft('');
  };

  const handleApplyMasterStudents = () => {
    if (!editingGroup) return;
    const existingNames = new Set(editingGroup.students.map((s) => s.studentName.trim().toLowerCase()));
    const toAdd = masterStudentsForEditingClass
      .filter((st) => selectedMasterIds.has(st.id) && !existingNames.has(st.fullName.trim().toLowerCase()))
      .map((st) => ({
        studentId: st.id,
        studentName: st.fullName,
        nisn: st.nisn || undefined,
        className: st.className || editingGroup.className,
      }));
    setEditingGroup({
      ...editingGroup,
      students: [...editingGroup.students, ...toAdd],
    });
    setShowMasterPicker(false);
    setSelectedMasterIds(new Set());
  };

  const handleApplyGroupEdits = () => {
    if (!editingGroup) return;
    if (!editingGroup.examinerName.trim()) {
      showToast('error', 'Nama Penguji Wajib Diisi', 'Pilih akun guru atau ketik nama penguji.');
      return;
    }
    const cleanGroup: OralExamAssignment = {
      ...editingGroup,
      examinerName: editingGroup.examinerName.trim(),
      roomNumber: editingGroup.roomNumber.trim() || 'Ruang 01',
      updatedAt: new Date().toISOString(),
    };
    setAssignments((prev) => {
      const idx = prev.findIndex((a) => a.id === cleanGroup.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = cleanGroup;
        return next;
      }
      return [cleanGroup, ...prev];
    });
    setHasUnsavedChanges(true);
    setEditingGroup(null);
  };

  const handleDeleteGroup = (groupId: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== groupId));
    setHasUnsavedChanges(true);
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="oral-admin-setup-title"
      className="fixed inset-0 z-110 flex items-center justify-center bg-black/60 md:p-4 md:backdrop-blur-xs"
    >
      <div className="w-full h-dvh md:h-auto md:max-h-[92dvh] md:max-w-3xl bg-[#F8FAFC] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900 font-sans">
        {/* 1. STICKY HEADER */}
        <header className="h-14 sm:h-16 px-4 pt-[env(safe-area-inset-top)] bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => (editingGroup ? setEditingGroup(null) : onClose())}
              aria-label={editingGroup ? 'Kembali ke daftar kelompok' : 'Tutup'}
              className="w-11 h-11 -ml-1.5 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 id="oral-admin-setup-title" className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                {editingGroup ? 'Atur Penguji & Peserta' : 'Pengaturan Penguji Ujian Lisan (Admin)'}
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                {editingGroup
                  ? `${editingGroup.roomNumber} • Kelas ${editingGroup.className}`
                  : `TA ${activeAcademicYear} • Guru tinggal siap pakai sesuai penempatan ini`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Pengaturan Penguji"
            className="w-11 h-11 rounded-xl hidden md:flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* 2. SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="w-full max-w-2xl mx-auto space-y-4">
            {isLoading ? (
              <div className="p-8 rounded-xl bg-white border border-slate-200 text-center text-xs font-semibold text-slate-500">
                Memuat daftar penguji &amp; data siswa...
              </div>
            ) : editingGroup ? (
              /* ==================== SUB-VIEW: EDIT GROUP ==================== */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      1. Pilih Penguji (Dari Manajemen Guru &amp; Staf)
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                      {teachers.length} Guru &amp; Staf Terdaftar
                    </span>
                  </div>

                  {teachers.length > 0 && (
                    <div>
                      <div className="relative mb-2">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={teacherSearchQuery}
                          onChange={(e) => setTeacherSearchQuery(e.target.value)}
                          placeholder="Cari nama, NPP, atau mapel di Manajemen Guru..."
                          className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Nama Guru / Staf Penguji
                    </label>
                    <select
                      value={editingGroup.examinerUserId || ''}
                      onChange={(e) => handleSelectTeacherForGroup(e.target.value)}
                      className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-base sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                    >
                      <option value="">
                        {teachers.length > 0
                          ? `-- Pilih Guru / Staf (${filteredTeachers.length} tersedia) --`
                          : '-- Data Manajemen Guru belum dimuat --'}
                      </option>
                      {filteredTeachers.map((t) => {
                        const subj = Array.isArray(t.teaching_assignment)
                          ? t.teaching_assignment.join(', ')
                          : t.teaching_assignment;
                        const detail = subj || t.position || t.role;
                        return (
                          <option key={t.id} value={t.id}>
                            {t.full_name} • {detail}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {selectedEditingTeacher && (
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-emerald-950 truncate">
                          {selectedEditingTeacher.full_name}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold inline-flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> Tersinkron Manajemen Guru &amp; Staf
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-900/80">
                        NPP: <strong>{selectedEditingTeacher.nip || 'Belum diisi'}</strong> • Peran:{' '}
                        <strong>{selectedEditingTeacher.role}</strong>
                        {selectedEditingTeacher.position ? ` (${selectedEditingTeacher.position})` : ''}
                      </p>
                    </div>
                  )}

                  {!useManualExaminerInput ? (
                    <button
                      type="button"
                      onClick={() => setUseManualExaminerInput(true)}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                    >
                      Atau ketik nama manual (jika penguji tamu belum punya akun)
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-bold text-slate-700">
                          Nama Penguji Manual / Khusus
                        </label>
                        {selectedEditingTeacher && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGroup({
                                ...editingGroup,
                                examinerName: selectedEditingTeacher.full_name,
                                examinerNpp: selectedEditingTeacher.nip || null,
                              });
                              setUseManualExaminerInput(false);
                            }}
                            className="text-[11px] font-bold text-[#023246] hover:underline cursor-pointer"
                          >
                            Gunakan Nama Manajemen Guru
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={editingGroup.examinerName}
                        onChange={(e) => setEditingGroup({ ...editingGroup, examinerName: e.target.value })}
                        placeholder="Ketik nama penguji..."
                        className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Ruangan</label>
                      <input
                        type="text"
                        value={editingGroup.roomNumber}
                        onChange={(e) => setEditingGroup({ ...editingGroup, roomNumber: e.target.value })}
                        placeholder="Ruang 01"
                        className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Kelas</label>
                      <select
                        value={editingGroup.className}
                        onChange={(e) => setEditingGroup({ ...editingGroup, className: e.target.value })}
                        className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-base sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                      >
                        {AVAILABLE_CLASSES.map((c) => (
                          <option key={c} value={c}>
                            {c === 'SMA' ? 'SMA (Gabungan)' : `Kelas ${c}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 2: Exam Types */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    2. Mata Uji yang Ditugaskan
                  </h3>

                  <div className="p-3 rounded-xl border border-slate-200 space-y-2.5">
                    <label className="flex items-center justify-between gap-2 cursor-pointer">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Languages className="w-4 h-4 text-[#023246]" />
                        <span>Ujian Lisan Bahasa (Checklist 15 Soal)</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={editingGroup.examTracks.includes('BAHASA')}
                        onChange={() => handleToggleTrack('BAHASA')}
                        className="w-5 h-5 accent-[#023246] cursor-pointer"
                      />
                    </label>
                    {editingGroup.examTracks.includes('BAHASA') && (
                      <select
                        value={editingGroup.bahasaScope}
                        onChange={(e) =>
                          setEditingGroup({
                            ...editingGroup,
                            bahasaScope: e.target.value as OralExamBahasaScope,
                          })
                        }
                        className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs font-semibold text-slate-800"
                      >
                        <option value="ENGLISH_ONLY">Bahasa Inggris Saja</option>
                        <option value="ARABIC_ONLY">Bahasa Arab Saja</option>
                        <option value="BOTH">Bahasa Inggris &amp; Bahasa Arab</option>
                      </select>
                    )}
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 space-y-2.5">
                    <label className="flex items-center justify-between gap-2 cursor-pointer">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#0D7A5F]" />
                        <span>Ujian Mengaji BTQ &amp; Hafalan (Nilai 0–100)</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={editingGroup.examTracks.includes('BTQ')}
                        onChange={() => handleToggleTrack('BTQ')}
                        className="w-5 h-5 accent-[#0D7A5F] cursor-pointer"
                      />
                    </label>
                    {editingGroup.examTracks.includes('BTQ') && (
                      <select
                        value={editingGroup.btqScope}
                        onChange={(e) =>
                          setEditingGroup({
                            ...editingGroup,
                            btqScope: e.target.value as OralExamBtqScope,
                          })
                        }
                        className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs font-semibold text-slate-800"
                      >
                        <option value="BTQ_ONLY">BTQ Saja</option>
                        <option value="HAFALAN_ONLY">Hafalan Saja</option>
                        <option value="BOTH">BTQ &amp; Hafalan (Keduanya)</option>
                      </select>
                    )}
                  </div>

                  <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <span className="text-xs font-bold text-slate-800">Aktifkan Penugasan Penguji Ini</span>
                    <input
                      type="checkbox"
                      checked={editingGroup.isActive}
                      onChange={(e) => setEditingGroup({ ...editingGroup, isActive: e.target.checked })}
                      className="w-5 h-5 accent-emerald-600 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Section 3: Student Placement */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      3. Siswa Ditempatkan ({editingGroup.students.length} Siswa)
                    </h3>
                    {masterStudentsForEditingClass.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMasterIds(new Set());
                          setShowMasterPicker((prev) => !prev);
                        }}
                        className="h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>{showMasterPicker ? 'Tutup Pilih Master' : 'Ambil dari Master Siswa'}</span>
                      </button>
                    )}
                  </div>

                  {showMasterPicker && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          Master Kelas {editingGroup.className} ({masterStudentsForEditingClass.length})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedMasterIds(new Set(masterStudentsForEditingClass.map((s) => s.id)))
                          }
                          className="text-xs font-bold text-[#023246] hover:underline cursor-pointer"
                        >
                          Pilih Semua
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {masterStudentsForEditingClass.map((st) => {
                          const checked = selectedMasterIds.has(st.id);
                          return (
                            <label
                              key={st.id}
                              className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setSelectedMasterIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(st.id)) next.delete(st.id);
                                    else next.add(st.id);
                                    return next;
                                  });
                                }}
                                className="w-4 h-4 accent-[#023246]"
                              />
                              <span className="truncate">{st.fullName}</span>
                            </label>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyMasterStudents}
                        disabled={selectedMasterIds.size === 0}
                        className="w-full h-11 rounded-xl bg-[#023246] hover:bg-[#034560] disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                      >
                        Tambahkan {selectedMasterIds.size} Siswa Terpilih
                      </button>
                    </div>
                  )}

                  {/* Add Manual Student Row */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={manualStudentDraft}
                      onChange={(e) => setManualStudentDraft(e.target.value)}
                      placeholder="Ketik nama siswa tambahan..."
                      className="flex-1 h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#023246]"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualStudentToGroup}
                      className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shrink-0"
                    >
                      Tambah
                    </button>
                  </div>

                  {/* Assigned students list */}
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                    {editingGroup.students.length === 0 ? (
                      <p className="p-4 text-xs text-slate-500 text-center">
                        Belum ada siswa di kelompok ini.
                      </p>
                    ) : (
                      editingGroup.students.map((st, idx) => (
                        <div
                          key={`${st.studentId}_${idx}`}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs bg-white"
                        >
                          <span className="font-semibold text-slate-800 truncate">
                            {idx + 1}. {st.studentName}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingGroup({
                                ...editingGroup,
                                students: editingGroup.students.filter((_, i) => i !== idx),
                              })
                            }
                            aria-label={`Hapus ${st.studentName}`}
                            className="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 flex items-center justify-center cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* ==================== OVERVIEW: ALL GROUPS ==================== */
              <>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-900">
                      Total {assignments.filter((a) => a.isActive).length} Penguji Aktif •{' '}
                      {assignments.reduce((sum, a) => sum + (a.isActive ? a.students.length : 0), 0)} Siswa
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Guru yang ditugaskan akan langsung melihat ruangan &amp; daftar siswanya tanpa pengaturan manual.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => loadAllData(true)}
                      title="Muat ulang nama guru dari Manajemen Guru & Staf"
                      className="h-10 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Muat Ulang Guru</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetDefaults}
                      className="h-10 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>12 Kelompok Resmi</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddNewGroup}
                      className="h-10 px-3 rounded-xl bg-[#023246] hover:bg-[#034560] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Penguji</span>
                    </button>
                  </div>
                </div>

                {syncedWithStaffCount > 0 && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
                    <strong>{syncedWithStaffCount} nama penguji</strong> otomatis diselaraskan dari{' '}
                    <strong>Data Manajemen Guru &amp; Staf</strong> ({teachers.length} akun aktif). Tekan tombol{' '}
                    <strong>Simpan Penempatan ke Server</strong> di bawah agar tersinkron ke seluruh perangkat.
                  </div>
                )}

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari nama penguji, ruang, atau nama siswa..."
                    className="w-full h-11 pl-9 pr-3.5 bg-white border border-slate-200 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#023246]"
                  />
                </div>

                <div className="space-y-2.5">
                  {filteredAssignments.map((grp) => (
                    <div
                      key={grp.id}
                      className={`p-3.5 rounded-xl border space-y-2.5 ${
                        grp.isActive ? 'bg-white border-slate-200' : 'bg-slate-100 border-slate-200 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[10px] font-bold">
                              {grp.roomNumber} • {grp.className === 'SMA' ? 'SMA' : `Kelas ${grp.className}`}
                            </span>
                            {grp.examinerUserId && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold inline-flex items-center gap-1">
                                <UserCheck className="w-3 h-3" /> Akun Tertaut
                              </span>
                            )}
                            {!grp.isActive && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                                Nonaktif
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-extrabold text-slate-900 truncate">
                            {grp.examinerName || 'Belum diisi'}
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            {grp.students.length} siswa •{' '}
                            {grp.examTracks.map((t) => (t === 'BAHASA' ? 'Ujian Bahasa' : 'Ujian BTQ')).join(' + ')}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGroup(JSON.parse(JSON.stringify(grp)));
                              setTeacherSearchQuery('');
                              setUseManualExaminerInput(!grp.examinerUserId && Boolean(grp.examinerName));
                              setManualStudentDraft('');
                              setShowMasterPicker(false);
                            }}
                            className="h-10 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(grp.id)}
                            aria-label={`Hapus ${grp.examinerName}`}
                            className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-rose-50 text-rose-600 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>

        {/* 3. STICKY FOOTER */}
        <footer className="sticky bottom-0 z-20 bg-white border-t border-slate-200 p-3 pb-[max(12px,env(safe-area-inset-bottom))] shrink-0">
          <div className="w-full max-w-2xl mx-auto flex items-center gap-2.5">
            {editingGroup ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="h-12 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleApplyGroupEdits}
                  className="flex-1 h-12 px-4 rounded-xl bg-[#023246] hover:bg-[#034560] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Terapkan Perubahan Kelompok</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-12 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveToCloud}
                  className="flex-1 h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSaving
                      ? 'Menyimpan ke Server...'
                      : hasUnsavedChanges
                        ? 'Simpan Penempatan ke Server*'
                        : 'Simpan Penempatan ke Server'}
                  </span>
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
};
