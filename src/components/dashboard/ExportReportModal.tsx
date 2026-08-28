import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ReportService } from '../../services/report.service';
import { useToastStore } from '../../store/useToastStore';
import { SIGNATORY_OFFICIALS, ExcelReportGenerator } from '../../lib/excel-generator.lib';
import { PDFPreviewModal } from './PDFPreviewModal';
import type { AttendanceRecord, LeaveRequest, UserProfile, AuditLog } from '../../types/database.types';

export interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: UserProfile[];
  attendanceRecords: AttendanceRecord[];
  leaveRequests?: LeaveRequest[];
  auditLogs?: AuditLog[];
  defaultTeacherId?: string;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  teachers,
  attendanceRecords,
  leaveRequests = [],
  auditLogs = [],
  defaultTeacherId,
}) => {
  const { showToast } = useToastStore();

  const [reportType, setReportType] = useState<'MASTER' | 'INDIVIDUAL'>('MASTER');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    defaultTeacherId || teachers[0]?.id || ''
  );
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const currentMonthIdx = new Date().getMonth();
  const [month, setMonth] = useState<string>(monthNames[currentMonthIdx] || 'Agustus');
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [isLoading, setIsLoading] = useState(false);

  // In-App PDF Preview Fallback State (When Pop-up Blocker is Active)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // Sync default teacher if provided
  React.useEffect(() => {
    if (defaultTeacherId) {
      setSelectedTeacherId(defaultTeacherId);
      setReportType('INDIVIDUAL');
    } else if (teachers.length > 0 && !selectedTeacherId) {
      setSelectedTeacherId(teachers[0].id);
    }
  }, [defaultTeacherId, teachers]);

  // Aggregate leaveRequests from props and localStorage for full cross-device synchronization
  const effectiveLeaves = React.useMemo(() => {
    const list = [...leaveRequests];
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('smart_absensi_leaves');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (!list.some((existing) => existing.id === item.id)) {
                list.push(item);
              }
            }
          }
        }
      } catch (e) {}
    }
    return list;
  }, [leaveRequests]);

  const handleExportXLSX = async () => {
    setIsLoading(true);
    try {
      if (reportType === 'MASTER') {
        await ReportService.generateAndDownloadMonthlyReport(
          month,
          year,
          teachers,
          attendanceRecords,
          effectiveLeaves,
          auditLogs
        );
        showToast('success', 'Export Excel Berhasil!', 'File Excel Laporan Master Rekapitulasi Sekolah (.xlsx) diunduh.');
      } else {
        const teacher = teachers.find((t) => t.id === selectedTeacherId) || teachers[0];
        await ReportService.generateAndDownloadIndividualReport(
          teacher,
          month,
          year,
          attendanceRecords,
          effectiveLeaves
        );
        showToast('success', 'Export Excel Berhasil!', `File Excel Laporan Presensi ${teacher.full_name} (.xlsx) diunduh.`);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mendownload Excel';
      showToast('error', 'Gagal Export', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = async () => {
    setIsLoading(true);
    try {
      let htmlContent = '';
      let titleStr = '';
      let windowOpened = false;

      if (reportType === 'MASTER') {
        titleStr = `Laporan Presensi Master Sekolah - ${month} ${year}`;
        const payload = ReportService.preparePayload(month, year, teachers, attendanceRecords, effectiveLeaves, auditLogs);
        htmlContent = ExcelReportGenerator.getPrintablePDFHTML(payload);
        windowOpened = ExcelReportGenerator.generatePrintablePDF(payload);
      } else {
        const teacher = teachers.find((t) => t.id === selectedTeacherId) || teachers[0];
        titleStr = `Laporan Presensi Individu - ${teacher.full_name}`;
        htmlContent = ExcelReportGenerator.getIndividualTeacherPDFHTML(teacher, month, year, attendanceRecords, effectiveLeaves);
        windowOpened = ExcelReportGenerator.generateIndividualTeacherPDF(teacher, month, year, attendanceRecords, effectiveLeaves);
      }

      if (windowOpened) {
        showToast('success', 'PDF Dibuka di Tab Baru!', 'Jendela cetak PDF resmi telah terbuka.');
        onClose();
      } else {
        // Pop-up blocker is active on client browser -> Show in-app preview modal
        setPreviewTitle(titleStr);
        setPreviewHtml(htmlContent);
        setIsPreviewModalOpen(true);
        showToast(
          'info',
          'Pratinjau PDF Dibuka',
          'Pop-up browser terblokir. Menampilkan pratinjau PDF di dalam aplikasi.'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencetak PDF';
      showToast('error', 'Gagal Cetak PDF', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="📊 Generator Laporan Excel (.xlsx) & PDF Resmi">
      <div className="space-y-4 py-1">
        {/* Signatory Info Banner */}
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl text-xs space-y-1 shadow-md">
          <div className="flex items-center justify-between font-bold text-emerald-400">
            <span className="flex items-center gap-1.5">
              <span>✍️</span> Pejabat Penandatangan Berkas Resmi
            </span>
            <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800">
              SINKRON
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-slate-300 border-t border-slate-800">
            <div>
              <span className="text-slate-400 block text-[10px]">Kepala Sekolah:</span>
              <strong className="text-white">{SIGNATORY_OFFICIALS.KEPSEK_NAME}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">TU (Tata Usaha):</span>
              <strong className="text-white">{SIGNATORY_OFFICIALS.TU_NAME}</strong>
            </div>
          </div>
        </div>

        {/* Dynamic Month & Year Selectors */}
        <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <label className="block text-xs font-bold text-slate-800">Periode Bulan & Tahun Laporan</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 font-bold block mb-1">Bulan</span>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {monthNames.map((mName) => (
                  <option key={mName} value={mName}>
                    {mName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold block mb-1">Tahun</span>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scope Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800">Cakupan / Jenis Laporan</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setReportType('MASTER')}
              className={`p-3 rounded-2xl border text-xs font-extrabold text-left transition-all cursor-pointer ${
                reportType === 'MASTER'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="text-base mb-1">📊</div>
              <div>Rekap Sekolah</div>
              <div className="text-[10px] font-normal text-slate-500 mt-0.5">Semua Guru & Staf (Master)</div>
            </button>

            <button
              type="button"
              onClick={() => setReportType('INDIVIDUAL')}
              className={`p-3 rounded-2xl border text-xs font-extrabold text-left transition-all cursor-pointer ${
                reportType === 'INDIVIDUAL'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="text-base mb-1">👤</div>
              <div>Laporan Per Orang</div>
              <div className="text-[10px] font-normal text-slate-500 mt-0.5">Individu Guru / Staf Spesifik</div>
            </button>
          </div>
        </div>

        {/* Teacher Selection (if INDIVIDUAL) */}
        {reportType === 'INDIVIDUAL' && (
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-800">Pilih Nama Guru / Staf</label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.nip || 'No NPP'}) — {t.position}
                </option>
              ))}
            </select>

            {selectedTeacher && (
              <p className="text-[11px] text-slate-500 pt-1">
                Laporan individu akan mencakup seluruh rincian absensi harian dan ringkasan kehadiran untuk <strong>{selectedTeacher.full_name}</strong>.
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={handleExportXLSX}
            isLoading={isLoading}
            className="w-full flex items-center justify-center gap-1.5 py-3 cursor-pointer"
          >
            <span>📊</span>
            <span>Download Excel (.xlsx)</span>
          </Button>

          <Button
            variant="primary"
            onClick={handleExportPDF}
            isLoading={isLoading}
            className="w-full flex items-center justify-center gap-1.5 py-3 cursor-pointer"
          >
            <span>🖨️</span>
            <span>Cetak PDF Resmi</span>
          </Button>
        </div>
      </div>
    </Modal>

    {/* In-App PDF Preview Fallback Modal */}
    <PDFPreviewModal
      isOpen={isPreviewModalOpen}
      onClose={() => setIsPreviewModalOpen(false)}
      title={previewTitle}
      htmlContent={previewHtml}
    />
    </>
  );
};
