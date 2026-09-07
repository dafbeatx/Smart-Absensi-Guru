import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { StudentItem } from '../../../types/database.types';
import { StudentRepository, STUDENTS_UPDATED_EVENT } from '../../../repositories/StudentRepository';
import { CreditCard, School, Search, X } from 'lucide-react';

interface StudentDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClassFilter?: string;
}

export const StudentDirectoryModal: React.FC<StudentDirectoryModalProps> = ({
  isOpen,
  onClose,
  initialClassFilter,
}) => {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>(initialClassFilter || 'ALL');

  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await StudentRepository.getStudents();
      setStudents(data || []);
    } catch (err) {
      console.warn('Gagal memuat direktori siswa:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadStudents();
      if (initialClassFilter) {
        setSelectedClass(initialClassFilter);
      }
    }
  }, [isOpen, initialClassFilter, loadStudents]);

  useEffect(() => {
    const handleUpdated = () => {
      loadStudents();
    };

    window.addEventListener(STUDENTS_UPDATED_EVENT, handleUpdated);
    window.addEventListener('storage', handleUpdated);

    return () => {
      window.removeEventListener(STUDENTS_UPDATED_EVENT, handleUpdated);
      window.removeEventListener('storage', handleUpdated);
    };
  }, [loadStudents]);

  // Derive unique class options from actual student data
  const classOptions = useMemo(() => {
    const classes = Array.from(new Set(students.map((s) => s.className).filter(Boolean))).sort();
    return ['ALL', ...classes];
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchClass = selectedClass === 'ALL' || s.className === selectedClass;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        (s.nisn && s.nisn.toLowerCase().includes(q)) ||
        (s.rfidUid && s.rfidUid.toLowerCase().includes(q)) ||
        s.className.toLowerCase().includes(q);
      return matchClass && matchQuery;
    });
  }, [students, selectedClass, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-120 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-xs shrink-0">
              🎓
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold leading-tight truncate">Direktori Siswa & Kartu RFID</h3>
              <p className="text-[11px] text-emerald-300 font-semibold truncate">
                {isLoading ? 'Memuat data...' : `${filteredStudents.length} Siswa Aktif Ditemukan`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-slate-200 transition-colors cursor-pointer text-sm font-bold shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 px-4 bg-slate-50 border-b border-slate-200 space-y-2.5 shrink-0">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama siswa, kelas, atau UID RFID..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
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

          {/* Class Filter Horizontal Scroll */}
          {classOptions.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {classOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedClass(c)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                    selectedClass === c
                      ? 'bg-[#0D7A5F] text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {c === 'ALL' ? 'Semua Kelas' : `Kelas ${c}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable Student List */}
        <div className="p-4 space-y-2.5 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="w-8 h-8 border-3 border-[#0D7A5F] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Memuat direktori siswa...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
              <span className="text-4xl">👥</span>
              <h4 className="text-xs font-extrabold text-slate-800">Direktori Siswa Masih Kosong</h4>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                Belum ada data siswa aktif yang disinkronkan. Admin dapat menyinkronkan data siswa dari GradeMaster.
              </p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-3xl">🔍</span>
              <p className="text-xs font-bold text-slate-700">Siswa Tidak Ditemukan</p>
              <p className="text-[11px] text-slate-400">Tidak ada siswa yang cocok dengan filter atau kata kunci pencarian.</p>
            </div>
          ) : (
            filteredStudents.map((std) => (
              <div
                key={std.id}
                className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs hover:border-slate-300 transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0 ${
                        std.gender === 'L' ? 'bg-blue-600' : 'bg-pink-600'
                      }`}
                    >
                      {std.fullName ? std.fullName.charAt(0).toUpperCase() : 'S'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-xs text-[#023246] leading-tight truncate">
                        {std.fullName}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold block truncate">
                        {std.nisn ? `NISN: ${std.nisn} • ` : ''}Kelas {std.className} {std.gender ? `(${std.gender === 'L' ? 'Laki-laki' : 'Perempuan'})` : ''}
                      </span>
                    </div>
                  </div>

                  {std.attendanceRate != null && (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-black rounded-lg border border-emerald-200 shrink-0">
                      {std.attendanceRate}% Hadir
                    </span>
                  )}
                </div>

                {/* RFID & Class Info Bar */}
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <School className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-700">Kelas {std.className}</span>
                  </div>

                  {std.rfidUid ? (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-mono font-bold flex items-center gap-1 border border-emerald-200">
                      <CreditCard className="w-3 h-3 text-emerald-600" />
                      UID: {std.rfidUid}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Belum pasang RFID</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 px-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-[#023246] hover:bg-[#023246]/90 text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center"
          >
            Tutup Direktori
          </button>
        </div>
      </div>
    </div>
  );
};
