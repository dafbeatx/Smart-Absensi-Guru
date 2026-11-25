import React, { useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { exportHtmlToPdf } from '../../lib/pdf-export.lib';
import { openHtmlBlobPrintWindow } from '../../utils/html.utils';

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
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const pdfFilename = `${(title || 'Dokumen_PDF').replace(/[^\w]+/g, '_')}.pdf`;

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      await exportHtmlToPdf(htmlContent, {
        filename: pdfFilename,
        orientation: 'portrait',
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleOpenNewTab = () => {
    const win = openHtmlBlobPrintWindow(htmlContent, { autoPrint: false });
    if (!win) {
      void handleDownloadPdf();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="2xl" mobileFullscreen>
      <div className="space-y-3 py-1 flex flex-col h-full">
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-xs text-amber-900 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>
              <strong>Pop-up Browser Terblokir:</strong> Dokumen PDF dibuka dalam pratinjau aplikasi. Klik <strong>Unduh PDF</strong> atau <strong>Cetak PDF</strong> di bawah.
            </span>
          </div>
          <button
            type="button"
            onClick={handleOpenNewTab}
            className="min-h-10 sm:min-h-0 px-3 py-1.5 sm:px-2.5 sm:py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg shrink-0 transition-colors cursor-pointer"
          >
            🔗 Tab Baru
          </button>
        </div>

        <div className="w-full flex-1 sm:flex-none sm:h-[65vh] min-h-80 bg-slate-100 rounded-2xl overflow-hidden border border-slate-300 shadow-inner">
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            title="Pratinjau PDF Laporan Absensi"
            className="w-full h-full border-none"
          />
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 shrink-0">
          <Button variant="secondary" onClick={onClose} className="min-h-11 sm:min-h-0 text-xs font-bold">
            Tutup
          </Button>

          <div className="flex flex-wrap gap-2 ml-auto">
            <Button
              variant="secondary"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="min-h-11 sm:min-h-0 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>📥</span>
              <span>{isDownloadingPdf ? 'Mengunduh...' : 'Unduh PDF'}</span>
            </Button>

            <Button
              variant="secondary"
              onClick={handleOpenNewTab}
              className="min-h-11 sm:min-h-0 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>🔗</span>
              <span>Buka di Tab Baru</span>
            </Button>

            <Button
              variant="primary"
              onClick={handlePrint}
              className="min-h-11 sm:min-h-0 text-xs font-bold flex items-center gap-1 cursor-pointer"
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
