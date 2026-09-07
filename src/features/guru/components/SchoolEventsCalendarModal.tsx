import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { HolidayRecord } from '../../../types/database.types';
import { ProviderFactory } from '../../../providers/provider-factory';
import { SoundService } from '../../../services/audio.service';
import { SpeechService } from '../../../services/speech.service';
import { getTodayDateInJakarta } from '../../../utils/time.utils';
import { Search, RefreshCw, X } from 'lucide-react';

interface SchoolEventsCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialHolidays?: HolidayRecord[];
}

type EventCategory = 'ALL' | 'AGENDA' | 'LIBUR' | 'RAPAT' | 'UPACARA' | 'UJIAN' | 'WORKSHOP';

export const SchoolEventsCalendarModal: React.FC<SchoolEventsCalendarModalProps> = ({
  isOpen,
  onClose,
  initialHolidays,
}) => {
  const [holidays, setHolidays] = useState<HolidayRecord[]>(initialHolidays || []);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<EventCategory>('ALL');

  const todayStr = getTodayDateInJakarta();

  // Load latest holidays from backend provider
  const loadHolidays = useCallback(async () => {
    setIsLoading(true);
    try {
      const provider = ProviderFactory.getProvider();
      const list = await provider.getHolidays();
      if (Array.isArray(list)) {
        // Sort chronologically ascending
        const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
        setHolidays(sorted);
      }
    } catch (err) {
      console.warn('Gagal memuat kalender akademik sekolah:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch when opened
  useEffect(() => {
    if (isOpen) {
      if (initialHolidays && initialHolidays.length > 0) {
        setHolidays([...initialHolidays].sort((a, b) => a.date.localeCompare(b.date)));
      }
      loadHolidays();
    }
  }, [isOpen, initialHolidays, loadHolidays]);

  // Live real-time listener for admin updates
  useEffect(() => {
    const handleHolidaysUpdated = () => {
      loadHolidays();
    };

    window.addEventListener('smart_absensi_holidays_updated', handleHolidaysUpdated);
    window.addEventListener('smart_absensi_records_updated', handleHolidaysUpdated);
    window.addEventListener('storage', handleHolidaysUpdated);

    return () => {
      window.removeEventListener('smart_absensi_holidays_updated', handleHolidaysUpdated);
      window.removeEventListener('smart_absensi_records_updated', handleHolidaysUpdated);
      window.removeEventListener('storage', handleHolidaysUpdated);
    };
  }, [loadHolidays]);

  // Helper to categorize holiday record
  const getEventCategory = useCallback((item: HolidayRecord): EventCategory => {
    const text = `${item.name} ${item.description || ''}`.toLowerCase();
    if (text.includes('rapat') || text.includes('evaluasi') || text.includes('koordinasi') || text.includes('musyawarah')) {
      return 'RAPAT';
    }
    if (text.includes('upacara') || text.includes('apel') || text.includes('harlah') || text.includes('peringatan hari')) {
      return 'UPACARA';
    }
    if (
      text.includes('ujian') ||
      text.includes('pts') ||
      text.includes('pas') ||
      text.includes('pat') ||
      text.includes('asesmen') ||
      text.includes('cbt') ||
      text.includes('tes')
    ) {
      return 'UJIAN';
    }
    if (
      text.includes('workshop') ||
      text.includes('pelatihan') ||
      text.includes('bimtek') ||
      text.includes('seminar') ||
      text.includes('iht') ||
      text.includes('lokakarya')
    ) {
      return 'WORKSHOP';
    }
    if (item.type === 'NATIONAL_HOLIDAY' || item.type === 'SCHOOL_HOLIDAY' || item.type === 'CUTI_BERSAMA') {
      return 'LIBUR';
    }
    return 'AGENDA';
  }, []);

  // Format date helper: "2026-08-17" -> "Senin, 17 Agustus 2026"
  const formatIndonesianDate = (dateString: string) => {
    try {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, monthIndex, day);
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const monthNames = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        const dayName = dayNames[dateObj.getDay()] || '';
        const monthName = monthNames[monthIndex] || '';
        return `${dayName}, ${day} ${monthName} ${year}`;
      }
    } catch {
      // Fallback
    }
    return dateString;
  };

  // Filtered list
  const filteredEvents = useMemo(() => {
    return holidays.filter((item) => {
      const category = getEventCategory(item);
      const matchCategory =
        selectedCategory === 'ALL' ||
        category === selectedCategory ||
        (selectedCategory === 'AGENDA' && category !== 'LIBUR');

      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        item.date.includes(q);

      return matchCategory && matchQuery;
    });
  }, [holidays, selectedCategory, searchQuery, getEventCategory]);

  const getCategoryBadge = (item: HolidayRecord) => {
    const cat = getEventCategory(item);
    switch (cat) {
      case 'RAPAT':
        return <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-black rounded-lg shrink-0">👥 Rapat Guru</span>;
      case 'UPACARA':
        return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black rounded-lg shrink-0">🏛️ Upacara</span>;
      case 'UJIAN':
        return <span className="px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-black rounded-lg shrink-0">🎓 Ujian PTS/PAS</span>;
      case 'WORKSHOP':
        return <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black rounded-lg shrink-0">💡 Workshop</span>;
      case 'LIBUR':
        if (item.type === 'NATIONAL_HOLIDAY') {
          return <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-black rounded-lg shrink-0">🔴 Libur Nasional</span>;
        }
        if (item.type === 'CUTI_BERSAMA') {
          return <span className="px-2 py-0.5 bg-orange-50 text-orange-800 border border-orange-200 text-[10px] font-black rounded-lg shrink-0">🗓️ Cuti Bersama</span>;
        }
        return <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-black rounded-lg shrink-0">🏫 Libur Sekolah</span>;
      default:
        return <span className="px-2 py-0.5 bg-cyan-50 text-cyan-800 border border-cyan-200 text-[10px] font-black rounded-lg shrink-0">📢 Agenda Sekolah</span>;
    }
  };

  const getTimelineStatusBadge = (dateStr: string) => {
    if (dateStr === todayStr) {
      return (
        <span className="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-black rounded-full animate-pulse shadow-2xs">
          Hari Ini
        </span>
      );
    }
    if (dateStr > todayStr) {
      return (
        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-extrabold rounded-md">
          Akan Datang
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-semibold rounded-md">
        Terlewat
      </span>
    );
  };

  const nextUpcomingEvent = useMemo(() => {
    return holidays.find((h) => h.date >= todayStr);
  }, [holidays, todayStr]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-120 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-xs shrink-0">
              📅
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold leading-tight truncate">Kalender Acara & Agenda Sekolah</h3>
              <p className="text-[11px] text-cyan-300 font-semibold truncate">
                {isLoading ? 'Menyelaraskan data...' : `${holidays.length} Agenda Resmi Terpadu`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => loadHolidays()}
              disabled={isLoading}
              className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 rounded-full text-slate-200 transition-all cursor-pointer text-xs"
              title="Perbarui Sinkronisasi"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-300' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-slate-200 transition-colors cursor-pointer text-sm font-bold"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Filter Pills */}
        <div className="p-3 px-4 bg-slate-50 border-b border-slate-200 space-y-2.5 shrink-0">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari acara, tanggal, atau kegiatan..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Horizontal Scroll */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { key: 'ALL', label: 'Semua' },
              { key: 'AGENDA', label: '📢 Agenda Acara' },
              { key: 'LIBUR', label: '🔴 Hari Libur' },
              { key: 'RAPAT', label: '👥 Rapat' },
              { key: 'UPACARA', label: '🏛️ Upacara' },
              { key: 'UJIAN', label: '🎓 Ujian' },
              { key: 'WORKSHOP', label: '💡 Workshop' },
            ].map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key as EventCategory)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.key
                    ? 'bg-[#023246] text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content List */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {isLoading && holidays.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 text-slate-500">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold text-slate-600">Menyinkronkan Kalender Sekolah...</p>
              <p className="text-[10px] text-slate-400">Mengambil agenda resmi yang diatur oleh Admin</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
              <span className="text-3xl">🗓️</span>
              <p className="font-extrabold text-slate-700 text-xs">Tidak Ada Agenda Ditemukan</p>
              <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                {searchQuery
                  ? `Tidak ada agenda yang cocok dengan kata kunci "${searchQuery}".`
                  : 'Belum ada agenda pada kategori ini. Seluruh pembaruan dari Admin akan langsung muncul di sini.'}
              </p>
            </div>
          ) : (
            filteredEvents.map((evt) => (
              <div
                key={evt.id}
                className={`p-3.5 sm:p-4 bg-white rounded-2xl border transition-all space-y-2 shadow-2xs hover:shadow-xs ${
                  evt.date === todayStr
                    ? 'border-emerald-300 ring-1 ring-emerald-400/30 bg-emerald-50/20'
                    : evt.date > todayStr
                    ? 'border-slate-200 hover:border-blue-300'
                    : 'border-slate-100 opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="text-[10px] font-black text-blue-800 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md inline-block">
                        📅 {formatIndonesianDate(evt.date)}
                      </span>
                      {getTimelineStatusBadge(evt.date)}
                    </div>
                    <h4 className="font-extrabold text-xs text-[#023246] leading-snug">
                      {evt.name}
                    </h4>
                  </div>
                  {getCategoryBadge(evt)}
                </div>

                {evt.description && (
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    {evt.description}
                  </p>
                )}

                <div className="bg-slate-50 p-2 px-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-[10px] text-slate-600 font-semibold">
                  <span>⏰ Sesuai Kalender Akademik</span>
                  <span className="font-mono text-[9px] text-slate-400">ID: {evt.id.substring(0, 10)}</span>
                </div>
              </div>
            ))
          )}

          {/* Quick Alarm & Announcement Test Tool */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5 flex items-center justify-between gap-2 text-xs mt-2">
            <div className="space-y-0.5 min-w-0">
              <h5 className="font-black text-[#023246] truncate">Pengingat Audio Kalender KBM</h5>
              <p className="text-[10px] text-slate-500 truncate">
                {nextUpcomingEvent
                  ? `Agenda terdekat: ${nextUpcomingEvent.name}`
                  : 'Uji suara pengumuman agenda sekolah'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                SoundService.playNotificationChime();
                if (nextUpcomingEvent) {
                  SpeechService.speak(
                    `Pengingat Kalender Sekolah: ${nextUpcomingEvent.name}, pada tanggal ${formatIndonesianDate(
                      nextUpcomingEvent.date
                    )}.`
                  );
                } else {
                  SpeechService.speak('Pengingat KBM: Jadwal KBM dan kegiatan sekolah berjalan sesuai kalender akademik.');
                }
              }}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[11px] font-black rounded-xl cursor-pointer shadow-xs transition-all shrink-0 min-h-11 flex items-center gap-1.5"
            >
              <span>🔔 Uji Suara</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center flex items-center justify-center"
          >
            Tutup Kalender
          </button>
        </div>
      </div>
    </div>
  );
};
