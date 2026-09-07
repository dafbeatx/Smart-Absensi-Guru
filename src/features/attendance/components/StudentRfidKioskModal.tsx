import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { StudentItem, StudentAttendanceRecord } from '../../../types/database.types';
import { StudentRepository } from '../../../repositories/StudentRepository';
import { getCurrentTimeInJakarta, getTodayDateInJakarta } from '../../../utils/time.utils';
import { Volume2, VolumeX, CreditCard, CheckCircle2, AlertCircle, Clock, Users, X, RefreshCw } from 'lucide-react';

interface StudentRfidKioskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAttendanceRecorded?: () => void;
}

export const StudentRfidKioskModal: React.FC<StudentRfidKioskModalProps> = ({
  isOpen,
  onClose,
  onAttendanceRecorded,
}) => {
  const [manualUid, setManualUid] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastStudent, setLastStudent] = useState<StudentItem | null>(null);
  const [lastAttendance, setLastAttendance] = useState<StudentAttendanceRecord | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'SUCCESS' | 'WARNING' | 'ERROR' | null>(null);
  const [todayTaps, setTodayTaps] = useState<StudentAttendanceRecord[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState('Presensi Harian');

  // Keystroke buffer for USB RFID reader (keyboard wedge)
  const keystrokeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const manualInputRef = useRef<HTMLInputElement>(null);

  // Web Audio API Synth Chimes
  const playChime = useCallback((type: 'SUCCESS' | 'WARNING' | 'ERROR') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      if (type === 'SUCCESS') {
        // High, cheerful two-tone chime
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        osc1.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc2.frequency.setValueAtTime(783.99, now + 0.1); // G5

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.4);
        osc2.stop(now + 0.4);
      } else if (type === 'WARNING') {
        // Soft double beep
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else {
        // Low buzz for unknown card
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(160, now + 0.3);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch {
      // Audio context might be restricted
    }
  }, [soundEnabled]);

  // Load today's taps
  const loadTodayTaps = useCallback(async () => {
    try {
      const todayDate = getTodayDateInJakarta();
      const records = await StudentRepository.getStudentAttendance(todayDate, 'ALL', '2026/2027');
      setTodayTaps(records || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadTodayTaps();
      // Keep input focused so USB reader taps directly into it
      if (manualInputRef.current) {
        manualInputRef.current.focus();
      }
    }
  }, [isOpen, loadTodayTaps]);

  // Handle RFID Tap Processing
  const handleRfidTap = useCallback(async (uid: string) => {
    const cleanUid = uid.trim().toUpperCase();
    if (!cleanUid || isProcessing) return;

    setIsProcessing(true);
    try {
      const result = await StudentRepository.recordStudentRfidAttendance(cleanUid, selectedSubject);

      if (result.success && result.student && result.attendance) {
        setLastStudent(result.student);
        setLastAttendance(result.attendance);

        if (result.isDuplicate) {
          setStatusType('WARNING');
          setStatusMessage(`Kartu sudah tercatat hadir: ${result.student.fullName} (${result.student.className})`);
          playChime('WARNING');
        } else {
          setStatusType('SUCCESS');
          setStatusMessage(`Hadir Tercatat: ${result.student.fullName} (${result.student.className})`);
          playChime('SUCCESS');
          loadTodayTaps();
          if (onAttendanceRecorded) onAttendanceRecorded();
        }
      } else {
        setStatusType('ERROR');
        setStatusMessage(result.message || `Kartu RFID ${cleanUid} belum terdaftar.`);
        playChime('ERROR');
        setLastStudent(null);
        setLastAttendance(null);
      }
    } catch (err: any) {
      setStatusType('ERROR');
      setStatusMessage(`Gagal memproses kartu: ${err?.message || 'Koneksi error'}`);
      playChime('ERROR');
    } finally {
      setIsProcessing(false);
      setManualUid('');
      if (manualInputRef.current) {
        manualInputRef.current.focus();
      }
    }
  }, [isProcessing, selectedSubject, playChime, loadTodayTaps, onAttendanceRecorded]);

  // Global Keyboard Wedge Listener for USB RFID Reader
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere if typing into subject or standard search
      if (e.target instanceof HTMLSelectElement) return;

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const buffered = keystrokeBufferRef.current.trim();
        keystrokeBufferRef.current = '';
        if (buffered.length >= 3) {
          e.preventDefault();
          handleRfidTap(buffered);
        }
      } else if (e.key.length === 1) {
        // Fast burst typing is typical for hardware RFID scanners
        if (timeSinceLastKey > 200) {
          // Reset buffer if delay too long (likely manual slow typing elsewhere)
          keystrokeBufferRef.current = e.key;
        } else {
          keystrokeBufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleRfidTap]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Kiosk */}
        <div className="bg-[#023246] px-6 py-4 flex items-center justify-between border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-emerald-500/20 border border-emerald-400/40 rounded-2xl flex items-center justify-center text-emerald-400 shrink-0">
              <CreditCard className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2 text-white">
                Terminal Presensi RFID Siswa
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-md border border-emerald-400/30">
                  2026/2027
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium">
                Tap kartu RFID siswa pada USB reader • Langsung tersinkron ke Web Input Nilai
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-all cursor-pointer"
              title={soundEnabled ? 'Matikan Suara Beep' : 'Nyalakan Suara Beep'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-red-500/80 text-slate-200 transition-all cursor-pointer"
              title="Tutup Terminal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto flex-1">
          {/* Left Column: Tapper Area */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-6">
            {/* Tapper Card Feedback Box */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-75">
              {/* Scan Wave Animation */}
              <div className="absolute -inset-1 bg-linear-to-r from-emerald-500/10 via-cyan-500/10 to-transparent rounded-3xl blur-xl pointer-events-none" />

              {lastStudent ? (
                <div className="animate-scaleUp flex flex-col items-center space-y-3 z-10">
                  <div className="w-20 h-20 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-3xl font-black shadow-lg shadow-emerald-500/30 border-2 border-emerald-300">
                    {lastStudent.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-white tracking-tight">
                      {lastStudent.fullName}
                    </h3>
                    <div className="flex items-center justify-center gap-2 mt-1.5">
                      <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs font-bold rounded-lg border border-cyan-500/30">
                        Kelas {lastStudent.className}
                      </span>
                      <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        HADIR ({lastAttendance?.checkInTime || getCurrentTimeInJakarta()})
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    UID: {lastStudent.rfidUid} • Mapel: {lastAttendance?.subject || selectedSubject}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3 z-10 text-slate-400">
                  <div className="w-20 h-20 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-500">
                    <CreditCard className="w-10 h-10 animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-200">
                      Silakan Tempelkan Kartu RFID
                    </h3>
                    <p className="text-xs text-slate-400 max-w-xs">
                      Dekatkan kartu siswa ke sensor reader USB. Sistem otomatis memproses kehadiran.
                    </p>
                  </div>
                </div>
              )}

              {/* Status Alert Toast in Kiosk */}
              {statusMessage && (
                <div
                  className={`mt-4 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border z-10 animate-fadeIn ${
                    statusType === 'SUCCESS'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                      : statusType === 'WARNING'
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                      : 'bg-red-950/80 text-red-300 border-red-500/40'
                  }`}
                >
                  {statusType === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  {statusType === 'WARNING' && <Clock className="w-4 h-4 shrink-0" />}
                  {statusType === 'ERROR' && <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>

            {/* Input & Options Control */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Input Manual / Scan Reader
                  </label>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRfidTap(manualUid);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      ref={manualInputRef}
                      type="text"
                      value={manualUid}
                      onChange={(e) => setManualUid(e.target.value)}
                      placeholder="Tempel kartu atau ketik UID..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <button
                      type="submit"
                      disabled={!manualUid.trim() || isProcessing}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0"
                    >
                      {isProcessing ? 'Memproses...' : 'Kirim Tap'}
                    </button>
                  </form>
                </div>

                <div className="w-44">
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Mata Pelajaran / Sesi
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="Presensi Harian">Presensi Harian</option>
                    <option value="Informatika">Informatika</option>
                    <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                    <option value="Bahasa Inggris">Bahasa Inggris</option>
                    <option value="Matematika">Matematika</option>
                    <option value="IPA">IPA</option>
                    <option value="IPS">IPS</option>
                    <option value="PAI">PAI</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Today's Live Feed */}
          <div className="md:col-span-5 bg-slate-950/60 border border-slate-800 rounded-3xl p-5 flex flex-col min-h-75">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                  Daftar Hadir Hari Ini ({todayTaps.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={loadTodayTaps}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Refresh Daftar"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-90">
              {todayTaps.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center text-slate-500">
                  <Clock className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-xs font-semibold">Belum ada siswa yang tap hari ini</p>
                  <p className="text-[10px] text-slate-600">Absensi baru akan muncul di sini</p>
                </div>
              ) : (
                todayTaps.map((tap, idx) => (
                  <div
                    key={tap.id || idx}
                    className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-3 flex items-center justify-between hover:border-slate-700 transition-all"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-extrabold text-white truncate">
                        {tap.studentName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 text-[9px] font-bold rounded">
                          {tap.className}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {tap.checkInTime || tap.createdAt?.slice(11, 19) || '-'}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-lg border border-emerald-500/30 shrink-0">
                      Hadir
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-4">
            <span>● Status Reader: <strong className="text-emerald-400">Siap Mendeteksi Keystroke</strong></span>
            <span>● Database: <strong className="text-cyan-400">gm_attendance (Supabase)</strong></span>
          </div>
          <span className="font-mono text-slate-500">
            {getTodayDateInJakarta()}
          </span>
        </div>
      </div>
    </div>
  );
};
