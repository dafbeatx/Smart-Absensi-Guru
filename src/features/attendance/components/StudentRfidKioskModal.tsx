import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { StudentItem, StudentAttendanceRecord } from '../../../types/database.types';
import { StudentRepository } from '../../../repositories/StudentRepository';
import { getCurrentTimeInJakarta, getTodayDateInJakarta } from '../../../utils/time.utils';
import {
  Volume2,
  VolumeX,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  X,
  RefreshCw,
  Smartphone,
  Radio,
  Search,
  Check,
} from 'lucide-react';

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

  // Mobile View Tabs ('SCANNER' | 'FEED')
  const [mobileTab, setMobileTab] = useState<'SCANNER' | 'FEED'>('SCANNER');
  const [feedSearch, setFeedSearch] = useState('');

  // Smartphone Web NFC Support State
  const [isNfcSupported, setIsNfcSupported] = useState(false);
  const [isNfcScanning, setIsNfcScanning] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const nfcAbortControllerRef = useRef<AbortController | null>(null);

  // Keystroke buffer for USB RFID reader (keyboard wedge)
  const keystrokeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const manualInputRef = useRef<HTMLInputElement>(null);

  // Check Web NFC support on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      setIsNfcSupported(true);
    }
  }, []);

  // Web Audio API Synthesizer with AudioContext Unlock
  const playChime = useCallback((type: 'SUCCESS' | 'WARNING' | 'ERROR') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (type === 'SUCCESS') {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        osc1.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc2.frequency.setValueAtTime(783.99, now + 0.1); // G5

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.4);
        osc2.stop(now + 0.4);
      } else if (type === 'WARNING') {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else {
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

  // Haptic feedback vibration for mobile
  const triggerHaptic = useCallback((type: 'SUCCESS' | 'WARNING' | 'ERROR') => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'SUCCESS') {
          navigator.vibrate([60, 40, 60]);
        } else if (type === 'WARNING') {
          navigator.vibrate([100, 50, 100]);
        } else {
          navigator.vibrate([200, 100, 200]);
        }
      } catch {
        // ignore
      }
    }
  }, []);

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
          setStatusMessage(`Sudah Hadir: ${result.student.fullName} (${result.student.className})`);
          playChime('WARNING');
          triggerHaptic('WARNING');
        } else {
          setStatusType('SUCCESS');
          setStatusMessage(`Hadir: ${result.student.fullName} (${result.student.className})`);
          playChime('SUCCESS');
          triggerHaptic('SUCCESS');
          loadTodayTaps();
          if (onAttendanceRecorded) onAttendanceRecorded();
        }
      } else {
        setStatusType('ERROR');
        setStatusMessage(result.message || `Kartu RFID ${cleanUid} belum terdaftar.`);
        playChime('ERROR');
        triggerHaptic('ERROR');
        setLastStudent(null);
        setLastAttendance(null);
      }
    } catch (err: any) {
      setStatusType('ERROR');
      setStatusMessage(`Gagal memproses kartu: ${err?.message || 'Koneksi error'}`);
      playChime('ERROR');
      triggerHaptic('ERROR');
    } finally {
      setIsProcessing(false);
      setManualUid('');
      if (manualInputRef.current) {
        manualInputRef.current.focus();
      }
    }
  }, [isProcessing, selectedSubject, playChime, triggerHaptic, loadTodayTaps, onAttendanceRecorded]);

  // Start Smartphone Web NFC Listening
  const startNfcScanning = useCallback(async () => {
    if (!isNfcSupported) return;
    try {
      setNfcError(null);
      const ndef = new (window as any).NDEFReader();
      const controller = new AbortController();
      nfcAbortControllerRef.current = controller;

      await ndef.scan({ signal: controller.signal });
      setIsNfcScanning(true);

      ndef.onreading = (event: any) => {
        const serial = event.serialNumber;
        if (serial) {
          const cleanSerial = serial.replace(/[: -]/g, '').toUpperCase();
          handleRfidTap(cleanSerial);
        }
      };

      ndef.onreadingerror = () => {
        setNfcError('Gagal membaca kartu NFC. Coba tempel ulang.');
      };
    } catch (err: any) {
      console.warn('NFC scan error:', err);
      setIsNfcScanning(false);
      setNfcError(err?.message || 'Akses NFC ditolak atau dinonaktifkan di setelan HP.');
    }
  }, [isNfcSupported, handleRfidTap]);

  // Stop Smartphone Web NFC Listening
  const stopNfcScanning = useCallback(() => {
    if (nfcAbortControllerRef.current) {
      nfcAbortControllerRef.current.abort();
      nfcAbortControllerRef.current = null;
    }
    setIsNfcScanning(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadTodayTaps();
      // Auto focus manual input for USB reader
      setTimeout(() => {
        if (manualInputRef.current) {
          manualInputRef.current.focus();
        }
      }, 200);

      // Auto start NFC if supported on smartphone
      if (isNfcSupported) {
        startNfcScanning();
      }
    } else {
      stopNfcScanning();
    }
    return () => {
      stopNfcScanning();
    };
  }, [isOpen, isNfcSupported, loadTodayTaps, startNfcScanning, stopNfcScanning]);

  // Global Keyboard Wedge Listener for USB RFID Reader
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
        if (timeSinceLastKey > 200) {
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

  // Filtered Today Taps
  const filteredTodayTaps = todayTaps.filter((t) => {
    if (!feedSearch.trim()) return true;
    const q = feedSearch.toLowerCase();
    return (
      t.studentName.toLowerCase().includes(q) ||
      t.className.toLowerCase().includes(q) ||
      (t.rfidUid && t.rfidUid.toLowerCase().includes(q))
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 md:p-6 animate-fadeIn">
      {/* Container: Fullscreen on mobile (100dvh), centered card on desktop */}
      <div className="bg-[#0A1120] border-0 sm:border sm:border-slate-800 text-white w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[92vh] rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* 1. KIOSK HEADER (TOUCH OPTIMIZED: 44-48PX TARGETS) */}
        <div className="bg-[#023246] px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-500/15 border border-emerald-400/30 rounded-xl sm:rounded-2xl flex items-center justify-center text-emerald-400 shrink-0">
              <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                  Terminal Presensi RFID Siswa 2
                </h2>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-md border border-emerald-400/30 shrink-0">
                  T.A. 2026/2027
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                {isNfcSupported
                  ? 'Sensor NFC Smartphone & USB Reader Siap'
                  : 'USB Keyboard Wedge Reader • Sinkron Otomatis ke GradeMaster'}
              </p>
            </div>
          </div>

          {/* Header Action Buttons (Min 44px Touch Targets) */}
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-slate-200 flex items-center justify-center transition-all cursor-pointer"
              title={soundEnabled ? 'Matikan Nada Audio' : 'Aktifkan Nada Audio'}
              aria-label="Pengaturan Suara"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-red-500/80 active:scale-95 text-slate-200 flex items-center justify-center transition-all cursor-pointer"
              title="Tutup Terminal"
              aria-label="Tutup Terminal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. MOBILE SEGMENTED TABS (VISIBLE ONLY ON MOBILE < MD) */}
        <div className="flex md:hidden bg-slate-900 border-b border-slate-800 p-2 shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => setMobileTab('SCANNER')}
            className={`flex-1 h-10 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileTab === 'SCANNER'
                ? 'bg-[#023246] text-white shadow-2xs border border-cyan-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Scanner Terminal</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('FEED')}
            className={`flex-1 h-10 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileTab === 'FEED'
                ? 'bg-[#023246] text-white shadow-2xs border border-cyan-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>Hadir Hari Ini ({todayTaps.length})</span>
          </button>
        </div>

        {/* 3. MAIN CONTENT BODY: DUAL VIEW (RESPONSIVE GRID) */}
        <div className="p-3.5 sm:p-5 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 overflow-y-auto flex-1">
          
          {/* LEFT COLUMN: SCANNER & CONTROLS */}
          <div
            className={`md:col-span-7 flex flex-col justify-between space-y-4 ${
              mobileTab === 'SCANNER' ? 'flex' : 'hidden md:flex'
            }`}
          >
            {/* TAPPER FEEDBACK BOX */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-65 sm:min-h-75">
              {/* Radar Wave Glow */}
              <div className="absolute -inset-1 bg-linear-to-r from-emerald-500/10 via-cyan-500/10 to-transparent rounded-3xl blur-xl pointer-events-none" />

              {lastStudent ? (
                /* VERIFIED STUDENT CARD */
                <div className="animate-scaleUp flex flex-col items-center space-y-3 z-10 w-full max-w-sm">
                  <div
                    className={`w-18 h-18 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl font-bold shadow-lg border-2 ${
                      lastStudent.gender === 'L'
                        ? 'bg-blue-600 text-white border-blue-300 shadow-blue-500/30'
                        : 'bg-rose-600 text-white border-rose-300 shadow-rose-500/30'
                    }`}
                  >
                    {lastStudent.fullName.charAt(0).toUpperCase()}
                  </div>

                  <div className="space-y-1 w-full">
                    <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                      {lastStudent.fullName}
                    </h3>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
                      <span className="px-2.5 py-0.5 bg-slate-800 text-slate-200 text-xs font-semibold rounded-md border border-slate-700">
                        Kelas {lastStudent.className}
                      </span>
                      <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-md border border-emerald-400/30 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        HADIR ({lastAttendance?.checkInTime || getCurrentTimeInJakarta()})
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 font-mono">
                    UID: {lastStudent.rfidUid || '-'} • Mapel: {lastAttendance?.subject || selectedSubject}
                  </p>
                </div>
              ) : (
                /* IDLE WAITING SCANNER STATE */
                <div className="flex flex-col items-center space-y-3 z-10 text-slate-400">
                  <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shadow-inner">
                    <CreditCard className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400 animate-bounce" />
                  </div>
                  <div className="space-y-1 max-w-xs">
                    <h3 className="text-sm sm:text-base font-bold text-slate-100">
                      Tempelkan Kartu RFID Siswa
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {isNfcSupported && isNfcScanning
                        ? 'Dekatkan kartu ke sensor belakang smartphone ini atau gunakan USB reader.'
                        : 'Dekatkan kartu ke reader USB atau masukkan UID di bawah.'}
                    </p>
                  </div>
                </div>
              )}

              {/* IN-KIOSK STATUS TOAST NOTIFICATION */}
              {statusMessage && (
                <div
                  className={`mt-4 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border z-10 animate-fadeIn max-w-full ${
                    statusType === 'SUCCESS'
                      ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
                      : statusType === 'WARNING'
                      ? 'bg-amber-950/90 text-amber-300 border-amber-500/40'
                      : 'bg-red-950/90 text-red-300 border-red-500/40'
                  }`}
                >
                  {statusType === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  {statusType === 'WARNING' && <Clock className="w-4 h-4 shrink-0" />}
                  {statusType === 'ERROR' && <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span className="truncate">{statusMessage}</span>
                </div>
              )}
            </div>

            {/* CONTROLS CARD: SUBJECT & MANUAL TAP (44-48PX TOUCH ERGONOMICS) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
                {/* Subject Selector */}
                <div className="w-full sm:w-44 shrink-0">
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Sesi / Mata Pelajaran
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
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

                {/* Manual UID Input */}
                <div className="flex-1 w-full">
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    UID Kartu RFID / Sensor Scan
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
                      onChange={(e) => setManualUid(e.target.value.toUpperCase().trim())}
                      placeholder="Tempel kartu atau ketik UID..."
                      className="flex-1 h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={!manualUid.trim() || isProcessing}
                      className="h-11 px-4 bg-[#0D7A5F] hover:bg-[#0D7A5F]/90 active:scale-[0.98] disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0"
                    >
                      {isProcessing ? 'Proses...' : 'Kirim'}
                    </button>
                  </form>
                </div>
              </div>

              {/* SMARTPHONE NFC BANNER (IF SUPPORTED) */}
              {isNfcSupported && (
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-300 font-medium">
                      Sensor NFC Smartphone:
                    </span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        isNfcScanning
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isNfcScanning ? 'Aktif (Siap Tempel)' : 'Nonaktif'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={isNfcScanning ? stopNfcScanning : startNfcScanning}
                    className="text-xs text-cyan-400 font-semibold hover:underline cursor-pointer"
                  >
                    {isNfcScanning ? 'Matikan NFC' : 'Nyalakan NFC'}
                  </button>
                </div>
              )}

              {nfcError && (
                <p className="text-[11px] text-amber-400 font-medium">{nfcError}</p>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: TODAY'S LIVE FEED (SIDE BY SIDE ON DESKTOP, OR TAB 2 ON MOBILE) */}
          <div
            className={`md:col-span-5 bg-slate-950/70 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col min-h-75 ${
              mobileTab === 'FEED' ? 'flex' : 'hidden md:flex'
            }`}
          >
            {/* Live Feed Header */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Riwayat Hadir Hari Ini ({todayTaps.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={loadTodayTaps}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                title="Muat Ulang Riwayat"
                aria-label="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Search inside Live Feed */}
            {todayTaps.length > 5 && (
              <div className="relative mb-2.5 shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={feedSearch}
                  onChange={(e) => setFeedSearch(e.target.value)}
                  placeholder="Cari nama atau kelas siswa..."
                  className="w-full h-9 bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            )}

            {/* Scrollable Live List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-85 md:max-h-95">
              {filteredTodayTaps.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center text-slate-500">
                  <Clock className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
                  <p className="text-xs font-semibold text-slate-400">
                    {todayTaps.length === 0
                      ? 'Belum ada siswa tap hari ini'
                      : 'Siswa tidak ditemukan dalam riwayat'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Data scan kartu akan langsung tampil di sini
                  </p>
                </div>
              ) : (
                filteredTodayTaps.map((tap, idx) => (
                  <div
                    key={tap.id || idx}
                    className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between hover:border-slate-700 transition-all"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-white truncate">
                        {tap.studentName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 text-[10px] font-semibold rounded">
                          Kelas {tap.className}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {tap.checkInTime || '-'}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-md border border-emerald-400/30 shrink-0">
                      Hadir
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 4. KIOSK FOOTER STATUS BAR */}
        <div className="bg-[#050B14] px-4 py-2.5 sm:px-6 sm:py-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-1 sm:gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                Sensor:{' '}
                <strong className="text-slate-200">
                  {isNfcSupported && isNfcScanning ? 'NFC Smartphone' : 'USB Reader / Input'}
                </strong>
              </span>
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="hidden sm:inline">
              Database:{' '}
              <strong className="text-cyan-400">gm_attendance</strong>
            </span>
          </div>
          <span className="font-mono text-slate-500 text-[10px] sm:text-[11px]">
            {getTodayDateInJakarta()}
          </span>
        </div>

      </div>
    </div>
  );
};

