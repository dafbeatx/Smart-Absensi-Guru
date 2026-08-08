import React, { useMemo } from 'react';
import { AlertTriangle, Clock, Send, CheckCircle2, UserX } from 'lucide-react';
import type { UserProfile, AttendanceRecord } from '../../types/database.types';
import { useToastStore } from '../../store/useToastStore';

export interface EarlyWarningSystemWidgetProps {
  teachers: UserProfile[];
  attendanceRecords: AttendanceRecord[];
  onOpenCorrectionModal?: () => void;
}

export interface EwsAlertTeacher {
  teacher: UserProfile;
  lateCount: number;
  unexcusedCount: number;
  totalAbsences: number;
  riskLevel: 'HIGH' | 'MEDIUM';
  lastLateDate?: string;
}

export const EarlyWarningSystemWidget: React.FC<EarlyWarningSystemWidgetProps> = ({
  teachers,
  attendanceRecords,
  onOpenCorrectionModal,
}) => {
  const { showToast } = useToastStore();

  const flaggedTeachers = useMemo(() => {
    const now = new Date();
    const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
    const currentYearStr = String(now.getFullYear());

    // Filter records for current month
    const monthRecs = attendanceRecords.filter((r) => {
      const parts = r.date.split('-');
      return parts[0] === currentYearStr && parts[1] === currentMonthStr;
    });

    const teacherStatsMap = new Map<
      string,
      { lateCount: number; unexcusedCount: number; lastLateDate?: string }
    >();

    monthRecs.forEach((r) => {
      const existing = teacherStatsMap.get(r.user_id) || { lateCount: 0, unexcusedCount: 0 };
      if (r.status === 'TERLAMBAT' || (r.check_in_time && r.check_in_time > '07:15')) {
        existing.lateCount += 1;
        existing.lastLateDate = r.date;
      } else if (r.status === 'ALFA' || (!r.check_in_time && r.status === 'BELUM_ABSEN')) {
        existing.unexcusedCount += 1;
      }
      teacherStatsMap.set(r.user_id, existing);
    });

    const results: EwsAlertTeacher[] = [];

    teachers.forEach((t) => {
      const stats = teacherStatsMap.get(t.id) || { lateCount: 0, unexcusedCount: 0 };
      const totalAbsences = stats.lateCount + stats.unexcusedCount;

      // Trigger EWS alert if teacher has >=2 latenesses or >=1 unexcused absence
      if (stats.lateCount >= 2 || stats.unexcusedCount >= 1) {
        const riskLevel: 'HIGH' | 'MEDIUM' = stats.lateCount >= 3 || stats.unexcusedCount >= 2 ? 'HIGH' : 'MEDIUM';
        results.push({
          teacher: t,
          lateCount: stats.lateCount,
          unexcusedCount: stats.unexcusedCount,
          totalAbsences,
          riskLevel,
          lastLateDate: stats.lastLateDate,
        });
      }
    });

    // Sort by risk level HIGH first, then by total absences
    return results.sort((a, b) => {
      if (a.riskLevel === 'HIGH' && b.riskLevel !== 'HIGH') return -1;
      if (a.riskLevel !== 'HIGH' && b.riskLevel === 'HIGH') return 1;
      return b.totalAbsences - a.totalAbsences;
    });
  }, [teachers, attendanceRecords]);

  const handleSendWaReminder = (teacher: UserProfile, lateCount: number) => {
    const phone = teacher.phone_number ? teacher.phone_number.replace(/^0/, '62') : '';
    const msg = encodeURIComponent(
      `Assalamu'alaikum wr. wb. Yth. Bp/Ibu ${teacher.full_name}, berikut pengingat kedisiplinan presensi sekolah. Bulan ini terdata ${lateCount}x keterlambatan. Mohon melakukan absensi tepat waktu sebelum 07.15 WIB. Terima kasih.`
    );

    if (phone) {
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
      showToast('success', 'WhatsApp Dibuka', `Mengarahkan pengingat pesan ke ${teacher.full_name}`);
    } else {
      showToast('warning', 'Nomor HP Tidak Tersedia', `Nomor telepon ${teacher.full_name} belum terdaftar di sistem.`);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-5 rounded-3xl border border-amber-200/80 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0 border border-amber-300">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h3 className="font-extrabold text-[#023246] text-xs sm:text-sm flex items-center gap-1.5">
              <span>Early Warning System (EWS) Kedisiplinan</span>
              <span className="px-2 py-0.5 text-[9px] font-black bg-amber-100 text-amber-800 rounded-full border border-amber-300">
                {flaggedTeachers.length} Guru Perlu Perhatian
              </span>
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
              Deteksi otomatis keterlambatan berulang & potensi kendala kehadiran bulan ini
            </p>
          </div>
        </div>

        {onOpenCorrectionModal && (
          <button
            type="button"
            onClick={onOpenCorrectionModal}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-all cursor-pointer flex items-center gap-1 shrink-0"
          >
            <span>✏️ Koreksi Presensi</span>
          </button>
        )}
      </div>

      {/* Alert List or Clean Slate */}
      {flaggedTeachers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {flaggedTeachers.map(({ teacher, lateCount, unexcusedCount, riskLevel, lastLateDate }) => (
            <div
              key={teacher.id}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 ${
                riskLevel === 'HIGH'
                  ? 'bg-rose-50/70 border-rose-200/90'
                  : 'bg-amber-50/70 border-amber-200/90'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 text-white shadow-xs ${
                    riskLevel === 'HIGH' ? 'bg-rose-600' : 'bg-amber-600'
                  }`}
                >
                  {teacher.full_name ? teacher.full_name.charAt(0) : '👤'}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-black text-slate-900 truncate">{teacher.full_name}</p>
                    <span
                      className={`px-1.5 py-0.2 text-[8px] font-black rounded-md ${
                        riskLevel === 'HIGH'
                          ? 'bg-rose-200 text-rose-900 border border-rose-300'
                          : 'bg-amber-200 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {riskLevel === 'HIGH' ? '🚨 Risiko Tinggi' : '⚠️ Perlu Perhatian'}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-600 font-bold mt-0.5 flex items-center gap-2 flex-wrap">
                    {lateCount > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-800">
                        <Clock className="w-3 h-3 text-amber-600 inline" /> {lateCount}x Terlambat
                      </span>
                    )}
                    {unexcusedCount > 0 && (
                      <span className="flex items-center gap-0.5 text-rose-800">
                        <UserX className="w-3 h-3 text-rose-600 inline" /> {unexcusedCount}x Tanpa Keterangan
                      </span>
                    )}
                    {lastLateDate && <span className="text-slate-400 text-[9px]">(Terakhir: {lastLateDate})</span>}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSendWaReminder(teacher, lateCount)}
                title="Kirim Pesan Pengingat WhatsApp"
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
              >
                <Send className="w-3 h-3 text-white" />
                <span className="hidden xs:inline">Ingatkan WA</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 text-center bg-emerald-50/60 rounded-2xl border border-emerald-200/80 text-xs text-emerald-900 font-medium flex items-center justify-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>
            <strong>Semua Guru Disiplin:</strong> Tidak ada indikasi keterlambatan berulang atau kendala presensi bulan ini.
          </span>
        </div>
      )}
    </div>
  );
};
