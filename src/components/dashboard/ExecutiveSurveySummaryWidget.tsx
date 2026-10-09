import React, { useState, useEffect } from 'react';
import type { WeeklySurveySummary, SurveyIndicatorSummary } from '../../types/database.types';
import { ResearchSurveyService } from '../../services/research-survey.service';
import { getTodayDateInJakarta } from '../../utils/time.utils';
import {
  BarChart3,
  Lightbulb,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Users,
} from 'lucide-react';

export interface ExecutiveSurveySummaryWidgetProps {
  onOpenSurveyModal?: () => void;
  className?: string;
}

export const ExecutiveSurveySummaryWidget: React.FC<ExecutiveSurveySummaryWidgetProps> = ({
  onOpenSurveyModal,
  className = '',
}) => {
  const [summary, setSummary] = useState<WeeklySurveySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const today = getTodayDateInJakarta();
    const d = new Date(today);
    const m = isNaN(d.getTime()) ? new Date().getMonth() + 1 : d.getMonth() + 1;
    const y = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();

    ResearchSurveyService.getMonthlySummary(m, y)
      .then((data) => {
        if (isMounted) {
          setSummary(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpen = () => {
    if (onOpenSurveyModal) {
      onOpenSurveyModal();
    } else {
      window.dispatchEvent(new CustomEvent('smart_absensi_open_survey_analytics'));
    }
  };

  if (isLoading || !summary || summary.totalRespondents === 0) {
    return null;
  }

  const indicatorsList = Object.entries(summary.indicators) as [string, SurveyIndicatorSummary][];

  return (
    <section
      id="executive-survey-summary-widget"
      className={`bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs hover:border-[#287094]/40 transition-all space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#023246]/10 text-[#023246] flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-[#023246]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                Suara Guru &amp; Hasil Evaluasi Bersama
              </h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                100% Anonim
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium truncate">
              Evaluasi berkala seluruh pendidik, tingkat kepuasan sistem &amp; rencana tindak lanjut sekolah
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-[#023246] hover:bg-[#18536B] text-white text-xs font-black rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0 min-h-10"
        >
          <span>📊</span>
          <span>Buka Layer Suara Guru &amp; Solusi</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase flex items-center gap-1">
            <Users className="w-3 h-3 text-slate-400" />
            Guru Mengisi
          </span>
          <p className="text-xl font-black text-slate-900 mt-0.5">
            {summary.totalRespondents} Guru
          </p>
          <span className="text-[9.5px] text-slate-500 font-medium">Bulan Berjalan</span>
        </div>

        <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
          <span className="text-[10px] font-extrabold text-emerald-800 uppercase flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            Nilai Kepuasan
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-black text-emerald-700">
              {summary.overallMean.toFixed(2)}
            </span>
            <span className="text-[10px] font-medium text-emerald-600">/ 5.00</span>
          </div>
          <span className="text-[9.5px] font-bold text-emerald-700">Sangat Memuaskan</span>
        </div>

        <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-200/80">
          <span className="text-[10px] font-extrabold text-purple-800 uppercase">
            Bukti Manfaat
          </span>
          <p className="text-xl font-black text-purple-700 mt-0.5">
            {summary.hypotheses.filter((h) => h.isConfirmed).length} / 3
          </p>
          <span className="text-[9.5px] font-bold text-purple-700">Terbukti Nyata Baik</span>
        </div>

        <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80">
          <span className="text-[10px] font-extrabold text-amber-800 uppercase flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-amber-600" />
            Solusi Sekolah
          </span>
          <p className="text-xl font-black text-amber-700 mt-0.5">
            {summary.solutions ? summary.solutions.length : 4} Aksi
          </p>
          <span className="text-[9.5px] font-bold text-amber-700">Langkah Perbaikan</span>
        </div>
      </div>

      {/* Mini Visual Indicator Bars */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-slate-700">Skor Aspek Utama Guru:</span>
          <span className="text-[11px] text-slate-500 font-medium">Standar Baik: ≥ 3.80</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {indicatorsList.slice(0, 3).map(([key, ind]) => (
            <div key={key} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-800 truncate" title={ind.title}>
                  {ind.title.includes('(') ? ind.title.split('(')[0].trim() : ind.title}
                </span>
                <span className="font-black text-emerald-700 shrink-0 ml-1">
                  {ind.mean.toFixed(2)}
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full"
                  style={{ width: `${Math.min(100, (ind.mean / 5) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
