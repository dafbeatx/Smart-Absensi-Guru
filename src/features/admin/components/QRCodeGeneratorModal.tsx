import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { APP_CONFIG } from '../../../config/app.config';
import { CONSTANTS } from '../../../config/constants';

export interface QRCodeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QRCodeGeneratorModal: React.FC<QRCodeGeneratorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const qrPayload = CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED;

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(qrPayload, {
        width: 400,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR Code:', err));
    }
  }, [isOpen, qrPayload]);

  const handlePrintPoster = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Poster Official QR Code Absensi Guru</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 40px;
            color: #0f172a;
            text-align: center;
            background: #ffffff;
          }
          .poster-box {
            border: 8px solid #0f172a;
            border-radius: 32px;
            padding: 40px;
            max-width: 650px;
            margin: 0 auto;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          }
          .header h1 {
            font-size: 24px;
            margin: 0 0 6px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #0f172a;
          }
          .header h2 {
            font-size: 16px;
            font-weight: 700;
            margin: 0;
            color: #16a34a;
          }
          .header p {
            font-size: 13px;
            color: #64748b;
            margin: 6px 0 24px 0;
          }
          .qr-container {
            background: #ffffff;
            border: 4px solid #16a34a;
            border-radius: 24px;
            padding: 20px;
            display: inline-block;
            margin-bottom: 24px;
          }
          .qr-image {
            width: 320px;
            height: 320px;
            display: block;
          }
          .instructions {
            background: #f8fafc;
            border-radius: 16px;
            padding: 16px 24px;
            border: 1px solid #e2e8f0;
            margin-bottom: 24px;
          }
          .instructions h3 {
            margin: 0 0 6px 0;
            font-size: 15px;
            color: #0f172a;
          }
          .instructions ol {
            text-align: left;
            margin: 0;
            padding-left: 20px;
            font-size: 13px;
            line-height: 1.6;
            color: #334155;
          }
          .footer-note {
            font-size: 11px;
            color: #94a3b8;
            font-weight: 600;
          }
          @media print {
            .no-print { display: none; }
            body { padding: 0; }
            .poster-box { border-width: 6px; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: right;">
          <button onclick="window.print()" style="padding: 12px 24px; background: #16a34a; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 14px; cursor: pointer;">
            🖨️ Cetak / Print Poster QR (A4 / A3)
          </button>
        </div>

        <div class="poster-box">
          <div class="header">
            <h1>${APP_CONFIG.INSTITUTION_NAME}</h1>
            <h2>POSTER RESMI QR CODE ABSENSI GURU & STAF</h2>
            <p>Sistem Absensi Berbasis QR Code & Digital Scan (${APP_CONFIG.APP_NAME})</p>
          </div>

          <div class="qr-container">
            <img src="${qrDataUrl}" alt="Official QR Code Absensi" class="qr-image" />
            <div style="margin-top: 14px; background: #f1f5f9; padding: 10px 16px; border-radius: 12px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 13px; font-weight: bold; color: #0f172a; display: inline-block;">
              🔑 KODE MANUAL: ${qrPayload}
            </div>
          </div>

          <div class="instructions">
            <h3>📱 PANDUAN CARA ABSENSI GURU & STAF:</h3>
            <ol>
              <li>Buka Web Aplikasi <strong>Smart Absensi Guru</strong> di HP Anda.</li>
              <li>Klik tombol hijau melayang <strong>📷 Scan QR</strong> di bagian bawah layar.</li>
              <li>Arahkan Kamera HP ke gambar QR Code di atas.</li>
              <li><strong>Jam Masuk Tepat Waktu:</strong> 07:00 - 07:15 WIB (Di atas 07:15 WIB otomatis dicatat <i>Terlambat</i>).</li>
              <li><strong>Jam Pulang:</strong> Mulai pukul 14:00 WIB.</li>
              <li><strong>Jika Scan Direject / Kamera Buram:</strong> Gunakan tombol <strong>"⌨️ Input Kode Manual"</strong> (masukkan kode <code>${qrPayload}</code>) atau tombol <strong>"📍 Absen via GPS"</strong>.</li>
            </ol>
          </div>

          <div class="footer-note">
            SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam — Official Attendance Gate QR Code
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📷 Generator QR Code Absensi Resmi">
      <div className="text-center space-y-4 py-2">
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 inline-block shadow-inner">
          {qrDataUrl ? (
            <div className="space-y-3">
              <img src={qrDataUrl} alt="Official QR Code" className="w-56 h-56 mx-auto rounded-2xl border-4 border-white shadow-md" />
              <div className="bg-slate-200/80 text-slate-900 px-3 py-1.5 rounded-xl font-mono text-xs font-bold border border-slate-300 inline-block">
                🔑 Kode Manual: <span className="text-emerald-700">{qrPayload}</span>
              </div>
            </div>
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-xs font-semibold text-slate-400">
              Generating QR Code...
            </div>
          )}
        </div>

        <div className="max-w-md mx-auto space-y-2 text-left bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
            <span>📢</span> Info Poster Resmi Absensi Gerbang
          </h3>
          <ul className="space-y-1 text-slate-600 text-[11px] leading-relaxed list-disc list-inside">
            <li><strong>Jam Masuk:</strong> 07:00 - 07:15 WIB (Di atas 07:15 otomatis Terlambat).</li>
            <li><strong>Jam Pulang:</strong> Mulai 14:00 WIB.</li>
            <li><strong>Kendala Scan:</strong> Disediakan Kode Manual <code>{qrPayload}</code> dan Absen GPS Mandiri.</li>
          </ul>
        </div>

        <div className="pt-2 flex justify-center gap-3">
          <Button variant="secondary" className="w-1/2 cursor-pointer" onClick={onClose}>
            Tutup
          </Button>
          <Button variant="primary" className="w-1/2 flex items-center justify-center gap-2 cursor-pointer" onClick={handlePrintPoster}>
            <span>🖨️</span> Cetak Poster QR (A4/A3)
          </Button>
        </div>
      </div>
    </Modal>
  );
};
