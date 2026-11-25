import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  X,
  FileCheck2,
  Calendar,
  Building2,
  UserCheck,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { Button } from './Button';
import {
  DocumentVerificationService,
  type DocumentVerificationResponse,
} from '../../services/document-verification.service';
import { getLevelSchoolBranding, sanitizeNpp } from '../../utils/html.utils';

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
  iat?: string;
  sig?: string;
  code?: string;
  docId?: string;
}

export const OfficialDocumentVerificationModal: React.FC<OfficialDocumentVerificationModalProps> = ({
  isOpen,
  onClose,
  docNo,
  docType = 'REKAP_PRESENSI',
  month = '',
  year = '',
  teacherName,
  schoolName,
  signatoryName,
  iat,
  sig,
  code,
  docId,
}) => {
  const [statusState, setStatusState] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [result, setResult] = useState<DocumentVerificationResponse | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    setStatusState('loading');
    DocumentVerificationService.verifyDocumentRemote({
      docNo,
      code,
      docId,
      type: docType,
      month,
      year,
      teacher: teacherName,
      school: schoolName,
      signatory: signatoryName,
      iat,
      sig,
    })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setStatusState(res.verified ? 'valid' : 'invalid');
      })
      .catch(() => {
        if (cancelled) return;
        setResult({
          verified: false,
          status: 'INVALID',
          reasonCode: 'SERVER_UNREACHABLE',
          reason: 'Gagal menghubungi server verifikasi dokumen.',
        });
        setStatusState('invalid');
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, docNo, code, docId, docType, month, year, teacherName, schoolName, signatoryName, iat, sig, retryCounter]);

  if (!isOpen) return null;

  const isVerified = statusState === 'valid' && result?.verified === true;
  const resolvedDoc = result?.document;
  const displaySchoolRaw = resolvedDoc?.school || schoolName || '';
  const detectedLevel =
    resolvedDoc?.schoolLevel ||
    (/smp|ittihadiyah/i.test(`${displaySchoolRaw} ${docNo}`) ? 'SMP' : 'SMA');
  const levelBranding = getLevelSchoolBranding(detectedLevel, displaySchoolRaw);

  const displayDocNo = resolvedDoc?.docNo || docNo || docId || code || 'Tidak Tercantum';
  const displayPeriod =
    resolvedDoc?.month && resolvedDoc?.year
      ? `${resolvedDoc.month} ${resolvedDoc.year}`
      : month && year
      ? `${month} ${year}`
      : 'Tidak Valid';
  const displaySignatory = resolvedDoc?.signatory || signatoryName || 'Kepala Sekolah';
  const displayNpp = sanitizeNpp(resolvedDoc?.signatoryNpp);
  const displayTeacher = resolvedDoc?.teacher || teacherName;

  const formattedVerifiedAt = resolvedDoc?.verifiedAt
    ? new Date(resolvedDoc.verifiedAt).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        dateStyle: 'medium',
        timeStyle: 'short',
      }) + ' WIB'
    : '—';

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-verify-modal-title"
    >
      <div className="relative flex flex-col w-full h-dvh sm:h-auto sm:max-h-[90dvh] sm:max-w-lg bg-slate-900 sm:rounded-2xl sm:border sm:border-slate-700/80 shadow-2xl overflow-hidden text-slate-100">
        {/* Sticky Top Header */}
        <header
          className={`shrink-0 flex items-center justify-between px-4 py-3.5 border-b ${
            statusState === 'loading'
              ? 'bg-slate-800/95 border-slate-700'
              : isVerified
              ? 'bg-emerald-950/90 border-emerald-700/60'
              : 'bg-rose-950/90 border-rose-700/60'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${
                statusState === 'loading'
                  ? 'bg-sky-500/15 border-sky-400/40 text-sky-300'
                  : isVerified
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                  : 'bg-rose-500/20 border-rose-400/50 text-rose-300'
              }`}
            >
              {statusState === 'loading' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isVerified ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300 truncate">
                {levelBranding.shortName}
              </p>
              <h2 id="doc-verify-modal-title" className="text-base font-extrabold text-white truncate">
                {statusState === 'loading'
                  ? 'Memeriksa Keaslian Dokumen'
                  : isVerified
                  ? 'TERVERIFIKASI SAH & ASLI'
                  : 'TIDAK TERVERIFIKASI / DATA TIDAK VALID'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors min-w-11 min-h-11 flex items-center justify-center"
            aria-label="Tutup verifikasi dokumen"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {statusState === 'loading' ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <Loader2 className="w-10 h-10 text-sky-400 animate-spin" />
              <p className="text-sm font-semibold text-slate-200">
                Memvalidasi tanda tangan kriptografis server & catatan institusi...
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                Mohon tunggu, sistem sedang mencocokkan stempel digital dengan server backend.
              </p>
            </div>
          ) : isVerified ? (
            <div className="rounded-xl p-3.5 bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-emerald-300">Status Keabsahan Digital: VALID</p>
                <p className="text-slate-300 leading-relaxed">{result?.reason}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-3.5 bg-rose-500/10 border border-rose-500/35 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1.5">
                <p className="font-bold text-rose-300">
                  Status Keabsahan Digital: TIDAK TERVERIFIKASI ({result?.reasonCode || 'INVALID'})
                </p>
                <p className="text-slate-200 leading-relaxed">
                  {result?.reason || 'Tautan dokumen tidak sah, kedaluwarsa, atau parameter QR telah dimodifikasi.'}
                </p>
              </div>
            </div>
          )}

          {/* Document Metadata Summary Card */}
          <div className="bg-slate-800/70 rounded-xl border border-slate-700/70 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Rincian Dokumen {isVerified ? 'Resmi' : 'Yang Diajukan'}
            </h3>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-start gap-3">
                <FileCheck2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-400">Nomor / Kode Dokumen</p>
                  <p className="font-semibold text-white break-all">{displayDocNo}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-400">Jenis &amp; Periode Laporan</p>
                  <p className="font-semibold text-white">
                    {docType === 'PRESENSI_INDIVIDU' ? 'Laporan Presensi Individu Guru' : 'Rekapitulasi Presensi Sekolah'} ({displayPeriod})
                  </p>
                </div>
              </div>

              {displayTeacher && (
                <div className="flex items-start gap-3">
                  <UserCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-400">Nama Pendidik</p>
                    <p className="font-semibold text-white">{displayTeacher}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-400">Institusi Penerbit ({levelBranding.level})</p>
                  <p className="font-semibold text-white">{levelBranding.institutionName}</p>
                  <p className="text-xs text-slate-400">{resolvedDoc?.address || levelBranding.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <KeyRound className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-400">Penandatangan Sah</p>
                  <p className="font-semibold text-white">{displaySignatory}</p>
                  {displayNpp && (
                    <p className="text-xs text-slate-300">NPP. {displayNpp}</p>
                  )}
                </div>
              </div>

              {isVerified && resolvedDoc?.fingerprint && (
                <div className="pt-2 border-t border-slate-700/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span>Jejak Kriptografis: <strong className="text-emerald-300 font-mono">{resolvedDoc.fingerprint}</strong></span>
                  <span>Diterbitkan: {formattedVerifiedAt}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Bottom Action Bar (Thumb-friendly 44-48px) */}
        <footer className="shrink-0 p-4 border-t border-slate-800 bg-slate-900/95 flex gap-2.5">
          {statusState === 'invalid' && (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 flex-1 gap-2"
              onClick={() => setRetryCounter((c) => c + 1)}
            >
              <RefreshCw className="w-4 h-4" />
              Periksa Ulang
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            className="min-h-11 flex-1"
            onClick={onClose}
          >
            Tutup
          </Button>
        </footer>
      </div>
    </div>
  );
};
