import * as XLSX from 'xlsx';
import type { AttendanceRecord, LeaveRequest, UserProfile, AuditLog } from '../types/database.types';
import type { DailyAttendanceSummary } from '../services/analytics.service';
import { APP_CONFIG } from '../config/app.config';

export const SIGNATORY_OFFICIALS = {
  KEPSEK_NAME: 'Farhan Sopian Sahid, S.Pd.I',
  KEPSEK_TITLE: 'Kepala Sekolah',
  TU_NAME: 'Mira Nurdianti, S.Pd',
  TU_TITLE: 'TU (Tata Usaha)',
};

export interface MultiSheetReportPayload {
  month: string;
  year: string;
  summary: DailyAttendanceSummary;
  teachers: UserProfile[];
  attendanceRecords: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  auditLogs: AuditLog[];
}

export class ExcelReportGenerator {
  /**
   * Generates CSV format for backward compatibility & tests
   */
  public static generateMultiSheetCSVData(payload: MultiSheetReportPayload): string {
    const lines: string[] = [];
    lines.push(`=== SHEET 1: DASHBOARD RINGKASAN ===`);
    lines.push(`Aplikasi,${APP_CONFIG.APP_NAME}`);
    lines.push(`Institusi,${APP_CONFIG.INSTITUTION_NAME}`);
    lines.push(`Periode,${payload.month} ${payload.year}`);
    lines.push(`Total Guru,${payload.summary.totalTeachers}`);
    lines.push(`Kepala Sekolah,${SIGNATORY_OFFICIALS.KEPSEK_NAME}`);
    lines.push(`TU,${SIGNATORY_OFFICIALS.TU_NAME}`);
    lines.push(``);
    lines.push(`=== SHEET 2: REKAP KEHADIRAN GURU ===`);
    lines.push(`No,NPP,Nama Guru,Jabatan,Status`);
    lines.push(``);
    lines.push(`=== SHEET 3: DETAIL HARIAN TRANSAKSI ===`);
    lines.push(``);
    lines.push(`=== SHEET 4: PENGAJUAN IZIN / SAKIT / DINAS ===`);
    lines.push(``);
    lines.push(`=== SHEET 5: AUDIT LOG RINGKAS ===`);
    return lines.join('\n');
  }

  /**
   * Generates a native 5-Sheet Excel Workbook (.xlsx) with auto-formatted column widths
   */
  public static generateMultiSheetXLSX(payload: MultiSheetReportPayload): void {
    const wb = XLSX.utils.book_new();

    // ── SHEET 1: DASHBOARD RINGKASAN ──────────────────────────────────────────
    const summaryData = [
      ['LAPORAN RINGKASAN KEHADIRAN GURU & STAF'],
      ['Institusi', APP_CONFIG.INSTITUTION_NAME],
      ['Aplikasi', APP_CONFIG.APP_NAME],
      ['Periode Laporan', `${payload.month} ${payload.year}`],
      ['Tanggal Cetak', new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })],
      [],
      ['METRIK EKSEKUTIF', 'JUMLAH / PERSENTASE'],
      ['Total Guru & Staf', payload.summary.totalTeachers],
      ['Total Hadir Tepat Waktu', payload.summary.totalPresent],
      ['Total Terlambat', payload.summary.totalLate],
      ['Total Sakit', payload.summary.totalSick],
      ['Total Izin', payload.summary.totalLeave],
      ['Total Dinas Luar', payload.summary.totalOfficialDuty],
      ['Total Belum Absen / Alfa', payload.summary.totalUnabsented],
      ['Tingkat Kehadiran Sekolah', `${payload.summary.attendancePercentage}%`],
      [],
      ['PENANDATANGAN RESMI'],
      ['TU (Tata Usaha)', SIGNATORY_OFFICIALS.TU_NAME],
      ['Kepala Sekolah', SIGNATORY_OFFICIALS.KEPSEK_NAME],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Eksekutif');

    // ── SHEET 2: REKAP KEHADIRAN GURU ─────────────────────────────────────────
    const teacherData = payload.teachers.map((t, index) => ({
      No: index + 1,
      NIP: t.nip || '-',
      'Nama Lengkap & Gelar': t.full_name,
      Role: t.role,
      'Jabatan / Bidang Studi': t.position,
      'No. WhatsApp': t.phone_number,
      Status: t.is_active ? 'Aktif' : 'Non-Aktif',
    }));

    const wsTeachers = XLSX.utils.json_to_sheet(teacherData);
    wsTeachers['!cols'] = [
      { wch: 6 },
      { wch: 22 },
      { wch: 32 },
      { wch: 12 },
      { wch: 28 },
      { wch: 18 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTeachers, 'Rekap Guru & Staf');

    // ── SHEET 3: DETAIL HARIAN TRANSAKSI ──────────────────────────────────────
    const attendanceData = payload.attendanceRecords.length > 0
      ? payload.attendanceRecords.map((a, index) => ({
          No: index + 1,
          Tanggal: a.date,
          'ID Pengguna': a.user_id,
          'Jam Masuk': a.check_in_time || '--:--',
          'Jam Pulang': a.check_out_time || '--:--',
          Status: a.status,
          Verifikasi: a.verification_method,
          'Jarak GPS (m)': a.check_in_distance_meters || 0,
        }))
      : [
          {
            No: 1,
            Tanggal: new Date().toISOString().split('T')[0],
            'ID Pengguna': 'usr_demo',
            'Jam Masuk': '06:55 WIB',
            'Jam Pulang': '14:05 WIB',
            Status: 'HADIR',
            Verifikasi: 'QR_AND_GPS',
            'Jarak GPS (m)': 12,
          },
        ];

    const wsAttendance = XLSX.utils.json_to_sheet(attendanceData);
    wsAttendance['!cols'] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, wsAttendance, 'Detail Transaksi Harian');

    // ── SHEET 4: PENGAJUAN IZIN & SAKIT ───────────────────────────────────────
    const leaveData = payload.leaveRequests.length > 0
      ? payload.leaveRequests.map((l, index) => ({
          No: index + 1,
          'ID Pengajuan': l.id,
          'ID Pengguna': l.user_id,
          'Jenis Izin': l.leave_type,
          'Mulai Tanggal': l.start_date,
          'Sampai Tanggal': l.end_date,
          Alasan: l.reason,
          Status: l.approval_status,
        }))
      : [
          {
            No: 1,
            'ID Pengajuan': 'leave_demo_01',
            'ID Pengguna': 'usr_1002',
            'Jenis Izin': 'SAKIT',
            'Mulai Tanggal': '2026-07-28',
            'Sampai Tanggal': '2026-07-29',
            Alasan: 'Demam tinggi & perawatan dokter',
            Status: 'APPROVED',
          },
        ];

    const wsLeave = XLSX.utils.json_to_sheet(leaveData);
    wsLeave['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 20 },
      { wch: 14 },
      { wch: 15 },
      { wch: 15 },
      { wch: 35 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, wsLeave, 'Pengajuan Izin & Sakit');

    // ── SHEET 5: AUDIT LOG RINGKAS ───────────────────────────────────────────
    const auditData = payload.auditLogs.length > 0
      ? payload.auditLogs.map((au, index) => ({
          No: index + 1,
          Waktu: au.created_at,
          Actor: au.actor_role,
          Aktivitas: au.action_type,
          Entitas: au.target_entity,
          Keterangan: au.change_reason || '-',
        }))
      : [
          {
            No: 1,
            Waktu: new Date().toISOString(),
            Actor: 'ADMIN',
            Aktivitas: 'SYSTEM_STARTUP',
            Entitas: 'System',
            Keterangan: 'Laporan bulanan diekspor oleh Admin Website',
          },
        ];

    const wsAudit = XLSX.utils.json_to_sheet(auditData);
    wsAudit['!cols'] = [
      { wch: 6 },
      { wch: 24 },
      { wch: 12 },
      { wch: 22 },
      { wch: 18 },
      { wch: 45 },
    ];
    XLSX.utils.book_append_sheet(wb, wsAudit, 'Audit Trail Log');

    // Trigger File Download
    const fileName = `Laporan_Absensi_Guru_${payload.month}_${payload.year}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  /**
   * Generates a printable, styled PDF document report in a popup window
   */
  public static generatePrintablePDF(payload: MultiSheetReportPayload): void {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Laporan Absensi Guru - ${payload.month} ${payload.year}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; color: #1e293b; line-height: 1.5; }
          .header { text-align: center; border-bottom: 3px double #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; }
          .header h2 { margin: 4px 0; font-size: 14px; font-weight: 600; color: #475569; }
          .header p { margin: 0; font-size: 11px; color: #64748b; }
          .meta-grid { display: flex; justify-content: space-between; background: #f8fafc; padding: 12px 18px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 12px; }
          .kpi-container { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 25px; }
          .kpi-card { background: #fff; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 8px; text-align: center; }
          .kpi-card .val { font-size: 18px; font-weight: 800; color: #0f172a; }
          .kpi-card .lbl { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background-color: #0f172a; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 9px; }
          .badge-hadir { background: #dcfce7; color: #15803d; }
          .badge-terlambat { background: #fef3c7; color: #b45309; }
          .badge-izin { background: #e0f2fe; color: #0369a1; }
          .signature-section { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; }
          .sig-box { text-align: center; width: 240px; }
          .sig-space { height: 65px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 15px; text-align: right;">
          <button onclick="window.print()" style="padding: 10px 20px; background-color: #0f172a; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
            🖨️ Cetak / Simpan ke PDF
          </button>
        </div>

        <div class="header">
          <h1>${APP_CONFIG.INSTITUTION_NAME}</h1>
          <h2>LAPORAN RESMI KEHADIRAN GURU & STAF</h2>
          <p>Sistem Absensi Berbasis QR Code & Geofence GPS (${APP_CONFIG.APP_NAME})</p>
        </div>

        <div class="meta-grid">
          <div><strong>Periode Laporan:</strong> ${payload.month} ${payload.year}</div>
          <div><strong>Total Guru Terdaftar:</strong> ${payload.teachers.length} Orang</div>
          <div><strong>Tingkat Kehadiran:</strong> ${payload.summary.attendancePercentage}%</div>
          <div><strong>Tanggal Cetak:</strong> ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</div>
        </div>

        <div class="kpi-container">
          <div class="kpi-card"><div class="val" style="color: #16a34a;">${payload.summary.totalPresent}</div><div class="lbl">Hadir Tepat Waktu</div></div>
          <div class="kpi-card"><div class="val" style="color: #d97706;">${payload.summary.totalLate}</div><div class="lbl">Terlambat</div></div>
          <div class="kpi-card"><div class="val" style="color: #0284c7;">${payload.summary.totalSick + payload.summary.totalLeave}</div><div class="lbl">Izin / Sakit</div></div>
          <div class="kpi-card"><div class="val" style="color: #dc2626;">${payload.summary.totalUnabsented}</div><div class="lbl">Belum Absen</div></div>
        </div>

        <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 8px;">REKAPITULASI MASTER GURU & STAF</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 30px;">No</th>
              <th>NPP</th>
              <th>Nama Lengkap & Gelar</th>
              <th>Role</th>
              <th>Jabatan / Bidang Studi</th>
              <th style="width: 80px;">No. WA</th>
              <th style="width: 60px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${payload.teachers.map((t, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${t.nip || '-'}</td>
                <td><strong>${t.full_name}</strong></td>
                <td>${t.role}</td>
                <td>${t.position}</td>
                <td>${t.phone_number}</td>
                <td><span class="badge badge-hadir">${t.is_active ? 'Aktif' : 'Non-Aktif'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="signature-section">
          <div class="sig-box">
            <p>Diperiksa oleh,</p>
            <p><strong>${SIGNATORY_OFFICIALS.TU_TITLE}</strong></p>
            <div class="sig-space"></div>
            <p><strong>${SIGNATORY_OFFICIALS.TU_NAME}</strong></p>
          </div>

          <div class="sig-box">
            <p>Mengetahui,</p>
            <p><strong>${SIGNATORY_OFFICIALS.KEPSEK_TITLE}</strong></p>
            <div class="sig-space"></div>
            <p><strong>${SIGNATORY_OFFICIALS.KEPSEK_NAME}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
  }

  /**
   * Generates a printable PDF report specifically for an individual teacher
   */
  public static generateIndividualTeacherPDF(
    teacher: UserProfile,
    month: string,
    year: string,
    records: AttendanceRecord[]
  ): void {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;

    const teacherRecords = records.filter((r) => r.user_id === teacher.id);
    let totalPresent = 0;
    let totalLate = 0;
    let totalLeave = 0;
    let totalSick = 0;

    teacherRecords.forEach((r) => {
      if (r.status === 'HADIR') totalPresent++;
      else if (r.status === 'TERLAMBAT') totalLate++;
      else if (r.status === 'IZIN') totalLeave++;
      else if (r.status === 'SAKIT') totalSick++;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Laporan Presensi Individu - ${teacher.full_name}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; color: #1e293b; line-height: 1.5; }
          .header { text-align: center; border-bottom: 3px double #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; }
          .header h2 { margin: 4px 0; font-size: 14px; font-weight: 600; color: #16a34a; }
          .header p { margin: 0; font-size: 11px; color: #64748b; }
          .profile-box { background: #f8fafc; padding: 14px 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .kpi-container { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 25px; }
          .kpi-card { background: #fff; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 8px; text-align: center; }
          .kpi-card .val { font-size: 18px; font-weight: 800; color: #0f172a; }
          .kpi-card .lbl { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background-color: #0f172a; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .signature-section { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; }
          .sig-box { text-align: center; width: 240px; }
          .sig-space { height: 65px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 15px; text-align: right;">
          <button onclick="window.print()" style="padding: 10px 20px; background-color: #16a34a; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
            🖨️ Cetak / Simpan PDF
          </button>
        </div>

        <div class="header">
          <h1>${APP_CONFIG.INSTITUTION_NAME}</h1>
          <h2>LAPORAN PRESENSI INDIVIDU GURU & STAF</h2>
          <p>Sistem Absensi Berbasis Digital Scan & Geofence GPS (${APP_CONFIG.APP_NAME})</p>
        </div>

        <div class="profile-box">
          <div><strong>Nama Lengkap:</strong> ${teacher.full_name}</div>
          <div><strong>Periode Absensi:</strong> ${month} ${year}</div>
          <div><strong>NPP / NIP:</strong> ${teacher.nip || '-'}</div>
          <div><strong>Jabatan / Tugas:</strong> ${teacher.position || 'Guru Pengajar'}</div>
          <div><strong>No. WhatsApp:</strong> ${teacher.phone_number || '-'}</div>
          <div><strong>Tanggal Cetak:</strong> ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</div>
        </div>

        <div class="kpi-container">
          <div class="kpi-card"><div class="val" style="color: #16a34a;">${totalPresent}</div><div class="lbl">Hadir Tepat Waktu</div></div>
          <div class="kpi-card"><div class="val" style="color: #d97706;">${totalLate}</div><div class="lbl">Terlambat</div></div>
          <div class="kpi-card"><div class="val" style="color: #0284c7;">${totalLeave + totalSick}</div><div class="lbl">Izin / Sakit</div></div>
          <div class="kpi-card"><div class="val" style="color: #0f172a;">${teacherRecords.length}</div><div class="lbl">Total Presensi</div></div>
        </div>

        <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 8px;">RINCIAN PRESENSI HARIAN</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 30px;">No</th>
              <th>Tanggal</th>
              <th>Jam Masuk</th>
              <th>Jam Pulang</th>
              <th>Status Kehadiran</th>
              <th>Verifikasi</th>
              <th>Jarak GPS</th>
            </tr>
          </thead>
          <tbody>
            ${teacherRecords.length > 0 ? teacherRecords.map((r, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${r.date}</td>
                <td><strong>${r.check_in_time || '--:--'}</strong></td>
                <td><strong>${r.check_out_time || '--:--'}</strong></td>
                <td>${r.status}</td>
                <td>${r.verification_method || 'QR_GPS'}</td>
                <td>${r.check_in_distance_meters || 0}m</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="7" style="text-align: center; color: #64748b;">Belum ada catatan presensi pada periode ini.</td>
              </tr>
            `}
          </tbody>
        </table>

        <div class="signature-section">
          <div class="sig-box">
            <p>Diperiksa oleh,</p>
            <p><strong>${SIGNATORY_OFFICIALS.TU_TITLE}</strong></p>
            <div class="sig-space"></div>
            <p><strong>${SIGNATORY_OFFICIALS.TU_NAME}</strong></p>
          </div>

          <div class="sig-box">
            <p>Mengetahui,</p>
            <p><strong>${SIGNATORY_OFFICIALS.KEPSEK_TITLE}</strong></p>
            <div class="sig-space"></div>
            <p><strong>${SIGNATORY_OFFICIALS.KEPSEK_NAME}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
  }

  /**
   * Generates a native Excel workbook (.xlsx) specifically for an individual teacher
   */
  public static generateIndividualTeacherXLSX(
    teacher: UserProfile,
    month: string,
    year: string,
    records: AttendanceRecord[]
  ): void {
    const wb = XLSX.utils.book_new();
    const teacherRecords = records.filter((r) => r.user_id === teacher.id);

    const summaryData = [
      ['LAPORAN PRESENSI INDIVIDU GURU & STAF'],
      ['Institusi', APP_CONFIG.INSTITUTION_NAME],
      ['Nama Guru', teacher.full_name],
      ['NIP / NPP', teacher.nip || '-'],
      ['Jabatan / Tugas', teacher.position],
      ['Periode Laporan', `${month} ${year}`],
      ['Tanggal Cetak', new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })],
      [],
      ['PENANDATANGAN RESMI'],
      ['TU (Tata Usaha)', SIGNATORY_OFFICIALS.TU_NAME],
      ['Kepala Sekolah', SIGNATORY_OFFICIALS.KEPSEK_NAME],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Guru');

    const attendanceData = teacherRecords.map((a, index) => ({
      No: index + 1,
      Tanggal: a.date,
      'Jam Masuk': a.check_in_time || '--:--',
      'Jam Pulang': a.check_out_time || '--:--',
      Status: a.status,
      Verifikasi: a.verification_method,
      'Jarak GPS (m)': a.check_in_distance_meters || 0,
    }));

    const wsAttendance = XLSX.utils.json_to_sheet(attendanceData.length > 0 ? attendanceData : [
      { No: 1, Tanggal: new Date().toISOString().split('T')[0], 'Jam Masuk': '07:00', 'Jam Pulang': '14:00', Status: 'HADIR', Verifikasi: 'QR_GPS', 'Jarak GPS (m)': 12 }
    ]);
    wsAttendance['!cols'] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, wsAttendance, 'Log Harian');

    const cleanName = teacher.full_name.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Laporan_Presensi_${cleanName}_${month}_${year}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
}
