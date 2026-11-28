import React, { useState, useEffect } from 'react';
import {
  shouldShowDailySurveyBanner,
  syncSurveyCompletionFromPointLogs,
} from '../../services/research-survey.service';
import { useAuthStore } from '../../store/useAuthStore';
import { ArrowRight, X } from 'lucide-react';
import { SagaAspirationIcon, SagaSparkAiIcon } from '../ui/SagaServiceIcons';

export interface DailySurveyReminderBannerProps {
  className?: string;
  onOpenSurveyModal?: () => void;
}

/**
 * Banner Pengingat Harian Pengisian Survey Evaluasi Sistem (+10 Poin)
 * Ditampilkan di Guru, Admin, dan Kepsek jika belum mengisi survey periode aktif berjalan.
 * Sepenuhnya responsif untuk smartphone guru (tidak ada teks terpotong / oversized).
 */
export const DailySurveyReminderBanner: React.FC<DailySurveyReminderBannerProps> = ({
  className = '',
  onOpenSurveyModal,
}) => {
  const { user } = useAuthStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setIsVisible(false);
      return;
    }

    // Periksa apakah sudah ditutup sementara di sesi browser saat ini
    const isSessionDismissed =
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem(`smart_absensi_survey_banner_dismissed_${user.id}`) === '1';

    if (isSessionDismissed) {
      setIsVisible(false);
      return;
    }

    // Evaluasi lokal tanpa query jaringan (Zero Egress)
    syncSurveyCompletionFromPointLogs(user.id);
    const needed = shouldShowDailySurveyBanner(user.id);
    setIsVisible(needed);

    // Event listener: saat survey selesai diisi, banner otomatis lenyap seketika
    const handleSurveyDone = () => {
      setIsVisible(false);
    };

    window.addEventListener('smart_absensi_survey_completed', handleSurveyDone);
    return () => {
      window.removeEventListener('smart_absensi_survey_completed', handleSurveyDone);
    };
  }, [user?.id]);

  if (!isVisible || !user) {
    return null;
  }

  const handleOpen = () => {
    if (onOpenSurveyModal) {
      onOpenSurveyModal();
    } else {
      window.dispatchEvent(new CustomEvent('smart_absensi_open_survey_modal'));
    }
  };

  const handleDismiss = () => {
    if (typeof sessionStorage !== 'undefined' && user?.id) {
      sessionStorage.setItem(`smart_absensi_survey_banner_dismissed_${user.id}`, '1');
    }
    setIsVisible(false);
  };

  return (
    <aside
      id="daily-survey-reminder-banner"
      aria-label="Pengingat Kuesioner Evaluasi Sekolah"
      className={`w-full bg-amber-50 border border-amber-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Konten Kiri */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white border border-amber-200 flex items-center justify-center shrink-0">
            <SagaAspirationIcon className="w-6 h-6" />
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                Evaluasi Sistem Sekolah Belum Diisi
              </h4>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-300 text-slate-950 uppercase tracking-wide shrink-0">
                <SagaSparkAiIcon className="w-3 h-3" />
                +10 Poin
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-snug font-normal">
              Suara Anda sangat berharga untuk peningkatan mutu aplikasi. Pengisian 100% anonim (hanya 1 menit).
            </p>
          </div>
        </div>

        {/* Tombol Aksi Kanan */}
        <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
          <button
            type="button"
            id="btn-survey-reminder-fill-now"
            onClick={handleOpen}
            className="flex-1 sm:flex-initial min-h-11 px-4 py-2 bg-[#0D5C46] hover:bg-[#094736] text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
          >
            <span>Isi Sekarang</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            id="btn-survey-reminder-dismiss"
            onClick={handleDismiss}
            aria-label="Tutup pengingat sementara"
            className="min-h-11 min-w-11 px-2.5 py-2 text-slate-600 hover:text-slate-900 hover:bg-amber-200/60 text-xs font-bold rounded-xl transition-colors flex items-center justify-center cursor-pointer"
            title="Nanti Saja"
          >
            <span className="hidden sm:inline mr-1 text-xs">Nanti</span>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
