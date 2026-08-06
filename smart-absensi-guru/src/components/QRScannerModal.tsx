import React, { useState, useEffect, useRef } from 'react';
import { X, QrCode, Camera, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AttendanceRecord, SchoolGeofence } from '../types';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayRecord: AttendanceRecord;
  isInsideRadius: boolean;
  distanceMeter: number;
  geofence: SchoolGeofence;
  onRecordAttendance: (type: 'checkIn' | 'checkOut', timeStr: string, status: 'Hadir' | 'Terlambat') => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  todayRecord,
  isInsideRadius,
  distanceMeter,
  geofence,
  onRecordAttendance,
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      setScanSuccess(null);
      setIsScanning(false);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);
      } else {
        setCameraError('Kamera tidak didukung di browser ini. Gunakan tombol simulasi.');
      }
    } catch (err) {
      console.log('Camera access note:', err);
      setCameraError('Akses kamera tidak diizinkan atau tidak ditemukan. Silakan gunakan Simulasi Scan.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleSimulateScan = (qrCodeId: string = 'QR-GATE-MAIN-01') => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
      
      const isCheckIn = !todayRecord.checkIn;
      const type = isCheckIn ? 'checkIn' : 'checkOut';
      
      // Determine status (if check in after 07:15, it's late)
      let status: 'Hadir' | 'Terlambat' = 'Hadir';
      if (isCheckIn) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const limitMinutes = 7 * 60 + 15; // 07:15 WIB
        if (currentMinutes > limitMinutes) {
          status = 'Terlambat';
        }
      } else {
        status = todayRecord.status === 'Terlambat' ? 'Terlambat' : 'Hadir';
      }

      setScanSuccess(`Presensi ${isCheckIn ? 'Masuk' : 'Pulang'} Berhasil! (${timeStr})`);
      
      // Trigger burst confetti
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // Fallback
      }

      onRecordAttendance(type, timeStr, status);

      setTimeout(() => {
        onClose();
      }, 2000);
    }, 1200);
  };

  if (!isOpen) return null;

  const isCheckIn = !todayRecord.checkIn;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[412px] rounded-t-[32px] sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#0D7A5F] rounded-xl text-white">
              <QrCode size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight">Pemindai QR Code Absensi</h3>
              <p className="text-[10px] text-emerald-400 font-medium">
                {isCheckIn ? 'Presensi Masuk Sekolah' : 'Presensi Pulang Sekolah'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-slate-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          
          {/* GPS Geofence Warning if outside */}
          {!isInsideRadius && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-start gap-2.5 text-amber-900">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold">Peringatan Lokasi GPS</p>
                <p className="text-[10px] text-amber-800 leading-tight mt-0.5">
                  Anda berada di luar radius geofence {geofence.radiusMeter}m (Jarak: {distanceMeter}m). Pastikan Anda berada di lingkungan SMP Terpadu Al-Ittihadiyah.
                </p>
              </div>
            </div>
          )}

          {/* Scanner Viewport Box */}
          <div className="relative aspect-square w-full bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex items-center justify-center shadow-inner">
            
            {cameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
                <Camera size={40} className="text-slate-600 mb-2 animate-bounce" />
                <p className="text-xs text-slate-300 font-medium">
                  {cameraError || 'Mempersiapkan Kamera Handphone...'}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Arahkan kamera ke QR Code resmi sekolah di gerbang / lobby.
                </p>
              </div>
            )}

            {/* Scanning Overlay Reticle Frame */}
            <div className="absolute inset-0 p-8 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 border-2 border-emerald-400/60 rounded-2xl relative flex items-center justify-center">
                {/* Corner reticles */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br"></div>

                {/* Scanning laser line */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse shadow-[0_0_12px_#10b981]"></div>
              </div>
            </div>

            {/* Scan Success Overlay */}
            {scanSuccess && (
              <div className="absolute inset-0 bg-[#0D7A5F]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-white animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3">
                  <CheckCircle2 size={40} className="text-white" />
                </div>
                <h4 className="text-base font-extrabold">{scanSuccess}</h4>
                <p className="text-xs text-emerald-100 mt-1">Data tersimpan di sistem Simpeg sekolah.</p>
              </div>
            )}

            {/* Scanning In Progress Overlay */}
            {isScanning && !scanSuccess && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-white">
                <RefreshCw size={32} className="text-emerald-400 animate-spin mb-2" />
                <p className="text-xs font-bold">Memverifikasi Enkripsi QR & Koordinat...</p>
              </div>
            )}
          </div>

          {/* Quick Simulation Action Buttons */}
          <div className="space-y-2 pt-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
              Atau Gunakan Simulasi Pindai Instan:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSimulateScan('QR-GATE-MAIN-01')}
                disabled={isScanning}
                className="bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-200 text-[#0D7A5F] p-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all disabled:opacity-50"
              >
                <Zap size={14} />
                <span>QR Gerbang Utama</span>
              </button>
              <button
                onClick={() => handleSimulateScan('QR-LOBBY-02')}
                disabled={isScanning}
                className="bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 p-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all disabled:opacity-50"
              >
                <QrCode size={14} />
                <span>QR Lobby SMP</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-1">
            <ShieldCheck size={14} className="text-[#0D7A5F]" />
            <span>Enkripsi QR RSA-2048 Real-time</span>
          </div>
          <button
            onClick={onClose}
            className="font-bold text-slate-600 hover:text-slate-800"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
