import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Search,
  Users,
  CheckCircle2,
  Clock,
  FileText,
  Eye,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  UserCheck,
  FileCheck2,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ExportReportModal } from '../../../components/dashboard/ExportReportModal';
import { PDFPreviewModal } from '../../../components/dashboard/PDFPreviewModal';
import { ReportService } from '../../../services/report.service';
import { ExcelReportGenerator, SIGNATORY_OFFICIALS, isTeacherRecordMatch, isTeacherLeaveMatch } from '../../../lib/excel-generator.lib';
import { ProviderFactory } from '../../../providers/provider-factory';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { parseIndonesianMonth, formatTimeForInput } from '../../../utils/time.utils';
import type { AttendanceRecord, LeaveRequest, UserProfile, AuditLog, HolidayRecord } from '../../../types/database.types';

export interface AttendanceReportViewProps {
  teachers: UserProfile[];
  attendanceRecords: AttendanceRecord[];
  leaveRequests?: LeaveRequest[];
  auditLogs?: AuditLog[];
  onBackToDashboard?: () => void;
  onRefresh?: () => void;
}

export const AttendanceReportView: React.FC<AttendanceReportViewProps> = ({
  teachers,
  attendanceRecords: initialAttendanceRecords,
  leaveRequests = [],
  auditLogs = [],
  onBackToDashboard,
  onRefresh,
}) => {
  const { showToast } = useToastStore();
  const token = useAuthStore((state) => state.token) || '';

  // ── FILTER BULAN & TAHUN ────────────────────────────────────────────────────
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const currentDate = new Date();
  const currentMonthName = monthNames[currentDate.getMonth()] || 'September';
  const currentYearStr = String(currentDate.getFullYear());

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthName);
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [activeSubTab, setActiveSubTab] = useState<'REKAP_GURU' | 'DETAIL_HARIAN' | 'IZIN_CUTI' | 'PREVIEW_PDF'>('REKAP_GURU');

  // Search & Filter
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [dailyDateFilter, setDailyDateFilter] = useState('');
  const [dailyStatusFilter, setDailyStatusFilter] = useState<'ALL' | 'HADIR' | 'TERLAMBAT' | 'SAKIT' | 'IZIN' | 'ALFA'>('ALL');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');

  // Modal Dialogs
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Custom Month Attendance Records (if different month fetched)
  const [monthlyRecords, setMonthlyRecords] = useState<AttendanceRecord[]>(initialAttendanceRecords);

  // Sync initial records
  useEffect(() => {
    setMonthlyRecords(initialAttendanceRecords);
  }, [initialAttendanceRecords]);

  // Load monthly records on month/year change
  const fetchMonthlyRecords = async (m: string, y: string) => {
    setIsRefreshing(true);
    try {
      const monthNum = parseIndonesianMonth(m);
      const monthStr = String(monthNum).padStart(2, '0');
      const provider = ProviderFactory.getProvider();
      const recs = await provider.getMonthlyAttendance('ALL', monthStr, y, token);
      setMonthlyRecords(recs || []);
    } catch (err) {
      console.warn('Gagal memuat rekap bulanan terpilih:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    fetchMonthlyRecords(newMonth, selectedYear);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = e.target.value;
    setSelectedYear(newYear);
    fetchMonthlyRecords(selectedMonth, newYear);
  };

  // Holidays
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  useEffect(() => {
    ProviderFactory.getProvider()
      .getHolidays()
      .then((h) => {
        if (h) setHolidays(h);
      })
      .catch(() => {});
  }, []);

  // Effective Leaves
  const effectiveLeaves = useMemo(() => {
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

  // Prepare Master Payload
  const reportPayload = useMemo(() => {
    return ReportService.preparePayload(
      selectedMonth,
      selectedYear,
      teachers,
      monthlyRecords,
      effectiveLeaves,
      auditLogs,
      holidays
    );
  }, [selectedMonth, selectedYear, teachers, monthlyRecords, effectiveLeaves, auditLogs, holidays]);

  const monthNumber = useMemo(() => parseIndonesianMonth(selectedMonth), [selectedMonth]);
  const monthPrefix = useMemo(() => `${selectedYear}-${String(monthNumber).padStart(2, '0')}`, [selectedYear, monthNumber]);
  const effectiveWorkingDays = reportPayload.workingDaysInfo?.effectiveWorkingDays || 22;

  // ── PER-TEACHER REKAP DATA (SHEET 2) ────────────────────────────────────────
  const teachersRecapList = useMemo(() => {
    return reportPayload.teachers.map((t, idx) => {
      const tRecords = monthlyRecords.filter(
        (r) => isTeacherRecordMatch(t, r) && (!r.date || r.date.startsWith(monthPrefix))
      );
      const presentCount = tRecords.filter((r) => r.status === 'HADIR').length;
      const lateCount = tRecords.filter((r) => r.status === 'TERLAMBAT').length;
      const totalMasuk = presentCount + lateCount;
      const leaveSickCount = tRecords.filter(
        (r) => r.status === 'IZIN' || r.status === 'SAKIT' || r.status === 'DINAS_LUAR'
      ).length;
      const alfaCount = tRecords.filter((r) => r.status === 'ALFA').length;
      const attendancePct = Math.min(100, Math.round((totalMasuk / Math.max(1, effectiveWorkingDays)) * 100));

      return {
        no: idx + 1,
        teacher: t,
        npp: t.nip ? (t.nip.startsWith('NPP.') ? t.nip : `NPP. ${t.nip}`) : 'NPP. ••••••••',
        fullName: t.full_name,
        position: t.position || 'Tenaga Pendidik',
        presentCount,
        lateCount,
        leaveSickCount,
        alfaCount,
        totalMasuk,
        targetDays: effectiveWorkingDays,
        attendancePct,
        isActive: t.is_active !== false,
      };
    });
  }, [reportPayload.teachers, monthlyRecords, monthPrefix, effectiveWorkingDays]);

  // Filtered Teachers
  const filteredTeachersRecap = useMemo(() => {
    if (!teacherSearchQuery.trim()) return teachersRecapList;
    const q = teacherSearchQuery.toLowerCase();
    return teachersRecapList.filter(
      (item) =>
        item.fullName.toLowerCase().includes(q) ||
        item.npp.toLowerCase().includes(q) ||
        item.position.toLowerCase().includes(q)
    );
  }, [teachersRecapList, teacherSearchQuery]);

  // ── DETAIL HARIAN TRANSAKSI (SHEET 3) ───────────────────────────────────────
  const dailyTransactionsList = useMemo(() => {
    const recs = monthlyRecords.filter((r) => !r.date || r.date.startsWith(monthPrefix));
    return recs.map((r, idx) => {
      const matchedTeacher = teachers.find((t) => isTeacherRecordMatch(t, r));
      return {
        no: idx + 1,
        id: r.id,
        date: r.date,
        timeIn: r.check_in_time ? formatTimeForInput(r.check_in_time) : '--:--',
        timeOut: r.check_out_time ? formatTimeForInput(r.check_out_time) : '--:--',
        status: r.status,
        teacherName: matchedTeacher?.full_name || r.user_id,
        npp: matchedTeacher?.nip ? (matchedTeacher.nip.startsWith('NPP.') ? matchedTeacher.nip : `NPP. ${matchedTeacher.nip}`) : 'NPP. ••••••••',
        verification: r.verification_method || 'QR_AND_GPS',
        distanceMeters: r.check_in_distance_meters || 0,
        notes: r.notes || '-',
      };
    });
  }, [monthlyRecords, monthPrefix, teachers]);

  // Filtered Daily Transactions
  const filteredDailyTransactions = useMemo(() => {
    return dailyTransactionsList.filter((item) => {
      if (dailyDateFilter && item.date !== dailyDateFilter) return false;
      if (dailyStatusFilter !== 'ALL' && item.status !== dailyStatusFilter) return false;
      if (teacherSearchQuery.trim()) {
        const q = teacherSearchQuery.toLowerCase();
        if (!item.teacherName.toLowerCase().includes(q) && !item.npp.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [dailyTransactionsList, dailyDateFilter, dailyStatusFilter, teacherSearchQuery]);

  // ── REKAP PENGAJUAN IZIN & CUTI (SHEET 4) ──────────────────────────────────
  const leavesRecapList = useMemo(() => {
    return effectiveLeaves.filter((l) => {
      const start = (l.start_date || '').substring(0, 7);
      const end = (l.end_date || '').substring(0, 7);
      return start === monthPrefix || end === monthPrefix;
    }).map((l, idx) => {
      const matchedTeacher = teachers.find((t) => isTeacherLeaveMatch(t, l));
      const startTime = new Date(l.start_date).getTime();
      const endTime = new Date(l.end_date).getTime();
      const daysDuration = !isNaN(startTime) && !isNaN(endTime) && endTime >= startTime
        ? Math.round((endTime - startTime) / (1000 * 60 * 60 * 24)) + 1
        : 1;

      return {
        no: idx + 1,
        id: l.id,
        teacherName: matchedTeacher?.full_name || l.teacher_name || l.user_name || l.user_id,
        npp: matchedTeacher?.nip ? (matchedTeacher.nip.startsWith('NPP.') ? matchedTeacher.nip : `NPP. ${matchedTeacher.nip}`) : 'NPP. ••••••••',
        leaveType: l.leave_type,
        startDate: l.start_date,
        endDate: l.end_date,
        daysCount: daysDuration,
        reason: l.reason,
        status: l.approval_status || 'PENDING',
        approvedBy: l.approved_by || '-',
      };
    });
  }, [effectiveLeaves, monthPrefix, teachers]);

  // Filtered Leaves
  const filteredLeaves = useMemo(() => {
    return leavesRecapList.filter((item) => {
      if (leaveStatusFilter !== 'ALL' && item.status !== leaveStatusFilter) return false;
      if (teacherSearchQuery.trim()) {
        const q = teacherSearchQuery.toLowerCase();
        if (!item.teacherName.toLowerCase().includes(q) && !item.npp.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [leavesRecapList, leaveStatusFilter, teacherSearchQuery]);

  // ── QUICK ACTION HANDLERS ──────────────────────────────────────────────────
  const handleDownloadExcel = async () => {
    setIsDownloading(true);
    try {
      await ReportService.generateAndDownloadMonthlyReport(
        selectedMonth,
        selectedYear,
        teachers,
        monthlyRecords,
        effectiveLeaves,
        auditLogs,
        holidays
      );
      showToast('success', 'Download Berhasil', `File Excel Laporan Presensi ${selectedMonth} ${selectedYear} (.xlsx) telah diunduh.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mendownload Excel';
      showToast('error', 'Gagal Download', msg);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrintPDF = async () => {
    setIsDownloading(true);
    try {
      const htmlContent = ExcelReportGenerator.getPrintablePDFHTML(reportPayload);
      const opened = ExcelReportGenerator.generatePrintablePDF(reportPayload);
      if (opened) {
        showToast('success', 'Jendela Cetak Dibuka', `Laporan PDF ${selectedMonth} ${selectedYear} siap dicetak.`);
      } else {
        setPreviewTitle(`Laporan Presensi Sekolah - ${selectedMonth} ${selectedYear}`);
        setPreviewHtml(htmlContent);
        setIsPreviewModalOpen(true);
        showToast('info', 'Pratinjau PDF', 'Pop-up browser terblokir. Menampilkan pratinjau di dalam aplikasi.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencetak PDF';
      showToast('error', 'Gagal Cetak PDF', msg);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrintIndividualTeacherPDF = (teacher: UserProfile) => {
    try {
      const htmlContent = ExcelReportGenerator.getIndividualTeacherPDFHTML(
        teacher,
        selectedMonth,
        selectedYear,
        monthlyRecords,
        effectiveLeaves,
        holidays
      );
      const opened = ExcelReportGenerator.generateIndividualTeacherPDF(
        teacher,
        selectedMonth,
        selectedYear,
        monthlyRecords,
        effectiveLeaves,
        holidays
      );
      if (opened) {
        showToast('success', 'PDF Dibuka', `Laporan presensi individu ${teacher.full_name} siap dicetak.`);
      } else {
        setPreviewTitle(`Laporan Presensi Individu - ${teacher.full_name}`);
        setPreviewHtml(htmlContent);
        setIsPreviewModalOpen(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat laporan individu';
      showToast('error', 'Gagal Laporan Individu', msg);
    }
  };

  // Printable HTML for Tab 4 Preview
  const inPagePDFHtml = useMemo(() => {
    return ExcelReportGenerator.getPrintablePDFHTML(reportPayload);
  }, [reportPayload]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 animate-fade-in font-sans">
      {/* ── HEADER HALAMAN & KONTROL TOOLBAR ─────────────────────────────── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {onBackToDashboard && (
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="p-1.5 -ml-1 text-slate-500 hover:text-[#023246] hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Kembali ke Dashboard Utama"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h1 className="text-xl sm:text-2xl font-black text-[#023246] tracking-tight flex items-center gap-2">
                <span>Laporan & Rekapitulasi Presensi</span>
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#023246]/10 text-[#023246] border border-[#023246]/20">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#287094]" />
                Multi-Sheet & PDF Resmi
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
              Tinjau data rekapitulasi kehadiran guru, rincian log harian, pengajuan izin, serta cetak lembar tanda tangan resmi lengkap dengan Kop Surat sekolah.
            </p>
          </div>

          {/* Selector Periode & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Bulan Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-[#D4D4CE]/80">
              <Calendar className="w-4 h-4 text-[#287094] ml-1" />
              <select
                value={selectedMonth}
                onChange={handleMonthChange}
                className="bg-transparent text-xs sm:text-sm font-bold text-[#023246] focus:outline-hidden cursor-pointer"
              >
                {monthNames.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              {/* Tahun Selector */}
              <select
                value={selectedYear}
                onChange={handleYearChange}
                className="bg-transparent text-xs sm:text-sm font-bold text-[#023246] focus:outline-hidden cursor-pointer border-l border-slate-300 pl-1.5"
              >
                {['2024', '2025', '2026', '2027'].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              {onRefresh && (
                <button
                  type="button"
                  onClick={() => {
                    fetchMonthlyRecords(selectedMonth, selectedYear);
                    onRefresh();
                  }}
                  disabled={isRefreshing}
                  className="p-1 text-slate-400 hover:text-[#023246] transition-colors rounded-lg"
                  title="Muat Ulang Data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#287094]' : ''}`} />
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadExcel}
              disabled={isDownloading}
              className="text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Mengunduh...' : 'Download Excel'}</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrintPDF}
              disabled={isDownloading}
              className="text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak PDF</span>
            </Button>

            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="px-3 py-2 text-xs font-bold text-[#023246] bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Buka Generator Laporan Kustom"
            >
              <span>⚙️</span>
              <span className="hidden sm:inline">Kustom</span>
            </button>
          </div>
        </div>

        {/* ── PEJABAT PENANDATANGAN BANNER ────────────────────────────────── */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#023246] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Pejabat Penandatangan Resmi:
            </span>
            <span className="bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
              Kepala Sekolah: <strong className="text-[#023246]">{SIGNATORY_OFFICIALS.KEPSEK_NAME}</strong>
            </span>
            <span className="bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
              TU: <strong className="text-[#023246]">{SIGNATORY_OFFICIALS.TU_NAME}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Periode Aktif: {selectedMonth} {selectedYear} ({effectiveWorkingDays} Hari Kerja)</span>
          </div>
        </div>
      </div>

      {/* ── 4 KARTU STATISTIK KPI UTAMA BULANAN ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Tingkat Kehadiran Bulanan */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Kehadiran Bulanan
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-[#023246]">
              {reportPayload.summary.attendancePercentage}%
            </span>
            <span className="text-xs text-slate-500 font-semibold">rata-rata</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                reportPayload.summary.attendancePercentage >= 90
                  ? 'bg-emerald-500'
                  : reportPayload.summary.attendancePercentage >= 75
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, reportPayload.summary.attendancePercentage)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 truncate">
            Dari {reportPayload.summary.totalTeachers} guru terdaftar
          </p>
        </div>

        {/* Hadir Tepat Waktu */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Hadir Tepat Waktu
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-[#023246]">
              {reportPayload.summary.totalPresent}
            </span>
            <span className="text-xs text-slate-500 font-semibold">hari masuk</span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">
            Check-in sebelum batas jam masuk
          </p>
        </div>

        {/* Keterlambatan */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Keterlambatan
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-900">
              {reportPayload.summary.totalLate}
            </span>
            <span className="text-xs text-slate-500 font-semibold">hari terlambat</span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">
            Tetap terhitung masuk & bertugas
          </p>
        </div>

        {/* Izin, Sakit & Cuti */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Izin / Sakit / Cuti
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-[#023246]">
              {reportPayload.summary.totalLeave + reportPayload.summary.totalSick + reportPayload.summary.totalOfficialDuty}
            </span>
            <span className="text-xs text-slate-500 font-semibold">hari izin</span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">
            {reportPayload.summary.totalAlfa} hari tanpa keterangan (Alpa)
          </p>
        </div>
      </div>

      {/* ── NAVIGASI SUB-TAB LAPORAN ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/70 p-2 sm:p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Tab Pill Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveSubTab('REKAP_GURU')}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'REKAP_GURU'
                    ? 'bg-[#023246] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>1. Rekap Guru & Staf</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/60 font-semibold">
                  {teachersRecapList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('DETAIL_HARIAN')}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'DETAIL_HARIAN'
                    ? 'bg-[#023246] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>2. Detail Presensi Harian</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/60 font-semibold">
                  {dailyTransactionsList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('IZIN_CUTI')}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'IZIN_CUTI'
                    ? 'bg-[#023246] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>3. Rekap Izin & Cuti</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/60 font-semibold">
                  {leavesRecapList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('PREVIEW_PDF')}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'PREVIEW_PDF'
                    ? 'bg-[#023246] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>4. Pratinjau Dokumen PDF</span>
              </button>
            </div>

            {/* Pencarian Universal */}
            {activeSubTab !== 'PREVIEW_PDF' && (
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama atau NPP..."
                  value={teacherSearchQuery}
                  onChange={(e) => setTeacherSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#D4D4CE] rounded-xl text-[#023246] focus:outline-hidden focus:ring-2 focus:ring-[#287094]"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── KONTEN SUB-TAB 1: REKAP GURU & STAF ─────────────────────────── */}
        {activeSubTab === 'REKAP_GURU' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
              <p>
                Menampilkan rekapitulasi kehadiran individual untuk <strong>{filteredTeachersRecap.length}</strong> guru pada bulan <strong>{selectedMonth} {selectedYear}</strong>.
              </p>
              <span className="text-[11px] font-bold text-slate-400">
                Target Hari Kerja: {effectiveWorkingDays} hari
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200">
                    <th className="py-3 px-3 text-center w-12">No</th>
                    <th className="py-3 px-3 min-w-32.5">NPP</th>
                    <th className="py-3 px-3 min-w-45">Nama Lengkap & Gelar</th>
                    <th className="py-3 px-3 min-w-35">Jabatan</th>
                    <th className="py-3 px-3 text-center">Tepat Waktu</th>
                    <th className="py-3 px-3 text-center">Terlambat</th>
                    <th className="py-3 px-3 text-center">Izin/Sakit</th>
                    <th className="py-3 px-3 text-center">Alpa</th>
                    <th className="py-3 px-3 text-center font-black text-[#023246]">Total Masuk</th>
                    <th className="py-3 px-3 text-center min-w-27.5">Persentase</th>
                    <th className="py-3 px-3 text-center w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTeachersRecap.length > 0 ? (
                    filteredTeachersRecap.map((item) => (
                      <tr key={item.teacher.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-semibold">{item.no}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#023246]">{item.npp}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[#023246]">{item.fullName}</div>
                          <span className="text-[10px] text-slate-400">{item.teacher.role}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{item.position}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-blue-700 bg-blue-50/40">{item.presentCount}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-amber-700 bg-amber-50/40">{item.lateCount}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-purple-700 bg-purple-50/40">{item.leaveSickCount}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-red-600 bg-red-50/40">{item.alfaCount}</td>
                        <td className="py-2.5 px-3 text-center font-black text-[#023246] bg-slate-50">
                          {item.totalMasuk} <span className="text-[10px] text-slate-400 font-normal">/ {item.targetDays}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span
                              className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                                item.attendancePct >= 90
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.attendancePct >= 75
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {item.attendancePct}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handlePrintIndividualTeacherPDF(item.teacher)}
                            className="px-2 py-1 text-[11px] font-bold text-[#023246] hover:bg-[#023246] hover:text-white rounded-lg border border-slate-300 transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto"
                            title={`Cetak Laporan PDF Individu untuk ${item.fullName}`}
                          >
                            <Printer className="w-3 h-3" />
                            <span>PDF</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400">
                        Tidak ada data guru yang cocok dengan pencarian "{teacherSearchQuery}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── KONTEN SUB-TAB 2: DETAIL PRESENSI HARIAN ─────────────────────── */}
        {activeSubTab === 'DETAIL_HARIAN' && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Filter Tanggal & Status */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-600">Filter Tanggal:</span>
                  <input
                    type="date"
                    value={dailyDateFilter}
                    onChange={(e) => setDailyDateFilter(e.target.value)}
                    className="bg-transparent text-[#023246] font-bold focus:outline-hidden cursor-pointer text-xs"
                  />
                  {dailyDateFilter && (
                    <button
                      type="button"
                      onClick={() => setDailyDateFilter('')}
                      className="text-slate-400 hover:text-red-600 font-bold ml-1 cursor-pointer"
                      title="Reset filter tanggal"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-600">Status:</span>
                  <select
                    value={dailyStatusFilter}
                    onChange={(e) => setDailyStatusFilter(e.target.value as any)}
                    className="bg-transparent text-[#023246] font-bold focus:outline-hidden cursor-pointer text-xs"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="HADIR">Hadir Tepat Waktu</option>
                    <option value="TERLAMBAT">Terlambat</option>
                    <option value="IZIN">Izin</option>
                    <option value="SAKIT">Sakit</option>
                    <option value="ALFA">Alpa</option>
                  </select>
                </div>
              </div>

              <div className="text-slate-500 font-semibold text-[11px]">
                Menampilkan <strong>{filteredDailyTransactions.length}</strong> transaksi presensi
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200">
                    <th className="py-3 px-3 text-center w-12">No</th>
                    <th className="py-3 px-3 min-w-25">Tanggal</th>
                    <th className="py-3 px-3 min-w-32.5">NPP</th>
                    <th className="py-3 px-3 min-w-45">Nama Guru</th>
                    <th className="py-3 px-3 text-center">Jam Masuk</th>
                    <th className="py-3 px-3 text-center">Jam Pulang</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Metode</th>
                    <th className="py-3 px-3 text-center">Jarak GPS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDailyTransactions.length > 0 ? (
                    filteredDailyTransactions.slice(0, 100).map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-semibold">{r.no}</td>
                        <td className="py-2.5 px-3 font-semibold text-[#023246]">{r.date}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-600">{r.npp}</td>
                        <td className="py-2.5 px-3 font-bold text-[#023246]">{r.teacherName}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold text-blue-800">{r.timeIn}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold text-purple-800">{r.timeOut}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              r.status === 'HADIR'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'TERLAMBAT'
                                ? 'bg-amber-100 text-amber-900'
                                : r.status === 'SAKIT'
                                ? 'bg-purple-100 text-purple-800'
                                : r.status === 'IZIN'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500 font-medium text-[11px]">
                          {r.verification.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600 text-[11px]">
                          {r.distanceMeters > 0 ? `${r.distanceMeters}m` : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Belum ada data transaksi presensi harian pada periode dan filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredDailyTransactions.length > 100 && (
              <p className="text-center text-slate-400 text-[11px]">
                Menampilkan 100 baris pertama. Unduh file Excel untuk melihat keseluruhan {filteredDailyTransactions.length} transaksi.
              </p>
            )}
          </div>
        )}

        {/* ── KONTEN SUB-TAB 3: REKAP PENGAJUAN IZIN & CUTI ─────────────────── */}
        {activeSubTab === 'IZIN_CUTI' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-600">Status Persetujuan:</span>
                <select
                  value={leaveStatusFilter}
                  onChange={(e) => setLeaveStatusFilter(e.target.value as any)}
                  className="bg-transparent text-[#023246] font-bold focus:outline-hidden cursor-pointer text-xs"
                >
                  <option value="ALL">Semua Pengajuan</option>
                  <option value="APPROVED">Disetujui (Approved)</option>
                  <option value="PENDING">Menunggu (Pending)</option>
                  <option value="REJECTED">Ditolak (Rejected)</option>
                </select>
              </div>

              <div className="text-slate-500 font-semibold text-[11px]">
                Menampilkan <strong>{filteredLeaves.length}</strong> pengajuan izin/cuti
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200">
                    <th className="py-3 px-3 text-center w-12">No</th>
                    <th className="py-3 px-3 min-w-32.5">NPP</th>
                    <th className="py-3 px-3 min-w-45">Nama Guru</th>
                    <th className="py-3 px-3 min-w-27.5">Tipe Izin</th>
                    <th className="py-3 px-3 min-w-40">Rentang Tanggal</th>
                    <th className="py-3 px-3 text-center w-20">Durasi</th>
                    <th className="py-3 px-3 min-w-50">Alasan / Keterangan</th>
                    <th className="py-3 px-3 text-center w-28">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeaves.length > 0 ? (
                    filteredLeaves.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-semibold">{item.no}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-600">{item.npp}</td>
                        <td className="py-2.5 px-3 font-bold text-[#023246]">{item.teacherName}</td>
                        <td className="py-2.5 px-3 font-semibold text-purple-800">
                          {item.leaveType.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {item.startDate} s/d {item.endDate}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-[#023246]">
                          {item.daysCount} hari
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-xs" title={item.reason}>
                          {item.reason || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              item.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'REJECTED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {item.status === 'APPROVED'
                              ? 'DISETUJUI'
                              : item.status === 'REJECTED'
                              ? 'DITOLAK'
                              : 'MENUNGGU'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Tidak ada pengajuan izin atau cuti pada periode {selectedMonth} {selectedYear}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── KONTEN SUB-TAB 4: PRATINJAU DOKUMEN PDF RESMI ───────────────── */}
        {activeSubTab === 'PREVIEW_PDF' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-[#023246] text-xs sm:text-sm">
                  Pratinjau Berkas Cetak Resmi (Kop Surat & Lembar Tanda Tangan)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Dokumen ini disajikan lengkap sesuai format cetak A4 resmi sekolah.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePrintPDF}
                  className="text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Simpan PDF</span>
                </Button>
              </div>
            </div>

            <div className="w-full h-[70vh] min-h-120 bg-slate-100 rounded-2xl overflow-hidden border border-slate-300 shadow-inner">
              <iframe
                ref={iframeRef}
                srcDoc={inPagePDFHtml}
                title="Pratinjau PDF Laporan Resmi"
                className="w-full h-full border-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL EXPORT REPORT DIALOG (KUSTOM) ───────────────────────────── */}
      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        teachers={teachers}
        attendanceRecords={monthlyRecords}
        leaveRequests={effectiveLeaves}
        auditLogs={auditLogs}
      />

      {/* ── MODAL PDF PREVIEW FALLBACK ───────────────────────────────────── */}
      <PDFPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title={previewTitle}
        htmlContent={previewHtml}
      />
    </div>
  );
};
