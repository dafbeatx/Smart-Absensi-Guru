import React, { useState, useEffect } from 'react';
import {
  X,
  Award,
  Calendar,
  FileCheck,
  Link as LinkIcon,
  FileText,
  Save,
  Sparkles,
} from 'lucide-react';
import type { UserProfile } from '../../../types/database.types';
import type {
  BimtekRecord,
  CreateBimtekDTO,
  UpdateBimtekDTO,
  BimtekActivityType,
  BimtekScope,
  BimtekRole,
  BimtekMethod,
} from '../../../types/bimtek.types';
import {
  BIMTEK_ACTIVITY_LABELS,
  BIMTEK_SCOPE_LABELS,
  BIMTEK_ROLE_LABELS,
  BIMTEK_METHOD_LABELS,
  POPULAR_BIMTEK_ORGANIZERS,
} from '../../../types/bimtek.types';
import { getTodayDateInJakarta } from '../../../utils/time.utils';

export interface BimtekRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateBimtekDTO | UpdateBimtekDTO) => Promise<void>;
  editRecord?: BimtekRecord | null;
  currentUser?: UserProfile | null;
  academicYear?: string;
}

export const BimtekRecordModal: React.FC<BimtekRecordModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editRecord,
  currentUser,
  academicYear = '2026/2027',
}) => {
  const isEditing = Boolean(editRecord);

  // Form State
  const [title, setTitle] = useState('');
  const [activityType, setActivityType] = useState<BimtekActivityType>('BIMTEK');
  const [organizer, setOrganizer] = useState('');
  const [scope, setScope] = useState<BimtekScope>('KOTA_KABUPATEN');
  const [role, setRole] = useState<BimtekRole>('PESERTA');
  const [executionMethod, setExecutionMethod] = useState<BimtekMethod>('DARING');
  const [startDate, setStartDate] = useState(getTodayDateInJakarta());
  const [endDate, setEndDate] = useState(getTodayDateInJakarta());
  const [durationHours, setDurationHours] = useState(32);
  const [locationOrPlatform, setLocationOrPlatform] = useState('');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [certificateDate, setCertificateDate] = useState('');
  const [certificateUrl, setCertificateUrl] = useState('');
  const [assignmentLetterNumber, setAssignmentLetterNumber] = useState('');
  const [summaryNotes, setSummaryNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Prefill when editing
  useEffect(() => {
    if (editRecord) {
      setTitle(editRecord.title || '');
      setActivityType(editRecord.activity_type || 'BIMTEK');
      setOrganizer(editRecord.organizer || '');
      setScope(editRecord.scope || 'KOTA_KABUPATEN');
      setRole(editRecord.role || 'PESERTA');
      setExecutionMethod(editRecord.execution_method || 'DARING');
      setStartDate(editRecord.start_date || getTodayDateInJakarta());
      setEndDate(editRecord.end_date || getTodayDateInJakarta());
      setDurationHours(editRecord.duration_hours || 32);
      setLocationOrPlatform(editRecord.location_or_platform || '');
      setCertificateNumber(editRecord.certificate_number || '');
      setCertificateDate(editRecord.certificate_date || '');
      setCertificateUrl(editRecord.certificate_url || '');
      setAssignmentLetterNumber(editRecord.assignment_letter_number || '');
      setSummaryNotes(editRecord.summary_notes || '');
    } else {
      setTitle('');
      setActivityType('BIMTEK');
      setOrganizer('BBGP Jawa Barat (Balai Guru Penggerak)');
      setScope('KOTA_KABUPATEN');
      setRole('PESERTA');
      setExecutionMethod('DARING');
      setStartDate(getTodayDateInJakarta());
      setEndDate(getTodayDateInJakarta());
      setDurationHours(32);
      setLocationOrPlatform('Zoom Meeting & LMS PMM');
      setCertificateNumber('');
      setCertificateDate('');
      setCertificateUrl('');
      setAssignmentLetterNumber('');
      setSummaryNotes('');
    }
    setErrorMessage(null);
  }, [editRecord, isOpen]);

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validasi input form
    if (!title.trim() || title.trim().length < 5) {
      setErrorMessage('Nama atau judul kegiatan bimtek minimal 5 karakter.');
      return;
    }
    if (!organizer.trim()) {
      setErrorMessage('Penyelenggara kegiatan wajib diisi.');
      return;
    }
    if (!locationOrPlatform.trim()) {
      setErrorMessage('Lokasi fisik atau platform pelaksanaan wajib diisi.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMessage('Tanggal pelaksanaan kegiatan wajib dipilih.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setErrorMessage('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      return;
    }
    if (durationHours < 1 || durationHours > 500) {
      setErrorMessage('Durasi kegiatan harus antara 1 sampai 500 Jam Pelajaran (JP).');
      return;
    }

    try {
      setIsSubmitting(true);
      if (isEditing) {
        const updatePayload: UpdateBimtekDTO = {
          title: title.trim(),
          activity_type: activityType,
          organizer: organizer.trim(),
          scope,
          role,
          execution_method: executionMethod,
          start_date: startDate,
          end_date: endDate,
          duration_hours: Number(durationHours),
          location_or_platform: locationOrPlatform.trim(),
          certificate_number: certificateNumber.trim() || null,
          certificate_date: certificateDate || null,
          certificate_url: certificateUrl.trim() || null,
          assignment_letter_number: assignmentLetterNumber.trim() || null,
          summary_notes: summaryNotes.trim() || null,
          academic_year: academicYear,
        };
        await onSave(updatePayload);
      } else {
        const createPayload: CreateBimtekDTO = {
          user_id: currentUser?.id || 'usr_guru_001',
          teacher_name: currentUser?.full_name || 'Bapak/Ibu Guru',
          teacher_nip: currentUser?.nip || null,
          teacher_avatar: currentUser?.avatar_url || null,
          title: title.trim(),
          activity_type: activityType,
          organizer: organizer.trim(),
          scope,
          role,
          execution_method: executionMethod,
          start_date: startDate,
          end_date: endDate,
          duration_hours: Number(durationHours),
          location_or_platform: locationOrPlatform.trim(),
          certificate_number: certificateNumber.trim() || null,
          certificate_date: certificateDate || null,
          certificate_url: certificateUrl.trim() || null,
          assignment_letter_number: assignmentLetterNumber.trim() || null,
          summary_notes: summaryNotes.trim() || null,
          academic_year: academicYear,
        };
        await onSave(createPayload);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat menyimpan catatan bimtek.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 md:p-4 md:backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full h-dvh md:h-auto md:max-h-[92vh] md:max-w-2xl bg-white md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* 1. STICKY HEADER (56px) - Safe Area Mobile */}
        <header className="h-14 sm:h-16 px-4 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center justify-between shrink-0 sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 truncate leading-snug">
                {isEditing ? 'Ubah Catatan Bimtek' : 'Catat Kegiatan Bimtek & Diklat'}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                Tahun Ajaran {academicYear} • Arsip Resmi e-Kinerja & Akreditasi
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
        <form id="bimtek-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2">
              <span className="shrink-0 text-base">⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Informasi Pokok Kegiatan */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Identitas Kegiatan Pengembangan Diri</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama / Judul Kegiatan Bimtek / Pelatihan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Bimtek Pemanfaatan AI untuk Asesmen Pembelajaran SMP"
                required
                className="w-full h-11 px-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-medium text-slate-900 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jenis Kegiatan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value as BimtekActivityType)}
                  className="w-full h-11 px-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-medium text-slate-900 transition-all cursor-pointer"
                >
                  {Object.entries(BIMTEK_ACTIVITY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {String(label)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tingkat / Cakupan Wilayah <span className="text-rose-500">*</span>
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as BimtekScope)}
                  className="w-full h-11 px-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-medium text-slate-900 transition-all cursor-pointer"
                >
                  {Object.entries(BIMTEK_SCOPE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {String(label)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Penyelenggara dengan Quick Chips */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lembaga Penyelenggara <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={organizer}
                  onChange={(e) => setOrganizer(e.target.value)}
                  placeholder="Ketik nama penyelenggara atau pilih rekomendasi di bawah"
                  required
                  className="w-full h-11 px-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-medium text-slate-900 transition-all placeholder:text-slate-400"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Rekomendasi:</span>
                {POPULAR_BIMTEK_ORGANIZERS.slice(0, 5).map((org: string) => (
                  <button
                    key={org}
                    type="button"
                    onClick={() => setOrganizer(org)}
                    className="px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold transition-all border border-indigo-200/60 active:scale-95 cursor-pointer"
                  >
                    + {org.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Peran Guru <span className="text-rose-500">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as BimtekRole)}
                  className="w-full h-11 px-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-medium text-slate-900 transition-all cursor-pointer"
                >
                  {Object.entries(BIMTEK_ROLE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {String(label)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Metode Pelaksanaan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={executionMethod}
                  onChange={(e) => setExecutionMethod(e.target.value as BimtekMethod)}
                  className="w-full h-11 px-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-medium text-slate-900 transition-all cursor-pointer"
                >
                  {Object.entries(BIMTEK_METHOD_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {String(label)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Waktu, Durasi, dan Tempat */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Waktu Pelaksanaan & Beban Belajar</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tanggal Mulai <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full h-11 px-3 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none font-medium text-slate-900 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tanggal Selesai <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full h-11 px-3 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none font-medium text-slate-900 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Beban Belajar (JP) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={durationHours}
                    onChange={(e) => setDurationHours(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    required
                    className="w-full h-11 pl-3 pr-10 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none font-black text-slate-900 transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    JP
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lokasi Fisik / Tautan Ruang Virtual <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={locationOrPlatform}
                onChange={(e) => setLocationOrPlatform(e.target.value)}
                placeholder="Contoh: Zoom Meeting ID / BBGP Jawa Barat / Aula Utama SMPT"
                required
                className="w-full h-11 px-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none font-medium text-slate-900 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Section 3: Sertifikat & Bukti Dokumen */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <FileCheck className="w-4 h-4 text-amber-600" />
              <span>Sertifikat & Dokumen Pendukung (Opsional)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Sertifikat / Piagam
                </label>
                <input
                  type="text"
                  value={certificateNumber}
                  onChange={(e) => setCertificateNumber(e.target.value)}
                  placeholder="Contoh: 1245/B.BBGP/PK.01/2026"
                  className="w-full h-11 px-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none font-medium text-slate-900 transition-all placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tanggal Terbit Sertifikat
                </label>
                <input
                  type="date"
                  value={certificateDate}
                  onChange={(e) => setCertificateDate(e.target.value)}
                  className="w-full h-11 px-3 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none font-medium text-slate-900 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tautan Berkas Sertifikat (Google Drive / Cloud URL)
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={certificateUrl}
                  onChange={(e) => setCertificateUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full h-11 pl-9 pr-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none font-medium text-slate-900 transition-all placeholder:text-slate-400"
                />
                <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nomor Surat Tugas Sekolah (Jika Ada)
              </label>
              <input
                type="text"
                value={assignmentLetterNumber}
                onChange={(e) => setAssignmentLetterNumber(e.target.value)}
                placeholder="Contoh: 421.3/089/SMPT-AL/ST/2026"
                className="w-full h-11 px-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none font-medium text-slate-900 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Section 4: Ringkasan Materi & RTL */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Ringkasan Materi & Rencana Tindak Lanjut (RTL)</span>
            </div>
            <textarea
              rows={3}
              value={summaryNotes}
              onChange={(e) => setSummaryNotes(e.target.value)}
              placeholder="Deskripsikan secara ringkas substansi materi yang diperoleh dan rencana diseminasi / penerapannya kepada rekan sejawat atau siswa di kelas..."
              className="w-full p-3 text-sm sm:text-base bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none font-medium text-slate-900 transition-all placeholder:text-slate-400"
            />
          </div>
        </form>

        {/* 3. STICKY ACTION BAR (Thumb Zone / Footer) */}
        <footer className="h-16 px-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 sticky bottom-0 z-20 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-12 px-5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
          >
            Batal
          </button>

          <button
            type="submit"
            form="bimtek-form"
            disabled={isSubmitting}
            className="flex-1 h-12 rounded-xl bg-[#023246] hover:bg-[#03445e] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Menyimpan Data...</span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isEditing ? 'Simpan Perubahan' : 'Kirim Catatan Bimtek'}</span>
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};
