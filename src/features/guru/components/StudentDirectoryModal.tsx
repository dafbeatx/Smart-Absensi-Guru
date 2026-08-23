import React, { useState, useMemo } from 'react';

interface StudentDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClassFilter?: string;
}

interface StudentItem {
  id: string;
  nisn: string;
  fullName: string;
  className: string;
  gender: 'L' | 'P';
  parentName: string;
  parentPhone: string;
  attendanceRate: number;
}

export const StudentDirectoryModal: React.FC<StudentDirectoryModalProps> = ({
  isOpen,
  onClose,
  initialClassFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>(initialClassFilter || 'ALL');

  const classOptions = ['ALL', 'Kelas VII-A', 'Kelas VII-B', 'Kelas VIII-A', 'Kelas IX-B'];

  // Mock student directory list
  const students: StudentItem[] = [
    {
      id: 'std-1',
      nisn: '0081234567',
      fullName: 'Muhammad Rizky Pratama',
      className: 'Kelas VII-A',
      gender: 'L',
      parentName: 'H. Bambang Irawan',
      parentPhone: '081234567890',
      attendanceRate: 98,
    },
    {
      id: 'std-2',
      nisn: '0081234568',
      fullName: 'Alya Syakira Putri',
      className: 'Kelas VII-A',
      gender: 'P',
      parentName: 'Ir. Hendra Gunawan',
      parentPhone: '081234567891',
      attendanceRate: 95,
    },
    {
      id: 'std-3',
      nisn: '0081234569',
      fullName: 'Ahmad Raihan Al-Farizi',
      className: 'Kelas VII-A',
      gender: 'L',
      parentName: 'Dedi Kurniawan',
      parentPhone: '081234567892',
      attendanceRate: 92,
    },
    {
      id: 'std-4',
      nisn: '0081234570',
      fullName: 'Bagas Aditya Nugraha',
      className: 'Kelas VIII-A',
      gender: 'L',
      parentName: 'Agus Salim, S.E',
      parentPhone: '081234567893',
      attendanceRate: 96,
    },
    {
      id: 'std-5',
      nisn: '0081234571',
      fullName: 'Nabila Azzahra',
      className: 'Kelas IX-B',
      gender: 'P',
      parentName: 'Dra. Endang Sulastri',
      parentPhone: '081234567894',
      attendanceRate: 100,
    },
    {
      id: 'std-6',
      nisn: '0081234572',
      fullName: 'Dimas Fajar Ramadhan',
      className: 'Kelas VII-B',
      gender: 'L',
      parentName: 'Sunaryo',
      parentPhone: '081234567895',
      attendanceRate: 90,
    },
    {
      id: 'std-7',
      nisn: '0081234573',
      fullName: 'Zahra Cantika Putri',
      className: 'Kelas VII-B',
      gender: 'P',
      parentName: 'Mulyadi',
      parentPhone: '081234567896',
      attendanceRate: 94,
    },
  ];

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchClass = selectedClass === 'ALL' || s.className === selectedClass;
      const matchQuery =
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.nisn.includes(searchQuery);
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
              <h3 className="text-sm font-extrabold leading-tight truncate">Direktori Siswa & Kontak Wali</h3>
              <p className="text-[11px] text-emerald-300 font-semibold truncate">
                {filteredStudents.length} Siswa Ditemukan
              </p>
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

        {/* Search & Filter Bar */}
        <div className="p-3 px-4 bg-slate-50 border-b border-slate-200 space-y-2.5 shrink-0">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama siswa atau NISN..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-[#0D7A5F]"
            />
            <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Class Filter Horizontal Scroll */}
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
                {c === 'ALL' ? 'Semua Kelas' : c}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Student List */}
        <div className="p-4 space-y-2.5 overflow-y-auto flex-1">
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-3xl">👥</span>
              <p className="text-xs font-bold text-slate-700">Siswa Tidak Ditemukan</p>
              <p className="text-[11px] text-slate-400">Tidak ada siswa yang cocok dengan pencarian kata kunci.</p>
            </div>
          ) : (
            filteredStudents.map((std) => (
              <div
                key={std.id}
                className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs hover:border-slate-300 transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0 ${
                      std.gender === 'L' ? 'bg-blue-500' : 'bg-pink-500'
                    }`}>
                      {std.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-xs text-[#023246] leading-tight truncate">
                        {std.fullName}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        NISN: {std.nisn} • {std.className}
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-black rounded-lg border border-emerald-200 shrink-0">
                    {std.attendanceRate}% Hadir
                  </span>
                </div>

                {/* Parent / Wali Murid Info */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">Wali Murid:</span>
                    <span className="font-bold text-slate-800 text-[11px]">{std.parentName}</span>
                  </div>

                  <a
                    href={`https://wa.me/62${std.parentPhone.replace(/^0/, '')}?text=Assalamu%27alaikum%20Bapak%2FIbu%20${encodeURIComponent(std.parentName)}%2C%20saya%20guru%20wali%2Fpengajar%20dari%20ananda%20${encodeURIComponent(std.fullName)}.`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-xl flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all shrink-0"
                  >
                    <span>💬</span>
                    <span>Hubungi WA</span>
                  </a>
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
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center"
          >
            Tutup Direktori
          </button>
        </div>
      </div>
    </div>
  );
};
