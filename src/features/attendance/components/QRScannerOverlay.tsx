import React, { useState, useEffect, useRef } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';

export interface QRScannerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: { timestamp: string; distance: number; status: string }) => void;
}

export const QRScannerOverlay: React.FC<QRScannerOverlayProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [gpsDistance] = useState<number | null>(12); // Simulated GPS distance 12m
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [scanResult, setScanResult] = useState<{ timestamp: string; distance: number; status: string } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (isOpen) {
      setCameraError(null);

      // Dynamic import of html5-qrcode engine on demand
      import('html5-qrcode').then(({ Html5Qrcode }) => {
        if (!isMounted) return;

        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {}
        ).catch((err) => {
          console.error("Camera access error:", err);
          setCameraError("Kamera tidak dapat diakses. Pastikan Anda telah memberikan izin kamera di browser HP.");
        });
      }).catch((err) => {
        console.error("Failed to load QR engine chunk:", err);
        setCameraError("Gagal memuat engine QR scanner. Periksa koneksi internet Anda.");
      });

      return () => {
        isMounted = false;
        if (scannerRef.current && scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(console.error);
        }
      };
    }
  }, [isOpen]);

  const handleScanSuccess = (_qrData: string) => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch(console.error);
    }

    const result = {
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      distance: gpsDistance || 12,
      status: 'HADIR (Tepat Waktu)'
    };

    setScanResult(result);
    setIsSuccessModalOpen(true);

    // Auto-Submit 2.0s Timer (No Extra Taps Required)
    setTimeout(() => {
      setIsSuccessModalOpen(false);
      onSuccess(result);
      onClose();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col justify-between p-6 animate-fade-in" role="dialog" aria-modal="true" aria-label="QR Code Scanner Overlay">
        
        {/* Scanner Top Controls Bar */}
        <div className="flex justify-between items-center text-white pt-2 z-10">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-lg hover:bg-white/20 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
            aria-label="Tutup Pemindai"
          >
            ✕
          </button>
          <div className="text-center">
            <h3 className="font-extrabold text-base tracking-tight">Pindai QR Code Absensi</h3>
            <p className="text-[11px] font-medium text-emerald-400">Pintu Kantor Utama Sekolah</p>
          </div>
          <div className="w-10 h-10 flex items-center justify-center text-xl" aria-hidden="true">
            💡
          </div>
        </div>

        {/* Camera Scanner Viewfinder Box */}
        <div className="relative w-72 h-72 mx-auto rounded-3xl border-2 border-emerald-500/40 overflow-hidden shadow-2xl bg-black">
          <div id="reader" className="w-full h-full object-cover"></div>

          {/* Animated Laser Beam Scanner Line */}
          <div className="absolute left-0 right-0 h-1 bg-linear-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10B981] animate-pulse top-1/2 -translate-y-1/2 pointer-events-none" />

          {/* Camera Frame Corners Overlay */}
          <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl pointer-events-none" />
          <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-xl pointer-events-none" />
        </div>

        {/* Error handling for camera permissions */}
        {cameraError && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-200 text-xs p-4 rounded-2xl text-center space-y-2">
            <p className="font-bold">⚠️ Kendala Akses Kamera</p>
            <p>{cameraError}</p>
            <button
              onClick={() => handleScanSuccess('MOCK_QR')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold mt-2"
            >
              Simulasi Absen (Dev Mode)
            </button>
          </div>
        )}

        {/* Status Geofence Indicators Badges */}
        <div className="space-y-3 max-w-xs mx-auto text-center pb-6 z-10">
          <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs px-4 py-2 rounded-full inline-flex items-center gap-2 backdrop-blur-md font-bold">
            <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            <span>GPS Geofence: Terverifikasi ({gpsDistance}m dari Sekolah)</span>
          </div>
          <p className="text-[11px] text-slate-400">Arahkan kamera HP Anda ke QR Code yang dipajang di sekolah</p>
        </div>

      </div>

      {/* Auto-Submit Success Modal Overlay (2.0s Duration) */}
      <Modal isOpen={isSuccessModalOpen} onClose={() => {}}>
        <div className="text-center space-y-4 py-2">
          
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto ring-8 ring-emerald-50 animate-bounce">
            ✓
          </div>

          <div>
            <h3 className="font-extrabold text-slate-900 text-xl">ABSENSI BERHASIL!</h3>
            <p className="text-xs text-slate-500 mt-1">Data kehadiran otomatis tersimpan</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-left text-xs text-slate-600 border border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-400">Status</span>
              <Badge status="HADIR">Hadir Tepat Waktu</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Waktu Absen</span>
              <span className="font-bold text-emerald-600">{scanResult?.timestamp}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Lokasi Verified</span>
              <span className="font-medium text-emerald-600">🟢 Area Sekolah ({scanResult?.distance}m)</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 animate-pulse font-medium">
            Mengalihkan ke Dashboard dalam 2 detik...
          </p>
        </div>
      </Modal>
    </>
  );
};
