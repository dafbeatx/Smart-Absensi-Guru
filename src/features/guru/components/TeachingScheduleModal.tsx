import React, { useState, useEffect, useCallback } from 'react';
import type { TeachingSlot, UserProfile } from '../../../types/database.types';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  TeachingScheduleRepository,
  TEACHING_SCHEDULES_UPDATED_EVENT,
} from '../../../repositories/TeachingScheduleRepository';
import {
  normalizeDayOfWeek,
  sortTeachingSlots,
  sanitizeTimeString,
  getDayNameIndonesian,
} from '../../../utils/teaching-schedule.utils';

interface TeachingScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule?: TeachingSlot[];
  user?: UserProfile;
}

export const defaultTeachingSchedule: TeachingSlot[] = [];

export const TeachingScheduleModal: React.FC<TeachingScheduleModalProps> = ({
  isOpen,
  onClose,
  schedule,
  user: propUser,
}) => {
  const { user: authUser } = useAuthStore();
  const effectiveUser = propUser || authUser;
  const days = ['Semua', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const [selectedDay, setSelectedDay] = useState('Semua');
  const [activeSchedules, setActiveSchedules] = useState<TeachingSlot[]>([]);

  const loadSchedules = useCallback(async () => {
    if (schedule !== undefined) {
      setActiveSchedules(sortTeachingSlots(schedule));
      return;
    }

    if (!effectiveUser?.id) {
      setActiveSchedules([]);
      return;
    }

    const userSlots = await TeachingScheduleRepository.getTeacherSchedules(
      effectiveUser.id
    );
    setActiveSchedules(sortTeachingSlots(userSlots));
  }, [schedule, effectiveUser]);

  useEffect(() => {
    if (!isOpen) return;

    loadSchedules();

    window.addEventListener(TEACHING_SCHEDULES_UPDATED_EVENT, loadSchedules);
    return () => {
      window.removeEventListener(TEACHING_SCHEDULES_UPDATED_EVENT, loadSchedules);
    };
  }, [isOpen, loadSchedules]);

  if (!isOpen) return null;

  const targetDayNum = selectedDay === 'Semua' ? null : normalizeDayOfWeek(selectedDay);

  const filteredSchedule = selectedDay === 'Semua'
    ? activeSchedules
    : activeSchedules.filter((s) => {
        const slotDay = normalizeDayOfWeek(s.day_of_week !== undefined ? s.day_of_week : s.day);
        return slotDay === targetDayNum;
      });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 animate-fadeIn">
      {/* Mobile Full-Screen 100dvh Container (Infinix Note 8 Mandate) */}
      <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[88vh] sm:max-w-md rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border sm:border-slate-100 overflow-hidden flex flex-col">
        
        {/* Sticky Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#0D7A5F] rounded-2xl flex items-center justify-center text-white text-base shadow-xs">
              📅
            </div>
            <div>
              <h3 className="text-sm font-extrabold leading-tight">Jadwal Mengajar Guru</h3>
              <p className="text-[11px] text-emerald-300 font-medium">SMP Terpadu Al-Ittihadiyah</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup Jadwal"
            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-slate-200 transition-colors cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Day Filter Pills */}
        <div className="p-3 px-5 bg-slate-50 border-b border-slate-200 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {days.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`py-1.5 px-3 rounded-full text-[10px] font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                selectedDay === d
                  ? 'bg-[#0D7A5F] text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Official Recess Badge */}
        <div className="mx-4 mt-3 p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-center justify-between text-amber-900 text-xs shrink-0">
          <div className="flex items-center gap-1.5 font-bold">
            <span>☕</span>
            <span>Istirahat KBM:</span>
          </div>
          <span className="font-mono font-black text-[11px] bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300/60">
            09:30 - 10:00 WIB
          </span>
        </div>

        {/* Schedule Items List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          {filteredSchedule.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-medium space-y-1.5 px-4">
              <span className="text-3xl block">📋</span>
              <p className="font-extrabold text-[#023246]">Belum Ada Jadwal Mengajar</p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                {selectedDay === 'Semua'
                  ? 'Admin/Operator sekolah belum menginput jadwal mengajar untuk akun Anda. Silakan hubungi bagian kurikulum.'
                  : `Tidak ada jadwal mengajar pada hari ${selectedDay}.`}
              </p>
            </div>
          ) : (
            filteredSchedule.map((slot) => {
              const displayDay = slot.day || (slot.day_of_week != null ? getDayNameIndonesian(slot.day_of_week) : 'Senin');
              const displayTime = slot.start_time && slot.end_time
                ? `${sanitizeTimeString(slot.start_time)} - ${sanitizeTimeString(slot.end_time)}`
                : slot.time
                  ? slot.time.replace(' WIB', '').split('-').map((t) => sanitizeTimeString(t.trim())).join(' - ')
                  : '08:00 - 08:40';

              return (
                <div
                  key={slot.id}
                  className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between hover:border-emerald-300 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-[#0D7A5F] rounded-md border border-emerald-200">
                        {displayDay}
                      </span>
                      <span className="text-xs font-extrabold text-[#023246] truncate">
                        {slot.className}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-600 font-semibold truncate">
                      <span>📖 {slot.subject}</span>
                    </div>
                  </div>

                  <div className="text-right space-y-1 shrink-0 ml-3">
                    <div className="text-[10px] font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                      ⏱️ {displayTime}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      📍 {slot.room}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Bottom Action Bar (Thumb-friendly for Infinix Note 8) */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-center shrink-0">
          <button
            onClick={onClose}
            className="w-full h-11 bg-[#023246] hover:bg-[#03445e] text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-xs active:scale-98"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
