import React, { useState } from 'react';
import type { RoleCode } from '../../../types/database.types';
import {
  ResearchSurveyService,
  markActiveSurveyCompleted,
} from '../../../services/research-survey.service';
import { ProviderFactory } from '../../../providers/provider-factory';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { getTodayDateInJakarta } from '../../../utils/time.utils';
import { X, Sparkles, ShieldCheck } from 'lucide-react';

export interface WeeklyResearchSurveyModalProps {
  isOpen: boolean;
  onCompleted: () => void;
  userId: string;
  userRole?: RoleCode;
}

interface QuestionItem {
  id: 'q1' | 'q2' | 'q3' | 'q4' | 'q5';
  title: string;
  dimension: string;
  description: string;
  labels: Record<number, string>;
}

const QUESTIONS: QuestionItem[] = [
  {
    id: 'q1',
    title: '1. Kemanfaatan Aplikasi (Perceived Usefulness)',
    dimension: 'TAM - Usefulness & Productivity',
    description: 'Seberapa besar aplikasi ini mempermudah pencatatan dan monitoring kehadiran Anda di sekolah?',
    labels: {
      1: 'Sangat Tidak Bermanfaat',
      2: 'Kurang Bermanfaat',
      3: 'Cukup Bermanfaat',
      4: 'Bermanfaat',
      5: 'Sangat Bermanfaat',
    },
  },
  {
    id: 'q2',
    title: '2. Motivasi & Semangat Hadir (Extrinsic Motivation)',
    dimension: 'TAM - Motivation & Gamification',
    description: 'Apakah sistem poin reward, challenge harian, dan lencana memotivasi Anda untuk hadir tepat waktu?',
    labels: {
      1: 'Sangat Tidak Memotivasi',
      2: 'Kurang Memotivasi',
      3: 'Cukup Memotivasi',
      4: 'Memotivasi',
      5: 'Sangat Memotivasi',
    },
  },
  {
    id: 'q3',
    title: '3. Kemudahan Penggunaan (Perceived Ease of Use)',
    dimension: 'TAM - Usability & Efficiency',
    description: 'Seberapa mudah dan responsif antarmuka (UI) aplikasi saat digunakan untuk absensi harian?',
    labels: {
      1: 'Sangat Sulit Digunakan',
      2: 'Cukup Sulit / Rumit',
      3: 'Cukup Mudah',
      4: 'Mudah & Cepat',
      5: 'Sangat Mudah & Praktis',
    },
  },
  {
    id: 'q4',
    title: '4. Keadilan & Transparansi Sistem (Fairness & Trust)',
    dimension: 'Organizational Justice & Integrity',
    description: 'Apakah sistem absensi (akurasi GPS, validasi QR, aturan waktu) terasa adil dan transparan?',
    labels: {
      1: 'Sangat Tidak Adil',
      2: 'Kurang Adil',
      3: 'Cukup Adil & Wajar',
      4: 'Adil & Transparan',
      5: 'Sangat Adil & Obyektif',
    },
  },
  {
    id: 'q5',
    title: '5. Dampak Budaya Disiplin Sekolah (Institutional Impact)',
    dimension: 'Institutional Culture & Work Ethics',
    description: 'Secara keseluruhan, seberapa besar dampak positif aplikasi ini terhadap ketertiban dan budaya disiplin sekolah?',
    labels: {
      1: 'Tidak Berdampak Sama Sekali',
      2: 'Kurang Berdampak',
      3: 'Cukup Berdampak Positif',
      4: 'Berdampak Positif Nyata',
      5: 'Sangat Berdampak Signifikan',
    },
  },
];

export const WeeklyResearchSurveyModal: React.FC<WeeklyResearchSurveyModalProps> = ({
  isOpen,
  onCompleted,
  userId,
  userRole = 'GURU',
}) => {
  const [scores, setScores] = useState<Record<string, number>>({
    q1: 0,
    q2: 0,
    q3: 0,
    q4: 0,
    q5: 0,
  });
  const [nextWeekEvaluation, setNextWeekEvaluation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const answeredCount =
    Object.values(scores).filter((v) => v > 0).length +
    (nextWeekEvaluation.trim().length >= 5 ? 1 : 0);
  const totalQuestions = 6;
  const isFormValid =
    scores.q1 > 0 &&
    scores.q2 > 0 &&
    scores.q3 > 0 &&
    scores.q4 > 0 &&
    scores.q5 > 0 &&
    nextWeekEvaluation.trim().length >= 5;

  const handleScoreSelect = (qId: string, val: number) => {
    setScores((prev) => ({ ...prev, [qId]: val }));
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const todayStr = getTodayDateInJakarta();
      const dateObj = new Date(todayStr);
      const m = isNaN(dateObj.getTime()) ? new Date().getMonth() + 1 : dateObj.getMonth() + 1;
      const y = isNaN(dateObj.getTime()) ? new Date().getFullYear() : dateObj.getFullYear();
      const day = isNaN(dateObj.getTime()) ? new Date().getDate() : dateObj.getDate();
      const weekNum = Math.ceil(day / 7);

      // Submit 100% anonymous survey (no userId / no personal identifier included)
      await ResearchSurveyService.submitSurvey({
        role: userRole,
        q1_usefulness: scores.q1,
        q2_motivation: scores.q2,
        q3_ease_of_use: scores.q3,
        q4_fairness: scores.q4,
        q5_impact: scores.q5,
        next_week_evaluation: nextWeekEvaluation.trim(),
        date: todayStr,
        week_number: weekNum,
        month: m,
        year: y,
      });

      // Mark locally so user is not prompted again for this active cycle & day
      markActiveSurveyCompleted(userId, todayStr);

      // 🌟 Berikan apresiasi +10 Poin Kedisiplinan & Partisipasi ke akun pengguna
      if (userId) {
        try {
          const token = useAuthStore.getState().token || '';
          const currentAuth = useAuthStore.getState().user;
          const teacherName = currentAuth?.full_name || 'Bapak/Ibu Pendidik';

          await ProviderFactory.getProvider().recordTeacherPoint(
            {
              user_id: userId,
              teacher_name: teacherName,
              date: todayStr,
              points: 10,
              activity_type: 'SURVEY_PARTICIPATION',
              title: 'Apresiasi Partisipasi Survey TAM',
              description: 'Menyelesaikan pengisian kuesioner evaluasi riset & sistem sekolah (+10 Poin)',
            },
            token || undefined
          );

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('smart_absensi_points_updated', {
                detail: {
                  userId: userId,
                  teacherName: teacherName,
                  points: 10,
                  title: 'Apresiasi Partisipasi Survey TAM',
                  description: 'Menyelesaikan pengisian kuesioner evaluasi riset (+10 Poin)',
                  activity_type: 'SURVEY_PARTICIPATION',
                },
              })
            );
          }
        } catch (ptErr) {
          console.warn('Failed to award survey points:', ptErr);
        }
      }

      useToastStore.getState().showToast(
        'success',
        'Survey Terkirim & +10 Poin Didapatkan! 🌟',
        'Terima kasih atas partisipasi Anda dalam evaluasi mutu aplikasi sekolah.'
      );

      setIsSubmitted(true);
      setTimeout(() => {
        onCompleted();
      }, 2500);
    } catch (err) {
      console.warn('Failed to submit weekly survey:', err);
      // Even if network fails, ensure user experience isn't blocked indefinitely
      markActiveSurveyCompleted(userId);
      setIsSubmitted(true);
      setTimeout(() => {
        onCompleted();
      }, 2500);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Kuesioner Evaluasi Sistem Sekolah"
    >
      <div className="relative w-full max-w-xl max-h-[92dvh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
        {/* Header Section */}
        <div className="bg-linear-to-r from-emerald-700 via-teal-700 to-slate-900 text-white p-4 sm:p-5 shrink-0">
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold bg-emerald-500/25 border border-emerald-400/40 text-emerald-200">
              <span>📋</span> Kuesioner Evaluasi Sistem
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-amber-400 text-slate-950 shadow-2xs">
                <Sparkles className="w-2.5 h-2.5 text-slate-950" />
                +10 Poin
              </span>
              <span className="text-xs font-bold text-emerald-200/90">
                {answeredCount}/{totalQuestions}
              </span>
              <button
                type="button"
                onClick={onCompleted}
                aria-label="Tutup kuesioner"
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer ml-1"
                title="Tutup / Nanti Saja"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <h2 className="text-base sm:text-lg font-extrabold text-white leading-tight">
            Evaluasi Efektivitas Aplikasi Sekolah
          </h2>
          <p className="text-[11px] sm:text-xs text-emerald-100/90 mt-0.5 leading-relaxed">
            Penelitian kuantitatif model TAM &amp; evaluasi berkala demi penjaminan mutu sistem sekolah.
          </p>

          {/* Anonymity Banner */}
          <div className="mt-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-2.5 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-50 leading-relaxed">
              <strong className="text-white font-extrabold">100% Anonim &amp; Rahasia:</strong> Identitas pribadi (Nama, NPP, Telepon) tidak dicatat. Pengisian hanya membutuhkan waktu ~1 menit.
            </div>
          </div>
        </div>

        {/* Modal Body */}
        {isSubmitted ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl animate-bounce shadow-md">
              ✓
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900">Terima Kasih Banyak!</h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md leading-relaxed">
              Tanggapan Anda telah tersimpan secara <strong>100% anonim</strong> dan Anda memperoleh <strong>+10 Poin</strong> apresiasi.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Menutup jendela evaluasi...
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
              />
            </div>

            {/* Questions 1 to 5 */}
            {QUESTIONS.map((q) => {
              const currentScore = scores[q.id];
              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    currentScore > 0
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                      {q.title}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0">
                      {q.dimension}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mb-3">{q.description}</p>

                  {/* Rating Selector Buttons (1 to 5) */}
                  <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const isSelected = currentScore === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          id={`btn-survey-${q.id}-${val}`}
                          onClick={() => handleScoreSelect(q.id, val)}
                          className={`min-h-11 py-2 px-1 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 active:scale-95 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-102 ring-2 ring-emerald-500'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <span className="text-sm">{isSelected ? '★' : val}</span>
                          <span className="text-[10px] font-bold hidden sm:inline">
                            Skor {val}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Label Display */}
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">1: Sangat Rendah</span>
                    {currentScore > 0 ? (
                      <span className="font-extrabold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                        {q.labels[currentScore]}
                      </span>
                    ) : (
                      <span className="text-amber-600 font-medium italic">Wajib dipilih</span>
                    )}
                    <span className="text-slate-400">5: Sangat Tinggi</span>
                  </div>
                </div>
              );
            })}

            {/* Question 6: Evaluasi & Harapan Minggu Depan */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                nextWeekEvaluation.trim().length >= 5
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                  6. Evaluasi & Harapan untuk Minggu Depan
                </h4>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 shrink-0">
                  Wajib Diisi
                </span>
              </div>

              <p className="text-xs text-slate-600 mb-2">
                Tuliskan evaluasi kendala minggu ini serta masukan/harapan konkret untuk perbaikan sistem absensi maupun agenda sekolah minggu depan.
              </p>

              <textarea
                id="survey-next-week-evaluation-input"
                rows={3}
                value={nextWeekEvaluation}
                onChange={(e) => {
                  setNextWeekEvaluation(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="Contoh: Aplikasi sudah sangat cepat, harap pertahankan. Untuk minggu depan mohon ditambahkan pengingat jadwal piket pada pagi hari..."
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400 resize-none transition-all"
              />

              <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                <span>Minimal 5 karakter</span>
                <span
                  className={
                    nextWeekEvaluation.trim().length >= 5
                      ? 'text-emerald-600 font-bold'
                      : 'text-amber-600'
                  }
                >
                  {nextWeekEvaluation.trim().length} karakter
                </span>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center">
                {errorMessage}
              </div>
            )}

            {/* Footer Action */}
            <div className="pt-2 sticky bottom-0 bg-white/95 backdrop-blur-sm pb-1">
              <button
                type="submit"
                id="btn-submit-weekly-survey"
                disabled={!isFormValid || isSubmitting}
                className={`w-full h-12 rounded-2xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                  isFormValid && !isSubmitting
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98 shadow-emerald-600/30'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan Respons Anonim...</span>
                  </>
                ) : (
                  <>
                    <span>Kirim Tanggapan Anonim Saya</span>
                    <span>➔</span>
                  </>
                )}
              </button>

              {!isFormValid && (
                <p className="text-[11px] text-slate-400 text-center mt-2 font-medium">
                  Lengkapi 5 penilaian di atas dan tuliskan kolom evaluasi untuk mengaktifkan tombol kirim.
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
