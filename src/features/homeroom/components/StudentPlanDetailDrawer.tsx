import React, { useState, useEffect } from 'react';
import type {
  StudentPlanDetail,
  VerifyPlanDTO,
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

type TabType = 'CHOICES' | 'INTERESTS' | 'ACHIEVEMENTS' | 'DOCUMENTS' | 'AUDIT';

export const StudentPlanDetailDrawer: React.FC<StudentPlanDetailDrawerProps> = ({
  isOpen,
  onClose,
  studentId,
  token,
  onPlanUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('CHOICES');
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<StudentPlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setActiveTab('CHOICES');
    }
  }, [isOpen, studentId, token]);

  const loadDetail = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await HomeroomRepository.getStudentDetail(id, token);
      setDetail(data);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat rincian rencana pendidikan lanjutan.');
    } finally {
      setLoading(false);
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
        return <span className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 rounded-lg">✓ Terverifikasi</span>;
      case 'needs_revision':
        return <span className="px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-amber-100 rounded-lg">⚠️ Perlu Revisi</span>;
      case 'submitted':
      case 'pending_verification':
        return <span className="px-2.5 py-1 text-[11px] font-semibold text-sky-800 bg-sky-100 rounded-lg">⏳ Menunggu Verifikasi</span>;
      default:
        return <span className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 rounded-lg">Draft</span>;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white w-full max-w-lg h-full flex flex-col shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-250">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="p-1.5 -ml-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors"
              aria-label="Tutup detail siswa"
            >
              ✕
            </button>
            <div>
              <h2 className="text-sm font-bold text-slate-800 line-clamp-1">
                {student?.fullName || 'Memuat Detail Siswa...'}
              </h2>
              <p className="text-[11px] text-slate-600 mt-0.5">
                NISN: {student?.nisn || '-'} • Rombel: {student?.className || '-'}
              </p>
            </div>
          </div>
          <div>{getStatusBadge(plan?.status)}</div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Memuat berkas siswa...</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          {!loading && detail && (
            <>
              {/* Revision note banner if needs revision */}
              {plan?.status === 'needs_revision' && plan?.revisionNote && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800 mb-1">
                    <span>⚠️</span> Catatan Revisi Aktif:
                  </div>
                  <p className="text-[11px] text-amber-800 pl-4">{plan.revisionNote}</p>
                </div>
              )}

              {/* Tab Navigation */}
              <div className="flex border-b border-slate-200 gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('CHOICES')}
                  className={`pb-2.5 px-3 font-semibold transition-colors relative ${
                    activeTab === 'CHOICES'
                      ? 'text-emerald-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-emerald-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Pilihan ({detail.choices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('INTERESTS')}
                  className={`pb-2.5 px-3 font-semibold transition-colors relative ${
                    activeTab === 'INTERESTS'
                      ? 'text-emerald-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-emerald-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Minat
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ACHIEVEMENTS')}
                  className={`pb-2.5 px-3 font-semibold transition-colors relative ${
                    activeTab === 'ACHIEVEMENTS'
                      ? 'text-emerald-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-emerald-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Prestasi ({detail.achievements.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('DOCUMENTS')}
                  className={`pb-2.5 px-3 font-semibold transition-colors relative ${
                    activeTab === 'DOCUMENTS'
                      ? 'text-emerald-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-emerald-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Berkas ({detail.documents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('AUDIT')}
                  className={`pb-2.5 px-3 font-semibold transition-colors relative ${
                    activeTab === 'AUDIT'
                      ? 'text-emerald-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-emerald-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Riwayat
                </button>
              </div>

              {/* TAB 1: School Choices */}
              {activeTab === 'CHOICES' && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Tipe Lanjutan Utama:</span>
                    <span className="font-bold text-slate-800">{plan?.continuationType || 'Belum Menentukan'}</span>
                  </div>

                  {detail.choices.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      Belum ada sekolah pilihan yang disimpan siswa.
                    </div>
                  ) : (
                    detail.choices.map((c) => (
                      <div
                        key={c.id}
                        className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                            Prioritas {c.priority}
                          </span>
                          <span className="text-[11px] text-slate-600 font-medium">{c.schoolType}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-800">{c.schoolName}</h4>
                        {c.majorName && (
                          <p className="text-xs text-emerald-700 font-medium">Jurusan / Konsentrasi: {c.majorName}</p>
                        )}
                        {c.registrationTrack && (
                          <p className="text-[11px] text-slate-500">Jalur: {c.registrationTrack}</p>
                        )}
                        {c.notes && (
                          <p className="text-[11px] text-slate-400 italic">Catatan: &ldquo;{c.notes}&rdquo;</p>
                        )}
                      </div>
                    ))
                  )}

                  {/* Parent agreement indicator */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-600">Restu / Persetujuan Orang Tua:</span>
                    <span className={`font-semibold ${plan?.parentAgreement ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {plan?.parentAgreement ? '✓ Sudah Disetujui' : 'Belum Konfirmasi'}
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 2: Interests & Career Goals */}
              {activeTab === 'INTERESTS' && (
                <div className="space-y-3">
                  {detail.interests.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      Belum ada catatan minat dan bakat siswa.
                    </div>
                  ) : (
                    detail.interests.map((it) => (
                      <div key={it.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bidang Peminatan</span>
                          <p className="text-xs font-semibold text-slate-800 mt-0.5">{it.interestField}</p>
                        </div>
                        {it.careerGoal && (
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cita-Cita Karir</span>
                            <p className="text-xs font-medium text-emerald-700 mt-0.5">🎯 {it.careerGoal}</p>
                          </div>
                        )}
                        {it.reason && (
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Alasan Pemilihan</span>
                            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">&ldquo;{it.reason}&rdquo;</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: Achievements */}
              {activeTab === 'ACHIEVEMENTS' && (
                <div className="space-y-3">
                  {detail.achievements.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      Tidak ada catatan prestasi yang dilampirkan.
                    </div>
                  ) : (
                    detail.achievements.map((a) => (
                      <div key={a.id} className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            🏆 {a.level || 'Sekolah'}
                          </span>
                          <span className="text-[11px] text-slate-400">{a.year || '-'}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-800">{a.achievementTitle}</h4>
                        {a.organizer && <p className="text-[11px] text-slate-500">Penyelenggara: {a.organizer}</p>}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: Documents */}
              {activeTab === 'DOCUMENTS' && (
                <div className="space-y-3">
                  {detail.documents.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      Belum ada berkas pendukung yang diunggah.
                    </div>
                  ) : (
                    detail.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {doc.documentType}
                          </span>
                          <p className="text-xs font-semibold text-slate-800 truncate mt-0.5">{doc.originalFilename}</p>
                          <span className="text-[10px] text-slate-400">
                            {(doc.fileSizeBytes / 1024).toFixed(0)} KB • Status: {doc.status}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => handleDownloadDoc(doc.id, doc.originalFilename)}
                          disabled={downloadingDocId === doc.id}
                          className="text-xs h-9 px-3 rounded-lg shrink-0"
                        >
                          {downloadingDocId === doc.id ? 'Memuat...' : '📥 Unduh'}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 5: Audit Trail */}
              {activeTab === 'AUDIT' && (
                <div className="space-y-3">
                  {detail.verificationLogs.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      Belum ada riwayat verifikasi untuk rencana ini.
                    </div>
                  ) : (
                    detail.verificationLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">
                            {log.action === 'VERIFIED' ? '✅ Disetujui' : '⚠️ Diminta Revisi'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(log.createdAt).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px]">Oleh: {log.actorName} ({log.performedByType})</p>
                        {log.note && (
                          <p className="text-slate-500 text-[11px] italic bg-white p-2 rounded-lg border border-slate-100 mt-1">
                            &ldquo;{log.note}&rdquo;
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Footer (Only active if plan exists) */}
        {detail && plan?.id && (
          <div className="p-4 border-t border-slate-200 bg-white flex gap-2.5 shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenVerifyModal('needs_revision')}
              className="flex-1 text-xs h-11 rounded-xl text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-semibold"
            >
              ✏️ Minta Revisi
            </Button>
            <Button
              type="button"
              onClick={() => handleOpenVerifyModal('verified')}
              className="flex-1 text-xs h-11 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-semibold shadow-xs shadow-emerald-600/30"
            >
              ✅ Setujui Rencana
            </Button>
          </div>
        )}
      </div>

      {/* Verification Dialog */}
      <PlanVerificationModal
        isOpen={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        student={
          student && plan
            ? {
                id: student.id,
                nis: student.nis,
                nisn: student.nisn,
                fullName: student.fullName,
                className: student.className,
                gender: student.gender,
                photoUrl: student.photoUrl,
                plan: {
                  id: plan.id,
                  continuationType: plan.continuationType,
                  status: plan.status,
                  parentAgreement: plan.parentAgreement,
                  submittedAt: plan.submittedAt,
                  verifiedAt: plan.verifiedAt,
                  revisionNote: plan.revisionNote,
                  firstChoice: detail.choices[0]
                    ? {
                        schoolName: detail.choices[0].schoolName,
                        schoolType: detail.choices[0].schoolType,
                        majorName: detail.choices[0].majorName,
                      }
                    : null,
                },
              }
            : null
        }
        mode={verifyMode}
        onConfirm={handleConfirmVerification}
      />
    </div>
  );
};
