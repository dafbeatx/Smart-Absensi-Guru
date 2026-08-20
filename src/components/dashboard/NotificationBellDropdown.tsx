import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { ProviderFactory } from '../../providers/provider-factory';
import { SoundService } from '../../services/audio.service';
import { NotificationService } from '../../services/notification-permission.service';
import type { AttendanceRecord, LeaveRequest, UserProfile } from '../../types/database.types';
import { isDateOffDay, getTodayDateInJakarta } from '../../utils/time.utils';

export interface DynamicNotificationItem {
  id: string;
  category: 'MY_STATUS' | 'TEACHER_SCAN' | 'LEAVE_REQUEST' | 'SYSTEM_ALERT';
  title: string;
  message: string;
  time: string;
  badgeType: 'ALERT' | 'SUCCESS' | 'INFO' | 'WARNING';
  isRead: boolean;
  actionType?: 'CORRECTION' | 'NAVIGATE_TAB' | 'INFO';
  actionDate?: string;
  actionTeacherId?: string;
}

export interface NotificationBellDropdownProps {
  className?: string;
  onOpenCorrectionModal?: (teacher?: UserProfile, date?: string) => void;
  onNavigateTab?: (tabId: string) => void;
}

export const NotificationBellDropdown: React.FC<NotificationBellDropdownProps> = ({
  className = '',
  onOpenCorrectionModal,
  onNavigateTab,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'MY_STATUS' | 'TEACHER_SCAN' | 'LEAVES'>('ALL');
  const [notifications, setNotifications] = useState<DynamicNotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { user, token } = useAuthStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync readIds directly from NotificationService as Single Source of Truth
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    NotificationService.getReadNotificationIds(user?.id)
  );

  // Keep track of known unread IDs to prevent repeated audio chimes on polling
  const prevUnreadIdsRef = useRef<Set<string>>(new Set());
  const isInitialMountRef = useRef<boolean>(true);

  // Sync readIds whenever storage / read event fires
  const syncReadIdsFromService = useCallback(() => {
    const freshSet = NotificationService.getReadNotificationIds(user?.id);
    setReadIds(freshSet);
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        isRead: freshSet.has(n.id),
      }))
    );
  }, [user?.id]);

  useEffect(() => {
    syncReadIdsFromService();

    window.addEventListener('smart_absensi_notifications_read_updated', syncReadIdsFromService);
    window.addEventListener('storage', syncReadIdsFromService);
    return () => {
      window.removeEventListener('smart_absensi_notifications_read_updated', syncReadIdsFromService);
      window.removeEventListener('storage', syncReadIdsFromService);
    };
  }, [syncReadIdsFromService]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const provider = ProviderFactory.getProvider();
      const authToken = token || 'MOCK_TOKEN';
      const items: DynamicNotificationItem[] = [];
      const currentReadSet = NotificationService.getReadNotificationIds(user.id);
      const todayIso = getTodayDateInJakarta();

      // 1. STATUS ABSEN SAYA (ADMIN / GURU / KEPSEK)
      const myTodayAtt = await provider.getTodayAttendance(user.id, authToken).catch(() => null);
      if (!myTodayAtt) {
        const notifId = `notif_my_status_pending_${user.id}_${todayIso}`;
        items.push({
          id: notifId,
          category: 'MY_STATUS',
          title: '⚠️ Status Presensi Anda Hari Ini',
          message: `Halo ${user.full_name}, Anda BELUM melakukan presensi masuk hari ini. Batas waktu tepat waktu adalah pukul 07:30 WIB.`,
          time: 'Hari ini',
          badgeType: 'ALERT',
          isRead: currentReadSet.has(notifId),
          actionType: 'CORRECTION',
          actionDate: todayIso,
        });
      } else {
        const statusText = myTodayAtt.status === 'TERLAMBAT' ? 'Terlambat' : 'Tepat Waktu';
        const checkInTimeClean = myTodayAtt.check_in_time
          ? myTodayAtt.check_in_time.substring(0, 5) + ' WIB'
          : 'Tercatat';
        const notifId = `notif_my_status_success_${user.id}_${todayIso}`;
        items.push({
          id: notifId,
          category: 'MY_STATUS',
          title: '✅ Status Presensi Anda Hari Ini',
          message: `Presensi Masuk Anda tercatat pada jam ${checkInTimeClean} (${statusText}).`,
          time: checkInTimeClean,
          badgeType: 'SUCCESS',
          isRead: currentReadSet.has(notifId),
        });
      }

      // 2. PRESENSI GURU TERKINI (FOR ADMIN / KEPSEK / OPERATOR)
      if (user.role === 'ADMIN' || user.role === 'OPERATOR' || user.role === 'KEPSEK') {
        const allTeachers: UserProfile[] = await provider.getAllUsers(authToken).catch(() => []);
        const todayAttendanceList: AttendanceRecord[] = await provider
          .getDailyAttendance(todayIso, authToken)
          .catch(() => []);

        // Add recent teacher attendance logs
        todayAttendanceList.slice(0, 8).forEach((att) => {
          const teacher = allTeachers.find((t) => t.id === att.user_id);
          const teacherName = teacher?.full_name || 'Guru Sekolah';
          const timeClean = att.check_in_time
            ? att.check_in_time.substring(0, 5) + ' WIB'
            : 'Hari ini';
          const isLate = att.status === 'TERLAMBAT';
          const cleanTimeKey = (att.check_in_time || 'in').replace(/[^0-9]/g, '');
          const attNotifId = `notif_scan_${att.user_id}_${todayIso}_${cleanTimeKey}`;

          items.push({
            id: attNotifId,
            category: 'TEACHER_SCAN',
            title: isLate ? '📷 Presensi Guru (Terlambat)' : '📷 Presensi Guru Masuk',
            message: `${teacherName} telah melakukan absen masuk jam ${timeClean} [${att.status}].`,
            time: timeClean,
            badgeType: isLate ? 'WARNING' : 'INFO',
            isRead: currentReadSet.has(attNotifId),
          });
        });

        // Add alert if teachers haven't absented yet (Skip on Off-Days / Weekends)
        const sysSettings = await provider.getSettings().catch(() => null);
        const offCheck = isDateOffDay(new Date(), sysSettings);

        const absentedUserIds = new Set(todayAttendanceList.map((a) => a.user_id));
        const activeGuruTeachers = allTeachers.filter(
          (t) => t.is_active !== false && (t.role === 'GURU' || !t.role)
        );
        const unabsentedCount = offCheck.isOff
          ? 0
          : activeGuruTeachers.filter((t) => !absentedUserIds.has(t.id)).length;

        if (!offCheck.isOff && unabsentedCount > 0) {
          const unabsentNotifId = `notif_unabsented_summary_${todayIso}`;
          items.push({
            id: unabsentNotifId,
            category: 'SYSTEM_ALERT',
            title: '🔔 Monitoring Presensi Guru Hari Ini',
            message: `Terdapat ${unabsentedCount} dari ${activeGuruTeachers.length} Guru/Staf yang belum melakukan absensi masuk hari ini.`,
            time: 'Realtime',
            badgeType: 'WARNING',
            isRead: currentReadSet.has(unabsentNotifId),
            actionType: 'NAVIGATE_TAB',
            actionDate: todayIso,
          });
        }

        // 3. LEAVE REQUESTS WAITING APPROVAL
        const pendingLeaves: LeaveRequest[] = await provider
          .getPendingLeaves(authToken)
          .catch(() => []);
        const activePendingLeaves = pendingLeaves.filter(
          (l) => l.approval_status === 'PENDING'
        );

        if (activePendingLeaves.length > 0) {
          const pendingNotifId = `notif_pending_leaves_summary_${todayIso}`;
          items.push({
            id: pendingNotifId,
            category: 'LEAVE_REQUEST',
            title: '📝 Permohonan Cuti / Izin Menunggu',
            message: `Terdapat ${activePendingLeaves.length} permohonan izin/cuti guru yang memerlukan persetujuan.`,
            time: 'Menunggu Review',
            badgeType: 'WARNING',
            isRead: currentReadSet.has(pendingNotifId),
            actionType: 'NAVIGATE_TAB',
            actionDate: todayIso,
          });
        }
      }

      // 4. Real-time Cached Events & System Notifications
      const cachedNotifs = NotificationService.getCachedNotifications(user.id);
      cachedNotifs.forEach((cn) => {
        const cnId =
          cn.id ||
          `cn_${cn.type}_${cn.userId || cn.teacherName || ''}_${(cn.time || '').replace(/[^0-9]/g, '')}_${todayIso}`;

        items.push({
          id: cnId,
          category:
            cn.type === 'EVENT'
              ? 'SYSTEM_ALERT'
              : cn.type === 'LEAVE_REQUEST'
              ? 'LEAVE_REQUEST'
              : cn.type === 'CHECK_IN' || cn.type === 'CHECK_OUT'
              ? 'TEACHER_SCAN'
              : 'MY_STATUS',
          title: cn.title,
          message: cn.body,
          time: cn.time || 'Realtime',
          badgeType:
            cn.type === 'CHECK_IN' || cn.type === 'CHECK_OUT'
              ? 'SUCCESS'
              : cn.type === 'LEAVE_REQUEST'
              ? 'WARNING'
              : 'INFO',
          isRead: Boolean(cn.isRead) || currentReadSet.has(cnId),
          actionType: cn.actionType,
          actionDate: cn.actionDate,
          actionTeacherId: cn.actionTargetId,
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
            time: dbItem.created_at
              ? new Date(dbItem.created_at).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                }) + ' WIB'
              : 'Sistem',
            badgeType: badgeMap[dbItem.type] || 'INFO',
            isRead: Boolean(dbItem.is_read) || currentReadSet.has(dbItem.id),
            actionType: dbItem.action_type,
            actionDate: dbItem.action_date,
            actionTeacherId: dbItem.action_target_id,
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

      // Check for truly new unread items to play chime safely (skip on initial mount)
      const currentUnreadIds = new Set(
        uniqueItems.filter((n) => !n.isRead && !currentReadSet.has(n.id)).map((n) => n.id)
      );

      if (!isInitialMountRef.current) {
        let hasNewUnread = false;
        currentUnreadIds.forEach((id) => {
          if (!prevUnreadIdsRef.current.has(id)) {
            hasNewUnread = true;
          }
        });
        if (hasNewUnread && currentUnreadIds.size > 0) {
          SoundService.playNotificationChime();
        }
      } else {
        isInitialMountRef.current = false;
      }

      prevUnreadIdsRef.current = currentUnreadIds;
    } catch (err) {
      console.warn('Failed to load dynamic notification items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, token]);

  // Setup periodic polling & real-time event listeners
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 20000); // refresh every 20s

    const handleRealtimeUpdate = () => {
      loadNotifications();
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
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('smart_absensi_scanned', handleRealtimeUpdate);
      window.removeEventListener('smart_absensi_records_updated', handleRealtimeUpdate);
      window.removeEventListener('smart_absensi_leave_updated', handleRealtimeUpdate);
      window.removeEventListener('smart_absensi_notification_pushed', handleRealtimeUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead && !readIds.has(n.id)).length;

  const markItemAsRead = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // 1. Immediately update local state
    setReadIds((prev) => new Set([...prev, id]));
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );

    // 2. Persist to service & localStorage
    NotificationService.markIdAsRead(user?.id, id);

    // 3. Persist to backend provider
    const provider = ProviderFactory.getProvider();
    const authToken = token || 'MOCK_TOKEN';
    provider.markNotificationAsRead(id, authToken).catch(() => {});
  }, [user?.id, token]);

  const handleMarkAllAsRead = useCallback(() => {
    const allIds = notifications.map((n) => n.id);

    // 1. Immediately update local state
    setReadIds((prev) => {
      const updated = new Set(prev);
      allIds.forEach((id) => updated.add(id));
      return updated;
    });

    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    // 2. Persist to service & localStorage
    NotificationService.markAllIdsAsRead(user?.id, allIds);

    // 3. Persist to backend provider
    const provider = ProviderFactory.getProvider();
    const authToken = token || 'MOCK_TOKEN';
    allIds.forEach((id) => {
      provider.markNotificationAsRead(id, authToken).catch(() => {});
    });
  }, [notifications, user?.id, token]);

  const handleNotificationClick = (item: DynamicNotificationItem) => {
    markItemAsRead(item.id);

    // Direct redirection based on notification payload
    if (item.actionType === 'CORRECTION' && onOpenCorrectionModal) {
      onOpenCorrectionModal(undefined, item.actionDate);
      setIsOpen(false);
    } else if (item.actionType === 'NAVIGATE_TAB' && onNavigateTab) {
      if (item.category === 'LEAVE_REQUEST') {
        onNavigateTab('LEAVES');
      } else if (
        item.category === 'SYSTEM_ALERT' ||
        item.title.includes('Monitoring') ||
        item.title.includes('Belum Presensi')
      ) {
        onNavigateTab(user?.role === 'KEPSEK' ? 'UNABSENTED' : 'ATTENDANCE_TRACKING');
      }
      setIsOpen(false);
    } else if (
      (item.title.includes('Belum Melakukan') ||
        item.title.includes('Belum Presensi') ||
        item.title.includes('Belum Tercatat') ||
        item.title.includes('Status Presensi Anda')) &&
      onOpenCorrectionModal
    ) {
      onOpenCorrectionModal(undefined, item.actionDate);
      setIsOpen(false);
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
      {/* Bell Button with Active Pulsing Badge */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        className="relative p-2 text-slate-600 hover:text-[#023246] hover:bg-slate-100 rounded-xl transition-all cursor-pointer active:scale-95"
        aria-label="Pusat Notifikasi Presensi"
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Pusat Notifikasi Presensi"
      >
        <span
          className={`text-lg transition-transform inline-block ${
            unreadCount > 0 ? 'animate-bell-ring text-amber-500' : ''
          }`}
        >
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
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-sm tracking-tight">Notifikasi Presensi</h3>
                  {unreadCount > 0 ? (
                    <span className="px-1.5 py-0.2 bg-red-500 text-white text-[9px] font-black rounded-full">
                      {unreadCount} Baru
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 bg-emerald-500 text-white text-[9px] font-black rounded-full">
                      ✓ Semua Dibaca
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-300">Update Aktivitas &amp; Status Presensi Realtime</p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[10px] bg-white/10 hover:bg-white/20 text-emerald-300 font-extrabold px-2.5 py-1 rounded-lg transition-all cursor-pointer border border-emerald-400/40 active:scale-95 shadow-2xs shrink-0"
              >
                ✓ Tandai Dibaca
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="bg-slate-50 border-b border-slate-200 p-2 flex gap-1 overflow-x-auto text-[11px] no-scrollbar">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Semua ({notifications.length})
            </button>
            <button
              onClick={() => setActiveFilter('MY_STATUS')}
              className={`px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer whitespace-nowrap ${
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
                  className={`px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeFilter === 'TEACHER_SCAN'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Presensi Guru
                </button>
                <button
                  onClick={() => setActiveFilter('LEAVES')}
                  className={`px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeFilter === 'LEAVES'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Izin &amp; Alert
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
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3 rounded-2xl transition-all cursor-pointer flex gap-3 text-xs ${
                      isRead
                        ? 'bg-white/80 opacity-75 hover:opacity-100 hover:bg-white border border-transparent'
                        : 'bg-emerald-50/90 hover:bg-emerald-100/70 border-l-4 border-emerald-500 shadow-2xs'
                    }`}
                  >
                    {/* Badge Icon */}
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

                    {/* Content & Action Bar */}
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="font-extrabold text-slate-900 text-xs tracking-tight truncate">
                            {n.title}
                          </h4>
                        </div>
                        <span className="text-[9px] text-slate-400 shrink-0 font-mono">
                          {n.time}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                        {n.message}
                      </p>

                      <div className="pt-1 flex items-center justify-between gap-2">
                        {/* Status Label (Baru vs Dibaca) */}
                        {isRead ? (
                          <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                            <span>✓ Sudah Dibaca</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => markItemAsRead(n.id, e)}
                            className="text-[10px] font-black text-emerald-700 bg-emerald-100/90 hover:bg-emerald-200 px-2 py-0.5 rounded-lg border border-emerald-300 transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1"
                          >
                            <span>✓ Tandai Dibaca</span>
                          </button>
                        )}

                        {/* Optional Action CTA */}
                        {(n.actionType === 'CORRECTION' ||
                          (n.actionType === 'NAVIGATE_TAB' && n.category === 'SYSTEM_ALERT')) && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-[#023246] bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                            <span>
                              {n.actionType === 'CORRECTION' ? '✏️ Koreksi' : '📋 Tinjau'}
                            </span>
                            <span>➔</span>
                          </span>
                        )}
                      </div>
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
