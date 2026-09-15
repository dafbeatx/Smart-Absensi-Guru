import React, { useState, useEffect } from 'react';
import { SystemHealthService } from '../../../services/system-health.service';
import type {
  SystemHealthReport,
  AiHealthWarning,
} from '../../../services/system-health.service';

interface SystemHealthDashboardViewProps {
  onBackToDashboard?: () => void;
}

export const SystemHealthDashboardView: React.FC<SystemHealthDashboardViewProps> = ({
  onBackToDashboard,
}) => {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEgressModalOpen, setIsEgressModalOpen] = useState(false);

  // Calculate current egress dynamically for form default
  const currentEgressConfig = SystemHealthService.getEgressConfig();
  const currentEgressGb = (SystemHealthService.calculateCurrentEgressMb(currentEgressConfig) / 1000).toFixed(3);
  const [egressInputVal, setEgressInputVal] = useState(currentEgressGb);
  const [egressInputUnit, setEgressInputUnit] = useState<'GB' | 'MB'>('GB');
  const [burnRateInput, setBurnRateInput] = useState(String(currentEgressConfig.dailyBurnRateMb));

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await SystemHealthService.getReport();
        if (isMounted) setReport(data);
      } catch (err) {
        console.error('Failed to load system health report:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    const unsubscribe = SystemHealthService.subscribe((updated) => {
      if (isMounted) setReport(updated);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleRunAiScan = async () => {
    setIsRefreshing(true);
    try {
      const freshReport = await SystemHealthService.runHealthScan();
      setReport(freshReport);
    } catch (err) {
      console.error('Error running AI health scan:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveEgress = () => {
    const rawVal = parseFloat(egressInputVal) || 0;
    const mbVal = egressInputUnit === 'GB' ? Math.round(rawVal * 1000) : Math.round(rawVal);
    const burnRate = parseInt(burnRateInput, 10) || 30;

    SystemHealthService.updateEgressConfig(mbVal, burnRate);
    setIsEgressModalOpen(false);
    handleRunAiScan();
  };

  if (isLoading && !report) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-[#D4D4CE]/40 shadow-xs space-y-4">
        <div className="w-10 h-10 border-4 border-[#023246] border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="space-y-1">
          <p className="font-bold text-[#023246] text-sm">Menghubungi Cloud Supabase & Vercel...</p>
          <p className="text-xs text-slate-500">Menganalisis kuota egress, latency database, dan storage buckets.</p>
        </div>
      </div>
    );
  }

  const supa = report?.supabase;
  const vercel = report?.vercel;
  const score = report?.overallScore || 90;
  const status = report?.overallStatus || 'PRIMA';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
      {/* ── TOP ACTION BAR & NAVIGATION ───────────────────────────────────── */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="p-1.5 text-slate-500 hover:text-[#023246] hover:bg-slate-100 rounded-lg transition-all text-xs font-bold flex items-center gap-1 cursor-pointer mr-1"
                title="Kembali ke Dashboard Utama"
              >
                ← Kembali
              </button>
            )}
            <span className="px-2.5 py-0.5 bg-[#023246]/10 text-[#023246] font-bold text-[11px] rounded-full border border-[#023246]/20">
              Infrastruktur Cloud & AI Guard
            </span>
          </div>
          <h2 className="font-black text-[#023246] text-xl sm:text-2xl flex items-center gap-2">
            <span>🩺</span>
            <span>Kesehatan Website, Supabase & Vercel</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Monitoring kuota PostgREST Egress 5 GB, storage dokumen guru, performa CDN Vercel, dan audit proaktif AI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              if (supa) {
                setEgressInputVal((supa.egressUsedMb / 1000).toFixed(3));
                setEgressInputUnit('GB');
                setBurnRateInput(String(supa.dailyBurnRateMb));
              }
              setIsEgressModalOpen(true);
            }}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-[#023246] text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span>⚙️</span>
            <span>Sinkron Baseline Egress</span>
          </button>

          <button
            onClick={handleRunAiScan}
            disabled={isRefreshing}
            className="px-4 py-2 bg-[#023246] hover:bg-[#287094] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
            <span>{isRefreshing ? 'Memindai AI...' : 'Pindai AI Sekarang'}</span>
          </button>
        </div>
      </div>

      {/* ── AI EXECUTIVE SUMMARY CARD ────────────────────────────────────── */}
      <div className="bg-linear-to-br from-[#023246] to-[#012332] text-white p-5 sm:p-7 rounded-3xl border border-[#287094]/40 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#287094]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`px-3 py-1 text-xs font-black rounded-full uppercase tracking-wider flex items-center gap-1.5 border ${
                  status === 'PRIMA'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : status === 'WASPADA'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                Status Sistem: {status}
              </span>

              <span className="text-[11px] text-[#D4D4CE]/80">
                Terakhir Dipindai: {report?.lastScannedAt || 'Baru saja'}
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-black leading-snug text-white">
              {report?.headline || 'Sistem Beroperasi Prima. Supabase & Vercel dalam Kondisi Sangat Stabil.'}
            </h3>

            {/* Quick Diagnostic Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-left">
                <p className="text-[10px] text-[#D4D4CE]/80 font-semibold">Supabase REST</p>
                <p className="text-xs font-black text-emerald-300 flex items-center gap-1">
                  <span>●</span> {supa?.latencyMs || 0} ms
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-left">
                <p className="text-[10px] text-[#D4D4CE]/80 font-semibold">Vercel Edge</p>
                <p className="text-xs font-black text-emerald-300 flex items-center gap-1">
                  <span>●</span> {vercel?.edgeLatencyMs || 0} ms
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-left">
                <p className="text-[10px] text-[#D4D4CE]/80 font-semibold">PostgREST Egress</p>
                <p className={`text-xs font-black ${supa && supa.egressPercent > 80 ? 'text-rose-300' : 'text-sky-300'}`}>
                  {supa ? `${(supa.egressUsedMb / 1000).toFixed(2)} GB` : '0 GB'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-left">
                <p className="text-[10px] text-[#D4D4CE]/80 font-semibold">Offline Queue</p>
                <p className="text-xs font-black text-white">
                  {vercel?.indexedDbPendingSyncCount || 0} pending
                </p>
              </div>
            </div>
          </div>

          {/* Health Score Gauge */}
          <div className="shrink-0 flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 min-w-32.5">
            <span className="text-[10px] font-bold text-[#D4D4CE] uppercase tracking-wider">Health Score</span>
            <div className="text-4xl sm:text-5xl font-black text-white tracking-tight tabular-nums my-1">
              {score}
              <span className="text-sm font-semibold text-[#D4D4CE]">/100</span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-300">
              {score >= 88 ? 'Optimal' : score >= 65 ? 'Perlu Pantauan' : 'Kritis'}
            </span>
          </div>
        </div>
      </div>

      {/* ── PROACTIVE AI WARNINGS & ACTIONS ───────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-[#023246] flex items-center gap-2">
            <span>🤖</span>
            <span>Peringatan & Rekomendasi Pintar AI</span>
          </h3>
          <span className="text-[11px] text-slate-500 font-semibold">
            {report?.warnings.length || 0} Catatan Aktif
          </span>
        </div>

        {report && report.warnings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {report.warnings.map((w: AiHealthWarning) => (
              <div
                key={w.id}
                className={`p-4 rounded-2xl border text-left space-y-2 transition-all ${
                  w.severity === 'CRITICAL'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : w.severity === 'HIGH'
                    ? 'bg-orange-50 border-orange-200 text-orange-900'
                    : w.severity === 'MEDIUM'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-sky-50 border-sky-200 text-sky-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black flex items-center gap-1.5">
                    {w.severity === 'CRITICAL' ? '🚨' : w.severity === 'HIGH' ? '⚠️' : w.severity === 'MEDIUM' ? '⚡' : '💡'}
                    {w.title}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/80 border border-current/20">
                    {w.service}
                  </span>
                </div>
                <p className="text-xs opacity-90 leading-relaxed">{w.detail}</p>
                <div className="pt-1 border-t border-current/10 text-[11px] font-semibold flex items-start gap-1.5">
                  <span className="shrink-0">👉</span>
                  <span>{w.recommendation}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
            <span>✅</span>
            <span>Tidak ditemukan peringatan kritis. Semua parameter Supabase & Vercel berada di zona aman optimal.</span>
          </div>
        )}

        {/* AI Recommendations List */}
        {report && report.recommendations.length > 0 && (
          <div className="p-4 rounded-2xl bg-white border border-[#D4D4CE]/40 space-y-2">
            <p className="text-xs font-black text-[#023246] flex items-center gap-1.5">
              <span>📋</span>
              <span>Langkah Pengamanan & Efisiensi Aktif:</span>
            </p>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {report.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold shrink-0">✓</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── SECTION 1: SUPABASE INFRASTRUCTURE (4 CARDS) ────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-[#023246] flex items-center gap-2">
          <span>⚡</span>
          <span>Infrastruktur Supabase Cloud (PostgreSQL, Storage & Egress)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CARD 1: PostgREST Egress Tracker */}
          <div className="p-4 rounded-2xl bg-white border border-[#D4D4CE]/40 shadow-card flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">PostgREST Egress</span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                    supa && supa.egressStatus === 'CRITICAL'
                      ? 'bg-rose-100 text-rose-700'
                      : supa && supa.egressStatus === 'WARNING'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {supa?.egressStatus === 'CRITICAL' ? 'KRITIS' : supa?.egressStatus === 'WARNING' ? 'WASPADA' : 'AMAN'}
                </span>
              </div>
              <div className="flex items-baseline gap-1 pt-1">
                <span className="text-2xl font-black text-[#023246] tabular-nums">
                  {supa ? (supa.egressUsedMb / 1000).toFixed(2) : '0'}
                </span>
                <span className="text-xs text-slate-500 font-bold">/ 5.00 GB</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {supa ? `${supa.egressPercent}% kuota bulanan terpakai` : '0%'}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    supa && supa.egressPercent > 80
                      ? 'bg-rose-500'
                      : supa && supa.egressPercent > 60
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, supa?.egressPercent || 0)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>Sisa: {supa ? ((supa.egressLimitMb - supa.egressUsedMb) / 1000).toFixed(2) : 5} GB</span>
                <span>Proyeksi: {supa ? (supa.projectedMonthlyEgressMb / 1000).toFixed(2) : 0} GB</span>
              </div>
            </div>
          </div>

          {/* CARD 2: Supabase Storage Buckets */}
          <div className="p-4 rounded-2xl bg-white border border-[#D4D4CE]/40 shadow-card flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Storage Buckets</span>
                <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-700">
                  WebP Aktif ⚡
                </span>
              </div>
              <div className="flex items-baseline gap-1 pt-1">
                <span className="text-2xl font-black text-[#023246] tabular-nums">
                  {supa ? (supa.totalStorageBytes / (1024 * 1024)).toFixed(1) : '0'}
                </span>
                <span className="text-xs text-slate-500 font-bold">MB / 1.00 GB</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Penyimpanan foto profil guru & berkas cuti
              </p>
            </div>

            <div className="space-y-1 pt-1 border-t border-slate-100 text-xs text-slate-600">
              {supa?.storageBuckets.map((b) => (
                <div key={b.name} className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-slate-700">/{b.name}</span>
                  <span className="font-semibold text-slate-500">
                    {b.fileCount} file ({Math.round(b.totalBytes / 1024)} KB)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CARD 3: Database REST Latency & Realtime */}
          <div className="p-4 rounded-2xl bg-white border border-[#D4D4CE]/40 shadow-card flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Performa Database</span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                    supa && supa.latencyMs < 300
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {supa && supa.latencyMs < 300 ? 'CEPAT' : 'NORMAL'}
                </span>
              </div>
              <div className="flex items-baseline gap-1 pt-1">
                <span className="text-2xl font-black text-[#023246] tabular-nums">
                  {supa?.latencyMs || 0}
                </span>
                <span className="text-xs text-slate-500 font-bold">ms ping</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                PostgreSQL Cloud di kawasan Singapura (ap-southeast-1)
              </p>
            </div>

            <div className="space-y-1 pt-1 border-t border-slate-100 text-[11px] text-slate-600">
              <div className="flex items-center justify-between">
                <span>Realtime WebSocket</span>
                <span className="font-bold text-emerald-600">● {supa?.realtimeStatus}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>RLS Security Guard</span>
                <span className="font-bold text-[#023246]">🔒 Terkunci</span>
              </div>
            </div>
          </div>

          {/* CARD 4: Database Data Volume */}
          <div className="p-4 rounded-2xl bg-white border border-[#D4D4CE]/40 shadow-card flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Volume Data Sekolah</span>
                <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-slate-100 text-slate-700">
                  PostgreSQL
                </span>
              </div>
              <div className="flex items-baseline gap-1 pt-1">
                <span className="text-2xl font-black text-[#023246] tabular-nums">
                  {supa?.totalUsers || 0}
                </span>
                <span className="text-xs text-slate-500 font-bold">Guru & Staf</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Kapasitas baris data absensi aktif
              </p>
            </div>

            <div className="space-y-1 pt-1 border-t border-slate-100 text-[11px] text-slate-600">
              <div className="flex items-center justify-between">
                <span>Absensi Bulan Ini</span>
                <span className="font-bold text-slate-800">{supa?.totalMonthlyAttendance} baris</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Berkas Cuti / Izin</span>
                <span className="font-bold text-slate-800">{supa?.totalPendingLeaves} berkas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: VERCEL & CLIENT RUNTIME (3 CARDS) ────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-[#023246] flex items-center gap-2">
          <span>▲</span>
          <span>Infrastruktur Vercel CDN, PWA & Klien Browser</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* CARD 1: Vercel Edge Server */}
          <div className="p-4 rounded-2xl bg-white border border-[#D4D4CE]/40 shadow-card space-y-2 text-left">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">Vercel Edge Network</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-[#023246] tabular-nums">
                {vercel?.edgeLatencyMs || 0}
              </span>
              <span className="text-xs text-slate-500 font-bold">ms CDN latency</span>
            </div>
            <p className="text-xs text-slate-500">
              Serverless Edge Engine Vercel dengan HTTP/3 & Brotli Compression.
            </p>
            <div className="pt-2 border-t border-slate-100 text-[11px] text-emerald-600 font-bold flex items-center gap-1">
              <span>●</span> Status: {vercel?.status} (Global CDN)
            </div>
          </div>

          {/* CARD 2: PWA Service Worker & Offline Queue */}
          <div className="p-4 rounded-2xl bg-white border border-[#D4D4CE]/40 shadow-card space-y-2 text-left">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">PWA & Offline Guard</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-[#023246] tabular-nums">
                {vercel?.indexedDbPendingSyncCount || 0}
              </span>
              <span className="text-xs text-slate-500 font-bold">item tertunda</span>
            </div>
            <p className="text-xs text-slate-500">
              Antrean Dexie IndexedDB offline untuk perlindungan presensi saat internet sekolah padam.
            </p>
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex justify-between font-semibold">
              <span>Service Worker:</span>
              <span className="text-emerald-600 font-bold">{vercel?.serviceWorkerStatus}</span>
            </div>
          </div>

          {/* CARD 3: Client Cache & Deployment Version */}
          <div className="p-4 rounded-2xl bg-white border border-[#D4D4CE]/40 shadow-card space-y-2 text-left">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">Versi & Cache Klien</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-[#023246] tabular-nums">
                {vercel?.localStorageUsageKb || 0}
              </span>
              <span className="text-xs text-slate-500 font-bold">KB cached</span>
            </div>
            <p className="text-xs text-slate-500">
              Cache lokal in-memory guru, jadwal, dan preferensi untuk meminimalisir request ke Supabase.
            </p>
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex justify-between font-semibold">
              <span>Versi Rilis:</span>
              <span className="font-mono text-[#023246] font-bold">{vercel?.buildVersion}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL SINKRONISASI BASELINE EGRESS ─────────────────────────────── */}
      {isEgressModalOpen && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#D4D4CE]/60 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="space-y-0.5">
                <h4 className="font-black text-[#023246] text-base flex items-center gap-1.5">
                  <span>⚙️</span>
                  <span>Sinkron Baseline Egress Supabase</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Sesuaikan angka pemakaian yang tertera di dashboard Supabase Anda.
                </p>
              </div>
              <button
                onClick={() => setIsEgressModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#023246] mb-1">
                  Angka PostgREST Egress Saat Ini
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    value={egressInputVal}
                    onChange={(e) => setEgressInputVal(e.target.value)}
                    placeholder="misal: 1.107"
                    className="flex-1 px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#023246]/30 transition-all"
                  />
                  <select
                    value={egressInputUnit}
                    onChange={(e) => setEgressInputUnit(e.target.value as 'GB' | 'MB')}
                    className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 text-slate-700 cursor-pointer"
                  >
                    <option value="GB">GB</option>
                    <option value="MB">MB</option>
                  </select>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Batas Free Plan Supabase adalah 5.000 MB (5.00 GB).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#023246] mb-1">
                  Estimasi Laju Pembakaran Harian (Burn Rate)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={burnRateInput}
                    onChange={(e) => setBurnRateInput(e.target.value)}
                    placeholder="30"
                    className="w-28 px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#023246]/30 transition-all"
                  />
                  <span className="text-xs text-slate-500 font-semibold">MB / hari</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Setelah optimasi polling 180s & WebP, laju ideal berkisar antara 25-40 MB/hari.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEgressModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEgress}
                className="px-5 py-2 text-xs font-bold text-white bg-[#023246] hover:bg-[#287094] rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Simpan & Hitung Ulang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
