/**
 * SMART ABSENSI GURU — EXAM ADMINISTRATIVE DOCUMENTS MODAL
 * Interactive modal dialog providing live A4 preview and 1-click export
 * for the 5 official Indonesian school exam documents:
 * 1. Daftar Hadir Pengawas Ujian
 * 2. Daftar Hadir Peserta Ujian (Per Ruang / Semua Ruang)
 * 3. Daftar Serah Terima Naskah Soal & LJK (Per Ruang / Semua Ruang)
 * 4. Berita Acara Rekapitulasi Kehadiran Peserta Ujian
 * 5. Daftar Hadir Panitia Ujian
 *
 * Supported Actions:
 * - Review & In-Place Edit Roster Siswa (No. Peserta 13-0820-001, Nama, L/P, Kelas)
 * - Cetak / PDF (A4 via browser native print dialog)
 * - Unduh PDF Resmi (A4 jsPDF Engine)
 * - Unduh Word (.doc A4 Page Setup)
 * - Unduh Excel (.xlsx A4 Page Setup)
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Printer,
  FileText,
  Download,
  Users,
  ClipboardCheck,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  DoorOpen,
  Sparkles,
  GraduationCap,
  Edit3,
  Plus,
  Trash2,
  RotateCcw,
  Eye,
  Hash,
} from 'lucide-react';
import type {
  ExamScheduleData,
  ExamCommitteeMember,
} from '../../../types/exam-schedule.types';
import type { ExamInvigilationMatrix } from '../../../services/exam-matrix-builder.service';
import {
  ExamAdministrativeDocsService,
  type AdminDocType,
  type AdminDocOptions,
} from '../../../services/exam-administrative-docs.service';

interface ExamAdministrativeDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  matrix: ExamInvigilationMatrix | null;
  scheduleData: ExamScheduleData;
  committeeMembers?: ExamCommitteeMember[];
  initialDocType?: AdminDocType;
  officialSignatoryOptions?: {
    kepsekName?: string;
    committeeHeadName?: string;
  };
}

type ViewMode = 'PREVIEW' | 'EDIT_ROSTER';

export const ExamAdministrativeDocsModal: React.FC<ExamAdministrativeDocsModalProps> = ({
  isOpen,
  onClose,
  matrix,
  scheduleData,
  committeeMembers,
  initialDocType = 'PROCTOR_ATTENDANCE',
  officialSignatoryOptions,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('PREVIEW');
  const [activeDocType, setActiveDocType] = useState<AdminDocType>(initialDocType);
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [activeEditRoom, setActiveEditRoom] = useState<string>('Ruang 01');
  const [pageOrientation, setPageOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [includeNumberPrefix, setIncludeNumberPrefix] = useState<boolean>(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isSma = useMemo(() => {
    return scheduleData.config.selectedClasses?.some((c) => /10|11|12|sma|ipa|ips/i.test(c)) || false;
  }, [scheduleData.config.selectedClasses]);

  // Extract rooms: SMP strictly 5 rooms (Kelas 7, 8A, 8B, 9A, 9B), SMA strictly 3 rooms (Kelas 10, 11, 12)
  const availableRooms = useMemo(() => {
    const rSet = new Set<string>();
    const minRooms = isSma ? 3 : 5;
    const targetRoomCount = Math.max(minRooms, scheduleData.config.totalRooms || minRooms);
    for (let i = 1; i <= targetRoomCount; i++) {
      rSet.add(`Ruang ${String(i).padStart(2, '0')}`);
    }
    if (scheduleData.proctorSchedules) {
      scheduleData.proctorSchedules.forEach((p) => {
        if (p.roomName) {
          rSet.add(ExamAdministrativeDocsService.canonicalRoomName(p.roomName));
        }
      });
    }
    return Array.from(rSet).sort((a, b) => {
      const numA = parseInt((a.match(/\d+/) || ['0'])[0], 10);
      const numB = parseInt((b.match(/\d+/) || ['0'])[0], 10);
      return numA - numB;
    });
  }, [scheduleData, isSma]);

  // Custom Editable Roster state (persisted to localStorage)
  const [customRosterMap, setCustomRosterMap] = useState<Record<string, Array<{
    urut: number;
    participantNumber: string;
    fullName: string;
    gender: string;
    className: string;
  }>>>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('smart_absensi_exam_student_roster_custom');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Gagal membaca custom roster tersimpan:', e);
    }
    return ExamAdministrativeDocsService.resolveRoomStudents(scheduleData, { includeNumberPrefix: true });
  });

  // Persist custom roster to localStorage on any modification
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('smart_absensi_exam_student_roster_custom', JSON.stringify(customRosterMap));
      }
    } catch (e) {
      console.warn('Gagal menyimpan custom roster ke localStorage:', e);
    }
  }, [customRosterMap]);

  // Zero-Empty-Room Guarantee: ensure every room in availableRooms has populated students
  useEffect(() => {
    const missingRooms = availableRooms.filter((r) => !customRosterMap[r] || customRosterMap[r].length === 0);
    if (missingRooms.length > 0) {
      const defaultMap = ExamAdministrativeDocsService.resolveRoomStudents(scheduleData, { includeNumberPrefix: true });
      setCustomRosterMap((prev) => {
        const next = { ...prev };
        let changed = false;
        missingRooms.forEach((r) => {
          if (!next[r] || next[r].length === 0) {
            next[r] = defaultMap[r] || [];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [availableRooms, scheduleData, customRosterMap]);

  // Options payload for generator and exports
  const docOptions: AdminDocOptions = useMemo(() => {
    return {
      committeeHeadName: officialSignatoryOptions?.committeeHeadName,
      kepsekName: officialSignatoryOptions?.kepsekName,
      roomFilter: selectedRoom,
      orientation: pageOrientation,
      includeNumberPrefix,
      customRoomStudentsMap: customRosterMap,
    };
  }, [officialSignatoryOptions, selectedRoom, pageOrientation, includeNumberPrefix, customRosterMap]);

  // Generate live HTML string for the current active doc
  const currentHtml = useMemo(() => {
    if (!isOpen) return '';

    switch (activeDocType) {
      case 'PROCTOR_ATTENDANCE':
        return ExamAdministrativeDocsService.generateProctorAttendanceHtml(
          matrix,
          scheduleData,
          docOptions
        );
      case 'STUDENT_ATTENDANCE_ROSTER':
        return ExamAdministrativeDocsService.generateStudentAttendanceRosterHtml(
          scheduleData,
          docOptions
        );
      case 'HANDOVER_DOCS':
        return ExamAdministrativeDocsService.generateHandoverDocsHtml(
          scheduleData,
          docOptions
        );
      case 'STUDENT_ATTENDANCE_SUMMARY':
        return ExamAdministrativeDocsService.generateStudentAttendanceSummaryHtml(
          scheduleData,
          docOptions
        );
      case 'COMMITTEE_ATTENDANCE':
        return ExamAdministrativeDocsService.generateCommitteeAttendanceHtml(
          committeeMembers || [],
          scheduleData,
          docOptions
        );
      default:
        return '';
    }
  }, [isOpen, activeDocType, matrix, scheduleData, committeeMembers, docOptions]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Handlers for Review & In-Place Editing
  const handleStudentChange = (
    room: string,
    index: number,
    field: 'participantNumber' | 'fullName' | 'gender' | 'className',
    value: string
  ) => {
    setCustomRosterMap((prev) => {
      const roomList = prev[room] ? [...prev[room]] : [];
      if (!roomList[index]) return prev;
      const updated = {
        ...roomList[index],
        [field]: field === 'fullName' ? value.toUpperCase() : value,
      };
      roomList[index] = updated;
      return { ...prev, [room]: roomList };
    });
  };

  const handleAddStudent = (room: string) => {
    setCustomRosterMap((prev) => {
      const roomList = prev[room] ? [...prev[room]] : [];
      let totalBefore = 0;
      for (const r of availableRooms) {
        if (r === room) break;
        totalBefore += (prev[r] || []).length;
      }
      const newGlobalIdx = totalBefore + roomList.length + 1;
      const roomIdx = availableRooms.indexOf(room);
      const defaultClass = isSma
        ? (roomIdx === 0 ? '10' : roomIdx === 1 ? '11' : '12')
        : (roomIdx === 0 ? '7' : roomIdx === 1 ? '8A' : roomIdx === 2 ? '8B' : roomIdx === 3 ? '9A' : '9B');

      const newStudent = {
        urut: roomList.length + 1,
        participantNumber: `13-0820-${String(newGlobalIdx).padStart(3, '0')}`,
        fullName: 'SISWA BARU',
        gender: 'L',
        className: defaultClass,
      };

      return {
        ...prev,
        [room]: [...roomList, newStudent],
      };
    });
    showToast(`1 siswa baru ditambahkan ke ${room}`);
  };

  const handleDeleteStudent = (room: string, index: number) => {
    const currentList = customRosterMap[room] || [];
    if (currentList.length <= 1) {
      showToast(`Peringatan: ${room} harus memiliki minimal 1 siswa agar tidak kosong.`);
      return;
    }
    setCustomRosterMap((prev) => {
      const roomList = (prev[room] || []).filter((_, i) => i !== index);
      const reIndexed = roomList.map((s, idx) => ({ ...s, urut: idx + 1 }));
      return {
        ...prev,
        [room]: reIndexed,
      };
    });
    showToast(`Siswa nomor urut ${index + 1} dihapus dari ${room}`);
  };

  const handleRenumberAllSequentially = () => {
    setCustomRosterMap((prev) => {
      let globalIdx = 1;
      const newMap: typeof prev = {};
      availableRooms.forEach((r) => {
        const list = prev[r] || [];
        newMap[r] = list.map((s, idx) => {
          const participantNumber = `13-0820-${String(globalIdx).padStart(3, '0')}`;
          globalIdx++;
          return {
            ...s,
            urut: idx + 1,
            participantNumber,
          };
        });
      });
      return newMap;
    });
    showToast('Nomor peserta berhasil diurutkan berurutan (13-0820-001 dst.) dari Ruang 1 sampai Ruang 5!');
  };

  const handleResetRoom = (room: string) => {
    const defaultMap = ExamAdministrativeDocsService.resolveRoomStudents(scheduleData, { includeNumberPrefix: true });
    setCustomRosterMap((prev) => ({
      ...prev,
      [room]: defaultMap[room] || [],
    }));
    showToast(`Daftar siswa ${room} dikembalikan ke data resmi default.`);
  };

  const handleResetAllRooms = () => {
    if (window.confirm('Reset seluruh daftar siswa di semua 5 ruangan ke data resmi awal? Perubahan kustom Anda akan dihapus.')) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('smart_absensi_exam_student_roster_custom');
        }
      } catch {}
      const defaultMap = ExamAdministrativeDocsService.resolveRoomStudents(scheduleData, { includeNumberPrefix: true });
      setCustomRosterMap(defaultMap);
      showToast('Seluruh daftar siswa 5 ruangan berhasil di-reset ke data resmi default.');
    }
  };

  // Handlers for Export Actions (Strict A4 Size Guarantee across PDF, Word, and Excel)
  const handlePrintA4 = () => {
    const titles: Record<AdminDocType, string> = {
      PROCTOR_ATTENDANCE: 'Daftar Hadir Pengawas',
      STUDENT_ATTENDANCE_ROSTER: 'Daftar Hadir Peserta Ujian',
      HANDOVER_DOCS: 'Daftar Serah Terima Naskah Soal & LJK',
      STUDENT_ATTENDANCE_SUMMARY: 'Rekapitulasi Kehadiran Peserta Ujian',
      COMMITTEE_ATTENDANCE: 'Daftar Hadir Panitia Ujian',
    };
    ExamAdministrativeDocsService.printHtmlDocument(currentHtml, titles[activeDocType]);
  };

  const handleDownloadA4 = async () => {
    const filePrefix: Record<AdminDocType, string> = {
      PROCTOR_ATTENDANCE: 'Daftar_Hadir_Pengawas',
      STUDENT_ATTENDANCE_ROSTER: selectedRoom === 'ALL' ? 'Daftar_Hadir_Peserta_Semua_Ruang' : `Daftar_Hadir_Peserta_${selectedRoom.replace(/\s+/g, '_')}`,
      HANDOVER_DOCS: selectedRoom === 'ALL' ? 'Serah_Terima_Naskah_LJK_Semua_Ruang' : `Serah_Terima_${selectedRoom.replace(/\s+/g, '_')}`,
      STUDENT_ATTENDANCE_SUMMARY: 'Rekapitulasi_Kehadiran_Peserta_Ujian',
      COMMITTEE_ATTENDANCE: 'Daftar_Hadir_Panitia',
    };
    const examType = scheduleData.config.examType || 'ASTS';
    const academicYear = (scheduleData.config.academicYear || '2026/2027').replace('/', '-');
    const fileName = `${filePrefix[activeDocType]}_${examType}_${academicYear}_A4.pdf`;

    showToast(`Menyiapkan unduhan PDF (${fileName})...`);
    await ExamAdministrativeDocsService.downloadPdfDocument(currentHtml, fileName, pageOrientation);
    showToast(`Dokumen PDF (${fileName}) berhasil diunduh.`);
  };

  const handleExportWord = () => {
    const filePrefix: Record<AdminDocType, string> = {
      PROCTOR_ATTENDANCE: 'Daftar_Hadir_Pengawas',
      STUDENT_ATTENDANCE_ROSTER: selectedRoom === 'ALL' ? 'Daftar_Hadir_Peserta_Semua_Ruang' : `Daftar_Hadir_Peserta_${selectedRoom.replace(/\s+/g, '_')}`,
      HANDOVER_DOCS: selectedRoom === 'ALL' ? 'Serah_Terima_Naskah_LJK_Semua_Ruang' : `Serah_Terima_${selectedRoom.replace(/\s+/g, '_')}`,
      STUDENT_ATTENDANCE_SUMMARY: 'Rekapitulasi_Kehadiran_Peserta_Ujian',
      COMMITTEE_ATTENDANCE: 'Daftar_Hadir_Panitia',
    };
    const examType = scheduleData.config.examType || 'ASTS';
    const academicYear = (scheduleData.config.academicYear || '2026/2027').replace('/', '-');
    const fileName = `${filePrefix[activeDocType]}_${examType}_${academicYear}_A4.doc`;

    ExamAdministrativeDocsService.exportToWord(currentHtml, fileName, pageOrientation);
    showToast(`Dokumen Word (${fileName}) berhasil diunduh.`);
  };

  const handleExportExcel = () => {
    ExamAdministrativeDocsService.exportToExcel(activeDocType, {
      matrix,
      scheduleData,
      committeeMembers,
      options: docOptions,
    });
    showToast('File Excel (.xlsx A4) berhasil diunduh.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col h-[94vh] max-h-225 border border-slate-200 overflow-hidden">
        {/* MODAL HEADER */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-2xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                  Dokumen Administrasi Ujian Resmi
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  {scheduleData.config.examType || 'ASTS'}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  Format Kertas: A4
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Format fisik dinas resmi siap cetak & simpan A4 (.pdf, .doc, .xlsx)
              </p>
            </div>
          </div>

          {/* ACTION BUTTONS (DOWNLOAD, PRINT, WORD, EXCEL) */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadA4}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              title="Unduh format dokumen resmi PDF (A4) siap pakai"
            >
              <Download className="w-3.5 h-3.5 text-sky-700" />
              <span>Unduh PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrintA4}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Cetak langsung ke kertas A4 atau Simpan sebagai PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF (A4)</span>
            </button>

            <button
              type="button"
              onClick={handleExportWord}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              title="Unduh format Microsoft Word (.doc) ukuran A4 untuk diedit bebas"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Unduh Word (A4)</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              title="Unduh format Microsoft Excel (.xlsx) ukuran A4"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Unduh Excel (A4)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* WORKSPACE MODE SWITCHER & CONTROLS BAR */}
        <div className="px-4 sm:px-6 py-2 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          {/* VIEW MODE TOGGLE BUTTONS */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('PREVIEW')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'PREVIEW'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 ring-1 ring-teal-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-teal-600" />
              <span>Pratinjau Dokumen (A4)</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('EDIT_ROSTER')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'EDIT_ROSTER'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Review & Edit Siswa (SMP 5 Ruang)</span>
            </button>
          </div>

          {/* CONTROLS (ORIENTASI KERTAS & FILTER RUANGAN) */}
          <div className="flex items-center flex-wrap gap-2.5 self-end sm:self-auto">
            {/* RADIO BUTTON ORIENTASI KERTAS A4 */}
            <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-700">Kertas A4:</span>
              <label className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 cursor-pointer select-none">
                <input
                  type="radio"
                  name="pageOrientation"
                  value="portrait"
                  checked={pageOrientation === 'portrait'}
                  onChange={() => setPageOrientation('portrait')}
                  className="w-3.5 h-3.5 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span>Portrait (210×297mm)</span>
              </label>
              <label className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 cursor-pointer select-none ml-1">
                <input
                  type="radio"
                  name="pageOrientation"
                  value="landscape"
                  checked={pageOrientation === 'landscape'}
                  onChange={() => setPageOrientation('landscape')}
                  className="w-3.5 h-3.5 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span>Landscape (297×210mm)</span>
              </label>
            </div>

            {/* PREVIEW ROOM SELECTOR */}
            {viewMode === 'PREVIEW' && (activeDocType === 'HANDOVER_DOCS' || activeDocType === 'STUDENT_ATTENDANCE_ROSTER') && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <DoorOpen className="w-3.5 h-3.5 text-slate-500" />
                  Ruang:
                </span>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="text-xs font-bold bg-white border border-slate-300 rounded-xl px-2 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 shadow-2xs cursor-pointer"
                >
                  <option value="ALL">Semua Ruangan (1 - {availableRooms.length})</option>
                  {availableRooms.map((r, idx) => {
                    const classLabel = isSma
                      ? (idx === 0 ? 'Kelas 10' : idx === 1 ? 'Kelas 11' : idx === 2 ? 'Kelas 12' : '')
                      : (idx === 0 ? 'Kelas 7' : idx === 1 ? 'Kelas 8A' : idx === 2 ? 'Kelas 8B' : idx === 3 ? 'Kelas 9A' : idx === 4 ? 'Kelas 9B' : '');
                    return (
                      <option key={r} value={r}>
                        {r} {classLabel ? `(${classLabel})` : ''}
                      </option>
                    );
                  })}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedRoom !== 'ALL') setActiveEditRoom(selectedRoom);
                    setViewMode('EDIT_ROSTER');
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                  title="Buka panel edit data siswa untuk ruangan ini"
                >
                  <Edit3 className="w-3 h-3 text-teal-700" />
                  <span>Edit Data</span>
                </button>

                {activeDocType === 'HANDOVER_DOCS' && (
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer select-none bg-white px-2 py-1 rounded-xl border border-slate-300 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={includeNumberPrefix}
                      onChange={(e) => setIncludeNumberPrefix(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                    />
                    <span>No. Urut (1, 2)</span>
                  </label>
                )}
              </div>
            )}
          </div>
        </div>

        {/* DOCUMENT TYPE TABS (ONLY VISIBLE IN PREVIEW MODE) */}
        {viewMode === 'PREVIEW' && (
          <div className="px-4 sm:px-6 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setActiveDocType('PROCTOR_ATTENDANCE')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeDocType === 'PROCTOR_ATTENDANCE'
                  ? 'bg-white text-teal-700 shadow-xs border border-slate-200/80 ring-1 ring-teal-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-teal-600" />
              <span>1. Daftar Hadir Pengawas</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDocType('STUDENT_ATTENDANCE_ROSTER')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeDocType === 'STUDENT_ATTENDANCE_ROSTER'
                  ? 'bg-white text-teal-700 shadow-xs border border-slate-200/80 ring-1 ring-teal-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 text-teal-600" />
              <span>2. Daftar Hadir Peserta</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDocType('HANDOVER_DOCS')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeDocType === 'HANDOVER_DOCS'
                  ? 'bg-white text-teal-700 shadow-xs border border-slate-200/80 ring-1 ring-teal-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>3. Serah Terima Soal & LJK</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDocType('STUDENT_ATTENDANCE_SUMMARY')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeDocType === 'STUDENT_ATTENDANCE_SUMMARY'
                  ? 'bg-white text-teal-700 shadow-xs border border-slate-200/80 ring-1 ring-teal-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-teal-600" />
              <span>4. Rekap Kehadiran Siswa</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDocType('COMMITTEE_ATTENDANCE')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeDocType === 'COMMITTEE_ATTENDANCE'
                  ? 'bg-white text-teal-700 shadow-xs border border-slate-200/80 ring-1 ring-teal-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>5. Daftar Hadir Panitia</span>
            </button>
          </div>
        )}

        {/* TOAST ALERT NOTIFICATION */}
        {toastMsg && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* MAIN WORKSPACE: PREVIEW OR REVIEW & EDIT */}
        {viewMode === 'EDIT_ROSTER' ? (
          <div className="flex-1 bg-slate-100/80 p-3 sm:p-5 overflow-y-auto flex flex-col">
            {/* ROOM SELECTOR TABS */}
            <div className="bg-white rounded-xl border border-slate-200 p-2.5 shadow-xs mb-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 shrink-0">
                  Pilih Ruangan:
                </span>
                {availableRooms.map((r, idx) => {
                  const classLabel = isSma
                    ? (idx === 0 ? 'Kelas 10' : idx === 1 ? 'Kelas 11' : 'Kelas 12')
                    : (idx === 0 ? 'Kelas 7' : idx === 1 ? 'Kelas 8A' : idx === 2 ? 'Kelas 8B' : idx === 3 ? 'Kelas 9A' : 'Kelas 9B');
                  const count = (customRosterMap[r] || []).length;
                  const isActive = activeEditRoom === r;

                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setActiveEditRoom(r)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <span>{r}</span>
                      {classLabel && (
                        <span className={`text-[11px] font-normal ${isActive ? 'text-teal-100' : 'text-slate-500'}`}>
                          ({classLabel})
                        </span>
                      )}
                      <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isActive ? 'bg-teal-800 text-teal-100' : 'bg-slate-200 text-slate-700'}`}>
                        {count} Siswa
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('PREVIEW')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Lihat di Pratinjau (A4)</span>
                </button>
              </div>
            </div>

            {/* ACTION TOOLBAR FOR CURRENT ACTIVE ROOM */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAddStudent(activeEditRoom)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Siswa</span>
                </button>

                <button
                  type="button"
                  onClick={handleRenumberAllSequentially}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  title="Urutkan ulang nomor peserta 13-0820-001 dari siswa pertama Ruang 1 sampai Ruang 5"
                >
                  <Hash className="w-3.5 h-3.5 text-sky-700" />
                  <span>Urutkan No. Peserta (13-0820-001 dst.)</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleResetRoom(activeEditRoom)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  title={`Kembalikan ${activeEditRoom} ke daftar resmi default`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset {activeEditRoom}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetAllRooms}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer"
                  title="Reset seluruh daftar siswa 5 ruangan ke data resmi default"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Semua 5 Ruangan</span>
                </button>
              </div>
            </div>

            {/* EDITABLE TABLE CARD */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex-1 flex flex-col">
              <div className="overflow-x-auto flex-1">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="py-2.5 px-3 text-center w-12">No</th>
                      <th className="py-2.5 px-3 text-left w-44">No. Peserta (13-0820-...)</th>
                      <th className="py-2.5 px-3 text-left">Nama Lengkap Siswa</th>
                      <th className="py-2.5 px-3 text-center w-20">L/P</th>
                      <th className="py-2.5 px-3 text-center w-28">Kelas</th>
                      <th className="py-2.5 px-3 text-center w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(customRosterMap[activeEditRoom] || []).map((student, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 text-center font-bold text-slate-500">
                          {student.urut || idx + 1}
                        </td>
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            value={student.participantNumber}
                            onChange={(e) => handleStudentChange(activeEditRoom, idx, 'participantNumber', e.target.value)}
                            className="w-full font-mono text-xs font-bold bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            placeholder="13-0820-001"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            value={student.fullName}
                            onChange={(e) => handleStudentChange(activeEditRoom, idx, 'fullName', e.target.value)}
                            className="w-full font-bold text-xs uppercase bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            placeholder="NAMA LENGKAP SISWA"
                          />
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <select
                            value={student.gender}
                            onChange={(e) => handleStudentChange(activeEditRoom, idx, 'gender', e.target.value)}
                            className="font-bold text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                          >
                            <option value="L">L</option>
                            <option value="P">P</option>
                          </select>
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <input
                            type="text"
                            value={student.className}
                            onChange={(e) => handleStudentChange(activeEditRoom, idx, 'className', e.target.value)}
                            className="w-full text-center font-bold text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            placeholder="Kelas"
                          />
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteStudent(activeEditRoom, idx)}
                            className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus siswa ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>
                    Total: <strong>{(customRosterMap[activeEditRoom] || []).length} siswa</strong> di {activeEditRoom}. Perubahan otomatis tersimpan dan langsung disinkronkan ke file PDF, Word, & Excel A4.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddStudent(activeEditRoom)}
                  className="text-xs font-bold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Siswa Lagi</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* LIVE A4 DOCUMENT PREVIEW (ISOLATED IFRAME WYSIWYG) */
          <div className="flex-1 bg-slate-100/80 p-3 sm:p-6 overflow-y-auto flex justify-center">
            <div
              className={`w-full bg-white shadow-xl rounded-sm border border-slate-300/80 overflow-hidden flex flex-col transition-all duration-200 ${
                pageOrientation === 'landscape'
                  ? 'max-w-[297mm] min-h-[210mm]'
                  : 'max-w-[210mm] min-h-[297mm]'
              }`}
            >
              <iframe
                title="Pratinjau Dokumen Administrasi Ujian"
                srcDoc={currentHtml}
                className={`w-full flex-1 border-none ${
                  pageOrientation === 'landscape' ? 'min-h-160' : 'min-h-200'
                }`}
                style={{ backgroundColor: '#ffffff' }}
              />
            </div>
          </div>
        )}

        {/* MODAL FOOTER */}
        <div className="px-4 sm:px-6 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>
              Format Dokumen: Standar Dinas Pendidikan | Ukuran Kertas: A4 ({pageOrientation === 'landscape' ? '297×210mm' : '210×297mm'})
            </span>
          </div>
          <div className="font-semibold text-slate-700">
            Jaminan 5 Ruangan SMP Terisi Lengkap | 1-Click Export (PDF, Word, Excel)
          </div>
        </div>
      </div>
    </div>
  );
};
