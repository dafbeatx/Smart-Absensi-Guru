import React, { useState } from 'react';
import type { TeachingSlot } from '../../../types/database.types';

interface TeachingScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule?: TeachingSlot[];
}

export const defaultTeachingSchedule: TeachingSlot[] = [
  { id: '1', day: 'Senin', time: '07:30 - 08:50 WIB', className: 'Kelas VII-A', subject: 'Matematika Terpadu', room: 'Ruang Teori 7A' },
  { id: '2', day: 'Senin', time: '09:00 - 10:20 WIB', className: 'Kelas VIII-B', subject: 'Matematika Lanjutan', room: 'Ruang Teori 8B' },
  { id: '3', day: 'Selasa', time: '08:00 - 09:20 WIB', className: 'Kelas IX-A', subject: 'Matematika UN / Asesmen', room: 'Lab Komputer A' },
  { id: '4', day: 'Selasa', time: '10:30 - 11:50 WIB', className: 'Kelas VII-B', subject: 'Matematika Terpadu', room: 'Ruang Teori 7B' },
  { id: '5', day: 'Rabu', time: '07:30 - 08:50 WIB', className: 'Kelas VIII-A', subject: 'Matematika Lanjutan', room: 'Ruang Teori 8A' },
  { id: '6', day: 'Rabu', time: '09:00 - 10:20 WIB', className: 'Kelas IX-B', subject: 'Matematika UN / Asesmen', room: 'Lab Komputer B' },
  { id: '7', day: 'Kamis', time: '08:00 - 09:20 WIB', className: 'Kelas VII-A', subject: 'Pengayaan & Remedial', room: 'Ruang Teori 7A' },
  { id: '8', day: 'Jumat', time: '07:30 - 08:30 WIB', className: 'Kelas IX-A', subject: 'Bimbingan Matematika', room: 'Ruang Teori 9A' },
];

export const TeachingScheduleModal: React.FC<TeachingScheduleModalProps> = ({
  isOpen,
  onClose,
  schedule = defaultTeachingSchedule,
}) => {
  const days = ['Semua', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
  const [selectedDay, setSelectedDay] = useState('Semua');

  if (!isOpen) return null;

  const filteredSchedule = selectedDay === 'Semua' 
    ? schedule 
    : schedule.filter(s => s.day === selectedDay);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-105 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[88vh]">
        
        {/* Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between">
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
            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-slate-200 transition-colors cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Day Filter Pills */}
        <div className="p-3 px-5 bg-slate-50 border-b border-slate-200 flex gap-1.5 overflow-x-auto no-scrollbar">
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

        {/* Schedule Items List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          {filteredSchedule.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs font-medium space-y-1">
              <span className="text-2xl block">☕</span>
              <p className="font-bold text-slate-600">Tidak Ada Jadwal Mengajar</p>
              <p className="text-[11px]">Tidak ada jam mengajar pada hari {selectedDay}.</p>
            </div>
          ) : (
            filteredSchedule.map((slot) => (
              <div
                key={slot.id}
                className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between hover:border-emerald-300 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-[#0D7A5F] rounded-md border border-emerald-200">
                      {slot.day}
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
                    ⏱️ {slot.time}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    📍 {slot.room}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
