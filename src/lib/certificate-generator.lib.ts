/**
 * SMART ABSENSI GURU - CERTIFICATE GENERATOR ENGINE
 * Generates official Indonesian school certificates for teacher discipline awards.
 */

import { APP_CONFIG } from '../config/app.config';
import { SIGNATORY_OFFICIALS } from './excel-generator.lib';

export interface CertificatePayload {
  recipientName: string;
  recipientNipOrNpp?: string;
  recipientPosition?: string;
  periodMonthYear: string; // e.g., "September 2026"
  awardTitle?: string;
  rankText?: string;
  rank?: number;
  certificateNumber?: string;
  dateIssued?: string;
  totalPoints?: number;
}

export const generateExcellenceCertificateHTML = (payload: CertificatePayload): string => {
  const recipientName = payload.recipientName || 'Bapak/Ibu Guru Teladan';
  const nipOrNpp = payload.recipientNipOrNpp ? `NPP/NIP: ${payload.recipientNipOrNpp}` : 'Pendidik Profesional';
  const position = payload.recipientPosition || 'Pendidik SMP & SMA Terpadu As Salaam';
  const period = payload.periodMonthYear || 'September 2026';
  const certNumber = payload.certificateNumber || `001/SMART-ABS/DISIPLIN/${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
  const dateIssued = payload.dateIssued || 'Bogor, 30 September 2026';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Piagam Penghargaan - Juara 1 Disiplin - ${recipientName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;1,400;1,700&display=swap');

    @page {
      size: A4 landscape;
      margin: 8mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      margin: 0;
      padding: 16px;
      font-family: 'Inter', sans-serif;
      background-color: #f1f5f9;
      color: #0f172a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }

    .no-print-bar {
      margin-bottom: 16px;
      display: flex;
      gap: 12px;
      justify-content: center;
      width: 100%;
      max-width: 1000px;
    }

    .btn-action {
      padding: 10px 22px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 12px;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .btn-print {
      background: linear-gradient(135deg, #023246, #18536B);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(2, 50, 70, 0.25);
    }

    .btn-print:hover {
      background: #023246;
      transform: translateY(-1px);
    }

    .btn-close {
      background: #ffffff;
      color: #475569;
      border: 1px solid #cbd5e1;
    }

    .btn-close:hover {
      background: #f8fafc;
      color: #0f172a;
    }

    /* ── A4 LANDSCAPE CERTIFICATE CONTAINER ────────────────────────────────── */
    .certificate-sheet {
      width: 100%;
      max-width: 1040px;
      aspect-ratio: 1.414 / 1; /* A4 Landscape Ratio */
      background: #ffffff;
      background-image: 
        radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.04) 0%, rgba(255, 255, 255, 0) 70%),
        linear-gradient(to bottom, #fffdfa, #fdfcf7);
      border-radius: 12px;
      box-shadow: 0 20px 40px -15px rgba(2, 50, 70, 0.15), 0 0 0 1px rgba(212, 175, 55, 0.3);
      padding: 18px;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* Decorative Guilloche Golden Borders */
    .outer-border {
      border: 4px solid #023246;
      border-radius: 8px;
      height: 100%;
      padding: 6px;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .inner-border {
      border: 1.5px solid #d4af37;
      border-radius: 6px;
      height: 100%;
      padding: 16px 36px;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
    }

    .corner-decor {
      position: absolute;
      width: 32px;
      height: 32px;
      border-color: #d4af37;
      pointer-events: none;
    }

    .corner-tl { top: 4px; left: 4px; border-top: 3px double #d4af37; border-left: 3px double #d4af37; }
    .corner-tr { top: 4px; right: 4px; border-top: 3px double #d4af37; border-right: 3px double #d4af37; }
    .corner-bl { bottom: 4px; left: 4px; border-bottom: 3px double #d4af37; border-left: 3px double #d4af37; }
    .corner-br { bottom: 4px; right: 4px; border-bottom: 3px double #d4af37; border-right: 3px double #d4af37; }

    /* Watermark Background Seal */
    .watermark-seal {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 340px;
      height: 340px;
      opacity: 0.035;
      pointer-events: none;
      z-index: 1;
    }

    /* ── HEADER KOP ────────────────────────────────────────────────────────── */
    .cert-header {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid rgba(212, 175, 55, 0.4);
      padding-bottom: 10px;
      margin-bottom: 8px;
    }

    .cert-logo {
      width: 68px;
      height: 68px;
      object-fit: contain;
    }

    .cert-institution-meta {
      flex: 1;
      text-align: center;
      padding: 0 16px;
    }

    .inst-yayasan {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #18536B;
      margin: 0;
    }

    .inst-school {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #023246;
      margin: 2px 0;
    }

    .inst-sub {
      font-size: 10px;
      color: #64748b;
      margin: 0;
      font-weight: 500;
    }

    .cert-gold-medal {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      background: linear-gradient(135deg, #fef08a, #d4af37, #b45309);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 16px rgba(212, 175, 55, 0.35);
      border: 2px solid #ffffff;
      color: #451a03;
      font-weight: 900;
      line-height: 1;
    }

    .cert-gold-medal .medal-icon {
      font-size: 24px;
    }

    .cert-gold-medal .medal-text {
      font-size: 8.5px;
      letter-spacing: 0.5px;
      font-weight: 800;
      margin-top: 2px;
    }

    /* ── TITLE & NOMOR ─────────────────────────────────────────────────────── */
    .cert-title-section {
      position: relative;
      z-index: 2;
      margin-top: 4px;
    }

    .cert-main-title {
      font-family: 'Cinzel', serif;
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 4px;
      color: #023246;
      text-transform: uppercase;
      margin: 0;
      text-shadow: 1px 1px 0 rgba(212, 175, 55, 0.4);
    }

    .cert-subtitle {
      font-family: 'Playfair Display', serif;
      font-style: italic;
      font-size: 13px;
      color: #b45309;
      margin: 2px 0 0 0;
      letter-spacing: 1px;
    }

    .cert-number {
      display: inline-block;
      font-size: 10.5px;
      font-family: monospace;
      color: #475569;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 3px 12px;
      border-radius: 6px;
      margin-top: 6px;
      font-weight: 600;
    }

    /* ── RECIPIENT BODY ────────────────────────────────────────────────────── */
    .cert-body {
      position: relative;
      z-index: 2;
      margin: 10px 0;
    }

    .cert-present-text {
      font-size: 12px;
      color: #475569;
      margin: 0;
      letter-spacing: 0.5px;
    }

    .cert-recipient-name {
      font-family: 'Playfair Display', serif;
      font-size: 27px;
      font-weight: 700;
      color: #023246;
      margin: 6px 0 2px 0;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #d4af37;
      display: inline-block;
      padding: 0 28px 4px 28px;
    }

    .cert-recipient-role {
      font-size: 11.5px;
      font-weight: 600;
      color: #1e293b;
      margin: 2px 0 0 0;
    }

    .cert-award-predicate {
      margin-top: 10px;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(254, 240, 138, 0.25));
      border: 1.5px solid #d4af37;
      padding: 6px 20px;
      border-radius: 50px;
    }

    .predicate-badge {
      font-size: 18px;
    }

    .predicate-title {
      font-size: 13.5px;
      font-weight: 800;
      color: #78350f;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .predicate-rank {
      background: #b45309;
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 12px;
      letter-spacing: 0.5px;
    }

    /* ── TIGA HAK ISTIMEWA RESMI (SESUAI INSTRUKSI) ────────────────────────── */
    .cert-privileges-box {
      margin: 10px auto 0 auto;
      max-width: 760px;
      background: #ffffff;
      border: 1px solid rgba(212, 175, 55, 0.4);
      border-radius: 10px;
      padding: 8px 16px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    }

    .privileges-heading {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #023246;
      margin: 0 0 4px 0;
    }

    .privileges-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      text-align: left;
    }

    .privilege-item {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 10px;
      line-height: 1.35;
      color: #334155;
    }

    .privilege-icon {
      font-size: 13px;
      shrink: 0;
      line-height: 1;
    }

    .privilege-text {
      font-weight: 600;
    }

    /* ── FOOTER & SIGNATURES ───────────────────────────────────────────────── */
    .cert-footer {
      position: relative;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 10px;
      padding-top: 6px;
    }

    .cert-security-col {
      text-align: left;
      width: 220px;
    }

    .qr-badge-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .cert-qr {
      width: 48px;
      height: 48px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 3px;
      border-radius: 6px;
    }

    .security-meta {
      font-size: 8.5px;
      color: #64748b;
      line-height: 1.3;
    }

    .security-meta strong {
      color: #023246;
    }

    .cert-signature-col {
      text-align: center;
      width: 260px;
      position: relative;
    }

    .sig-date {
      font-size: 11px;
      color: #475569;
      margin: 0 0 2px 0;
    }

    .sig-role {
      font-size: 11px;
      font-weight: 700;
      color: #023246;
      margin: 0;
    }

    .sig-space {
      height: 52px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .digital-stamp {
      position: absolute;
      left: 15px;
      top: -6px;
      width: 68px;
      height: 68px;
      border: 2px dashed #1e3a8a;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #1e3a8a;
      font-size: 7px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.78;
      transform: rotate(-12deg);
      pointer-events: none;
      box-shadow: 0 0 0 1px rgba(30, 58, 138, 0.2);
    }

    .sig-handwritten {
      font-family: 'Playfair Display', cursive;
      font-size: 20px;
      color: #023246;
      font-weight: 700;
      font-style: italic;
      letter-spacing: 1px;
      position: relative;
      z-index: 2;
    }

    .sig-name {
      font-size: 12.5px;
      font-weight: 800;
      color: #023246;
      text-decoration: underline;
      margin: 0;
    }

    .sig-title {
      font-size: 10px;
      color: #64748b;
      margin: 1px 0 0 0;
      font-weight: 600;
    }

    /* ── PRINT MEDIA STYLES ────────────────────────────────────────────────── */
    @media print {
      body {
        padding: 0;
        background: #ffffff;
        min-height: auto;
      }
      .no-print-bar {
        display: none !important;
      }
      .certificate-sheet {
        box-shadow: none !important;
        border: none !important;
        max-width: 100% !important;
        width: 100% !important;
        height: 100% !important;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>

  <!-- Top Action Bar (Hanya tampil di layar browser, tersembunyi saat dicetak) -->
  <div class="no-print-bar">
    <button type="button" class="btn-action btn-print" onclick="window.print()">
      🖨️ Cetak / Unduh Piagam Resmi (PDF)
    </button>
    <button type="button" class="btn-action btn-close" onclick="window.close()">
      ✖️ Tutup Tab
    </button>
  </div>

  <!-- LEMBAR PIAGAM PENGHARGAAN A4 LANDSCAPE -->
  <div class="certificate-sheet">
    <!-- Guilloche Frame Border -->
    <div class="outer-border">
      <div class="inner-border">
        <!-- Sudut Hiasan Emas -->
        <div class="corner-decor corner-tl"></div>
        <div class="corner-decor corner-tr"></div>
        <div class="corner-decor corner-bl"></div>
        <div class="corner-decor corner-br"></div>

        <!-- Watermark Emas Samar -->
        <svg class="watermark-seal" viewBox="0 0 100 100" fill="#d4af37">
          <circle cx="50" cy="50" r="45" stroke="#d4af37" stroke-width="2" fill="none" />
          <polygon points="50,15 61,38 86,41 67,59 72,84 50,71 28,84 33,59 14,41 39,38" />
        </svg>

        <!-- 1. KOP SURAT INSTITUSI -->
        <div class="cert-header">
          <img src="/school-logo.png" alt="Logo Sekolah" class="cert-logo" onerror="this.style.display='none'" />

          <div class="cert-institution-meta">
            <p class="inst-yayasan">YAYASAN AS SALAAM & AL-ITTIHADIYAH BOGOR</p>
            <h1 class="inst-school">${APP_CONFIG.INSTITUTION_NAME}</h1>
            <p class="inst-sub">Sistem Manajemen Presensi &amp; Keteladanan Pendidik Terintegrasi (${APP_CONFIG.APP_NAME})</p>
          </div>

          <div class="cert-gold-medal">
            <span class="medal-icon">🥇</span>
            <span class="medal-text">TOP #1</span>
          </div>
        </div>

        <!-- 2. JUDUL PIAGAM -->
        <div class="cert-title-section">
          <h2 class="cert-main-title">PIAGAM PENGHARGAAN</h2>
          <p class="cert-subtitle">Certificate of Teaching Discipline Excellence</p>
          <div class="cert-number">Nomor Register: ${certNumber}</div>
        </div>

        <!-- 3. IDENTITAS PENERIMA -->
        <div class="cert-body">
          <p class="cert-present-text">Dengan penuh rasa hormat dan apresiasi setinggi-tingginya, penghargaan ini dianugerahkan kepada:</p>
          <div class="cert-recipient-name">${recipientName}</div>
          <p class="cert-recipient-role">${nipOrNpp} • ${position}</p>

          <div class="cert-award-predicate">
            <span class="predicate-badge">🥇</span>
            <span class="predicate-title">Juara 1 Disiplin (Pendidik Teladan Utama)</span>
            <span class="predicate-rank">TOP #1 BULAN ${period.toUpperCase()}</span>
          </div>

          <!-- TIGA HAK ISTIMEWA RESMI (PERSIS DENGAN INSTRUKSI USER) -->
          <div class="cert-privileges-box">
            <div class="privileges-heading">Penghargaan Resmi &amp; Hak Istimewa yang Diberikan:</div>
            <div class="privileges-grid">
              <div class="privilege-item">
                <span class="privilege-icon">📜</span>
                <span class="privilege-text">Piagam Penghargaan Resmi bertanda tangan Kepala Sekolah.</span>
              </div>
              <div class="privilege-item">
                <span class="privilege-icon">🖼️</span>
                <span class="privilege-text">Foto Profil dipajang di Papan Mading Digital Sekolah.</span>
              </div>
              <div class="privilege-item">
                <span class="privilege-icon">⭐</span>
                <span class="privilege-text">Hak Istimewa: Prioritas pemilihan jadwal piket semester depan.</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. TANDA TANGAN & PENGESAHAN KEPALA SEKOLAH -->
        <div class="cert-footer">
          <!-- Kolom Barcode / Keabsahan Dokumen -->
          <div class="cert-security-col">
            <div class="qr-badge-wrapper">
              <img src="/icons.svg" alt="QR Verifikasi" class="cert-qr" />
              <div class="security-meta">
                <strong>Verifikasi Sistem:</strong><br />
                Dokumen resmi terenkripsi QR &amp; GPS Presensi.<br />
                <em>Smart Absensi Pendidik v${APP_CONFIG.VERSION}</em>
              </div>
            </div>
          </div>

          <!-- Kolom Tanda Tangan Kepala Sekolah -->
          <div class="cert-signature-col">
            <p class="sig-date">${dateIssued}</p>
            <p class="sig-role">${SIGNATORY_OFFICIALS.KEPSEK_TITLE}</p>
            <div class="sig-space">
              <!-- Stempel Basah Digital Resmi -->
              <div class="digital-stamp">
                <span>★ RESMI ★</span>
                <span>SEKOLAH</span>
                <span>TERPADU</span>
              </div>
              <!-- Tanda Tangan Kepala Sekolah -->
              <span class="sig-handwritten">${SIGNATORY_OFFICIALS.KEPSEK_NAME}</span>
            </div>
            <p class="sig-name">${SIGNATORY_OFFICIALS.KEPSEK_NAME}</p>
            <p class="sig-title">NIP. 197805122005011004</p>
          </div>
        </div>

      </div>
    </div>
  </div>

</body>
</html>`;
};

/**
 * Opens a print-ready window to directly print or download the official certificate as PDF.
 */
export const openPrintableCertificate = (payload: CertificatePayload): void => {
  const html = generateExcellenceCertificateHTML(payload);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  if (!printWindow) {
    alert('Pop-up terblokir oleh browser. Izinkan pop-up untuk mencetak Piagam Penghargaan Resmi.');
  }
};
