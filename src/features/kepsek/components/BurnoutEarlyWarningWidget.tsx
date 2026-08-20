import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { BurnoutAnalytics, TeacherMoodType } from '../../../types/database.types';
import { ProviderFactory } from '../../../providers/provider-factory';
import { useAuthStore } from '../../../store/useAuthStore';
import { logger } from '../../../utils/logger.utils';
import { INDONESIAN_MONTHS, getTodayDateInJakarta } from '../../../utils/time.utils';

export type BurnoutPeriodMode = 'MONTHLY' | 'YEARLY';

export const BurnoutEarlyWarningWidget: React.FC = () => {
  const todayStr = useMemo(() => getTodayDateInJakarta(), []);
  const currentYearNum = useMemo(() => parseInt(todayStr.substring(0, 4), 10) || new Date().getFullYear(), [todayStr]);
  const currentMonthNum = useMemo(() => parseInt(todayStr.substring(5, 7), 10) || new Date().getMonth() + 1, [todayStr]);

  const [periodMode, setPeriodMode] = useState<BurnoutPeriodMode>('MONTHLY');
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNum);
  const [selectedYear, setSelectedYear] = useState<number>(currentYearNum);

  const [analytics, setAnalytics] = useState<BurnoutAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuthStore();

  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYearNum - 2; y <= currentYearNum + 1; y++) {
      years.push(y);
    }
    return years;
  }, [currentYearNum]);

  const fetchAnalytics = useCallback(async (mode: BurnoutPeriodMode, m: number, y: number) => {
    setIsLoading(true);
    try {
      const provider = ProviderFactory.getProvider();
      const monthArg = mode === 'YEARLY' ? 'ALL' : String(m);
      const yearArg = String(y);
      const data = await provider.getBurnoutAnalytics(monthArg, yearArg, token || undefined);
      setAnalytics(data);
      logger.info('BurnoutEarlyWarningWidget', `Burnout analytics loaded for ${mode} ${monthArg}/${yearArg}:`, data);
    } catch (err) {
      logger.error('BurnoutEarlyWarningWidget', 'Failed to fetch burnout analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAnalytics(periodMode, selectedMonth, selectedYear);
  }, [fetchAnalytics, periodMode, selectedMonth, selectedYear]);

  const isCurrentPeriod = useMemo(() => {
    if (periodMode === 'MONTHLY') {
      return selectedMonth === currentMonthNum && selectedYear === currentYearNum;
    }
    return selectedYear === currentYearNum;
  }, [periodMode, selectedMonth, selectedYear, currentMonthNum, currentYearNum]);

  const handleResetToCurrent = () => {
    setSelectedMonth(currentMonthNum);
    setSelectedYear(currentYearNum);
  };

  const periodLabel = useMemo(() => {
    if (periodMode === 'YEARLY') {
      return `Tahun ${selectedYear}`;
    }
    return `${INDONESIAN_MONTHS[selectedMonth - 1] || 'Bulan Ini'} ${selectedYear}`;
  }, [periodMode, selectedMonth, selectedYear]);

  const total = analytics?.total_responses || 0;
  const breakdown = analytics?.mood_breakdown || { VERY_HAPPY: 0, HAPPY: 0, NEUTRAL: 0, TIRED: 0, STRESSED: 0 };

  const moodItems: { type: TeacherMoodType; emoji: string; label: string; count: number; colorClass: string; bgBarClass: string }[] = [
    { type: 'VERY_HAPPY', emoji: '😊', label: 'Semangat', count: breakdown.VERY_HAPPY || 0, colorClass: 'text-emerald-700', bgBarClass: 'bg-emerald-500' },
    { type: 'HAPPY', emoji: '🙂', label: 'Baik', count: breakdown.HAPPY || 0, colorClass: 'text-sky-700', bgBarClass: 'bg-sky-500' },
    { type: 'NEUTRAL', emoji: '😐', label: 'Biasa', count: breakdown.NEUTRAL || 0, colorClass: 'text-amber-700', bgBarClass: 'bg-amber-500' },
    { type: 'TIRED', emoji: '😟', label: 'Lelah', count: breakdown.TIRED || 0, colorClass: 'text-orange-700', bgBarClass: 'bg-orange-500' },
    { type: 'STRESSED', emoji: '😫', label: 'Stres', count: breakdown.STRESSED || 0, colorClass: 'text-rose-700', bgBarClass: 'bg-rose-500' },
  ];

  const getRiskBadge = () => {
    if (!analytics || total === 0) {
      return {
        label: 'BELUM ADA DATA MOOD',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        dotClass: 'bg-slate-400',
      };
    }
    if (analytics.burnout_risk_level === 'HIGH') {
      return {
        label: 'PERHATIAN KHUSUS (BURNOUT TINGGI)',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
        dotClass: 'bg-rose-500 animate-ping',
      };
    }
    if (analytics.burnout_risk_level === 'MEDIUM') {
      return {
        label: 'WASPADA (KELELAHAN SEDANG)',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        dotClass: 'bg-amber-500 animate-pulse',
      };
    }
    return {
      label: 'KONDISI PRIMA & AMAN',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dotClass: 'bg-emerald-500',
    };
  };

  const riskBadge = getRiskBadge();

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#D4D4CE]/40 shadow-card space-y-4">
      {/* Widget Header & Period Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-xl shrink-0">
            💚
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-[#023246] text-base">
                Burnout Early Warning &amp; Kesejahteraan Dewan Guru
              </h3>
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-900 border border-emerald-300/60">
                {periodMode === 'MONTHLY' ? '📅 Rekap Bulanan' : '📆 Rekap Tahunan'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Monitoring tingkat energi, kelelahan, dan kesehatan psikologis guru pada <span className="font-bold text-[#023246]">{periodLabel}</span>.
            </p>
          </div>
        </div>

        {/* Period Navigation Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher Tabs */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setPeriodMode('MONTHLY')}
              className={`px-2.5 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                periodMode === 'MONTHLY'
                  ? 'bg-white text-[#023246] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📅 Bulanan
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('YEARLY')}
              className={`px-2.5 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                periodMode === 'YEARLY'
                  ? 'bg-white text-[#023246] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📆 Tahunan
            </button>
          </div>

          {/* Month Selector Dropdown (Shown only in MONTHLY mode) */}
          {periodMode === 'MONTHLY' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer transition-colors shadow-2xs"
            >
              {INDONESIAN_MONTHS.map((mName, idx) => (
                <option key={mName} value={idx + 1}>
                  {mName}
                </option>
              ))}
            </select>
          )}

          {/* Year Selector Dropdown */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer transition-colors shadow-2xs"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          {/* Fast Reset Button to Current Month / Year */}
          {!isCurrentPeriod && (
            <button
              type="button"
              onClick={handleResetToCurrent}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all border border-emerald-200 cursor-pointer active:scale-95 shrink-0"
              title="Kembali ke periode berjalan hari ini"
            >
              🔄 {periodMode === 'MONTHLY' ? 'Bulan Ini' : 'Tahun Ini'}
            </button>
          )}

          {/* Privacy Guarantee Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-bold shrink-0">
            <span>🔒</span>
            <span>Anonim</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 animate-pulse space-y-3">
          <div className="h-4 bg-slate-200 rounded w-1/4" />
          <div className="h-16 bg-slate-200 rounded-xl" />
        </div>
      ) : !analytics || total === 0 ? (
        /* Empty State for Period with No Data */
        <div className="bg-linear-to-r from-emerald-50/80 via-teal-50/50 to-slate-50 p-6 rounded-2xl border border-dashed border-emerald-200 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-white border border-emerald-200 text-emerald-600 flex items-center justify-center text-2xl mx-auto shadow-xs">
            🌱
          </div>
          <div>
            <h4 className="font-extrabold text-[#023246] text-sm">
              Belum Ada Respon Mood Guru pada {periodLabel}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 font-medium leading-relaxed">
              Statistik dan rekomendasi burnout akan otomatis terisi secara realtime begitu dewan guru mengisi <b>Mood Check-in</b> saat presensi di periode {periodLabel}.
            </p>
          </div>
          <div className="pt-1">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-600 shadow-2xs">
              <span>📊 Status:</span>
              <span className="text-emerald-700">0 Respon Tercatat ({periodLabel})</span>
            </span>
          </div>
        </div>
      ) : (
        /* Active Data Metrics Grid */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Risk Level Box */}
            <div className="md:col-span-1 bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                  Indikator Risiko Burnout ({periodLabel})
                </span>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border font-extrabold text-xs ${riskBadge.badgeClass}`}>
                  <span className={`w-2 h-2 rounded-full ${riskBadge.dotClass}`} />
                  <span>{riskBadge.label}</span>
                </div>
              </div>

              <div className="flex items-baseline gap-2 pt-2">
                <span className="text-3xl font-black text-[#023246] font-mono">
                  {analytics.burnout_score}%
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  Indeks Lelah / Stres ({total} Respon)
                </span>
              </div>
            </div>

            {/* Mood Distribution Progress Bars */}
            <div className="md:col-span-2 bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Distribusi Suasana Hati / Mood Guru ({periodLabel})
              </span>

              <div className="space-y-2">
                {moodItems.map((item) => {
                  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  return (
                    <div key={item.type} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className={`flex items-center gap-1.5 ${item.colorClass}`}>
                          <span>{item.emoji}</span>
                          <span>{item.label}</span>
                        </span>
                        <span className="text-slate-600 font-mono text-[11px]">
                          {item.count} guru ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.bgBarClass} transition-all duration-500 rounded-full`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Leadership Recommendation Card */}
          <div className="bg-linear-to-r from-emerald-50 via-teal-50 to-emerald-50/40 p-4 rounded-2xl border border-emerald-200/80 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-xs">
              <span>💡</span>
              <span>Rekomendasi Manajemen Kepsek &amp; Kurikulum ({periodLabel}):</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {analytics.recommendation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
