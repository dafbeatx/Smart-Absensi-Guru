import React, { useState } from 'react';
import type { UserProfile } from '../../../types/database.types';
import {
  openPrintableCertificate,
  generateExcellenceCertificateHTML,
} from '../../../lib/certificate-generator.lib';
import { APP_CONFIG } from '../../../config/app.config';
import { SIGNATORY_OFFICIALS } from '../../../lib/excel-generator.lib';
import { useToastStore } from '../../../store/useToastStore';
import {
  Printer,
  Share2,
  ExternalLink,
  X,
  Award,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface TeacherExcellenceCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  periodMonthYear?: string;
  totalPoints?: number;
  rank?: number;
}

export const TeacherExcellenceCertificateModal: React.FC<TeacherExcellenceCertificateModalProps> = ({
  isOpen,
  onClose,
  user,
  periodMonthYear = 'September 2026',
  totalPoints = 55,
  rank = 1,
}) => {
  const { showToast } = useToastStore();
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const recipientName = user?.full_name || 'Dafa Maulana, S.Pd';
  const recipientNip = user?.nip || '199001012015011001';
  const certNumber = `001/SMART-ABS/DISIPLIN/09/2026`;
  const dateIssued = 'Bogor, 30 September 2026';

  const certificatePayload = {
    recipientName,
    recipientNipOrNpp: recipientNip,
    recipientPosition: user?.position || 'Guru Mata Pelajaran',
    periodMonthYear,
    awardTitle: 'Juara 1 Disiplin (Pendidik Teladan Utama)',
    rank,
    rankText: `Top #${rank}`,
    certificateNumber: certNumber,
    dateIssued,
    totalPoints,
  };

  const handlePrint = () => {
    openPrintableCertificate(certificatePayload);
  };

  const handleOpenNewTab = () => {
    const html = generateExcellenceCertificateHTML(certificatePayload);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleShare = async () => {
    const shareText = `🏆 *PIAGAM PENGHARGAAN RESMI KEPALA SEKOLAH*\n\n` +
      `Alhamdulillah, anugerah *Juara 1 Disiplin (Pendidik Teladan Utama) - Top #1* Periode ${periodMonthYear} berhasil diraih oleh *${recipientName}* (${totalPoints} Poin).\n\n` +
      `📜 Piagam Penghargaan Resmi bertanda tangan Kepala Sekolah.\n` +
      `🖼️ Foto Profil dipajang di Papan Mading Digital Sekolah.\n` +
      `⭐ Hak Istimewa: Prioritas pemilihan jadwal piket semester depan.\n\n` +
      `Terima kasih atas keteladanan dan integritas waktu di ${APP_CONFIG.INSTITUTION_NAME}!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Piagam Penghargaan Juara 1 Disiplin',
          text: shareText,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setIsCopied(true);
      showToast('success', 'Teks Piagam Disalin', 'Teks penghargaan berhasil disalin untuk dibagikan ke WhatsApp!');
      setTimeout(() => setIsCopied(false), 3000);
    } catch {
      showToast('error', 'Gagal Menyalin', 'Silakan salin teks piagam secara manual.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border-2 border-amber-300/80 z-10 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-3.5 sm:p-4 bg-linear-to-r from-[#023246] via-[#0A4158] to-[#18536B] text-white flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-lg shrink-0">
              🥇
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 block">
                Template Piagam Resmi Sekolah
              </span>
              <h3 className="text-xs sm:text-sm font-black text-white truncate leading-tight">
                Juara 1 Disiplin (Pendidik Teladan Utama) - Top #1
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body - Scrollable Certificate Preview */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 grow bg-slate-100/70">
          {/* Certificate Realistic Golden Paper Frame */}
          <div className="relative bg-linear-to-b from-[#fffefc] to-[#faf8f2] border-4 border-[#023246] rounded-2xl p-2 sm:p-3 shadow-lg">
            {/* Inner Double Gold Border */}
            <div className="border-2 border-amber-500/60 rounded-xl p-3 sm:p-5 text-center relative bg-white/70 overflow-hidden">
              {/* Corner Ornaments */}
              <div className="absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-amber-600 pointer-events-none" />
              <div className="absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-amber-600 pointer-events-none" />
              <div className="absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-amber-600 pointer-events-none" />
              <div className="absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-amber-600 pointer-events-none" />

              {/* Watermark Seal */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none">
                <span className="text-8xl">👑</span>
              </div>

              {/* Header Lembaga */}
              <div className="space-y-0.5 border-b border-amber-300/40 pb-2 mb-2 relative z-10">
                <p className="text-[9px] sm:text-[10px] font-black tracking-widest text-[#18536B] uppercase">
                  YAYASAN AS SALAAM &amp; AL-ITTIHADIYAH BOGOR
                </p>
                <h4 className="text-xs sm:text-base font-black text-[#023246] uppercase leading-tight">
                  {APP_CONFIG.INSTITUTION_NAME}
                </h4>
                <p className="text-[8.5px] sm:text-[9.5px] text-slate-500 font-medium">
                  Sistem Keteladanan Pendidik Terintegrasi ({APP_CONFIG.APP_NAME})
                </p>
              </div>

              {/* Judul Piagam */}
              <div className="space-y-0.5 relative z-10 pt-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-100/80 border border-amber-300 text-amber-900 text-[10px] font-black uppercase tracking-wider mb-1">
                  <span>🥇</span>
                  <span>Top #1 Bulan {periodMonthYear}</span>
                </div>
                <h2 className="text-base sm:text-2xl font-black text-[#023246] tracking-wider uppercase">
                  PIAGAM PENGHARGAAN
                </h2>
                <p className="text-[10px] sm:text-xs text-amber-800 font-serif italic">
                  Certificate of Teaching Discipline Excellence
                </p>
                <span className="inline-block text-[9px] sm:text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 mt-1">
                  No: {certNumber}
                </span>
              </div>

              {/* Identitas Penerima */}
              <div className="py-2.5 sm:py-3 space-y-1 relative z-10">
                <p className="text-[10.5px] text-slate-500 font-medium">
                  Dengan penuh rasa bangga dan apresiasi tertinggi, dianugerahkan kepada:
                </p>
                <h3 className="text-sm sm:text-xl font-black text-[#023246] underline decoration-amber-400 underline-offset-4 font-serif">
                  {recipientName}
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-700 font-semibold">
                  NPP/NIP: {recipientNip} • {user?.position || 'Pendidik Profesional'}
                </p>
              </div>

              {/* Predikat Penghargaan */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-linear-to-r from-amber-200/50 via-amber-100 to-amber-200/50 border border-amber-400 text-amber-950 font-black text-xs sm:text-sm my-1 relative z-10 shadow-2xs">
                <span>🥇</span>
                <span>Juara 1 Disiplin (Pendidik Teladan Utama)</span>
              </div>

              {/* TIGA HAK ISTIMEWA RESMI (SESUAI INSTRUKSI SPESIFIK USER) */}
              <div className="mt-3 p-2.5 sm:p-3 bg-white/95 rounded-xl border border-amber-300/60 shadow-2xs text-left relative z-10 space-y-1.5">
                <span className="text-[9.5px] sm:text-[10.5px] font-black text-[#023246] uppercase tracking-wider block border-b border-amber-100 pb-1">
                  Hak Istimewa &amp; Pengakuan Resmi:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] sm:text-[10.5px] text-slate-700">
                  <div className="flex items-start gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-base shrink-0 leading-none">📜</span>
                    <span className="font-semibold leading-snug">
                      Piagam Penghargaan Resmi bertanda tangan Kepala Sekolah.
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-base shrink-0 leading-none">🖼️</span>
                    <span className="font-semibold leading-snug">
                      Foto Profil dipajang di Papan Mading Digital Sekolah.
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 bg-amber-50/70 p-2 rounded-lg border border-amber-200/70">
                    <span className="text-base shrink-0 leading-none">⭐</span>
                    <span className="font-bold text-amber-900 leading-snug">
                      Hak Istimewa: Prioritas pemilihan jadwal piket semester depan.
                    </span>
                  </div>
                </div>
              </div>

              {/* Tanda Tangan & Pengesahan Kepala Sekolah */}
              <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-end justify-between gap-3 text-left relative z-10">
                {/* QR Verifikasi */}
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-300 p-1 flex items-center justify-center shrink-0 shadow-2xs">
                    <ShieldCheck className="w-6 h-6 text-[#18536B]" />
                  </div>
                  <div className="text-[8.5px] sm:text-[9.5px] text-slate-500 leading-tight">
                    <span className="font-bold text-[#023246] block">Dokumen Sah Digital</span>
                    Terverifikasi Akurasi Presensi
                  </div>
                </div>

                {/* Kolom Tanda Tangan Kepala Sekolah */}
                <div className="text-center min-w-36 relative">
                  <p className="text-[9.5px] sm:text-[10.5px] text-slate-500 font-medium">{dateIssued}</p>
                  <p className="text-[10px] sm:text-[11px] font-extrabold text-[#023246] leading-tight">
                    {SIGNATORY_OFFICIALS.KEPSEK_TITLE}
                  </p>

                  <div className="h-10 sm:h-12 relative flex items-center justify-center my-0.5">
                    {/* Stempel Digital */}
                    <div className="absolute -left-2 top-0 w-12 h-12 rounded-full border-2 border-dashed border-blue-900/60 flex items-center justify-center text-[6.5px] font-black text-blue-900 uppercase transform -rotate-12 pointer-events-none opacity-80">
                      RESMI SEKOLAH
                    </div>
                    {/* TTD Tulisan Artistik */}
                    <span className="font-serif italic font-bold text-sm sm:text-base text-[#023246] relative z-10">
                      {SIGNATORY_OFFICIALS.KEPSEK_NAME}
                    </span>
                  </div>

                  <p className="text-[10px] sm:text-xs font-black text-[#023246] underline leading-tight">
                    {SIGNATORY_OFFICIALS.KEPSEK_NAME}
                  </p>
                  <p className="text-[8.5px] sm:text-[9px] text-slate-400">NIP. 197805122005011004</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Award className="w-4 h-4 text-amber-600" />
            <span className="font-semibold">Format Standar Cetak A4 Landscape</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Bagikan */}
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 sm:flex-none h-11 px-3.5 rounded-xl border border-slate-300 hover:bg-slate-50 active:scale-95 text-slate-700 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              {isCopied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Bagikan</span>
                </>
              )}
            </button>

            {/* Buka Tab Baru */}
            <button
              type="button"
              onClick={handleOpenNewTab}
              className="h-11 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 active:scale-95 text-slate-700 text-xs font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="Buka Halaman Utuh di Tab Baru"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Tab Baru</span>
            </button>

            {/* Cetak / Simpan PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none h-11 px-4 rounded-xl bg-[#023246] hover:bg-[#034560] active:scale-95 text-white text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Cetak / Simpan PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
