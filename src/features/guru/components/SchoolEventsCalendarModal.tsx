import React, { useState } from 'react';
import { SoundService } from '../../../services/audio.service';
import { SpeechService } from '../../../services/speech.service';

interface SchoolEventsCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EventItem {
  id: string;
  date: string;
  title: string;
  category: 'RAPAT' | 'UPACARA' | 'UJIAN' | 'LIBUR' | 'WORKSHOP';
  time: string;
  location: string;
  description: string;
}

export const SchoolEventsCalendarModal: React.FC<SchoolEventsCalendarModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const events: EventItem[] = [
    {
      id: 'evt-1',
      date: '25 Agustus 2026',
      title: 'Rapat Koordinasi Evaluasi Pembelajaran & Disiplin Guru',
      category: 'RAPAT',
      time: '13:30 - 15:00 WIB',
      location: 'Ruang Rapat Guru (Lt. 2)',
      description: 'Membahas capaian KBM bulan Agustus, evaluasi presensi digital, dan persiapan Asesmen Nasional.',
    },
    {
      id: 'evt-2',
      date: '01 September 2026',
      title: 'Upacara Rutin Awal Bulan & Pembinaan Karakter Siswa',
      category: 'UPACARA',
      time: '06:45 - 07:45 WIB',
      location: 'Lapangan Utama Sekolah',
      description: 'Seluruh dewan guru dan staf wajib hadir mengenakan seragam dinas harian.',
    },
    {
      id: 'evt-3',
      date: '15 September 2026',
      title: 'Penilaian Tengah Semester (PTS) Ganjil TA 2026/2027',
      category: 'UJIAN',
      time: '07:30 - 12:00 WIB',
      location: 'Seluruh Ruang Kelas',
      description: 'Pelaksanaan PTS berbasis komputer (CBT) untuk jenjang kelas 7, 8, dan 9.',
    },
    {
      id: 'evt-4',
      date: '28 September 2026',
      title: 'Maulid Nabi Muhammad SAW (Hari Libur Nasional)',
      category: 'LIBUR',
      time: 'Sepanjang Hari',
      location: 'Nasional',
      description: 'Peringatan hari besar keagamaan dan libur resmi kegiatan KBM.',
    },
    {
      id: 'evt-5',
      date: '05 Oktober 2026',
      title: 'Workshop Penguatan Modul Pembelajaran Kurikulum Merdeka',
      category: 'WORKSHOP',
      time: '08:00 - 14:00 WIB',
      location: 'Aula Serbaguna',
      description: 'Pelatihan pembuatan modul ajar diferensiasi dan media pembelajaran digital.',
    },
  ];

  if (!isOpen) return null;

  const filteredEvents = events.filter((e) => {
    if (selectedCategory === 'ALL') return true;
    return e.category === selectedCategory;
  });

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'RAPAT':
        return <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-black rounded-lg">Rapat Guru</span>;
      case 'UPACARA':
        return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black rounded-lg">Upacara</span>;
      case 'UJIAN':
        return <span className="px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-black rounded-lg">Ujian PTS</span>;
      case 'LIBUR':
        return <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-black rounded-lg">Hari Libur</span>;
      case 'WORKSHOP':
        return <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black rounded-lg">Workshop</span>;
      default:
        return null;
    }
  };

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
              <p className="text-[11px] text-blue-300 font-semibold truncate">Tahun Ajaran 2026/2027</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-slate-200 transition-colors cursor-pointer text-sm font-bold shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Filter Pills */}
        <div className="p-3 px-4 bg-slate-50 border-b border-slate-200 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {[
            { key: 'ALL', label: 'Semua Agenda' },
            { key: 'RAPAT', label: 'Rapat' },
            { key: 'UPACARA', label: 'Upacara' },
            { key: 'UJIAN', label: 'Ujian' },
            { key: 'LIBUR', label: 'Libur' },
            { key: 'WORKSHOP', label: 'Workshop' },
          ].map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedCategory(cat.key)}
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

        {/* Content */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {filteredEvents.map((evt) => (
            <div
              key={evt.id}
              className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md inline-block mb-1">
                    📅 {evt.date}
                  </span>
                  <h4 className="font-extrabold text-xs text-[#023246] leading-tight">
                    {evt.title}
                  </h4>
                </div>
                {getCategoryBadge(evt.category)}
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                {evt.description}
              </p>

              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80 flex items-center justify-between text-[10px] text-slate-600 font-semibold">
                <span>⏰ {evt.time}</span>
                <span>📍 {evt.location}</span>
              </div>
            </div>
          ))}

          {/* Quick Alarm Test Tool */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5 flex items-center justify-between gap-2 text-xs">
            <div className="space-y-0.5">
              <h5 className="font-black text-[#023246]">Tes Alarm & Chime Acara KBM</h5>
              <p className="text-[10px] text-slate-500">Uji coba pengingat suara alarm bel KBM</p>
            </div>
            <button
              type="button"
              onClick={() => {
                SoundService.playNotificationChime();
                SpeechService.speak('Pengingat KBM: Jadwal KBM dan kegiatan sekolah berjalan sesuai kalender akademik.');
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black rounded-xl cursor-pointer shadow-xs active:scale-95 transition-all shrink-0"
            >
              🔔 Uji Suara
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center"
          >
            Tutup Kalender
          </button>
        </div>
      </div>
    </div>
  );
};
