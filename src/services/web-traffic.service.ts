/**
 * SMART ABSENSI GURU - WEB TRAFFIC & ACTIVITY TRACKING SERVICE
 * Menyimpan, mengolah, dan menganalisis data riwayat situs web yang diakses guru.
 */

import type {
  WebTrafficLog,
  WebsiteTrafficSummary,
  TeacherTrafficSummary,
  TrafficCategory,
  TrafficFilterOptions,
  CategoryDistribution,
  HourlyTrafficPoint,
  TrafficAnalyticsSummary,
} from '../types/traffic.types';

const STORAGE_KEY = 'smart_absensi_web_traffic_logs';

export const TRAFFIC_CATEGORY_METADATA: Record<TrafficCategory, { label: string; color: string; bgBadge: string; borderBadge: string }> = {
  KURIKULUM_PMM: {
    label: 'Kurikulum & PMM',
    color: '#023246',
    bgBadge: 'bg-[#023246]/10 text-[#023246]',
    borderBadge: 'border-[#023246]/30',
  },
  PENILAIAN_RAPOR: {
    label: 'Penilaian & E-Rapor',
    color: '#16A34A',
    bgBadge: 'bg-emerald-50 text-emerald-800',
    borderBadge: 'border-emerald-200',
  },
  MEDIA_KBM: {
    label: 'Media KBM Interaktif',
    color: '#D97706',
    bgBadge: 'bg-amber-50 text-amber-800',
    borderBadge: 'border-amber-200',
  },
  ADMINISTRASI: {
    label: 'Administrasi & Dapodik',
    color: '#287094',
    bgBadge: 'bg-[#287094]/10 text-[#287094]',
    borderBadge: 'border-[#287094]/30',
  },
  REFERENSI: {
    label: 'Referensi & Jurnal',
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
 * Daftar situs web rujukan pendidikan resmi yang dipantau
 */
export const MONITORED_EDUCATIONAL_WEBSITES = [
  {
    name: 'Platform Merdeka Mengajar (PMM)',
    domain: 'guru.kemdikbud.go.id',
    url: 'https://guru.kemdikbud.go.id/',
    category: 'KURIKULUM_PMM' as TrafficCategory,
    description: 'Aplikasi resmi Kemdikbudristek untuk pelatihan mandiri & perangkat ajar',
    icon: '🇮🇩',
  },
  {
    name: 'Koreksi Soal & Input Nilai Siswa',
    domain: 'web-input-nilai-dafbeatxs-projects-0222ca64.vercel.app',
    url: 'https://web-input-nilai-dafbeatxs-projects-0222ca64.vercel.app/',
    category: 'PENILAIAN_RAPOR' as TrafficCategory,
    description: 'Portal koreksi lembar ujian & penginputan rekap nilai kelas',
    icon: '📝',
  },
  {
    name: 'Canva untuk Pendidikan',
    domain: 'canva.com',
    url: 'https://www.canva.com/education/',
    category: 'MEDIA_KBM' as TrafficCategory,
    description: 'Pembuatan slide presentasi interaktif, LKPD, dan infografis ajar',
    icon: '🎨',
  },
  {
    name: 'Google Classroom',
    domain: 'classroom.google.com',
    url: 'https://classroom.google.com/',
    category: 'KURIKULUM_PMM' as TrafficCategory,
    description: 'Pengelolaan kelas daring, penugasan, dan pengumpulan tugas siswa',
    icon: '📚',
  },
  {
    name: 'Dapodik Kemdikbudristek',
    domain: 'dapodik.kemdikbud.go.id',
    url: 'https://dapodik.kemdikbud.go.id/',
    category: 'ADMINISTRASI' as TrafficCategory,
    description: 'Sinkronisasi data pokok pendidikan & beban mengajar guru',
    icon: '🏛️',
  },
  {
    name: 'Quizizz Pembelajaran Interaktif',
    domain: 'quizizz.com',
    url: 'https://quizizz.com/',
    category: 'MEDIA_KBM' as TrafficCategory,
    description: 'Kuis interaktif gamifikasi dan asesmen formatif di kelas',
    icon: '⚡',
  },
  {
    name: 'Rumah Belajar Kemdikbud',
    domain: 'belajar.kemdikbud.go.id',
    url: 'https://belajar.kemdikbud.go.id/',
    category: 'REFERENSI' as TrafficCategory,
    description: 'Laboratorium maya dan bank soal digital Kemdikbud',
    icon: '🏠',
  },
  {
    name: 'YouTube Edukasi & Sains',
    domain: 'youtube.com',
    url: 'https://www.youtube.com/',
    category: 'MEDIA_KBM' as TrafficCategory,
    description: 'Video animasi pembelajaran dan demonstrasi praktikum sains',
    icon: '📺',
  },
  {
    name: 'E-Rapor SMP Terpadu',
    domain: 'erapor-smp.kemdikbud.go.id',
    url: 'https://erapor-smp.kemdikbud.go.id/',
    category: 'PENILAIAN_RAPOR' as TrafficCategory,
    description: 'Sistem pengolahan nilai rapor kurikulum merdeka',
    icon: '📊',
  },
  {
    name: 'Wordwall Edukasi',
    domain: 'wordwall.net',
    url: 'https://wordwall.net/',
    category: 'MEDIA_KBM' as TrafficCategory,
    description: 'Game edukasi kosakata, teka-teki, dan roda putar siswa',
    icon: '🎯',
  },
];

/**
 * Ekstraksi hostname / domain bersih dari URL
 */
export function extractDomain(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split('/')[0] || rawUrl;
  }
}

/**
 * Menentukan kategori otomatis berdasarkan domain/URL
 */
export function inferCategoryFromUrl(url: string, websiteName: string): TrafficCategory {
  const text = `${url} ${websiteName}`.toLowerCase();
  if (text.includes('guru.kemdikbud') || text.includes('pmm') || text.includes('merdeka') || text.includes('classroom.google')) {
    return 'KURIKULUM_PMM';
  }
  if (text.includes('nilai') || text.includes('erapor') || text.includes('rapor') || text.includes('koreksi')) {
    return 'PENILAIAN_RAPOR';
  }
  if (text.includes('canva') || text.includes('quizizz') || text.includes('wordwall') || text.includes('youtube') || text.includes('kahoot')) {
    return 'MEDIA_KBM';
  }
  if (text.includes('dapodik') || text.includes('siplah') || text.includes('simpkb') || text.includes('ptk.datadik')) {
    return 'ADMINISTRASI';
  }
  if (text.includes('belajar.kemdikbud') || text.includes('wikipedia') || text.includes('sciencedirect') || text.includes('perpus')) {
    return 'REFERENSI';
  }
  return 'LAINNYA';
}

/**
 * Seed data awal realistis untuk guru di sekolah
 */
function createInitialSeedLogs(): WebTrafficLog[] {
  const now = new Date();
  const formatTimeAgo = (hoursAgo: number, minutesAgo: number = 0): string => {
    const d = new Date(now.getTime() - (hoursAgo * 60 + minutesAgo) * 60 * 1000);
    return d.toISOString();
  };

  return [
    {
      id: 'traf_seed_01',
      user_id: 'usr_1001',
      user_name: 'Ahmad Hidayat, S.Pd.',
      user_npp: 'NPP. 198503152010011002',
      user_role: 'GURU',
      website_name: 'Platform Merdeka Mengajar (PMM)',
      domain: 'guru.kemdikbud.go.id',
      url: 'https://guru.kemdikbud.go.id/pelatihan-mandiri',
      category: 'KURIKULUM_PMM',
      accessed_at: formatTimeAgo(0, 24),
      device: 'Mobile Android (Infinix Note 8)',
      duration_seconds: 720,
    },
    {
      id: 'traf_seed_02',
      user_id: 'usr_1001',
      user_name: 'Ahmad Hidayat, S.Pd.',
      user_npp: 'NPP. 198503152010011002',
      user_role: 'GURU',
      website_name: 'Koreksi Soal & Input Nilai Siswa',
      domain: 'web-input-nilai-dafbeatxs-projects-0222ca64.vercel.app',
      url: 'https://web-input-nilai-dafbeatxs-projects-0222ca64.vercel.app/',
      category: 'PENILAIAN_RAPOR',
      accessed_at: formatTimeAgo(1, 15),
      device: 'Desktop Windows (Chrome)',
      duration_seconds: 1450,
    },
    {
      id: 'traf_seed_03',
      user_id: 'usr_1002',
      user_name: 'Budi Santoso, M.Pd.',
      user_npp: 'NPP. 198807202014021003',
      user_role: 'GURU',
      website_name: 'Canva untuk Pendidikan',
      domain: 'canva.com',
      url: 'https://www.canva.com/education/',
      category: 'MEDIA_KBM',
      accessed_at: formatTimeAgo(1, 45),
      device: 'Desktop Windows (Chrome)',
      duration_seconds: 2100,
    },
    {
      id: 'traf_seed_04',
      user_id: 'usr_1002',
      user_name: 'Budi Santoso, M.Pd.',
      user_npp: 'NPP. 198807202014021003',
      user_role: 'GURU',
      website_name: 'Platform Merdeka Mengajar (PMM)',
      domain: 'guru.kemdikbud.go.id',
      url: 'https://guru.kemdikbud.go.id/',
      category: 'KURIKULUM_PMM',
      accessed_at: formatTimeAgo(2, 30),
      device: 'Mobile Android',
      duration_seconds: 450,
    },
    {
      id: 'traf_seed_05',
      user_id: 'usr_1001',
      user_name: 'Ahmad Hidayat, S.Pd.',
      user_npp: 'NPP. 198503152010011002',
      user_role: 'GURU',
      website_name: 'Quizizz Pembelajaran Interaktif',
      domain: 'quizizz.com',
      url: 'https://quizizz.com/admin/quiz',
      category: 'MEDIA_KBM',
      accessed_at: formatTimeAgo(3, 10),
      device: 'Mobile Android',
      duration_seconds: 980,
    },
    {
      id: 'traf_seed_06',
      user_id: 'usr_1003',
      user_name: 'Drs. H. M. Yusuf, M.Pd.',
      user_npp: 'NPP. 197501102000031001',
      user_role: 'KEPSEK',
      website_name: 'Dapodik Kemdikbudristek',
      domain: 'dapodik.kemdikbud.go.id',
      url: 'https://dapodik.kemdikbud.go.id/',
      category: 'ADMINISTRASI',
      accessed_at: formatTimeAgo(4, 5),
      device: 'Desktop Windows (Chrome)',
      duration_seconds: 1800,
    },
    {
      id: 'traf_seed_07',
      user_id: 'usr_1002',
      user_name: 'Budi Santoso, M.Pd.',
      user_npp: 'NPP. 198807202014021003',
      user_role: 'GURU',
      website_name: 'YouTube Edukasi & Sains',
      domain: 'youtube.com',
      url: 'https://www.youtube.com/results?search_query=praktikum+fisika+smp',
      category: 'MEDIA_KBM',
      accessed_at: formatTimeAgo(5, 20),
      device: 'Desktop Windows',
      duration_seconds: 820,
    },
    {
      id: 'traf_seed_08',
      user_id: 'usr_1001',
      user_name: 'Ahmad Hidayat, S.Pd.',
      user_npp: 'NPP. 198503152010011002',
      user_role: 'GURU',
      website_name: 'Platform Merdeka Mengajar (PMM)',
      domain: 'guru.kemdikbud.go.id',
      url: 'https://guru.kemdikbud.go.id/bukti-karya',
      category: 'KURIKULUM_PMM',
      accessed_at: formatTimeAgo(6, 0),
      device: 'Mobile Android',
      duration_seconds: 600,
    },
    {
      id: 'traf_seed_09',
      user_id: 'usr_1002',
      user_name: 'Budi Santoso, M.Pd.',
      user_npp: 'NPP. 198807202014021003',
      user_role: 'GURU',
      website_name: 'Google Classroom',
      domain: 'classroom.google.com',
      url: 'https://classroom.google.com/',
      category: 'KURIKULUM_PMM',
      accessed_at: formatTimeAgo(7, 15),
      device: 'Desktop Windows',
      duration_seconds: 1200,
    },
    {
      id: 'traf_seed_10',
      user_id: 'usr_1001',
      user_name: 'Ahmad Hidayat, S.Pd.',
      user_npp: 'NPP. 198503152010011002',
      user_role: 'GURU',
      website_name: 'Koreksi Soal & Input Nilai Siswa',
      domain: 'web-input-nilai-dafbeatxs-projects-0222ca64.vercel.app',
      url: 'https://web-input-nilai-dafbeatxs-projects-0222ca64.vercel.app/',
      category: 'PENILAIAN_RAPOR',
      accessed_at: formatTimeAgo(24, 10), // Kemarin
      device: 'Mobile Android',
      duration_seconds: 900,
    },
    {
      id: 'traf_seed_11',
      user_id: 'usr_1002',
      user_name: 'Budi Santoso, M.Pd.',
      user_npp: 'NPP. 198807202014021003',
      user_role: 'GURU',
      website_name: 'Rumah Belajar Kemdikbud',
      domain: 'belajar.kemdikbud.go.id',
      url: 'https://belajar.kemdikbud.go.id/LaboratoriumMaya',
      category: 'REFERENSI',
      accessed_at: formatTimeAgo(26, 40),
      device: 'Desktop Windows',
      duration_seconds: 1540,
    },
    {
      id: 'traf_seed_12',
      user_id: 'usr_1003',
      user_name: 'Drs. H. M. Yusuf, M.Pd.',
      user_npp: 'NPP. 197501102000031001',
      user_role: 'KEPSEK',
      website_name: 'Platform Merdeka Mengajar (PMM)',
      domain: 'guru.kemdikbud.go.id',
      url: 'https://guru.kemdikbud.go.id/refleksi-kompetensi',
      category: 'KURIKULUM_PMM',
      accessed_at: formatTimeAgo(28, 15),
      device: 'Mobile Android',
      duration_seconds: 880,
    },
  ];
}

let inMemoryLogs: WebTrafficLog[] | null = null;

export class WebTrafficService {
  /**
   * Mengambil semua riwayat log dari localStorage atau seed awal
   */
  public static getAllLogs(): WebTrafficLog[] {
    if (typeof window === 'undefined') {
      if (!inMemoryLogs) {
        inMemoryLogs = createInitialSeedLogs();
      }
      return inMemoryLogs;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seed = createInitialSeedLogs();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        return seed;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      const seed = createInitialSeedLogs();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    } catch (e) {
      console.warn('Failed to parse web traffic logs, falling back to seed:', e);
      return createInitialSeedLogs();
    }
  }

  /**
   * Menyimpan log riwayat ke localStorage dan broadcast event real-time
   */
  public static saveLogs(logs: WebTrafficLog[]): void {
    inMemoryLogs = logs;
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
      window.dispatchEvent(new Event('smart_absensi_traffic_updated'));
    } catch (e) {
      console.error('Failed to save web traffic logs to localStorage:', e);
    }
  }

  /**
   * Mencatat kunjungan situs web baru oleh guru
   */
  public static recordVisit(params: {
    user_id: string;
    user_name: string;
    user_npp?: string | null;
    user_role?: string;
    website_name: string;
    url: string;
    domain?: string;
    category?: TrafficCategory;
    device?: string;
    duration_seconds?: number;
  }): WebTrafficLog {
    const domain = params.domain || extractDomain(params.url);
    const category = params.category || inferCategoryFromUrl(params.url, params.website_name);
    
    // Auto-detect device
    let detectedDevice = params.device;
    if (!detectedDevice && typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      if (/android/i.test(ua)) detectedDevice = 'Mobile Android';
      else if (/iphone|ipad|ipod/i.test(ua)) detectedDevice = 'Mobile iOS';
      else if (/windows/i.test(ua)) detectedDevice = 'Desktop Windows';
      else if (/macintosh/i.test(ua)) detectedDevice = 'Desktop macOS';
      else detectedDevice = 'Web Browser';
    }

    const nppFormatted = params.user_npp
      ? params.user_npp.startsWith('NPP.')
        ? params.user_npp
        : `NPP. ${params.user_npp}`
      : 'NPP. -';

    const newLog: WebTrafficLog = {
      id: 'traf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      user_id: params.user_id,
      user_name: params.user_name,
      user_npp: nppFormatted,
      user_role: params.user_role || 'GURU',
      website_name: params.website_name,
      domain: domain,
      url: params.url,
      category: category,
      accessed_at: new Date().toISOString(),
      device: detectedDevice || 'Web App Client',
      duration_seconds: params.duration_seconds || 180,
    };

    const currentLogs = this.getAllLogs();
    // Prepend new log
    const updated = [newLog, ...currentLogs];
    // Keep max 1000 logs in storage
    if (updated.length > 1000) {
      updated.length = 1000;
    }

    this.saveLogs(updated);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('smart_absensi_traffic_new_entry', { detail: newLog })
      );
    }

    return newLog;
  }

  /**
   * Mengambil log yang sudah difilter sesuai kriteria
   */
  public static getFilteredLogs(filter?: TrafficFilterOptions): WebTrafficLog[] {
    const logs = this.getAllLogs();
    if (!filter) return logs;

    const now = new Date();
    const todayDateStr = now.toISOString().slice(0, 10);

    return logs.filter((log) => {
      // 1. Filter Rentang Waktu
      if (filter.dateRange && filter.dateRange !== 'ALL') {
        const logDate = new Date(log.accessed_at);
        if (filter.dateRange === 'TODAY') {
          if (log.accessed_at.slice(0, 10) !== todayDateStr) return false;
        } else if (filter.dateRange === '7_DAYS') {
          const diffDays = (now.getTime() - logDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7) return false;
        } else if (filter.dateRange === '30_DAYS') {
          const diffDays = (now.getTime() - logDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 30) return false;
        }
      }

      // 2. Filter Guru
      if (filter.teacherId && filter.teacherId !== 'ALL') {
        if (log.user_id !== filter.teacherId) return false;
      }

      // 3. Filter Kategori
      if (filter.category && filter.category !== 'ALL') {
        if (log.category !== filter.category) return false;
      }

      // 4. Filter Pencarian Teks (Nama website, domain, guru, npp)
      if (filter.searchQuery && filter.searchQuery.trim()) {
        const q = filter.searchQuery.toLowerCase().trim();
        const match =
          log.website_name.toLowerCase().includes(q) ||
          log.domain.toLowerCase().includes(q) ||
          log.user_name.toLowerCase().includes(q) ||
          log.user_npp.toLowerCase().includes(q) ||
          log.url.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }

  /**
   * Analisis lengkap: Top Websites Leaderboard, Per-Guru, Kategori, dan Jam Puncak
   */
  public static getAnalytics(filter?: TrafficFilterOptions): TrafficAnalyticsSummary {
    const filteredLogs = this.getFilteredLogs(filter);
    const totalVisits = filteredLogs.length;

    // 1. Agregasi Top Websites
    const domainMap = new Map<
      string,
      {
        domain: string;
        website_name: string;
        category: TrafficCategory;
        count: number;
        teachers: Set<string>;
        userCounts: Map<string, { user_id: string; user_name: string; count: number }>;
        lastAccessed: string;
      }
    >();

    filteredLogs.forEach((log) => {
      const key = log.domain.toLowerCase();
      if (!domainMap.has(key)) {
        domainMap.set(key, {
          domain: log.domain,
          website_name: log.website_name,
          category: log.category,
          count: 0,
          teachers: new Set<string>(),
          userCounts: new Map(),
          lastAccessed: log.accessed_at,
        });
      }
      const entry = domainMap.get(key)!;
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

    const topWebsites: WebsiteTrafficSummary[] = Array.from(domainMap.values())
      .map((entry) => ({
        domain: entry.domain,
        website_name: entry.website_name,
        category: entry.category,
        total_visits: entry.count,
        unique_teachers: entry.teachers.size,
        percentage: totalVisits > 0 ? Math.round((entry.count / totalVisits) * 100) : 0,
        last_accessed_at: entry.lastAccessed,
        top_users: Array.from(entry.userCounts.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 3),
      }))
      .sort((a, b) => b.total_visits - a.total_visits);

    // 2. Agregasi Aktivitas Per Guru
    const teacherMap = new Map<
      string,
      {
        user_id: string;
        user_name: string;
        user_npp: string;
        user_role: string;
        count: number;
        websites: Map<string, number>;
        categories: Map<TrafficCategory, number>;
        lastAccessed: string;
      }
    >();

    filteredLogs.forEach((log) => {
      if (!teacherMap.has(log.user_id)) {
        teacherMap.set(log.user_id, {
          user_id: log.user_id,
          user_name: log.user_name,
          user_npp: log.user_npp,
          user_role: log.user_role,
          count: 0,
          websites: new Map(),
          categories: new Map(),
          lastAccessed: log.accessed_at,
        });
      }
      const t = teacherMap.get(log.user_id)!;
      t.count += 1;
      t.websites.set(log.website_name, (t.websites.get(log.website_name) || 0) + 1);
      t.categories.set(log.category, (t.categories.get(log.category) || 0) + 1);
      if (new Date(log.accessed_at) > new Date(t.lastAccessed)) {
        t.lastAccessed = log.accessed_at;
      }
    });

    const teacherSummaries: TeacherTrafficSummary[] = Array.from(teacherMap.values())
      .map((t) => {
        let topWeb = '-';
        let maxWebCount = 0;
        t.websites.forEach((cnt, web) => {
          if (cnt > maxWebCount) {
            maxWebCount = cnt;
            topWeb = web;
          }
        });

        let topCat: TrafficCategory = 'KURIKULUM_PMM';
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
          top_website: topWeb,
          top_category: topCat,
          last_accessed_at: t.lastAccessed,
        };
      })
      .sort((a, b) => b.total_visits - a.total_visits);

    // 3. Distribusi Kategori
    const categoryCountMap: Record<TrafficCategory, number> = {
      KURIKULUM_PMM: 0,
      PENILAIAN_RAPOR: 0,
      MEDIA_KBM: 0,
      ADMINISTRASI: 0,
      REFERENSI: 0,
      LAINNYA: 0,
    };

    filteredLogs.forEach((log) => {
      categoryCountMap[log.category] = (categoryCountMap[log.category] || 0) + 1;
    });

    const categoryDistribution: CategoryDistribution[] = (
      Object.keys(categoryCountMap) as TrafficCategory[]
    )
      .map((cat) => {
        const cnt = categoryCountMap[cat];
        return {
          category: cat,
          label: TRAFFIC_CATEGORY_METADATA[cat].label,
          count: cnt,
          percentage: totalVisits > 0 ? Math.round((cnt / totalVisits) * 100) : 0,
          color: TRAFFIC_CATEGORY_METADATA[cat].color,
        };
      })
      .sort((a, b) => b.count - a.count);

    // 4. Jam Puncak Akses (07:00 s/d 17:00)
    const hours = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    const hourlyCounts: Record<string, number> = {};
    hours.forEach((h) => (hourlyCounts[h] = 0));

    filteredLogs.forEach((log) => {
      const d = new Date(log.accessed_at);
      const hStr = String(d.getHours()).padStart(2, '0') + ':00';
      if (hourlyCounts[hStr] !== undefined) {
        hourlyCounts[hStr] += 1;
      }
    });

    const hourlyTrend: HourlyTrafficPoint[] = hours.map((h) => ({
      hour: h,
      count: hourlyCounts[h] || 0,
    }));

    const topCategoryObj = categoryDistribution[0]?.count > 0
      ? {
          category: categoryDistribution[0].category,
          label: categoryDistribution[0].label,
          count: categoryDistribution[0].count,
        }
      : null;

    return {
      totalVisits,
      topWebsite: topWebsites[0] || null,
      mostActiveTeacher: teacherSummaries[0] || null,
      topCategory: topCategoryObj,
      categoryDistribution,
      hourlyTrend,
      topWebsites,
      teacherSummaries,
    };
  }

  /**
   * Reset ke data bawaan simulasi (untuk demo/pengujian)
   */
  public static resetToDefaultSeed(): void {
    const seed = createInitialSeedLogs();
    this.saveLogs(seed);
  }

  /**
   * Hapus seluruh data log
   */
  public static clearAllLogs(): void {
    this.saveLogs([]);
  }

  /**
   * Ekspor data riwayat trafik guru ke berkas format CSV / Excel
   */
  public static exportToCSV(logs: WebTrafficLog[]): string {
    const headers = [
      'ID Kunjungan',
      'Waktu Akses (WIB)',
      'Nama Guru',
      'NPP Pegawai',
      'Peran',
      'Nama Website / Portal',
      'Domain',
      'URL Tautan',
      'Kategori',
      'Perangkat',
    ];

    const rows = logs.map((log) => {
      const timeStr = new Date(log.accessed_at).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
      });
      const catLabel = TRAFFIC_CATEGORY_METADATA[log.category]?.label || log.category;

      return [
        log.id,
        `"${timeStr}"`,
        `"${log.user_name.replace(/"/g, '""')}"`,
        `"${log.user_npp}"`,
        `"${log.user_role}"`,
        `"${log.website_name.replace(/"/g, '""')}"`,
        `"${log.domain}"`,
        `"${log.url.replace(/"/g, '""')}"`,
        `"${catLabel}"`,
        `"${log.device}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\r\n');
  }
}
