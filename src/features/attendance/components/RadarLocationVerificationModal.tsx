import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigation, Radio, CheckCircle2, Satellite } from 'lucide-react';

export interface RadarLocationVerificationModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onLockGreen?: () => void;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  distanceMeters?: number;
  allowedRadiusMeters?: number;
  teacherName?: string;
  action?: 'CHECK_IN' | 'CHECK_OUT';
}

type RadarStage = 'SCANNING' | 'ACQUIRING' | 'LOCKED_GREEN';

export const RadarLocationVerificationModal: React.FC<RadarLocationVerificationModalProps> = ({
  isOpen,
  onComplete,
  onLockGreen,
  latitude = -6.613144,
  longitude = 106.812345,
  accuracy = 12,
  distanceMeters = 18,
  allowedRadiusMeters = 150,
  teacherName = 'Guru',
  action = 'CHECK_IN',
}) => {
  const [stage, setStage] = useState<RadarStage>('SCANNING');
  const [progress, setProgress] = useState(25);

  useEffect(() => {
    if (!isOpen) {
      setStage('SCANNING');
      setProgress(25);
      return;
    }

    // Step 1: Scanning (0 - 750ms)
    setStage('SCANNING');
    setProgress(35);

    // Step 2: Acquiring Geofence Lock (750ms)
    const t1 = setTimeout(() => {
      setStage('ACQUIRING');
      setProgress(75);
    }, 750);

    // Step 3: STATUS HIJAU (LOCKED_GREEN) (1500ms) - Target Terkunci & Validasi Beres
    const t2 = setTimeout(() => {
      setStage('LOCKED_GREEN');
      setProgress(100);
      onLockGreen?.();
    }, 1500);

    // Step 4: Completion callback (2350ms) - Langsung tampilkan hasil presensi
    const t3 = setTimeout(() => {
      onComplete();
    }, 2350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isOpen, onComplete, onLockGreen]);

  if (!isOpen) return null;

  const isGreen = stage === 'LOCKED_GREEN';

  // Format koordinat GPS rapi untuk telemetry HUD
  const formattedLat = typeof latitude === 'number' ? latitude.toFixed(6) : '-6.613144';
  const formattedLng = typeof longitude === 'number' ? longitude.toFixed(6) : '106.812345';
  const effectiveDist = Math.round(distanceMeters || 15);
  const effectiveRadius = Math.round(allowedRadiusMeters || 150);

  const modalContent = (
    <div className="fixed inset-0 z-99999 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      {/* Container Box: Dark Modern Cockpit Navy */}
      <div className="w-full max-w-sm sm:max-w-md bg-linear-to-b from-[#022332] via-[#023246] to-[#011B26] border border-cyan-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden text-white space-y-4">
        
        {/* Ambient Top Glow */}
        <div
          className={`absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
            isGreen ? 'bg-emerald-500/30' : 'bg-cyan-500/20'
          }`}
        />

        {/* ── 1. HEADER HUD ── */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg border transition-colors duration-500 ${
              isGreen ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
            }`}>
              <Satellite className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-wider uppercase text-cyan-300 font-bold block">
                SAGA GEOFENCE RADAR v2.6
              </span>
              <h3 className="text-xs font-bold text-slate-200">
                Pengecekan Lokasi Presensi
              </h3>
            </div>
          </div>

          <div className="text-right">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide border uppercase transition-all duration-500 ${
              action === 'CHECK_OUT' 
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-teal-500/20 border-teal-400 text-teal-300'
            }`}>
              {action === 'CHECK_OUT' ? 'Pulang' : 'Masuk'}
            </span>
            <p className="text-[9px] font-mono text-slate-400 mt-0.5 truncate max-w-27.5">
              {teacherName}
            </p>
          </div>
        </div>

        {/* ── 2. THE RADAR SCOPE DISPLAY ── */}
        <div className="relative w-56 h-56 sm:w-64 sm:h-64 mx-auto flex items-center justify-center">
          {/* Radar Background & Outer Glow */}
          <div className={`absolute inset-0 rounded-full border-2 transition-all duration-700 ${
            isGreen 
              ? 'border-emerald-400/80 shadow-[0_0_35px_rgba(16,185,129,0.35)] bg-emerald-950/20' 
              : 'border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.2)] bg-[#011a24]/80'
          }`} />

          {/* Range Ring 1: Inner (25%) */}
          <div className="absolute inset-8 sm:inset-10 rounded-full border border-cyan-500/20 pointer-events-none" />
          
          {/* Range Ring 2: Middle (50%) */}
          <div className="absolute inset-16 sm:inset-20 rounded-full border border-cyan-500/25 pointer-events-none" />

          {/* Crosshair Axes */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-cyan-500/20 pointer-events-none" />
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-cyan-500/20 pointer-events-none" />

          {/* Cardinal Direction Marks */}
          <span className="absolute top-1.5 text-[8px] font-mono font-bold text-cyan-400/60">U</span>
          <span className="absolute bottom-1.5 text-[8px] font-mono font-bold text-cyan-400/60">S</span>
          <span className="absolute left-1.5 text-[8px] font-mono font-bold text-cyan-400/60">B</span>
          <span className="absolute right-1.5 text-[8px] font-mono font-bold text-cyan-400/60">T</span>

          {/* The Rotating Radar Beam Sweep */}
          <div
            className={`absolute inset-1 rounded-full animate-radar-sweep pointer-events-none transition-opacity duration-500 ${
              isGreen ? 'opacity-80' : 'opacity-90'
            }`}
            style={{
              background: isGreen
                ? 'conic-gradient(from 0deg, rgba(16, 185, 129, 0.45) 0deg, rgba(16, 185, 129, 0.12) 50deg, transparent 60deg)'
                : 'conic-gradient(from 0deg, rgba(6, 182, 212, 0.4) 0deg, rgba(6, 182, 212, 0.1) 50deg, transparent 60deg)',
            }}
          />

          {/* Center Marker: School Base Station Anchor */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-500 flex items-center justify-center shadow-xs ${
              isGreen ? 'bg-emerald-400 border-white shadow-emerald-400' : 'bg-cyan-400 border-slate-900 shadow-cyan-400'
            }`}>
              <div className="w-1 h-1 rounded-full bg-slate-900" />
            </div>
            <span className="text-[8px] font-mono font-black text-cyan-200 mt-1 tracking-tighter bg-slate-950/80 px-1 rounded">
              SEKOLAH
            </span>
          </div>

          {/* Target Blip: Teacher's Physical GPS Position */}
          <div
            className="absolute z-20 transition-all duration-700 flex flex-col items-center"
            style={{
              top: '32%',
              left: '64%',
            }}
          >
            {/* Pinging Wave */}
            <div
              className={`absolute -inset-2 rounded-full pointer-events-none animate-radar-ping ${
                isGreen ? 'bg-emerald-400/70' : 'bg-amber-400/70'
              }`}
            />
            {/* Target Dot / Lock Reticle */}
            <div
              className={`relative w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-500 shadow-md ${
                isGreen
                  ? 'bg-emerald-500 border-white text-white shadow-emerald-400/80 scale-110'
                  : 'bg-amber-400 border-amber-200 text-slate-900 animate-pulse'
              }`}
            >
              {isGreen ? (
                <CheckCircle2 className="w-3 h-3 text-white stroke-3" />
              ) : (
                <Navigation className="w-2.5 h-2.5 -rotate-45" />
              )}
            </div>

            <div className="mt-1 px-1.5 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[8px] font-mono font-extrabold whitespace-nowrap shadow-sm">
              <span className={isGreen ? 'text-emerald-300' : 'text-amber-300'}>
                {effectiveDist}m
              </span>
            </div>
          </div>
        </div>

        {/* ── 3. STATUS PILL (BERUBAH KE HIJAU SAAT LOKASI TERKUNCI) ── */}
        <div
          className={`py-2.5 px-3.5 rounded-2xl border transition-all duration-500 flex items-center justify-center gap-2 text-center ${
            isGreen
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-lg shadow-emerald-500/20 animate-pulse'
              : stage === 'ACQUIRING'
              ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200'
              : 'bg-slate-800/60 border-slate-700 text-slate-300'
          }`}
        >
          {isGreen ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
              <div className="text-left">
                <p className="text-xs font-black tracking-wide text-emerald-300">
                  STATUS: HIJAU • LOKASI TERVERIFIKASI
                </p>
                <p className="text-[10px] text-emerald-200/80 font-medium">
                  Titik presensi sah di dalam radius sekolah ({effectiveDist}m ≤ {effectiveRadius}m)
                </p>
              </div>
            </>
          ) : (
            <>
              <Radio className="w-4 h-4 text-cyan-400 shrink-0 animate-spin" />
              <div className="text-left">
                <p className="text-xs font-black tracking-wide text-cyan-300">
                  {stage === 'ACQUIRING'
                    ? 'MENGUNCI RADIUS GEOFENCE...'
                    : 'MEMINDAI SINYAL SATELIT GPS...'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  Sinkronisasi koordinat fisik &amp; radius presensi sekolah
                </p>
              </div>
            </>
          )}
        </div>

        {/* ── 4. LIVE TELEMETRY HUD BOX ── */}
        <div className="p-3 rounded-2xl bg-black/40 border border-cyan-500/20 font-mono text-[10px] space-y-1.5 text-slate-300">
          <div className="flex justify-between items-center text-cyan-400/90 border-b border-white/5 pb-1">
            <span>TELEMETRI KOORDINAT</span>
            <span className="flex items-center gap-1 font-bold">
              <span className={`w-1.5 h-1.5 rounded-full ${isGreen ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`} />
              {isGreen ? 'TERKUNCI' : 'PELACAKAN'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div>
              <span className="text-[9px] text-slate-500 block">Koordinat Lat/Lng:</span>
              <span className="text-slate-200 font-bold truncate block">
                {formattedLat}, {formattedLng}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block">Akurasi GPS HP:</span>
              <span className="text-slate-200 font-bold">
                ±{Math.round(accuracy)} meter
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block">Jarak Fisik:</span>
              <span className={isGreen ? 'text-emerald-400 font-extrabold' : 'text-cyan-300 font-bold'}>
                {effectiveDist} meter
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block">Radius Diizinkan:</span>
              <span className="text-slate-200 font-bold">
                Maksimal {effectiveRadius}m
              </span>
            </div>
          </div>
        </div>

        {/* ── 5. PROGRESS LINEAR BAR ── */}
        <div className="space-y-1">
          <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden border border-cyan-500/20">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                isGreen
                  ? 'bg-linear-to-r from-emerald-400 to-teal-300'
                  : 'bg-linear-to-r from-cyan-500 to-teal-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>Inisiasi</span>
            <span className={isGreen ? 'text-emerald-400 font-bold' : 'text-cyan-400'}>
              {isGreen ? 'Presensi Selesai' : 'Verifikasi...'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
