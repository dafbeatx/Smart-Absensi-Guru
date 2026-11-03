import React, { useState } from 'react';
import {
  X,
  Save,
  UserCheck,
  Calendar,
  Clock,
  AlertTriangle,
  HeartHandshake,
  Users,
  Eye,
  EyeOff,
  Globe,
  Sparkles,
} from 'lucide-react';
import type {
  CounselingRecord,
  CounselingType,
  CounselingUrgency,
  CounselingStatus,
  CounselingVisibility,
  CreateCounselingDTO,
  UpdateCounselingDTO,
} from '../../../types/counseling.types';
import {
  COUNSELING_TYPE_LABELS,
  COUNSELING_URGENCY_LABELS,
  COUNSELING_STATUS_LABELS,
  POPULAR_BK_TOPICS,
} from '../../../types/counseling.types';

export interface CounselingRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateCounselingDTO | UpdateCounselingDTO) => Promise<void>;
  editRecord?: CounselingRecord | null;
  counselorName: string;
  counselorId: string;
  counselorNpp?: string | null;
  studentPresets?: Array<{ id: string; name: string; class_name: string; nisn?: string | null }>;
}

const CLASS_OPTIONS = ['7A', '7B', '7C', '7D', '8A', '8B', '8C', '8D', '9A', '9B', '9C', '9D', '9E'];

export const CounselingRecordModal: React.FC<CounselingRecordModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editRecord,
  counselorName,
  counselorId,
  counselorNpp,
  studentPresets = [],
}) => {
  if (!isOpen) return null;

  const isEdit = Boolean(editRecord);

  // Form State
  const [studentName, setStudentName] = useState(editRecord?.student_name || '');
  const [studentNisn, setStudentNisn] = useState(editRecord?.student_nisn || '');
  const [className, setClassName] = useState(editRecord?.class_name || '7A');
  const [counselingDate, setCounselingDate] = useState(
    editRecord?.counseling_date || new Date().toISOString().slice(0, 10)
  );
  const [counselingTime, setCounselingTime] = useState(
    editRecord?.counseling_time ||
      new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
  );
  const [counselingType, setCounselingType] = useState<CounselingType>(
    editRecord?.counseling_type || 'INDIVIDUAL'
  );
  const [urgency, setUrgency] = useState<CounselingUrgency>(editRecord?.urgency || 'MEDIUM');
  const [status, setStatus] = useState<CounselingStatus>(editRecord?.status || 'IN_PROGRESS');
  const [visibility, setVisibility] = useState<CounselingVisibility>(
    editRecord?.visibility || 'PUBLIC_STUDENT'
  );
  const [topic, setTopic] = useState(editRecord?.topic || '');
  const [backgroundNarrative, setBackgroundNarrative] = useState(editRecord?.background_narrative || '');
  const [actionTaken, setActionTaken] = useState(editRecord?.action_taken || '');
  const [studentCommitment, setStudentCommitment] = useState(editRecord?.student_commitment || '');
  const [parentInvolvement, setParentInvolvement] = useState(editRecord?.parent_involvement || '');
  const [followUpPlan, setFollowUpPlan] = useState(editRecord?.follow_up_plan || '');
  const [followUpDate, setFollowUpDate] = useState(editRecord?.follow_up_date || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-fill student if matching preset selected
  const handleSelectStudentPreset = (student: { id: string; name: string; class_name: string; nisn?: string | null }) => {
    setStudentName(student.name);
    setClassName(student.class_name);
    if (student.nisn) setStudentNisn(student.nisn);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      setErrorMessage('Nama siswa wajib diisi');
      return;
    }
    if (!topic.trim()) {
      setErrorMessage('Pokok bahasan / topik konseling wajib diisi');
      return;
    }
    if (!actionTaken.trim()) {
      setErrorMessage('Arahan / tindakan konselor wajib diisi');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      if (isEdit) {
        await onSubmit({
          counseling_type: counselingType,
          urgency,
          status,
          visibility,
          topic: topic.trim(),
          background_narrative: backgroundNarrative.trim() || null,
          action_taken: actionTaken.trim(),
          student_commitment: studentCommitment.trim() || null,
          parent_involvement: parentInvolvement.trim() || null,
          follow_up_plan: followUpPlan.trim() || null,
          follow_up_date: followUpDate || null,
        } as UpdateCounselingDTO);
      } else {
        await onSubmit({
          student_id: 'std_' + Math.random().toString(36).substring(2, 9),
          student_name: studentName.trim(),
          student_nisn: studentNisn.trim() || null,
          class_name: className,
          counselor_id: counselorId,
          counselor_name: counselorName,
          counselor_npp: counselorNpp || null,
          counseling_date: counselingDate,
          counseling_time: counselingTime || null,
          counseling_type: counselingType,
          urgency,
          status,
          visibility,
          topic: topic.trim(),
          background_narrative: backgroundNarrative.trim() || null,
          action_taken: actionTaken.trim(),
          student_commitment: studentCommitment.trim() || null,
          parent_involvement: parentInvolvement.trim() || null,
          follow_up_plan: followUpPlan.trim() || null,
          follow_up_date: followUpDate || null,
          academic_year: '2026/2027',
          semester: 'GANJIL',
        } as CreateCounselingDTO);
      }

      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan catatan BK');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
      {/* Container: 100dvh on Mobile per Infinix Note 8 Rule, Rounded Dialog on Desktop */}
      <div className="w-full sm:max-w-2xl bg-white sm:rounded-2xl shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] overflow-hidden">
        {/* ── 1. ZONE HEADER (STICKY) ─────────────────────────────────── */}
        <div className="shrink-0 px-4 py-3 sm:px-6 sm:py-4 bg-linear-to-r from-emerald-800 via-teal-900 to-[#023246] text-white flex items-center justify-between border-b border-emerald-700/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
              <HeartHandshake className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black tracking-tight truncate">
                {isEdit ? 'Perbarui Catatan BK' : 'Tambah Catatan Bimbingan Konseling'}
              </h2>
              <p className="text-[11px] text-emerald-100/90 truncate flex items-center gap-1.5 font-medium">
                <span>Konselor: <strong>{counselorName}</strong></span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-200 text-[10px] border border-emerald-400/30">
                  <Globe className="w-2.5 h-2.5" />
                  Nawasena Sync
                </span>
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
        <form id="bk-record-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SINKRONISASI NAWASENA BANNER TOGGLE */}
          <div className="p-3 sm:p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-emerald-950">
                <Globe className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Publikasikan ke Nawasena Platform Siswa</span>
              </div>
              <p className="text-[11px] text-emerald-800/90 mt-0.5 leading-relaxed">
                {visibility === 'PUBLIC_STUDENT'
                  ? 'Aktif: Siswa & orang tua dapat membaca rangkuman bimbingan dan tindak lanjut ini di akun siswa mereka.'
                  : 'Privat: Catatan ini hanya dapat diakses internal oleh Guru BK, Wali Kelas, dan Kepala Sekolah.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setVisibility(visibility === 'PUBLIC_STUDENT' ? 'CONFIDENTIAL_STAFF' : 'PUBLIC_STUDENT')
              }
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                visibility === 'PUBLIC_STUDENT'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs hover:bg-emerald-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {visibility === 'PUBLIC_STUDENT' ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Publik (Siswa)</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Privat</span>
                </>
              )}
            </button>
          </div>

          {/* DATA SISWA & KELAS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Nama Siswa *</span>
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Ketik nama lengkap siswa..."
                required
                className="w-full h-11 px-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-emerald-700" />
                <span>Kelas *</span>
              </label>
              <select
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full h-11 px-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 transition-all cursor-pointer"
              >
                {CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    Kelas {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* PRESET CHIPS REKOMENDASI SISWA (JIKA TERSEDIA) */}
          {studentPresets.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Pilih Cepat Siswa Terdaftar:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto">
                {studentPresets.slice(0, 8).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleSelectStudentPreset(st)}
                    className="px-2 py-0.8 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-emerald-100 hover:text-emerald-900 text-slate-700 border border-slate-200 transition-all cursor-pointer truncate max-w-44"
                  >
                    {st.name} ({st.class_name})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TANGGAL, WAKTU & NISN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <span>Tanggal Bimbingan *</span>
              </label>
              <input
                type="date"
                value={counselingDate}
                onChange={(e) => setCounselingDate(e.target.value)}
                required
                className="w-full h-11 px-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                <span>Waktu Pelaksanaan</span>
              </label>
              <input
                type="time"
                value={counselingTime}
                onChange={(e) => setCounselingTime(e.target.value)}
                className="w-full h-11 px-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">NISN (Opsional)</label>
              <input
                type="text"
                value={studentNisn}
                onChange={(e) => setStudentNisn(e.target.value)}
                placeholder="Misal: 0098712345"
                className="w-full h-11 px-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 transition-all"
              />
            </div>
          </div>

          {/* JENIS LAYANAN, TINGKAT URGENSI, STATUS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Jenis Layanan BK *</label>
              <select
                value={counselingType}
                onChange={(e) => setCounselingType(e.target.value as CounselingType)}
                className="w-full h-11 px-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 transition-all cursor-pointer"
              >
                {Object.entries(COUNSELING_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Tingkat Urgensi *</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as CounselingUrgency)}
                className="w-full h-11 px-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 transition-all cursor-pointer"
              >
                {Object.entries(COUNSELING_URGENCY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Status Penanganan *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CounselingStatus)}
                className="w-full h-11 px-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 transition-all cursor-pointer"
              >
                {Object.entries(COUNSELING_STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* POKOK BAHASAN / TOPIK KONSELING */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Pokok Bahasan / Topik Konseling *</label>
              <span className="text-[10px] text-slate-400">Jelas & terarah</span>
            </div>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Contoh: Pembinaan Kedisiplinan Kehadiran dan Manajemen Waktu Belajar"
              required
              className="w-full h-11 px-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 transition-all"
            />
            {/* Quick chips for popular topics */}
            <div className="flex items-center gap-1 flex-wrap pt-1">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Rekomendasi Topik:
              </span>
              {POPULAR_BK_TOPICS.slice(0, 4).map((t, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTopic(t)}
                  className="px-2 py-0.5 text-[10px] rounded-md bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors border border-emerald-200/60 truncate max-w-56 cursor-pointer"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* LATAR BELAKANG / OBSERVASI KASUS */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Latar Belakang Kasus / Fakta Pengamatan</label>
            <textarea
              rows={2}
              value={backgroundNarrative}
              onChange={(e) => setBackgroundNarrative(e.target.value)}
              placeholder="Uraikan latar belakang masalah, laporan dari wali kelas/guru mata pelajaran, atau hasil observasi perilaku siswa..."
              className="w-full p-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 transition-all"
            />
          </div>

          {/* ARAHAN & TINDAKAN KONSELOR */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Arahan / Layanan / Tindakan yang Diberikan *</label>
            <textarea
              rows={3}
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              placeholder="Jelaskan teknik bimbingan yang digunakan, nasehat positif, kesepakatan solusi, dan langkah pembinaan yang disepakati..."
              required
              className="w-full p-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 transition-all"
            />
          </div>

          {/* KOMITMEN SISWA & TINDAK LANJUT ORANG TUA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Komitmen / Perjanjian Siswa</label>
              <textarea
                rows={2}
                value={studentCommitment}
                onChange={(e) => setStudentCommitment(e.target.value)}
                placeholder="Contoh: Berkomitmen hadir sebelum 07:00 dan menjaga adab bicara di kelas."
                className="w-full p-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Tindak Lanjut Bersama Orang Tua</label>
              <textarea
                rows={2}
                value={parentInvolvement}
                onChange={(e) => setParentInvolvement(e.target.value)}
                placeholder="Contoh: Orang tua telah dihubungi via telepon / diagendakan hadir ke sekolah hari Kamis."
                className="w-full p-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 transition-all"
              />
            </div>
          </div>

          {/* RENCANA EVALUASI & TANGGAL MONITORING LANJUTAN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700">Rencana Pemantauan Lanjutan</label>
              <input
                type="text"
                value={followUpPlan}
                onChange={(e) => setFollowUpPlan(e.target.value)}
                placeholder="Contoh: Koordinasi mingguan dengan wali kelas untuk memantau kehadiran"
                className="w-full h-11 px-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Tanggal Evaluasi</label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full h-11 px-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 transition-all"
              />
            </div>
          </div>
        </form>

        {/* ── 3. ZONE ACTION BAR (STICKY BOTTOM) ──────────────────────── */}
        <div className="shrink-0 p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-11 sm:h-12 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            form="bk-record-form"
            disabled={isSubmitting}
            className="h-11 sm:h-12 px-6 rounded-xl bg-linear-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Menyimpan...' : isEdit ? 'Simpan Pembaruan' : 'Simpan Catatan BK'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

