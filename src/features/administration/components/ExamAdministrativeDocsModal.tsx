/**
 * SMART ABSENSI GURU — EXAM ADMINISTRATIVE DOCUMENTS MODAL
 * Interactive modal dialog providing live A4 preview and 1-click export
 * for the 4 official Indonesian school exam documents:
 * 1. Daftar Hadir Pengawas Ujian
 * 2. Daftar Serah Terima Naskah Soal & LJK (Per Ruang / Semua Ruang)
 * 3. Berita Acara Rekapitulasi Kehadiran Peserta Ujian
 * 4. Daftar Hadir Panitia Ujian
 *
 * Supported Actions:
 * - Cetak / PDF (A4 via browser native print dialog)
 * - Unduh Word (.doc)
 * - Unduh Excel (.xlsx)
 */

import React, { useState, useMemo } from 'react';
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

export const ExamAdministrativeDocsModal: React.FC<ExamAdministrativeDocsModalProps> = ({
  isOpen,
  onClose,
  matrix,
  scheduleData,
  committeeMembers,
  initialDocType = 'PROCTOR_ATTENDANCE',
  officialSignatoryOptions,
}) => {
  const [activeDocType, setActiveDocType] = useState<AdminDocType>(initialDocType);
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Extract rooms for dropdown
  const availableRooms = useMemo(() => {
    const rSet = new Set<string>();
    if (scheduleData.proctorSchedules) {
      scheduleData.proctorSchedules.forEach((p) => {
        if (p.roomName) rSet.add(p.roomName);
      });
    }
    if (rSet.size === 0) {
      const count = scheduleData.config.totalRooms || 3;
      for (let i = 1; i <= count; i++) {
        rSet.add(`Ruang ${String(i).padStart(2, '0')}`);
      }
    }
    return Array.from(rSet);
  }, [scheduleData]);

  // Options payload for generator
  const docOptions: AdminDocOptions = useMemo(() => {
    return {
      committeeHeadName: officialSignatoryOptions?.committeeHeadName,
      kepsekName: officialSignatoryOptions?.kepsekName,
      roomFilter: selectedRoom,
    };
  }, [officialSignatoryOptions, selectedRoom]);

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

  // Handlers for Export Actions
  const handlePrintA4 = () => {
    const titles: Record<AdminDocType, string> = {
      PROCTOR_ATTENDANCE: 'Daftar Hadir Pengawas',
      HANDOVER_DOCS: 'Daftar Serah Terima Naskah Soal & LJK',
      STUDENT_ATTENDANCE_SUMMARY: 'Rekapitulasi Kehadiran Peserta Ujian',
      COMMITTEE_ATTENDANCE: 'Daftar Hadir Panitia Ujian',
    };
    ExamAdministrativeDocsService.printHtmlDocument(currentHtml, titles[activeDocType]);
  };

  const handleExportWord = () => {
    const filePrefix: Record<AdminDocType, string> = {
      PROCTOR_ATTENDANCE: 'Daftar_Hadir_Pengawas',
      HANDOVER_DOCS: selectedRoom === 'ALL' ? 'Serah_Terima_Naskah_LJK_Semua_Ruang' : `Serah_Terima_${selectedRoom.replace(/\s+/g, '_')}`,
      STUDENT_ATTENDANCE_SUMMARY: 'Rekapitulasi_Kehadiran_Peserta_Ujian',
      COMMITTEE_ATTENDANCE: 'Daftar_Hadir_Panitia',
    };
    const examType = scheduleData.config.examType || 'ASTS';
    const academicYear = (scheduleData.config.academicYear || '2026/2027').replace('/', '-');
    const fileName = `${filePrefix[activeDocType]}_${examType}_${academicYear}.doc`;

    ExamAdministrativeDocsService.exportToWord(currentHtml, fileName);
    showToast(`Dokumen Word (${fileName}) berhasil diunduh.`);
  };

  const handleExportExcel = () => {
    ExamAdministrativeDocsService.exportToExcel(activeDocType, {
      matrix,
      scheduleData,
      committeeMembers,
      options: docOptions,
    });
    showToast('File Excel (.xlsx) berhasil diunduh.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col h-[94vh] max-h-[900px] border border-slate-200 overflow-hidden">
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
              </div>
              <p className="text-xs text-slate-500">
                Format fisik dinas resmi siap cetak A4, Word, dan Excel
              </p>
            </div>
          </div>

          {/* ACTION BUTTONS (PRINT, WORD, EXCEL) */}
          <div className="flex items-center flex-wrap gap-2">
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
              title="Unduh format Microsoft Word (.doc) untuk diedit bebas"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Unduh Word</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              title="Unduh format Microsoft Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Unduh Excel</span>
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

        {/* TAB NAVIGATION & CONTROLS */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shrink-0">
          {/* TAB BUTTONS */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
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
              onClick={() => setActiveDocType('HANDOVER_DOCS')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeDocType === 'HANDOVER_DOCS'
                  ? 'bg-white text-teal-700 shadow-xs border border-slate-200/80 ring-1 ring-teal-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>2. Serah Terima Soal & LJK</span>
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
              <span>3. Rekap Kehadiran Siswa</span>
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
              <span>4. Daftar Hadir Panitia</span>
            </button>
          </div>

          {/* ROOM SELECTOR FILTER (KHUSUS DOKUMEN SERAH TERIMA SOAL & LJK) */}
          {activeDocType === 'HANDOVER_DOCS' && (
            <div className="flex items-center gap-2 self-end md:self-auto">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <DoorOpen className="w-3.5 h-3.5 text-slate-500" />
                Pilihan Ruang:
              </span>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="text-xs font-bold bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 shadow-2xs cursor-pointer"
              >
                <option value="ALL">Semua Ruangan (Batch Print)</option>
                {availableRooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* TOAST ALERT NOTIFICATION */}
        {toastMsg && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* LIVE A4 DOCUMENT PREVIEW (ISOLATED IFRAME WYSIWYG) */}
        <div className="flex-1 bg-slate-100/80 p-3 sm:p-6 overflow-y-auto flex justify-center">
          <div className="w-full max-w-[210mm] bg-white shadow-xl rounded-sm border border-slate-300/80 min-h-[297mm] overflow-hidden flex flex-col">
            <iframe
              title="Pratinjau Dokumen Administrasi Ujian"
              srcDoc={currentHtml}
              className="w-full flex-1 border-none min-h-[800px]"
              style={{ backgroundColor: '#ffffff' }}
            />
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-4 sm:px-6 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>Data dokumen disinkronkan otomatis dari jadwal aktif & panitia terdaftar.</span>
          </div>
          <div className="font-semibold text-slate-700">
            Tipografi: Times New Roman | Kertas: A4 Portrait
          </div>
        </div>
      </div>
    </div>
  );
};
