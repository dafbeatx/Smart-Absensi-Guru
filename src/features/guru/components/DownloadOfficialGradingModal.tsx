import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  BookOpen,
  UserCheck,
  Layers,
  GraduationCap,
} from 'lucide-react';
import type {
  ExamSessionRecord,
  GradedStudentScoreRecord,
  UserProfile,
} from '../../../types/database.types';
import {
  SemesterGradingExcelService,
  type GradingTargetColumn,
  type StudentScoreEntry,
} from '../../../services/semester-grading-excel.service';
import { ExamCorrectionRepository } from '../../../repositories/ExamCorrectionRepository';
import { resolveSessionAcademicYear } from '../../../utils/academic-year.utils';
import {
  OFFICIAL_SCHOOL_SUBJECTS,
  isSameSubject,
  normalizeSubjectName,
} from '../../../config/school-subjects.config';
import { AVAILABLE_ACADEMIC_YEARS } from '../../../repositories/AdministrationRepository';
import { logger } from '../../../utils/logger.utils';

export interface DownloadOfficialGradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSession?: ExamSessionRecord | null;
  gradedStudents?: GradedStudentScoreRecord[];
  availableSessions?: ExamSessionRecord[];
  currentUser?: UserProfile | null;
  defaultAcademicYear?: string;
  defaultSemester?: string;
  onSuccess?: (msg: string) => void;
}

export const DownloadOfficialGradingModal: React.FC<DownloadOfficialGradingModalProps> = ({
  isOpen,
  onClose,
  activeSession = null,
  gradedStudents = [],
  availableSessions = [],
  currentUser = null,
  defaultAcademicYear = '2026/2027',
  defaultSemester = 'Ganjil',
  onSuccess,
}) => {
  // 1. Mata Pelajaran (Ditanyakan kepada Guru)
  const [selectedSubject, setSelectedSubject] = useState<string>('Informatika');
  const [customSubject, setCustomSubject] = useState<string>('');
  const isCustomSubjectMode = selectedSubject === '__CUSTOM__';

  // 2. Tahun Ajaran (Ditanyakan kepada Guru)
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(() => {
    if (activeSession?.academic_year) {
      return resolveSessionAcademicYear(activeSession.academic_year, activeSession.session_name, activeSession.created_at, defaultAcademicYear);
    }
    return defaultAcademicYear || '2026/2027';
  });

  // 3. Semester (Ditanyakan kepada Guru)
  const [selectedSemester, setSelectedSemester] = useState<'Ganjil' | 'Genap'>(() => {
    const sem = activeSession?.semester || defaultSemester || 'Ganjil';
    return /genap/i.test(sem) ? 'Genap' : 'Ganjil';
  });

  // 4. Guru Pengampu & KKM
  const [teacherName, setTeacherName] = useState<string>(() => activeSession?.teacher || currentUser?.full_name || '');
  const [kkm, setKkm] = useState<number>(() => Number(activeSession?.kkm) || 75);

  // 5. Target Kolom Nilai (Ditanyakan & Divalidasi)
  const [targetColumn, setTargetColumn] = useState<GradingTargetColumn>('NONE');

  // Loading & Error State
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Rombel statis yang selalu disertakan dalam format resmi
  const canonicalClassesInfo = useMemo(() => [
    { name: '7', count: 31, level: 'SMP' },
    { name: '8A', count: 15, level: 'SMP' },
    { name: '8B', count: 29, level: 'SMP' },
    { name: '9A', count: 20, level: 'SMP' },
    { name: '9B', count: 26, level: 'SMP' },
    { name: 'SMA', count: 23, level: 'SMA' },
  ], []);

  const totalRegisteredStudents = useMemo(() => {
    return canonicalClassesInfo.reduce((acc, c) => acc + c.count, 0); // 144 siswa
  }, [canonicalClassesInfo]);

  // Inisialisasi awal saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);

      // Inisialisasi Mata Pelajaran
      const initialSub = activeSession?.subject || 'Informatika';
      const isKnown = OFFICIAL_SCHOOL_SUBJECTS.some((s) => isSameSubject(s.name, initialSub) || isSameSubject(s.code, initialSub));
      if (isKnown) {
        const found = OFFICIAL_SCHOOL_SUBJECTS.find((s) => isSameSubject(s.name, initialSub) || isSameSubject(s.code, initialSub));
        setSelectedSubject(found?.name || initialSub);
        setCustomSubject('');
      } else {
        setSelectedSubject('__CUSTOM__');
        setCustomSubject(initialSub);
      }

      // Inisialisasi Tahun Ajaran
      const resolvedYear = activeSession
        ? resolveSessionAcademicYear(activeSession.academic_year, activeSession.session_name, activeSession.created_at, defaultAcademicYear)
        : defaultAcademicYear;
      setSelectedAcademicYear(resolvedYear);

      // Inisialisasi Semester
      const sem = activeSession?.semester || defaultSemester || 'Ganjil';
      setSelectedSemester(/genap/i.test(sem) ? 'Genap' : 'Ganjil');

      // Inisialisasi Guru & KKM
      setTeacherName(activeSession?.teacher || currentUser?.full_name || 'Guru Pengampu');
      setKkm(Number(activeSession?.kkm) || 75);

      // Inisialisasi Target Kolom Nilai
      if (activeSession && gradedStudents.length > 0) {
        const isAsas = /ASAS|PAS|UAS|AKHIR/i.test(activeSession.exam_type || '');
        setTargetColumn(isAsas ? 'ASAS' : 'ASTS');
      } else {
        setTargetColumn('NONE');
      }
    }
  }, [isOpen, activeSession, gradedStudents, currentUser, defaultAcademicYear, defaultSemester]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDownloading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDownloading, onClose]);

  // Nama mata pelajaran efektif
  const effectiveSubjectName = useMemo(() => {
    if (isCustomSubjectMode) {
      return customSubject.trim() || 'Mata Pelajaran';
    }
    return selectedSubject;
  }, [isCustomSubjectMode, customSubject, selectedSubject]);

  // Sesi-sesi yang cocok dengan mata pelajaran & tahun ajaran yang dipilih
  const matchingSessions = useMemo(() => {
    return availableSessions.filter((s) => {
      const matchSub = isSameSubject(s.subject, effectiveSubjectName) || normalizeSubjectName(s.subject) === normalizeSubjectName(effectiveSubjectName);
      const sessYear = resolveSessionAcademicYear(s.academic_year, s.session_name, s.created_at, defaultAcademicYear);
      const matchYear = sessYear === selectedAcademicYear;
      return matchSub && matchYear;
    });
  }, [availableSessions, effectiveSubjectName, selectedAcademicYear, defaultAcademicYear]);

  // Hitung jumlah rombel yang memiliki sesi ujian
  const classesWithSessions = useMemo(() => {
    const map = new Set<string>();
    matchingSessions.forEach((s) => {
      map.add(SemesterGradingExcelService.normalizeSheetClassName(s.class_name));
    });
    if (activeSession && isSameSubject(activeSession.subject, effectiveSubjectName)) {
      map.add(SemesterGradingExcelService.normalizeSheetClassName(activeSession.class_name));
    }
    return map;
  }, [matchingSessions, activeSession, effectiveSubjectName]);

  // Eksekusi Unduh Berkas Excel
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setErrorMessage(null);

    try {
      const finalSubject = effectiveSubjectName.trim();
      if (!finalSubject) {
        throw new Error('Silakan pilih atau masukkan mata pelajaran.');
      }

      // Kumpulkan data nilai per kelas jika guru memilih untuk mengisi nilai (targetColumn !== 'NONE')
      const scoresByClass: Record<string, StudentScoreEntry[]> = {};

      if (targetColumn !== 'NONE') {
        // Gunakan Map per kelas agar nilai siswa digabungkan (merged) dari activeSession dan seluruh sesi yang cocok
        const classStudentMaps: Record<string, Map<string, StudentScoreEntry>> = {};

        const addStudentGrade = (normCls: string, stName: string, rawScore: number, examType?: string) => {
          if (!stName || !stName.trim()) return;
          const cleanName = stName.trim();
          const canonKey = SemesterGradingExcelService.canonicalizeStudentName(cleanName);
          if (!canonKey) return;

          if (!classStudentMaps[normCls]) {
            classStudentMaps[normCls] = new Map();
          }
          const m = classStudentMaps[normCls];

          const isAsas = targetColumn === 'ASAS'
            ? true
            : (targetColumn === 'ASTS' ? false : /ASAS|PAS|UAS|AKHIR/i.test(examType || ''));

          let entry = m.get(canonKey);
          if (!entry) {
            entry = {
              name: cleanName,
              asts: null,
              asas: null,
            };
            m.set(canonKey, entry);
          }

          if (targetColumn === 'ASTS') {
            entry.asts = rawScore;
          } else if (targetColumn === 'ASAS') {
            entry.asas = rawScore;
          } else if (targetColumn === 'BOTH') {
            entry.asts = rawScore;
            entry.asas = rawScore;
          } else {
            if (isAsas) {
              if (entry.asas === null || entry.asas === 0 || rawScore > 0) entry.asas = rawScore;
            } else {
              if (entry.asts === null || entry.asts === 0 || rawScore > 0) entry.asts = rawScore;
            }
          }
        };

        // 1. Masukkan nilai dari activeSession jika cocok
        if (
          activeSession &&
          (isSameSubject(activeSession.subject, finalSubject) || normalizeSubjectName(activeSession.subject) === normalizeSubjectName(finalSubject))
        ) {
          const normCls = SemesterGradingExcelService.normalizeSheetClassName(activeSession.class_name);
          const studentList = gradedStudents.length > 0 ? gradedStudents : [];
          studentList.forEach((st) => {
            const score = (st.final_score !== null && st.final_score !== undefined && !isNaN(Number(st.final_score)) && Number(st.final_score) > 0)
              ? Number(st.final_score)
              : (Number(st.mcq_score) || Number(st.essay_score) || (st.final_score !== null && st.final_score !== undefined ? Number(st.final_score) : 0));
            addStudentGrade(normCls, st.name, score, activeSession.exam_type);
          });
        }

        // 2. Cari dan gabungkan nilai dari seluruh sesi yang cocok di availableSessions
        for (const sess of matchingSessions) {
          const normCls = SemesterGradingExcelService.normalizeSheetClassName(sess.class_name);
          try {
            const grades = await ExamCorrectionRepository.getGradedStudents(sess.id);
            if (grades && grades.length > 0) {
              grades.forEach((st) => {
                const score = (st.final_score !== null && st.final_score !== undefined && !isNaN(Number(st.final_score)) && Number(st.final_score) > 0)
                  ? Number(st.final_score)
                  : (Number(st.mcq_score) || Number(st.essay_score) || (st.final_score !== null && st.final_score !== undefined ? Number(st.final_score) : 0));
                addStudentGrade(normCls, st.name, score, sess.exam_type);
              });
            }
          } catch (fetchErr) {
            logger.warn('DownloadOfficialGradingModal', `Gagal memuat nilai sesi ${sess.id}:`, fetchErr);
          }
        }

        // Susun scoresByClass dari classStudentMaps
        Object.entries(classStudentMaps).forEach(([cls, map]) => {
          scoresByClass[cls] = Array.from(map.values());
        });
      }

      // Export template resmi multi-sheet mencakup seluruh kelas
      // includeRecapSheet: false menjamin hasil 100% persis master template 8 sheet (tanpa sheet rekap tambahan di awal)
      await SemesterGradingExcelService.exportOfficialFormatExcel({
        subject: finalSubject,
        teacher: teacherName.trim() || 'Guru Pengampu',
        academicYear: selectedAcademicYear,
        semester: selectedSemester,
        kkm: kkm || 75,
        className: 'SEMUA_KELAS',
        scoresByClass: Object.keys(scoresByClass).length > 0 ? scoresByClass : undefined,
        targetColumn,
        includeRecapSheet: false,
      });

      const targetColText = targetColumn === 'NONE' 
        ? 'Format Blanko Bersih' 
        : targetColumn === 'ASTS' 
          ? 'Kolom ASTS' 
          : targetColumn === 'ASAS' 
            ? 'Kolom ASAS' 
            : 'Kedua Kolom (ASTS & ASAS)';

      onSuccess?.(`Format Penilaian (${finalSubject}) berhasil diunduh untuk semua kelas dengan alokasi ${targetColText}!`);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memproses dan mengunduh berkas Format Penilaian.');
    } finally {
      setIsDownloading(false);
    }
  }, [
    effectiveSubjectName,
    targetColumn,
    activeSession,
    gradedStudents,
    matchingSessions,
    teacherName,
    selectedAcademicYear,
    selectedSemester,
    kkm,
    onSuccess,
    onClose,
  ]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-format-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200 shadow-2xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 id="download-format-title" className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Unduh Format Penilaian Resmi
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Mencakup semua kelas (7, 8A, 8B, 9A, 9B, SMA) dengan tabel dan rumus lengkap
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDownloading}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer min-h-11 min-w-11 flex items-center justify-center -mr-1"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-slate-800">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Pertanyaan Utama: Mata Pelajaran, Tahun Ajaran, Semester */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-200/80 pb-2">
              <BookOpen className="w-4 h-4 text-teal-700" />
              <span>Identitas Penilaian Sekolah (Ditulis ke Semua Sheet Kelas)</span>
            </div>

            {/* 1. Mata Pelajaran (Ditanyakan) */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Mata Pelajaran <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all min-h-11"
              >
                {OFFICIAL_SCHOOL_SUBJECTS.map((subj) => (
                  <option key={subj.code} value={subj.name}>
                    {subj.name} ({subj.category})
                  </option>
                ))}
                <option value="__CUSTOM__">[+] Mata Pelajaran Lainnya (Tulis Manual)</option>
              </select>

              {isCustomSubjectMode && (
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Ketik nama mata pelajaran..."
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all min-h-11"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* 2 & 3. Tahun Ajaran & Semester (Ditanyakan) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tahun Ajaran</span>
                  <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all min-h-11"
                >
                  {AVAILABLE_ACADEMIC_YEARS.map((ay) => (
                    <option key={ay.year} value={ay.year}>
                      {ay.year} {ay.year === '2026/2027' ? '(Aktif)' : ''}
                    </option>
                  ))}
                  {!AVAILABLE_ACADEMIC_YEARS.some((ay) => ay.year === selectedAcademicYear) && (
                    <option value={selectedAcademicYear}>{selectedAcademicYear}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Semester <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-white border border-slate-300 rounded-xl min-h-11">
                  <button
                    type="button"
                    onClick={() => setSelectedSemester('Ganjil')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedSemester === 'Ganjil'
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Ganjil
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSemester('Genap')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedSemester === 'Genap'
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Genap
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Guru Pengampu & KKM */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Guru Pengampu</span>
                </label>
                <input
                  type="text"
                  placeholder="Nama Guru Pengampu..."
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all min-h-11"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                  <span>KKM / KKTP</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={kkm}
                  onChange={(e) => setKkm(Math.min(100, Math.max(1, Number(e.target.value) || 75)))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all min-h-11"
                />
              </div>
            </div>
          </div>

          {/* Cakupan Semua Kelas (Include Semua Kelas 7, 8A, 8B, 9A, 9B, SMA) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>Cakupan Sheet Excel (Semua 6 Kelas Disertakan)</span>
              </label>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                {totalRegisteredStudents} Siswa • 6 Kelas Lengkap
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {canonicalClassesInfo.map((cls) => {
                const hasSession = classesWithSessions.has(cls.name);
                return (
                  <div
                    key={cls.name}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col justify-between"
                  >
                    <span className="text-xs font-extrabold text-slate-900">Kelas {cls.name}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">{cls.count} Siswa</span>
                    {hasSession && (
                      <span className="text-[9px] font-bold text-teal-700 bg-teal-50 rounded px-1 mt-1">
                        Ada Sesi
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pertanyaan Alokasi Nilai: Blanko Kosong vs Kolom ASTS/ASAS */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 block">
                Validasi Pengisian Nilai ke Tabel Excel
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Sama Persis Format Blanko Resmi
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Opsi 1: Format Blanko Kosong Resmi */}
              <button
                type="button"
                onClick={() => setTargetColumn('NONE')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-24 ${
                  targetColumn === 'NONE'
                    ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      targetColumn === 'NONE' ? 'border-emerald-700 bg-emerald-700' : 'border-slate-300'
                    }`}>
                      {targetColumn === 'NONE' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-xs font-bold text-slate-900">Blanko Kosong (Semua Kelas)</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                    Tanpa Nilai
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                  Tabel 144 siswa di semua 6 kelas disertakan lengkap dengan rumus, namun <strong>kolom nilai dikosongkan</strong>.
                </p>
              </button>

              {/* Opsi 2: Kolom ASTS */}
              <button
                type="button"
                onClick={() => setTargetColumn('ASTS')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-24 ${
                  targetColumn === 'ASTS'
                    ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      targetColumn === 'ASTS' ? 'border-emerald-700 bg-emerald-700' : 'border-slate-300'
                    }`}>
                      {targetColumn === 'ASTS' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-xs font-bold text-slate-900">Isi Kolom ASTS</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Tengah Semester
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                  Nilai dari sesi ujian mapel ini dialokasikan ke <strong>Kolom ASTS</strong> (UTS/PTS). Kolom ASAS kosong.
                </p>
              </button>

              {/* Opsi 3: Kolom ASAS */}
              <button
                type="button"
                onClick={() => setTargetColumn('ASAS')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-24 ${
                  targetColumn === 'ASAS'
                    ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      targetColumn === 'ASAS' ? 'border-emerald-700 bg-emerald-700' : 'border-slate-300'
                    }`}>
                      {targetColumn === 'ASAS' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-xs font-bold text-slate-900">Isi Kolom ASAS</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                    Akhir Semester
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                  Nilai dari sesi ujian mapel ini dialokasikan ke <strong>Kolom ASAS</strong> (UAS/PAS). Kolom ASTS kosong.
                </p>
              </button>

              {/* Opsi 4: Kedua Kolom (ASTS & ASAS) */}
              <button
                type="button"
                onClick={() => setTargetColumn('BOTH')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-24 ${
                  targetColumn === 'BOTH'
                    ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      targetColumn === 'BOTH' ? 'border-emerald-700 bg-emerald-700' : 'border-slate-300'
                    }`}>
                      {targetColumn === 'BOTH' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-xs font-bold text-slate-900">Kedua Kolom</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                    ASTS & ASAS
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                  Salin nilai sesi ke <strong>ASTS & ASAS</strong> untuk menguji kalkulasi nilai akhir semester 100%.
                </p>
              </button>
            </div>
          </div>

          {/* Konfirmasi Kesesuaian Template */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-950">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Format Berkas 100% Persis Template Master Blanko Sekolah</p>
              <p className="text-[11px] text-emerald-900 mt-0.5 leading-relaxed">
                Tersusun atas 8 sheet resmi: <code>IDENTITAS SEKOLAH</code>, <code>FORMAT PENILAIAN</code>, serta 6 sheet kelas (<code>7</code>, <code>8A</code>, <code>8B</code>, <code>9A</code>, <code>9B</code>, <code>SMA</code>) dengan tabel siswa, rumus nilai akhir <code>ROUND((ASTS*50%)+(ASAS*50%), 0)</code>, predikat, dan status ketuntasan.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isDownloading}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all min-h-11 min-w-20 cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all min-h-11 cursor-pointer"
          >
            <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
            <span>{isDownloading ? 'Menyiapkan Berkas...' : 'Unduh Format Penilaian (.xlsx)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
