import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { UserProfile } from '../../../types/database.types';
import type {
  TrafficCategory,
  TrafficFilterOptions,
} from '../../../types/traffic.types';
import {
  WebTrafficService,
  TRAFFIC_CATEGORY_METADATA,
} from '../../../services/web-traffic.service';
import type { MonitoredWebsite } from '../../../services/web-traffic.service';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { useToastStore } from '../../../store/useToastStore';
import {
  Globe,
  ExternalLink,
  Search,
  Download,
  Filter,
  Users,
  Activity,
  Award,
  BookOpen,
  PlusCircle,
  Laptop,
  Smartphone,
  ArrowLeft,
  TrendingUp,
  Clock,
  Trash2,
  Settings,
} from 'lucide-react';

export interface TeacherWebTrafficViewProps {
  teachers: UserProfile[];
  onBackToDashboard?: () => void;
}

export const TeacherWebTrafficView: React.FC<TeacherWebTrafficViewProps> = ({
  teachers,
  onBackToDashboard,
}) => {
  const { showToast } = useToastStore();

  // Filter State
  const [dateRange, setDateRange] = useState<'TODAY' | '7_DAYS' | '30_DAYS' | 'ALL'>('ALL');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<TrafficCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination for logs table
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Monitored Websites State (Admin Configurable)
  const [monitoredWebsites, setMonitoredWebsites] = useState<MonitoredWebsite[]>(() =>
    WebTrafficService.getMonitoredWebsites()
  );
  const [isManageWebsitesModalOpen, setIsManageWebsitesModalOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteCategory, setNewSiteCategory] = useState<TrafficCategory>('KURIKULUM_PMM');
  const [newSiteDesc, setNewSiteDesc] = useState('');

  // Modal State for Simulation
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [simTeacherId, setSimTeacherId] = useState<string>(teachers[0]?.id || '');
  const [simSiteIndex, setSimSiteIndex] = useState<number>(0);
  const [customSiteName, setCustomSiteName] = useState<string>('');
  const [customSiteUrl, setCustomSiteUrl] = useState<string>('');
  const [isClearLogsModalOpen, setIsClearLogsModalOpen] = useState(false);

  // Keep simTeacherId in sync if teachers list changes
  useEffect(() => {
    if (teachers.length > 0 && !teachers.some((t) => t.id === simTeacherId)) {
      setSimTeacherId(teachers[0].id);
    }
  }, [teachers, simTeacherId]);

  // Sync listener
  useEffect(() => {
    const handleUpdate = () => {
      setRefreshKey((prev) => prev + 1);
      setMonitoredWebsites(WebTrafficService.getMonitoredWebsites());
    };

    window.addEventListener('smart_absensi_traffic_updated', handleUpdate);
    window.addEventListener('smart_absensi_traffic_new_entry', handleUpdate);
    window.addEventListener('smart_absensi_monitored_websites_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('smart_absensi_traffic_updated', handleUpdate);
      window.removeEventListener('smart_absensi_traffic_new_entry', handleUpdate);
      window.removeEventListener('smart_absensi_monitored_websites_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const filterOptions: TrafficFilterOptions = useMemo(
    () => ({
      dateRange,
      teacherId: selectedTeacherId,
      category: selectedCategory,
      searchQuery,
    }),
    [dateRange, selectedTeacherId, selectedCategory, searchQuery]
  );

  // Compute Analytics based STRICTLY on real registered teachers set by Admin
  const analytics = useMemo(() => {
    return WebTrafficService.getAnalytics(filterOptions, teachers);
  }, [filterOptions, teachers, refreshKey]);

  const allFilteredLogs = useMemo(() => {
    return WebTrafficService.getFilteredLogs(filterOptions);
  }, [filterOptions, refreshKey]);

  // Paginated Logs
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allFilteredLogs.slice(start, start + pageSize);
  }, [allFilteredLogs, currentPage, pageSize]);

  const totalPages = Math.ceil(allFilteredLogs.length / pageSize) || 1;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, selectedTeacherId, selectedCategory, searchQuery]);

  // Export CSV Handler
  const handleExportCSV = useCallback(() => {
    try {
      const csvContent = WebTrafficService.exportToCSV(allFilteredLogs);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `rekap-trafik-web-guru-${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('success', 'Ekspor Berhasil', 'Berkas CSV riwayat trafik web berhasil diunduh.');
    } catch (e) {
      console.error('Failed to export CSV:', e);
      showToast('error', 'Gagal Ekspor', 'Terjadi kesalahan saat membuat berkas CSV.');
    }
  }, [allFilteredLogs, showToast]);

  // Simulation Visit Trigger (tied strictly to registered teachers)
  const handleSimulateVisit = () => {
    const targetTeacher = teachers.find((t) => t.id === simTeacherId) || teachers[0];
    if (!targetTeacher) {
      showToast('error', 'Guru Tidak Ditemukan', 'Pilih guru yang terdaftar untuk simulasi.');
      return;
    }

    let siteName = '';
    let siteUrl = '';
    let siteCategory: TrafficCategory = 'KURIKULUM_PMM';

    if (simSiteIndex === -1) {
      if (!customSiteName.trim() || !customSiteUrl.trim()) {
        showToast('error', 'Input Tidak Lengkap', 'Masukkan nama dan URL website.');
        return;
      }
      siteName = customSiteName.trim();
      siteUrl = customSiteUrl.trim();
    } else {
      const selected = monitoredWebsites[simSiteIndex] || monitoredWebsites[0];
      siteName = selected.name;
      siteUrl = selected.url;
      siteCategory = selected.category;
    }

    const nppFormatted = targetTeacher.nip ? `NPP. ${targetTeacher.nip}` : 'NPP. -';

    WebTrafficService.recordVisit({
      user_id: targetTeacher.id,
      user_name: targetTeacher.full_name,
      user_npp: nppFormatted,
      user_role: targetTeacher.role || 'GURU',
      website_name: siteName,
      url: siteUrl,
      category: siteCategory,
    });

    setIsSimulateModalOpen(false);
    setCustomSiteName('');
    setCustomSiteUrl('');
    setSimSiteIndex(0);
    showToast(
      'success',
      'Kunjungan Dicatat',
      `${targetTeacher.full_name} (${nppFormatted}) tercatat mengakses ${siteName}.`
    );
  };

  // Add Monitored Website Handler (Admin)
  const handleAddWebsite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim() || !newSiteUrl.trim()) {
      showToast('error', 'Form Tidak Lengkap', 'Nama dan tautan URL wajib diisi.');
      return;
    }

    WebTrafficService.addMonitoredWebsite({
      name: newSiteName.trim(),
      url: newSiteUrl.trim(),
      category: newSiteCategory,
      description: newSiteDesc.trim(),
    });

    setNewSiteName('');
    setNewSiteUrl('');
    setNewSiteDesc('');
    setMonitoredWebsites(WebTrafficService.getMonitoredWebsites());
    showToast('success', 'Website Ditambahkan', 'Situs web sekolah baru berhasil didaftarkan.');
  };

  // Delete Monitored Website Handler
  const handleDeleteWebsite = (id: string, name: string) => {
    WebTrafficService.deleteMonitoredWebsite(id);
    setMonitoredWebsites(WebTrafficService.getMonitoredWebsites());
    showToast('info', 'Website Dihapus', `${name} dihapus dari daftar pantauan.`);
  };

  // Clear all logs
  const handleClearAllLogs = () => {
    WebTrafficService.clearAllLogs();
    setIsClearLogsModalOpen(false);
    showToast('info', 'Riwayat Dikosongkan', 'Seluruh riwayat trafik web berhasil dibersihkan.');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      {/* ── HEADER & LIVE STATUS ────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-[#D4D4CE]/50 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
                title="Kembali ke Dashboard Utama"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="px-3 py-1 rounded-full bg-[#023246]/10 text-[#023246] font-bold text-xs border border-[#023246]/20 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#287094]" />
              <span>Monitoring Aktivitas Web Guru</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[11px] font-bold border border-blue-200">
              <Users className="w-3 h-3" />
              <span>Sumber Data: {teachers.length} Guru Terdaftar (Admin)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Tracking Aktif</span>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#023246] tracking-tight">
            Trafik & Monitoring Website Guru
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
            Data analitik 100% murni merekam aktivitas nyata dari {teachers.length} guru yang terdaftar di sekolah saat membuka portal kurikulum merdeka, koreksi nilai, materi ajar, dan referensi daring.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsManageWebsitesModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#023246] border border-[#D4D4CE] font-bold text-xs sm:text-sm transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Kelola Daftar Website Sekolah yang Dipantau"
          >
            <Settings className="w-4 h-4 text-[#287094]" />
            <span>Kelola Website</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSimulateModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#287094] hover:bg-[#023246] text-white font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Uji Catat Kunjungan</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#023246] border border-[#D4D4CE] font-bold text-xs sm:text-sm transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4 text-[#287094]" />
            <span>Ekspor CSV</span>
          </button>
          {analytics.totalVisits > 0 && (
            <button
              type="button"
              onClick={() => setIsClearLogsModalOpen(true)}
              className="p-2 rounded-xl bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-[#D4D4CE] transition-all cursor-pointer"
              title="Kosongkan Riwayat Log"
              aria-label="Kosongkan Riwayat Log"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── KPI STATISTIC CARDS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Kunjungan */}
        <div className="bg-white p-5 rounded-2xl border border-[#D4D4CE]/50 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Kunjungan Web</span>
            <div className="w-8 h-8 rounded-lg bg-[#287094]/10 text-[#287094] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#023246]">
            {analytics.totalVisits.toLocaleString('id-ID')}
            <span className="text-xs font-normal text-slate-500 ml-1.5">kali diakses</span>
          </p>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {analytics.totalVisits > 0
                ? 'Pencatatan real-time aktif'
                : 'Menunggu aktivitas guru'}
            </span>
          </p>
        </div>

        {/* Card 2: Website Terpopuler #1 */}
        <div className="bg-white p-5 rounded-2xl border border-[#D4D4CE]/50 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Website Paling Sering Dibuka</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <p
            className="text-base sm:text-lg font-black text-[#023246] truncate"
            title={analytics.topWebsite?.website_name || '-'}
          >
            {analytics.topWebsite ? analytics.topWebsite.website_name : 'Belum Ada Kunjungan'}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-mono text-[#287094] truncate max-w-35">
              {analytics.topWebsite?.domain || '-'}
            </span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
              {analytics.topWebsite
                ? `${analytics.topWebsite.total_visits}x (${analytics.topWebsite.percentage}%)`
                : '0x'}
            </span>
          </div>
        </div>

        {/* Card 3: Guru Paling Aktif Belajar Daring */}
        <div className="bg-white p-5 rounded-2xl border border-[#D4D4CE]/50 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Guru Paling Aktif Daring</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p
            className="text-base sm:text-lg font-black text-[#023246] truncate"
            title={analytics.mostActiveTeacher?.user_name || '-'}
          >
            {analytics.mostActiveTeacher ? analytics.mostActiveTeacher.user_name : 'Belum Ada Guru Aktif'}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span className="truncate">
              {analytics.mostActiveTeacher?.user_npp || `${teachers.length} guru terdaftar`}
            </span>
            <span className="font-bold text-[#023246] bg-slate-100 px-1.5 py-0.5 rounded-md">
              {analytics.mostActiveTeacher ? `${analytics.mostActiveTeacher.total_visits}x buka` : '0x'}
            </span>
          </div>
        </div>

        {/* Card 4: Kategori Teratas */}
        <div className="bg-white p-5 rounded-2xl border border-[#D4D4CE]/50 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Kategori Dominan</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg font-black text-[#023246] truncate">
            {analytics.topCategory ? analytics.topCategory.label : 'Belum Ada Kategori'}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Kontribusi aktivitas</span>
            <span className="font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md border border-purple-200">
              {analytics.topCategory ? `${analytics.topCategory.count} kali` : '0 kali'}
            </span>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH CONTROLS ────────────────────────────────────── */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#D4D4CE]/50 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama guru, NPP, nama website, atau domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-[#D4D4CE] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#287094] transition-all text-[#023246]"
            />
          </div>

          {/* Quick Date Range Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setDateRange('TODAY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dateRange === 'TODAY'
                  ? 'bg-[#023246] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#023246]'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setDateRange('7_DAYS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dateRange === '7_DAYS'
                  ? 'bg-[#023246] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#023246]'
              }`}
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => setDateRange('30_DAYS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dateRange === '30_DAYS'
                  ? 'bg-[#023246] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#023246]'
              }`}
            >
              30 Hari
            </button>
            <button
              type="button"
              onClick={() => setDateRange('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dateRange === 'ALL'
                  ? 'bg-[#023246] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#023246]'
              }`}
            >
              Semua
            </button>
          </div>
        </div>

        {/* Dropdowns Filter */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Filter className="w-3.5 h-3.5 text-[#287094]" />
            <span>Filter:</span>
          </div>

          {/* Teacher Select (Strictly real teachers) */}
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-[#D4D4CE] rounded-lg text-[#023246] focus:ring-1 focus:ring-[#287094] cursor-pointer"
          >
            <option value="ALL">Semua Guru ({teachers.length} Guru)</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} ({t.nip ? `NPP. ${t.nip}` : 'NPP. -'})
              </option>
            ))}
          </select>

          {/* Category Select */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-[#D4D4CE] rounded-lg text-[#023246] focus:ring-1 focus:ring-[#287094] cursor-pointer"
          >
            <option value="ALL">Semua Kategori Website</option>
            {Object.keys(TRAFFIC_CATEGORY_METADATA).map((catKey) => (
              <option key={catKey} value={catKey}>
                {TRAFFIC_CATEGORY_METADATA[catKey as TrafficCategory].label}
              </option>
            ))}
          </select>

          {(selectedTeacherId !== 'ALL' || selectedCategory !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedTeacherId('ALL');
                setSelectedCategory('ALL');
                setSearchQuery('');
              }}
              className="text-xs text-red-600 hover:underline font-semibold cursor-pointer ml-auto"
            >
              Hapus Filter
            </button>
          )}
        </div>
      </div>

      {/* ── TOP WEBSITES LEADERBOARD ("KEBANYAKAN BUKA WEBSITE APA SAJA") ── */}
      <div className="bg-white rounded-3xl border border-[#D4D4CE]/50 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-[#023246] text-base sm:text-lg flex items-center gap-2">
              <span>🏆</span>
              <span>Peringkat Website Terbanyak Dibuka Guru</span>
            </h3>
            <p className="text-xs text-slate-500">
              Daftar situs web yang paling sering dikunjungi oleh guru terdaftar, persentase kunjungan, dan jumlah guru unik.
            </p>
          </div>
          <span className="text-xs font-bold text-[#287094] bg-[#287094]/10 px-3 py-1 rounded-full w-fit">
            {analytics.topWebsites.length} Domain Dikunjungi
          </span>
        </div>

        {analytics.topWebsites.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center mx-auto text-[#287094]">
              <Globe className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h4 className="font-bold text-[#023246] text-sm">Belum Ada Riwayat Kunjungan Web Tercatat</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Data statistik bersumber murni dari dewan guru yang terdaftar ({teachers.length} guru). Saat guru membuka modul koreksi nilai, materi ajar, atau portal referensi, data peringkat akan terisi secara otomatis.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsSimulateModalOpen(true)}
                className="px-3.5 py-2 bg-[#287094] hover:bg-[#023246] text-white text-xs font-bold rounded-xl transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Uji Catat Kunjungan Guru</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {analytics.topWebsites.map((site, index) => {
              const rank = index + 1;
              const catMeta =
                TRAFFIC_CATEGORY_METADATA[site.category] || TRAFFIC_CATEGORY_METADATA.LAINNYA;

              return (
                <div
                  key={site.domain}
                  className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200/80 transition-all space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                          rank === 1
                            ? 'bg-amber-400 text-amber-950 shadow-xs'
                            : rank === 2
                            ? 'bg-slate-300 text-slate-800'
                            : rank === 3
                            ? 'bg-amber-700/20 text-amber-900 border border-amber-600/30'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        #{rank}
                      </span>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-[#023246] text-sm truncate">
                            {site.website_name}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${catMeta.bgBadge} ${catMeta.borderBadge}`}
                          >
                            {catMeta.label}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-[#287094] flex items-center gap-1">
                          <span>{site.domain}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-10 sm:pl-0">
                      <div className="text-left sm:text-right">
                        <span className="text-sm font-black text-[#023246]">
                          {site.total_visits}x
                        </span>
                        <span className="text-[11px] text-slate-500 ml-1">
                          ({site.unique_teachers} guru)
                        </span>
                      </div>
                      <a
                        href={site.domain.startsWith('http') ? site.domain : `https://${site.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-white hover:bg-slate-200 text-[#023246] border border-slate-200 transition-all text-xs font-bold flex items-center gap-1"
                        title="Buka Website"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Kunjungi</span>
                      </a>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-[#287094] rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(site.percentage, 4)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Porsi lalu lintas web: {site.percentage}%</span>
                      {site.top_users && site.top_users.length > 0 && (
                        <span>
                          Sering dibuka oleh:{' '}
                          <strong className="text-slate-600">
                            {site.top_users.map((u) => u.user_name.split(',')[0]).join(', ')}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── TWO-COLUMN GRID: KATEGORI & WAKTU PUNCAK ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kolom 1: Distribusi Kategori Web */}
        <div className="bg-white rounded-3xl border border-[#D4D4CE]/50 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-[#023246] text-base flex items-center gap-2">
                <span>📊</span>
                <span>Distribusi Kategori Website</span>
              </h3>
              <p className="text-xs text-slate-500">
                Fokus pemanfaatan web guru (Kurikulum, Penilaian, Media KBM, dsb.)
              </p>
            </div>
          </div>

          {analytics.totalVisits === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Belum ada data kategori untuk ditampilkan.
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.categoryDistribution.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{cat.label}</span>
                    <span className="font-mono font-bold text-[#023246]">
                      {cat.count} kali ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(cat.percentage, 2)}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolom 2: Jam Puncak Akses KBM */}
        <div className="bg-white rounded-3xl border border-[#D4D4CE]/50 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-[#023246] text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#287094]" />
                <span>Pola Jam Akses Daring Guru</span>
              </h3>
              <p className="text-xs text-slate-500">
                Frekuensi buka web per jam kerja sekolah (07:00 – 17:00 WIB)
              </p>
            </div>
          </div>

          {analytics.totalVisits === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Belum ada rekaman jam akses dari guru.
            </div>
          ) : (
            <>
              <div className="h-44 flex items-end justify-between gap-1.5 pt-4 pb-2 px-1 border-b border-slate-100">
                {analytics.hourlyTrend.map((pt) => {
                  const maxCount = Math.max(...analytics.hourlyTrend.map((p) => p.count), 1);
                  const heightPercent = Math.round((pt.count / maxCount) * 100);

                  return (
                    <div
                      key={pt.hour}
                      className="flex-1 flex flex-col items-center gap-1 group relative cursor-default"
                    >
                      <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-[#023246] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap z-10 pointer-events-none">
                        {pt.count}x ({pt.hour})
                      </div>

                      <div className="w-full bg-slate-100 rounded-t-md h-32 flex items-end overflow-hidden">
                        <div
                          className="w-full bg-[#023246] hover:bg-[#287094] rounded-t-md transition-all duration-300"
                          style={{ height: `${Math.max(heightPercent, 6)}%` }}
                        />
                      </div>
                      <span className="text-[9px] sm:text-[10px] text-slate-500 font-mono">
                        {pt.hour.slice(0, 2)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Puncak aktivitas berlangsung di sela jam tatap muka KBM & administrasi guru.
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── PER-GURU WEB ACTIVITY MATRIX (STRICTLY FROM ADMIN'S REGISTERED TEACHERS) ── */}
      <div className="bg-white rounded-3xl border border-[#D4D4CE]/50 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-[#023246] text-base sm:text-lg flex items-center gap-2">
              <Users className="w-4 h-4 text-[#287094]" />
              <span>Matriks Aktivitas Guru Terdaftar ({analytics.teacherSummaries.length} Akun)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Data guru diambil langsung dari master data guru yang diset oleh Admin. Memantau keaktifan masing-masing guru dalam mengakses website.
            </p>
          </div>
          <span className="text-xs font-bold text-[#023246] bg-slate-100 px-3 py-1 rounded-full w-fit">
            {analytics.teacherSummaries.filter((t) => t.total_visits > 0).length} dari {analytics.teacherSummaries.length} Guru Aktif
          </span>
        </div>

        {analytics.teacherSummaries.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Belum ada guru yang terdaftar di sistem. Daftarkan guru di menu Manajemen Guru & Staf.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {analytics.teacherSummaries.map((teacherSummary) => {
              const isSelected = selectedTeacherId === teacherSummary.user_id;
              const hasActivity = teacherSummary.total_visits > 0;

              return (
                <div
                  key={teacherSummary.user_id}
                  className={`p-4 rounded-2xl border transition-all space-y-2 cursor-pointer ${
                    isSelected
                      ? 'bg-[#287094]/10 border-[#287094] shadow-xs'
                      : hasActivity
                      ? 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      : 'bg-white hover:bg-slate-50/70 border-slate-200/60 opacity-90'
                  }`}
                  onClick={() => {
                    if (isSelected) setSelectedTeacherId('ALL');
                    else setSelectedTeacherId(teacherSummary.user_id);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-[#023246] truncate">
                        {teacherSummary.user_name}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {teacherSummary.user_npp}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-black shrink-0 ${
                        hasActivity
                          ? 'bg-[#023246] text-white'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {teacherSummary.total_visits}x
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Situs Terbanyak:</span>
                      <span
                        className={`font-semibold truncate max-w-37.5 ${
                          hasActivity ? 'text-[#023246]' : 'text-slate-400 font-normal italic'
                        }`}
                        title={teacherSummary.top_website}
                      >
                        {teacherSummary.top_website}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Akses Terakhir:</span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {hasActivity && teacherSummary.last_accessed_at
                          ? `${new Date(teacherSummary.last_accessed_at).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })} WIB`
                          : 'Belum ada'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-end">
                    <span className="text-[10px] font-bold text-[#287094] flex items-center gap-0.5">
                      {isSelected
                        ? '✓ Sedang difilter'
                        : hasActivity
                        ? 'Klik untuk filter riwayat →'
                        : 'Belum ada aktivitas tercatat'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── REAL-TIME LOG FEED TABLE ────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-[#D4D4CE]/50 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-[#023246] text-base sm:text-lg flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Log Riwayat Kunjungan Web Real-Time</span>
            </h3>
            <p className="text-xs text-slate-500">
              Menampilkan {allFilteredLogs.length} rekaman aktivitas web guru secara kronologis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              Halaman {currentPage} dari {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {paginatedLogs.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs space-y-1">
            <p className="font-bold text-slate-500">Belum ada catatan riwayat kunjungan web</p>
            <p>Aktivitas akan terekam secara otomatis ketika guru membuka modul atau portal daring.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#023246]">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3">Waktu Akses</th>
                  <th className="py-3 px-3">Nama Guru (NPP)</th>
                  <th className="py-3 px-3">Website & Domain</th>
                  <th className="py-3 px-3">Kategori</th>
                  <th className="py-3 px-3">Perangkat</th>
                  <th className="py-3 px-3 text-right">Tautan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.map((log) => {
                  const catMeta =
                    TRAFFIC_CATEGORY_METADATA[log.category] || TRAFFIC_CATEGORY_METADATA.LAINNYA;
                  const isMobile =
                    log.device.toLowerCase().includes('mobile') ||
                    log.device.toLowerCase().includes('android');

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                        <div>
                          {new Date(log.accessed_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          WIB
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(log.accessed_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-[#023246]">{log.user_name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{log.user_npp}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{log.website_name}</div>
                        <div className="text-[10px] font-mono text-[#287094]">{log.domain}</div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${catMeta.bgBadge} ${catMeta.borderBadge}`}
                        >
                          {catMeta.label}
                        </span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          {isMobile ? (
                            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <Laptop className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>{log.device}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <a
                          href={log.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#287094] hover:underline"
                        >
                          <span>Buka</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: KELOLA WEBSITE SEKOLAH YANG DIPANTAU (ADMIN) ─────────── */}
      <Modal
        isOpen={isManageWebsitesModalOpen}
        onClose={() => setIsManageWebsitesModalOpen(false)}
        title="Kelola Website & Portal Sekolah yang Dipantau"
      >
        <div className="space-y-5 text-xs sm:text-sm text-[#023246]">
          <p className="text-xs text-slate-500 leading-relaxed">
            Admin dapat mendaftarkan portal sekolah, LMS, E-Rapor, maupun tautan referensi KBM. Situs web yang didaftarkan di sini akan muncul di direktori guru dan dipantau intensitas kunjungannya.
          </p>

          {/* Form Tambah Website Baru */}
          <form onSubmit={handleAddWebsite} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-extrabold text-[#023246] text-xs flex items-center gap-1.5">
              <PlusCircle className="w-3.5 h-3.5 text-[#287094]" />
              <span>Tambah Website / Portal Pantauan Baru</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Nama Portal / Website:</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: LMS SMP Al-Ittihadiyah"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className="w-full p-2 bg-white border border-[#D4D4CE] rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">URL / Tautan Website:</label>
                <input
                  type="text"
                  required
                  placeholder="https://lms.sekolah.sch.id"
                  value={newSiteUrl}
                  onChange={(e) => setNewSiteUrl(e.target.value)}
                  className="w-full p-2 bg-white border border-[#D4D4CE] rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Kategori:</label>
                <select
                  value={newSiteCategory}
                  onChange={(e) => setNewSiteCategory(e.target.value as any)}
                  className="w-full p-2 bg-white border border-[#D4D4CE] rounded-xl text-xs"
                >
                  {Object.keys(TRAFFIC_CATEGORY_METADATA).map((k) => (
                    <option key={k} value={k}>
                      {TRAFFIC_CATEGORY_METADATA[k as TrafficCategory].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Keterangan Singkat:</label>
                <input
                  type="text"
                  placeholder="Misal: Portal penugasan dan materi kelas"
                  value={newSiteDesc}
                  onChange={(e) => setNewSiteDesc(e.target.value)}
                  className="w-full p-2 bg-white border border-[#D4D4CE] rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="pt-1 flex justify-end">
              <Button variant="primary" size="sm" type="submit">
                Simpan Website Pantauan
              </Button>
            </div>
          </form>

          {/* Daftar Website yang Sedang Dipantau */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-[#023246] text-xs">
              Daftar Website yang Dipantau ({monitoredWebsites.length}):
            </h4>
            <div className="max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
              {monitoredWebsites.map((site) => (
                <div
                  key={site.id}
                  className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-[#023246] text-xs truncate">
                        {site.name}
                      </span>
                      <span className="text-[10px] font-mono text-[#287094] truncate">
                        ({site.domain})
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{site.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteWebsite(site.id, site.name)}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors shrink-0"
                    title="Hapus Website dari Pantauan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: SIMULASI UJI KUNJUNGAN WEB GURU ASLI ─────────────────── */}
      <Modal
        isOpen={isSimulateModalOpen}
        onClose={() => setIsSimulateModalOpen(false)}
        title="Uji Catat Kunjungan Web Guru Terdaftar"
      >
        <div className="space-y-4 text-xs sm:text-sm text-[#023246]">
          <p className="text-xs text-slate-500 leading-relaxed">
            Pilih salah satu guru terdaftar ({teachers.length} guru diatur Admin) untuk menguji pencatatan kunjungan website secara langsung ke log real-time.
          </p>

          {/* Pilih Guru Asli */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Pilih Guru Terdaftar:</label>
            <select
              value={simTeacherId}
              onChange={(e) => setSimTeacherId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-[#D4D4CE] rounded-xl text-xs sm:text-sm text-[#023246] focus:ring-2 focus:ring-[#287094]"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.nip ? `NPP. ${t.nip}` : 'NPP. -'}) — {t.position || t.role}
                </option>
              ))}
            </select>
          </div>

          {/* Pilih Website Rujukan */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Pilih Website yang Dibuka:</label>
            <select
              value={simSiteIndex}
              onChange={(e) => setSimSiteIndex(Number(e.target.value))}
              className="w-full p-2.5 bg-slate-50 border border-[#D4D4CE] rounded-xl text-xs sm:text-sm text-[#023246] focus:ring-2 focus:ring-[#287094]"
            >
              {monitoredWebsites.map((site, idx) => (
                <option key={site.id} value={idx}>
                  {site.icon} {site.name} ({site.domain})
                </option>
              ))}
              <option value={-1}>🔗 + Input Website Bebas Lainnya...</option>
            </select>
          </div>

          {/* Input Kustom jika dipilih */}
          {simSiteIndex === -1 && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Nama Website / Portal:</label>
                <input
                  type="text"
                  placeholder="Misal: Portal Belajar IPA Online"
                  value={customSiteName}
                  onChange={(e) => setCustomSiteName(e.target.value)}
                  className="w-full p-2 text-xs bg-white border border-[#D4D4CE] rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">URL / Tautan Lengkap:</label>
                <input
                  type="text"
                  placeholder="https://contoh-website-guru.com"
                  value={customSiteUrl}
                  onChange={(e) => setCustomSiteUrl(e.target.value)}
                  className="w-full p-2 text-xs bg-white border border-[#D4D4CE] rounded-lg font-mono"
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsSimulateModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Batal
            </button>
            <Button variant="primary" size="sm" onClick={handleSimulateVisit}>
              Catat Kunjungan Sekarang
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: KONFIRMASI KOSONGKAN RIWAYAT ─────────────────────────── */}
      <Modal
        isOpen={isClearLogsModalOpen}
        onClose={() => setIsClearLogsModalOpen(false)}
        title="Kosongkan Riwayat Log Trafik"
      >
        <div className="space-y-4 text-xs sm:text-sm text-[#023246]">
          <p className="text-slate-600 leading-relaxed">
            Apakah Anda yakin ingin mengosongkan seluruh riwayat rekaman kunjungan website guru? Statistik akan kembali bersih dan mulai menghitung dari awal saat guru membuka website.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsClearLogsModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Batal
            </button>
            <Button variant="danger" size="sm" onClick={handleClearAllLogs}>
              Ya, Kosongkan Riwayat
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
