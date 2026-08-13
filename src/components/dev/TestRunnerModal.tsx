import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { MasterTestRunner } from '../../services/test-runner.service';
import type { MasterTestSummary } from '../../services/test-runner.service';

interface TestRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestRunnerModal: React.FC<TestRunnerModalProps> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<MasterTestSummary | null>(null);

  const handleRunTests = async () => {
    setIsRunning(true);
    try {
      const res = await MasterTestRunner.runAll();
      setSummary(res);
    } catch (err) {
      console.error('Failed to run test suite:', err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🧪 Dev Suite: Test Runner Otomatis">
      <div className="space-y-4 text-xs text-slate-700">
        <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <h4 className="font-bold text-sm text-emerald-400">Unit Test Suite Validator</h4>
            <p className="text-[11px] text-slate-300">
              Menjalankan {summary ? summary.totalSuites : 9} modul pengujian otomatis dalam sandbox terisolasi.
            </p>
            <p className="text-[10px] text-amber-300 font-semibold mt-0.5">
              🔒 Sesi login Anda tetap aman — test berjalan di sandbox MockProvider.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={handleRunTests}
            disabled={isRunning}
            className="shrink-0 bg-emerald-500 hover:bg-emerald-600 font-extrabold"
          >
            {isRunning ? '⏳ Menguji...' : '▶️ Jalankan Test'}
          </Button>
        </div>

        {summary && (
          <div className="space-y-3">
            {/* Header Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <p className="text-[10px] text-emerald-700 font-bold uppercase">Passed</p>
                <p className="text-xl font-extrabold text-emerald-800">{summary.totalPassed}</p>
              </div>
              <div className={`p-3 rounded-xl border text-center ${summary.totalFailed > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                <p className="text-[10px] font-bold uppercase">Failed</p>
                <p className="text-xl font-extrabold">{summary.totalFailed}</p>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
                <p className="text-[10px] text-purple-700 font-bold uppercase">Waktu</p>
                <p className="text-xl font-extrabold text-purple-800">{summary.durationMs} ms</p>
              </div>
            </div>

            {/* Test Suites List */}
            <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
              {summary.suites.map((suite, idx) => (
                <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                    <span>📦 {suite.suiteName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${suite.failed === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {suite.passed} / {suite.passed + suite.failed} Lulus
                    </span>
                  </div>

                  <div className="space-y-1 pl-1 pt-1">
                    {suite.results.map((res, rIdx) => (
                      <div key={rIdx} className="flex items-start gap-1.5 text-[11px]">
                        <span className="shrink-0">{res.status === 'PASS' ? '✅' : '❌'}</span>
                        <span className={res.status === 'PASS' ? 'text-slate-800 font-medium' : 'text-red-600 font-bold'}>
                          {res.testName}
                          {res.details && <span className="text-[10px] text-slate-400 ml-1">({res.details})</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
