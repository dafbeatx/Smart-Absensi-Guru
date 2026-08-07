import React, { useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  htmlContent: string;
}

export const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  htmlContent,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  const handleOpenNewTab = () => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="2xl">
      <div className="space-y-3 py-1">
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-xs text-amber-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>
              <strong>Pop-up Browser Terblokir:</strong> Dokumen PDF dibuka dalam pratinjau aplikasi. Klik tombol <strong>Cetak PDF</strong> di bawah.
            </span>
          </div>
          <button
            type="button"
            onClick={handleOpenNewTab}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg shrink-0 transition-colors cursor-pointer"
          >
            🔗 Tab Baru
          </button>
        </div>

        <div className="w-full h-[65vh] min-h-100 bg-slate-100 rounded-2xl overflow-hidden border border-slate-300 shadow-inner">
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            title="Pratinjau PDF Laporan Absensi"
            className="w-full h-full border-none"
          />
        </div>

        <div className="pt-2 flex justify-between gap-2 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose} className="text-xs font-bold">
            Tutup
          </Button>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleOpenNewTab}
              className="text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>🔗</span>
              <span>Buka di Tab Baru</span>
            </Button>

            <Button
              variant="primary"
              onClick={handlePrint}
              className="text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>🖨️</span>
              <span>Cetak PDF Sekarang</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
