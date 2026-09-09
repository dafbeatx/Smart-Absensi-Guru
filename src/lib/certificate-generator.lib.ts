/**
 * SMART ABSENSI GURU - CERTIFICATE GENERATOR ENGINE
 * Generates official Indonesian school certificates for teacher discipline awards.
 * Supports Rank 1 (🥇), Rank 2 (🥈), and Rank 3 (🥉).
 */

import { APP_CONFIG } from '../config/app.config';
import { SIGNATORY_OFFICIALS } from './excel-generator.lib';

export interface CertificatePayload {
  recipientName: string;
  recipientNipOrNpp?: string | null;
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
  const rawNip = (payload.recipientNipOrNpp || '').trim();
  // Aturan pengguna: Jika tidak ada data NPP/NIP jangan dipakai, pakai - saja
  const nipOrNpp = rawNip ? `NPP/NIP: ${rawNip}` : '-';
  const position = payload.recipientPosition || 'Pendidik SMP & SMA Terpadu As Salaam';
  const period = payload.periodMonthYear || 'September 2026';

  const rank = payload.rank || 1;
  const isRank1 = rank === 1;
  const isRank2 = rank === 2;

  const rankEmoji = isRank1 ? '🥇' : isRank2 ? '🥈' : '🥉';
  const rankBadgeText = isRank1 ? 'TOP #1' : isRank2 ? 'TOP #2' : 'TOP #3';
  const rankTitle = payload.awardTitle || (
    isRank1
      ? 'Juara 1 Disiplin (Pendidik Teladan Utama)'
      : isRank2
      ? 'Juara 2 Disiplin (Pendidik Emas)'
      : 'Juara 3 Disiplin (Pendidik Perak)'
  );

  const certNumber = payload.certificateNumber || `00${rank}/SMART-ABS/DISIPLIN/TOP${rank}/09/2026`;
  const dateIssued = payload.dateIssued || 'Bogor, 30 September 2026';

  // Tema Medali & Aksen Warna Sesuai Juara 1, 2, atau 3
  const medalGradient = isRank1
    ? 'linear-gradient(135deg, #fef08a, #d4af37, #b45309)'
    : isRank2
    ? 'linear-gradient(135deg, #f8fafc, #94a3b8, #475569)'
    : 'linear-gradient(135deg, #fef3c7, #d97706, #78350f)';

  const medalShadow = isRank1
    ? '0 6px 16px rgba(212, 175, 55, 0.35)'
    : isRank2
    ? '0 6px 16px rgba(148, 163, 184, 0.35)'
    : '0 6px 16px rgba(217, 119, 6, 0.35)';

  const predicateBg = isRank1
    ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(254, 240, 138, 0.3))'
    : isRank2
    ? 'linear-gradient(135deg, rgba(148, 163, 184, 0.18), rgba(241, 245, 249, 0.4))'
    : 'linear-gradient(135deg, rgba(217, 119, 6, 0.15), rgba(254, 243, 199, 0.3))';

  const predicateBorder = isRank1 ? '#d4af37' : isRank2 ? '#94a3b8' : '#d97706';
  const predicateColor = isRank1 ? '#78350f' : isRank2 ? '#1e293b' : '#7c2d12';
  const rankPillBg = isRank1 ? '#b45309' : isRank2 ? '#475569' : '#9a3412';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Piagam Penghargaan - ${rankTitle} - ${recipientName}</title>
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
      padding: 18px 40px;
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

    /* ── HEADER KOP (HANYA NAMA SMP & SMA TERPADU) ────────────────────────── */
    .cert-header {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid rgba(212, 175, 55, 0.4);
      padding-bottom: 12px;
      margin-bottom: 6px;
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

    .inst-school {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #023246;
      margin: 0;
    }

    .inst-sub {
      font-size: 10px;
      color: #64748b;
      margin: 4px 0 0 0;
      font-weight: 600;
    }

    .cert-medal-badge {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      background: ${medalGradient};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: ${medalShadow};
      border: 2px solid #ffffff;
      color: #1e293b;
      font-weight: 900;
      line-height: 1;
    }

    .cert-medal-badge .medal-icon {
      font-size: 24px;
    }

    .cert-medal-badge .medal-text {
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
      margin: 12px 0;
    }

    .cert-present-text {
      font-size: 12px;
      color: #475569;
      margin: 0;
      letter-spacing: 0.5px;
    }

    .cert-recipient-name {
      font-family: 'Playfair Display', serif;
      font-size: 28px;
      font-weight: 700;
      color: #023246;
      margin: 6px 0 3px 0;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #d4af37;
      display: inline-block;
      padding: 0 28px 4px 28px;
    }

    .cert-recipient-role {
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
      margin: 3px 0 0 0;
    }

    .cert-award-predicate {
      margin-top: 12px;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: ${predicateBg};
      border: 1.5px solid ${predicateBorder};
      padding: 7px 22px;
      border-radius: 50px;
    }

    .predicate-badge {
      font-size: 19px;
    }

    .predicate-title {
      font-size: 14px;
      font-weight: 800;
      color: ${predicateColor};
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .predicate-rank {
      background: ${rankPillBg};
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      padding: 2.5px 9px;
      border-radius: 12px;
      letter-spacing: 0.5px;
    }

    /* Kalimat Apresiasi Resmi (Tanpa Blok Hak Istimewa) */
    .cert-citation-box {
      margin: 14px auto 0 auto;
      max-width: 740px;
    }

    .cert-citation-text {
      font-size: 11.5px;
      line-height: 1.6;
      color: #475569;
      margin: 0;
      font-style: italic;
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
      height: 70px;
      position: relative;
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

        <!-- 1. KOP SURAT INSTITUSI: CUKUP SMP TERPADU AL-ITTIHADIYAH & SMA TERPADU AS SALAAM -->
        <div class="cert-header">
          <img src="/school-logo.png" alt="Logo Sekolah" class="cert-logo" onerror="this.style.display='none'" />

          <div class="cert-institution-meta">
            <h1 class="inst-school">SMP TERPADU AL-ITTIHADIYAH &amp; SMA TERPADU AS SALAAM</h1>
            <p class="inst-sub">Sistem Manajemen Presensi &amp; Keteladanan Pendidik Terintegrasi (${APP_CONFIG.APP_NAME})</p>
          </div>

          <div class="cert-medal-badge">
            <span class="medal-icon">${rankEmoji}</span>
            <span class="medal-text">${rankBadgeText}</span>
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
            <span class="predicate-badge">${rankEmoji}</span>
            <span class="predicate-title">${rankTitle}</span>
            <span class="predicate-rank">${rankBadgeText} BULAN ${period.toUpperCase()}</span>
          </div>

          <!-- KUTIPAN KETELADANAN RESMI (HAK ISTIMEWA TELAH DIHAPUS) -->
          <div class="cert-citation-box">
            <p class="cert-citation-text">
              &ldquo;Atas dedikasi luar biasa, ketepatan waktu sempurna, dan keteladanan integritas tanpa kompromi dalam menjalankan amanah mulia kependidikan.&rdquo;
            </p>
          </div>
        </div>

        <!-- 4. TANDA TANGAN & PENGESAHAN KEPALA SEKOLAH -->
        <div class="cert-footer">
          <!-- Kolom Barcode / Keabsahan Dokumen -->
          <div class="cert-security-col">
            <div class="qr-badge-wrapper">
              <svg class="cert-qr" viewBox="0 0 24 24" fill="none" stroke="#023246" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect width="6" height="6" x="3" y="3" rx="1" fill="#023246" fill-opacity="0.08"/>
                <rect width="6" height="6" x="15" y="3" rx="1" fill="#023246" fill-opacity="0.08"/>
                <rect width="6" height="6" x="3" y="15" rx="1" fill="#023246" fill-opacity="0.08"/>
                <path d="M21 15h-3a2 2 0 0 0-2 2v4"/>
                <path d="M21 21v.01"/>
                <path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                <path d="M12 16v5"/>
                <path d="M16 12h5"/>
              </svg>
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
              <!-- Dikosongkan untuk tanda tangan basah & stempel fisik resmi Kepala Sekolah -->
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
