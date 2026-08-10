import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { ProviderFactory } from '../../providers/provider-factory';
import { SoundService } from '../../services/audio.service';
import { NotificationService } from '../../services/notification-permission.service';
import type { AttendanceRecord, LeaveRequest, UserProfile } from '../../types/database.types';
import { isDateOffDay } from '../../utils/time.utils';

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

  const { user, token } = useAuthStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getStorageKey = (userId?: string) => `smart_absensi_read_notifications_${userId || 'guest'}`;

  // Helper to load read notification IDs from LocalStorage
  const loadReadIdsFromStorage = (userId?: string): Set<string> => {
    if (typeof window === 'undefined' || !userId) return new Set();
    try {
      const saved = localStorage.getItem(getStorageKey(userId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (e) {
      console.warn('Failed to parse read notification IDs from storage:', e);
    }
    return new Set();
  };

  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIdsFromStorage(user?.id));

  // Sync readIds when user changes or on storage/notification events
  useEffect(() => {
    const syncReadIds = () => {
      setReadIds(NotificationService.getReadNotificationIds(user?.id));
    };

    syncReadIds();

    window.addEventListener('smart_absensi_notifications_read_updated', syncReadIds);
    window.addEventListener('storage', syncReadIds);
    return () => {
      window.removeEventListener('smart_absensi_notifications_read_updated', syncReadIds);
      window.removeEventListener('storage', syncReadIds);
    };
  }, [user?.id]);

  const saveReadIds = (newSet: Set<string>) => {
    setReadIds(newSet);
    if (user?.id && typeof window !== 'undefined') {
      try {
        localStorage.setItem(getStorageKey(user.id), JSON.stringify(Array.from(newSet)));
      } catch (e) {
        console.warn('Failed to save read notification IDs to storage:', e);
      }
    }
  };

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
      const readSet = loadReadIdsFromStorage(user.id);
      const todayIso = new Date().toISOString().substring(0, 10);

      // 1. STATUS ABSEN SAYA (ADMIN / GURU / KEPSEK)
      const myTodayAtt = await provider.getTodayAttendance(user.id, authToken).catch(() => null);
      if (!myTodayAtt) {
        const notifId = 'notif_my_status_pending';
        items.push({
          id: notifId,
          category: 'MY_STATUS',
          title: '⚠️ Status Presensi Anda Hari Ini',
          message: `Halo ${user.full_name}, Anda BELUM melakukan presensi masuk hari ini. Batas waktu tepat waktu adalah pukul 07:30 WIB.`,
          time: 'Hari ini',
          badgeType: 'ALERT',
          isRead: readSet.has(notifId),
        });
      } else {
        const statusText = myTodayAtt.status === 'TERLAMBAT' ? 'Terlambat' : 'Tepat Waktu';
        const checkInTimeClean = myTodayAtt.check_in_time ? myTodayAtt.check_in_time.substring(0, 5) + ' WIB' : 'Tercatat';
        const notifId = 'notif_my_status_success';
        items.push({
          id: notifId,
          category: 'MY_STATUS',
          title: '✅ Status Presensi Anda Hari Ini',
          message: `Presensi Masuk Anda tercatat pada jam ${checkInTimeClean} (${statusText}).`,
          time: checkInTimeClean,
          badgeType: 'SUCCESS',
          isRead: readSet.has(notifId),
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
          const attNotifId = `notif_att_${att.id}`;

          items.push({
            id: attNotifId,
            category: 'TEACHER_SCAN',
            title: isLate ? '📷 Presensi Guru (Terlambat)' : '📷 Presensi Guru Masuk',
            message: `${teacherName} telah melakukan absen masuk jam ${timeClean} [${att.status}].`,
            time: timeClean,
            badgeType: isLate ? 'WARNING' : 'INFO',
            isRead: readSet.has(attNotifId),
          });
        });

        // Add alert if teachers haven't absented yet (Skip on Off-Days / Weekends)
        const sysSettings = await provider.getSettings().catch(() => null);
        const offCheck = isDateOffDay(new Date(), sysSettings);

        const absentedUserIds = new Set(todayAttendanceList.map((a) => a.user_id));
        const unabsentedCount = offCheck.isOff
          ? 0
          : allTeachers.filter((t) => t.role === 'GURU' && !absentedUserIds.has(t.id)).length;

        if (!offCheck.isOff && unabsentedCount > 0) {
          const unabsentNotifId = 'notif_unabsented_summary';
          items.push({
            id: unabsentNotifId,
            category: 'SYSTEM_ALERT',
            title: '🔔 Monitoring Presensi Guru Hari Ini',
            message: `Terdapat ${unabsentedCount} dari ${allTeachers.length} Guru/Staf yang belum melakukan absensi masuk hari ini.`,
            time: 'Monitoring Realtime',
            badgeType: 'WARNING',
            isRead: readSet.has(unabsentNotifId),
          });
        }

        // 3. LEAVE REQUESTS WAITING APPROVAL
        const pendingLeaves: LeaveRequest[] = await provider.getPendingLeaves(authToken).catch(() => []);
        const activePendingLeaves = pendingLeaves.filter((l) => l.approval_status === 'PENDING');

        if (activePendingLeaves.length > 0) {
          const pendingNotifId = 'notif_pending_leaves';
          items.push({
            id: pendingNotifId,
            category: 'LEAVE_REQUEST',
            title: '📝 Permohonan Cuti / Izin Menunggu',
            message: `Terdapat ${activePendingLeaves.length} permohonan izin/cuti guru yang memerlukan persetujuan.`,
            time: 'Menunggu Review',
            badgeType: 'WARNING',
            isRead: readSet.has(pendingNotifId),
          });
        }
      }

      // 4. Real-time Cached Events & System Notifications
      const cachedNotifs = NotificationService.getCachedNotifications(user.id);
      cachedNotifs.forEach((cn) => {
        const cnId = cn.id || `cn_${Date.now()}_${Math.random()}`;
        items.push({
          id: cnId,
          category: cn.type === 'EVENT' ? 'SYSTEM_ALERT' : cn.type === 'LEAVE_REQUEST' ? 'LEAVE_REQUEST' : cn.type === 'CHECK_IN' || cn.type === 'CHECK_OUT' ? 'TEACHER_SCAN' : 'MY_STATUS',
          title: cn.title,
          message: cn.body,
          time: cn.time || 'Realtime',
          badgeType: cn.type === 'CHECK_IN' || cn.type === 'CHECK_OUT' ? 'SUCCESS' : cn.type === 'LEAVE_REQUEST' ? 'WARNING' : 'INFO',
          isRead: Boolean(cn.isRead) || readSet.has(cnId),
        });
      });

      // 5. DB System Notifications from Provider
      const dbNotifs = await provider.getNotifications(user.id, authToken).catch(() => []);
      if (Array.isArray(dbNotifs)) {
        dbNotifs.forEach((dbItem) => {
          if (!dbItem || !dbItem.id) return;
          const badgeMap: Record<string, 'ALERT' | 'SUCCESS' | 'INFO' | 'WARNING'> = {
            ALERT: 'ALERT',
            SUCCESS: 'SUCCESS',
            WARNING: 'WARNING',
            INFO: 'INFO',
          };
          items.push({
            id: dbItem.id,
            category: 'SYSTEM_ALERT',
            title: dbItem.title || 'Notifikasi Sistem',
            message: dbItem.message || '',
            time: dbItem.created_at ? new Date(dbItem.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : 'Sistem',
            badgeType: badgeMap[dbItem.type] || 'INFO',
            isRead: Boolean(dbItem.is_read) || readSet.has(dbItem.id),
          });
        });
      }

      // Deduplicate items by ID
      const uniqueItems: DynamicNotificationItem[] = [];
      const seenIds = new Set<string>();

      items.forEach((item) => {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          uniqueItems.push(item);
        }
      });

      setNotifications(uniqueItems);
    } catch (err) {
      console.warn('Failed to load dynamic notification items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Setup periodic polling & real-time event listeners
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000); // refresh every 15s

    const handleRealtimeUpdate = () => {
      loadNotifications();
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (user?.id && e.key === getStorageKey(user.id)) {
        setReadIds(loadReadIdsFromStorage(user.id));
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadNotifications();
      }
    };

    window.addEventListener('smart_absensi_scanned', handleRealtimeUpdate);
    window.addEventListener('smart_absensi_records_updated', handleRealtimeUpdate);
    window.addEventListener('smart_absensi_leave_updated', handleRealtimeUpdate);
    window.addEventListener('smart_absensi_notification_pushed', handleRealtimeUpdate);
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('smart_absensi_scanned', handleRealtimeUpdate);
      window.removeEventListener('smart_absensi_records_updated', handleRealtimeUpdate);
      window.removeEventListener('smart_absensi_leave_updated', handleRealtimeUpdate);
      window.removeEventListener('smart_absensi_notification_pushed', handleRealtimeUpdate);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.isRead && !readIds.has(n.id)).length;
  const prevUnreadCountRef = useRef<number>(0);

  // Play audio chime sound when new unread notification arrives
  useEffect(() => {
    if (unreadCount > prevUnreadCountRef.current && prevUnreadCountRef.current >= 0) {
      SoundService.playNotificationChime();
    }
    prevUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  const handleMarkAllAsRead = () => {
    const updated = new Set(readIds);
    notifications.forEach((n) => updated.add(n.id));
    saveReadIds(updated);

    if (user?.id) {
      NotificationService.markAllIdsAsRead(user.id, notifications.map((n) => n.id));
    } else {
      NotificationService.markAllAsRead();
    }

    const provider = ProviderFactory.getProvider();
    const authToken = token || 'MOCK_TOKEN';
    notifications.forEach((n) => {
      provider.markNotificationAsRead(n.id, authToken).catch(() => {});
    });
  };

  const markItemAsRead = (id: string) => {
    if (!readIds.has(id)) {
      const updated = new Set(readIds);
      updated.add(id);
      saveReadIds(updated);

      if (user?.id) {
        NotificationService.markIdAsRead(user.id, id);
      }

      const provider = ProviderFactory.getProvider();
      const authToken = token || 'MOCK_TOKEN';
      provider.markNotificationAsRead(id, authToken).catch(() => {});
    }
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
        <span className={`text-lg transition-transform ${unreadCount > 0 ? 'animate-bell-ring text-amber-500' : ''}`}>
          🔔
        </span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 px-1.5 py-0.2 text-[9px] font-black bg-red-600 text-white rounded-full min-w-4 text-center ring-2 ring-white shadow-xs shadow-red-500/50 animate-pulse">
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
                const isRead = n.isRead || readIds.has(n.id);
                return (
                  <div
                    key={n.id}
                    onClick={() => markItemAsRead(n.id)}
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
