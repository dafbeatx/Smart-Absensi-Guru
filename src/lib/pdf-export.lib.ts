/**
 * SMART ABSENSI GURU - UNIVERSAL HIGH-FIDELITY PDF EXPORT ENGINE
 * Powered by jsPDF & html2canvas
 * Converts school HTML documents (A4 portrait/landscape) into crisp, official .pdf files.
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfExportOptions {
  filename: string;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4';
  scale?: number;
}

/**
 * Universal HTML to PDF exporter for Smart Absensi Guru documents:
 * - Student Exam Cards (Kartu Peserta Ujian)
 * - Administrative Documents (Daftar Hadir Pengawas, Berita Acara, Serah Terima)
 * - Proctor Schedules & Invigilation Matrices (Matriks Jadwal Pengawas)
 * - Duty Letters (Surat Tugas Mengawas)
 * - Excellence Certificates (Piagam Penghargaan)
 */
export async function exportHtmlToPdf(
  htmlContent: string,
  options: PdfExportOptions
): Promise<void> {
  if (typeof window === 'undefined') return;

  const {
    filename,
    orientation = 'portrait',
    scale = 2, // 2x scale ensures crisp 300dpi-like output for barcodes, text & seals
  } = options;

  const cleanFilename = filename.toLowerCase().endsWith('.pdf')
    ? filename
    : `${filename.replace(/\.[a-z0-9]+$/i, '')}.pdf`;

  // 1. Create a hidden rendering container in the active DOM
  const container = document.createElement('div');
  container.className = 'pdf-export-sandbox';
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  // A4 dimensions at 96 DPI: Portrait = 794px x 1123px, Landscape = 1123px x 794px
  container.style.width = orientation === 'landscape' ? '1123px' : '794px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.zIndex = '-9999';
  container.style.overflow = 'visible';
  container.innerHTML = htmlContent;

  // Remove any interactive UI elements (no-print-bar, print-bar)
  container.querySelectorAll('.no-print-bar, .print-bar').forEach((el) => el.remove());

  document.body.appendChild(container);

  try {
    // 2. Wait for all embedded images (school logos, stamps, barcodes, QR) to load
    const images = Array.from(container.querySelectorAll('img'));
    if (images.length > 0) {
      await Promise.all(
        images.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete && img.naturalHeight !== 0) {
                resolve(true);
              } else {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(true);
                setTimeout(() => resolve(true), 2500);
              }
            })
        )
      );
    }

    // Allow DOM layout & font styling to stabilize
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 3. Initialize jsPDF instance
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = orientation === 'landscape' ? 297 : 210;
    const pageHeight = orientation === 'landscape' ? 210 : 297;

    // 4. Check for distinct sheets/pages (e.g. .a4-sheet or .page-container)
    const distinctSheets = container.querySelectorAll<HTMLElement>('.a4-sheet, .page-container, .cert-container');

    if (distinctSheets.length > 0) {
      for (let i = 0; i < distinctSheets.length; i++) {
        if (i > 0) {
          pdf.addPage('a4', orientation);
        }
        const sheet = distinctSheets[i];
        const canvas = await html2canvas(sheet, {
          scale,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: orientation === 'landscape' ? 1123 : 794,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.96);
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      }
    } else {
      // Single continuous content
      const canvas = await html2canvas(container, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: orientation === 'landscape' ? 1123 : 794,
      });

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/jpeg', 0.96);

      if (imgHeight <= pageHeight + 2) {
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight), undefined, 'FAST');
      } else {
        // Multi-page slicing for long tables
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = position - pageHeight;
          pdf.addPage('a4', orientation);
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
          heightLeft -= pageHeight;
        }
      }
    }

    // 5. Trigger browser PDF download
    pdf.save(cleanFilename);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

// Global browser window attachment for popup windows
if (typeof window !== 'undefined') {
  (window as unknown as { __exportHtmlToPdf?: typeof exportHtmlToPdf }).__exportHtmlToPdf = exportHtmlToPdf;
}
