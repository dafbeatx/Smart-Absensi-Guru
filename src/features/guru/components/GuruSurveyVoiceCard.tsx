import React, { useState, useEffect } from 'react';
import { ResearchSurveyService } from '../../../services/research-survey.service';
import { getTodayDateInJakarta } from '../../../utils/time.utils';
import type { WeeklySurveySummary } from '../../../types/database.types';
import {
  BarChart3,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Lightbulb,
} from 'lucide-react';

export const GuruSurveyVoiceCard: React.FC = () => {
  const [summary, setSummary] = useState<WeeklySurveySummary | null>(null);

  useEffect(() => {
    let isMounted = true;
    const today = getTodayDateInJakarta();
    const d = new Date(today);
    const m = isNaN(d.getTime()) ? new Date().getMonth() + 1 : d.getMonth() + 1;
    const y = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();

    ResearchSurveyService.getMonthlySummary(m, y)
      .then((res) => {
        if (isMounted) setSummary(res);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpen = () => {
    window.dispatchEvent(new CustomEvent('smart_absensi_open_survey_analytics'));
  };

  if (!summary || summary.totalRespondents === 0) {
    return null;
  }

  return (
    <section
      id="guru-survey-voice-card"
      className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs hover:border-[#287094]/40 transition-all space-y-3.5"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 flex items-center justify-center shrink-0 shadow-2xs">
            <BarChart3 className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                Hasil Survey &amp; Suara Rekan Guru
              </h4>
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/70">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                100% Anonim
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
              Transparansi hasil kuesioner bersama &amp; tindak lanjut solusi sekolah
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-emerald-900 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 px-3 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95 shrink-0 shadow-2xs"
        >
          <span>Detail</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* Mini Highlights */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/70">
          <span className="text-[9.5px] font-extrabold text-slate-500 uppercase block">
            Rekan Terlibat
          </span>
          <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
            {summary.totalRespondents} Guru
          </p>
          <span className="text-[9px] text-slate-400 block font-medium">Bulan Ini</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/70">
          <span className="text-[9.5px] font-extrabold text-emerald-800 uppercase block flex items-center justify-center gap-0.5">
            <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
            Indeks Rerata
          </span>
          <p className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">
            {summary.overallMean.toFixed(2)}{' '}
            <span className="text-[10px] font-medium text-emerald-600">/ 5</span>
          </p>
          <span className="text-[9px] font-bold text-emerald-700 block">Sangat Positif</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-amber-50/70 border border-amber-200/70">
          <span className="text-[9.5px] font-extrabold text-amber-800 uppercase block flex items-center justify-center gap-0.5">
            <Lightbulb className="w-2.5 h-2.5 text-amber-600" />
            Solusi Nyata
          </span>
          <p className="text-base sm:text-lg font-black text-amber-700 mt-0.5">
            {summary.solutions ? summary.solutions.length : 4} Aksi
          </p>
          <span className="text-[9px] font-bold text-amber-700 block">Rencana Sekolah</span>
        </div>
      </div>

      {/* Action CTA Button */}
      <button
        type="button"
        id="btn-guru-open-survey-voice"
        onClick={handleOpen}
        className="w-full py-2.5 px-3.5 bg-gradient-to-r from-[#023246] to-[#18536B] hover:brightness-110 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 cursor-pointer"
      >
        <span>📈</span>
        <span>Buka Hasil Survey, Grafik &amp; Solusi Lengkap</span>
      </button>
    </section>
  );
};
