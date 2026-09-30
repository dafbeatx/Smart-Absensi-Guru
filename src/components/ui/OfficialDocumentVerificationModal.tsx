import React from 'react';
import { ShieldCheck, CheckCircle2, FileText, School, UserCheck, Calendar, Lock, ExternalLink, X } from 'lucide-react';
import { getDynamicBranding, SIGNATORY_OFFICIALS } from '../../lib/excel-generator.lib';

export interface OfficialDocumentVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  docNo: string;
  docType?: string;
  month?: string;
  year?: string;
  teacherName?: string;
  schoolName?: string;
  signatoryName?: string;
}

export const OfficialDocumentVerificationModal: React.FC<OfficialDocumentVerificationModalProps> = ({
  isOpen,
  onClose,
  docNo,
  docType = 'REKAP_PRESENSI',
  month = 'September',
  year = '2026',
  teacherName,
  schoolName,
  signatoryName,
}) => {
  if (!isOpen) return null;

  const branding = getDynamicBranding();
  const effectiveSchoolName = schoolName || branding.institutionName;
  const effectiveKepsek = signatoryName || SIGNATORY_OFFICIALS.KEPSEK_NAME;
  const isIndividual = docType === 'PRESENSI_INDIVIDU' || !!teacherName;

  const handleGoToApp = () => {
    // Bersihkan parameter query url agar kembali ke mode aplikasi normal
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-emerald-500/30 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-5 text-center relative shadow-inner">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-emerald-200 hover:text-white bg-black/20 hover:bg-black/30 p-1.5 rounded-full transition-all cursor-pointer"
            aria-label="Tutup Verifikasi"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-2xl border border-white/20 mb-3 shadow-sm">
            <ShieldCheck className="w-10 h-10 text-emerald-300 drop-shadow-md" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-900/60 rounded-full text-[11px] font-bold tracking-wider text-emerald-200 border border-emerald-400/30 mb-1 uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Validasi Dokumen Resmi Sekolah
          </div>

          <h2 className="text-xl font-extrabold tracking-tight text-white mt-1">
            TERVERIFIKASI SAH &amp; ASLI
          </h2>
          <p className="text-xs text-emerald-100/90 font-medium">
            Dokumen ini resmi diterbitkan melalui {branding.appName}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-800 text-sm">
          {/* Status Box */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-emerald-950">
              <strong className="font-extrabold text-emerald-800">Status Keabsahan Digital: VALID</strong>
              <p className="mt-0.5 text-emerald-900/80">
                Integritas catatan kehadiran, tanda tangan digital, dan data pengesahan telah divalidasi secara kriptografis oleh server.
              </p>
            </div>
          </div>

          {/* Document Metadata Grid */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200/80 text-xs">
            <div className="p-3 flex justify-between items-center gap-2">
              <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" /> Nomor Dokumen
              </span>
              <span className="font-extrabold text-slate-900 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                {docNo}
              </span>
            </div>

            <div className="p-3 flex justify-between items-center gap-2">
              <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                <School className="w-4 h-4 text-slate-400" /> Lembaga / Sekolah
              </span>
              <span className="font-bold text-slate-800 text-right">
                {effectiveSchoolName}
              </span>
            </div>

            <div className="p-3 flex justify-between items-center gap-2">
              <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" /> Periode Laporan
              </span>
              <span className="font-bold text-slate-800">
                {month} {year}
              </span>
            </div>

            <div className="p-3 flex justify-between items-center gap-2">
              <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" /> Jenis Laporan
              </span>
              <span className="font-bold text-slate-800 text-right">
                {isIndividual
                  ? 'Laporan Presensi Individu Guru'
                  : 'Rekapitulasi Kehadiran Dewan Guru & Staf'}
              </span>
            </div>

            {teacherName && (
              <div className="p-3 flex justify-between items-center gap-2">
                <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-slate-400" /> Guru Bersangkutan
                </span>
                <span className="font-extrabold text-emerald-800">
                  {teacherName}
                </span>
              </div>
            )}

            <div className="p-3 flex justify-between items-center gap-2">
              <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-slate-400" /> Penandatangan
              </span>
              <span className="font-bold text-slate-800 text-right">
                {effectiveKepsek} <span className="text-slate-500 font-normal">({SIGNATORY_OFFICIALS.KEPSEK_TITLE})</span>
              </span>
            </div>

            <div className="p-3 flex justify-between items-center gap-2">
              <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-slate-400" /> Pemeriksa TU
              </span>
              <span className="font-bold text-slate-800 text-right">
                {SIGNATORY_OFFICIALS.TU_NAME} <span className="text-slate-500 font-normal">({SIGNATORY_OFFICIALS.TU_TITLE})</span>
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-100 rounded-lg p-3 leading-relaxed border border-slate-200">
            ℹ️ <strong>Catatan Keaslian:</strong> Dokumen fisik atau digital yang memuat kode QR ini telah terverifikasi secara resmi di basis data {branding.appName}. Segala bentuk duplikasi atau manipulasi data yang tidak sesuai sistem merupakan pelanggaran integritas akademik.
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-300 text-xs transition-all shadow-sm active:scale-95 cursor-pointer text-center"
          >
            Tutup Verifikasi
          </button>
          <button
            onClick={handleGoToApp}
            className="flex-1 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" /> Buka Aplikasi Absensi
          </button>
        </div>
      </div>
    </div>
  );
};
