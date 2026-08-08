import React, { useState, useMemo } from 'react';
import type { UserProfile, AttendanceRecord, LeaveRequest, AttendanceStatus } from '../../../types/database.types';
import { AnalyticsService } from '../../../services/analytics.service';
import { FeatureGate } from '../../../components/ui/FeatureGate';
import { evaluateAttendanceStatus, isDateOffDay } from '../../../utils/time.utils';

export interface DailyAttendanceTrackerProps {
  teachers: UserProfile[];
  attendanceRecords?: AttendanceRecord[];
  leaveRequests?: LeaveRequest[];
  onOpenCorrectionModal?: (teacher?: UserProfile) => void;
}

type StatusFilter = 'ALL' | 'HADIR' | 'TERLAMBAT' | 'IZIN_SAKIT' | 'BELUM_ABSEN';

export const DailyAttendanceTracker: React.FC<DailyAttendanceTrackerProps> = ({
  teachers,
  attendanceRecords = [],
  leaveRequests = [],
  onOpenCorrectionModal,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Calculate Daily Analytics Stats
  const summary = useMemo(() => {
    return AnalyticsService.calculateDailySummary(selectedDate, teachers, attendanceRecords, leaveRequests);
  }, [selectedDate, teachers, attendanceRecords, leaveRequests]);

  // 2. Identify attendance state map for each teacher for selectedDate
  const teacherAttendanceMap = useMemo(() => {
    const map = new Map<string, {
      record?: AttendanceRecord;
      leave?: LeaveRequest;
      status: AttendanceStatus | 'BELUM_ABSEN';
      checkInTime?: string;
      checkOutTime?: string;
      notes?: string;
    }>();

    // Map attendance records
    for (const rec of attendanceRecords) {
      if (rec.date === selectedDate) {
        const effectiveStatus = evaluateAttendanceStatus(rec.check_in_time, '07:15', rec.status);
        map.set(rec.user_id, {
          record: rec,
          status: effectiveStatus,
          checkInTime: rec.check_in_time ? rec.check_in_time.substring(0, 5) : undefined,
          checkOutTime: rec.check_out_time ? rec.check_out_time.substring(0, 5) : undefined,
        });
      }
    }

    // Map leave requests
    for (const leave of leaveRequests) {
      if (leave.approval_status === 'APPROVED') {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        const target = new Date(selectedDate);

        if (target >= start && target <= end) {
          const status: AttendanceStatus = leave.leave_type === 'SAKIT' ? 'SAKIT' : leave.leave_type === 'IZIN' ? 'IZIN' : 'DINAS_LUAR';
          map.set(leave.user_id, {
            leave,
            status,
            notes: leave.reason,
          });
        }
      }
    }

    // Set default BELUM_ABSEN for teachers not found in map
    for (const teacher of teachers) {
      if (!map.has(teacher.id)) {
        map.set(teacher.id, {
          status: 'BELUM_ABSEN',
        });
      }
    }

    return map;
  }, [selectedDate, teachers, attendanceRecords, leaveRequests]);

  // 3. Filtered list of teachers based on search query and status filter
  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
      // Search query filter (Name, NIP, Position)
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        teacher.full_name.toLowerCase().includes(query) ||
        (teacher.nip ? teacher.nip.includes(query) : false) ||
        (teacher.position && teacher.position.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      // Status filter
      const item = teacherAttendanceMap.get(teacher.id);
      const status = item?.status || 'BELUM_ABSEN';

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'HADIR') return status === 'HADIR';
      if (statusFilter === 'TERLAMBAT') return status === 'TERLAMBAT';
      if (statusFilter === 'IZIN_SAKIT') return status === 'IZIN' || status === 'SAKIT' || status === 'DINAS_LUAR';
      if (statusFilter === 'BELUM_ABSEN') return status === 'BELUM_ABSEN';

      return true;
    });
  }, [teachers, teacherAttendanceMap, searchQuery, statusFilter]);

  const isOffDayCheck = useMemo(() => isDateOffDay(selectedDate), [selectedDate]);

  const getStatusBadge = (status: AttendanceStatus | 'BELUM_ABSEN') => {
    switch (status) {
      case 'HADIR':
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">✅ Hadir Tepat Waktu</span>;
      case 'TERLAMBAT':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-200">⚠️ Terlambat</span>;
      case 'IZIN':
      case 'SAKIT':
      case 'DINAS_LUAR':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full border border-blue-200">📝 {status}</span>;
      case 'BELUM_ABSEN':
      default:
        return isOffDayCheck.isOff ? (
          <span className="px-2.5 py-1 bg-sky-100 text-sky-800 text-xs font-bold rounded-full border border-sky-200">🏖️ Libur Sekolah</span>
        ) : (
          <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-200">⏳ Belum Absen</span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time Summary Metrics Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 font-bold text-[11px] rounded-full">
                📍 Executive & Admin Tracking
              </span>
              <span className="text-xs text-slate-400 font-medium">Real-time Monitoring</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-1">Status Kehadiran Guru & Staf</h2>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold text-slate-600 pl-1">📅 Tanggal:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Attendance Rate & Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700">Persentase Kehadiran Hari Ini</span>
            <span className="font-black text-lg text-emerald-600">{summary.attendancePercentage}%</span>
          </div>
          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${summary.totalTeachers > 0 ? (summary.totalPresent / summary.totalTeachers) * 100 : 0}%` }}
              className="bg-emerald-500 transition-all duration-500"
              title={`Hadir Tepat Waktu: ${summary.totalPresent}`}
            />
            <div
              style={{ width: `${summary.totalTeachers > 0 ? (summary.totalLate / summary.totalTeachers) * 100 : 0}%` }}
              className="bg-amber-400 transition-all duration-500"
              title={`Terlambat: ${summary.totalLate}`}
            />
            <div
              style={{ width: `${summary.totalTeachers > 0 ? ((summary.totalLeave + summary.totalSick + summary.totalOfficialDuty) / summary.totalTeachers) * 100 : 0}%` }}
              className="bg-blue-400 transition-all duration-500"
              title={`Izin / Sakit / Dinas: ${summary.totalLeave + summary.totalSick + summary.totalOfficialDuty}`}
            />
            <div
              style={{ width: `${summary.totalTeachers > 0 ? (summary.totalUnabsented / summary.totalTeachers) * 100 : 0}%` }}
              className="bg-red-400 transition-all duration-500"
              title={`Belum Absen: ${summary.totalUnabsented}`}
            />
          </div>
        </div>

        {/* Quick Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-0.5">
            <span className="text-xl font-black text-slate-800">{summary.totalTeachers}</span>
            <p className="text-[10px] font-bold text-slate-500">Total Guru</p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-center space-y-0.5">
            <span className="text-xl font-black text-emerald-700">{summary.totalPresent}</span>
            <p className="text-[10px] font-bold text-emerald-800">Hadir Tepat</p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100 text-center space-y-0.5">
            <span className="text-xl font-black text-amber-700">{summary.totalLate}</span>
            <p className="text-[10px] font-bold text-amber-800">Terlambat</p>
          </div>
          <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-center space-y-0.5">
            <span className="text-xl font-black text-blue-700">{summary.totalSick + summary.totalLeave + summary.totalOfficialDuty}</span>
            <p className="text-[10px] font-bold text-blue-800">Izin / Sakit</p>
          </div>
          <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-center space-y-0.5 col-span-2 sm:col-span-1">
            <span className="text-xl font-black text-red-700">{summary.totalUnabsented}</span>
            <p className="text-[10px] font-bold text-red-800">Belum Absen</p>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="🔍 Cari nama guru, NPP, atau mata pelajaran..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3.5 pr-4 py-2 bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'ALL', label: `Semua (${teachers.length})` },
              { id: 'HADIR', label: `Hadir (${summary.totalPresent})` },
              { id: 'TERLAMBAT', label: `Terlambat (${summary.totalLate})` },
              { id: 'IZIN_SAKIT', label: `Izin/Sakit (${summary.totalSick + summary.totalLeave + summary.totalOfficialDuty})` },
              { id: 'BELUM_ABSEN', label: `Belum Absen (${summary.totalUnabsented})` },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id as StatusFilter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === filter.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Attendance Records List */}
        <div className="space-y-3 pt-2">
          {filteredTeachers.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs font-bold">
              Tidak ada data guru yang sesuai dengan kriteria pencarian / filter.
            </div>
          ) : (
            filteredTeachers.map((teacher) => {
              const item = teacherAttendanceMap.get(teacher.id);
              const status = item?.status || 'BELUM_ABSEN';
              const record = item?.record;

              return (
                <div
                  key={teacher.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0 overflow-hidden border border-slate-200 shadow-2xs">
                      {teacher.avatar_url ? (
                        <img src={teacher.avatar_url} alt={teacher.full_name} className="w-full h-full object-cover" />
                      ) : (
                        teacher.full_name.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{teacher.full_name}</h4>
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 font-bold rounded">
                          {teacher.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        NPP: {teacher.nip || '-'} • {teacher.position || 'Tenaga Pendidik'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-right">
                      {getStatusBadge(status)}
                      {item?.checkInTime && (
                        <p className="text-[11px] font-mono font-bold text-slate-700 mt-1">
                          Masuk: {item.checkInTime} {item.checkOutTime ? `• Pulang: ${item.checkOutTime}` : ''}
                        </p>
                      )}
                      {(record?.notes || item?.notes) && (
                        <p className="text-[10px] text-amber-800 font-semibold mt-0.5 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 inline-block">
                          💬 {record?.notes || item?.notes}
                        </p>
                      )}
                      {record?.check_in_distance_meters !== undefined && (
                        <p className="text-[10px] text-slate-400 font-medium">
                          📍 Jarak: {record.check_in_distance_meters}m • {record.verification_method || 'QR_GPS'}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Action WhatsApp Reminder for Unabsented */}
                      {status === 'BELUM_ABSEN' && (
                        <FeatureGate flag="ENABLE_WHATSAPP">
                          <a
                            href={`https://wa.me/62${String(teacher.phone_number || '').replace(/^0/, '')}?text=Assalamu'alaikum%20Bapak/Ibu%20${encodeURIComponent(teacher.full_name)},%20mohon%20konfirmasi%20kehadiran%20hari%20ini.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1"
                            title="Kirim Pesan Pengingat Absen via WhatsApp"
                          >
                            <span>💬</span> Remind WA
                          </a>
                        </FeatureGate>
                      )}

                      {/* Manual Correction Shortcut for Admin */}
                      {onOpenCorrectionModal && (
                        <button
                          onClick={() => onOpenCorrectionModal(teacher)}
                          className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold rounded-xl transition-colors"
                          title="Koreksi Manual Absensi Guru Ini"
                        >
                          ✏️ Koreksi
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
