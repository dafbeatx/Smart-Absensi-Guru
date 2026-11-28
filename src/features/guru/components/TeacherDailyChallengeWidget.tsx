import React, { useState } from 'react';
import type { TeacherStreakInfo, TeacherDailyQuest, NightlyMotivationMessage } from '../../../services/teacher-challenge.service';
import { Circle, ChevronRight, X } from 'lucide-react';
import {
  SagaChallengeTrophyIcon,
  SagaCheckBadgeIcon,
  SagaEmergencySosIcon,
  SagaMedalRankIcon,
  SagaNightMoonIcon,
  SagaSparkAiIcon,
} from '../../../components/ui/SagaServiceIcons';
import { isDateOffDay, getTomorrowDateInJakarta } from '../../../utils/time.utils';

interface TeacherDailyChallengeWidgetProps {
  streakInfo: TeacherStreakInfo;
  quests: TeacherDailyQuest[];
  nightlyMotivation?: NightlyMotivationMessage | null;
  onOpenChallengeModal: () => void;
  onOpenLeaderboard: () => void;
  onOpenQuestAction?: (actionType: 'MOOD' | 'COMPLAINT' | 'MERIT' | 'DEMERIT') => void;
  userRank?: number;
  totalPoints?: number;
  isTomorrowOff?: boolean;
}

export const TeacherDailyChallengeWidget: React.FC<TeacherDailyChallengeWidgetProps> = ({
  streakInfo,
  quests,
  nightlyMotivation,
  onOpenChallengeModal,
  onOpenLeaderboard,
  onOpenQuestAction,
  userRank = 1,
  totalPoints = 0,
  isTomorrowOff,
}) => {
  const [isDismissedNightly, setIsDismissedNightly] = useState(false);

  const completedCount = quests.filter((q) => q.status === 'COMPLETED').length;
  const totalQuests = quests.length;
  const progressPercent = totalQuests > 0 ? Math.round((completedCount / totalQuests) * 100) : 0;

  // Cek apakah waktu saat ini adalah sore/malam hari (≥ 18:00 WIB)
  const isNightTime = typeof window !== 'undefined' ? new Date().getHours() >= 18 || new Date().getHours() <= 5 : false;

  // Cek apakah hari esok adalah hari libur (Sabtu, Minggu, atau kalender libur sekolah)
  const isTomorrowHoliday = typeof isTomorrowOff === 'boolean'
    ? isTomorrowOff
    : (() => {
        if (typeof window === 'undefined') return false;
        const tomorrowStr = getTomorrowDateInJakarta();
        return isDateOffDay(tomorrowStr).isOff;
      })();

  return (
    <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
      {/* ── Top Header Ribbon: Streak & Rank Preview ──────────────────── */}
      <div className="p-3.5 sm:p-4 bg-[#0D5C46] text-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            <SagaChallengeTrophyIcon tone="dark" className="w-6 h-6" />
            {streakInfo.currentStreak > 0 && (
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px] leading-none">
                {streakInfo.currentStreak}d
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Tantangan Disiplin
              </span>
              <span className="text-[10px] font-mono text-emerald-100">• Bulan Berjalan</span>
            </div>
            <h4 className="text-sm font-bold text-white truncate leading-tight mt-0.5">
              {streakInfo.currentStreak > 0
                ? `${streakInfo.currentStreak} Hari Beruntun Tepat Waktu!`
                : 'Mulai Rekor Kedisiplinan Anda'}
            </h4>
          </div>
        </div>

        {/* Peringkat & Shortcut Leaderboard */}
        <button
          type="button"
          onClick={onOpenLeaderboard}
          className="px-2.5 py-1.5 min-h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-[0.98] border border-white/20 text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 group"
          title="Lihat Peringkat & Buku Besar Poin Disiplin Guru"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-300 shrink-0" title="Buku Besar Poin Tersinkronisasi" />
          <SagaMedalRankIcon rank={userRank <= 3 ? userRank : 1} tone="dark" className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold">#{userRank}</span>
          <span className="text-[10px] font-mono text-amber-200">({totalPoints})</span>
          <ChevronRight className="w-3.5 h-3.5 text-white/70 group-hover:text-white transition-colors" />
        </button>
      </div>

      {/* ── Weekly Day Streak Tracker (Senin s/d Jumat) ────────── */}
      <div className="px-3.5 sm:px-4 py-2.5 bg-[#F8FAFC] border-b border-slate-100 flex items-center justify-between gap-1.5">
        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide shrink-0">
          Pekan Ini:
        </span>
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1 justify-end">
          {streakInfo.streakDaysThisWeek.map((day) => (
            <div
              key={day.dayName}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border ${
                day.isCompleted
                  ? 'bg-emerald-50 border-emerald-200 text-[#0D5C46]'
                  : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              {day.isCompleted ? (
                <SagaCheckBadgeIcon className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-300 shrink-0" aria-hidden="true" />
              )}
              <span className="hidden xs:inline">{day.dayName}</span>
              <span className="xs:hidden">{day.dayName.charAt(0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Nightly Motivation Callout ──────── */}
      {isNightTime && nightlyMotivation && !isDismissedNightly && !isTomorrowHoliday && (
        <div className="m-3 sm:m-3.5 p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 relative">
          <div className="w-9 h-9 rounded-xl bg-white border border-amber-200 flex items-center justify-center shrink-0">
            <SagaNightMoonIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">
                Pengingat Malam Pendidik
              </span>
              <button
                type="button"
                onClick={() => setIsDismissedNightly(true)}
                aria-label="Tutup pengingat malam"
                className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-amber-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <h5 className="text-xs font-bold text-slate-900 leading-snug">
              {nightlyMotivation.title}
            </h5>
            <p className="text-xs text-slate-700 leading-relaxed font-normal">
              {nightlyMotivation.message}
            </p>
          </div>
        </div>
      )}

      {/* ── Daily Quests Section ─────────────────────────────────────────────── */}
      <div className="p-3.5 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <SagaSparkAiIcon className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold text-slate-900">Misi Harian Saya</span>
          </div>
          <span className="text-xs font-bold text-slate-500 font-mono">
            {completedCount}/{totalQuests} Selesai ({progressPercent}%)
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-[#0D5C46] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Quest Item List */}
        <div className="space-y-2 pt-1">
          {quests.map((quest) => {
            const isDone = quest.status === 'COMPLETED';
            const isFailed = quest.status === 'FAILED';

            return (
              <div
                key={quest.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 ${
                  isDone
                    ? 'bg-emerald-50/70 border-emerald-200 text-slate-800'
                    : isFailed
                    ? 'bg-rose-50/70 border-rose-200 text-slate-700'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="shrink-0">
                    {isDone ? (
                      <SagaCheckBadgeIcon className="w-5 h-5" />
                    ) : isFailed ? (
                      <SagaEmergencySosIcon className="w-5 h-5" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold truncate">{quest.title}</span>
                      {quest.category === 'ENGAGEMENT' ? (
                        <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 rounded">
                          Aktivitas
                        </span>
                      ) : quest.category === 'DUTY' ? (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 rounded">
                          Piket
                        </span>
                      ) : null}
                      {quest.completedAt && (
                        <span className="text-[10px] font-mono text-[#0D5C46] bg-emerald-100/70 px-1.5 rounded">
                          {quest.completedAt}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate leading-tight mt-0.5">
                      {quest.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                      isDone
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : isFailed
                        ? 'bg-rose-100 text-rose-900 border-rose-300'
                        : 'bg-amber-50 text-amber-900 border-amber-200'
                    }`}
                  >
                    +{quest.rewardPoints} PTS
                  </span>
                  {!isDone && quest.actionType && onOpenQuestAction && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenQuestAction(quest.actionType!);
                      }}
                      className="min-h-9 px-2.5 py-1 rounded-lg bg-[#0D5C46] hover:bg-[#094736] active:scale-[0.98] text-white text-xs font-bold cursor-pointer transition-colors"
                    >
                      Mulai
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom Action Trigger ────────────────────────────────────────────── */}
      <div className="px-3.5 sm:px-4 py-2.5 bg-[#F8FAFC] border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 truncate">
          Reset misi baru setiap pukul 00:00 WIB
        </span>

        <button
          type="button"
          onClick={onOpenChallengeModal}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#0D5C46] hover:text-[#094736] transition-colors cursor-pointer shrink-0 min-h-9 px-1"
        >
          <span>Papan Tantangan</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
