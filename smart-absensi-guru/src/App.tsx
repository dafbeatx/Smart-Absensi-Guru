import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ProfileCard } from './components/ProfileCard';
import { AttendanceCard } from './components/AttendanceCard';
import { QuickActions } from './components/QuickActions';
import { BottomNav, ActiveTab } from './components/BottomNav';
import { QRScannerModal } from './components/QRScannerModal';
import { LeaveModal } from './components/LeaveModal';
import { CorrectionModal } from './components/CorrectionModal';
import { TeachingScheduleModal } from './components/TeachingScheduleModal';
import { HistoryTab } from './components/HistoryTab';
import { NotificationsTab } from './components/NotificationsTab';
import { ProfileTab } from './components/ProfileTab';

import {
  INITIAL_TEACHER_PROFILE,
  INITIAL_SCHOOL_GEOFENCE,
  MOCK_NOTIFICATIONS,
  MOCK_TEACHING_SCHEDULE,
  MOCK_ATTENDANCE_HISTORY
} from './data/mockData';

import {
  TeacherProfile,
  AttendanceRecord,
  LeaveRequest,
  CorrectionRequest,
  NotificationItem
} from './types';

import { Smartphone, Monitor } from 'lucide-react';

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [isMobileFrame, setIsMobileFrame] = useState(true);

  // Data States with LocalStorage fallback
  const [profile, setProfile] = useState<TeacherProfile>(() => {
    const saved = localStorage.getItem('smart_absensi_profile');
    return saved ? JSON.parse(saved) : INITIAL_TEACHER_PROFILE;
  });

  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('smart_absensi_history');
    return saved ? JSON.parse(saved) : MOCK_ATTENDANCE_HISTORY;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem('smart_absensi_notifications');
    return saved ? JSON.parse(saved) : MOCK_NOTIFICATIONS;
  });

  // Location Simulation State
  const [isSimulatedOutside, setIsSimulatedOutside] = useState(false);
  const [distanceMeter, setDistanceMeter] = useState(42);

  // Modals
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Live timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('smart_absensi_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('smart_absensi_history', JSON.stringify(historyRecords));
  }, [historyRecords]);

  useEffect(() => {
    localStorage.setItem('smart_absensi_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Today's record (index 0 or match date 2026-08-06)
  const todayRecord = historyRecords.find(r => r.date === '2026-08-06') || {
    id: 'att-today',
    date: '2026-08-06',
    dayName: 'Kamis',
    dateFormatted: '6 Agustus 2026',
    checkIn: null,
    checkOut: null,
    status: 'Belum Presensi',
    locationName: 'Area Kampus SMP Terpadu Al-Ittihadiyah',
    distanceMeter: distanceMeter
  };

  const handleToggleSimulatedLocation = () => {
    const newOutside = !isSimulatedOutside;
    setIsSimulatedOutside(newOutside);
    setDistanceMeter(newOutside ? 285 : Math.floor(Math.random() * 20) + 15);
  };

  const handleRefreshLocation = () => {
    setDistanceMeter(isSimulatedOutside ? 280 + Math.floor(Math.random() * 20) : Math.floor(Math.random() * 15) + 10);
  };

  const handleRecordAttendance = (type: 'checkIn' | 'checkOut', timeStr: string, status: 'Hadir' | 'Terlambat') => {
    const updatedRecords = historyRecords.map((rec) => {
      if (rec.date === '2026-08-06') {
        return {
          ...rec,
          [type]: timeStr,
          status: type === 'checkIn' ? status : rec.status,
          distanceMeter: distanceMeter,
          locationName: `SMP Terpadu Al-Ittihadiyah (Radius ${distanceMeter}m)`
        };
      }
      return rec;
    });

    setHistoryRecords(updatedRecords);

    // Add notification
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: `Presensi ${type === 'checkIn' ? 'Masuk' : 'Pulang'} Recorded`,
      message: `Presensi ${type === 'checkIn' ? 'Masuk' : 'Pulang'} tanggal 6 Ags 2026 jam ${timeStr} berhasil tercatat (${status}).`,
      time: timeStr,
      date: '06 Ags 2026',
      read: false,
      type: 'success'
    };

    setNotifications([newNotif, ...notifications]);
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  const handleToggleNotificationRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: !n.read } : n));
  };

  const handleResetData = () => {
    localStorage.removeItem('smart_absensi_profile');
    localStorage.removeItem('smart_absensi_history');
    localStorage.removeItem('smart_absensi_notifications');
    setProfile(INITIAL_TEACHER_PROFILE);
    setHistoryRecords(MOCK_ATTENDANCE_HISTORY);
    setNotifications(MOCK_NOTIFICATIONS);
    setIsSimulatedOutside(false);
    setDistanceMeter(42);
    alert('Data presensi telah di-reset ke kondisi awal.');
  };

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-800 flex flex-col items-center justify-center p-0 md:p-6 font-sans">
      
      {/* Top Floating Viewport Selector Bar (Desktop Preview) */}
      <div className="hidden md:flex items-center gap-3 mb-4 bg-slate-800/90 text-slate-200 px-4 py-2 rounded-2xl border border-slate-700 shadow-lg text-xs font-semibold">
        <span className="text-slate-400">Mode Tampilan Preview:</span>
        <button
          onClick={() => setIsMobileFrame(true)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl transition-all ${
            isMobileFrame ? 'bg-[#0D7A5F] text-white font-bold' : 'hover:bg-slate-700'
          }`}
        >
          <Smartphone size={14} />
          <span>Infinix Note 8 (380px Mobile View)</span>
        </button>
        <button
          onClick={() => setIsMobileFrame(false)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl transition-all ${
            !isMobileFrame ? 'bg-[#0D7A5F] text-white font-bold' : 'hover:bg-slate-700'
          }`}
        >
          <Monitor size={14} />
          <span>Layar Responsif / Tablet</span>
        </button>
      </div>

      {/* Main Container Container */}
      <main
        className={`bg-slate-50 min-h-screen w-full relative overflow-x-hidden shadow-2xl transition-all ${
          isMobileFrame 
            ? 'max-w-[412px] md:min-h-[850px] md:rounded-[40px] md:border-[8px] md:border-slate-800 md:my-auto' 
            : 'max-w-xl md:rounded-3xl md:my-6 border border-slate-200'
        }`}
      >
        
        {/* PWA Notch Simulator for Mobile Viewport */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-5 bg-slate-900 rounded-b-2xl z-50 pointer-events-none hidden md:block opacity-90"></div>

        {/* Tab Content Switching */}
        {activeTab === 'home' && (
          <div className="pb-28">
            <Header
              unreadCount={unreadNotifCount}
              onOpenNotifications={() => setActiveTab('notif')}
              isSimulatedOutside={isSimulatedOutside}
              onToggleSimulatedLocation={handleToggleSimulatedLocation}
            />

            <ProfileCard
              profile={profile}
              currentTime={currentTime}
              onOpenProfileTab={() => setActiveTab('profile')}
            />

            <AttendanceCard
              todayRecord={todayRecord}
              currentTime={currentTime}
              geofence={INITIAL_SCHOOL_GEOFENCE}
              isInsideRadius={!isSimulatedOutside}
              distanceMeter={distanceMeter}
              onOpenScanner={() => setIsScannerOpen(true)}
              onRefreshLocation={handleRefreshLocation}
            />

            <QuickActions
              onOpenLeaveModal={() => setIsLeaveModalOpen(true)}
              onOpenCorrectionModal={() => setIsCorrectionModalOpen(true)}
              onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
              onOpenHistoryTab={() => setActiveTab('history')}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryTab historyRecords={historyRecords} />
        )}

        {activeTab === 'notif' && (
          <NotificationsTab
            notifications={notifications}
            onMarkAllAsRead={handleMarkAllNotificationsAsRead}
            onClearAll={handleClearNotifications}
            onToggleRead={handleToggleNotificationRead}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            profile={profile}
            geofence={INITIAL_SCHOOL_GEOFENCE}
            isSimulatedOutside={isSimulatedOutside}
            onToggleSimulatedLocation={handleToggleSimulatedLocation}
            onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
            onResetData={handleResetData}
            onUpdateProfile={(updated) => setProfile(updated)}
          />
        )}

        {/* Floating Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenScanner={() => setIsScannerOpen(true)}
          unreadNotifCount={unreadNotifCount}
        />

        {/* Modals */}
        <QRScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          todayRecord={todayRecord}
          isInsideRadius={!isSimulatedOutside}
          distanceMeter={distanceMeter}
          geofence={INITIAL_SCHOOL_GEOFENCE}
          onRecordAttendance={handleRecordAttendance}
        />

        <LeaveModal
          isOpen={isLeaveModalOpen}
          onClose={() => setIsLeaveModalOpen(false)}
          onSubmitLeave={(newLeave) => {
            const newNotif: NotificationItem = {
              id: `notif-leave-${Date.now()}`,
              title: 'Pengajuan Izin Dikirim',
              message: `Pengajuan ${newLeave.type} tanggal ${newLeave.startDate} sedang diverifikasi.`,
              time: 'Baru Saja',
              date: '06 Ags 2026',
              read: false,
              type: 'info'
            };
            setNotifications([newNotif, ...notifications]);
          }}
        />

        <CorrectionModal
          isOpen={isCorrectionModalOpen}
          onClose={() => setIsCorrectionModalOpen(false)}
          onSubmitCorrection={(newCorr) => {
            const newNotif: NotificationItem = {
              id: `notif-corr-${Date.now()}`,
              title: 'Pengajuan Koreksi Dikirim',
              message: `Pengajuan koreksi presensi tanggal ${newCorr.date} sedang diverifikasi piket.`,
              time: 'Baru Saja',
              date: '06 Ags 2026',
              read: false,
              type: 'info'
            };
            setNotifications([newNotif, ...notifications]);
          }}
        />

        <TeachingScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          schedule={MOCK_TEACHING_SCHEDULE}
        />

      </main>
    </div>
  );
}
