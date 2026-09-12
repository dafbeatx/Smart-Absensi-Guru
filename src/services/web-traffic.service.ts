/**
 * SMART ABSENSI GURU - IN-APP FEATURE & MENU USAGE TRAFFIC SERVICE
 * Menyimpan, mengolah, dan menganalisis data riwayat fitur/menu internal yang dibuka guru.
 * Data 100% murni dari interaksi menu di dalam sistem (tanpa melacak situs luar/eksternal).
 */

import type { UserProfile } from '../types/database.types';
import type {
  WebTrafficLog,
  FeatureTrafficSummary,
  TeacherTrafficSummary,
  TrafficCategory,
  TrafficFilterOptions,
  CategoryDistribution,
  HourlyTrafficPoint,
  TrafficAnalyticsSummary,
} from '../types/traffic.types';

const STORAGE_KEY = 'smart_absensi_web_traffic_logs_v3';

export interface InternalAppFeature {
  id: string;
  name: string;
  category: TrafficCategory;
  description: string;
  icon: string;
}

export const TRAFFIC_CATEGORY_METADATA: Record<
  TrafficCategory,
  { label: string; color: string; bgBadge: string; borderBadge: string }
> = {
  AKADEMIK_NILAI: {
    label: 'Akademik & Penilaian',
    color: '#023246',
    bgBadge: 'bg-[#023246]/10 text-[#023246]',
    borderBadge: 'border-[#023246]/30',
  },
  PRESENSI_ABSENSI: {
    label: 'Presensi & Kehadiran',
    color: '#16A34A',
    bgBadge: 'bg-emerald-50 text-emerald-800',
    borderBadge: 'border-emerald-200',
  },
  KESISWAAN_KARAKTER: {
    label: 'Kesiswaan & Karakter',
    color: '#D97706',
    bgBadge: 'bg-amber-50 text-amber-800',
    borderBadge: 'border-amber-200',
  },
  KOMUNIKASI_LAYANAN: {
    label: 'Komunikasi & Layanan',
    color: '#7C3AED',
    bgBadge: 'bg-purple-50 text-purple-800',
    borderBadge: 'border-purple-200',
  },
  LAINNYA: {
    label: 'Lainnya / Umum',
    color: '#64748B',
    bgBadge: 'bg-slate-100 text-slate-700',
    borderBadge: 'border-slate-200',
  },
};

/**
 * 18 Fitur dan Menu Resmi di Dalam Website Smart-Absensi-Guru
 */
export const INTERNAL_APP_FEATURES: InternalAppFeature[] = [
  // 1. AKADEMIK & PENILAIAN
  {
    id: 'koreksi_soal',
    name: 'Koreksi Soal & Input Nilai',
    category: 'AKADEMIK_NILAI',
    description: 'Aplikasi koreksi lembar ujian & rekap nilai siswa',
    icon: '📝',
  },
  {
    id: 'materials',
    name: 'Modul & Bahan Ajar KBM',
    category: 'AKADEMIK_NILAI',
    description: 'Bank materi modul pembelajaran & referensi KBM guru',
    icon: '📚',
  },
  {
    id: 'jadwal',
    name: 'Jadwal KBM & Kelas',
    category: 'AKADEMIK_NILAI',
    description: 'Jadwal jam mengajar harian dan ruangan kelas sekolah',
    icon: '📅',
  },
  {
    id: 'kalender',
    name: 'Kalender Agenda & Libur',
    category: 'AKADEMIK_NILAI',
    description: 'Kalender akademik sekolah, agenda ujian, dan hari libur',
    icon: '🗓️',
  },

  // 2. PRESENSI & KEHADIRAN
  {
    id: 'presensi',
    name: 'Presensi Masuk & Pulang',
    category: 'PRESENSI_ABSENSI',
    description: 'Pencatatan presensi masuk dan pulang (QR / Biometrik)',
    icon: '👆',
  },
  {
    id: 'rekap',
    name: 'Rekapitulasi Presensi Bulanan',
    category: 'PRESENSI_ABSENSI',
    description: 'Rekapitulasi riwayat presensi bulanan dan ketepatan waktu',
    icon: '📊',
  },
  {
    id: 'izin_cuti',
    name: 'Pengajuan Izin & Cuti',
    category: 'PRESENSI_ABSENSI',
    description: 'Pengajuan surat permohonan izin, sakit, dan dinas luar',
    icon: '⏱️',
  },
  {
    id: 'koreksi',
    name: 'Pengajuan Koreksi Absen',
    category: 'PRESENSI_ABSENSI',
    description: 'Pengajuan koreksi presensi jika kendala GPS atau lupa absen',
    icon: '✏️',
  },
  {
    id: 'location',
    name: 'Peta Lokasi & Geofence GPS',
    category: 'PRESENSI_ABSENSI',
    description: 'Pantau koordinat GPS gerbang sekolah dan radius presensi',
    icon: '📍',
  },

  // 3. KESISWAAN & KARAKTER
  {
    id: 'student_good',
    name: 'Poin Kebaikan Siswa',
    category: 'KESISWAAN_KARAKTER',
    description: 'Poin apresiasi prestasi & perilaku terpuji siswa (Live Sync)',
    icon: '🌟',
  },
  {
    id: 'student_discipline',
    name: 'Poin Kedisiplinan Siswa',
    category: 'KESISWAAN_KARAKTER',
    description: 'Poin pelanggaran tata tertib & kedisiplinan siswa (Live Sync)',
    icon: '⚠️',
  },
  {
    id: 'direktori_siswa',
    name: 'Direktori Siswa & RFID',
    category: 'KESISWAAN_KARAKTER',
    description: 'Database siswa, kelas, kontak wali, dan kartu RFID',
    icon: '🎓',
  },
  {
    id: 'classroom',
    name: 'Ruang Kelas & Rombel',
    category: 'KESISWAAN_KARAKTER',
    description: 'Daftar rombongan belajar dan ruangan kelas sekolah',
    icon: '🏫',
  },
  {
    id: 'student_kiosk',
    name: 'Kiosk Tap RFID Siswa',
    category: 'KESISWAAN_KARAKTER',
    description: 'Terminal pemindaian tap kartu RFID siswa untuk guru piket',
    icon: '📻',
  },

  // 4. KOMUNIKASI & LAYANAN
  {
    id: 'complaint',
    name: 'Kotak Aspirasi / Suara Guru',
    category: 'KOMUNIKASI_LAYANAN',
    description: 'Sampaikan aspirasi & masukan secara anonim ke Kepala Sekolah',
    icon: '💬',
  },
  {
    id: 'mood',
    name: 'Catatan Mood Harian Guru',
    category: 'KOMUNIKASI_LAYANAN',
    description: 'Catat kesiapan energi dan suasana hati sebelum mengajar',
    icon: '😊',
  },
  {
    id: 'emergency',
    name: 'Panggilan Darurat SOS Kelas',
    category: 'KOMUNIKASI_LAYANAN',
    description: 'Panggilan bantuan darurat kelas instan ke Guru Piket & UKS',
    icon: '🚨',
  },
  {
    id: 'sarpras_inventory',
    name: 'Inventaris Sarpras Sekolah',
    category: 'KOMUNIKASI_LAYANAN',
    description: 'Inventaris sarana & prasarana sekolah untuk petugas Sarpras',
    icon: '📦',
  },
];

export function getFeatureById(featureId: string): InternalAppFeature | undefined {
  return INTERNAL_APP_FEATURES.find((f) => f.id === featureId);
}

export function inferCategoryFromFeatureId(featureId: string): TrafficCategory {
  const found = getFeatureById(featureId);
  if (found) return found.category;
  if (featureId.includes('student') || featureId.includes('class') || featureId.includes('direktori')) {
    return 'KESISWAAN_KARAKTER';
  }
  if (featureId.includes('presensi') || featureId.includes('rekap') || featureId.includes('izin') || featureId.includes('koreksi')) {
    return 'PRESENSI_ABSENSI';
  }
  if (featureId.includes('soal') || featureId.includes('material') || featureId.includes('jadwal') || featureId.includes('kalender')) {
    return 'AKADEMIK_NILAI';
  }
  return 'KOMUNIKASI_LAYANAN';
}

let inMemoryLogs: WebTrafficLog[] = [];

export class WebTrafficService {
  /**
   * Mengambil semua log riwayat penggunaan fitur dari localStorage
   */
  public static getAllLogs(): WebTrafficLog[] {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      inMemoryLogs = inMemoryLogs.filter(
        (log: WebTrafficLog) => log && log.id && !log.id.startsWith('traf_seed_')
      );
      return inMemoryLogs;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const realLogs = parsed.filter(
          (log: WebTrafficLog) => log && log.id && !log.id.startsWith('traf_seed_')
        );
        if (realLogs.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(realLogs));
        }
        return realLogs;
      }
      return [];
    } catch (e) {
      console.warn('Failed to parse web traffic logs:', e);
      return [];
    }
  }

  /**
   * Menyimpan log riwayat ke localStorage dan broadcast event real-time
   */
  public static saveLogs(logs: WebTrafficLog[]): void {
    inMemoryLogs = logs;
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
      window.dispatchEvent(new Event('smart_absensi_traffic_updated'));
    } catch (e) {
      console.error('Failed to save web traffic logs to localStorage:', e);
    }
  }

  /**
   * Mengosongkan seluruh riwayat log pemakaian fitur
   */
  public static clearAllLogs(): void {
    inMemoryLogs = [];
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event('smart_absensi_traffic_updated'));
    }
  }

  /**
   * Mengambil daftar fitur internal yang dipantau
   */
  public static getMonitoredFeatures(): InternalAppFeature[] {
    return INTERNAL_APP_FEATURES;
  }

  // Alias compatibility
  public static getMonitoredWebsites(): any[] {
    return INTERNAL_APP_FEATURES.map((f) => ({
      id: f.id,
      name: f.name,
      domain: `menu:${f.id}`,
      url: `#/${f.id}`,
      category: f.category,
      description: f.description,
      icon: f.icon,
      createdAt: '2026-01-01T00:00:00.000Z',
    }));
  }

  /**
   * Mencatat aktivitas saat guru membuka salah satu menu/fitur di dalam aplikasi web
   */
  public static recordFeatureVisit(params: {
    user_id: string;
    user_name: string;
    user_npp?: string | null;
    user_role?: string;
    feature_id: string;
    feature_name?: string;
    feature_icon?: string;
    category?: TrafficCategory;
    device?: string;
  }): WebTrafficLog {
    const featureMeta = getFeatureById(params.feature_id);
    const resolvedName = params.feature_name || featureMeta?.name || params.feature_id;
    const resolvedCat = params.category || featureMeta?.category || inferCategoryFromFeatureId(params.feature_id);
    const resolvedIcon = params.feature_icon || featureMeta?.icon || '⚡';

    // Deteksi Perangkat
    let deviceLabel = params.device;
    if (!deviceLabel && typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
      const isMac = /Macintosh|Mac OS/i.test(ua);
      const isWindows = /Windows/i.test(ua);

      if (isMobile) {
        deviceLabel = ua.includes('iPhone') ? 'HP Apple (iOS)' : 'HP Android';
      } else if (isWindows) {
        deviceLabel = 'Desktop Windows';
      } else if (isMac) {
        deviceLabel = 'MacBook (macOS)';
      } else {
        deviceLabel = 'Web Browser';
      }
    }

    const log: WebTrafficLog = {
      id: 'traf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      user_id: params.user_id,
      user_name: 'Guru Anonim',
      user_npp: 'NPP. ••••••••',
      user_role: params.user_role || 'GURU',
      feature_id: params.feature_id,
      feature_name: resolvedName,
      feature_icon: resolvedIcon,
      category: resolvedCat,
      accessed_at: new Date().toISOString(),
      device: deviceLabel || 'Web Desktop',
      // Compatibility aliases
      website_name: resolvedName,
      domain: `fitur:${params.feature_id}`,
      url: `#/${params.feature_id}`,
    };

    const currentLogs = this.getAllLogs();
    const updated = [log, ...currentLogs].slice(0, 2000); // Pertahankan maks 2000 log terbaru
    this.saveLogs(updated);

    return log;
  }

  /**
   * Method compatibility untuk memanggil recordFeatureVisit
   */
  public static recordVisit(params: {
    user_id: string;
    user_name: string;
    user_npp?: string | null;
    user_role?: string;
    website_name: string;
    url?: string;
    domain?: string;
    category?: TrafficCategory;
    device?: string;
  }): WebTrafficLog {
    // Cari feature_id yang cocok jika website_name dipassing
    let matchedFeatureId = 'koreksi_soal';
    for (const f of INTERNAL_APP_FEATURES) {
      if (
        params.website_name.toLowerCase().includes(f.name.toLowerCase()) ||
        params.website_name.toLowerCase().includes(f.id)
      ) {
        matchedFeatureId = f.id;
        break;
      }
    }

    return this.recordFeatureVisit({
      user_id: params.user_id,
      user_name: params.user_name,
      user_npp: params.user_npp,
      user_role: params.user_role,
      feature_id: matchedFeatureId,
      feature_name: params.website_name,
      category: params.category,
      device: params.device,
    });
  }

  /**
   * Mengambil log yang difilter
   */
  public static getFilteredLogs(options?: TrafficFilterOptions): WebTrafficLog[] {
    const all = this.getAllLogs();
    if (!options) return all;

    let filtered = [...all];

    // Filter Rentang Waktu
    if (options.dateRange && options.dateRange !== 'ALL') {
      const now = new Date();
      filtered = filtered.filter((log) => {
        const logDate = new Date(log.accessed_at);
        const diffHours = (now.getTime() - logDate.getTime()) / (1000 * 60 * 60);

        if (options.dateRange === 'TODAY') {
          return (
            logDate.getDate() === now.getDate() &&
            logDate.getMonth() === now.getMonth() &&
            logDate.getFullYear() === now.getFullYear()
          );
        }
        if (options.dateRange === '7_DAYS') {
          return diffHours <= 24 * 7;
        }
        if (options.dateRange === '30_DAYS') {
          return diffHours <= 24 * 30;
        }
        return true;
      });
    }

    // Filter Guru
    if (options.teacherId && options.teacherId !== 'ALL') {
      filtered = filtered.filter((log) => log.user_id === options.teacherId);
    }

    // Filter Kategori
    if (options.category && options.category !== 'ALL') {
      filtered = filtered.filter((log) => log.category === options.category);
    }

    // Filter Pencarian (Nama fitur, Guru, NPP)
    if (options.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (log) =>
          log.feature_name.toLowerCase().includes(q) ||
          log.user_name.toLowerCase().includes(q) ||
          (log.user_npp && log.user_npp.toLowerCase().includes(q)) ||
          log.feature_id.toLowerCase().includes(q)
      );
    }

    return filtered;
  }

  /**
   * Menghitung Ringkasan Analitik Penggunaan Fitur Web
   * targetTeachers: Daftar seluruh guru resmi terdaftar yang diatur oleh Admin
   */
  public static getAnalytics(
    filter?: TrafficFilterOptions,
    targetTeachers?: UserProfile[]
  ): TrafficAnalyticsSummary {
    const filteredLogs = this.getFilteredLogs(filter);
    const totalVisits = filteredLogs.length;

    // 1. Agregasi Penggunaan Per Fitur
    const featureMap = new Map<
      string,
      {
        feature_id: string;
        feature_name: string;
        feature_icon: string;
        category: TrafficCategory;
        count: number;
        teachers: Set<string>;
        lastAccessed: string;
        userCounts: Map<string, { user_id: string; user_name: string; count: number }>;
      }
    >();

    filteredLogs.forEach((log) => {
      const fid = log.feature_id || 'lainnya';
      if (!featureMap.has(fid)) {
        featureMap.set(fid, {
          feature_id: fid,
          feature_name: log.feature_name || fid,
          feature_icon: log.feature_icon || '⚡',
          category: log.category,
          count: 0,
          teachers: new Set(),
          lastAccessed: log.accessed_at,
          userCounts: new Map(),
        });
      }

      const entry = featureMap.get(fid)!;
      entry.count += 1;
      entry.teachers.add(log.user_id);
      if (new Date(log.accessed_at) > new Date(entry.lastAccessed)) {
        entry.lastAccessed = log.accessed_at;
      }

      const userEntry = entry.userCounts.get(log.user_id) || {
        user_id: log.user_id,
        user_name: log.user_name,
        count: 0,
      };
      userEntry.count += 1;
      entry.userCounts.set(log.user_id, userEntry);
    });

    const topFeatures: FeatureTrafficSummary[] = Array.from(featureMap.values())
      .map((entry) => ({
        feature_id: entry.feature_id,
        feature_name: entry.feature_name,
        feature_icon: entry.feature_icon,
        category: entry.category,
        total_visits: entry.count,
        unique_teachers: entry.teachers.size,
        percentage: totalVisits > 0 ? Math.round((entry.count / totalVisits) * 100) : 0,
        last_accessed_at: entry.lastAccessed,
        top_users: Array.from(entry.userCounts.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 3),
        // Compatibility
        domain: `fitur:${entry.feature_id}`,
        website_name: entry.feature_name,
      }))
      .sort((a, b) => b.total_visits - a.total_visits);

    // 2. Agregasi Aktivitas Per Guru Asli Terdaftar (set by Admin)
    const teacherMap = new Map<
      string,
      {
        user_id: string;
        user_name: string;
        user_npp: string;
        user_role: string;
        count: number;
        features: Map<string, number>;
        categories: Map<TrafficCategory, number>;
        lastAccessed: string;
      }
    >();

    // Jika daftar guru terdaftar disediakan oleh Admin, inisialisasi semua guru resmi sekolah
    if (targetTeachers && targetTeachers.length > 0) {
      targetTeachers.forEach((t: any) => {
        const name = t.full_name || t.name || 'Guru';
        const rawNpp = t.nip || t.npp;
        const npp = rawNpp ? (String(rawNpp).startsWith('NPP.') ? String(rawNpp) : `NPP. ${rawNpp}`) : 'NPP. -';
        teacherMap.set(t.id, {
          user_id: t.id,
          user_name: name,
          user_npp: npp,
          user_role: t.role || 'GURU',
          count: 0,
          features: new Map(),
          categories: new Map(),
          lastAccessed: '',
        });
      });
    }

    filteredLogs.forEach((log) => {
      let targetKey = log.user_id;
      if (!teacherMap.has(targetKey)) {
        for (const [key, val] of teacherMap.entries()) {
          if (
            val.user_name.toLowerCase() === log.user_name.toLowerCase() ||
            (log.user_npp && log.user_npp !== 'NPP. -' && val.user_npp === log.user_npp)
          ) {
            targetKey = key;
            break;
          }
        }
      }

      if (!teacherMap.has(targetKey)) {
        teacherMap.set(targetKey, {
          user_id: log.user_id,
          user_name: log.user_name,
          user_npp: log.user_npp,
          user_role: log.user_role,
          count: 0,
          features: new Map(),
          categories: new Map(),
          lastAccessed: log.accessed_at,
        });
      }

      const t = teacherMap.get(targetKey)!;
      t.count += 1;
      t.features.set(log.feature_name, (t.features.get(log.feature_name) || 0) + 1);
      t.categories.set(log.category, (t.categories.get(log.category) || 0) + 1);
      if (!t.lastAccessed || new Date(log.accessed_at) > new Date(t.lastAccessed)) {
        t.lastAccessed = log.accessed_at;
      }
    });

    const teacherSummaries: TeacherTrafficSummary[] = Array.from(teacherMap.values())
      .map((t) => {
        let topFeat = '-';
        let maxFeatCount = 0;
        t.features.forEach((cnt, feat) => {
          if (cnt > maxFeatCount) {
            maxFeatCount = cnt;
            topFeat = feat;
          }
        });

        let topCat: TrafficCategory = 'AKADEMIK_NILAI';
        let maxCatCount = 0;
        t.categories.forEach((cnt, cat) => {
          if (cnt > maxCatCount) {
            maxCatCount = cnt;
            topCat = cat;
          }
        });

        return {
          user_id: t.user_id,
          user_name: t.user_name,
          user_npp: t.user_npp,
          user_role: t.user_role,
          total_visits: t.count,
          top_feature: t.count > 0 ? topFeat : 'Belum ada aktivitas',
          top_website: t.count > 0 ? topFeat : 'Belum ada aktivitas',
          top_category: topCat,
          last_accessed_at: t.lastAccessed || '',
        };
      })
      .sort((a, b) => b.total_visits - a.total_visits);

    // 3. Distribusi Kategori
    const categoryCountMap: Record<TrafficCategory, number> = {
      AKADEMIK_NILAI: 0,
      PRESENSI_ABSENSI: 0,
      KESISWAAN_KARAKTER: 0,
      KOMUNIKASI_LAYANAN: 0,
      LAINNYA: 0,
    };

    filteredLogs.forEach((log) => {
      const cat = log.category in categoryCountMap ? log.category : 'LAINNYA';
      categoryCountMap[cat] = (categoryCountMap[cat] || 0) + 1;
    });

    const categoryDistribution: CategoryDistribution[] = (
      Object.keys(categoryCountMap) as TrafficCategory[]
    )
      .filter((k) => k !== 'LAINNYA' || categoryCountMap.LAINNYA > 0)
      .map((cat) => ({
        category: cat,
        label: TRAFFIC_CATEGORY_METADATA[cat]?.label || cat,
        count: categoryCountMap[cat],
        percentage: totalVisits > 0 ? Math.round((categoryCountMap[cat] / totalVisits) * 100) : 0,
        color: TRAFFIC_CATEGORY_METADATA[cat]?.color || '#64748B',
      }))
      .sort((a, b) => b.count - a.count);

    // 4. Tren Akses Per Jam (07.00 - 17.00 WIB)
    const hourlyBuckets: Record<string, number> = {
      '07:00': 0,
      '08:00': 0,
      '09:00': 0,
      '10:00': 0,
      '11:00': 0,
      '12:00': 0,
      '13:00': 0,
      '14:00': 0,
      '15:00': 0,
      '16:00': 0,
      '17:00': 0,
    };

    filteredLogs.forEach((log) => {
      const d = new Date(log.accessed_at);
      const h = d.getHours();
      if (h >= 7 && h <= 17) {
        const slotKey = `${String(h).padStart(2, '0')}:00`;
        if (slotKey in hourlyBuckets) {
          hourlyBuckets[slotKey] += 1;
        }
      }
    });

    const hourlyTrend: HourlyTrafficPoint[] = Object.keys(hourlyBuckets).map((hour) => ({
      hour,
      count: hourlyBuckets[hour],
    }));

    // Partisipasi Pengguna Guru (Agregat Anonim)
    const allUniqueTeachers = new Set<string>();
    filteredLogs.forEach((log) => {
      if (log.user_id) allUniqueTeachers.add(log.user_id);
    });
    const uniqueTeachersCount = allUniqueTeachers.size;
    const totalRegisteredTeachers = targetTeachers?.length || (uniqueTeachersCount > 0 ? uniqueTeachersCount : 0);
    const participationRate = totalRegisteredTeachers > 0
      ? Math.min(100, Math.round((uniqueTeachersCount / totalRegisteredTeachers) * 100))
      : 0;

    // Top Category
    const topCat = categoryDistribution.length > 0 && categoryDistribution[0].count > 0
      ? {
          category: categoryDistribution[0].category,
          label: categoryDistribution[0].label,
          count: categoryDistribution[0].count,
        }
      : null;

    const mostActive = teacherSummaries.length > 0 && teacherSummaries[0].total_visits > 0
      ? teacherSummaries[0]
      : null;

    const topFeat = topFeatures.length > 0 ? topFeatures[0] : null;

    return {
      totalVisits,
      uniqueTeachersCount,
      totalRegisteredTeachers,
      participationRate,
      topFeature: topFeat,
      topWebsite: topFeat,
      mostActiveTeacher: mostActive,
      topCategory: topCat,
      categoryDistribution,
      hourlyTrend,
      topFeatures,
      topWebsites: topFeatures,
      teacherSummaries,
    };
  }

  /**
   * Ekspor Log ke CSV Bersifat 100% Anonim (Hanya Data Trafik & Fitur)
   */
  public static exportToCSV(logs: WebTrafficLog[]): string {
    const headers = [
      'ID Aktivitas',
      'Waktu Akses (WIB)',
      'Peran Pengguna',
      'Fitur / Menu Dibuka',
      'Kategori Fitur',
      'Jenis Perangkat',
    ];

    const rows = logs.map((log) => {
      const dateStr = new Date(log.accessed_at).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      return [
        `"${log.id}"`,
        `"${dateStr}"`,
        `"${log.user_role || 'GURU'}"`,
        `"${log.feature_name.replace(/"/g, '""')}"`,
        `"${TRAFFIC_CATEGORY_METADATA[log.category]?.label || log.category}"`,
        `"${log.device || 'Desktop'}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}
