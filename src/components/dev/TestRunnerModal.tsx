import React, { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { MasterTestSummary, TestProgressInfo } from '../../services/test-runner.service';
import { notifySuccess, notifyError } from '../../utils/error.utils';

interface TestRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FilterTab = 'ALL' | 'FAILED' | 'PASSED';

export const TestRunnerModal: React.FC<TestRunnerModalProps> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<MasterTestSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<TestProgressInfo | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSuites, setExpandedSuites] = useState<Record<number, boolean>>({});

  const handleRunTests = async () => {
    setIsRunning(true);
    setError(null);
    setProgress(null);

    try {
      const { MasterTestRunner } = await import('../../services/test-runner.service');
      const res = await MasterTestRunner.runAll((prog) => {
        setProgress(prog);
      });
      setSummary(res);

      // Auto-expand any failed suites so issues are immediately visible
      const newExpanded: Record<number, boolean> = {};
      res.suites.forEach((s, idx) => {
        if (s.failed > 0) {
          newExpanded[idx] = true;
        }
      });
      setExpandedSuites(newExpanded);

      if (res.totalFailed === 0) {
        notifySuccess('Seluruh Test Lulus!', `✅ ${res.totalPassed} tes dari ${res.totalSuites} modul berhasil tanpa kegagalan.`);
      } else {
        notifyError('Ditemukan Kegagalan Test', `❌ ${res.totalFailed} tes gagal dari total ${res.totalPassed + res.totalFailed} assertions.`);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      notifyError('Gagal Menjalankan Test Suite', errMsg);
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  };

  const toggleSuite = (index: number) => {
    setExpandedSuites((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const toggleAllSuites = (expand: boolean) => {
    if (!summary) return;
    const update: Record<number, boolean> = {};
    summary.suites.forEach((_, idx) => {
      update[idx] = expand;
    });
    setExpandedSuites(update);
  };

  const handleCopyReport = () => {
    if (!summary) return;

    const lines: string[] = [];
    lines.push(`# 🧪 SMART ABSENSI GURU - LAPORAN HASIL MASTER TEST RUNNER`);
    lines.push(`**Waktu**: ${new Date().toLocaleString('id-ID')}`);
    lines.push(`**Total Modul**: ${summary.totalSuites}`);
    lines.push(`**Status**: ✅ ${summary.totalPassed} Passed | ❌ ${summary.totalFailed} Failed (${summary.durationMs} ms)`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    summary.suites.forEach((suite, sIdx) => {
      const icon = suite.failed === 0 ? '✅' : '❌';
      lines.push(`### ${icon} Suite ${sIdx + 1}: ${suite.suiteName} (${suite.passed}/${suite.passed + suite.failed} Lulus)`);
      suite.results.forEach((r) => {
        const itemIcon = r.status === 'PASS' ? '✅' : '❌';
        lines.push(`- ${itemIcon} **${r.testName}**${r.details ? ` — _${r.details}_` : ''}`);
      });
      lines.push(``);
    });

    const markdown = lines.join('\n');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(markdown).then(() => {
        notifySuccess('Laporan Disalin!', 'Hasil pengujian format Markdown berhasil disalin ke clipboard.');
      }).catch((err) => {
        notifyError('Gagal Menyalin Laporan', String(err));
      });
    }
  };

  const filteredSuites = useMemo(() => {
    if (!summary) return [];

    return summary.suites
      .map((suite, originalIndex) => ({ suite, originalIndex }))
      .filter(({ suite }) => {
        // Tab filter
        if (activeTab === 'FAILED' && suite.failed === 0) return false;
        if (activeTab === 'PASSED' && suite.failed > 0) return false;

        // Search query filter
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const matchesSuite = suite.suiteName.toLowerCase().includes(q);
        const matchesChildTest = suite.results.some(
          (r) => r.testName.toLowerCase().includes(q) || (r.details && r.details.toLowerCase().includes(q))
        );
        return matchesSuite || matchesChildTest;
      });
  }, [summary, activeTab, searchQuery]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🧪 Dev Suite: Test Runner Otomatis">
      <div className="space-y-4 text-xs text-slate-700">
        {/* Top Control Banner */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md border border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-black text-sm text-emerald-400">Master Test Runner Engine</h4>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px]">
                {summary ? `${summary.totalSuites} Modul` : '54 Modul'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Validasi regresi otomatis seluruh sistem absensi, kalkulasi, keamanan, dan sync.
            </p>
            <p className="text-[10px] text-amber-300 font-semibold flex items-center gap-1">
              <span>🔒</span> Sesi admin & cloud Supabase 100% aman (berjalan di sandbox MockProvider).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {summary && (
              <Button
                variant="outline"
                onClick={handleCopyReport}
                disabled={isRunning}
                className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 text-xs font-bold py-2"
                title="Salin laporan lengkap dalam format Markdown"
              >
                📋 Salin Laporan
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleRunTests}
              disabled={isRunning}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs py-2 px-4 shadow-sm active:scale-95 transition-all"
            >
              {isRunning ? '⏳ Menguji...' : summary ? '🔄 Uji Ulang' : '▶️ Jalankan Test'}
            </Button>
          </div>
        </div>

        {/* Real-time Progress Bar */}
        {isRunning && progress && (
          <div className="bg-slate-950 text-white p-3.5 rounded-2xl border border-slate-800 space-y-2 shadow-inner">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Modul {progress.currentIndex} dari {progress.totalSuites}:
              </span>
              <span className="text-slate-400 font-mono">
                {Math.round((progress.currentIndex / progress.totalSuites) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-linear-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${(progress.currentIndex / progress.totalSuites) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
              <span className="truncate max-w-[70%] text-slate-300 italic">
                {progress.currentSuiteName}
              </span>
              <span className="font-mono">
                Passed: <strong className="text-emerald-400">{progress.totalPassed}</strong> | Failed: <strong className={progress.totalFailed > 0 ? 'text-red-400' : 'text-slate-400'}>{progress.totalFailed}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-2xl flex items-start gap-2.5">
            <span className="text-base shrink-0">⚠️</span>
            <div className="space-y-0.5 text-xs">
              <p className="font-extrabold text-red-900">Terjadi Kesalahan Eksekusi Test Suite</p>
              <p className="text-red-700 font-mono text-[11px]">{error}</p>
            </div>
          </div>
        )}

        {/* Results Summary Dashboard */}
        {summary && (
          <div className="space-y-3">
            {/* Stat Cards */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Passed</p>
                <p className="text-lg font-black text-emerald-800">{summary.totalPassed}</p>
              </div>
              <div className={`p-3 rounded-xl border text-center ${summary.totalFailed > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider">Failed</p>
                <p className="text-lg font-black">{summary.totalFailed}</p>
              </div>
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-center">
                <p className="text-[10px] text-sky-700 font-bold uppercase tracking-wider">Modul</p>
                <p className="text-lg font-black text-sky-800">{summary.totalSuites}</p>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
                <p className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">Durasi</p>
                <p className="text-lg font-black text-purple-800">{summary.durationMs} ms</p>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
              {/* Tab Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('ALL')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${activeTab === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Semua ({summary.suites.length})
                </button>
                <button
                  onClick={() => setActiveTab('FAILED')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${activeTab === 'FAILED' ? 'bg-white text-red-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Gagal ({summary.suites.filter((s) => s.failed > 0).length})
                </button>
                <button
                  onClick={() => setActiveTab('PASSED')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${activeTab === 'PASSED' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Lulus ({summary.suites.filter((s) => s.failed === 0).length})
                </button>
              </div>

              {/* Search & Collapse Controls */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-48">
                  <input
                    type="text"
                    placeholder="Cari test/modul..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-7 pr-6 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="absolute left-2.5 top-2 text-[10px] text-slate-400">🔍</span>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  onClick={() => toggleAllSuites(true)}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-all"
                  title="Buka semua detail modul"
                >
                  Buka
                </button>
                <button
                  onClick={() => toggleAllSuites(false)}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-all"
                  title="Tutup semua detail modul"
                >
                  Tutup
                </button>
              </div>
            </div>

            {/* Test Suites List */}
            <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 rounded-xl">
              {filteredSuites.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 space-y-1">
                  <p className="text-xl">🔍</p>
                  <p className="font-bold text-xs text-slate-600">Tidak ada modul test yang cocok dengan filter</p>
                  <p className="text-[11px]">Silakan ubah tab filter atau kata kunci pencarian Anda.</p>
                </div>
              ) : (
                filteredSuites.map(({ suite, originalIndex }) => {
                  const isExpanded = Boolean(expandedSuites[originalIndex]);
                  const hasFailed = suite.failed > 0;

                  return (
                    <div
                      key={originalIndex}
                      className={`border rounded-2xl transition-all shadow-2xs overflow-hidden ${
                        hasFailed ? 'bg-red-50/30 border-red-200' : 'bg-white border-slate-200'
                      }`}
                    >
                      {/* Suite Header / Accordion trigger */}
                      <button
                        type="button"
                        onClick={() => toggleSuite(originalIndex)}
                        className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="text-sm shrink-0">{hasFailed ? '❌' : '📦'}</span>
                          <span className="font-black text-slate-900 text-xs truncate">
                            {originalIndex + 1}. {suite.suiteName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              !hasFailed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800 animate-pulse'
                            }`}
                          >
                            {suite.passed} / {suite.passed + suite.failed} Lulus
                          </span>
                          <span className="text-xs text-slate-400 transition-transform duration-200">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </button>

                      {/* Suite Results Detail */}
                      {isExpanded && (
                        <div className="p-3 pt-0 border-t border-slate-100 space-y-1.5 bg-slate-50/50">
                          {suite.results.map((res, rIdx) => (
                            <div
                              key={rIdx}
                              className={`p-2 rounded-xl text-[11px] flex items-start gap-2 border ${
                                res.status === 'PASS'
                                  ? 'bg-white border-slate-100 text-slate-800'
                                  : 'bg-red-50 border-red-200 text-red-900'
                              }`}
                            >
                              <span className="shrink-0 mt-0.5">{res.status === 'PASS' ? '✅' : '❌'}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`leading-snug ${res.status === 'PASS' ? 'font-semibold text-slate-800' : 'font-black text-red-700'}`}>
                                  {res.testName}
                                </p>
                                {res.details && (
                                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 break-words">
                                    {res.details}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
