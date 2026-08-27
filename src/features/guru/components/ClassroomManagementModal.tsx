import React, { useState, useEffect } from 'react';
import type { UserProfile, StudentItem } from '../../../types/database.types';
import { StudentRepository, STUDENTS_UPDATED_EVENT } from '../../../repositories/StudentRepository';

interface ClassroomManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onOpenSchedule?: () => void;
  onOpenStudentDirectory?: (selectedClass?: string) => void;
}

interface ClassRoomInfo {
  id: string;
  className: string;
  grade: string;
  totalStudents: number;
  roomName: string;
  subject: string;
  scheduleSummary: string;
  homeroomTeacher: string;
  classPresident: string;
  color: string;
}

export const ClassroomManagementModal: React.FC<ClassroomManagementModalProps> = ({
  isOpen,
  onClose,
  user,
  onOpenSchedule,
  onOpenStudentDirectory,
}) => {
  const [selectedClass, setSelectedClass] = useState<ClassRoomInfo | null>(null);
  const [students, setStudents] = useState<StudentItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      StudentRepository.getStudents().then((res) => {
        setStudents(res || []);
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdated = () => {
      StudentRepository.getStudents().then((res) => {
        setStudents(res || []);
      });
    };
    window.addEventListener(STUDENTS_UPDATED_EVENT, handleUpdated);
    window.addEventListener('storage', handleUpdated);
    return () => {
      window.removeEventListener(STUDENTS_UPDATED_EVENT, handleUpdated);
      window.removeEventListener('storage', handleUpdated);
    };
  }, []);

  if (!isOpen) return null;

  const getStudentCount = (clsName: string, fallback: number) => {
    const matching = students.filter((s) => s.className === clsName);
    return matching.length > 0 ? matching.length : fallback;
  };

  // Assigned classes for teacher based on teaching subject
  const sampleClasses: ClassRoomInfo[] = [
    {
      id: 'cls-7a',
      className: 'Kelas VII-A',
      grade: 'Kelas 7',
      totalStudents: getStudentCount('Kelas VII-A', 0),
      roomName: 'Ruang 101 (Gedung Utama Lt. 1)',
      subject: user.position?.includes('Informatika') ? 'Informatika' : 'Mata Pelajaran Wajib',
      scheduleSummary: 'Senin (07:30 - 09:00), Rabu (10:00 - 11:30)',
      homeroomTeacher: 'Siti Aminah, S.Pd',
      classPresident: 'Ketua Kelas VII-A',
      color: 'from-teal-500 to-emerald-600',
    },
    {
      id: 'cls-7b',
      className: 'Kelas VII-B',
      grade: 'Kelas 7',
      totalStudents: getStudentCount('Kelas VII-B', 0),
      roomName: 'Ruang 102 (Gedung Utama Lt. 1)',
      subject: user.position?.includes('Informatika') ? 'Informatika' : 'Mata Pelajaran Wajib',
      scheduleSummary: 'Selasa (08:30 - 10:00), Kamis (07:30 - 09:00)',
      homeroomTeacher: 'Ahmad Fauzi, M.Pd',
      classPresident: 'Ketua Kelas VII-B',
      color: 'from-blue-500 to-indigo-600',
    },
    {
      id: 'cls-8a',
      className: 'Kelas VIII-A',
      grade: 'Kelas 8',
      totalStudents: getStudentCount('Kelas VIII-A', 0),
      roomName: 'Ruang 201 (Gedung Barat Lt. 2)',
      subject: user.position?.includes('Informatika') ? 'Informatika' : 'Mata Pelajaran Wajib',
      scheduleSummary: 'Rabu (07:30 - 09:00), Jumat (08:00 - 09:30)',
      homeroomTeacher: 'Dra. Hj. Nurjanah',
      classPresident: 'Ketua Kelas VIII-A',
      color: 'from-purple-500 to-violet-600',
    },
    {
      id: 'cls-9b',
      className: 'Kelas IX-B',
      grade: 'Kelas 9',
      totalStudents: getStudentCount('Kelas IX-B', 0),
      roomName: 'Ruang Lab Komputer 1',
      subject: user.position?.includes('Informatika') ? 'Informatika' : 'Mata Pelajaran Wajib',
      scheduleSummary: 'Kamis (09:30 - 11:00), Jumat (09:45 - 11:15)',
      homeroomTeacher: 'Budi Santoso, S.Kom',
      classPresident: 'Ketua Kelas IX-B',
      color: 'from-amber-500 to-orange-600',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-120 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-cyan-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-xs shrink-0">
              👥
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold leading-tight truncate">Rombel & Kelas Yang Diampu</h3>
              <p className="text-[11px] text-cyan-300 font-semibold truncate">{sampleClasses.length} Kelas Aktif Semester Ini</p>
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

        {/* Scrollable Content */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 gap-2.5">
            {sampleClasses.map((cls) => (
              <div
                key={cls.id}
                onClick={() => setSelectedClass(cls)}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-cyan-400 hover:shadow-md transition-all cursor-pointer space-y-2.5 active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${cls.color} text-white flex items-center justify-center font-black text-xs shadow-2xs`}>
                      {cls.grade.split(' ')[1]}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-[#023246] leading-tight">
                        {cls.className}
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400">
                        {cls.totalStudents} Siswa • {cls.roomName}
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 bg-cyan-50 text-cyan-800 text-[10px] font-black rounded-lg border border-cyan-200">
                    Aktif
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Mapel:</span>
                    <span className="font-black text-slate-800">{cls.subject}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Jadwal:</span>
                    <span className="font-bold text-[#0D7A5F]">{cls.scheduleSummary}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                  <span className="text-slate-500">Wali Kelas: <strong>{cls.homeroomTeacher}</strong></span>
                  <span className="text-cyan-700 font-bold">Detail Kelas →</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-4 bg-slate-50 border-t border-slate-200 flex gap-2 shrink-0">
          {onOpenSchedule && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSchedule();
              }}
              className="flex-1 py-2.5 bg-[#0D7A5F] hover:bg-[#095744] text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center shadow-xs"
            >
              📅 Buka Jadwal KBM
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Class Detail Modal Popup */}
      {selectedClass && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-105 rounded-3xl p-5 border border-slate-200 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-11 h-11 rounded-2xl bg-linear-to-br ${selectedClass.color} text-white flex items-center justify-center font-black text-sm shadow-2xs`}>
                  {selectedClass.grade.split(' ')[1]}
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#023246] leading-tight">
                    {selectedClass.className}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {selectedClass.roomName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClass(null)}
                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full flex items-center justify-center font-bold text-xs cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Mata Pelajaran:</span>
                  <span className="font-black text-slate-800">{selectedClass.subject}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Jumlah Siswa:</span>
                  <span className="font-bold text-slate-800">{selectedClass.totalStudents} Siswa</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Ketua Kelas:</span>
                  <span className="font-bold text-slate-800">{selectedClass.classPresident}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Wali Kelas:</span>
                  <span className="font-bold text-slate-800">{selectedClass.homeroomTeacher}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Jadwal Jam Pelajaran:</span>
                  <span className="font-black text-[#0D7A5F]">{selectedClass.scheduleSummary}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {onOpenStudentDirectory && (
                <button
                  type="button"
                  onClick={() => {
                    const clsName = selectedClass.className;
                    setSelectedClass(null);
                    onClose();
                    onOpenStudentDirectory(clsName);
                  }}
                  className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center shadow-xs"
                >
                  👥 Direktori Siswa
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedClass(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center"
              >
                Kembali
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
