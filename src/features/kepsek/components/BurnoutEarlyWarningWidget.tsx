import React, { useState, useEffect } from 'react';
import type { BurnoutAnalytics, TeacherMoodType } from '../../../types/database.types';
import { ProviderFactory } from '../../../providers/provider-factory';
import { useAuthStore } from '../../../store/useAuthStore';
import { logger } from '../../../utils/logger.utils';

export const BurnoutEarlyWarningWidget: React.FC = () => {
  const [analytics, setAnalytics] = useState<BurnoutAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuthStore();

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const provider = ProviderFactory.getProvider();
      const data = await provider.getBurnoutAnalytics(undefined, undefined, token || undefined);
      setAnalytics(data);
      logger.info('BurnoutEarlyWarningWidget', 'Burnout analytics loaded successfully', data);
    } catch (err) {
      logger.error('BurnoutEarlyWarningWidget', 'Failed to fetch burnout analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm animate-pulse space-y-4">
        <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/3" />
        <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-2xl" />
        <div className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-2xl" />
      </div>
    );
  }

  if (!analytics) return null;

  const total = analytics.total_responses || 1;
  const breakdown = analytics.mood_breakdown;

  const moodItems: { type: TeacherMoodType; emoji: string; label: string; count: number; colorClass: string; bgBarClass: string }[] = [
    { type: 'VERY_HAPPY', emoji: '😊', label: 'Semangat', count: breakdown.VERY_HAPPY || 0, colorClass: 'text-emerald-600', bgBarClass: 'bg-emerald-500' },
    { type: 'HAPPY', emoji: '🙂', label: 'Baik', count: breakdown.HAPPY || 0, colorClass: 'text-sky-600', bgBarClass: 'bg-sky-500' },
    { type: 'NEUTRAL', emoji: '😐', label: 'Biasa', count: breakdown.NEUTRAL || 0, colorClass: 'text-amber-600', bgBarClass: 'bg-amber-500' },
    { type: 'TIRED', emoji: '😟', label: 'Lelah', count: breakdown.TIRED || 0, colorClass: 'text-orange-600', bgBarClass: 'bg-orange-500' },
    { type: 'STRESSED', emoji: '😫', label: 'Stres', count: breakdown.STRESSED || 0, colorClass: 'text-rose-600', bgBarClass: 'bg-rose-500' },
  ];

  const getRiskBadge = () => {
    if (analytics.burnout_risk_level === 'HIGH') {
      return {
        label: 'PERHATIAN KHUSUS (BURNOUT TINGGI)',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
        dotClass: 'bg-rose-500 animate-ping',
      };
    }
    if (analytics.burnout_risk_level === 'MEDIUM') {
      return {
        label: 'WASPADA (KELELAHAN SEDANG)',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        dotClass: 'bg-amber-500 animate-pulse',
      };
    }
    return {
      label: 'KONDISI PRIMA & AMAN',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      dotClass: 'bg-emerald-500',
    };
  };

  const riskBadge = getRiskBadge();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">💚</span>
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
              Burnout Early Warning &amp; Kesejahteraan Dewan Guru
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitoring tingkat energi, kelelahan, dan indikasi burnout guru secara real-time.
          </p>
        </div>

        {/* Privacy Guarantee Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 font-medium shrink-0">
          <span>🔒</span>
          <span>Diagregasi Anonim</span>
        </div>
      </div>

      {/* Burnout Risk Gauge & Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Risk Level Box */}
        <div className="md:col-span-1 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Indikator Risiko Burnout
            </span>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border font-extrabold text-xs ${riskBadge.badgeClass}`}>
              <span className={`w-2 h-2 rounded-full ${riskBadge.dotClass}`} />
              <span>{riskBadge.label}</span>
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {analytics.burnout_score}%
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Indeks Lelah / Stres ({analytics.total_responses} Respon Guru)
            </span>
          </div>
        </div>

        {/* Mood Distribution Progress Bars */}
        <div className="md:col-span-2 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-2.5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Distribusi Suasana Hati / Mood Guru Bulan Ini
          </span>

          <div className="space-y-2">
            {moodItems.map((item) => {
              const pct = Math.round((item.count / total) * 100);
              return (
                <div key={item.type} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className={`flex items-center gap-1.5 ${item.colorClass}`}>
                      <span>{item.emoji}</span>
                      <span>{item.label}</span>
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {item.count} guru ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.bgBarClass} transition-all duration-500`}
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
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/50 space-y-1.5">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs">
          <span>💡</span>
          <span>Rekomendasi Manajemen Kepsek &amp; Kurikulum:</span>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {analytics.recommendation}
        </p>
      </div>
    </div>
  );
};
