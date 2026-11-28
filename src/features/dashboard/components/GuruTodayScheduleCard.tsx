import React from 'react';
import {
  SagaClockStatusIcon,
  SagaEmptyScheduleIllustration,
  SagaMapPinIcon,
} from '../../../components/ui/SagaServiceIcons';

export interface GuruScheduleSlotPreview {
  subject: string;
  className: string;
  timeText: string;
  room: string;
}

export interface GuruTodayScheduleCardProps {
  todayDayName: string;
  totalTodaySlots: number;
  activeSlot: GuruScheduleSlotPreview | null;
  slotStatus: 'CURRENT' | 'NEXT' | 'FINISHED' | 'UPCOMING' | null;
  hasOtherDays: boolean;
  otherDaysSummary: string;
  onOpenSchedule: () => void;
}

export const GuruTodayScheduleCard: React.FC<GuruTodayScheduleCardProps> = ({
  todayDayName,
  totalTodaySlots,
  activeSlot,
  slotStatus,
  hasOtherDays,
  otherDaysSummary,
  onOpenSchedule,
}) => {
  if (totalTodaySlots === 0 || !activeSlot) {
    return (
      <section
        aria-label="Jadwal Mengajar Hari Ini"
        className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <SagaEmptyScheduleIllustration className="w-12 h-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-[#0F172A] leading-snug">
              Tidak Ada Jadwal Mengajar Hari Ini
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 truncate">
              {hasOtherDays
                ? `Jadwal tersedia pada hari ${otherDaysSummary}`
                : `Hari ${todayDayName}, belum ada jadwal terdaftar`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSchedule}
          className="min-h-11 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#0F172A] shrink-0 transition-colors cursor-pointer"
        >
          {hasOtherDays ? 'Lihat Jadwal' : 'Jadwal'}
        </button>
      </section>
    );
  }

  const badgeText =
    slotStatus === 'CURRENT'
      ? 'Sedang Berlangsung'
      : slotStatus === 'NEXT'
      ? 'Berikutnya'
      : slotStatus === 'FINISHED'
      ? 'Selesai'
      : 'Mendatang';

  const badgeStyle =
    slotStatus === 'CURRENT'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : slotStatus === 'NEXT'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : slotStatus === 'FINISHED'
      ? 'bg-slate-100 text-slate-700 border-slate-200'
      : 'bg-sky-50 text-sky-800 border-sky-200';

  return (
    <section
      aria-label="Jadwal Mengajar Hari Ini"
      className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
          <h3 className="text-sm font-bold text-[#0F172A]">
            Jadwal Mengajar Hari Ini
          </h3>
          <span className="text-xs font-medium text-slate-500">
            ({todayDayName})
          </span>
        </div>

        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${badgeStyle}`}
        >
          {badgeText}
        </span>
      </div>

      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm sm:text-base font-bold text-[#0F172A] truncate">
            {activeSlot.subject}
          </h4>
          <span className="px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#0F172A] shrink-0">
            {activeSlot.className}
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 font-medium">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <SagaClockStatusIcon className="w-4 h-4 text-[#0D5C46]" />
            <span>{activeSlot.timeText}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <SagaMapPinIcon className="w-4 h-4 text-slate-600" />
            <span>{activeSlot.room}</span>
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenSchedule}
        className="w-full min-h-11 px-2 rounded-xl hover:bg-slate-50 text-xs sm:text-sm font-semibold text-[#0D5C46] flex items-center justify-between transition-colors cursor-pointer"
      >
        <span>
          {totalTodaySlots > 1
            ? `Lihat semua jadwal hari ini (${totalTodaySlots} mapel)`
            : 'Lihat jadwal mingguan'}
        </span>
        <span aria-hidden="true">›</span>
      </button>
    </section>
  );
};
