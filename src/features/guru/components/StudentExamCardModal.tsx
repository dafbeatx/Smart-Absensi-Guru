/**
 * SMART ABSENSI GURU - STUDENT EXAM CARD & BARCODE MODAL
 * Anti AI-Slop UI: Clean typography, live card preview, filter by rombel, and 4-Card A4 Print
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { StudentRepository } from '../../../repositories/StudentRepository';
import { BarcodeExamCardService, type ExamCardRenderOptions } from '../../../lib/barcode-exam-card.lib';
import { APP_CONFIG } from '../../../config/app.config';
import { SIGNATORY_OFFICIALS } from '../../../lib/excel-generator.lib';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import type { StudentItem } from '../../../types/database.types';
import {
  Printer,
  Search,
  Filter,
  Calendar,
  Building,
  RefreshCw,
  QrCode,
  Tag,
} from 'lucide-react';

export interface StudentExamCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClassName?: string;
}

export const StudentExamCardModal: React.FC<StudentExamCardModalProps> = ({
  isOpen,
  onClose,
  defaultClassName,
}) => {
  const { token } = useAuthStore();
  const { showToast } = useToastStore();

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>(defaultClassName || 'ALL');

  // Exam Configuration State
  const [examTitle, setExamTitle] = useState('Penilaian Akhir Semester (PAS) Ganjil');
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [semester, setSemester] = useState<'Ganjil' | 'Genap'>('Ganjil');
  const [roomName, setRoomName] = useState('Ruang 01 (Lantai 2)');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Load students on modal open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadStudents = async () => {
      setIsLoading(true);
      try {
        const data = await StudentRepository.getStudents(token || undefined);
        if (isMounted) {
          setStudents(data);
          if (data.length > 0 && !selectedStudentId) {
            setSelectedStudentId(data[0].id);
          }
        }
      } catch (err) {
        console.warn('Failed to load students for exam card:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadStudents();
    return () => {
      isMounted = false;
    };
  }, [isOpen, token]);

  // Unique Classes list
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.className) set.add(s.className);
    });
    return Array.from(set).sort();
  }, [students]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchClass = selectedClass === 'ALL' || s.className === selectedClass;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        (s.nisn && s.nisn.toLowerCase().includes(q));
      return matchClass && matchSearch;
    });
  }, [students, selectedClass, searchQuery]);

  // Selected student for live preview
  const activeStudent = useMemo(() => {
    if (!filteredStudents.length) return null;
    return filteredStudents.find((s) => s.id === selectedStudentId) || filteredStudents[0];
  }, [filteredStudents, selectedStudentId]);

  // Live barcode SVG for the previewed student
  const previewBarcodeSvg = useMemo(() => {
    if (!activeStudent) return '';
    return BarcodeExamCardService.generateBarcodeSVG(activeStudent.nisn || activeStudent.id, {
      width: 1.2,
      height: 32,
      displayValue: true,
    });
  }, [activeStudent]);

  // Current options
  const examOptions: ExamCardRenderOptions = useMemo(() => {
    return {
      examTitle,
      academicYear,
      semester,
      roomName,
      institutionName: APP_CONFIG.INSTITUTION_NAME,
      principalName: SIGNATORY_OFFICIALS.KEPSEK_NAME,
    };
  }, [examTitle, academicYear, semester, roomName]);

  const handlePrintAllFiltered = () => {
    if (filteredStudents.length === 0) {
      showToast('error', 'Tidak Ada Siswa', 'Tidak ada data siswa yang terpilih untuk dicetak.');
      return;
    }

    const opened = BarcodeExamCardService.printExamCards(filteredStudents, examOptions);
    if (opened) {
      showToast(
        'success',
        'Jendela Cetak Dibuka',
        `Menyiapkan ${filteredStudents.length} kartu peserta ujian (Format A4 - 4 kartu/lembar).`
      );
    } else {
      showToast('error', 'Pop-up Terblokir', 'Izinkan pop-up di browser untuk mencetak kartu ujian.');
    }
  };

  const handlePrintSingle = (student: StudentItem) => {
    const opened = BarcodeExamCardService.printExamCards([student], examOptions);
    if (opened) {
      showToast('success', 'Mencetak Kartu', `Kartu ujian untuk ${student.fullName} siap dicetak.`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🏷️ Generator Kartu Peserta Ujian & Barcode Siswa"
      maxWidth="2xl"
    >
      <div className="space-y-4 py-1 text-slate-800">
        {/* Banner Info Header */}
        <div className="bg-[#023246] text-white p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                Standar A4 (2x2 Grid)
              </span>
              <h4 className="font-black text-sm text-white tracking-tight">
                Cetak 4 Kartu / Lembar A4
              </h4>
            </div>
            <p className="text-xs text-slate-300">
              Dilengkapi barcode Code128 NISN siswa, kop sekolah resmi, pasfoto, dan stempel digital.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrintAllFiltered}
              disabled={isLoading || filteredStudents.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak {filteredStudents.length} Kartu (A4)</span>
            </Button>
          </div>
        </div>

        {/* ── KONTROL PENGATURAN UJIAN & FILTER SISWA ──────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
          <div>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 mb-1">
              <Tag className="w-3.5 h-3.5 text-[#287094]" />
              Jenis Asesmen / Ujian
            </label>
            <select
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#287094]"
            >
              <option value="Penilaian Akhir Semester (PAS) Ganjil">Penilaian Akhir Semester (PAS)</option>
              <option value="Penilaian Tengah Semester (PTS) Ganjil">Penilaian Tengah Semester (PTS)</option>
              <option value="Penilaian Akhir Tahun (PAT) Genap">Penilaian Akhir Tahun (PAT / UKK)</option>
              <option value="Asesmen Sumatif Akhir Jenjang (ASAJ)">Asesmen Sumatif Akhir Jenjang (ASAJ)</option>
              <option value="Ujian Sekolah Berbasis Komputer (USBK)">Ujian Sekolah Komputer (USBK)</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 mb-1">
              <Calendar className="w-3.5 h-3.5 text-[#287094]" />
              Tahun Ajaran & Semester
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2026/2027"
                className="w-2/3 bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#287094]"
              />
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value as 'Ganjil' | 'Genap')}
                className="w-1/3 bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 mb-1">
              <Building className="w-3.5 h-3.5 text-[#287094]" />
              Ruangan Ujian
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Ruang 01 (Gedung A)"
              className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#287094]"
            />
          </div>

          <div>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 mb-1">
              <Filter className="w-3.5 h-3.5 text-[#287094]" />
              Filter Rombel / Kelas
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#287094]"
            >
              <option value="ALL">Semua Kelas ({students.length} Siswa)</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls} ({students.filter((s) => s.className === cls).length} Siswa)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── DUA KOLOM: DAFTAR SISWA (KIRI) & PRATINJAU KARTU (KANAN) ─────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* KOLOM KIRI: DAFTAR SISWA */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col h-105">
            <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau NISN siswa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#287094]"
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 px-1">
                <span>
                  Menampilkan <strong>{filteredStudents.length}</strong> siswa
                </span>
                <span>{selectedClass === 'ALL' ? 'Semua Rombel' : selectedClass}</span>
              </div>
            </div>

            {/* List Siswa */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-[#287094]" />
                  Memuat direktori siswa...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Tidak ada siswa yang cocok dengan filter.
                </div>
              ) : (
                filteredStudents.map((s, idx) => {
                  const isSelected = activeStudent?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedStudentId(s.id)}
                      className={`p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">{s.gender === 'P' ? '👩‍🎓' : '🧑‍🎓'}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {idx + 1}. {s.fullName}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            NISN: {s.nisn || '-'} • {s.className}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintSingle(s);
                        }}
                        className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="Cetak kartu siswa ini saja"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* KOLOM KANAN: LIVE CARD PREVIEW (TAMPILAN NYATA KARTU UJIAN) */}
          <div className="lg:col-span-7 bg-slate-100 p-4 rounded-2xl border border-slate-200 flex flex-col items-center justify-center min-h-105">
            <div className="w-full flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-[#287094]" />
                Pratinjau Fisik Kartu Peserta Ujian
              </span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-mono">
                Ukuran Cetak: 85.6mm x 54mm
              </span>
            </div>

            {activeStudent ? (
              <div className="w-full max-w-md bg-white border-2 border-[#0f172a] rounded-xl p-3.5 shadow-md space-y-2 relative overflow-hidden font-sans">
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 rotate-[-25deg] select-none text-2xl font-black">
                  KARTU PESERTA UJIAN
                </div>

                {/* Kop Kartu */}
                <div className="text-center border-b-2 border-[#0f172a] pb-2">
                  <p className="text-[9px] font-black text-blue-800 uppercase tracking-tight">
                    {APP_CONFIG.INSTITUTION_NAME}
                  </p>
                  <p className="text-[11px] font-black text-slate-900 uppercase">
                    {examTitle}
                  </p>
                  <p className="text-[8px] font-semibold text-slate-500">
                    TAHUN AJARAN {academicYear} • SEMESTER {semester.toUpperCase()}
                  </p>
                </div>

                {/* Badan Kartu */}
                <div className="flex gap-3 items-center py-1">
                  {/* Foto Siswa */}
                  <div className="w-16 h-20 bg-slate-100 border border-slate-300 rounded-md flex flex-col items-center justify-center text-center p-1 shrink-0">
                    <span className="text-2xl">{activeStudent.gender === 'P' ? '👩‍🎓' : '🧑‍🎓'}</span>
                    <span className="text-[7px] text-slate-400 font-bold mt-1">FOTO 3x4</span>
                  </div>

                  {/* Biodata Siswa */}
                  <table className="flex-1 text-[9px] border-collapse">
                    <tbody>
                      <tr>
                        <td className="w-18 text-slate-500 font-semibold py-0.5">No. Peserta</td>
                        <td className="w-2 font-bold">:</td>
                        <td className="font-mono font-black text-blue-900 py-0.5">
                          {BarcodeExamCardService.formatExamParticipantNumber(activeStudent, 0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-slate-500 font-semibold py-0.5">Nama Siswa</td>
                        <td className="font-bold">:</td>
                        <td className="font-black text-slate-900 py-0.5 text-[10px]">
                          {activeStudent.fullName}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-slate-500 font-semibold py-0.5">NISN</td>
                        <td className="font-bold">:</td>
                        <td className="font-mono font-bold text-slate-800 py-0.5">
                          {activeStudent.nisn || '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-slate-500 font-semibold py-0.5">Kelas / Rombel</td>
                        <td className="font-bold">:</td>
                        <td className="font-bold text-slate-800 py-0.5">{activeStudent.className}</td>
                      </tr>
                      <tr>
                        <td className="text-slate-500 font-semibold py-0.5">Ruang Ujian</td>
                        <td className="font-bold">:</td>
                        <td className="font-bold text-emerald-800 py-0.5">{roomName}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer Kartu: Barcode & Tanda Tangan */}
                <div className="border-t border-dashed border-slate-300 pt-2 flex items-end justify-between">
                  <div className="max-w-35 overflow-hidden">
                    <div
                      dangerouslySetInnerHTML={{ __html: previewBarcodeSvg }}
                      className="scale-90 origin-left"
                    />
                  </div>

                  <div className="text-center text-[7.5px] relative w-28">
                    <p className="text-slate-600">Mengetahui,</p>
                    <p className="font-bold text-slate-900">Kepala Sekolah</p>
                    <div className="h-6"></div>
                    <p className="font-black text-slate-900 underline">
                      {SIGNATORY_OFFICIALS.KEPSEK_NAME}
                    </p>
                    <p className="text-[6.5px] text-slate-500">NPP. 198205122008011004</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-xs text-slate-400">
                Pilih siswa untuk melihat pratinjau kartu ujian.
              </div>
            )}

            {/* Quick action buttons below preview */}
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => activeStudent && handlePrintSingle(activeStudent)}
                disabled={!activeStudent}
                className="text-xs flex items-center gap-1 cursor-pointer bg-white"
              >
                <Printer className="w-3.5 h-3.5 text-[#287094]" />
                <span>Cetak 1 Kartu Ini</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
