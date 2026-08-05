import React, { useState } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { canAccessDevTestMode } from '../../../utils/dev-test.utils';
import { DevTestRunnerService } from '../../../services/dev-test-runner.service';
import type { DevTestItemResult, DevTestRunSummary } from '../../../services/dev-test-runner.service';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { AttendanceRepository } from '../../../repositories/AttendanceRepository';
import { CONSTANTS } from '../../../config/constants';
import { notifySuccess, notifyError, notifyWarning } from '../../../utils/error.utils';
import { logger } from '../../../utils/logger.utils';

export const DevTestPage: React.FC<{ onBackToDashboard?: () => void }> = ({ onBackToDashboard }) => {
  const { user, token, deviceUUID } = useAuthStore();
  const [isRunning, setIsRunning] = useState(false);
  const [testItems, setTestItems] = useState<DevTestItemResult[]>([]);
  const [lastSummary, setLastSummary] = useState<DevTestRunSummary | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isDummyConfirmOpen, setIsDummyConfirmOpen] = useState(false);
  const [isSavingDummy, setIsSavingDummy] = useState(false);

  // Security Guard: Restrict access to ADMIN/OPERATOR in DEV or test mode env
  if (!canAccessDevTestMode(user)) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-4">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 border border-red-500/40 rounded-full flex items-center justify-center text-3xl mx-auto">
            🚫
          </div>
          <h2 className="text-xl font-black text-white">404 — Halaman Tidak Ditemukan / Akses Ditolak</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Mode Tes Developer hanya diizinkan untuk akun Admin/Operator pada lingkungan pengujian developer. Role Guru atau sesi tidak sah tidak memiliki akses.
          </p>
          {onBackToDashboard && (
            <Button variant="primary" className="w-full" onClick={onBackToDashboard}>
              Kembali ke Dashboard
            </Button>
          )}
        </div>
      </div>
    );
  }

  const handleRunAllTests = async () => {
    setIsRunning(true);
    logger.info('DevTestPage', 'User initiated full diagnostic test suite run');

    try {
      const summary = await DevTestRunnerService.runDiagnostics(user, (updatedItems) => {
        setTestItems(updatedItems);
      });
      setLastSummary(summary);
      notifySuccess('Diagnostik Selesai', `✅ ${summary.totalPassed} Passed | ⚠️ ${summary.totalWarnings} Warning | ❌ ${summary.totalFailed} Failed`);
    } catch (err) {
      logger.error('DevTestPage', 'Error running test suite:', err);
      notifyError('Gagal Menjalankan Tes', String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyReport = () => {
    if (!lastSummary) {
      notifyWarning('Belum Ada Laporan', 'Silakan jalankan tes terlebih dahulu sebelum menyalin laporan.');
      return;
    }

    const markdown = DevTestRunnerService.generateMarkdownReport(lastSummary, user);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(markdown).then(() => {
        notifySuccess('Laporan Tes Disalin!', 'Laporan format Markdown siap ditempel ke dokumentasi.');
      }).catch((err) => {
        notifyError('Gagal Menyalin Laporan', String(err));
      });
    }
  };

  const handleConfirmSaveDummy = async () => {
    setIsSavingDummy(true);
    logger.info('DevTestPage', 'User confirmed dummy test attendance save');

    try {
      const dummyRes = await AttendanceRepository.scanAttendance({
        token: token || 'DEV_TEST_TOKEN',
        qr_seed: `DEV_TEST_QR_${Date.now()}`,
        user_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
        user_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
        device_uuid: deviceUUID || 'DEV_TEST_UUID',
      });

      logger.info('DevTestPage', 'Dummy attendance record saved:', dummyRes);
      notifySuccess('Absensi Dummy Berhasil Disimpan!', `Status: ${dummyRes.status} | Time: ${dummyRes.timestamp}`);
      window.dispatchEvent(new Event('smart_absensi_scanned'));
      setIsDummyConfirmOpen(false);
    } catch (err: unknown) {
      logger.error('DevTestPage', 'Failed to save dummy test attendance:', err);
      notifyError('Gagal Simpan Absensi Dummy', String(err));
    } finally {
      setIsSavingDummy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="bg-amber-500/15 border-2 border-amber-500/40 p-5 rounded-3xl text-amber-200 space-y-2 relative overflow-hidden shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-amber-300 text-sm">
            <span>⚠️</span> MODE TES DEVELOPER — JANGAN GUNAKAN UNTUK ABSENSI NYATA
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full uppercase">
              DEV TEST
            </span>
            <span className="px-2.5 py-1 bg-slate-900/60 text-amber-300 text-[10px] font-bold rounded-full border border-amber-500/30">
              Admin/Operator Only
            </span>
          </div>
        </div>
        <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
          Panel ini digunakan khusus oleh pengembang dan administrator sekolah untuk menguji seluruh fungsi sistem (kamera, GPS, QR Code, Supabase, dan Event Dispatcher) sebelum dipublikasikan ke guru.
        </p>
      </div>

      {/* Control Buttons Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Panel Diagnostik Siap Luncur (Readiness Test)</h2>
          <p className="text-xs text-slate-500">Jalankan pengujian diagnostik otomatis untuk memverifikasi kesehatan sistem.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onBackToDashboard && (
            <Button variant="secondary" onClick={onBackToDashboard} className="text-xs">
              ← Kembali
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => setIsDummyConfirmOpen(true)}
            className="text-xs font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
          >
            🧪 Tes Simpan Dummy
          </Button>
          {lastSummary && (
            <Button variant="secondary" onClick={handleCopyReport} className="text-xs">
              📋 Salin Laporan
            </Button>
          )}
          <Button variant="primary" onClick={handleRunAllTests} isLoading={isRunning} className="text-xs font-black shadow-md">
            ⚡ Jalankan Semua Tes
          </Button>
        </div>
      </div>

      {/* Test Results Summary Banner */}
      {lastSummary && (
        <div className="bg-slate-900 text-white p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-slate-200">Hasil Diagnostik Terakhir ({lastSummary.timestamp})</h3>
            <p className="text-xs text-slate-400">Total Durasi Pengujian: {lastSummary.durationMs}ms</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-2xl text-xs font-extrabold flex items-center gap-1.5">
              <span>✅</span> {lastSummary.totalPassed} Passed
            </div>
            <div className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-2xl text-xs font-extrabold flex items-center gap-1.5">
              <span>⚠️</span> {lastSummary.totalWarnings} Warning
            </div>
            <div className="bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-2xl text-xs font-extrabold flex items-center gap-1.5">
              <span>❌</span> {lastSummary.totalFailed} Failed
            </div>
          </div>
        </div>
      )}

      {/* Test Items Checklist Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
        <div className="bg-slate-50 p-4 font-extrabold text-xs text-slate-700 flex justify-between items-center">
          <span>CHECKLIST pengujian SISTEM</span>
          <span>{testItems.length > 0 ? `${testItems.filter((i) => i.status === 'passed').length}/${testItems.length} Lulus` : 'Belum Dijalankan'}</span>
        </div>

        {testItems.length === 0 ? (
          <div className="p-10 text-center text-slate-400 space-y-2">
            <div className="text-3xl">🧪</div>
            <p className="text-xs font-bold text-slate-600">Tes Belum Dijalankan</p>
            <p className="text-xs">Klik tombol "⚡ Jalankan Semua Tes" untuk memulai verifikasi kesehatan web app.</p>
          </div>
        ) : (
          testItems.map((item, idx) => {
            const isExpanded = expandedIndex === idx;
            return (
              <div key={item.id} className="p-4 hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center justify-between gap-3 cursor-pointer" onClick={() => setExpandedIndex(isExpanded ? null : idx)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                      item.status === 'passed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.status === 'warning'
                        ? 'bg-amber-100 text-amber-700'
                        : item.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : item.status === 'running'
                        ? 'bg-blue-100 text-blue-700 animate-pulse'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {item.status === 'passed' ? '✓' : item.status === 'warning' ? '!' : item.status === 'failed' ? '✕' : item.status === 'running' ? '⏳' : '•'}
                    </div>

                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">{item.name}</h4>
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5">{item.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-slate-400">{item.durationMs}ms</span>
                    <span className="text-xs text-slate-400">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isExpanded && item.details && (
                  <div className="mt-3 p-3.5 bg-slate-900 rounded-2xl text-slate-300 font-mono text-[11px] overflow-x-auto space-y-1">
                    <p className="text-[10px] text-emerald-400 font-bold">// Detail Teknis (Sanitized):</p>
                    <pre>{JSON.stringify(item.details, null, 2)}</pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal for Dummy Test Record */}
      <Modal isOpen={isDummyConfirmOpen} onClose={() => setIsDummyConfirmOpen(false)} title="🧪 Tes Simpan Absensi Dummy">
        <div className="space-y-4 py-2 text-center">
          <div className="w-14 h-14 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto border border-purple-200">
            📝
          </div>

          <div className="space-y-1">
            <h3 className="font-extrabold text-slate-900 text-base">Konfirmasi Simpan Absensi Dummy</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Tindakan ini akan membuat satu catatan absensi uji coba dengan penanda khusus <code>DEV_TEST</code> untuk memastikan sinkronisasi database dan dashboard refresh berjalan normal.
            </p>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <Button variant="secondary" className="w-1/2" onClick={() => setIsDummyConfirmOpen(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              className="w-1/2 bg-purple-600 hover:bg-purple-700 border-purple-600"
              isLoading={isSavingDummy}
              onClick={handleConfirmSaveDummy}
            >
              Ya, Simpan Dummy
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
