import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import type {
  ExamSessionRecord,
  StudentItem,
  UserProfile,
} from '../../../types/database.types';
import {
  UniversalExcelGradingService,
  type UniversalExcelParsedSheet,
  type UniversalExcelStudentRow,
} from '../../../services/universal-excel-grading.service';
import { AdministrationRepository } from '../../../repositories/AdministrationRepository';
import { ProviderFactory } from '../../../providers/provider-factory';
import { OFFICIAL_SCHOOL_SUBJECTS } from '../../../config/school-subjects.config';
import { areClassCodesEqual } from '../../../utils/class.utils';

interface UniversalExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSessions: ExamSessionRecord[];
  allDirectoryStudents: StudentItem[];
  currentUser: UserProfile;
  onSuccess: (newSession: ExamSessionRecord, message: string) => void;
}

export const UniversalExcelImportModal: React.FC<UniversalExcelImportModalProps> = ({
  isOpen,
  onClose,
  availableSessions,
  allDirectoryStudents,
  currentUser,
  onSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedSheets, setParsedSheets] = useState<UniversalExcelParsedSheet[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);

  // Defaults derived from context and repository
  const defaultTeacher = currentUser.full_name || 'Guru Pengampu';
  const defaultAcademicYear = AdministrationRepository.getActiveAcademicYear() || '2026/2027';
  const defaultSemester = AdministrationRepository.getActiveSemester() === 'GENAP' ? 'Genap' : 'Ganjil';

  // Per-sheet persistent state
  const fallbackConfig = useMemo(() => ({
    sessionName: '',
    hasCustomSessionName: false,
    subject: 'Informatika',
    teacherName: defaultTeacher,
    className: '8A',
    examType: 'PTS / UTS',
    academicYear: defaultAcademicYear,
    semester: defaultSemester,
    kkm: 75,
    examFormat: 'PG_ONLY' as 'PG_ONLY' | 'PG_AND_ESSAY',
    rows: [] as UniversalExcelStudentRow[],
    importMode: 'CREATE_NEW' as 'CREATE_NEW' | 'UPDATE_EXISTING',
    selectedExistingSessionId: '',
  }), [defaultTeacher, defaultAcademicYear, defaultSemester]);

  type SheetConfigState = typeof fallbackConfig;
  const [sheetConfigs, setSheetConfigs] = useState<Record<number, SheetConfigState>>({});

  // Active config for current sheet
  const currentConfig: SheetConfigState = sheetConfigs[activeSheetIndex] || fallbackConfig;

  // Registered teachers in school directory
  const [availableTeachers, setAvailableTeachers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (isOpen) {
      ProviderFactory.getProvider()
        .getAllUsers('')
        .then((users) => {
          if (Array.isArray(users)) {
            const teachers = users.filter(
              (u) => u.role === 'GURU' || u.role === 'ADMIN' || u.role === 'OPERATOR'
            );
            setAvailableTeachers(teachers.length > 0 ? teachers : users);
          }
        })
        .catch(() => {});
    } else {
      // Reset state cleanly when modal closes
      setSelectedFile(null);
      setParsedSheets([]);
      setSheetConfigs({});
      setActiveSheetIndex(0);
      setErrorMessage(null);
      initialSheetsRef.current = [];
    }
  }, [isOpen]);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available classes in directory
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    allDirectoryStudents.forEach((s) => {
      if (s.className) set.add(s.className);
    });
    return Array.from(set).sort();
  }, [allDirectoryStudents]);

  // Candidates students in selected class
  const classCandidates = useMemo(() => {
    return allDirectoryStudents.filter((s) => areClassCodesEqual(s.className || '', currentConfig.className));
  }, [allDirectoryStudents, currentConfig.className]);

  // Cached original sheets for resetting rows
  const initialSheetsRef = useRef<UniversalExcelParsedSheet[]>([]);

  // Update active sheet config
  const updateActiveConfig = (
    updater: Partial<SheetConfigState> | ((prev: SheetConfigState) => Partial<SheetConfigState>)
  ) => {
    setSheetConfigs((prevMap) => {
      const prev = prevMap[activeSheetIndex] || fallbackConfig;
      const patch = typeof updater === 'function' ? updater(prev) : updater;
      return {
        ...prevMap,
        [activeSheetIndex]: {
          ...prev,
          ...patch,
        },
      };
    });
  };

  // Handle file select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);
    setErrorMessage(null);

    try {
      const sheets = await UniversalExcelGradingService.parseExcelFile(
        file,
        allDirectoryStudents,
        availableTeachers,
        currentUser
      );
      if (sheets.length === 0) {
        setErrorMessage('Tidak dapat menemukan tabel data nilai atau nama siswa pada file Excel ini.');
        setParsedSheets([]);
        setSheetConfigs({});
        initialSheetsRef.current = [];
      } else {
        const initialConfigs: Record<number, SheetConfigState> = {};
        sheets.forEach((sh, idx) => {
          const teacher = sh.detectedTeacher || defaultTeacher;
          const cls = sh.detectedClass || '8A';
          const subj = sh.detectedSubject || 'Informatika';
          const acadYear = sh.detectedAcademicYear || defaultAcademicYear;
          const sem = sh.detectedSemester || defaultSemester;
          const exType = 'PTS / UTS';
          const generatedName = `${exType} - ${subj} - ${cls} (${acadYear})`;

          initialConfigs[idx] = {
            sessionName: generatedName,
            hasCustomSessionName: false,
            subject: subj,
            teacherName: teacher,
            className: cls,
            examType: exType,
            academicYear: acadYear,
            semester: sem,
            kkm: sh.detectedKkm || 75,
            examFormat: sh.detectedFormat || 'PG_ONLY',
            rows: JSON.parse(JSON.stringify(sh.rows)),
            importMode: 'CREATE_NEW',
            selectedExistingSessionId: '',
          };
        });

        setParsedSheets(sheets);
        initialSheetsRef.current = JSON.parse(JSON.stringify(sheets));
        setSheetConfigs(initialConfigs);
        setActiveSheetIndex(0);
      }
    } catch (err: any) {
      setErrorMessage(`Gagal membaca file Excel: ${err?.message || 'Format tidak valid'}`);
      setParsedSheets([]);
      setSheetConfigs({});
      initialSheetsRef.current = [];
    } finally {
      setIsParsing(false);
    }
  };

  // Switch sheet tab without losing edits
  const handleSelectSheet = (index: number) => {
    if (index >= 0 && index < parsedSheets.length) {
      setActiveSheetIndex(index);
    }
  };

  // Terapkan pengaturan sesi (mapel, guru, jenis ujian, tahun ajaran, semester, format, kkm) ke seluruh sheet
  const handleApplySettingsToAllSheets = () => {
    setSheetConfigs((prevMap) => {
      const updated = { ...prevMap };
      parsedSheets.forEach((_, idx) => {
        if (updated[idx]) {
          const prev = updated[idx];
          const newSessionName = !prev.hasCustomSessionName
            ? `${currentConfig.examType} - ${currentConfig.subject} - ${prev.className} (${currentConfig.academicYear})`
            : prev.sessionName;
          updated[idx] = {
            ...prev,
            subject: currentConfig.subject,
            teacherName: currentConfig.teacherName,
            examType: currentConfig.examType,
            academicYear: currentConfig.academicYear,
            semester: currentConfig.semester,
            kkm: currentConfig.kkm,
            examFormat: currentConfig.examFormat,
            sessionName: newSessionName,
          };
        }
      });
      return updated;
    });
  };

  // Hapus satu baris dari daftar pratinjau import pada sheet aktif
  const handleDeleteRow = (rowIndex: number) => {
    updateActiveConfig((prev) => ({
      rows: prev.rows.filter((_, idx) => idx !== rowIndex),
    }));
  };

  // Bersihkan semua baris yang belum cocok dengan database siswa pada sheet aktif
  const handleClearUnmatchedRows = () => {
    updateActiveConfig((prev) => ({
      rows: prev.rows.filter((r) => r.matchConfidence !== 'UNMATCHED'),
    }));
  };

  // Kembalikan semua baris sheet aktif ke kondisi awal dari berkas Excel
  const handleResetCurrentSheet = () => {
    const origSheet = initialSheetsRef.current[activeSheetIndex];
    if (origSheet && origSheet.rows) {
      updateActiveConfig({
        rows: JSON.parse(JSON.stringify(origSheet.rows)),
      });
    }
  };

  // Update matched student manually for a row in active sheet
  const handleUpdateStudentMatch = (rowIndex: number, studentId: string) => {
    updateActiveConfig((prev) => ({
      rows: prev.rows.map((r, i) => {
        if (i !== rowIndex) return r;
        if (!studentId) {
          return {
            ...r,
            matchedStudentId: undefined,
            matchedStudentName: undefined,
            matchConfidence: 'UNMATCHED',
          };
        }
        const found = allDirectoryStudents.find((s) => s.id === studentId);
        return {
          ...r,
          matchedStudentId: found?.id,
          matchedStudentName: found?.fullName,
          matchConfidence: 'MANUAL',
        };
      }),
    }));
  };

  // Execute import & creation
  const handleExecuteImport = async () => {
    if (currentConfig.rows.length === 0) {
      setErrorMessage('Tidak ada baris siswa yang dapat diimpor.');
      return;
    }

    if (currentConfig.importMode === 'UPDATE_EXISTING' && !currentConfig.selectedExistingSessionId) {
      setErrorMessage('Pilih sesi ujian yang sudah ada yang ingin diperbarui.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await UniversalExcelGradingService.executeImport({
        mode: currentConfig.importMode,
        existingSessionId: currentConfig.selectedExistingSessionId,
        sessionConfig: {
          sessionName: currentConfig.sessionName.trim() || `${currentConfig.examType} - ${currentConfig.subject} - ${currentConfig.className}`,
          teacherName: currentConfig.teacherName.trim() || defaultTeacher,
          subject: currentConfig.subject.trim(),
          className: currentConfig.className.trim(),
          examType: currentConfig.examType,
          academicYear: currentConfig.academicYear,
          semester: currentConfig.semester,
          kkm: currentConfig.kkm,
          format: currentConfig.examFormat,
        },
        rows: currentConfig.rows,
        currentUser,
      });

      onSuccess(
        res.session,
        `Berhasil mengimpor ${res.savedCount} nilai siswa ke sesi "${res.session.session_name}"!`
      );
      onClose();
    } catch (err: any) {
      setErrorMessage(`Gagal menyimpan sesi & nilai: ${err?.message || 'Error database'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Stats
  const matchStats = useMemo(() => {
    let exact = 0;
    let fuzzy = 0;
    let manual = 0;
    let unmatched = 0;

    currentConfig.rows.forEach((r) => {
      if (r.matchConfidence === 'EXACT') exact++;
      else if (r.matchConfidence === 'FUZZY') fuzzy++;
      else if (r.matchConfidence === 'MANUAL') manual++;
      else unmatched++;
    });

    return { exact, fuzzy, manual, unmatched, total: currentConfig.rows.length };
  }, [currentConfig.rows]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex sm:items-center sm:justify-center bg-slate-900/50 sm:backdrop-blur-xs animate-fadeIn p-0 sm:p-4">
      <div className="bg-white w-full h-dvh sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-2xl sm:border sm:border-slate-200 p-4 sm:p-6 shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 shadow-2xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Import Nilai dari Excel & Buat Sesi Otomatis
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Universal Mapper
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Deteksi otomatis mata pelajaran, kelas, dan nilai siswa langsung dari berkas Excel.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving || isParsing}
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* STEP 1: Upload File Zone */}
          {!selectedFile ? (
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 text-center transition-colors bg-slate-50/50 hover:bg-emerald-50/20">
              <Upload className="w-10 h-10 mx-auto text-emerald-600 mb-2" />
              <h4 className="text-sm font-bold text-slate-800 mb-1">
                Pilih atau Tarik Berkas Excel Nilai Siswa
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                Mendukung berkas resmi multi-sheet <strong>FORMAT PENILAIAN ASTS & ASAS.xlsx</strong> maupun tabel Excel sederhana (Nama Siswa, Nilai PG, Nilai Essay).
              </p>
              <label className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-2 cursor-pointer transition-colors">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Pilih Berkas Excel (.xlsx / .xls)</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate">
                    {selectedFile.name}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {parsedSheets.length} Sheet Terdeteksi
                  </span>
                </div>
              </div>
              <label className="text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer underline shrink-0">
                Ganti Berkas
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {isParsing && (
            <div className="text-center py-8 space-y-2">
              <RefreshCw className="w-8 h-8 mx-auto text-emerald-600 animate-spin" />
              <p className="text-xs font-bold text-slate-700">Sedang mendeteksi struktur tabel dan mencocokkan siswa...</p>
            </div>
          )}

          {/* If Sheets Detected */}
          {parsedSheets.length > 0 && !isParsing && (
            <div className="space-y-4">
              {/* Sheet Tabs if multi-sheet */}
              {parsedSheets.length > 1 && (
                <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 border-b border-slate-200">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-bold text-slate-500 mr-1 shrink-0">Pilih Sheet:</span>
                    {parsedSheets.map((sh, idx) => {
                      const cfg = sheetConfigs[idx];
                      const rowCount = cfg ? cfg.rows.length : sh.rows.length;
                      const isSelected = activeSheetIndex === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSheet(idx)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {sh.sheetName} ({rowCount} siswa)
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={handleApplySettingsToAllSheets}
                    title="Terapkan guru, mapel, jenis ujian, tahun ajaran, semester, dan format dari sheet ini ke seluruh sheet lainnya"
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Terapkan Pengaturan ke Semua Sheet</span>
                  </button>
                </div>
              )}

              {/* STEP 2: Configuration Target */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Konfigurasi Sesi Ujian Hasil Import
                  </span>
                  {/* Mode selector */}
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="importMode"
                        checked={currentConfig.importMode === 'CREATE_NEW'}
                        onChange={() => updateActiveConfig({ importMode: 'CREATE_NEW' })}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      Buat Sesi Baru
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="importMode"
                        checked={currentConfig.importMode === 'UPDATE_EXISTING'}
                        onChange={() => updateActiveConfig({ importMode: 'UPDATE_EXISTING' })}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      Isi ke Sesi yang Ada
                    </label>
                  </div>
                </div>

                {currentConfig.importMode === 'UPDATE_EXISTING' ? (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Pilih Sesi Ujian yang Sudah Ada
                    </label>
                    <select
                      value={currentConfig.selectedExistingSessionId}
                      onChange={(e) => updateActiveConfig({ selectedExistingSessionId: e.target.value })}
                      className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Pilih Sesi Ujian --</option>
                      {availableSessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.session_name} ({s.subject} - {s.class_name})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Nama Sesi Ujian</label>
                      <input
                        type="text"
                        value={currentConfig.sessionName}
                        onChange={(e) => updateActiveConfig({ sessionName: e.target.value, hasCustomSessionName: true })}
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="PTS - Matematika - 9A (2026/2027)"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-600">Mata Pelajaran</label>
                        {parsedSheets[activeSheetIndex]?.detectedSubject && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                            Auto Excel
                          </span>
                        )}
                      </div>
                      <select
                        value={currentConfig.subject}
                        onChange={(e) => {
                          const newSubject = e.target.value;
                          updateActiveConfig((prev) => ({
                            subject: newSubject,
                            ...(!prev.hasCustomSessionName
                              ? { sessionName: `${prev.examType} - ${newSubject} - ${prev.className} (${prev.academicYear})` }
                              : {}),
                          }));
                        }}
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {currentConfig.subject && !OFFICIAL_SCHOOL_SUBJECTS.some((s) => s.label === currentConfig.subject) && (
                          <option value={currentConfig.subject}>{currentConfig.subject} (Dari Excel)</option>
                        )}
                        {OFFICIAL_SCHOOL_SUBJECTS.map((s) => (
                          <option key={s.label} value={s.label}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-600">Guru Pengampu</label>
                        {parsedSheets[activeSheetIndex]?.detectedTeacher && (
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 font-bold px-1.5 py-0.2 rounded border border-indigo-200">
                            Auto Excel
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={currentConfig.teacherName}
                        onChange={(e) => updateActiveConfig({ teacherName: e.target.value })}
                        list="teacher-suggestions"
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Nama Guru Pengampu..."
                      />
                      <datalist id="teacher-suggestions">
                        {availableTeachers.map((t) => (
                          <option key={t.id} value={t.full_name} />
                        ))}
                      </datalist>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Kelas / Rombel</label>
                      <select
                        value={currentConfig.className}
                        onChange={(e) => {
                          const newClass = e.target.value;
                          updateActiveConfig((prev) => ({
                            className: newClass,
                            ...(!prev.hasCustomSessionName
                              ? { sessionName: `${prev.examType} - ${prev.subject} - ${newClass} (${prev.academicYear})` }
                              : {}),
                          }));
                        }}
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {availableClasses.map((cls) => (
                          <option key={cls} value={cls}>Kelas {cls}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Jenis Ujian</label>
                      <select
                        value={currentConfig.examType}
                        onChange={(e) => {
                          const newExamType = e.target.value;
                          updateActiveConfig((prev) => ({
                            examType: newExamType,
                            ...(!prev.hasCustomSessionName
                              ? { sessionName: `${newExamType} - ${prev.subject} - ${prev.className} (${prev.academicYear})` }
                              : {}),
                          }));
                        }}
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="PTS / UTS">PTS / UTS</option>
                        <option value="PAS / UAS">PAS / UAS</option>
                        <option value="Harian">Harian</option>
                        <option value="ASTS">ASTS</option>
                        <option value="ASAS">ASAS</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Tahun Ajaran</label>
                      <select
                        value={currentConfig.academicYear}
                        onChange={(e) => {
                          const newYear = e.target.value;
                          updateActiveConfig((prev) => ({
                            academicYear: newYear,
                            ...(!prev.hasCustomSessionName
                              ? { sessionName: `${prev.examType} - ${prev.subject} - ${prev.className} (${newYear})` }
                              : {}),
                          }));
                        }}
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="2026/2027">2026/2027 (Aktif)</option>
                        <option value="2025/2026">2025/2026</option>
                        <option value="2024/2025">2024/2025</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Semester</label>
                      <select
                        value={currentConfig.semester}
                        onChange={(e) => updateActiveConfig({ semester: e.target.value })}
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Ganjil">Semester Ganjil (1)</option>
                        <option value="Genap">Semester Genap (2)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Format Nilai</label>
                      <select
                        value={currentConfig.examFormat}
                        onChange={(e) => updateActiveConfig({ examFormat: e.target.value as any })}
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="PG_ONLY">Hanya PG (100%)</option>
                        <option value="PG_AND_ESSAY">PG (70%) + Essay (30%)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 3: Student Matching & Grade Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-800">
                      Pratinjau Nilai & Pencocokan Siswa ({matchStats.total} Siswa)
                    </span>
                    {parsedSheets[activeSheetIndex]?.detectedSubject && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-medium">
                        Mapel: <strong>{parsedSheets[activeSheetIndex].detectedSubject}</strong>
                      </span>
                    )}
                    {parsedSheets[activeSheetIndex]?.detectedTeacher && (
                      <span className="text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md font-medium">
                        Guru: <strong>{parsedSheets[activeSheetIndex].detectedTeacher}</strong>
                      </span>
                    )}
                    {parsedSheets[activeSheetIndex]?.detectedFormatDescription && (
                      <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-md font-medium">
                        {parsedSheets[activeSheetIndex].detectedFormatDescription}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] flex-wrap">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      {matchStats.exact} Cocok
                    </span>
                    {matchStats.fuzzy > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                        {matchStats.fuzzy} Mirip
                      </span>
                    )}
                    {matchStats.unmatched > 0 && (
                      <button
                        type="button"
                        onClick={handleClearUnmatchedRows}
                        title="Hapus semua baris yang belum cocok dengan database siswa"
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3 text-rose-600" />
                        <span>Hapus {matchStats.unmatched} Tak Cocok</span>
                      </button>
                    )}
                    {initialSheetsRef.current[activeSheetIndex] &&
                      currentConfig.rows.length !== initialSheetsRef.current[activeSheetIndex]?.rows.length && (
                      <button
                        type="button"
                        onClick={handleResetCurrentSheet}
                        title="Kembalikan semua baris semula dari sheet ini"
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-300 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-500" />
                        <span>Reset Baris</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">No</th>
                        <th className="py-2.5 px-3">Nama di Excel</th>
                        <th className="py-2.5 px-3">Siswa di Database Sekolah</th>
                        <th className="py-2.5 px-3 text-center w-20">Nilai PG</th>
                        <th className="py-2.5 px-3 text-center w-20">Essay / Esai</th>
                        <th className="py-2.5 px-3 text-center w-24">Skor Ujian</th>
                        <th className="py-2.5 px-2 text-center w-12">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentConfig.rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                            Semua baris telah dihapus. Klik &quot;Reset Baris&quot; untuk memulihkan.
                          </td>
                        </tr>
                      ) : (
                        currentConfig.rows.map((r, idx) => {
                          const isPass = r.finalScore >= currentConfig.kkm;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/80 group">
                              <td className="py-2 px-3 text-center font-mono text-slate-500">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                {r.rawName}
                              </td>
                              <td className="py-2 px-3">
                                <select
                                  value={r.matchedStudentId || ''}
                                  onChange={(e) => handleUpdateStudentMatch(idx, e.target.value)}
                                  className={`w-full text-xs font-medium rounded-lg px-2 py-1 border transition-colors ${
                                    r.matchConfidence === 'EXACT'
                                      ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950 font-semibold'
                                      : r.matchConfidence === 'FUZZY'
                                      ? 'border-amber-300 bg-amber-50/40 text-amber-950'
                                      : 'border-slate-300 bg-white text-slate-700'
                                  }`}
                                >
                                  <option value="">-- Belum Cocok (Buat Akun Siswa Baru) --</option>
                                  {r.matchedStudentId && !classCandidates.some((c) => c.id === r.matchedStudentId) && (
                                    <option value={r.matchedStudentId}>
                                      {r.matchedStudentName || 'Siswa Terpilih'}
                                    </option>
                                  )}
                                  {classCandidates.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.fullName}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                                {r.pgScore !== null ? r.pgScore : '-'}
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                                {r.essayScore !== null ? r.essayScore : '-'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                                  isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                                }`}>
                                  {r.finalScore}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRow(idx)}
                                  title={`Hapus baris "${r.rawName}" dari import`}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3.5 border-t border-slate-200 shrink-0">
          <span className="text-xs text-slate-500">
            {parsedSheets.length > 0 ? `${currentConfig.rows.length} siswa siap diimpor` : 'Pilih berkas Excel untuk memulai'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer min-h-10"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={parsedSheets.length === 0 || currentConfig.rows.length === 0 || isSaving}
              onClick={handleExecuteImport}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer min-h-10"
            >
              <CheckCircle2 className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Menyimpan Sesi & Nilai...' : 'Buat Sesi & Simpan Nilai'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
