import React, { useState } from 'react';
import { X, Calendar, Clock, BookOpen, MapPin } from 'lucide-react';
import { TeachingSlot } from '../types';

interface TeachingScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: TeachingSlot[];
}

export const TeachingScheduleModal: React.FC<TeachingScheduleModalProps> = ({
  isOpen,
  onClose,
  schedule
}) => {
  const days = ['Semua', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
  const [selectedDay, setSelectedDay] = useState('Semua');

  if (!isOpen) return null;

  const filteredSchedule = selectedDay === 'Semua' 
    ? schedule 
    : schedule.filter(s => s.day === selectedDay);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[412px] rounded-t-[32px] sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[88vh]">
        
        {/* Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 rounded-xl text-white">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight">Jadwal Mengajar Guru</h3>
              <p className="text-[10px] text-emerald-300 font-medium">SMP Terpadu Al-Ittihadiyah</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-slate-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Day Pills Filter */}
        <div className="p-3 px-5 bg-slate-50 border-b border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar">
          {days.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`py-1.5 px-3 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                selectedDay === d
                  ? 'bg-[#0D7A5F] text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Schedule List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {filteredSchedule.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Tidak ada jadwal mengajar pada hari {selectedDay}.
            </div>
          ) : (
            filteredSchedule.map((slot) => (
              <div
                key={slot.id}
                className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs flex items-center justify-between hover:border-emerald-200 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 bg-emerald-50 text-[#0D7A5F] rounded border border-emerald-100">
                      {slot.day}
                    </span>
                    <span className="text-xs font-extrabold text-[#023246]">
                      {slot.className}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                    <BookOpen size={12} className="text-slate-400" />
                    <span>{slot.subject}</span>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 justify-end">
                    <Clock size={11} className="text-slate-400" />
                    <span>{slot.time}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-slate-400 justify-end">
                    <MapPin size={10} />
                    <span>{slot.room}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-600 hover:text-slate-800"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
