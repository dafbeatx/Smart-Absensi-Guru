/**
 * SMART ABSENSI GURU - STUDENT EXAM CARD & BARCODE MODAL
 * Standard KTP Size (85.6mm x 54mm) • ISO/IEC 7810 ID-1 Standard
 * Segregated SMP Terpadu Al-Ittihadiyah (with Official Green Logo) vs SMA Terpadu As Salaam
 * Anti AI-Slop UI: Clean typography, live card preview, filter by rombel, and 8-Card A4 Print
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { StudentRepository } from '../../../repositories/StudentRepository';
import {
  BarcodeExamCardService,
  detectEducationLevel,
  filterStudentsByLevel,
  type ExamCardRenderOptions,
  type EducationLevel,
} from '../../../lib/barcode-exam-card.lib';
import { SIGNATORY_OFFICIALS } from '../../../lib/excel-generator.lib';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { SMP_AL_ITTIHADIYAH_LOGO_BASE64 } from '../../../assets/logo-smp-terpadu';
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
  CreditCard,
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

  // Jenjang Pendidikan: 'SMP' | 'SMA' (Wajib terpisah sesuai arahan)
  const [selectedLevel, setSelectedLevel] = useState<EducationLevel>(() => {
    if (defaultClassName) return detectEducationLevel(defaultClassName);
    return 'SMP';
  });

  const [selectedClass, setSelectedClass] = useState<string>(defaultClassName || 'ALL');

  // Exam Configuration State
  const [examTitle, setExamTitle] = useState('Penilaian Akhir Semester (PAS) Ganjil');
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [semester, setSemester] = useState<'Ganjil' | 'Genap'>('Ganjil');
  const [roomName, setRoomName] = useState('Ruang 01');
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

  // Hitung jumlah siswa per jenjang
  const smpStudentsCount = useMemo(() => filterStudentsByLevel(students, 'SMP').length, [students]);
  const smaStudentsCount = useMemo(() => filterStudentsByLevel(students, 'SMA').length, [students]);

  // Daftar siswa yang sudah difilter murni per jenjang
  const levelStudents = useMemo(() => {
    return filterStudentsByLevel(students, selectedLevel);
  }, [students, selectedLevel]);

  // Unique Classes list per jenjang (tidak bercampur antara SMP dan SMA)
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    levelStudents.forEach((s) => {
      if (s.className) set.add(s.className);
    });
    return Array.from(set).sort();
  }, [levelStudents]);

  // Filtered students by class and search
  const filteredStudents = useMemo(() => {
    return levelStudents.filter((s) => {
      const matchClass = selectedClass === 'ALL' || s.className === selectedClass;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        (s.nisn && s.nisn.toLowerCase().includes(q));
      return matchClass && matchSearch;
    });
  }, [levelStudents, selectedClass, searchQuery]);

  // Selected student for live preview
  const activeStudent = useMemo(() => {
    if (!filteredStudents.length) return null;
    return filteredStudents.find((s) => s.id === selectedStudentId) || filteredStudents[0];
  }, [filteredStudents, selectedStudentId]);

  // Live barcode SVG for the previewed student
  const previewBarcodeSvg = useMemo(() => {
    if (!activeStudent) return '';
    return BarcodeExamCardService.generateBarcodeSVG(activeStudent.nisn || activeStudent.id, {
      width: 0.95,
      height: 20,
      displayValue: true,
    });
  }, [activeStudent]);

  // Current options
  const isSMP = selectedLevel === 'SMP';
  const schoolName = isSMP ? 'SMP TERPADU AL-ITTIHADIYAH' : 'SMA TERPADU AS SALAAM';
  const schoolColor = isSMP ? '#047857' : '#023246';
  const logoSrc = isSMP ? SMP_AL_ITTIHADIYAH_LOGO_BASE64 : '/school-logo.png';

  const examOptions: ExamCardRenderOptions = useMemo(() => {
    return {
      level: selectedLevel,
      examTitle,
      academicYear,
      semester,
      roomName,
      institutionName: schoolName,
      institutionAddress: 'Ciampea - Bogor',
      principalName: SIGNATORY_OFFICIALS.KEPSEK_NAME,
    };
  }, [selectedLevel, examTitle, academicYear, semester, roomName, schoolName]);

  const handlePrintAllFiltered = () => {
    if (filteredStudents.length === 0) {
      showToast('error', 'Tidak Ada Siswa', `Tidak ada data siswa ${selectedLevel} yang terpilih untuk dicetak.`);
      return;
    }

    const opened = BarcodeExamCardService.printExamCards(filteredStudents, examOptions);
    if (opened) {
      showToast(
        'success',
        'Jendela Cetak Dibuka',
        `Menyiapkan ${filteredStudents.length} kartu ujian ${selectedLevel} (Ukuran KTP 85.6x54mm • 8 kartu/lembar A4).`
      );
    } else {
      showToast('error', 'Pop-up Terblokir', 'Izinkan pop-up di browser untuk mencetak kartu ujian.');
    }
  };

  const handlePrintSingle = (student: StudentItem) => {
    const opened = BarcodeExamCardService.printExamCards([student], examOptions);
    if (opened) {
      showToast('success', 'Mencetak Kartu', `Kartu ujian KTP untuk ${student.fullName} (${selectedLevel}) siap dicetak.`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🏷️ Generator Kartu Peserta Ujian & Barcode Siswa"
      maxWidth="2xl"
    >
      <div className="space-y-3.5 py-1 text-slate-800">
        {/* ── 1. TAB PEMILIH JENJANG PENDIDIKAN (SMP VS SMA TERPISAH) ─────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 bg-slate-100 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl shadow-2xs border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setSelectedLevel('SMP');
                setSelectedClass('ALL');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                selectedLevel === 'SMP'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <img
                src={SMP_AL_ITTIHADIYAH_LOGO_BASE64}
                alt="Logo SMP"
                className="w-4 h-4 object-contain rounded-full bg-white p-0.2 shrink-0"
              />
              <span>SMP Terpadu Al-Ittihadiyah</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                selectedLevel === 'SMP' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-700'
              }`}>
                {smpStudentsCount} Siswa
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedLevel('SMA');
                setSelectedClass('ALL');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                selectedLevel === 'SMA'
                  ? 'bg-[#023246] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="text-sm">🏫</span>
              <span>SMA Terpadu As Salaam</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                selectedLevel === 'SMA' ? 'bg-[#18536B] text-cyan-100' : 'bg-slate-200 text-slate-700'
              }`}>
                {smaStudentsCount} Siswa
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 px-2 text-[11px] font-bold text-slate-600">
            <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ukuran KTP (85.6mm x 54mm)</span>
          </div>
        </div>

        {/* ── 2. BANNER INFO KOP DAN TOMBOL CETAK UTAMA ───────────────────── */}
        <div
          className={`p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md text-white transition-colors ${
            isSMP ? 'bg-[#047857]' : 'bg-[#023246]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-xs">
              <img src={logoSrc} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="bg-amber-400 text-slate-950 text-[9.5px] font-black px-2 py-0.2 rounded-full uppercase tracking-tight">
                  Standar KTP • 8 Kartu / Lembar A4
                </span>
              </div>
              <h4 className="font-black text-xs sm:text-sm text-white tracking-tight truncate">
                {schoolName}
              </h4>
              <p className="text-[10px] text-emerald-100/90 truncate">
                {isSMP ? 'Kop dilengkapi Logo Resmi Hijau Al-Ittihadiyah & Ciampea Bogor' : 'Kop Surat Resmi SMA Terpadu As Salaam'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrintAllFiltered}
              disabled={isLoading || filteredStudents.length === 0}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak {filteredStudents.length} Kartu ({selectedLevel})</span>
            </Button>
          </div>
        </div>

        {/* ── 3. KONTROL PENGATURAN UJIAN & FILTER SISWA ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <div>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 mb-1">
              <Tag className="w-3.5 h-3.5 text-[#287094]" />
              Jenis Asesmen
            </label>
            <select
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#287094]"
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
                className="w-2/3 bg-white border border-slate-300 rounded-xl p-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#287094]"
              />
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value as 'Ganjil' | 'Genap')}
                className="w-1/3 bg-white border border-slate-300 rounded-xl p-1.5 text-xs font-bold text-slate-800 focus:outline-none"
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
              placeholder="Ruang 01"
              className="w-full bg-white border border-slate-300 rounded-xl p-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#287094]"
            />
          </div>

          <div>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 mb-1">
              <Filter className="w-3.5 h-3.5 text-[#287094]" />
              Rombel / Kelas ({selectedLevel})
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#287094]"
            >
              <option value="ALL">Semua Kelas {selectedLevel} ({levelStudents.length} Siswa)</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls} ({levelStudents.filter((s) => s.className === cls).length} Siswa)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── 4. DUA KOLOM: DAFTAR SISWA (KIRI) & PRATINJAU KARTU KTP (KANAN) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          {/* KOLOM KIRI: DAFTAR SISWA */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col h-100">
            <div className="p-2 border-b border-slate-100 bg-slate-50/70">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Cari nama/NISN siswa ${selectedLevel}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#287094]"
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 px-1">
                <span>
                  Menampilkan <strong>{filteredStudents.length}</strong> siswa {selectedLevel}
                </span>
                <span className="font-semibold text-emerald-800">
                  {selectedClass === 'ALL' ? `Semua Rombel ${selectedLevel}` : selectedClass}
                </span>
              </div>
            </div>

            {/* List Siswa */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-[#287094]" />
                  Memuat data siswa {selectedLevel}...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Tidak ada data siswa {selectedLevel} yang cocok dengan filter.
                </div>
              ) : (
                filteredStudents.map((s, idx) => {
                  const isSelected = activeStudent?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedStudentId(s.id)}
                      className={`p-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isSelected ? 'bg-emerald-50/80 border-l-4 border-emerald-600' : 'hover:bg-slate-50'
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
                        className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
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

          {/* KOLOM KANAN: LIVE CARD PREVIEW (STANDAR UKURAN KTP 85.6mm x 54mm) */}
          <div className="lg:col-span-7 bg-slate-100 p-3.5 rounded-2xl border border-slate-200 flex flex-col items-center justify-center min-h-100">
            <div className="w-full flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                Pratinjau Fisik Kartu Ujian (Ukuran KTP)
              </span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-mono font-bold">
                85.6 mm x 54.0 mm
              </span>
            </div>

            {activeStudent ? (
              <div
                className="w-full max-w-sm bg-white rounded-xl p-3 shadow-md space-y-1.5 relative overflow-hidden font-sans border-2"
                style={{ borderColor: schoolColor }}
              >
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-4 rotate-[-22deg] select-none text-xl font-black">
                  KARTU PESERTA {selectedLevel}
                </div>

                {/* Kop Kartu dengan Logo */}
                <div
                  className="flex items-center gap-2 pb-1.5 border-b-2"
                  style={{ borderColor: schoolColor }}
                >
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <img src={logoSrc} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <div className="text-center flex-1 min-w-0">
                    <p
                      className="text-[9.5px] font-black uppercase tracking-tight truncate leading-tight"
                      style={{ color: schoolColor }}
                    >
                      {schoolName}
                    </p>
                    <p className="text-[9px] font-black text-slate-900 uppercase truncate leading-tight">
                      {examTitle}
                    </p>
                    <p className="text-[7px] font-semibold text-slate-500 truncate leading-tight">
                      TA {academicYear} • SEMESTER {semester.toUpperCase()} • CIAMPEA BOGOR
                    </p>
                  </div>
                </div>

                {/* Badan Kartu */}
                <div className="flex gap-2.5 items-center py-0.5">
                  {/* Foto Siswa */}
                  <div className="w-12 h-16 bg-slate-100 border border-slate-300 rounded-md flex flex-col items-center justify-center text-center p-0.5 shrink-0">
                    <span className="text-xl">{activeStudent.gender === 'P' ? '👩‍🎓' : '🧑‍🎓'}</span>
                    <span className="text-[6.5px] text-slate-400 font-bold mt-0.5">3x4</span>
                  </div>

                  {/* Biodata Siswa */}
                  <table className="flex-1 text-[8.5px] border-collapse leading-tight">
                    <tbody>
                      <tr>
                        <td className="w-16 text-slate-500 font-semibold py-0.2">No. Peserta</td>
                        <td className="w-2 font-bold">:</td>
                        <td className="font-mono font-black py-0.2" style={{ color: schoolColor }}>
                          {BarcodeExamCardService.formatExamParticipantNumber(activeStudent, 0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-slate-500 font-semibold py-0.2">Nama Siswa</td>
                        <td className="font-bold">:</td>
                        <td className="font-black text-slate-900 py-0.2 text-[9px] truncate max-w-36">
                          {activeStudent.fullName}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-slate-500 font-semibold py-0.2">NISN</td>
                        <td className="font-bold">:</td>
                        <td className="font-mono font-bold text-slate-800 py-0.2">
                          {activeStudent.nisn || '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-slate-500 font-semibold py-0.2">Kelas / Rombel</td>
                        <td className="font-bold">:</td>
                        <td className="font-bold text-slate-800 py-0.2">{activeStudent.className}</td>
                      </tr>
                      <tr>
                        <td className="text-slate-500 font-semibold py-0.2">Ruang Ujian</td>
                        <td className="font-bold">:</td>
                        <td className="font-bold text-emerald-800 py-0.2">{roomName}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer Kartu: Barcode & Tanda Tangan */}
                <div className="border-t border-dashed border-slate-300 pt-1.5 flex items-end justify-between gap-1">
                  <div className="max-w-32 overflow-hidden">
                    <div
                      dangerouslySetInnerHTML={{ __html: previewBarcodeSvg }}
                      className="scale-85 origin-left"
                    />
                  </div>

                  <div className="text-center text-[7px] relative w-24 leading-tight shrink-0">
                    <p className="text-slate-600">Mengetahui,</p>
                    <p className="font-bold text-slate-900">Kepala Sekolah</p>
                    <div className="h-6 relative">
                      <img
                        src="/stempel-ttd-kepsek-as-salaam.png"
                        alt="Tanda Tangan & Stempel Kepala Sekolah"
                        className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-16 h-12 object-contain pointer-events-none opacity-95 z-10"
                      />
                    </div>
                    <p className="font-black text-slate-900 underline truncate relative z-20">
                      {SIGNATORY_OFFICIALS.KEPSEK_NAME}
                    </p>
                    <p className="text-[5.5px] text-slate-500 font-mono relative z-20">
                      NPP. 197605122005011004
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                Pilih salah satu siswa di daftar sebelah kiri untuk melihat kartu.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
