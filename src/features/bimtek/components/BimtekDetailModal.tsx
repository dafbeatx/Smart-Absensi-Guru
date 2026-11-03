import React, { useState, useEffect } from 'react';
import {
  X,
  Award,
  Calendar,
  Clock,
  MapPin,
  Building2,
  FileCheck,
  ExternalLink,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Printer,
  Edit2,
  Trash2,
} from 'lucide-react';
import type { UserProfile } from '../../../types/database.types';
import type { BimtekRecord, VerifyBimtekDTO } from '../../../types/bimtek.types';
import {
  BIMTEK_ACTIVITY_LABELS,
  BIMTEK_SCOPE_LABELS,
  BIMTEK_ROLE_LABELS,
  BIMTEK_METHOD_LABELS,
  BIMTEK_STATUS_LABELS,
} from '../../../types/bimtek.types';

const formatTeacherNpp = (nip?: string | null) => {
  if (!nip) return 'NPP: -';
  return `NPP: ${nip}`;
};

export interface BimtekDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: BimtekRecord | null;
  currentUser?: UserProfile | null;
  onVerify?: (id: string, dto: VerifyBimtekDTO) => Promise<void>;
  onEdit?: (record: BimtekRecord) => void;
  onDelete?: (id: string) => Promise<void>;
}

export const BimtekDetailModal: React.FC<BimtekDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  currentUser,
  onVerify,
  onEdit,
  onDelete,
}) => {
  const [verificationNotes, setVerificationNotes] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (record) {
      setVerificationNotes(record.verification_notes || '');
      setShowDeleteConfirm(false);
    }
  }, [record, isOpen]);

  // Prevent background scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !record) return null;

  const isValidator = currentUser?.role === 'ADMIN' || currentUser?.role === 'KEPSEK';
  const isOwner = currentUser?.id === record.user_id;
  const canEdit = isOwner || isValidator;

  const handleVerify = async (status: 'APPROVED' | 'REVISION') => {
    if (!onVerify) return;
    try {
      setIsVerifying(true);
      await onVerify(record.id, {
        status,
        verified_by: currentUser?.full_name || 'Kepala Sekolah',
        verification_notes: verificationNotes.trim() || undefined,
      });
      onClose();
    } catch {
      // handled upstream
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    await onDelete(record.id);
    onClose();
  };

  const handlePrint = () => {
    window.print();
  };

  const statusBadgeColor =
    record.status === 'APPROVED'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
      : record.status === 'REVISION'
      ? 'bg-rose-50 text-rose-800 border-rose-300'
      : 'bg-amber-50 text-amber-800 border-amber-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 md:p-4 md:backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full h-dvh md:h-auto md:max-h-[92vh] md:max-w-2xl bg-white md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* 1. STICKY HEADER */}
        <header className="h-14 sm:h-16 px-4 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center justify-between shrink-0 sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 truncate leading-snug">
                Rincian Kegiatan Bimtek & Diklat
              </h2>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                ID Registrasi: #{record.id.substring(0, 12)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* 2. SCROLLABLE WORKSPACE */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          
          {/* Status & Judul Utama */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className={`px-2.5 py-1 text-xs font-black rounded-lg border flex items-center gap-1.5 ${statusBadgeColor}`}>
                {record.status === 'APPROVED' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : record.status === 'REVISION' ? (
                  <AlertCircle className="w-3.5 h-3.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                <span>{BIMTEK_STATUS_LABELS[record.status] || record.status}</span>
              </span>

              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                  {BIMTEK_ACTIVITY_LABELS[record.activity_type] || record.activity_type}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black">
                  {record.duration_hours} JP
                </span>
              </div>
            </div>

            <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
              {record.title}
            </h3>

            {/* Profil Guru */}
            <div className="pt-2 border-t border-slate-200/80 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#023246] text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                {record.teacher_avatar ? (
                  <img
                    src={record.teacher_avatar}
                    alt={record.teacher_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{record.teacher_name ? record.teacher_name.charAt(0) : 'G'}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                  {record.teacher_name}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  {formatTeacherNpp(record.teacher_nip)}
                </p>
              </div>
            </div>
          </div>

          {/* Grid Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Penyelenggara</span>
              <p className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="truncate">{record.organizer}</span>
              </p>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Tingkat & Peran</span>
              <p className="text-xs sm:text-sm font-bold text-slate-800">
                {BIMTEK_SCOPE_LABELS[record.scope]} • {BIMTEK_ROLE_LABELS[record.role]}
              </p>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Tanggal Pelaksanaan</span>
              <p className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {record.start_date} s/d {record.end_date}
                </span>
              </p>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Metode & Lokasi</span>
              <p className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="truncate">
                  {BIMTEK_METHOD_LABELS[record.execution_method]} ({record.location_or_platform})
                </span>
              </p>
            </div>
          </div>

          {/* Dokumen & Sertifikat */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <FileCheck className="w-4 h-4 text-amber-600" />
              <span>Dokumen Bukti Fisik & Sertifikat</span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Nomor Sertifikat:</span>
                <span className="font-bold text-slate-900">{record.certificate_number || 'Belum Terbit / Belum Diisi'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Tanggal Sertifikat:</span>
                <span className="font-bold text-slate-900">{record.certificate_date || '-'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Nomor Surat Tugas:</span>
                <span className="font-bold text-slate-900">{record.assignment_letter_number || '-'}</span>
              </div>
            </div>

            {record.certificate_url && (
              <div className="pt-2">
                <a
                  href={record.certificate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-11 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Buka Berkas Sertifikat (Google Drive / Cloud)</span>
                </a>
              </div>
            )}
          </div>

          {/* Ringkasan Materi & RTL */}
          {record.summary_notes && (
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Ringkasan Materi & Rencana Tindak Lanjut (RTL)</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-100">
                {record.summary_notes}
              </p>
            </div>
          )}

          {/* Catatan Verifikasi Validator Sebelumnya */}
          {record.verified_by && (
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Telah diverifikasi oleh: {record.verified_by}</span>
              </div>
              {record.verified_at && (
                <p className="text-[11px] text-emerald-700">
                  Waktu Validasi: {new Date(record.verified_at).toLocaleString('id-ID')}
                </p>
              )}
              {record.verification_notes && (
                <p className="text-xs text-slate-700 mt-1 bg-white/80 p-2 rounded-md border border-emerald-100">
                  &ldquo;{record.verification_notes}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* PANEL KHUSUS VALIDATOR (ADMIN / KEPSEK) */}
          {isValidator && onVerify && (
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-amber-900 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>Panel Validasi Pimpinan Sekolah (Kepala Sekolah / Admin)</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Verifikasi / Alasan Revisi (Opsional)
                </label>
                <input
                  type="text"
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="Contoh: Dokumen sertifikat valid dan terverifikasi untuk 32 JP"
                  className="w-full h-11 px-3 text-sm bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleVerify('APPROVED')}
                  disabled={isVerifying}
                  className="flex-1 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Setujui Resmi</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVerify('REVISION')}
                  disabled={isVerifying}
                  className="h-11 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>Minta Revisi</span>
                </button>
              </div>
            </div>
          )}

          {/* Delete Confirmation Box */}
          {showDeleteConfirm && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl space-y-2">
              <p className="text-xs font-bold text-rose-900">
                Yakin ingin menghapus catatan kegiatan bimtek ini? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all cursor-pointer"
                >
                  Ya, Hapus Sekarang
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Batalkan
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. STICKY FOOTER ACTION BAR */}
        <footer className="h-16 px-4 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 sticky bottom-0 z-20 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              title="Cetak Bukti Registrasi"
              className="h-11 px-3.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Cetak</span>
            </button>

            {canEdit && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(record);
                  onClose();
                }}
                className="h-11 px-3.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
                <span>Ubah</span>
              </button>
            )}

            {canEdit && onDelete && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="h-11 px-3 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer"
          >
            Tutup
          </button>
        </footer>
      </div>
    </div>
  );
};
