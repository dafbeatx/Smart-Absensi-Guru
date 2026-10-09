import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  WeeklySurveySummary,
  SurveyHypothesisResult,
  SurveyIndicatorSummary,
  SurveyAnonymousEvaluation,
  SurveyActionSolution,
} from '../../../types/database.types';
import { ResearchSurveyService } from '../../../services/research-survey.service';
import { getTodayDateInJakarta } from '../../../utils/time.utils';
import {
  BarChart3,
  TrendingUp,
  Lightbulb,
  ShieldCheck,
  Users,
  Printer,
  FileText,
  Award,
  Calendar,
  Sparkles,
  ChevronRight,
  Filter,
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

export interface SurveyAnalyticsViewProps {
  onBack: () => void;
  backLabel?: string;
  layoutMode?: 'mobile' | 'desktop';
  className?: string;
}

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

// Terjemahan ramah untuk orang awam & guru
const HUMAN_INDICATOR_LABELS: Record<string, { title: string; subtitle: string; icon: string }> = {
  q1_usefulness: {
    title: 'Manfaat & Kegunaan Sehari-hari',
    subtitle: 'Membantu tugas guru, presensi lebih cepat, dan data tersimpan rapi',
    icon: '💼',
  },
  q2_motivation: {
    title: 'Semangat & Motivasi Kehadiran',
    subtitle: 'Mendorong hadir tepat waktu dan semangat mengajar setiap pagi',
    icon: '⚡',
  },
  q3_ease_of_use: {
    title: 'Kemudahan Pemakaian Aplikasi',
    subtitle: 'Menu mudah dipahami, scan QR dan sidik jari lancar tanpa kendala',
    icon: '📱',
  },
  q4_fairness: {
    title: 'Keadilan & Kejujuran Data Absensi',
    subtitle: 'Catatan jam masuk dan pulang transparan, aman, dan tidak memihak',
    icon: '⚖️',
  },
  q5_impact: {
    title: 'Dampak Budaya Disiplin Sekolah',
    subtitle: 'Membangun kebiasaan disiplin positif bagi seluruh warga sekolah',
    icon: '🏫',
  },
};

export const SurveyAnalyticsView: React.FC<SurveyAnalyticsViewProps> = ({
  onBack,
  backLabel = 'Kembali ke Beranda',
  className = '',
}) => {
  const todayStr = getTodayDateInJakarta();
  const dateObj = new Date(todayStr);
  const currentMonth = isNaN(dateObj.getTime()) ? new Date().getMonth() + 1 : dateObj.getMonth() + 1;
  const currentYear = isNaN(dateObj.getTime()) ? new Date().getFullYear() : dateObj.getFullYear();

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [summary, setSummary] = useState<WeeklySurveySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'CHARTS' | 'SOLUTIONS' | 'HYPOTHESIS' | 'FEEDBACK'>('CHARTS');
  const [solutionRoleFilter, setSolutionRoleFilter] = useState<'SEMUA' | 'KEPSEK' | 'ADMIN' | 'GURU'>('SEMUA');
  const [selectedDistributionQuestion, setSelectedDistributionQuestion] = useState<string>('overall');
  const [isPrinting, setIsPrinting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await ResearchSurveyService.getMonthlySummary(selectedMonth, selectedYear);
      setSummary(data);
    } catch (err) {
      console.warn('Gagal memuat rekapitulasi survei:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter rencana solusi berdasarkan peran
  const filteredSolutions = useMemo(() => {
    if (!summary?.solutions) return [];
    if (solutionRoleFilter === 'SEMUA') return summary.solutions;
    return summary.solutions.filter(
      (sol: SurveyActionSolution) => sol.forRole === solutionRoleFilter || sol.forRole === 'SEMUA'
    );
  }, [summary?.solutions, solutionRoleFilter]);

  // Identifikasi bagian paling disukai vs bagian yang perlu ditingkatkan
  const indicatorDiagnosis = useMemo(() => {
    if (!summary || summary.totalRespondents === 0) return null;
    const entries = Object.entries(summary.indicators) as [string, SurveyIndicatorSummary][];
    if (entries.length === 0) return null;

    const sorted = [...entries].sort((a, b) => b[1].mean - a[1].mean);
    const top = sorted[0];
    const lowest = sorted[sorted.length - 1];

    const topMeta = HUMAN_INDICATOR_LABELS[top[0]] || {
      title: top[1].title,
      subtitle: '',
      icon: '⭐',
    };
    const lowestMeta = HUMAN_INDICATOR_LABELS[lowest[0]] || {
      title: lowest[1].title,
      subtitle: '',
      icon: '🎯',
    };

    return {
      topKey: top[0],
      topIndicator: top[1],
      topMeta,
      lowestKey: lowest[0],
      lowestIndicator: lowest[1],
      lowestMeta,
    };
  }, [summary]);

  const handlePrintSolutions = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 250);
  };

  return (
    <div className={`space-y-4 pb-12 w-full max-w-4xl mx-auto px-1 sm:px-0 ${className}`}>
      {/* ── TOP NAV BAR: TOMBOL KEMBALI & INDIKATOR LAYER ─── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            onBack();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl sm:rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 text-xs sm:text-sm font-bold text-[#023246] transition-all cursor-pointer min-h-11"
        >
          <ArrowLeft className="w-4 h-4 text-[#023246]" />
          <span>{backLabel}</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/70">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            100% Rahasia &amp; Anonim
          </span>
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider px-1">
            Layer Suara Pendidik
          </span>
        </div>
      </div>

      {/* ── HERO BANNER: JUDUL RAMAH & PENJELASAN UNTUK ORANG AWAM ─── */}
      <div className="bg-linear-to-r from-[#023246] via-[#0A4158] to-[#18536B] rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-sm space-y-3 border border-[#287094]/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <BarChart3 className="w-3.5 h-3.5" />
                Hasil Survei Mingguan Dewan Guru
              </span>
              <span className="sm:hidden inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-200">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                100% Anonim
              </span>
            </div>
            <h1 className="text-base sm:text-xl font-black text-white tracking-tight">
              Suara Guru, Tingkat Kepuasan &amp; Rencana Solusi Sekolah
            </h1>
          </div>

          <button
            type="button"
            onClick={handlePrintSolutions}
            disabled={isPrinting}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold border border-white/20 transition-all cursor-pointer min-h-10"
            title="Cetak Laporan Rencana Aksi untuk Rapat Dewan Guru"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isPrinting ? 'Mempersiapkan...' : 'Cetak Rekap (PDF)'}</span>
          </button>
        </div>

        <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed max-w-3xl">
          Ringkasan kuesioner berkala dari seluruh guru untuk mengetahui apakah aplikasi presensi benar-benar mempermudah tugas, mendengarkan saran rekan pendidik secara rahasia, serta merancang tindakan nyata perbaikan sekolah.
        </p>

        {/* Jaminan Privasi Ramah */}
        <div className="pt-2.5 border-t border-white/15 flex items-start sm:items-center gap-2.5 text-[11px] sm:text-xs text-slate-300 bg-white/5 p-2.5 sm:p-3 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong>Jaminan Privasi Penuh:</strong> Seluruh nilai dan masukan dihitung secara statistik murni. Nama, NPP, dan identitas HP Anda <strong>tidak pernah disimpan maupun diperlihatkan</strong> kepada siapapun.
          </span>
        </div>
      </div>

      {/* ── FILTER PERIODE & TAB NAVIGASI UTAMA ─── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3">
        {/* Baris Periode */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Pilih Periode:
            </span>
            <select
              id="select-survey-month-view"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#287094] cursor-pointer min-h-10"
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  Bulan {m}
                </option>
              ))}
            </select>

            <select
              id="select-survey-year-view"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#287094] cursor-pointer min-h-10"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
            </select>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            Periode Aktif: <strong>{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</strong>
          </div>
        </div>

        {/* 4 Tab Navigasi Bahasa Sederhana */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl sm:rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('CHARTS')}
            className={`py-2 px-2.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-11 ${
              activeTab === 'CHARTS'
                ? 'bg-white text-slate-900 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="truncate">1. Grafik Kepuasan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SOLUTIONS')}
            className={`py-2 px-2.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-11 ${
              activeTab === 'SOLUTIONS'
                ? 'bg-white text-slate-900 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="truncate">2. Solusi Sekolah</span>
            {summary?.solutions && summary.solutions.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black shrink-0">
                {summary.solutions.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HYPOTHESIS')}
            className={`py-2 px-2.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-11 ${
              activeTab === 'HYPOTHESIS'
                ? 'bg-white text-slate-900 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span className="truncate">3. Bukti Manfaat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('FEEDBACK')}
            className={`py-2 px-2.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-11 ${
              activeTab === 'FEEDBACK'
                ? 'bg-white text-slate-900 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">4. Suara Guru</span>
            {summary?.evaluations && summary.evaluations.length > 0 && (
              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full text-[10px] font-black shrink-0">
                {summary.evaluations.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── KONTEN UTAMA LAYER ─── */}
      {isLoading ? (
        <div className="bg-white rounded-3xl p-12 text-center space-y-3 border border-slate-200">
          <div className="w-10 h-10 border-4 border-[#287094] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-600">Menghitung grafik kepuasan dan saran rekan guru...</p>
        </div>
      ) : !summary || summary.totalRespondents === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center space-y-3 border border-slate-200 shadow-xs">
          <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center text-3xl mx-auto shadow-inner">
            📋
          </div>
          <h3 className="text-base font-extrabold text-slate-800">
            Belum Ada Pengisian Survei pada Periode Ini
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Kuesioner mingguan diisi secara rutin setiap hari Jumat oleh rekan guru untuk mengevaluasi pemakaian aplikasi di bulan{' '}
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setSelectedMonth(currentMonth);
                setSelectedYear(currentYear);
              }}
              className="px-4 py-2 bg-[#023246] text-white text-xs font-bold rounded-xl hover:bg-[#18536B] transition-all cursor-pointer"
            >
              Lihat Bulan Berjalan Ini ({MONTH_NAMES[currentMonth - 1]} {currentYear})
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── 4 KARTU RINGKASAN CEPAT (KPI SEHARI-HARI) ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Total Responden */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                Rekan Guru Mengisi
              </span>
              <p className="text-2xl sm:text-3xl font-black text-slate-900">
                {summary.totalRespondents} <span className="text-xs font-bold text-slate-500">Guru</span>
              </p>
              <p className="text-[10px] text-slate-500 font-medium truncate">
                Guru: {summary.roleBreakdown.guru} • Staf: {summary.roleBreakdown.admin} • KS: {summary.roleBreakdown.kepsek}
              </p>
            </div>

            {/* Indeks Kepuasan Rerata */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-2xs space-y-1">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Nilai Kepuasan Rerata
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-emerald-700">
                  {summary.overallMean.toFixed(2)}
                </span>
                <span className="text-xs font-bold text-emerald-600">/ 5.00</span>
              </div>
              <p className="text-[10px] font-extrabold text-emerald-700 truncate">
                {summary.overallMean >= 4.0 ? 'Kategori: Sangat Memuaskan' : 'Kategori: Baik / Cukup'}
              </p>
            </div>

            {/* Bukti Manfaat Nyata */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-purple-200 bg-purple-50/40 shadow-2xs space-y-1">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-purple-800 uppercase tracking-wider flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-purple-600" />
                Bukti Manfaat
              </span>
              <p className="text-2xl sm:text-3xl font-black text-purple-700">
                {summary.hypotheses.filter((h: SurveyHypothesisResult) => h.isConfirmed).length} / 3
              </p>
              <p className="text-[10px] font-extrabold text-purple-700 truncate">
                {summary.hypotheses.every((h: SurveyHypothesisResult) => h.isConfirmed)
                  ? 'Semua Terbukti Membantu'
                  : 'Dalam Pemantauan'}
              </p>
            </div>

            {/* Rencana Solusi Sekolah */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-2xs space-y-1">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                Rencana Solusi
              </span>
              <p className="text-2xl sm:text-3xl font-black text-amber-700">
                {summary.solutions ? summary.solutions.length : 4} <span className="text-xs font-bold text-amber-600">Aksi</span>
              </p>
              <p className="text-[10px] font-extrabold text-amber-700 truncate">
                Langkah Nyata Perbaikan
              </p>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              TAB 1: GRAFIK TINGKAT KEPUASAN GURU TERHADAP APLIKASI
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'CHARTS' && (
            <div className="space-y-4 animate-fade-in">
              {/* Diagnosa Singkat: Hal Paling Disukai vs Bagian yang Perlu Ditingkatkan */}
              {indicatorDiagnosis && (
                <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm space-y-3 border border-slate-800">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#287094] text-white">
                      Ringkasan Evaluasi Otomatis
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Standar Nilai Hijau Sekolah: <strong>≥ 3.80 dari 5.00</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                    {/* Yang paling diapresiasi */}
                    <div className="bg-slate-800/90 p-3.5 rounded-xl border border-slate-700/80 space-y-1">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <span>⭐</span> Paling Disukai &amp; Diapresiasi Rekan Guru
                      </p>
                      <h4 className="font-extrabold text-white text-xs sm:text-sm">
                        {indicatorDiagnosis.topMeta.title}
                      </h4>
                      <p className="text-[11px] text-slate-300">
                        {indicatorDiagnosis.topMeta.subtitle}
                      </p>
                      <div className="pt-1 text-[11px] text-emerald-300 font-bold">
                        Rerata: {indicatorDiagnosis.topIndicator.mean.toFixed(2)} / 5.00 ({indicatorDiagnosis.topIndicator.positivePercentage}% Respon Positif)
                      </div>
                    </div>

                    {/* Yang perlu ditingkatkan */}
                    <div className="bg-slate-800/90 p-3.5 rounded-xl border border-slate-700/80 space-y-1">
                      <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <span>🎯</span> Bagian yang Terus Ditingkatkan
                      </p>
                      <h4 className="font-extrabold text-white text-xs sm:text-sm">
                        {indicatorDiagnosis.lowestMeta.title}
                      </h4>
                      <p className="text-[11px] text-slate-300">
                        {indicatorDiagnosis.lowestMeta.subtitle}
                      </p>
                      <div className="pt-1 text-[11px] text-amber-300 font-bold">
                        Rerata: {indicatorDiagnosis.lowestIndicator.mean.toFixed(2)} / 5.00 — Disiapkan langkah perbaikan di Tab Solusi
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* GRAFIK 1: 5 Dimensi Evaluasi Utama */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-[#023246]" />
                      Grafik Nilai Kepuasan Guru pada 5 Aspek Utama
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Perbandingan hasil penilaian guru dengan batas standar target sekolah (3.80 / 5.00)
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-bold self-start sm:self-auto">
                    <span className="flex items-center gap-1 text-emerald-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                      Nilai Capaian
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <span className="w-2.5 h-0.5 bg-slate-400" />
                      Target Sekolah (3.80)
                    </span>
                  </div>
                </div>

                <div className="space-y-3.5 pt-1">
                  {(Object.entries(summary.indicators) as [string, SurveyIndicatorSummary][]).map(([key, ind]) => {
                    const meta = HUMAN_INDICATOR_LABELS[key] || {
                      title: ind.title,
                      subtitle: '',
                      icon: '📌',
                    };
                    const percent = Math.min(100, (ind.mean / 5) * 100);
                    const targetPercent = (3.8 / 5) * 100;
                    const isExceeding = ind.mean >= 3.8;

                    return (
                      <div
                        key={key}
                        className="space-y-1.5 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <div>
                            <span className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                              <span>{meta.icon}</span>
                              <span>{meta.title}</span>
                            </span>
                            {meta.subtitle && (
                              <p className="text-[11px] text-slate-500 font-medium pl-6">
                                {meta.subtitle}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 pl-6 sm:pl-0">
                            <span
                              className={`text-xs font-black px-2.5 py-0.5 rounded-lg border ${
                                isExceeding
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {ind.mean.toFixed(2)} / 5.00
                            </span>
                            <span className="text-[11px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                              {ind.positivePercentage}% Guru Puas
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar dengan Penanda Target 3.80 */}
                        <div className="relative w-full bg-slate-200/90 h-3.5 rounded-full overflow-hidden mt-1">
                          {/* Garis batas 3.80 */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-slate-600 z-10"
                            style={{ left: `${targetPercent}%` }}
                            title="Target Standar Baik (3.80)"
                          />
                          {/* Nilai Rerata */}
                          <div
                            className={`h-full transition-all duration-700 rounded-full ${
                              isExceeding
                                ? 'bg-linear-to-r from-emerald-600 to-teal-500'
                                : 'bg-linear-to-r from-amber-500 to-yellow-400'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* GRAFIK 2: Sebaran Pilihan Bintang (1 s.d. 5 Bintang) */}
              {summary.distribution && (
                <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-emerald-700" />
                        Pilihan Bintang dari Rekan Guru (Bintang 1 s.d. 5)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Sebaran persentase jawaban dari Bintang 1 (Sangat Kurang) hingga Bintang 5 (Sangat Puas)
                      </p>
                    </div>

                    {/* Filter Pertanyaan */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <label htmlFor="select-dist-view-q" className="font-bold text-slate-600 text-[11px]">
                        Aspek:
                      </label>
                      <select
                        id="select-dist-view-q"
                        value={selectedDistributionQuestion}
                        onChange={(e) => setSelectedDistributionQuestion(e.target.value)}
                        className="bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer min-h-9"
                      >
                        <option value="overall">Semua Aspek (Gabungan Keseluruhan)</option>
                        <option value="q1_usefulness">1. Manfaat Aplikasi</option>
                        <option value="q2_motivation">2. Semangat Hadir Pagi</option>
                        <option value="q3_ease_of_use">3. Kemudahan Pemakaian</option>
                        <option value="q4_fairness">4. Keadilan &amp; Kejujuran Data</option>
                        <option value="q5_impact">5. Dampak Budaya Disiplin</option>
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const dist =
                      summary.distribution[selectedDistributionQuestion as keyof typeof summary.distribution] ||
                      summary.distribution.overall;

                    return (
                      <div className="space-y-3 pt-1">
                        {/* Batang Visual Proporsional Bertumpuk */}
                        <div className="w-full h-8 sm:h-9 bg-slate-100 rounded-xl overflow-hidden flex shadow-inner">
                          {dist.percentages.star5 > 0 && (
                            <div
                              className="bg-emerald-600 h-full flex items-center justify-center text-white text-[10.5px] font-black transition-all"
                              style={{ width: `${dist.percentages.star5}%` }}
                              title={`Bintang 5: ${dist.star5} guru (${dist.percentages.star5}%)`}
                            >
                              {dist.percentages.star5 >= 10 ? `⭐ 5 (${dist.percentages.star5}%)` : ''}
                            </div>
                          )}
                          {dist.percentages.star4 > 0 && (
                            <div
                              className="bg-teal-500 h-full flex items-center justify-center text-white text-[10.5px] font-black transition-all"
                              style={{ width: `${dist.percentages.star4}%` }}
                              title={`Bintang 4: ${dist.star4} guru (${dist.percentages.star4}%)`}
                            >
                              {dist.percentages.star4 >= 10 ? `⭐ 4 (${dist.percentages.star4}%)` : ''}
                            </div>
                          )}
                          {dist.percentages.star3 > 0 && (
                            <div
                              className="bg-amber-400 h-full flex items-center justify-center text-slate-900 text-[10.5px] font-black transition-all"
                              style={{ width: `${dist.percentages.star3}%` }}
                              title={`Bintang 3: ${dist.star3} guru (${dist.percentages.star3}%)`}
                            >
                              {dist.percentages.star3 >= 10 ? `⭐ 3 (${dist.percentages.star3}%)` : ''}
                            </div>
                          )}
                          {dist.percentages.star2 > 0 && (
                            <div
                              className="bg-orange-500 h-full flex items-center justify-center text-white text-[10.5px] font-black transition-all"
                              style={{ width: `${dist.percentages.star2}%` }}
                              title={`Bintang 2: ${dist.star2} guru (${dist.percentages.star2}%)`}
                            >
                              {dist.percentages.star2 >= 10 ? `⭐ 2 (${dist.percentages.star2}%)` : ''}
                            </div>
                          )}
                          {dist.percentages.star1 > 0 && (
                            <div
                              className="bg-rose-600 h-full flex items-center justify-center text-white text-[10.5px] font-black transition-all"
                              style={{ width: `${dist.percentages.star1}%` }}
                              title={`Bintang 1: ${dist.star1} guru (${dist.percentages.star1}%)`}
                            >
                              {dist.percentages.star1 >= 10 ? `⭐ 1 (${dist.percentages.star1}%)` : ''}
                            </div>
                          )}
                        </div>

                        {/* Legenda Keterangan Bintang */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-[11px]">
                          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                            <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                              Sangat Puas (5)
                            </span>
                            <span className="font-black text-emerald-700">{dist.percentages.star5}%</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-200 flex items-center justify-between">
                            <span className="font-bold text-teal-950 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                              Puas (4)
                            </span>
                            <span className="font-black text-teal-700">{dist.percentages.star4}%</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
                            <span className="font-bold text-amber-950 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                              Cukup (3)
                            </span>
                            <span className="font-black text-amber-700">{dist.percentages.star3}%</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-orange-50/70 border border-orange-200 flex items-center justify-between">
                            <span className="font-bold text-orange-950 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                              Kurang (2)
                            </span>
                            <span className="font-black text-orange-700">{dist.percentages.star2}%</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center justify-between">
                            <span className="font-bold text-rose-950 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                              Sangat Kurang (1)
                            </span>
                            <span className="font-black text-rose-700">{dist.percentages.star1}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* GRAFIK 3: Tren Mingguan (Minggu 1 s.d. 4) */}
              {summary.weeklyTrends && summary.weeklyTrends.some((w) => w.respondentCount > 0) && (
                <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-[#023246]" />
                      Perkembangan Kepuasan Guru dari Minggu ke Minggu
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Rata-rata penilaian guru sepanjang 4 minggu dalam bulan {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {summary.weeklyTrends.map((wt) => (
                      <div
                        key={wt.weekNumber}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          wt.respondentCount > 0
                            ? 'bg-slate-50 border-slate-200 hover:border-[#287094]'
                            : 'bg-slate-50/50 border-slate-100 opacity-60'
                        }`}
                      >
                        <span className="text-[10px] font-black uppercase text-slate-500">
                          {wt.label}
                        </span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-xl sm:text-2xl font-black text-slate-900">
                            {wt.meanScore > 0 ? wt.meanScore.toFixed(2) : '-'}
                          </span>
                          {wt.meanScore > 0 && (
                            <span className="text-[10px] font-medium text-slate-500">/ 5.00</span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-[#287094] mt-1">
                          {wt.respondentCount} Guru Berpartisipasi
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: RENCANA SOLUSI & PERBAIKAN NYATA SEKOLAH
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'SOLUTIONS' && (
            <div className="space-y-4 animate-fade-in">
              {/* Banner Aksi */}
              <div className="bg-linear-to-r from-[#023246] to-[#18536B] text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 uppercase tracking-wider">
                    Tindak Lanjut Nyata
                  </span>
                  <span className="text-xs text-cyan-200 font-bold">
                    Berdasarkan Masukan Bersama
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Daftar Rencana Perbaikan &amp; Solusi Sekolah
                </h3>
                <p className="text-xs text-slate-200 max-w-2xl leading-relaxed">
                  Langkah nyata yang dirumuskan untuk mengatasi kendala teknis, memastikan presensi guru selalu lancar, dan menghargai kedisiplinan mengajar.
                </p>
              </div>

              {/* Filter Peran Solusi */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                <span className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  Saring Solusi:
                </span>
                {(
                  [
                    { id: 'SEMUA', label: '🌐 Semua Bagian' },
                    { id: 'KEPSEK', label: '👑 Kepala Sekolah (Kebijakan)' },
                    { id: 'ADMIN', label: '🛠️ Tim IT / Admin (Teknis)' },
                    { id: 'GURU', label: '👨‍🏫 Rekan Guru (Kebiasaan)' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSolutionRoleFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 min-h-9 ${
                      solutionRoleFilter === f.id
                        ? 'bg-[#023246] text-white shadow-2xs font-black'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Daftar Kartu Solusi */}
              <div className="space-y-3.5">
                {filteredSolutions.map((sol: SurveyActionSolution, idx: number) => {
                  const priorityColor =
                    sol.priority === 'TINGGI'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : sol.priority === 'SEDANG'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200';

                  const statusColor =
                    sol.status === 'TERCAPAI'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : sol.status === 'SEDANG_BERJALAN'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-purple-50 text-purple-800 border-purple-200';

                  const statusLabel =
                    sol.status === 'TERCAPAI'
                      ? '✅ Sudah Diterapkan'
                      : sol.status === 'SEDANG_BERJALAN'
                      ? '⏳ Sedang Berjalan'
                      : '💡 Usulan Rencana';

                  return (
                    <div
                      key={sol.id || idx}
                      className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs space-y-3"
                    >
                      {/* Header Solusi */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${priorityColor}`}>
                              Prioritas: {sol.priority}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                              Kategori: {sol.category}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500">
                              Target: <strong>{sol.targetDimension}</strong>
                            </span>
                          </div>
                          <h4 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                            {sol.solutionTitle}
                          </h4>
                        </div>

                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>

                      {/* Keluhan / Kebutuhan yang dijawab */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
                        <strong className="text-slate-900">Kendala yang Dijawab:</strong> {sol.issueDiagnosed}
                      </div>

                      {/* Langkah Konkret */}
                      <div className="space-y-2">
                        <p className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                          Langkah Nyata Pelaksanaan:
                        </p>
                        <div className="space-y-1.5">
                          {sol.concreteSteps.map((step: string, sIdx: number) => (
                            <div
                              key={sIdx}
                              className="flex items-start gap-2.5 text-xs text-slate-800 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100"
                            >
                              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                                {sIdx + 1}
                              </div>
                              <span className="leading-relaxed">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Penanggung Jawab (PIC) */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          Penanggung Jawab: <strong className="text-slate-800">{sol.pic}</strong>
                        </span>
                        <span className="text-[11px] font-bold text-[#287094] flex items-center gap-1">
                          Program Sekolah
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: BUKTI MANFAAT & HASIL EVALUASI BERSAMA
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'HYPOTHESIS' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl sm:rounded-3xl p-4 text-xs text-amber-950 leading-relaxed space-y-1">
                <p className="font-extrabold flex items-center gap-1.5 text-amber-900 text-sm">
                  <Award className="w-4 h-4 text-amber-600" />
                  Kesimpulan Nyata Manfaat Smart Absensi Guru:
                </p>
                <p>
                  Hasil kuesioner membuktikan secara nyata apakah sistem ini benar-benar memberikan manfaat, memotivasi kehadiran, dan membangun budaya disiplin positif di sekolah dengan standar kepuasan minimal <strong>3.80 dari skala 5.00</strong> (76% kepuasan guru).
                </p>
              </div>

              <div className="space-y-3">
                {summary.hypotheses.map((hyp: SurveyHypothesisResult) => {
                  // Sederhanakan judul dan keterangan untuk orang awam
                  const simplifiedTitle =
                    hyp.code === 'H1'
                      ? '1. Aplikasi Terbukti Mempermudah Tugas Guru & Sekolah'
                      : hyp.code === 'H2'
                      ? '2. Sistem Poin & Apresiasi Terbukti Memotivasi Tepat Waktu'
                      : '3. Aplikasi Membangun Budaya Disiplin Positif & Kepercayaan';

                  return (
                    <div
                      key={hyp.code}
                      className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all space-y-2.5 ${
                        hyp.isConfirmed
                          ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs'
                          : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-[#023246] text-white">
                            Poin {hyp.code}
                          </span>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900">
                            {simplifiedTitle}
                          </h4>
                        </div>

                        <span
                          className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shrink-0 ${
                            hyp.isConfirmed
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-300 text-slate-700'
                          }`}
                        >
                          {hyp.isConfirmed ? '✅ TERBUKTI SANGAT BAIK' : '⏳ DALAM PENGAMATAN'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed italic bg-white p-3 rounded-xl border border-slate-200">
                        "{hyp.description}"
                      </p>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                        <span className="text-slate-600">
                          Standar Target: <strong>Minimal 3.80 / 5.00</strong>
                        </span>
                        <span className="font-extrabold text-slate-900">
                          Nilai Capaian Guru: <strong className="text-emerald-700 font-black text-sm">{hyp.meanScore.toFixed(2)}</strong> / 5.00
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 4: SUARA & SARAN LANGSUNG REKAN GURU (100% ANONIM)
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'FEEDBACK' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-4 rounded-2xl sm:rounded-3xl border border-slate-200">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Kotak Aspirasi &amp; Catatan Masukan Guru
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Saran tertulis langsung dari pendidik untuk bahan evaluasi kepala sekolah dan tim pengembang
                  </p>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                  🔒 100% Identitas Terlindungi &amp; Rahasia
                </span>
              </div>

              {summary.evaluations.length === 0 ? (
                <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center text-slate-500 text-xs space-y-2">
                  <p className="text-2xl">💬</p>
                  <p className="font-bold">Belum ada saran atau pesan tertulis dari guru pada bulan ini.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {summary.evaluations.map((ev: SurveyAnonymousEvaluation) => (
                    <div
                      key={ev.id}
                      className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2.5 hover:border-slate-300 transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="px-2 py-0.5 rounded-md font-extrabold bg-[#023246]/10 text-[#023246]">
                            Masukan {ev.role === 'GURU' ? 'Rekan Guru' : ev.role}
                          </span>
                          <span className="text-slate-400 font-mono">{ev.date}</span>
                        </div>
                        <p className="text-xs text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                          "{ev.evaluationText}"
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1 text-slate-600 font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Dibahas di Rapat Evaluasi
                        </span>
                        <span className="text-emerald-700 font-bold">100% Anonim</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── FOOTER LAYER ─── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Survei berkala ini diselenggarakan untuk kebaikan dan kenyamanan seluruh warga sekolah.</span>
        </div>

        <button
          type="button"
          onClick={() => {
            onBack();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="w-full sm:w-auto px-5 py-2.5 bg-[#023246] hover:bg-[#18536B] active:scale-95 text-white text-xs font-black rounded-xl transition-all cursor-pointer min-h-11 shadow-xs"
        >
          {backLabel}
        </button>
      </div>
    </div>
  );
};
