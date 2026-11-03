import React from 'react';
import {
  X,
  Calendar,
  Clock,
  UserCheck,
  Building2,
  HeartHandshake,
  CheckCircle2,
  Printer,
  Trash2,
  Globe,
  ExternalLink,
  Users,
} from 'lucide-react';
import type { CounselingRecord } from '../../../types/counseling.types';
import {
  COUNSELING_TYPE_LABELS,
  COUNSELING_URGENCY_LABELS,
  COUNSELING_STATUS_LABELS,
} from '../../../types/counseling.types';

export interface CounselingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: CounselingRecord | null;
  onEdit?: (record: CounselingRecord) => void;
  onDelete?: (id: string) => void;
  canManage?: boolean;
}

export const CounselingDetailModal: React.FC<CounselingDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  onEdit,
  onDelete,
  canManage = true,
}) => {
  if (!isOpen || !record) return null;

  const handlePrint = () => {
    window.print();
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'HIGH':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return 'bg-emerald-500 text-white';
      case 'IN_PROGRESS':
        return 'bg-indigo-600 text-white';
      case 'SCHEDULED':
        return 'bg-sky-600 text-white';
      case 'MONITORING':
        return 'bg-amber-500 text-white';
      case 'REFERRED':
        return 'bg-purple-600 text-white';
      default:
        return 'bg-slate-500 text-white';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
      {/* Container: 100dvh on Mobile per Infinix Note 8 Rule */}
      <div className="w-full sm:max-w-2xl bg-white sm:rounded-2xl shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] overflow-hidden">
        {/* ── 1. ZONE HEADER (STICKY) ─────────────────────────────────── */}
        <div className="shrink-0 px-4 py-3 sm:px-6 sm:py-4 bg-linear-to-r from-emerald-800 via-teal-900 to-[#023246] text-white flex items-center justify-between border-b border-emerald-700/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
              <HeartHandshake className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black tracking-tight truncate">
                Rapor Bimbingan Konseling
              </h2>
              <p className="text-[11px] text-emerald-100/90 truncate font-medium">
                Siswa: <strong>{record.student_name}</strong> • Kelas {record.class_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── 2. ZONE CONTENT (SCROLLABLE) ────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* STATUS BAR & NAWASENA BADGES */}
          <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${getStatusBadge(record.status)}`}>
                {COUNSELING_STATUS_LABELS[record.status] || record.status}
              </span>
              <span
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${getUrgencyBadge(record.urgency)}`}
              >
                Urgensi: {COUNSELING_URGENCY_LABELS[record.urgency] || record.urgency}
              </span>
              <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                {COUNSELING_TYPE_LABELS[record.counseling_type] || record.counseling_type}
              </span>
            </div>

            {/* NAWASENA SYNC STATUS PILL */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200/80">
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {record.visibility === 'PUBLIC_STUDENT'
                  ? 'Tersinkron di Nawasena Siswa'
                  : 'Catatan Internal BK'}
              </span>
            </div>
          </div>

          {/* SISWA & KONSELOR INFO CARD */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Peserta Didik / Siswa
              </span>
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-700" />
                <span>{record.student_name}</span>
              </h4>
              <p className="text-xs text-slate-600 font-medium">
                Kelas: <strong>{record.class_name}</strong> {record.student_nisn && `• NISN: ${record.student_nisn}`}
              </p>
            </div>

            <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Guru BK / Konselor Pendamping
              </span>
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-700" />
                <span>{record.counselor_name}</span>
              </h4>
              <p className="text-xs text-slate-600 font-medium">
                {record.counselor_npp ? `NPP: ${record.counselor_npp}` : 'Guru Pembimbing'}
              </p>
            </div>
          </div>

          {/* WAKTU & JADWAL */}
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 bg-white p-3 rounded-xl border border-slate-200 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Tanggal: <strong>{record.counseling_date}</strong></span>
            </div>
            {record.counseling_time && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Waktu: <strong>{record.counseling_time} WIB</strong></span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-slate-500">
              <Users className="w-4 h-4 text-slate-400" />
              <span>Tahun Ajaran: <strong>{record.academic_year || '2026/2027'} ({record.semester || 'GANJIL'})</strong></span>
            </div>
          </div>

          {/* TOPIK & POKOK BAHASAN */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pokok Bahasan / Topik Konseling
            </h4>
            <div className="p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 leading-snug">
              {record.topic}
            </div>
          </div>

          {/* LATAR BELAKANG MASALAH */}
          {record.background_narrative && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Latar Belakang Kasus & Observasi
              </h4>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {record.background_narrative}
              </div>
            </div>
          )}

          {/* ARAHAN & TINDAKAN KONSELOR */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Arahan / Layanan / Tindakan Pembinaan yang Diberikan</span>
            </h4>
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs sm:text-sm text-emerald-950 font-medium leading-relaxed whitespace-pre-wrap">
              {record.action_taken}
            </div>
          </div>

          {/* KOMITMEN SISWA & ORANG TUA */}
          {(record.student_commitment || record.parent_involvement) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {record.student_commitment && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Komitmen / Janji Siswa
                  </h4>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 leading-relaxed">
                    {record.student_commitment}
                  </div>
                </div>
              )}

              {record.parent_involvement && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Tindak Lanjut Bersama Orang Tua
                  </h4>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 leading-relaxed">
                    {record.parent_involvement}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PEMANTAUAN LANJUTAN */}
          {(record.follow_up_plan || record.follow_up_date) && (
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 space-y-1">
              <span className="font-bold block">Rencana Pemantauan & Evaluasi Lanjutan:</span>
              <p className="leading-relaxed">
                {record.follow_up_plan || 'Evaluasi berkala pada perilaku dan capaian belajar siswa.'}
              </p>
              {record.follow_up_date && (
                <span className="font-bold text-[11px] block text-amber-800">
                  Target Evaluasi: {record.follow_up_date}
                </span>
              )}
            </div>
          )}

          {/* NAWASENA PORTAL LINK */}
          <div className="p-3 rounded-xl bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200/80 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                Portal Nawasena Platform Siswa
              </span>
              <p className="text-[11px] text-blue-700 mt-0.5 truncate">
                https://nawasena-platform-siswa.vercel.app/
              </p>
            </div>
            <a
              href="https://nawasena-platform-siswa.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 shrink-0"
            >
              <span>Buka Platform Siswa</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* ── 3. ZONE ACTION BAR (STICKY BOTTOM) ──────────────────────── */}
        <div className="shrink-0 p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="h-10 sm:h-11 px-3 sm:px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Cetak Rekap</span>
            </button>
            {canManage && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Hapus catatan BK untuk ${record.student_name}?`)) {
                    onDelete(record.id);
                    onClose();
                  }
                }}
                className="h-10 sm:h-11 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs sm:text-sm font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span className="hidden sm:inline">Hapus</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canManage && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(record);
                  onClose();
                }}
                className="h-10 sm:h-11 px-4 rounded-xl bg-[#023246] hover:bg-[#03445e] text-white text-xs sm:text-sm font-bold transition-all cursor-pointer"
              >
                Edit Catatan
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-10 sm:h-11 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold transition-all cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

