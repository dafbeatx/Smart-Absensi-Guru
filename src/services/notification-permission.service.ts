/**
 * Smart Absensi Guru - Browser Web Notification Permission & Push Service
 * Mengelola izin notifikasi browser & pengiriman notifikasi OS desktop/mobile real-time
 */

import { SoundService } from './audio.service';

export interface AttendanceNotificationPayload {
  title: string;
  body: string;
  type: 'CHECK_IN' | 'CHECK_OUT' | 'LEAVE_REQUEST' | 'SYSTEM';
  teacherName?: string;
  time?: string;
}

class NotificationPermissionService {
  constructor() {
    // Service constructor
  }

  /**
   * Cek apakah notifikasi didukung dan telah diizinkan oleh browser
   */
  public isPermissionGranted(): boolean {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    return Notification.permission === 'granted';
  }

  /**
   * Dapatkan status izin notifikasi saat ini ('default' | 'granted' | 'denied')
   */
  public getPermissionStatus(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    return Notification.permission;
  }

  /**
   * Minta Perizinan Notifikasi Browser ke Pengguna (Admin / Kepsek)
   */
  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Browser ini tidak mendukung Web Notification API.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // Kirim konfirmasi notifikasi selamat datang
        this.sendNativeNotification({
          title: '🔔 Notifikasi Real-time Aktif!',
          body: 'Anda akan menerima pemberitahuan langsung saat guru absen masuk, keluar, atau mengajukan izin.',
          type: 'SYSTEM',
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error requesting notification permission:', e);
      return false;
    }
  }

  /**
   * Kirim Notifikasi Native Browser (OS Desktop / HP) + Suara Chime
   */
  public sendNativeNotification(payload: AttendanceNotificationPayload) {
    // 1. Play Audio Sound Effect
    if (payload.type === 'LEAVE_REQUEST') {
      SoundService.play('WARNING');
    } else {
      SoundService.playSuccess();
    }

    // 2. Kirim Native OS Browser Notification jika diizinkan
    if (this.isPermissionGranted()) {
      try {
        const iconPath = '/pwa-192x192.png';
        const notification = new Notification(payload.title, {
          body: payload.body,
          icon: iconPath,
          badge: iconPath,
          tag: `sag-notif-${Date.now()}`,
          requireInteraction: false,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (e) {
        console.warn('Error displaying native notification:', e);
      }
    }

    // 3. Dispatch internal custom event for instant UI bell update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smart_absensi_notification_pushed', { detail: payload }));
    }
  }

  /**
   * Helper: Trigger Notifikasi Guru Absen Masuk
   */
  public notifyTeacherCheckIn(teacherName: string, timeStr: string) {
    this.sendNativeNotification({
      title: `🟢 Guru Absen Masuk: ${teacherName}`,
      body: `Bapak/Ibu ${teacherName} telah melakukan presensi masuk pada pukul ${timeStr}.`,
      type: 'CHECK_IN',
      teacherName,
      time: timeStr,
    });
  }

  /**
   * Helper: Trigger Notifikasi Guru Absen Keluar
   */
  public notifyTeacherCheckOut(teacherName: string, timeStr: string) {
    this.sendNativeNotification({
      title: `🔵 Guru Absen Keluar: ${teacherName}`,
      body: `Bapak/Ibu ${teacherName} telah melakukan presensi keluar pada pukul ${timeStr}.`,
      type: 'CHECK_OUT',
      teacherName,
      time: timeStr,
    });
  }

  /**
   * Helper: Trigger Notifikasi Pengajuan Izin Baru untuk Admin / Kepsek
   */
  public notifyTeacherLeaveRequest(teacherName: string, leaveType: string, reason: string) {
    this.sendNativeNotification({
      title: `📝 Pengajuan Izin Baru: ${teacherName}`,
      body: `${teacherName} mengajukan ${leaveType} (${reason}). Perlu persetujuan Kepala Sekolah/Admin.`,
      type: 'LEAVE_REQUEST',
      teacherName,
    });
  }
}

export const NotificationService = new NotificationPermissionService();
