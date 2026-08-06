import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { ProviderFactory } from '../../providers/provider-factory';
import type { AttendanceRecord, LeaveRequest, UserProfile } from '../../types/database.types';

export interface DynamicNotificationItem {
  id: string;
  category: 'MY_STATUS' | 'TEACHER_SCAN' | 'LEAVE_REQUEST' | 'SYSTEM_ALERT';
  title: string;
  message: string;
  time: string;
  badgeType: 'ALERT' | 'SUCCESS' | 'INFO' | 'WARNING';
  isRead: boolean;
}

export interface NotificationBellDropdownProps {
  className?: string;
}

export const NotificationBellDropdown: React.FC<NotificationBellDropdownProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'MY_STATUS' | 'TEACHER_SCAN' | 'LEAVES'>('ALL');
  const [notifications, setNotifications] = useState<DynamicNotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const { user, token } = useAuthStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const loadNotifications = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const provider = ProviderFactory.getProvider();
      const authToken = token || 'MOCK_TOKEN';
      const items: DynamicNotificationItem[] = [];

      const todayIso = new Date().toISOString().substring(0, 10);

      // 1. STATUS ABSEN SAYA (ADMIN / GURU / KEPSEK)
      const myTodayAtt = await provider.getTodayAttendance(user.id, authToken).catch(() => null);
      if (!myTodayAtt) {
        items.push({
          id: 'notif_my_status_pending',
          category: 'MY_STATUS',
          title: '⚠️ Status Presensi Anda Hari Ini',
          message: `Halo ${user.full_name}, Anda BELUM melakukan presensi masuk hari ini. Batas waktu tepat waktu adalah pukul 07:30 WIB.`,
          time: 'Hari ini',
          badgeType: 'ALERT',
          isRead: false,
        });
      } else {
        const statusText = myTodayAtt.status === 'TERLAMBAT' ? 'Terlambat' : 'Tepat Waktu';
        const checkInTimeClean = myTodayAtt.check_in_time ? myTodayAtt.check_in_time.substring(0, 5) + ' WIB' : 'Tercatat';
        items.push({
          id: 'notif_my_status_success',
          category: 'MY_STATUS',
          title: '✅ Status Presensi Anda Hari Ini',
          message: `Presensi Masuk Anda tercatat pada jam ${checkInTimeClean} (${statusText}).`,
          time: checkInTimeClean,
          badgeType: 'SUCCESS',
          isRead: false,
        });
      }

      // 2. PRESENSI GURU TERKINI (FOR ADMIN / KEPSEK / OPERATOR)
      if (user.role === 'ADMIN' || user.role === 'OPERATOR' || user.role === 'KEPSEK') {
        const allTeachers: UserProfile[] = await provider.getAllUsers(authToken).catch(() => []);
        const todayAttendanceList: AttendanceRecord[] = await provider.getDailyAttendance(todayIso, authToken).catch(() => []);

        // Add recent teacher attendance logs
        todayAttendanceList.slice(0, 5).forEach((att) => {
          const teacher = allTeachers.find((t) => t.id === att.user_id);
          const teacherName = teacher?.full_name || 'Guru Sekolah';
          const timeClean = att.check_in_time ? att.check_in_time.substring(0, 5) + ' WIB' : 'Baru Saja';
          const isLate = att.status === 'TERLAMBAT';

          items.push({
            id: `notif_att_${att.id}`,
            category: 'TEACHER_SCAN',
            title: isLate ? '📷 Presensi Guru (Terlambat)' : '📷 Presensi Guru Masuk',
            message: `${teacherName} telah melakukan absen masuk jam ${timeClean} [${att.status}].`,
            time: timeClean,
            badgeType: isLate ? 'WARNING' : 'INFO',
            isRead: false,
          });
        });

        // Add alert if teachers haven't absented yet
        const absentedUserIds = new Set(todayAttendanceList.map((a) => a.user_id));
        const unabsentedCount = allTeachers.filter((t) => t.role === 'GURU' && !absentedUserIds.has(t.id)).length;

        if (unabsentedCount > 0) {
          items.push({
            id: 'notif_unabsented_summary',
            category: 'SYSTEM_ALERT',
            title: '🔔 Monitoring Presensi Guru Hari Ini',
            message: `Terdapat ${unabsentedCount} dari ${allTeachers.length} Guru/Staf yang belum melakukan absensi masuk hari ini.`,
            time: 'Monitoring Realtime',
            badgeType: 'WARNING',
            isRead: false,
          });
        }

        // 3. LEAVE REQUESTS WAITING APPROVAL
        const pendingLeaves: LeaveRequest[] = await provider.getPendingLeaves(authToken).catch(() => []);
        const activePendingLeaves = pendingLeaves.filter((l) => l.approval_status === 'PENDING');

        if (activePendingLeaves.length > 0) {
          items.push({
            id: 'notif_pending_leaves',
            category: 'LEAVE_REQUEST',
            title: '📝 Permohonan Cuti / Izin Menunggu',
            message: `Terdapat ${activePendingLeaves.length} permohonan izin/cuti guru yang memerlukan persetujuan.`,
            time: 'Menunggu Review',
            badgeType: 'WARNING',
            isRead: false,
          });
        }
      }

      setNotifications(items);
    } catch (err) {
      console.warn('Failed to load dynamic notification items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const handleMarkAllAsRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'MY_STATUS') return n.category === 'MY_STATUS';
    if (activeFilter === 'TEACHER_SCAN') return n.category === 'TEACHER_SCAN';
    if (activeFilter === 'LEAVES') return n.category === 'LEAVE_REQUEST' || n.category === 'SYSTEM_ALERT';
    return true;
  });

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        className="relative p-2 text-slate-600 hover:text-[#023246] hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
        aria-label="Pusat Notifikasi Presensi"
        title="Pusat Notifikasi Presensi"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 px-1.5 py-0.2 text-[9px] font-black bg-red-500 text-white rounded-full min-w-4 text-center ring-2 ring-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-fade-in text-slate-800">
          {/* Header */}
          <div className="bg-[#023246] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔔</span>
              <div>
                <h3 className="font-extrabold text-sm tracking-tight">Notifikasi Presensi</h3>
                <p className="text-[10px] text-slate-300">Update Aktivitas & Status Presensi Realtime</p>
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[10px] bg-white/10 hover:bg-white/20 text-emerald-300 font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer border border-emerald-400/30"
              >
                Tandai Dibaca
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="bg-slate-50 border-b border-slate-200 p-2 flex gap-1 overflow-x-auto text-[11px]">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer ${
                activeFilter === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Semua ({notifications.length})
            </button>
            <button
              onClick={() => setActiveFilter('MY_STATUS')}
              className={`px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer ${
                activeFilter === 'MY_STATUS'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Status Saya
            </button>
            {(user?.role === 'ADMIN' || user?.role === 'OPERATOR' || user?.role === 'KEPSEK') && (
              <>
                <button
                  onClick={() => setActiveFilter('TEACHER_SCAN')}
                  className={`px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer ${
                    activeFilter === 'TEACHER_SCAN'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Presensi Guru
                </button>
                <button
                  onClick={() => setActiveFilter('LEAVES')}
                  className={`px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer ${
                    activeFilter === 'LEAVES'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Izin & Alert
                </button>
              </>
            )}
          </div>

          {/* Notification List Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-1 bg-slate-50/30">
            {isLoading && notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 font-medium animate-pulse">
                Memuat notifikasi realtime...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                <span className="text-2xl block">🔕</span>
                <p className="font-bold text-slate-600">Belum Ada Notifikasi</p>
                <p className="text-[11px]">Seluruh update absensi akan tampil di sini.</p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const isRead = readIds.has(n.id);
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      setReadIds((prev) => new Set(prev).add(n.id));
                    }}
                    className={`p-3 rounded-2xl transition-all cursor-pointer flex gap-3 text-xs ${
                      isRead ? 'bg-white opacity-70 hover:opacity-100' : 'bg-emerald-50/50 hover:bg-emerald-50 border-l-4 border-emerald-500'
                    }`}
                  >
                    <div className="shrink-0 pt-0.5">
                      {n.badgeType === 'ALERT' && (
                        <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm shadow-xs">
                          ⚠️
                        </div>
                      )}
                      {n.badgeType === 'SUCCESS' && (
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm shadow-xs">
                          ✓
                        </div>
                      )}
                      {n.badgeType === 'WARNING' && (
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm shadow-xs">
                          🔔
                        </div>
                      )}
                      {n.badgeType === 'INFO' && (
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shadow-xs">
                          📷
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-0.5 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <h4 className="font-extrabold text-slate-900 text-xs tracking-tight truncate">
                          {n.title}
                        </h4>
                        <span className="text-[9px] text-slate-400 shrink-0 font-mono">
                          {n.time}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                        {n.message}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-100 p-2.5 text-center text-[10px] text-slate-500 font-medium border-t border-slate-200">
            Smart Absensi Guru • Realtime Event Monitor
          </div>
        </div>
      )}
    </div>
  );
};
