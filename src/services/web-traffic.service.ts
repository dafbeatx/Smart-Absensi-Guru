/**
 * SMART ABSENSI GURU - WEB TRAFFIC & ACTIVITY TRACKING SERVICE
 * Menyimpan, mengolah, dan menganalisis data riwayat situs web yang diakses guru.
 * Data 100% murni bersumber dari akun guru yang terdaftar di sistem (tanpa seed/dummy data).
 */

import type { UserProfile } from '../types/database.types';
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
const WEBSITES_STORAGE_KEY = 'smart_absensi_monitored_websites';

export interface MonitoredWebsite {
  id: string;
  name: string;
  domain: string;
  url: string;
  category: TrafficCategory;
  description: string;
  icon: string;
  addedBy?: string;
  createdAt: string;
}

export const TRAFFIC_CATEGORY_METADATA: Record<
  TrafficCategory,
  { label: string; color: string; bgBadge: string; borderBadge: string }
> = {
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
 * Katalog awal website rujukan pembelajaran yang dapat dikelola dan disesuaikan oleh Admin
 */
export const DEFAULT_MONITORED_WEBSITES: MonitoredWebsite[] = [
  {
    id: 'web_pmm',
    name: 'Platform Merdeka Mengajar (PMM)',
    domain: 'guru.kemdikbud.go.id',
    url: 'https://guru.kemdikbud.go.id/',
    category: 'KURIKULUM_PMM',
    description: 'Aplikasi resmi Kemdikbudristek untuk pelatihan mandiri & perangkat ajar',
    icon: '🇮🇩',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'web_nilai',
    name: 'Koreksi Soal & Input Nilai Siswa',
    domain: 'web-input-nilai-dafbeatxs-projects-0222ca64.vercel.app',
    url: 'https://web-input-nilai-dafbeatxs-projects-0222ca64.vercel.app/',
    category: 'PENILAIAN_RAPOR',
    description: 'Portal koreksi lembar ujian & penginputan rekap nilai kelas',
    icon: '📝',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'web_canva',
    name: 'Canva untuk Pendidikan',
    domain: 'canva.com',
    url: 'https://www.canva.com/education/',
    category: 'MEDIA_KBM',
    description: 'Pembuatan slide presentasi interaktif, LKPD, dan infografis ajar',
    icon: '🎨',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'web_classroom',
    name: 'Google Classroom',
    domain: 'classroom.google.com',
    url: 'https://classroom.google.com/',
    category: 'KURIKULUM_PMM',
    description: 'Pengelolaan kelas daring, penugasan, dan pengumpulan tugas siswa',
    icon: '📚',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'web_dapodik',
    name: 'Dapodik Kemdikbudristek',
    domain: 'dapodik.kemdikbud.go.id',
    url: 'https://dapodik.kemdikbud.go.id/',
    category: 'ADMINISTRASI',
    description: 'Sinkronisasi data pokok pendidikan & beban mengajar guru',
    icon: '🏛️',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'web_quizizz',
    name: 'Quizizz Pembelajaran Interaktif',
    domain: 'quizizz.com',
    url: 'https://quizizz.com/',
    category: 'MEDIA_KBM',
    description: 'Kuis interaktif gamifikasi dan asesmen formatif di kelas',
    icon: '⚡',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'web_belajar',
    name: 'Rumah Belajar Kemdikbud',
    domain: 'belajar.kemdikbud.go.id',
    url: 'https://belajar.kemdikbud.go.id/',
    category: 'REFERENSI',
    description: 'Laboratorium maya dan bank soal digital Kemdikbud',
    icon: '🏠',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'web_youtube',
    name: 'YouTube Edukasi & Sains',
    domain: 'youtube.com',
    url: 'https://www.youtube.com/',
    category: 'MEDIA_KBM',
    description: 'Video animasi pembelajaran dan demonstrasi praktikum sains',
    icon: '📺',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'web_erapor',
    name: 'E-Rapor SMP Terpadu',
    domain: 'erapor-smp.kemdikbud.go.id',
    url: 'https://erapor-smp.kemdikbud.go.id/',
    category: 'PENILAIAN_RAPOR',
    description: 'Sistem pengolahan nilai rapor kurikulum merdeka',
    icon: '📊',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'web_wordwall',
    name: 'Wordwall Edukasi',
    domain: 'wordwall.net',
    url: 'https://wordwall.net/',
    category: 'MEDIA_KBM',
    description: 'Game edukasi kosakata, teka-teki, dan roda putar siswa',
    icon: '🎯',
    createdAt: '2026-01-01T00:00:00.000Z',
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
  if (
    text.includes('guru.kemdikbud') ||
    text.includes('pmm') ||
    text.includes('merdeka') ||
    text.includes('classroom.google')
  ) {
    return 'KURIKULUM_PMM';
  }
  if (
    text.includes('nilai') ||
    text.includes('erapor') ||
    text.includes('rapor') ||
    text.includes('koreksi')
  ) {
    return 'PENILAIAN_RAPOR';
  }
  if (
    text.includes('canva') ||
    text.includes('quizizz') ||
    text.includes('wordwall') ||
    text.includes('youtube') ||
    text.includes('kahoot')
  ) {
    return 'MEDIA_KBM';
  }
  if (
    text.includes('dapodik') ||
    text.includes('siplah') ||
    text.includes('simpkb') ||
    text.includes('ptk.datadik')
  ) {
    return 'ADMINISTRASI';
  }
  if (
    text.includes('belajar.kemdikbud') ||
    text.includes('wikipedia') ||
    text.includes('sciencedirect') ||
    text.includes('perpus')
  ) {
    return 'REFERENSI';
  }
  return 'LAINNYA';
}

let inMemoryLogs: WebTrafficLog[] = [];
let inMemoryWebsites: MonitoredWebsite[] = [...DEFAULT_MONITORED_WEBSITES];

export class WebTrafficService {
  /**
   * Mengambil semua riwayat log asli dari localStorage
   * (Otomatis membersihkan data dummy lawas jika ada)
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
        // Bersihkan data seed dummy lawas bila sebelumnya tersimpan
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
   * Mengambil daftar website yang dipantau (bisa ditambah/diset oleh Admin)
   */
  public static getMonitoredWebsites(): MonitoredWebsite[] {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return inMemoryWebsites;
    }
    try {
      const raw = localStorage.getItem(WEBSITES_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(WEBSITES_STORAGE_KEY, JSON.stringify(DEFAULT_MONITORED_WEBSITES));
        return DEFAULT_MONITORED_WEBSITES;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      return DEFAULT_MONITORED_WEBSITES;
    } catch {
      return DEFAULT_MONITORED_WEBSITES;
    }
  }

  /**
   * Admin menambahkan website/portal baru untuk dipantau
   */
  public static addMonitoredWebsite(website: {
    name: string;
    url: string;
    category?: TrafficCategory;
    description?: string;
    icon?: string;
    addedBy?: string;
  }): MonitoredWebsite {
    const list = this.getMonitoredWebsites();
    const domain = extractDomain(website.url);
    const cat = website.category || inferCategoryFromUrl(website.url, website.name);

    const newSite: MonitoredWebsite = {
      id: 'web_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: website.name.trim(),
      domain: domain,
      url: website.url.trim(),
      category: cat,
      description: website.description?.trim() || `Portal daring ${website.name.trim()}`,
      icon: website.icon || '🌐',
      addedBy: website.addedBy,
      createdAt: new Date().toISOString(),
    };

    const updated = [newSite, ...list];
    inMemoryWebsites = updated;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(WEBSITES_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('smart_absensi_monitored_websites_updated'));
    }
    return newSite;
  }

  /**
   * Admin menghapus website dari daftar pantauan
   */
  public static deleteMonitoredWebsite(id: string): void {
    const list = this.getMonitoredWebsites();
    const updated = list.filter((s) => s.id !== id);
    inMemoryWebsites = updated;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(WEBSITES_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('smart_absensi_monitored_websites_updated'));
    }
  }

  /**
   * Mencatat kunjungan situs web baru oleh guru yang terdaftar
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
    const updated = [newLog, ...currentLogs];
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
   * Analisis lengkap: Top Websites Leaderboard, Per-Guru Asli Terdaftar, Kategori, dan Jam Puncak
   * Menggunakan daftar guru asli terdaftar (targetTeachers) yang diatur oleh Admin.
   */
  public static getAnalytics(
    filter?: TrafficFilterOptions,
    targetTeachers?: UserProfile[]
  ): TrafficAnalyticsSummary {
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

    // 2. Agregasi Aktivitas Per Guru Asli Terdaftar (set by Admin)
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

    // Jika daftar guru terdaftar disediakan oleh Admin, inisialisasi semua guru asli sekolah
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
          websites: new Map(),
          categories: new Map(),
          lastAccessed: '',
        });
      });
    }

    filteredLogs.forEach((log) => {
      // Cari apakah log cocok dengan guru yang ada di teacherMap
      let targetKey = log.user_id;
      if (!teacherMap.has(targetKey)) {
        // Coba cocokan berdasarkan nama atau npp jika user_id berbeda format
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
          websites: new Map(),
          categories: new Map(),
          lastAccessed: log.accessed_at,
        });
      }

      const t = teacherMap.get(targetKey)!;
      t.count += 1;
      t.websites.set(log.website_name, (t.websites.get(log.website_name) || 0) + 1);
      t.categories.set(log.category, (t.categories.get(log.category) || 0) + 1);
      if (!t.lastAccessed || new Date(log.accessed_at) > new Date(t.lastAccessed)) {
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
          top_website: t.count > 0 ? topWeb : 'Belum ada aktivitas',
          top_category: topCat,
          last_accessed_at: t.lastAccessed || '',
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

    const topCategoryObj =
      categoryDistribution[0]?.count > 0
        ? {
            category: categoryDistribution[0].category,
            label: categoryDistribution[0].label,
            count: categoryDistribution[0].count,
          }
        : null;

    const mostActive = teacherSummaries.find((t) => t.total_visits > 0) || null;

    return {
      totalVisits,
      topWebsite: topWebsites[0] || null,
      mostActiveTeacher: mostActive,
      topCategory: topCategoryObj,
      categoryDistribution,
      hourlyTrend,
      topWebsites,
      teacherSummaries,
    };
  }

  /**
   * Hapus seluruh data log riwayat
   */
  public static clearAllLogs(): void {
    inMemoryLogs = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event('smart_absensi_traffic_updated'));
    }
  }

  /**
   * Ekspor data riwayat trafik guru ke format CSV / Excel
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
