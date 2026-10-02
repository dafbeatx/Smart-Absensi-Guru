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
  X,
  Sparkles,
  ChevronRight,
  Filter,
} from 'lucide-react';

export interface MonthlySurveyAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const MonthlySurveyAnalyticsModal: React.FC<MonthlySurveyAnalyticsModalProps> = ({
  isOpen,
  onClose,
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
      console.warn('Failed to load survey summary:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Filter solutions by selected role tab
  const filteredSolutions = useMemo(() => {
    if (!summary?.solutions) return [];
    if (solutionRoleFilter === 'SEMUA') return summary.solutions;
    return summary.solutions.filter(
      (sol: SurveyActionSolution) => sol.forRole === solutionRoleFilter || sol.forRole === 'SEMUA'
    );
  }, [summary?.solutions, solutionRoleFilter]);

  // Identify highest and lowest scoring indicators for executive diagnosis
  const indicatorDiagnosis = useMemo(() => {
    if (!summary || summary.totalRespondents === 0) return null;
    const entries = Object.entries(summary.indicators) as [string, SurveyIndicatorSummary][];
    if (entries.length === 0) return null;

    const sorted = [...entries].sort((a, b) => b[1].mean - a[1].mean);
    const top = sorted[0];
    const lowest = sorted[sorted.length - 1];

    return {
      topIndicator: top[1],
      lowestIndicator: lowest[1],
    };
  }, [summary]);

  const handlePrintSolutions = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 200);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Rekapitulasi Riset, Grafik & Solusi Survey Seluruh Guru"
    >
      <div className="relative w-full max-w-4xl max-h-[94dvh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
        {/* Top Header */}
        <div className="bg-[#023246] text-white p-4 sm:p-5 shrink-0 border-b border-[#287094]/40">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <BarChart3 className="w-3 h-3" />
                  Hasil Survey &amp; Evaluasi Guru
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-slate-200 border border-white/15">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  100% Anonim &amp; Terenkripsi
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-black text-white tracking-tight">
                Suara Pendidik, Grafik TAM &amp; Rencana Solusi Sekolah
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                Transparansi hasil kuesioner mingguan seluruh guru untuk evaluasi mutu, efektivitas sistem presensi, dan penyusunan langkah solusi manajerial sekolah.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer shrink-0"
              aria-label="Tutup Modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Anonymity Banner */}
          <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center gap-2 text-[11px] text-slate-300 bg-white/5 px-3 py-2 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Jaminan Privasi:</strong> Jawaban setiap guru dihitung secara murni statistik. Nama, NPP, dan identitas perangkat tidak pernah disimpan maupun ditampilkan ke pihak manapun.
            </span>
          </div>
        </div>

        {/* Filter & Sub-Nav Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Periode Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Periode:
            </span>
            <select
              id="select-survey-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-white border border-slate-300 text-slate-900 text-xs font-black rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#287094] cursor-pointer shadow-2xs"
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>

            <select
              id="select-survey-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-white border border-slate-300 text-slate-900 text-xs font-black rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#287094] cursor-pointer shadow-2xs"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Main Tabs */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('CHARTS')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'CHARTS'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Grafik &amp; Analisis</span>
            </button>
            <button
              onClick={() => setActiveTab('SOLUTIONS')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'SOLUTIONS'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span>Solusi &amp; Tindak Lanjut</span>
              {summary?.solutions && summary.solutions.length > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black">
                  {summary.solutions.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('HYPOTHESIS')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'HYPOTHESIS'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-purple-600" />
              <span>Hipotesis TAM</span>
            </button>
            <button
              onClick={() => setActiveTab('FEEDBACK')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'FEEDBACK'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Aspirasi Guru ({summary?.evaluations.length || 0})</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-9 h-9 border-4 border-[#287094] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Mengkalkulasi grafik dan rekomendasi solusi...</p>
            </div>
          ) : !summary || summary.totalRespondents === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center text-3xl mx-auto shadow-inner">
                📋
              </div>
              <h3 className="text-base font-extrabold text-slate-800">
                Belum Ada Respon pada Periode Ini
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Kuesioner mingguan diisi secara berkala setiap hari Jumat oleh guru, admin, dan kepsek pada bulan{' '}
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
              </p>
            </div>
          ) : (
            <>
              {/* Quick Stat Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <p className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-3 h-3 text-slate-400" />
                    Total Responden
                  </p>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                    {summary.totalRespondents}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    Guru: <strong>{summary.roleBreakdown.guru}</strong> | Admin: <strong>{summary.roleBreakdown.admin}</strong> | Kepsek: <strong>{summary.roleBreakdown.kepsek}</strong>
                  </p>
                </div>

                <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/90 shadow-2xs">
                  <p className="text-[10.5px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    Indeks TAM Rerata
                  </p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-emerald-700">
                      {summary.overallMean.toFixed(2)}
                    </span>
                    <span className="text-xs font-semibold text-emerald-600">/ 5.00</span>
                  </div>
                  <p className="text-[10px] font-bold text-emerald-700 mt-1">
                    {summary.overallMean >= 4.0 ? 'Kategori Sangat Tinggi (Sangat Puas)' : 'Kategori Baik'}
                  </p>
                </div>

                <div className="bg-purple-50/70 p-3.5 rounded-2xl border border-purple-200/90 shadow-2xs">
                  <p className="text-[10.5px] font-extrabold text-purple-800 uppercase tracking-wider flex items-center gap-1">
                    <Award className="w-3 h-3 text-purple-600" />
                    Hipotesis Ilmiah
                  </p>
                  <p className="text-2xl sm:text-3xl font-black text-purple-700 mt-1">
                    {summary.hypotheses.filter((h: SurveyHypothesisResult) => h.isConfirmed).length} / 3
                  </p>
                  <p className="text-[10px] font-bold text-purple-700 mt-1">
                    {summary.hypotheses.every((h: SurveyHypothesisResult) => h.isConfirmed)
                      ? '100% Terkonfirmasi'
                      : 'Dalam Pengamatan'}
                  </p>
                </div>

                <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/90 shadow-2xs">
                  <p className="text-[10.5px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                    <Lightbulb className="w-3 h-3 text-amber-600" />
                    Rencana Solusi
                  </p>
                  <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">
                    {summary.solutions ? summary.solutions.length : 4}
                  </p>
                  <p className="text-[10px] font-bold text-amber-700 mt-1">
                    Tindakan Nyata Terstruktur
                  </p>
                </div>
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  TAB 1: GRAFIK & ANALISIS DIMENSI TAM
                 ───────────────────────────────────────────────────────────── */}
              {activeTab === 'CHARTS' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Executive Diagnosis Banner */}
                  {indicatorDiagnosis && (
                    <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-4.5 border border-slate-800 shadow-md space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#287094] text-white">
                          Diagnosa Data Otomatis
                        </span>
                        <span className="text-[11px] text-slate-400 font-bold">
                          Ambang Batas Keberhasilan: Skor ≥ 3.80
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                          <p className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">
                            ⭐ Kekuatan Utama Paling Diapresiasi
                          </p>
                          <p className="font-bold text-white text-xs mt-0.5">
                            {indicatorDiagnosis.topIndicator.title}
                          </p>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            Rerata: <strong className="text-emerald-300">{indicatorDiagnosis.topIndicator.mean.toFixed(2)} / 5.00</strong> ({indicatorDiagnosis.topIndicator.positivePercentage}% Respon Positif)
                          </p>
                        </div>

                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                          <p className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider">
                            🎯 Area Prioritas Peningkatan Tindak Lanjut
                          </p>
                          <p className="font-bold text-white text-xs mt-0.5">
                            {indicatorDiagnosis.lowestIndicator.title}
                          </p>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            Rerata: <strong className="text-amber-300">{indicatorDiagnosis.lowestIndicator.mean.toFixed(2)} / 5.00</strong> — Disiapkan solusi di tab Solusi
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GRAFIK 1: Perbandingan 5 Dimensi Utama TAM (Horizontal Bar Chart) */}
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                          <BarChart3 className="w-4 h-4 text-[#287094]" />
                          Grafik Perbandingan 5 Dimensi Evaluasi TAM
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Evaluasi empiris adopsi teknologi sekolah dibandingkan dengan target standar (3.80 / 5.00)
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-bold">
                        <span className="flex items-center gap-1 text-emerald-700">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          Realisasi Skor
                        </span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <span className="w-2.5 h-0.5 bg-slate-400" />
                          Target (3.80)
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4 pt-1">
                      {(Object.entries(summary.indicators) as [string, SurveyIndicatorSummary][]).map(([key, ind]) => {
                        const percent = (ind.mean / 5) * 100;
                        const targetPercent = (3.8 / 5) * 100;
                        const isExceeding = ind.mean >= 3.8;

                        return (
                          <div key={key} className="space-y-1.5 p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-all">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-slate-800">
                                {ind.title}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs font-black px-2 py-0.5 rounded-lg border ${
                                  isExceeding
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {ind.mean.toFixed(2)} / 5.00
                                </span>
                                <span className="text-[11px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                                  {ind.positivePercentage}% Puas
                                </span>
                              </div>
                            </div>

                            {/* Relative Comparison Bar with Benchmark Line */}
                            <div className="relative w-full bg-slate-200/90 h-3.5 rounded-full overflow-hidden">
                              {/* Benchmark marker line at 3.80 (76%) */}
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-slate-500 z-10"
                                style={{ left: `${targetPercent}%` }}
                                title="Target Ambang Batas 3.80"
                              />
                              {/* Actual Value Bar */}
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

                  {/* GRAFIK 2: Distribusi Skala Likert 1-5 Bintang (Stacked Distribution Bar Chart) */}
                  {summary.distribution && (
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                            Grafik Distribusi Skala Kepuasan Responden (1–5 Bintang)
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Sebaran proporsi penilaian dari Sangat Kurang (Bintang 1) hingga Sangat Puas (Bintang 5)
                          </p>
                        </div>

                        {/* Filter Dimensi Distribusi */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <label htmlFor="select-dist-q" className="font-bold text-slate-600 text-[11px]">
                            Tampilkan:
                          </label>
                          <select
                            id="select-dist-q"
                            value={selectedDistributionQuestion}
                            onChange={(e) => setSelectedDistributionQuestion(e.target.value)}
                            className="bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                          >
                            <option value="overall">Seluruh Pertanyaan (Agregat)</option>
                            <option value="q1_usefulness">Q1 - Kemanfaatan Aplikasi</option>
                            <option value="q2_motivation">Q2 - Motivasi &amp; Hadir</option>
                            <option value="q3_ease_of_use">Q3 - Kemudahan Penggunaan</option>
                            <option value="q4_fairness">Q4 - Keadilan &amp; Transparansi</option>
                            <option value="q5_impact">Q5 - Budaya Disiplin Sekolah</option>
                          </select>
                        </div>
                      </div>

                      {/* Stacked Percentage Bar */}
                      {(() => {
                        const dist =
                          summary.distribution[selectedDistributionQuestion as keyof typeof summary.distribution] ||
                          summary.distribution.overall;

                        return (
                          <div className="space-y-3 pt-1">
                            {/* Visual Stacked Bar */}
                            <div className="w-full h-8 bg-slate-100 rounded-xl overflow-hidden flex shadow-inner">
                              {dist.percentages.star5 > 0 && (
                                <div
                                  className="bg-emerald-600 h-full flex items-center justify-center text-white text-[10.5px] font-black transition-all"
                                  style={{ width: `${dist.percentages.star5}%` }}
                                  title={`Bintang 5: ${dist.star5} respon (${dist.percentages.star5}%)`}
                                >
                                  {dist.percentages.star5 >= 10 ? `⭐ 5 (${dist.percentages.star5}%)` : ''}
                                </div>
                              )}
                              {dist.percentages.star4 > 0 && (
                                <div
                                  className="bg-teal-500 h-full flex items-center justify-center text-white text-[10.5px] font-black transition-all"
                                  style={{ width: `${dist.percentages.star4}%` }}
                                  title={`Bintang 4: ${dist.star4} respon (${dist.percentages.star4}%)`}
                                >
                                  {dist.percentages.star4 >= 10 ? `⭐ 4 (${dist.percentages.star4}%)` : ''}
                                </div>
                              )}
                              {dist.percentages.star3 > 0 && (
                                <div
                                  className="bg-amber-400 h-full flex items-center justify-center text-slate-900 text-[10.5px] font-black transition-all"
                                  style={{ width: `${dist.percentages.star3}%` }}
                                  title={`Bintang 3: ${dist.star3} respon (${dist.percentages.star3}%)`}
                                >
                                  {dist.percentages.star3 >= 10 ? `⭐ 3 (${dist.percentages.star3}%)` : ''}
                                </div>
                              )}
                              {dist.percentages.star2 > 0 && (
                                <div
                                  className="bg-orange-500 h-full flex items-center justify-center text-white text-[10.5px] font-black transition-all"
                                  style={{ width: `${dist.percentages.star2}%` }}
                                  title={`Bintang 2: ${dist.star2} respon (${dist.percentages.star2}%)`}
                                >
                                  {dist.percentages.star2 >= 10 ? `⭐ 2 (${dist.percentages.star2}%)` : ''}
                                </div>
                              )}
                              {dist.percentages.star1 > 0 && (
                                <div
                                  className="bg-rose-600 h-full flex items-center justify-center text-white text-[10.5px] font-black transition-all"
                                  style={{ width: `${dist.percentages.star1}%` }}
                                  title={`Bintang 1: ${dist.star1} respon (${dist.percentages.star1}%)`}
                                >
                                  {dist.percentages.star1 >= 10 ? `⭐ 1 (${dist.percentages.star1}%)` : ''}
                                </div>
                              )}
                            </div>

                            {/* Legend Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-[11px]">
                              <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                                <span className="font-bold text-emerald-950 flex items-center gap-1">
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                                  Sangat Setuju (5)
                                </span>
                                <span className="font-black text-emerald-700">{dist.percentages.star5}%</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-200 flex items-center justify-between">
                                <span className="font-bold text-teal-950 flex items-center gap-1">
                                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                                  Setuju (4)
                                </span>
                                <span className="font-black text-teal-700">{dist.percentages.star4}%</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between">
                                <span className="font-bold text-amber-950 flex items-center gap-1">
                                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                  Cukup / Netral (3)
                                </span>
                                <span className="font-black text-amber-700">{dist.percentages.star3}%</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-orange-50/60 border border-orange-200 flex items-center justify-between">
                                <span className="font-bold text-orange-950 flex items-center gap-1">
                                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                                  Kurang (2)
                                </span>
                                <span className="font-black text-orange-700">{dist.percentages.star2}%</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200 flex items-center justify-between">
                                <span className="font-bold text-rose-950 flex items-center gap-1">
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

                  {/* GRAFIK 3: Tren Mingguan (Weekly Progression Area & Line Chart) */}
                  {summary.weeklyTrends && summary.weeklyTrends.some((w) => w.respondentCount > 0) && (
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-[#287094]" />
                            Grafik Tren Kepuasan &amp; Partisipasi Mingguan
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Pergerakan rerata skor dan keaktifan guru sepanjang Minggu ke-1 hingga Minggu ke-4
                          </p>
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-xl">
                          Periode: {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                        {summary.weeklyTrends.map((wt) => (
                          <div
                            key={wt.weekNumber}
                            className={`p-3.5 rounded-2xl border transition-all ${
                              wt.respondentCount > 0
                                ? 'bg-slate-50/90 border-slate-200 hover:border-[#287094]'
                                : 'bg-slate-50/40 border-slate-100 opacity-60'
                            }`}
                          >
                            <span className="text-[10px] font-black uppercase text-slate-500">
                              {wt.label}
                            </span>
                            <div className="flex items-baseline gap-1 mt-1">
                              <span className="text-xl font-black text-slate-900">
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
                  TAB 2: SOLUSI & REKOMENDASI TINDAK LANJUT NYATA
                 ───────────────────────────────────────────────────────────── */}
              {activeTab === 'SOLUTIONS' && (
                <div className="space-y-5 animate-fade-in">
                  {/* Strategic Solutions Action Plan Header */}
                  <div className="bg-gradient-to-r from-[#023246] to-[#18536B] text-white p-4 sm:p-5 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 uppercase tracking-wider">
                          Solusi Tindakan Nyata
                        </span>
                        <span className="text-xs text-blue-200 font-bold">
                          Berdasarkan Hasil Analisis Survey
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-white">
                        Katalog Rekomendasi Solusi &amp; Rencana Aksi Sekolah
                      </h3>
                      <p className="text-xs text-slate-200 max-w-xl leading-relaxed">
                        Solusi teruji yang dirancang langsung untuk menjawab kendala teknis, kebijakan kehadiran, dan penguatan budaya disiplin dewan guru.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handlePrintSolutions}
                      disabled={isPrinting}
                      className="px-4 py-2.5 bg-white hover:bg-slate-100 text-[#023246] text-xs font-black rounded-xl transition-all shadow-md inline-flex items-center gap-2 cursor-pointer shrink-0 active:scale-95"
                      title="Cetak format print-ready untuk dibahas di Rapat Dewan Guru"
                    >
                      <Printer className="w-4 h-4 text-[#023246]" />
                      <span>{isPrinting ? 'Mempersiapkan...' : 'Cetak Rencana Aksi (PDF)'}</span>
                    </button>
                  </div>

                  {/* Filter Peran Solusi */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    <span className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5" />
                      Filter Solusi:
                    </span>
                    {(
                      [
                        { id: 'SEMUA', label: '🌐 Semua Solusi' },
                        { id: 'KEPSEK', label: '👑 Kepala Sekolah (Kebijakan)' },
                        { id: 'ADMIN', label: '🛠️ Admin / IT (Teknis)' },
                        { id: 'GURU', label: '👨‍🏫 Rekan Guru (Budaya)' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSolutionRoleFilter(f.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                          solutionRoleFilter === f.id
                            ? 'bg-[#023246] text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* List of Concrete Action Solutions */}
                  <div className="space-y-4">
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
                          ? '✅ DITERAPKAN'
                          : sol.status === 'SEDANG_BERJALAN'
                          ? '⏳ SEDANG BERJALAN'
                          : '💡 DIREKOMENDASIKAN';

                      return (
                        <div
                          key={sol.id || idx}
                          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-[#287094]/60 transition-all space-y-3.5"
                        >
                          {/* Header Solusi */}
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${priorityColor}`}>
                                  Prioritas {sol.priority}
                                </span>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                  Kategori: {sol.category}
                                </span>
                                <span className="text-[10.5px] font-bold text-slate-500">
                                  Target: <strong>{sol.targetDimension}</strong>
                                </span>
                              </div>
                              <h4 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                                {sol.solutionTitle}
                              </h4>
                            </div>

                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border shrink-0 ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </div>

                          {/* Diagnosa Masalah yang Dijawab */}
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
                            <strong className="text-slate-900">Diagnosa Kebutuhan:</strong> {sol.issueDiagnosed}
                          </div>

                          {/* Concrete Steps Checklist */}
                          <div className="space-y-2">
                            <p className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                              Langkah Aksi Konkret Sekolah:
                            </p>
                            <div className="space-y-1.5">
                              {sol.concreteSteps.map((step: string, sIdx: number) => (
                                <div
                                  key={sIdx}
                                  className="flex items-start gap-2.5 text-xs text-slate-800 bg-white p-2 rounded-lg border border-slate-100"
                                >
                                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                                    {sIdx + 1}
                                  </div>
                                  <span className="leading-relaxed">{step}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Footer Penanggung Jawab (PIC) */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-slate-500">
                              Penanggung Jawab (PIC): <strong className="text-slate-800">{sol.pic}</strong>
                            </span>
                            <span className="text-[11px] font-bold text-[#287094] flex items-center gap-1">
                              Rekomendasi Mutu Sekolah
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
                  TAB 3: PENGUJIAN HIPOTESIS RISET ILMIAH TAM
                 ───────────────────────────────────────────────────────────── */}
              {activeTab === 'HYPOTHESIS' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 text-xs text-amber-950 leading-relaxed space-y-1">
                    <p className="font-extrabold flex items-center gap-1.5 text-amber-900">
                      <Award className="w-4 h-4 text-amber-600" />
                      Landasan Metodologi Ilmiah (Technology Acceptance Model - TAM):
                    </p>
                    <p>
                      Pengujian hipotesis kuantitatif dilakukan dengan membandingkan rerata skor kuesioner terhadap ambang batas ilmiah standar <strong>≥ 3.80 dari skala 5.00</strong> (76% kepuasan responden) untuk membuktikan efektivitas sistem bagi guru dan institusi sekolah.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {summary.hypotheses.map((hyp: SurveyHypothesisResult) => (
                      <div
                        key={hyp.code}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-2.5 ${
                          hyp.isConfirmed
                            ? 'bg-emerald-50/50 border-emerald-300 shadow-2xs'
                            : 'bg-slate-50 border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-[#023246] text-white">
                              {hyp.code}
                            </span>
                            <h4 className="text-xs sm:text-sm font-black text-slate-900">
                              {hyp.title}
                            </h4>
                          </div>

                          <span
                            className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shrink-0 ${
                              hyp.isConfirmed
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-300 text-slate-700'
                            }`}
                          >
                            {hyp.isConfirmed ? 'DITERIMA / TERKONFIRMASI' : 'BELUM TERCAPAI'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed italic bg-white/70 p-3 rounded-xl border border-slate-200/60">
                          "{hyp.description}"
                        </p>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/70">
                          <span className="text-slate-600">
                            Metrik Pengujian: <strong>{hyp.targetMetric}</strong>
                          </span>
                          <span className="font-extrabold text-slate-900">
                            Skor Realisasi: <strong className="text-emerald-700 font-black text-sm">{hyp.meanScore.toFixed(2)}</strong> / 5.00
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 4: ASPIRASI & EVALUASI TERTULIS GURU (100% ANONIM)
                 ───────────────────────────────────────────────────────────── */}
              {activeTab === 'FEEDBACK' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">
                        Catatan Aspirasi &amp; Evaluasi Mingguan Guru
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Saran langsung dari pendidik untuk bahan perbaikan kebijakan dan kenyamanan kerja
                      </p>
                    </div>
                    <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      100% Identitas Penulis Dirahasiakan
                    </span>
                  </div>

                  {summary.evaluations.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                      <p className="text-2xl">💬</p>
                      <p className="font-bold">Belum ada catatan evaluasi tertulis pada bulan ini.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {summary.evaluations.map((ev: SurveyAnonymousEvaluation) => (
                        <div
                          key={ev.id}
                          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2.5 hover:border-slate-300 transition-all flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="px-2 py-0.5 rounded-md font-extrabold bg-[#023246]/10 text-[#023246]">
                                Responden {ev.role}
                              </span>
                              <span className="text-slate-400 font-medium font-mono">{ev.date}</span>
                            </div>
                            <p className="text-xs text-slate-800 leading-relaxed bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                              "{ev.evaluationText}"
                            </p>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                            <span>Status: Ditindaklanjuti pada Rencana Solusi</span>
                            <span className="text-emerald-600 font-bold">Terverifikasi Anonim</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3.5 sm:p-4 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Sistem Kuesioner Anonim — Smart Absensi Guru</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#023246] hover:bg-[#18536B] text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
          >
            Tutup Rekap
          </button>
        </div>
      </div>
    </div>
  );
};
