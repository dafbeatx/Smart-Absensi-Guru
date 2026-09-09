import type {
  AttendanceRecord,
  TeacherPointLog,
  UserProfile,
  TeacherAppreciationScore,
} from '../types/database.types';
import { NotificationService } from './notification-permission.service';
import { logger } from '../utils/logger.utils';

export interface TeacherStreakInfo {
  currentStreak: number;
  longestStreak: number;
  isStreakActiveToday: boolean;
  streakDaysThisWeek: { dayName: string; isCompleted: boolean; dateStr: string }[];
  streakStatusLabel: string;
}

export interface TeacherDailyQuest {
  id: string;
  title: string;
  description: string;
  rewardPoints: number;
  icon: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  completedAt?: string;
  category: 'CHECK_IN' | 'CHECK_OUT' | 'DUTY' | 'STREAK';
}

export interface NightlyMotivationMessage {
  title: string;
  message: string;
  callToAction: string;
  type: 'STREAK_PRESERVATION' | 'RIVAL_CHALLENGE' | 'TIER_UPGRADE' | 'FRESH_START';
  icon: string;
  accentColor: string;
}

export class TeacherChallengeService {
  private static readonly NIGHTLY_NOTIF_KEY = 'smart_absensi_last_nightly_challenge_date';

  /**
   * Menghitung rentetan hari kerja beruntun (Streak 🔥) di mana guru hadir tepat waktu (≤ 07:30 WIB)
   * Mengabaikan hari libur Sabtu dan Minggu.
   */
  public static calculateStreak(
    attendanceHistory: AttendanceRecord[] = [],
    _pointHistory: TeacherPointLog[] = []
  ): TeacherStreakInfo {
    if (!attendanceHistory || attendanceHistory.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        isStreakActiveToday: false,
        streakDaysThisWeek: this.getWeeklyStreakDays([]),
        streakStatusLabel: 'Belum Memulai Streak',
      };
    }

    // Urutkan riwayat dari tanggal terbaru ke terlama
    const sorted = [...attendanceHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Cek apakah hari ini sudah hadir tepat waktu
    const todayRecord = sorted.find((r) => r.date === todayStr);
    const isStreakActiveToday =
      Boolean(todayRecord) &&
      (todayRecord?.status === 'HADIR' || (todayRecord?.status as string) === 'HADIR_TEPAT_WAKTU');

    // Hitung streak beruntun mundur
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    // Filter catatan hari kerja efektif (Senin s/d Jumat) yang sah
    const completedDates = new Set<string>();

    sorted.forEach((record) => {
      const isOntime = record.status === 'HADIR' || (record.status as string) === 'HADIR_TEPAT_WAKTU';
      if (isOntime) {
        completedDates.add(record.date);
        tempStreak += 1;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else if (record.status === 'TERLAMBAT' || record.status === 'ALFA') {
        tempStreak = 0;
      }
    });

    // Hitung current streak dari hari aktif terakhir
    // Cek mundur dari hari ini atau kemarin jika hari ini belum absen
    let checkDate = new Date(now);
    // Jika hari ini belum check-in on-time dan hari ini hari kerja, kita cek mulai kemarin
    if (!isStreakActiveToday) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Telusuri mundur maksimal 30 hari
    let streakCount = 0;
    for (let i = 0; i < 30; i++) {
      const dayOfWeek = checkDate.getDay(); // 0 = Min, 6 = Sab
      const checkStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;

      // Lewati akhir pekan (Sabtu & Minggu)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }

      if (completedDates.has(checkStr)) {
        streakCount += 1;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // Streak terputus
        break;
      }
    }

    currentStreak = streakCount;
    if (currentStreak > longestStreak) longestStreak = currentStreak;

    const streakDaysThisWeek = this.getWeeklyStreakDays(Array.from(completedDates));

    let statusLabel = 'Mulai nyalakan apimu!';
    if (currentStreak >= 10) statusLabel = '🔥 Legenda Disiplin (10+ Hari)!';
    else if (currentStreak >= 5) statusLabel = '🔥 Streak Mingguan Membara!';
    else if (currentStreak >= 3) statusLabel = '🔥 Konsistensi Terjaga (3 Hari)!';
    else if (currentStreak >= 1) statusLabel = '🔥 Api Rekor Menyala!';

    return {
      currentStreak,
      longestStreak,
      isStreakActiveToday,
      streakDaysThisWeek,
      streakStatusLabel: statusLabel,
    };
  }

  /**
   * Menghasilkan daftar hari kerja pekan ini (Senin - Jumat) beserta status checklist
   */
  private static getWeeklyStreakDays(completedDates: string[]): { dayName: string; isCompleted: boolean; dateStr: string }[] {
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Min, 1 = Sen, ..., 5 = Jum
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);

    return days.map((dayName, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const isCompleted = completedDates.includes(dateStr);
      return {
        dayName,
        isCompleted,
        dateStr,
      };
    });
  }

  /**
   * Evaluasi Misi Harian Guru (Daily Quests)
   */
  public static getDailyQuests(
    todayRecord?: AttendanceRecord | null,
    isScheduledPiketToday = false
  ): TeacherDailyQuest[] {
    const isCheckInOnTime =
      Boolean(todayRecord) &&
      (todayRecord?.status === 'HADIR' || (todayRecord?.status as string) === 'HADIR_TEPAT_WAKTU');

    const isCheckInLate = Boolean(todayRecord) && todayRecord?.status === 'TERLAMBAT';

    const hasCheckedIn = isCheckInOnTime || isCheckInLate;
    const hasCheckedOut = Boolean(todayRecord?.check_out_time);

    const quests: TeacherDailyQuest[] = [
      {
        id: 'quest_morning_on_time',
        title: 'Misi Pagi Inspiratif',
        description: 'Scan presensi masuk tepat waktu sebelum pukul 07:30 WIB di sekolah.',
        rewardPoints: 15,
        icon: '🌅',
        status: isCheckInOnTime ? 'COMPLETED' : isCheckInLate ? 'FAILED' : 'PENDING',
        completedAt: todayRecord?.check_in_time || undefined,
        category: 'CHECK_IN',
      },
      {
        id: 'quest_tuntas_bertugas',
        title: 'Misi Tuntas Bertugas',
        description: 'Scan presensi kepulangan saat jam dinas berakhir tanpa terburu-buru.',
        rewardPoints: 10,
        icon: '🚪',
        status: hasCheckedOut ? 'COMPLETED' : hasCheckedIn ? 'PENDING' : 'PENDING',
        completedAt: todayRecord?.check_out_time || undefined,
        category: 'CHECK_OUT',
      },
    ];

    if (isScheduledPiketToday) {
      quests.push({
        id: 'quest_piket_day',
        title: 'Misi Garda Sekolah (Piket)',
        description: 'Membina ketertiban dan menyambut siswa sebagai Guru Piket harian.',
        rewardPoints: 10,
        icon: '🛡️',
        status: hasCheckedIn ? 'COMPLETED' : 'PENDING',
        completedAt: todayRecord?.check_in_time || undefined,
        category: 'DUTY',
      });
    }

    return quests;
  }

  /**
   * Membuat Pesan Motivasi Malam Hari Gaya Duolingo yang hidup, ramah, dan memicu semangat
   */
  public static generateNightlyMotivation(
    user: UserProfile,
    streakInfo: TeacherStreakInfo,
    score: TeacherAppreciationScore,
    userRank = 1,
    rivalName?: string
  ): NightlyMotivationMessage {
    const firstName = user.full_name?.split(' ')[0] || 'Bapak/Ibu Guru';

    // 1. Jika streak sedang tinggi (>= 3 hari)
    if (streakInfo.currentStreak >= 3) {
      return {
        title: `🔥 Api Rekor ${streakInfo.currentStreak} Hari Anda Jangan Padam!`,
        message: `Luar biasa, ${firstName}! Anda telah mempertahankan presensi tepat waktu ${streakInfo.currentStreak} hari kerja beruntun. Besok pagi, hadir sebelum 07:15 WIB untuk mengunci rekor baru!`,
        callToAction: 'Pasang Alarm Pagi ⏰',
        type: 'STREAK_PRESERVATION',
        icon: '🔥',
        accentColor: '#F59E0B',
      };
    }

    // 2. Jika terpaut tipis dari rival di leaderboard (Peringkat 2 atau 3)
    if (userRank > 1 && userRank <= 5 && rivalName) {
      return {
        title: `⚡ Posisi #${userRank} Disiplin! Rebut Puncak Klasemen!`,
        message: `${firstName}, Anda hanya terpaut sedikit dari ${rivalName}! Selesaikan misi "Pagi Inspiratif" besok pagi untuk menyalip ke posisi teratas.`,
        callToAction: 'Siap Taklukkan Pagi 🚀',
        type: 'RIVAL_CHALLENGE',
        icon: '⚡',
        accentColor: '#3B82F6',
      };
    }

    // 3. Jika dekat dengan ambang naik level (Emas / Teladan Utama)
    if (score.totalPoints < 65 && score.totalPoints >= 50) {
      const remaining = 65 - score.totalPoints;
      return {
        title: `🥇 Hanya ${remaining} Poin Lagi Menuju Level Emas!`,
        message: `${firstName}, satu langkah lagi Anda resmi meraih Lencana Pendidik Disiplin Emas. Amankan presensi On-Time + Pulang Tuntas esok hari!`,
        callToAction: 'Lihat Progress Poin ⭐',
        type: 'TIER_UPGRADE',
        icon: '🏆',
        accentColor: '#10B981',
      };
    }

    // 4. Default: Semangat awal / Fresh Start
    return {
      title: `🌙 Selamat Beristirahat, ${firstName}!`,
      message: `Tantangan hari esok menanti! Mulai hari dengan presensi tepat waktu untuk mengumpulkan +25 Poin perdana pekan ini.`,
      callToAction: 'Mulai Tantangan Besok 🌅',
      type: 'FRESH_START',
      icon: '✨',
      accentColor: '#18536B',
    };
  }

  /**
   * Menjalankan evaluasi notifikasi malam gaya Duolingo (antara pukul 19:00 s/d 22:00 WIB)
   * Menjamin idempotent (hanya muncul 1x dalam 1 malam).
   */
  public static evaluateNightlyChallengeNotification(
    user: UserProfile | null,
    streakInfo: TeacherStreakInfo,
    score: TeacherAppreciationScore,
    userRank = 1,
    rivalName?: string
  ): void {
    if (!user || typeof window === 'undefined') return;

    const now = new Date();
    const hours = now.getHours();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Cek apakah sudah malam (antara jam 18:30 s/d 22:30 WIB)
    // Untuk testing fleksibel, jika pengguna membuka aplikasi di rentang waktu malam
    const isEveningOrNight = hours >= 18 && hours <= 23;
    if (!isEveningOrNight) return;

    // Cek apakah sudah pernah ditembakkan malam ini
    const lastNotifDate = localStorage.getItem(`${this.NIGHTLY_NOTIF_KEY}_${user.id}`);
    if (lastNotifDate === todayStr) {
      return; // Sudah pernah dikirim malam ini
    }

    const motivation = this.generateNightlyMotivation(user, streakInfo, score, userRank, rivalName);

    // Kirim notifikasi via NotificationService
    try {
      NotificationService.sendNativeNotification({
        title: motivation.title,
        body: motivation.message,
        type: 'EVENT',
        teacherName: user.full_name,
        userId: user.id,
        roleTarget: 'GURU',
        actionUrl: '/?tab=BERANDA&openChallenge=true',
      });

      // Tandai sudah terkirim malam ini
      localStorage.setItem(`${this.NIGHTLY_NOTIF_KEY}_${user.id}`, todayStr);
      logger.info('TeacherChallengeService', `Nightly challenge motivation sent to ${user.full_name}: ${motivation.title}`);
    } catch (err) {
      console.warn('Failed to dispatch nightly challenge notification:', err);
    }
  }
}
