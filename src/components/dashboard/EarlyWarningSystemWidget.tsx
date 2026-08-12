import React, { useMemo, useState, useEffect } from 'react';
import { AlertTriangle, Clock, Send, CheckCircle2, UserX, PenSquare } from 'lucide-react';
import type { UserProfile, AttendanceRecord } from '../../types/database.types';
import { useToastStore } from '../../store/useToastStore';
import { evaluateAttendanceStatus } from '../../utils/time.utils';
import { CONSTANTS } from '../../config/constants';
import { ProviderFactory } from '../../providers/provider-factory';

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
  const [checkinEnd, setCheckinEnd] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKIN_END);

  useEffect(() => {
    const loadSettings = () => {
      ProviderFactory.getProvider()
        .getSettings()
        .then((st) => {
          if (st?.work_checkin_end) setCheckinEnd(st.work_checkin_end.slice(0, 5));
        })
        .catch(() => {});
    };
    loadSettings();
    window.addEventListener('smart_absensi_settings_updated', loadSettings);
    return () => window.removeEventListener('smart_absensi_settings_updated', loadSettings);
  }, []);

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
      const effectiveStatus = evaluateAttendanceStatus(r.check_in_time, checkinEnd, r.status);
      if (effectiveStatus === 'TERLAMBAT') {
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

      // Trigger EWS alert if teacher has >=4 latenesses or >=2 unexcused absences
      if (stats.lateCount >= 4 || stats.unexcusedCount >= 2) {
        const riskLevel: 'HIGH' | 'MEDIUM' = stats.lateCount >= 6 || stats.unexcusedCount >= 3 ? 'HIGH' : 'MEDIUM';
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
  }, [teachers, attendanceRecords, checkinEnd]);

  const handleSendWaReminder = (teacher: UserProfile, lateCount: number) => {
    const phone = teacher.phone_number ? teacher.phone_number.replace(/^0/, '62') : '';
    const msg = encodeURIComponent(
      `Assalamu'alaikum wr. wb. Yth. Bapak/Ibu ${teacher.full_name}, semoga senantiasa diberikan kesehatan & kelancaran. Salam hormat, berikut pengingat pembinaan kedisiplinan presensi sekolah. Bulan ini terdata ${lateCount}x keterlambatan. Mohon berkenan Bapak/Ibu dapat hadir lebih awal sebelum pukul ${checkinEnd} WIB. Terima kasih atas dedikasi & kerja samanya.`
    );

    if (phone) {
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
      showToast('success', 'WhatsApp Dibuka', `Mengarahkan pesan pengingat santun ke ${teacher.full_name}`);
    } else {
      showToast('warning', 'Nomor HP Tidak Tersedia', `Nomor telepon ${teacher.full_name} belum terdaftar di sistem.`);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-amber-200/80 shadow-2xs space-y-4">
      {/* Header Container */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold shrink-0 border border-amber-200 shadow-2xs mt-0.5">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-extrabold text-[#023246] text-xs sm:text-sm tracking-tight leading-snug">
                Early Warning System (EWS) Kedisiplinan
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-900 rounded-full border border-amber-300/80 shrink-0">
                {flaggedTeachers.length} Perlu Pembinaan
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Monitoring keterlambatan berulang (Toleransi wajar s.d 3x/bulan)
            </p>
          </div>
        </div>

        {onOpenCorrectionModal && (
          <button
            type="button"
            onClick={onOpenCorrectionModal}
            className="w-full sm:w-auto px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 font-extrabold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 active:scale-95 min-h-11"
          >
            <PenSquare className="w-3.5 h-3.5 text-slate-600" />
            <span>Koreksi Presensi</span>
          </button>
        )}
      </div>

      {/* Alert List or Clean Slate */}
      {flaggedTeachers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {flaggedTeachers.map(({ teacher, lateCount, unexcusedCount, riskLevel, lastLateDate }) => (
            <div
              key={teacher.id}
              onClick={() => onOpenCorrectionModal && onOpenCorrectionModal()}
              className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 cursor-pointer hover:shadow-md active:scale-[0.99] ${
                riskLevel === 'HIGH'
                  ? 'bg-rose-50/60 border-rose-200/90 hover:border-rose-400'
                  : 'bg-amber-50/60 border-amber-200/90 hover:border-amber-400'
              }`}
              title="Klik untuk membuka Koreksi Presensi Guru ini"
            >
              {/* Teacher Info Row */}
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 text-white shadow-2xs ${
                    riskLevel === 'HIGH' ? 'bg-rose-600' : 'bg-amber-600'
                  }`}
                >
                  {teacher.full_name ? teacher.full_name.charAt(0).toUpperCase() : '👤'}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">{teacher.full_name}</p>
                    <span
                      className={`px-2 py-0.5 text-[9px] font-black rounded-lg ${
                        riskLevel === 'HIGH'
                          ? 'bg-rose-200 text-rose-900 border border-rose-300'
                          : 'bg-amber-200 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {riskLevel === 'HIGH' ? '🚨 Risiko Tinggi' : '⚠️ Perlu Pembinaan'}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-500 font-semibold truncate">
                    {teacher.nip ? `NPP: ${teacher.nip}` : teacher.position || 'Guru Pengajar'}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px] font-bold">
                    {lateCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100/80 text-amber-900 border border-amber-200/80 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-700 inline shrink-0" />
                        <span>{lateCount}x Terlambat</span>
                      </span>
                    )}
                    {unexcusedCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-100/80 text-rose-900 border border-rose-200/80 flex items-center gap-1">
                        <UserX className="w-3 h-3 text-rose-700 inline shrink-0" />
                        <span>{unexcusedCount}x Tanpa Keterangan</span>
                      </span>
                    )}
                    {lastLateDate && (
                      <span className="text-slate-400 text-[10px] font-medium">
                        (Terakhir: {lastLateDate})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Row */}
              <div className="pt-2 border-t border-slate-200/40 flex items-center justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendWaReminder(teacher, lateCount);
                  }}
                  className="w-full sm:w-auto px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-11"
                >
                  <Send className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>Kirim Pengingat Pembinaan WA</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 text-center bg-emerald-50/60 rounded-2xl border border-emerald-200/80 text-xs text-emerald-950 font-semibold flex items-center justify-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>
            <strong>Semua Guru Disiplin:</strong> Tidak ada indikasi keterlambatan berulang atau kendala presensi bulan ini.
          </span>
        </div>
      )}
    </div>
  );
};
