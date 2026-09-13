import React, { useState, useEffect, useRef } from 'react';
import type {
  StudentPlanDetail,
  VerifyPlanDTO,
  ContinuationType,
  StudentDocumentItem,
} from '../../../types/homeroom.types';
import { HomeroomRepository } from '../../../repositories/HomeroomRepository';
import { PlanVerificationModal } from './PlanVerificationModal';
import { Button } from '../../../components/ui/Button';

interface StudentPlanDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
  token: string;
  onPlanUpdated: () => void;
}

type TabType = 'PLAN_EDIT' | 'DOCUMENTS' | 'INTERESTS' | 'AUDIT';

export const StudentPlanDetailDrawer: React.FC<StudentPlanDetailDrawerProps> = ({
  isOpen,
  onClose,
  studentId,
  token,
  onPlanUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('PLAN_EDIT');
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<StudentPlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Form edit states (lihat daftar -> pilih siswa -> isi data -> simpan)
  const [continuationType, setContinuationType] = useState<ContinuationType>('SMA_NEGERI');
  const [firstSchoolName, setFirstSchoolName] = useState('');
  const [firstMajorName, setFirstMajorName] = useState('');
  const [secondSchoolName, setSecondSchoolName] = useState('');
  const [secondMajorName, setSecondMajorName] = useState('');
  const [parentAgreement, setParentAgreement] = useState(false);
  const [parentNotes, setParentNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Document upload states (upload dokumen nyaman dari kamera/gallery HP)
  const [uploadDocType, setUploadDocType] = useState('KK');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Verification dialog state
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyMode, setVerifyMode] = useState<'verified' | 'needs_revision'>('verified');
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && studentId && token) {
      loadDetail(studentId);
    } else {
      setDetail(null);
      setError(null);
      setSaveSuccessMsg(null);
      setUploadSuccessMsg(null);
      setSelectedFile(null);
      setFileBase64(null);
      setActiveTab('PLAN_EDIT');
    }
  }, [isOpen, studentId, token]);

  const loadDetail = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await HomeroomRepository.getStudentDetail(id, token);
      setDetail(data);

      // Populate form data
      if (data.plan) {
        setContinuationType(data.plan.continuationType || 'SMA_NEGERI');
        setParentAgreement(Boolean(data.plan.parentAgreement));
      }

      const choice1 = data.choices.find((c) => c.priority === 1);
      if (choice1) {
        setFirstSchoolName(choice1.schoolName || '');
        setFirstMajorName(choice1.majorName || '');
      } else {
        setFirstSchoolName('');
        setFirstMajorName('');
      }

      const choice2 = data.choices.find((c) => c.priority === 2);
      if (choice2) {
        setSecondSchoolName(choice2.schoolName || '');
        setSecondMajorName(choice2.majorName || '');
      } else {
        setSecondSchoolName('');
        setSecondMajorName('');
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat rincian rencana pendidikan lanjutan.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !token) return;

    setIsSaving(true);
    setSaveSuccessMsg(null);
    setError(null);

    try {
      await HomeroomRepository.savePlan(
        {
          student_id: studentId,
          continuation_type: continuationType,
          parent_agreement: parentAgreement,
          first_choice_school_name: firstSchoolName,
          first_choice_major_name: firstMajorName,
          second_choice_school_name: secondSchoolName,
          second_choice_major_name: secondMajorName,
          parent_notes: parentNotes,
        },
        token
      );

      setSaveSuccessMsg('Data rencana pendidikan lanjutan berhasil disimpan.');
      await loadDetail(studentId);
      onPlanUpdated();
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan rencana siswa.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadDocument = async () => {
    if (!studentId || !fileBase64 || !selectedFile || !token) return;

    setIsUploading(true);
    setUploadSuccessMsg(null);
    setError(null);

    try {
      await HomeroomRepository.uploadDocument(
        {
          student_id: studentId,
          document_type: uploadDocType,
          file_base64: fileBase64,
          file_name: selectedFile.name,
          mime_type: selectedFile.type,
        },
        token
      );

      setUploadSuccessMsg(`Dokumen ${uploadDocType} berhasil diunggah.`);
      setSelectedFile(null);
      setFileBase64(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadDetail(studentId);
      onPlanUpdated();
      setTimeout(() => setUploadSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Gagal mengunggah dokumen.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenVerifyModal = (mode: 'verified' | 'needs_revision') => {
    setVerifyMode(mode);
    setVerifyModalOpen(true);
  };

  const handleConfirmVerification = async (dto: VerifyPlanDTO) => {
    await HomeroomRepository.verifyPlan(dto, token);
    if (studentId) {
      await loadDetail(studentId);
    }
    onPlanUpdated();
  };

  const handleDownloadDoc = async (documentId: string, filename: string) => {
    setDownloadingDocId(documentId);
    try {
      const url = await HomeroomRepository.getDocumentUrl(documentId, token);
      if (typeof window !== 'undefined') {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      alert(`Gagal mengunduh dokumen: ${err?.message || 'Kesalahan server'}`);
    } finally {
      setDownloadingDocId(null);
    }
  };

  if (!isOpen) return null;

  const plan = detail?.plan;
  const student = detail?.student;

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 rounded-full">
            ✓ Terverifikasi
          </span>
        );
      case 'needs_revision':
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold text-amber-800 bg-amber-100 rounded-full">
            ⚠️ Perlu Revisi
          </span>
        );
      case 'submitted':
      case 'pending_verification':
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold text-sky-800 bg-sky-100 rounded-full">
            ⏳ Menunggu Verifikasi
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 rounded-full">
            Draft
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Mobile-First Full Viewport Drawer (Target: Infinix Note 8 / 360px-412px, Slide-over on Desktop) */}
      <div className="bg-slate-50 w-full sm:max-w-lg h-full flex flex-col shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Sticky Header with Thumb-Friendly Back Button */}
        <header className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between gap-3 safe-top">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onClose}
              type="button"
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-lg font-bold shrink-0 transition-colors cursor-pointer"
              aria-label="Kembali ke daftar siswa"
            >
              ←
            </button>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {student?.fullName || 'Memuat Data Siswa...'}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                Kelas {student?.className || '-'} • NISN: {student?.nisn || '-'}
              </p>
            </div>
          </div>
          <div>{getStatusBadge(plan?.status)}</div>
        </header>

        {/* Horizontal Tab Navigation (Mobile One-Thumb Friendly) */}
        <nav className="px-4 py-2 bg-white border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('PLAN_EDIT')}
            className={`h-9 px-3 rounded-lg font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'PLAN_EDIT'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📋 Rencana Studi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('DOCUMENTS')}
            className={`h-9 px-3 rounded-lg font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'DOCUMENTS'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📁 Berkas Dokumen ({detail?.documents.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('INTERESTS')}
            className={`h-9 px-3 rounded-lg font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'INTERESTS'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🌟 Minat & Prestasi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('AUDIT')}
            className={`h-9 px-3 rounded-lg font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'AUDIT'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📜 Riwayat Log
          </button>
        </nav>

        {/* Scrollable Content Body */}
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 space-y-4 overscroll-contain">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold text-slate-500">Memuat berkas siswa...</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 leading-relaxed font-medium">
              ⚠️ {error}
            </div>
          )}

          {saveSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 leading-relaxed font-bold flex items-center gap-2">
              <span>✓</span> {saveSuccessMsg}
            </div>
          )}

          {uploadSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 leading-relaxed font-bold flex items-center gap-2">
              <span>✓</span> {uploadSuccessMsg}
            </div>
          )}

          {/* Revision Banner if status is needs_revision */}
          {plan?.status === 'needs_revision' && plan?.revisionNote && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-800">
                <span>⚠️</span> Catatan Revisi dari Wali Kelas / Verifikator:
              </div>
              <p className="font-medium leading-relaxed">{plan.revisionNote}</p>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: RENCANA STUDI & FORM INPUT (Optimized for One-Handed Use)  */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {!loading && activeTab === 'PLAN_EDIT' && (
            <form onSubmit={handleSavePlan} className="space-y-4">
              {/* Card 1: Jalur / Tipe Kelanjutan */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                <label className="block text-xs font-bold text-slate-800">
                  Tipe Sekolah Lanjutan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={continuationType}
                  onChange={(e) => setContinuationType(e.target.value as ContinuationType)}
                  className="w-full h-11 text-xs sm:text-sm px-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-medium text-slate-800 cursor-pointer"
                >
                  <option value="SMA_NEGERI">SMA Negeri</option>
                  <option value="SMA_SWASTA">SMA Swasta</option>
                  <option value="SMK_NEGERI">SMK Negeri</option>
                  <option value="SMK_SWASTA">SMK Swasta</option>
                  <option value="MA_NEGERI">MA Negeri</option>
                  <option value="MA_SWASTA">MA Swasta</option>
                  <option value="PONDOK_PESANTREN">Pondok Pesantren</option>
                  <option value="LUAR_DAERAH">Luar Daerah / Luar Negeri</option>
                  <option value="BELUM_MENENTUKAN">Belum Menentukan</option>
                </select>
              </div>

              {/* Card 2: Pilihan Sekolah 1 */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-extrabold">1</span>
                    Pilihan Utama (Prioritas 1)
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">Wajib</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nama Sekolah</label>
                  <input
                    type="text"
                    value={firstSchoolName}
                    onChange={(e) => setFirstSchoolName(e.target.value)}
                    placeholder="Contoh: SMAN 1 Bogor / SMKN 1 Cibinong"
                    className="w-full h-11 text-xs sm:text-sm px-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Jurusan / Peminatan</label>
                  <input
                    type="text"
                    value={firstMajorName}
                    onChange={(e) => setFirstMajorName(e.target.value)}
                    placeholder="Contoh: MIPA / Rekayasa Perangkat Lunak"
                    className="w-full h-11 text-xs sm:text-sm px-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-slate-800 font-medium"
                  />
                </div>
              </div>

              {/* Card 3: Pilihan Sekolah 2 (Cadangan) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-extrabold">2</span>
                    Pilihan Cadangan (Prioritas 2)
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">Opsional</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nama Sekolah Cadangan</label>
                  <input
                    type="text"
                    value={secondSchoolName}
                    onChange={(e) => setSecondSchoolName(e.target.value)}
                    placeholder="Contoh: SMAN 3 Bogor / SMKN 2 Bogor"
                    className="w-full h-11 text-xs sm:text-sm px-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Jurusan Cadangan</label>
                  <input
                    type="text"
                    value={secondMajorName}
                    onChange={(e) => setSecondMajorName(e.target.value)}
                    placeholder="Contoh: IPS / Teknik Komputer & Jaringan"
                    className="w-full h-11 text-xs sm:text-sm px-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-slate-800 font-medium"
                  />
                </div>
              </div>

              {/* Card 4: Persetujuan Orang Tua */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={parentAgreement}
                    onChange={(e) => setParentAgreement(e.target.checked)}
                    className="w-5 h-5 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Persetujuan Orang Tua / Wali Siswa
                    </span>
                    <span className="text-[11px] text-slate-500 leading-snug block mt-0.5">
                      Orang tua telah diajak berdialog dan menyetujui rencana studi yang dipilih.
                    </span>
                  </div>
                </label>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Catatan Tambahan Orang Tua (Opsional)</label>
                  <textarea
                    rows={2}
                    value={parentNotes}
                    onChange={(e) => setParentNotes(e.target.value)}
                    placeholder="Contoh: Orang tua menyetujui jika masuk lewat jalur zonasi."
                    className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-slate-800 font-medium"
                  />
                </div>
              </div>

              {/* Save Button (Finger-Friendly Touch Target 46px) */}
              <Button
                type="submit"
                variant="primary"
                disabled={isSaving}
                className="w-full h-12 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSaving ? 'Menyimpan Perubahan...' : '💾 Simpan Rencana Siswa'}
              </Button>
            </form>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: UPLOAD BERKAS DOKUMEN (Kamera HP / Gallery / File Manager)  */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {!loading && activeTab === 'DOCUMENTS' && (
            <div className="space-y-4">
              {/* Direct HP Upload Card */}
              <div className="p-4 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/20 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📷</span>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Upload Dokumen Baru</h3>
                    <p className="text-[10px] text-slate-500">Ambil foto via kamera HP atau pilih berkas PDF/JPG.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jenis Dokumen</label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    className="w-full h-11 text-xs px-3 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="KK">Kartu Keluarga (KK)</option>
                    <option value="KTP_AYAH">KTP Ayah</option>
                    <option value="KTP_IBU">KTP Ibu</option>
                    <option value="AKTA_KELAHIRAN">Akta Kelahiran</option>
                    <option value="RAPOR">Buku Rapor Siswa</option>
                    <option value="IJAZAH_SD">Ijazah SD</option>
                    <option value="KIP_KKS_PKH">Kartu Indonesia Pintar (KIP/PKH)</option>
                    <option value="LAINNYA">Surat Pernyataan / Lainnya</option>
                  </select>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="hidden"
                  id="mobile-camera-file-input"
                />

                <div className="flex gap-2">
                  <label
                    htmlFor="mobile-camera-file-input"
                    className="flex-1 h-11 rounded-xl border border-slate-300 hover:bg-slate-100 bg-white text-slate-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <span>📷</span>
                    <span>{selectedFile ? 'Ganti Foto' : 'Ambil Foto / Pilih File'}</span>
                  </label>

                  {selectedFile && (
                    <Button
                      type="button"
                      variant="primary"
                      disabled={isUploading}
                      onClick={handleUploadDocument}
                      className="h-11 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    >
                      {isUploading ? 'Mengunggah...' : '⬆️ Upload'}
                    </Button>
                  )}
                </div>

                {selectedFile && (
                  <div className="p-2.5 bg-slate-100 rounded-lg text-[11px] text-slate-700 flex items-center justify-between">
                    <span className="truncate font-semibold">{selectedFile.name}</span>
                    <span className="text-slate-400 shrink-0 ml-2">
                      ({(selectedFile.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                )}
              </div>

              {/* Document List */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Berkas Terlampir ({detail?.documents.length || 0})
                </h3>

                {detail?.documents.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                    Belum ada berkas dokumen kependudukan yang diunggah.
                  </div>
                ) : (
                  detail?.documents.map((doc: StudentDocumentItem) => (
                    <div
                      key={doc.id}
                      className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2.5 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 flex items-center justify-center text-sm shrink-0">
                          📄
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {doc.documentType.replace(/_/g, ' ')}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {doc.originalFilename} • {(doc.fileSizeBytes / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={downloadingDocId === doc.id}
                        onClick={() => handleDownloadDoc(doc.id, doc.originalFilename)}
                        className="h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        {downloadingDocId === doc.id ? 'Memuat...' : 'Lihat Dokumen ↗'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: MINAT, BAKAT & PRESTASI                                     */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {!loading && activeTab === 'INTERESTS' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Minat & Cita-Cita Karier
                </h3>
                {detail?.interests.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3">Belum ada catatan minat & cita-cita.</p>
                ) : (
                  detail?.interests.map((it) => (
                    <div key={it.id} className="p-3 bg-slate-50 rounded-lg space-y-1">
                      <p className="text-xs font-bold text-slate-800">🎯 {it.interestField}</p>
                      {it.reason && <p className="text-[11px] text-slate-600">Alasan: {it.reason}</p>}
                      {it.careerGoal && (
                        <p className="text-[11px] text-emerald-700 font-semibold">Cita-cita: {it.careerGoal}</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Prestasi & Sertifikat ({detail?.achievements.length || 0})
                </h3>
                {detail?.achievements.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3">Belum ada catatan prestasi yang dilampirkan.</p>
                ) : (
                  detail?.achievements.map((ac) => (
                    <div key={ac.id} className="p-3 bg-slate-50 rounded-lg space-y-1">
                      <p className="text-xs font-bold text-slate-800">🏆 {ac.achievementTitle}</p>
                      <p className="text-[11px] text-slate-500">
                        Tingkat: {ac.level || '-'} • Tahun: {ac.year || '-'} • Penyelenggara: {ac.organizer || '-'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 4: RIWAYAT LOG AUDIT                                           */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {!loading && activeTab === 'AUDIT' && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Riwayat Jejak Verifikasi
              </h3>
              {detail?.verificationLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Belum ada riwayat verifikasi untuk siswa ini.</p>
              ) : (
                <div className="space-y-3 border-l-2 border-slate-200 pl-3">
                  {detail?.verificationLogs.map((log) => (
                    <div key={log.id} className="relative space-y-0.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{log.actorName || log.performedByUserId}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {new Date(log.createdAt).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <p className="text-slate-700 font-medium">Aksi: {log.action}</p>
                      {log.note && <p className="text-[11px] text-slate-500 italic">"{log.note}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Sticky Action Footer (Thumb Zone for Infinix Note 8 / One-Handed Verification) */}
        <footer className="px-4 py-3 bg-white/95 backdrop-blur-xs border-t border-slate-200 shrink-0 flex items-center gap-2.5 safe-bottom z-30">
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleOpenVerifyModal('needs_revision')}
            className="flex-1 h-12 rounded-xl text-xs sm:text-sm font-bold border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            ⚠️ Minta Revisi
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={() => handleOpenVerifyModal('verified')}
            className="flex-1 h-12 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            ✓ Setujui Rencana
          </Button>
        </footer>
      </div>

      {/* Confirmation Modal for Verification / Revision */}
      <PlanVerificationModal
        isOpen={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        mode={verifyMode}
        planId={plan?.id || null}
        studentName={student?.fullName || ''}
        onConfirm={handleConfirmVerification}
      />
    </div>
  );
};
