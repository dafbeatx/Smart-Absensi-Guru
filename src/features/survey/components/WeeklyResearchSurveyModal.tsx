import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { RoleCode } from '../../../types/database.types';
import {
  ResearchSurveyService,
  markActiveSurveyCompleted,
} from '../../../services/research-survey.service';
import { ProviderFactory } from '../../../providers/provider-factory';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { getTodayDateInJakarta } from '../../../utils/time.utils';
import { BackNavigationService, BACK_PRIORITIES } from '../../../services/back-navigation.service';
import { Sparkles, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

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

  // 🛡️ 5-Press Back Navigation Guard State
  const [backPressCount, setBackPressCount] = useState(0);
  const lastPressTimeRef = useRef<number>(0);
  const pressCountRef = useRef<number>(0);
  const unregisterRef = useRef<(() => void) | null>(null);

  // Fungsi register guard ke BackNavigationService
  const registerBackGuard = useCallback((onBackAttemptFn: () => boolean) => {
    if (unregisterRef.current) {
      unregisterRef.current();
      unregisterRef.current = null;
    }
    unregisterRef.current = BackNavigationService.register({
      id: 'weekly-research-survey-guard',
      onBack: onBackAttemptFn,
      priority: BACK_PRIORITIES.OVERLAY + 10,
      title: 'Kuesioner Evaluasi Mingguan',
      pushHistory: true,
    });
  }, []);

  // Handler interupsi navigasi kembali: cegah exit sebelum 5 kali ditekan
  const handleBackAttempt = useCallback((): boolean => {
    const now = Date.now();
    const timeSinceLast = now - lastPressTimeRef.current;

    let newCount = pressCountRef.current + 1;
    // Reset counter jika jeda antar tekanan lebih dari 4 detik (mencegah akumulasi tidak sengaja)
    if (timeSinceLast > 4000) {
      newCount = 1;
    }

    lastPressTimeRef.current = now;
    pressCountRef.current = newCount;
    setBackPressCount(newCount);

    const remaining = 5 - newCount;

    if (remaining > 0) {
      useToastStore.getState().showToast(
        'warning',
        `Survei Evaluasi Wajib Diisi (${remaining}x lagi)`,
        `Survei mingguan wajib diisi untuk penjaminan mutu. Tekan tombol kembali ${remaining} kali lagi untuk keluar tanpa mengisi.`
      );

      // Re-register handler ke stack navigasi kembali agar tekanan berikutnya tetap terhadang
      setTimeout(() => {
        registerBackGuard(handleBackAttempt);
      }, 15);

      return true; // Ditangani: batalkan navigasi keluar
    } else {
      // Tekanan ke-5 tercapai: berikan izin keluar ("baru bisa left")
      useToastStore.getState().showToast(
        'info',
        'Keluar dari Survei Mingguan',
        'Anda telah keluar dari pengisian survei evaluasi mingguan.'
      );
      markActiveSurveyCompleted(userId);
      onCompleted();
      return true;
    }
  }, [userId, onCompleted, registerBackGuard]);

  const handleBackAttemptRef = useRef(handleBackAttempt);
  handleBackAttemptRef.current = handleBackAttempt;

  // Registrasi back guard saat modal terbuka (stabil: tidak memicu cleanup saat parent re-render)
  useEffect(() => {
    if (!isOpen || isSubmitted) return;

    registerBackGuard(() => handleBackAttemptRef.current());

    return () => {
      if (unregisterRef.current) {
        unregisterRef.current();
        unregisterRef.current = null;
      }
    };
  }, [isOpen, isSubmitted, registerBackGuard]);

  // Tangkap tombol Escape pada keyboard fisik desktop/laptop
  useEffect(() => {
    if (!isOpen || isSubmitted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleBackAttempt();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isOpen, isSubmitted, handleBackAttempt]);

  // Kunci scroll body saat tampilan full screen aktif
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

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
      className="fixed inset-0 z-60 w-full h-dvh bg-slate-950 flex flex-col overflow-hidden text-slate-100 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Kuesioner Evaluasi Sistem Sekolah"
    >
      {/* 1. STICKY TOP HEADER (Full-width, zero margins, no X button) */}
      <header className="bg-linear-to-r from-emerald-900 via-teal-900 to-slate-950 border-b border-emerald-800/40 text-white shrink-0 pt-[max(12px,env(safe-area-inset-top))] px-4 sm:px-6 py-3.5 shadow-md">
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
              <span>📋</span> Kuesioner Evaluasi Mingguan
            </span>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 shadow-2xs">
                <Sparkles className="w-3 h-3 text-slate-950" />
                +10 Poin
              </span>
              <span className="text-xs font-extrabold text-emerald-200 bg-white/10 px-2.5 py-1 rounded-full border border-white/15">
                {answeredCount} / {totalQuestions} Terjawab
              </span>
              {/* Note: Tombol 'X' dihilangkan total sesuai instruksi */}
            </div>
          </div>

          <h1 className="text-base sm:text-xl font-black text-white leading-tight tracking-tight">
            Evaluasi Efektivitas Aplikasi Sekolah
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 leading-relaxed">
            Penelitian kuantitatif model TAM &amp; evaluasi berkala demi penjaminan mutu sistem sekolah.
          </p>

          {/* Anonymity Banner */}
          <div className="mt-3 bg-emerald-950/60 border border-emerald-600/30 rounded-xl p-2.5 sm:p-3 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-100/90 leading-relaxed">
              <strong className="text-emerald-200 font-extrabold">100% Anonim &amp; Terjaga:</strong> Identitas pribadi (Nama, NPP, Kontak) tidak dicatat dalam hasil riset. Pengisian hanya membutuhkan waktu ~1 menit.
            </div>
          </div>
        </div>
      </header>

      {/* ⚠️ Exit Attempt Warning Banner (if back button was pressed < 5 times) */}
      {backPressCount > 0 && 5 - backPressCount > 0 && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-amber-200 text-xs flex items-center justify-between shrink-0 animate-fade-in">
          <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate sm:whitespace-normal">
                Survei wajib diisi. Tekan tombol kembali <strong>{5 - backPressCount} kali lagi</strong> untuk keluar tanpa menyimpan.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-extrabold text-[11px] shrink-0">
              {backPressCount}/5
            </span>
          </div>
        </div>
      )}

      {/* 2. SCROLLABLE WORKSPACE */}
      {isSubmitted ? (
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-xl animate-scale-up">
            <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Terima Kasih Banyak!</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md leading-relaxed">
            Tanggapan Anda telah tersimpan secara <strong className="text-emerald-300">100% anonim</strong> dan Anda memperoleh <strong className="text-amber-300">+10 Poin</strong> apresiasi.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold shadow-md">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            Menutup jendela evaluasi...
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">
            <div className="max-w-3xl mx-auto w-full space-y-5">
              {/* Progress Bar */}
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-linear-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
                />
              </div>

              {/* Questions 1 to 5 */}
              {QUESTIONS.map((q) => {
                const currentScore = scores[q.id];
                const isAnswered = currentScore > 0;
                return (
                  <div
                    key={q.id}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                      isAnswered
                        ? 'bg-slate-900/90 border-emerald-500/40 ring-1 ring-emerald-500/20 shadow-md'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-extrabold text-white leading-snug">
                        {q.title}
                      </h3>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 shrink-0">
                        {q.dimension}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-300 mb-4 leading-relaxed">
                      {q.description}
                    </p>

                    {/* Rating Selector Buttons (1 to 5) - Large Thumb Targets */}
                    <div className="grid grid-cols-5 gap-2 sm:gap-3">
                      {[1, 2, 3, 4, 5].map((val) => {
                        const isSelected = currentScore === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            id={`btn-survey-${q.id}-${val}`}
                            onClick={() => handleScoreSelect(q.id, val)}
                            className={`min-h-[50px] sm:min-h-[56px] py-2.5 px-1 rounded-xl text-xs sm:text-sm font-black transition-all flex flex-col items-center justify-center gap-1 active:scale-95 cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] ring-2 ring-emerald-400'
                                : 'bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60'
                            }`}
                          >
                            <span className="text-base sm:text-lg">{isSelected ? '★' : val}</span>
                            <span className="text-[10px] sm:text-xs font-bold">
                              Skor {val}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected Label Display */}
                    <div className="mt-3 flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                      <span className="text-slate-500 font-medium">1: Sangat Rendah</span>
                      {isAnswered ? (
                        <span className="font-extrabold text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-800/50">
                          {q.labels[currentScore]}
                        </span>
                      ) : (
                        <span className="text-amber-400 font-semibold italic text-[11px]">Wajib dipilih</span>
                      )}
                      <span className="text-slate-500 font-medium">5: Sangat Tinggi</span>
                    </div>
                  </div>
                );
              })}

              {/* Question 6: Evaluasi & Harapan Minggu Depan */}
              <div
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  nextWeekEvaluation.trim().length >= 5
                    ? 'bg-slate-900/90 border-emerald-500/40 ring-1 ring-emerald-500/20 shadow-md'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-extrabold text-white leading-snug">
                    6. Evaluasi & Harapan untuk Minggu Depan
                  </h3>
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40 shrink-0">
                    Wajib Diisi
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 mb-3 leading-relaxed">
                  Tuliskan evaluasi kendala minggu ini serta masukan/harapan konkret untuk perbaikan sistem absensi maupun agenda sekolah minggu depan.
                </p>

                <textarea
                  id="survey-next-week-evaluation-input"
                  rows={4}
                  value={nextWeekEvaluation}
                  onChange={(e) => {
                    setNextWeekEvaluation(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Contoh: Aplikasi sudah sangat cepat dan stabil. Harap tambahkan pengingat jadwal piket pagi minggu depan..."
                  className="w-full text-xs sm:text-sm p-3.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-none transition-all"
                />

                <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                  <span>Minimal 5 karakter</span>
                  <span
                    className={
                      nextWeekEvaluation.trim().length >= 5
                        ? 'text-emerald-400 font-bold'
                        : 'text-amber-400 font-medium'
                    }
                  >
                    {nextWeekEvaluation.trim().length} karakter
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-bold text-center">
                  {errorMessage}
                </div>
              )}
            </div>
          </div>

          {/* 3. STICKY BOTTOM ACTION BAR (Thumb Zone, Full Viewport Width) */}
          <footer className="sticky bottom-0 z-20 w-full bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-4 sm:px-6 py-3.5 pb-[max(16px,env(safe-area-inset-bottom))] shrink-0">
            <div className="max-w-3xl mx-auto w-full">
              <button
                type="submit"
                id="btn-submit-weekly-survey"
                disabled={!isFormValid || isSubmitting}
                className={`w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                  isFormValid && !isSubmitting
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-98 shadow-emerald-600/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan Respons Anonim...</span>
                  </>
                ) : (
                  <>
                    <span>Kirim Tanggapan Anonim Saya (+10 Poin)</span>
                    <span>➔</span>
                  </>
                )}
              </button>

              {!isFormValid && (
                <p className="text-[11px] sm:text-xs text-slate-400 text-center mt-2 font-medium">
                  Lengkapi 5 penilaian skala di atas dan tuliskan kolom evaluasi untuk mengaktifkan tombol kirim.
                </p>
              )}
            </div>
          </footer>
        </form>
      )}
    </div>
  );
};
