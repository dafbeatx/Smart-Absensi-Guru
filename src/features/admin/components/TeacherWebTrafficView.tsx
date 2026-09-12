/**
 * SMART ABSENSI GURU - ANONYMOUS IN-APP FEATURE TRAFFIC MONITOR
 * Memantau volume trafik, frekuensi pemakaian menu, dan jam sibuk akses di dalam web aplikasi.
 * Bersifat 100% Anonim: Hanya melihat data trafik agregat tanpa membuka nama atau identitas pribadi guru.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Search,
  Filter,
  Download,
  Calendar,
  Zap,
  ArrowLeft,
  Trash2,
  Play,
  Sparkles,
  Layers,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import {
  WebTrafficService,
  TRAFFIC_CATEGORY_METADATA,
  INTERNAL_APP_FEATURES,
} from '../../../services/web-traffic.service';
import type {
  WebTrafficLog,
  TrafficCategory,
  TrafficFilterOptions,
} from '../../../types/traffic.types';
import type { UserProfile } from '../../../types/database.types';

interface TeacherWebTrafficViewProps {
  teachers?: UserProfile[];
  onBackToDashboard?: () => void;
}

export const TeacherWebTrafficView: React.FC<TeacherWebTrafficViewProps> = ({
  teachers = [],
  onBackToDashboard,
}) => {
  // State Filter & Pencarian
  const [dateRange, setDateRange] = useState<TrafficFilterOptions['dateRange']>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<TrafficCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data State
  const [logs, setLogs] = useState<WebTrafficLog[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 12;

  // Modal State
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isClearLogsModalOpen, setIsClearLogsModalOpen] = useState(false);

  // Form Simulasi (Anonim)
  const [simFeatureId, setSimFeatureId] = useState<string>('koreksi_soal');

  // Load Data
  const refreshData = () => {
    const rawLogs = WebTrafficService.getAllLogs();
    setLogs(rawLogs);
  };

  useEffect(() => {
    refreshData();

    const handleUpdate = () => refreshData();
    window.addEventListener('smart_absensi_traffic_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('smart_absensi_traffic_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Hitung Analitik Agregat Anonim
  const analytics = useMemo(() => {
    return WebTrafficService.getAnalytics(
      {
        dateRange,
        category: selectedCategory,
        searchQuery,
      },
      teachers
    );
  }, [dateRange, selectedCategory, searchQuery, teachers, logs]);

  // Log yang Difilter untuk Tabel
  const filteredLogs = useMemo(() => {
    return WebTrafficService.getFilteredLogs({
      dateRange,
      category: selectedCategory,
      searchQuery,
    });
  }, [dateRange, selectedCategory, searchQuery, logs]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, selectedCategory, searchQuery]);

  // Ekspor CSV Bersifat Anonim
  const handleExportCSV = () => {
    const csvContent = WebTrafficService.exportToCSV(filteredLogs);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Trafik_Fitur_Web_Anonim_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Uji Catat Interaksi Fitur Web (Anonim)
  const handleSimulateVisit = () => {
    const feat = INTERNAL_APP_FEATURES.find((f) => f.id === simFeatureId);

    WebTrafficService.recordFeatureVisit({
      user_id: 'usr_anon_sim',
      user_name: 'Guru Anonim',
      user_npp: 'NPP. ••••••••',
      user_role: 'GURU',
      feature_id: simFeatureId,
      feature_name: feat?.name,
      feature_icon: feat?.icon,
      category: feat?.category,
      device: 'Desktop Windows (Simulasi)',
    });

    setIsSimulateModalOpen(false);
  };

  // Kosongkan Seluruh Riwayat Log
  const handleClearAllLogs = () => {
    WebTrafficService.clearAllLogs();
    setIsClearLogsModalOpen(false);
    refreshData();
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 animate-fade-in font-sans">
      {/* ── HEADER HALAMAN & BADGE ANONIM ──────────────────────────────── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {onBackToDashboard && (
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="p-1.5 -ml-1 text-slate-500 hover:text-[#023246] hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Kembali ke Dashboard Utama"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h1 className="text-xl sm:text-2xl font-black text-[#023246] tracking-tight">
                Trafik Fitur Web Guru
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                100% Mode Anonim (Privasi Terjaga)
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#023246]/10 text-[#023246] border border-[#023246]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live In-App Traffic
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
              Memantau volume trafik agregat, frekuensi pemakaian menu, dan jam sibuk akses di dalam website sekolah tanpa menampilkan nama atau identitas pribadi guru.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsCatalogModalOpen(true)}
              className="px-3 py-2 text-xs font-bold text-[#023246] bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Layers className="w-3.5 h-3.5 text-[#287094]" />
              <span>Katalog 18 Fitur Web</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSimulateModalOpen(true)}
              className="px-3 py-2 text-xs font-bold text-[#023246] bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-300 text-amber-950 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Play className="w-3.5 h-3.5 text-amber-700 fill-amber-700" />
              <span>Uji Buka Fitur</span>
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="text-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV (Anonim)</span>
            </Button>

            {logs.length > 0 && (
              <button
                type="button"
                onClick={() => setIsClearLogsModalOpen(true)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-red-200"
                title="Kosongkan Riwayat Log Fitur"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 4 KARTU STATISTIK KPI UTAMA (AGREGAT ANONIM) ────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Akses Fitur */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Total Akses Fitur
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#023246]/10 text-[#023246] flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-[#023246]">
              {analytics.totalVisits.toLocaleString('id-ID')}
            </span>
            <span className="text-xs text-slate-500 font-semibold">klik</span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">
            Volume seluruh interaksi menu web
          </p>
        </div>

        {/* Fitur Terfavorit (#1) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Fitur #1 Terpopuler
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-sm sm:text-base font-black text-[#023246] block truncate" title={analytics.topFeature?.feature_name || '-'}>
              {analytics.topFeature ? `${analytics.topFeature.feature_icon || '📝'} ${analytics.topFeature.feature_name}` : 'Belum Ada Data'}
            </span>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {analytics.topFeature
                ? `${analytics.topFeature.total_visits}x dibuka (${analytics.topFeature.percentage}% dari total)`
                : 'Menunggu aktivitas guru'}
            </p>
          </div>
        </div>

        {/* Partisipasi Guru Aktif (Agregat Anonim) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Partisipasi Guru Aktif
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-xl sm:text-2xl font-black text-[#023246] block">
              {analytics.uniqueTeachersCount} <span className="text-xs text-slate-500 font-semibold font-normal">dari {analytics.totalRegisteredTeachers || teachers.length} Guru</span>
            </span>
            <p className="text-[11px] text-emerald-700 font-bold truncate mt-0.5">
              {analytics.participationRate}% guru aktif menggunakan web
            </p>
          </div>
        </div>

        {/* Kategori Dominan */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Kategori Dominan
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-sm sm:text-base font-black text-[#023246] block truncate">
              {analytics.topCategory ? analytics.topCategory.label : 'Belum Ada Data'}
            </span>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {analytics.topCategory
                ? `${analytics.topCategory.count}x klik (${analytics.topCategory.label})`
                : 'Aktivitas KBM seimbang'}
            </p>
          </div>
        </div>
      </div>

      {/* ── PERINGKAT FITUR TERBANYAK DIBUKA (LEADERBOARD) ──────────────── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#023246] tracking-tight flex items-center gap-2">
              <span>🏆</span>
              <span>Peringkat Fitur &amp; Menu Web Paling Banyak Digunakan</span>
            </h2>
            <p className="text-xs text-slate-500">
              Statistik pemanfaatan fitur di dalam website Smart Absensi berdasarkan total klik dan jumlah guru unik yang mengakses.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {analytics.topFeatures.length} fitur tercatat aktif
          </span>
        </div>

        {analytics.topFeatures.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 space-y-2">
            <p className="font-bold text-sm text-[#023246]">Belum ada aktivitas penggunaan fitur</p>
            <p className="text-xs max-w-md mx-auto">
              Data akan otomatis terakumulasi saat guru membuka menu di dashboard guru (seperti Presensi, Koreksi Soal, Bahan Ajar, atau Poin Siswa).
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {analytics.topFeatures.slice(0, 8).map((feat, idx) => {
              const catMeta = TRAFFIC_CATEGORY_METADATA[feat.category] || TRAFFIC_CATEGORY_METADATA.LAINNYA;
              return (
                <div
                  key={feat.feature_id}
                  className="p-3 sm:p-3.5 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-200/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-950 shadow-2xs'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-900'
                          : idx === 2
                          ? 'bg-amber-700/20 text-amber-900'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {idx + 1}
                    </span>

                    <span className="text-xl shrink-0">{feat.feature_icon || '⚡'}</span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-[#023246] truncate">
                          {feat.feature_name}
                        </span>
                        <span
                          className={`text-[9.5px] font-extrabold px-2 py-0.2 rounded-md border ${catMeta.bgBadge} ${catMeta.borderBadge}`}
                        >
                          {catMeta.label}
                        </span>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div
                          className="bg-[#023246] h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(4, feat.percentage)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 text-xs">
                    <div className="text-left sm:text-right">
                      <span className="font-black text-[#023246] text-sm block">
                        {feat.total_visits}x
                      </span>
                      <span className="text-[10.5px] text-slate-500">
                        {feat.percentage}% total klik
                      </span>
                    </div>

                    <div className="text-left sm:text-right border-l border-slate-200 pl-3 sm:pl-4">
                      <span className="font-bold text-slate-700 block">
                        {feat.unique_teachers} Guru
                      </span>
                      <span className="text-[10px] text-slate-400">pengguna unik</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── DUA KOLOM: DISTRIBUSI KATEGORI & TREN JAM KBM ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Distribusi Kategori Fitur */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm sm:text-base font-black text-[#023246] tracking-tight">
              Distribusi 4 Kategori Fitur Internal
            </h3>
            <p className="text-xs text-slate-500">
              Porsi pemanfaatan modul sistem Smart Absensi Guru.
            </p>
          </div>

          <div className="space-y-3">
            {analytics.categoryDistribution.map((cat) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">{cat.label}</span>
                  <span className="font-bold text-[#023246]">
                    {cat.count}x ({cat.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(2, cat.percentage)}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tren Jam Akses (07.00 - 17.00 WIB) */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm sm:text-base font-black text-[#023246] tracking-tight">
              Jam Sibuk Akses Fitur Guru (WIB)
            </h3>
            <p className="text-xs text-slate-500">
              Frekuensi guru menggunakan menu web di jam jam kerja KBM sekolah.
            </p>
          </div>

          <div className="h-44 flex items-end justify-between gap-1.5 pt-4 pb-2 border-b border-slate-100">
            {(() => {
              const maxHourCount = Math.max(1, ...analytics.hourlyTrend.map((h) => h.count));
              return analytics.hourlyTrend.map((pt) => {
                const heightPct = Math.round((pt.count / maxHourCount) * 100);
                return (
                  <div key={pt.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute -top-7 bg-slate-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      {pt.count} klik
                    </div>
                    <div className="w-full bg-slate-100 rounded-t-sm h-32 flex items-end">
                      <div
                        className={`w-full rounded-t-sm transition-all duration-500 ${
                          pt.count > 0 ? 'bg-[#287094] group-hover:bg-[#023246]' : 'bg-transparent'
                        }`}
                        style={{ height: `${Math.max(pt.count > 0 ? 8 : 0, heightPct)}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 -rotate-45 sm:rotate-0 origin-left mt-1">
                      {pt.hour.slice(0, 2)}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* ── LOG RIWAYAT AKTIVITAS REAL-TIME (100% ANONIM) ────────────────── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#023246] tracking-tight">
              Log Riwayat Trafik Akses Fitur (Anonim)
            </h2>
            <p className="text-xs text-slate-500">
              Jejak kronologis pemakaian menu web secara agregat tanpa menyimpan data pribadi ({filteredLogs.length} entri).
            </p>
          </div>
        </div>

        {/* Bar Filter & Pencarian */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Rentang Tanggal */}
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-[#D4D4CE] rounded-xl text-xs font-semibold text-[#023246] focus:ring-2 focus:ring-[#287094] focus:outline-none"
            >
              <option value="ALL">Semua Waktu</option>
              <option value="TODAY">Hari Ini Saja</option>
              <option value="7_DAYS">7 Hari Terakhir</option>
              <option value="30_DAYS">30 Hari Terakhir</option>
            </select>
          </div>

          {/* Filter Kategori */}
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-[#D4D4CE] rounded-xl text-xs font-semibold text-[#023246] focus:ring-2 focus:ring-[#287094] focus:outline-none"
            >
              <option value="ALL">Semua Kategori Fitur</option>
              {Object.keys(TRAFFIC_CATEGORY_METADATA).map((k) => (
                <option key={k} value={k}>
                  {TRAFFIC_CATEGORY_METADATA[k as TrafficCategory].label}
                </option>
              ))}
            </select>
          </div>

          {/* Input Pencarian */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama fitur web..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-[#D4D4CE] rounded-xl text-xs font-semibold text-[#023246] focus:ring-2 focus:ring-[#287094] focus:outline-none"
            />
          </div>
        </div>

        {/* Tabel Desktop (Kolom Bersifat Anonim) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Waktu Akses (WIB)</th>
                <th className="py-2.5 px-3">Fitur / Menu Dibuka</th>
                <th className="py-2.5 px-3">Kategori Fitur</th>
                <th className="py-2.5 px-3">Peran Pengguna</th>
                <th className="py-2.5 px-3">Jenis Perangkat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold">
                    Tidak ada catatan aktivitas fitur yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const catMeta = TRAFFIC_CATEGORY_METADATA[log.category] || TRAFFIC_CATEGORY_METADATA.LAINNYA;
                  const dateStr = new Date(log.accessed_at).toLocaleString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {dateStr} WIB
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{log.feature_icon || '⚡'}</span>
                          <span className="font-bold text-[#023246]">{log.feature_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-md border ${catMeta.bgBadge} ${catMeta.borderBadge}`}
                        >
                          {catMeta.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Guru Terdaftar (Anonim)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                        {log.device}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Card View untuk Tampilan Mobile HP */}
        <div className="md:hidden space-y-2.5">
          {paginatedLogs.length === 0 ? (
            <div className="py-6 text-center text-slate-400 font-semibold text-xs bg-slate-50 rounded-xl">
              Tidak ada catatan aktivitas fitur.
            </div>
          ) : (
            paginatedLogs.map((log) => {
              const catMeta = TRAFFIC_CATEGORY_METADATA[log.category] || TRAFFIC_CATEGORY_METADATA.LAINNYA;
              const dateStr = new Date(log.accessed_at).toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={log.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base">{log.feature_icon || '⚡'}</span>
                      <span className="font-bold text-xs text-[#023246] truncate">
                        {log.feature_name}
                      </span>
                    </div>
                    <span className="text-[9.5px] font-mono text-slate-400 shrink-0">
                      {dateStr}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] text-slate-500 font-medium">
                      Guru Terdaftar (Anonim) • {log.device}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded shrink-0 ${catMeta.bgBadge}`}
                    >
                      {catMeta.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Halaman {currentPage} dari {totalPages} ({filteredLogs.length} data)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: KATALOG 18 FITUR RESMI INTERNAL SEKOLAH ──────────────── */}
      <Modal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        title="Katalog 18 Fitur Resmi di Website Guru"
      >
        <div className="space-y-4 text-xs sm:text-sm text-[#023246]">
          <p className="text-slate-500 leading-relaxed text-xs">
            Trafik dipantau secara agregat dan anonim untuk 18 fitur resmi internal berikut:
          </p>

          <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {INTERNAL_APP_FEATURES.map((feat) => {
              const catMeta = TRAFFIC_CATEGORY_METADATA[feat.category];
              return (
                <div
                  key={feat.id}
                  className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-2"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-lg shrink-0 mt-0.5">{feat.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[#023246] text-xs">
                          {feat.name}
                        </span>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${catMeta.bgBadge}`}>
                          {catMeta.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{feat.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex justify-end border-t border-slate-100">
            <Button variant="primary" size="sm" onClick={() => setIsCatalogModalOpen(false)}>
              Tutup Katalog
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: SIMULASI UJI BUKA FITUR (ANONIM) ──────────────────────── */}
      <Modal
        isOpen={isSimulateModalOpen}
        onClose={() => setIsSimulateModalOpen(false)}
        title="Uji Buka Fitur Web Guru (Mode Anonim)"
      >
        <div className="space-y-4 text-xs sm:text-sm text-[#023246]">
          <p className="text-xs text-slate-500 leading-relaxed">
            Pilih salah satu fitur internal untuk menguji pencatatan volume trafik secara anonim langsung ke analitik.
          </p>

          {/* Pilih Fitur Internal */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Pilih Fitur / Menu Web:</label>
            <select
              value={simFeatureId}
              onChange={(e) => setSimFeatureId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-[#D4D4CE] rounded-xl text-xs sm:text-sm text-[#023246] focus:ring-2 focus:ring-[#287094]"
            >
              {INTERNAL_APP_FEATURES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.icon} {f.name} ({TRAFFIC_CATEGORY_METADATA[f.category].label})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsSimulateModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Batal
            </button>
            <Button variant="primary" size="sm" onClick={handleSimulateVisit}>
              Catat Buka Fitur (Anonim)
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: KONFIRMASI KOSONGKAN RIWAYAT ─────────────────────────── */}
      <Modal
        isOpen={isClearLogsModalOpen}
        onClose={() => setIsClearLogsModalOpen(false)}
        title="Kosongkan Riwayat Log Fitur"
      >
        <div className="space-y-4 text-xs sm:text-sm text-[#023246]">
          <p className="text-slate-600 leading-relaxed">
            Apakah Anda yakin ingin mengosongkan seluruh riwayat rekaman trafik fitur web guru? Statistik akan kembali bersih dan mulai menghitung dari nol saat guru membuka menu di aplikasi.
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
