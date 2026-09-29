import React, { useState, useEffect, useCallback } from 'react';
import type {
  WeeklySurveySummary,
  SurveyHypothesisResult,
  SurveyIndicatorSummary,
  SurveyAnonymousEvaluation,
} from '../../../types/database.types';
import { ResearchSurveyService } from '../../../services/research-survey.service';
import { getTodayDateInJakarta } from '../../../utils/time.utils';

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
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HYPOTHESIS' | 'FEEDBACK'>('OVERVIEW');

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Rekapitulasi Riset & Evaluasi Bulanan"
    >
      <div className="relative w-full max-w-2xl max-h-[92dvh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
        {/* Top Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 shrink-0 flex items-center justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                📊 Kuantitatif & Evaluasi TAM
              </span>
              <span className="text-[11px] text-slate-400 font-bold">100% Data Anonim</span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white">
              Rekapitulasi Kuesioner & Riset Efektivitas
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Evaluasi kepuasan, motivasi, dan verifikasi hipotesis ilmiah aplikasi sekolah
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer shrink-0"
            aria-label="Tutup Modal"
          >
            ✕
          </button>
        </div>

        {/* Filter Bar (Month & Year Selector) */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <label htmlFor="select-survey-month" className="text-xs font-bold text-slate-700">
              Periode:
            </label>
            <select
              id="select-survey-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-white border border-slate-300 text-slate-900 text-xs font-extrabold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
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
              className="bg-white border border-slate-300 text-slate-900 text-xs font-extrabold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'OVERVIEW'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Indikator
            </button>
            <button
              onClick={() => setActiveTab('HYPOTHESIS')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'HYPOTHESIS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hipotesis ({summary?.hypotheses.filter((h: SurveyHypothesisResult) => h.isConfirmed).length || 0}/3)
            </button>
            <button
              onClick={() => setActiveTab('FEEDBACK')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'FEEDBACK'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Evaluasi ({summary?.evaluations.length || 0})
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Merekapitulasi data kuesioner...</p>
            </div>
          ) : !summary || summary.totalRespondents === 0 ? (
            <div className="py-16 text-center space-y-3">
              <span className="text-4xl">📋</span>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800">
                Belum Ada Respon pada Periode Ini
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Kuesioner mingguan akan diisi oleh guru, admin, dan kepsek setiap hari Jumat setelah absensi masuk pada bulan{' '}
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
              </p>
            </div>
          ) : (
            <>
              {/* Quick Stat Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Total Responden
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                    {summary.totalRespondents}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Guru: {summary.roleBreakdown.guru} | Admin: {summary.roleBreakdown.admin} | Kepsek: {summary.roleBreakdown.kepsek}
                  </p>
                </div>

                <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                  <p className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">
                    Indeks TAM Global
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5">
                    {summary.overallMean.toFixed(2)}{' '}
                    <span className="text-xs font-medium text-emerald-600">/ 5.00</span>
                  </p>
                  <p className="text-[10px] font-bold text-emerald-700 mt-0.5">
                    {summary.overallMean >= 4.0 ? 'Kategori Sangat Tinggi' : 'Kategori Baik'}
                  </p>
                </div>

                <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200">
                  <p className="text-[10px] font-extrabold text-purple-800 uppercase tracking-wider">
                    Validasi Hipotesis
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-purple-700 mt-0.5">
                    {summary.hypotheses.filter((h: SurveyHypothesisResult) => h.isConfirmed).length} / 3
                  </p>
                  <p className="text-[10px] font-bold text-purple-700 mt-0.5">
                    {summary.hypotheses.every((h: SurveyHypothesisResult) => h.isConfirmed)
                      ? '100% Terkonfirmasi'
                      : 'Dalam Pengamatan'}
                  </p>
                </div>

                <div className="bg-blue-50 p-3 rounded-2xl border border-blue-200">
                  <p className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider">
                    Masukan Tertulis
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-blue-700 mt-0.5">
                    {summary.evaluations.length}
                  </p>
                  <p className="text-[10px] text-blue-600 mt-0.5">Aspirasi & Evaluasi</p>
                </div>
              </div>

              {/* Tab 1: Indikator Dimensi TAM */}
              {activeTab === 'OVERVIEW' && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center justify-between">
                    <span>Distribusi Skor per Indikator TAM</span>
                    <span className="text-[11px] text-slate-500 font-medium">Skala Likert 1–5</span>
                  </h3>

                  {(Object.entries(summary.indicators) as [string, SurveyIndicatorSummary][]).map(([key, ind]) => (
                    <div
                      key={key}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-900">{ind.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            Rerata {ind.mean.toFixed(2)}
                          </span>
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                            {ind.positivePercentage}% Positif
                          </span>
                        </div>
                      </div>

                      {/* Score Bar */}
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-500"
                          style={{ width: `${(ind.mean / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 2: Pengujian Hipotesis Penelitian */}
              {activeTab === 'HYPOTHESIS' && (
                <div className="space-y-3 pt-2">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 leading-relaxed">
                    <strong>Pondasi Ilmiah:</strong> Pengujian hipotesis kuantitatif menggunakan ambang batas rerata skor ≥ 3.80 (76% kepuasan responden) berdasarkan model Technology Acceptance Model (TAM).
                  </div>

                  {summary.hypotheses.map((hyp: SurveyHypothesisResult) => (
                    <div
                      key={hyp.code}
                      className={`p-4 rounded-2xl border transition-all ${
                        hyp.isConfirmed
                          ? 'bg-emerald-50/60 border-emerald-300'
                          : 'bg-slate-50 border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-900 text-white mr-2">
                            {hyp.code}
                          </span>
                          <span className="text-xs font-black text-slate-900">{hyp.title}</span>
                        </div>

                        <span
                          className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${
                            hyp.isConfirmed
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-300 text-slate-700'
                          }`}
                        >
                          {hyp.isConfirmed ? 'DITERIMA' : 'BELUM TERCAPAI'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 my-2 leading-relaxed italic">
                        "{hyp.description}"
                      </p>

                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-200/60">
                        <span className="text-slate-600 font-medium">
                          Indikator Target: <strong>{hyp.targetMetric}</strong>
                        </span>
                        <span className="font-extrabold text-slate-900">
                          Skor Realisasi: <strong className="text-emerald-700">{hyp.meanScore.toFixed(2)}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 3: Masukan Evaluasi Tertulis Anonim */}
              {activeTab === 'FEEDBACK' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                      Evaluasi & Harapan untuk Minggu Depan
                    </h3>
                    <span className="text-[11px] font-bold text-slate-500">
                      100% Identitas Penulis Dirahasiakan
                    </span>
                  </div>

                  {summary.evaluations.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-xs">
                      Belum ada catatan evaluasi tertulis pada bulan ini.
                    </div>
                  ) : (
                    summary.evaluations.map((ev: SurveyAnonymousEvaluation) => (
                      <div
                        key={ev.id}
                        className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="px-2 py-0.5 rounded-md font-extrabold bg-slate-100 text-slate-700">
                            Responden {ev.role}
                          </span>
                          <span className="text-slate-400 font-medium">{ev.date}</span>
                        </div>
                        <p className="text-xs text-slate-800 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          "{ev.evaluationText}"
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 sm:p-4 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-bold">
            Smart Absensi Guru — Quantitative TAM Research Suite
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
          >
            Tutup Rekap
          </button>
        </div>
      </div>
    </div>
  );
};
