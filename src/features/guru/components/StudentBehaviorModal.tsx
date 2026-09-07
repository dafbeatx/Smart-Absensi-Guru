import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  StudentBehaviorRecord,
  StudentBehaviorLog,
  GradeMasterBehaviorCategory,
} from '../../../types/database.types';
import {
  StudentBehaviorRepository,
  BEHAVIORS_UPDATED_EVENT,
  GRADEMASTER_KEBAIKAN_PRESETS,
  GRADEMASTER_PELANGGARAN_PRESETS,
} from '../../../repositories/StudentBehaviorRepository';
import {
  Sparkles,
  AlertTriangle,
  History,
  Search,
  X,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  UserCheck,
  RotateCcw,
  Star,
  Award,
} from 'lucide-react';

export type BehaviorModalTab = 'KEBAIKAN' | 'KEDISIPLINAN' | 'RIWAYAT';

interface StudentBehaviorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: BehaviorModalTab;
  currentTeacherName?: string;
}

export const StudentBehaviorModal: React.FC<StudentBehaviorModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'KEBAIKAN',
  currentTeacherName = 'Guru',
}) => {
  const [activeTab, setActiveTab] = useState<BehaviorModalTab>(initialTab);
  const [students, setStudents] = useState<StudentBehaviorRecord[]>([]);
  const [categories, setCategories] = useState<{
    kebaikan: GradeMasterBehaviorCategory[];
    pelanggaran: GradeMasterBehaviorCategory[];
  }>({
    kebaikan: GRADEMASTER_KEBAIKAN_PRESETS,
    pelanggaran: GRADEMASTER_PELANGGARAN_PRESETS,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<StudentBehaviorRecord | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [pointsAmount, setPointsAmount] = useState<number>(5);
  const [customPointsInput, setCustomPointsInput] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load official GradeMaster OS categories
  const loadCategories = useCallback(async () => {
    try {
      const cats = await StudentBehaviorRepository.getCategories();
      if (cats?.kebaikan && cats?.pelanggaran) {
        setCategories(cats);
      }
    } catch (err) {
      console.warn('Gagal memuat kategori resmi GradeMaster OS:', err);
    }
  }, []);

  // Load student behaviors
  const loadBehaviors = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await StudentBehaviorRepository.getBehaviors('ALL', '2026/2027');
      setStudents(data || []);
    } catch (err) {
      console.warn('Gagal memuat data perilaku siswa:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadBehaviors();
      loadCategories();
      setActiveTab(initialTab);
      setSuccessMessage(null);
      setErrorMessage(null);
      setSelectedStudent(null);
      setSelectedReason('');
      setCustomReason('');
      setPointsAmount(initialTab === 'KEDISIPLINAN' ? -5 : 5);
      setCustomPointsInput('');
    }
  }, [isOpen, initialTab, loadBehaviors, loadCategories]);

  useEffect(() => {
    const handleUpdated = () => {
      loadBehaviors();
    };

    window.addEventListener(BEHAVIORS_UPDATED_EVENT, handleUpdated);
    window.addEventListener('storage', handleUpdated);

    return () => {
      window.removeEventListener(BEHAVIORS_UPDATED_EVENT, handleUpdated);
      window.removeEventListener('storage', handleUpdated);
    };
  }, [loadBehaviors]);

  // Handle Tab Switch
  const handleTabChange = (tab: BehaviorModalTab) => {
    setActiveTab(tab);
    setSuccessMessage(null);
    setErrorMessage(null);
    setSelectedReason('');
    setCustomReason('');
    if (tab === 'KEBAIKAN') {
      setPointsAmount(5);
      setCustomPointsInput('');
    } else if (tab === 'KEDISIPLINAN') {
      setPointsAmount(-5);
      setCustomPointsInput('');
    }
  };

  // Derive unique classes
  const classOptions = useMemo(() => {
    const classes = Array.from(new Set(students.map((s) => s.class_name).filter(Boolean))).sort();
    return ['ALL', ...classes];
  }, [students]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchClass = selectedClass === 'ALL' || s.class_name === selectedClass;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        s.student_name.toLowerCase().includes(q) ||
        s.class_name.toLowerCase().includes(q);
      return matchClass && matchQuery;
    });
  }, [students, selectedClass, searchQuery]);

  // All behavior logs across students for History Tab
  const allLogs = useMemo(() => {
    const logs: Array<StudentBehaviorLog & { student_name: string; class_name: string }> = [];
    students.forEach((s) => {
      if (Array.isArray(s.behavior_logs)) {
        s.behavior_logs.forEach((log) => {
          logs.push({
            ...log,
            student_name: s.student_name,
            class_name: s.class_name,
          });
        });
      }
    });

    return logs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [students]);

  // Submit Behavior Point
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      setErrorMessage('Pilih siswa terlebih dahulu.');
      return;
    }

    const finalReason = selectedReason === 'CUSTOM' ? customReason.trim() : selectedReason.trim();
    if (!finalReason) {
      setErrorMessage('Tentukan alasan pemberian poin atau ketik alasan kustom.');
      return;
    }

    let finalPoints = pointsAmount;
    if (customPointsInput.trim() !== '') {
      const parsed = parseInt(customPointsInput, 10);
      if (!isNaN(parsed) && parsed !== 0) {
        finalPoints = activeTab === 'KEDISIPLINAN' ? -Math.abs(parsed) : Math.abs(parsed);
      }
    }

    if (finalPoints === 0) {
      setErrorMessage('Jumlah poin tidak boleh 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await StudentBehaviorRepository.recordBehavior({
        studentName: selectedStudent.student_name,
        className: selectedStudent.class_name,
        type: activeTab === 'KEBAIKAN' ? 'GOOD' : 'BAD',
        points: finalPoints,
        reason: finalReason,
        teacherName: currentTeacherName,
        academicYear: selectedStudent.academic_year || '2026/2027',
      });

      if (result.success) {
        setSuccessMessage(
          `Sukses! ${finalPoints > 0 ? '+' : ''}${finalPoints} poin tercatat untuk ${selectedStudent.student_name}. Saldo total: ${result.newTotal} poin.`
        );

        // Voice notification feedback
        try {
          if ('speechSynthesis' in window) {
            const speech = new SpeechSynthesisUtterance(
              `Poin ${activeTab === 'KEBAIKAN' ? 'kebaikan' : 'kedisiplinan'} berhasil dicatat untuk ${selectedStudent.student_name}`
            );
            speech.lang = 'id-ID';
            speech.rate = 1.05;
            window.speechSynthesis.speak(speech);
          }
        } catch {
          // ignore
        }

        // Update selected student point balance in local view
        setSelectedStudent((prev) =>
          prev ? { ...prev, total_points: result.newTotal } : null
        );

        // Reset inputs
        setSelectedReason('');
        setCustomReason('');
        setCustomPointsInput('');
        await loadBehaviors();
      } else {
        setErrorMessage(result.message || 'Gagal menyimpan poin siswa.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs shrink-0 ${
                activeTab === 'KEBAIKAN'
                  ? 'bg-emerald-600'
                  : activeTab === 'KEDISIPLINAN'
                  ? 'bg-rose-600'
                  : 'bg-cyan-700'
              }`}
            >
              {activeTab === 'KEBAIKAN' ? (
                <Sparkles className="w-5 h-5 text-amber-300" />
              ) : activeTab === 'KEDISIPLINAN' ? (
                <AlertTriangle className="w-5 h-5 text-amber-200" />
              ) : (
                <History className="w-5 h-5 text-cyan-200" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-white leading-tight truncate">
                {activeTab === 'KEBAIKAN'
                  ? 'Poin Kebaikan Siswa'
                  : activeTab === 'KEDISIPLINAN'
                  ? 'Poin Kedisiplinan Siswa'
                  : 'Riwayat Log Poin Siswa'}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <p className="text-[11px] text-cyan-200/90 font-medium truncate">
                  Sinkron Real-Time ke GradeMaster OS
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher (Segmented Control) */}
        <div className="p-3 bg-slate-100/90 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-2xl border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => handleTabChange('KEBAIKAN')}
              className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'KEBAIKAN'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Kebaikan</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('KEDISIPLINAN')}
              className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'KEDISIPLINAN'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-rose-700 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Kedisiplinan</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('RIWAYAT')}
              className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'RIWAYAT'
                  ? 'bg-[#023246] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#023246] hover:bg-slate-50'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Notification Alerts */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-start gap-2.5 text-xs font-semibold animate-fadeIn shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{successMessage}</p>
                <a
                  href="https://web-input-nilai-dafbeatxs-projects-0222ca64.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-700 font-bold underline mt-1 text-[11px] hover:text-emerald-900"
                >
                  Lihat update di GradeMaster OS <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl flex items-start gap-2.5 text-xs font-semibold animate-fadeIn shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="flex-1">{errorMessage}</p>
            </div>
          )}

          {/* TAB 1 & 2: FORM PEMBERIAN POIN */}
          {activeTab !== 'RIWAYAT' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 1. SELEKSI SISWA */}
              <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#023246]" />
                    1. Pilih Siswa Target
                  </label>
                  {selectedStudent && (
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(null)}
                      className="text-[11px] font-bold text-cyan-700 hover:text-cyan-900 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Ganti Siswa
                    </button>
                  )}
                </div>

                {/* Selected Student Active Card */}
                {selectedStudent ? (
                  <div className="bg-white rounded-xl p-3 border-2 border-[#023246]/20 flex items-center justify-between shadow-2xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-[#023246] text-white rounded-md">
                          Kelas {selectedStudent.class_name}
                        </span>
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                          {selectedStudent.student_name}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tahun Ajaran: {selectedStudent.academic_year || '2026/2027'}
                      </p>
                    </div>
                    <div className="text-right shrink-0 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-200">
                      <div className="flex items-center gap-1 text-amber-700 font-extrabold text-xs sm:text-sm">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>{selectedStudent.total_points} Poin</span>
                      </div>
                      <span className="text-[9px] font-semibold text-amber-700/80 block uppercase">
                        Saldo Saat Ini
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Class Filter Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {classOptions.map((cls) => (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => setSelectedClass(cls)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                            selectedClass === cls
                              ? 'bg-[#023246] text-white shadow-2xs'
                              : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
                          }`}
                        >
                          {cls === 'ALL' ? 'Semua Kelas' : `Kelas ${cls}`}
                        </button>
                      ))}
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari nama siswa..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#023246]/20"
                      />
                    </div>

                    {/* Student List Picker */}
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 bg-white rounded-xl border border-slate-200 p-1.5">
                      {isLoading ? (
                        <div className="p-4 text-center text-xs text-slate-400 animate-pulse">
                          Memuat daftar siswa dari Supabase...
                        </div>
                      ) : filteredStudents.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          Tidak ditemukan siswa pada filter ini.
                        </div>
                      ) : (
                        filteredStudents.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedStudent(s);
                              setSuccessMessage(null);
                            }}
                            className="w-full p-2 hover:bg-slate-50 active:bg-slate-100 rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer group"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-bold text-slate-800 group-hover:text-[#023246] truncate">
                                {s.student_name}
                              </p>
                              <span className="text-[10px] font-semibold text-slate-500">
                                Kelas {s.class_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                                ⭐ {s.total_points}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. PILIHAN KATEGORI ALASAN (GRADEMASTER OS) */}
              <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-[#023246]" />
                    2. Pilih Kategori & Poin GradeMaster OS
                  </label>
                  <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                    Otomatis Berbobot
                  </span>
                </div>

                {/* Preset Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(activeTab === 'KEBAIKAN' ? categories.kebaikan : categories.pelanggaran).map((p) => {
                    const isSelected = selectedReason === p.text;
                    const pointVal = p.isGood ? p.weight : -p.weight;
                    return (
                      <button
                        key={p.text}
                        type="button"
                        onClick={() => {
                          setSelectedReason(p.text);
                          setPointsAmount(pointVal);
                          setCustomPointsInput('');
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer min-h-11 ${
                          isSelected
                            ? activeTab === 'KEBAIKAN'
                              ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-2xs'
                              : 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="text-base shrink-0">{p.icon || (p.isGood ? '✨' : '⚠️')}</span>
                          <span className="text-xs font-bold text-slate-800 leading-snug">
                            {p.text}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-black px-2 py-0.5 rounded-lg shrink-0 ${
                            p.isGood
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {p.isGood ? `+${p.weight}` : `-${p.weight}`}
                        </span>
                      </button>
                    );
                  })}

                  {/* Custom Reason Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReason('CUSTOM');
                      if (!pointsAmount || pointsAmount === 0) {
                        setPointsAmount(activeTab === 'KEBAIKAN' ? 5 : -5);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer min-h-11 col-span-1 sm:col-span-2 ${
                      selectedReason === 'CUSTOM'
                        ? 'bg-cyan-50 border-cyan-600 ring-2 ring-cyan-600/20 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base shrink-0">✍️</span>
                      <span className="text-xs font-bold text-slate-800">
                        {activeTab === 'KEBAIKAN'
                          ? 'Tulis Kebaikan Khusus (Manual)'
                          : 'Tulis Pelanggaran Khusus (Manual)'}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-md">
                      Khusus
                    </span>
                  </button>
                </div>

                {/* Custom Reason Text Input */}
                {selectedReason === 'CUSTOM' && (
                  <div className="space-y-1.5 pt-1 animate-fadeIn">
                    <input
                      type="text"
                      placeholder={
                        activeTab === 'KEBAIKAN'
                          ? 'Tulis kebaikan khusus...'
                          : 'Tulis pelanggaran khusus...'
                      }
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#023246]/20"
                      required
                    />
                  </div>
                )}
              </div>

              {/* 3. PENYESUAIAN JUMLAH POIN */}
              <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-[#023246]" />
                      3. Nilai Bobot Poin
                    </label>
                    <span className="text-[10px] text-slate-500 block">
                      {selectedReason && selectedReason !== 'CUSTOM'
                        ? 'Terkunci otomatis sesuai bobot GradeMaster OS'
                        : 'Tentukan bobot poin untuk siswa'}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-black px-2.5 py-1 rounded-xl shadow-2xs ${
                      pointsAmount > 0
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {pointsAmount > 0 ? `+${pointsAmount}` : pointsAmount} Poin
                  </span>
                </div>

                {/* Tombol Cepat Sesuai Bobot Standar GradeMaster OS */}
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                  {(activeTab === 'KEBAIKAN' ? [5, 10, 15, 20, 25] : [-5, -10, -15, -25, -30]).map(
                    (num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setPointsAmount(num);
                          setCustomPointsInput('');
                        }}
                        className={`py-2 text-xs font-black rounded-xl border transition-all cursor-pointer min-h-10 ${
                          pointsAmount === num && customPointsInput === ''
                            ? activeTab === 'KEBAIKAN'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {num > 0 ? `+${num}` : num}
                      </button>
                    )
                  )}
                </div>

                {/* Custom Point Input */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-600 shrink-0">
                    Bobot Lain:
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="Ketik angka poin..."
                    value={customPointsInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomPointsInput(val);
                      const parsed = parseInt(val, 10);
                      if (!isNaN(parsed) && parsed > 0) {
                        setPointsAmount(activeTab === 'KEDISIPLINAN' ? -parsed : parsed);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#023246]/20"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !selectedStudent}
                className={`w-full h-11 sm:h-12 rounded-2xl text-xs sm:text-sm font-extrabold text-white shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeTab === 'KEBAIKAN'
                    ? 'bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 shadow-emerald-700/20'
                    : 'bg-linear-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 shadow-rose-700/20'
                }`}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    {activeTab === 'KEBAIKAN' ? (
                      <Sparkles className="w-4 h-4 text-amber-300" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-200" />
                    )}
                    <span>
                      {activeTab === 'KEBAIKAN'
                        ? `Berikan ${pointsAmount > 0 ? `+${pointsAmount}` : pointsAmount} Poin Kebaikan`
                        : `Catat ${pointsAmount > 0 ? `+${pointsAmount}` : pointsAmount} Poin Kedisiplinan`}
                    </span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: RIWAYAT LOG POIN */}
          {activeTab === 'RIWAYAT' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Total {allLogs.length} Catatan Log Mutasi
                </span>
                <a
                  href="https://web-input-nilai-dafbeatxs-projects-0222ca64.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-[#023246] hover:underline flex items-center gap-1"
                >
                  GradeMaster OS <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
                  Memuat riwayat log poin siswa dari database...
                </div>
              ) : allLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-600">Belum ada riwayat poin siswa.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Poin kebaikan atau kedisiplinan yang diberikan akan muncul di sini.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {allLogs.map((log, idx) => {
                    const isGood = log.type === 'GOOD';
                    const dateFormatted = new Date(log.timestamp).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={`${log.student_name}-${log.timestamp}-${idx}`}
                        className="bg-slate-50 hover:bg-slate-100/80 p-3 rounded-2xl border border-slate-200/80 flex items-start justify-between gap-2.5 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 text-[9px] font-black rounded-md ${
                                isGood ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isGood ? 'KEBAIKAN' : 'PELANGGARAN'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              Kelas {log.class_name}
                            </span>
                          </div>
                          <h4 className="text-xs font-extrabold text-slate-900 mt-0.5 truncate">
                            {log.student_name}
                          </h4>
                          <p className="text-xs text-slate-700 font-medium mt-1 leading-snug">
                            {log.reason}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 font-medium">
                            <span>{dateFormatted}</span>
                            {log.recordedBy && <span>• Oleh: {log.recordedBy}</span>}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-xs sm:text-sm font-black px-2 py-1 rounded-xl block ${
                              isGood
                                ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-500/10 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {log.points > 0 ? `+${log.points}` : log.points}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Info Sync */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center shrink-0">
          <p className="text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Tersinkronisasi 100% dua arah dengan tabel <code className="text-[#023246] font-mono">public.gm_behaviors</code>
          </p>
        </div>
      </div>
    </div>
  );
};
