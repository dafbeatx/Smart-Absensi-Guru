import React, { useState } from 'react';
import type { TeacherStreakInfo, TeacherDailyQuest, NightlyMotivationMessage } from '../../../services/teacher-challenge.service';
import { CheckCircle2, Circle, Trophy, ChevronRight, Moon, Sparkles } from 'lucide-react';

interface TeacherDailyChallengeWidgetProps {
  streakInfo: TeacherStreakInfo;
  quests: TeacherDailyQuest[];
  nightlyMotivation?: NightlyMotivationMessage;
  onOpenChallengeModal: () => void;
  onOpenLeaderboard: () => void;
  onOpenQuestAction?: (actionType: 'MOOD' | 'COMPLAINT' | 'MERIT' | 'DEMERIT') => void;
  userRank?: number;
  totalPoints?: number;
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
}) => {
  const [isDismissedNightly, setIsDismissedNightly] = useState(false);

  const completedCount = quests.filter((q) => q.status === 'COMPLETED').length;
  const totalQuests = quests.length;
  const progressPercent = totalQuests > 0 ? Math.round((completedCount / totalQuests) * 100) : 0;

  // Cek apakah waktu saat ini adalah sore/malam hari (≥ 18:00 WIB)
  const isNightTime = typeof window !== 'undefined' ? new Date().getHours() >= 18 || new Date().getHours() <= 5 : false;

  return (
    <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-2xs overflow-hidden transition-all duration-200 hover:shadow-xs">
      {/* ── Top Header Ribbon: Flame Streak & Rank Preview ──────────────────── */}
      <div className="p-3.5 sm:p-4 bg-linear-to-r from-[#023246] via-[#0A4158] to-[#18536B] text-white flex items-center justify-between gap-3">
        {/* Streak Flame Pill */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-xl shrink-0 shadow-inner">
            <span className="animate-pulse">🔥</span>
            {streakInfo.currentStreak > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-black text-[9px] shadow-xs">
                {streakInfo.currentStreak}d
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                Tantangan Disiplin
              </span>
              <span className="text-[9px] font-mono text-cyan-200">• Bulan Berjalan</span>
            </div>
            <h4 className="text-xs sm:text-sm font-black text-white truncate leading-tight mt-0.5">
              {streakInfo.currentStreak > 0
                ? `${streakInfo.currentStreak} Hari Beruntun Tepat Waktu!`
                : 'Mulai Nyalakan Api Rekor!'}
            </h4>
          </div>
        </div>

        {/* Peringkat & Shortcut Leaderboard */}
        <button
          type="button"
          onClick={onOpenLeaderboard}
          className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 text-white flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-2xs"
          title="Lihat Peringkat Disiplin Guru"
        >
          <Trophy className="w-3.5 h-3.5 text-amber-300" />
          <span className="text-[11px] font-black">#{userRank}</span>
          <span className="text-[9.5px] font-mono text-amber-200">({totalPoints} PTS)</span>
        </button>
      </div>

      {/* ── Weekly Day Streak Tracker (Duolingo Style: Senin s/d Jumat) ────────── */}
      <div className="px-3.5 sm:px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-1.5">
        <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wide shrink-0">
          Pekan Ini:
        </span>
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1 justify-end">
          {streakInfo.streakDaysThisWeek.map((day) => (
            <div
              key={day.dayName}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-bold border transition-all ${
                day.isCompleted
                  ? 'bg-amber-100 border-amber-300 text-amber-950 font-black shadow-3xs'
                  : 'bg-white border-slate-200 text-slate-400'
              }`}
            >
              <span>{day.isCompleted ? '🔥' : '⚪'}</span>
              <span className="hidden xs:inline">{day.dayName}</span>
              <span className="xs:hidden">{day.dayName.charAt(0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Nightly Duolingo-Style Motivation Callout (Aktif Saat Malam) ──────── */}
      {isNightTime && nightlyMotivation && !isDismissedNightly && (
        <div className="m-3 sm:m-3.5 p-3 rounded-2xl bg-linear-to-r from-amber-500/10 via-amber-50 to-orange-50 border border-amber-200/90 flex items-start gap-2.5 relative animate-fade-in">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-300 flex items-center justify-center text-base shrink-0">
            <span>{nightlyMotivation.icon || '🦉'}</span>
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wide flex items-center gap-1">
                <Moon className="w-3 h-3 text-amber-700" />
                Pengingat Malam Pendidik
              </span>
              <button
                type="button"
                onClick={() => setIsDismissedNightly(true)}
                className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <h5 className="text-xs font-black text-slate-900 leading-snug">
              {nightlyMotivation.title}
            </h5>
            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
              {nightlyMotivation.message}
            </p>
          </div>
        </div>
      )}

      {/* ── Daily Quests Section ─────────────────────────────────────────────── */}
      <div className="p-3.5 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-black text-[#023246]">Misi Harian Saya</span>
          </div>
          <span className="text-[10.5px] font-bold text-slate-500 font-mono">
            {completedCount}/{totalQuests} Selesai ({progressPercent}%)
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-emerald-500 to-[#18536B] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Quest Item List */}
        <div className="space-y-1.5 pt-1">
          {quests.map((quest) => {
            const isDone = quest.status === 'COMPLETED';
            const isFailed = quest.status === 'FAILED';

            return (
              <div
                key={quest.id}
                className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                  isDone
                    ? 'bg-emerald-50/60 border-emerald-200/90 text-slate-800'
                    : isFailed
                    ? 'bg-rose-50/50 border-rose-200/70 text-slate-600 opacity-80'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="shrink-0 text-base">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : isFailed ? (
                      <span className="text-sm">⚠️</span>
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black truncate">{quest.title}</span>
                      {quest.category === 'ENGAGEMENT' ? (
                        <span className="text-[9px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-1 rounded">
                          Aktivitas
                        </span>
                      ) : quest.category === 'DUTY' ? (
                        <span className="text-[9px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-1 rounded">
                          Piket
                        </span>
                      ) : null}
                      {quest.completedAt && (
                        <span className="text-[9.5px] font-mono text-emerald-700 bg-emerald-100/70 px-1 rounded">
                          {quest.completedAt}
                        </span>
                      )}
                    </div>
                    <p className="text-[10.5px] text-slate-500 truncate leading-tight mt-0.5">
                      {quest.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                      isDone
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : isFailed
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
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
                      className="px-2 py-0.5 rounded-md bg-[#023246] hover:bg-[#034560] active:scale-95 text-white text-[10px] font-bold cursor-pointer transition-all shadow-2xs"
                    >
                      Mulai ›
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom Action Trigger ────────────────────────────────────────────── */}
      <div className="px-3.5 sm:px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[10.5px] font-medium text-slate-500 truncate">
          Reset misi baru setiap pukul 00:00 WIB
        </span>

        <button
          type="button"
          onClick={onOpenChallengeModal}
          className="inline-flex items-center gap-1 text-xs font-black text-[#18536B] hover:text-[#023246] transition-colors cursor-pointer shrink-0"
        >
          <span>Papan Tantangan</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
