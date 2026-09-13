import React, { useState } from 'react';
import type { HomeroomStudentItem, VerifyPlanDTO } from '../../../types/homeroom.types';
import { Button } from '../../../components/ui/Button';

interface PlanVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: HomeroomStudentItem | null;
  planId?: string | null;
  studentName?: string;
  mode: 'verified' | 'needs_revision';
  onConfirm: (dto: VerifyPlanDTO) => Promise<void>;
}

export const PlanVerificationModal: React.FC<PlanVerificationModalProps> = ({
  isOpen,
  onClose,
  student,
  planId,
  studentName,
  mode,
  onConfirm,
}) => {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const effectivePlanId = student?.plan?.id || planId;
  const effectiveStudentName = student?.fullName || studentName || 'Siswa';

  if (!isOpen || !effectivePlanId) return null;

  const isApproveMode = mode === 'verified';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isApproveMode && (!notes || !notes.trim())) {
      setErrorMessage('Catatan perbaikan wajib diisi agar siswa dan orang tua memahami revisi yang diminta.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        plan_id: effectivePlanId,
        decision: mode,
        notes: notes.trim() || undefined,
      });
      setNotes('');
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menyimpan keputusan verifikasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className={`px-5 py-4 border-b ${isApproveMode ? 'bg-emerald-50/70 border-emerald-100' : 'bg-amber-50/70 border-amber-100'}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">
              {isApproveMode ? '✅' : '✏️'}
            </span>
            <div>
              <h3 id="verify-modal-title" className="text-base font-bold text-slate-800 tracking-tight">
                {isApproveMode ? 'Verifikasi & Setujui Rencana' : 'Minta Perbaikan / Revisi'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {effectiveStudentName} {student?.className ? `(${student.className})` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 leading-relaxed">
              ⚠️ {errorMessage}
            </div>
          )}

          {isApproveMode ? (
            <div className="text-xs text-slate-600 space-y-2 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              {student?.plan?.firstChoice && (
                <p className="font-semibold text-slate-700">
                  Pilihan Sekolah: {student.plan.firstChoice.schoolName || '-'} ({student.plan.continuationType})
                </p>
              )}
              <p>
                Dengan menyetujui, Anda menyatakan bahwa rencana pendidikan lanjutan siswa telah sesuai dengan kriteria dan telah mendapatkan restu orang tua.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="revision-notes" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Catatan Revisi untuk Siswa / Orang Tua <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="revision-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Lampirkan Surat Pernyataan Orang Tua terbaru atau lengkapi pilihan sekolah cadangan."
                rows={4}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all placeholder:text-slate-400"
                required
              />
              <p className="text-[11px] text-slate-600 mt-1">
                Catatan ini akan tersimpan di riwayat audit dan tampil pada notifikasi siswa.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 text-xs h-11 rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 text-xs h-11 rounded-xl text-white font-semibold transition-all ${
                isApproveMode
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-xs shadow-emerald-600/30'
                  : 'bg-amber-600 hover:bg-amber-700 shadow-xs shadow-amber-600/30'
              }`}
            >
              {isSubmitting
                ? 'Menyimpan...'
                : isApproveMode
                ? 'Ya, Setujui Rencana'
                : 'Kirim Catatan Revisi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
