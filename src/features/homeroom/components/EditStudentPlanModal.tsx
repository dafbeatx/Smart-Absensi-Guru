import React, { useState, useEffect } from 'react';
import type {
  ContinuationType,
  PlanStatus,
  SaveStudentPlanDTO,
  StudentPlanDetail,
} from '../../../types/homeroom.types';
import { HomeroomRepository } from '../../../repositories/HomeroomRepository';
import { Button } from '../../../components/ui/Button';

interface EditStudentPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: {
    id: string;
    fullName: string;
    nisn?: string | null;
    className?: string;
  } | null;
  detail?: StudentPlanDetail | null;
  token?: string;
  onPlanSaved: () => void;
}

const CONTINUATION_TYPES: { value: ContinuationType; label: string }[] = [
  { value: 'SMA_NEGERI', label: 'SMA Negeri' },
  { value: 'SMA_SWASTA', label: 'SMA Swasta' },
  { value: 'SMK_NEGERI', label: 'SMK Negeri' },
  { value: 'SMK_SWASTA', label: 'SMK Swasta' },
  { value: 'MA_NEGERI', label: 'MA Negeri' },
  { value: 'MA_SWASTA', label: 'MA Swasta' },
  { value: 'PONDOK_PESANTREN', label: 'Pondok Pesantren' },
  { value: 'LUAR_DAERAH', label: 'Luar Daerah / Internasional' },
  { value: 'BELUM_MENENTUKAN', label: 'Belum Menentukan' },
];

const STATUS_OPTIONS: { value: PlanStatus; label: string }[] = [
  { value: 'draft', label: 'Draft (Belum Diajukan)' },
  { value: 'submitted', label: 'Diajukan Siswa' },
  { value: 'pending_verification', label: 'Menunggu Verifikasi Wali Kelas' },
  { value: 'verified', label: 'Terverifikasi & Disetujui' },
  { value: 'needs_revision', label: 'Perlu Revisi Siswa' },
];

export const EditStudentPlanModal: React.FC<EditStudentPlanModalProps> = ({
  isOpen,
  onClose,
  student,
  detail,
  token,
  onPlanSaved,
}) => {
  const [continuationType, setContinuationType] = useState<ContinuationType>('BELUM_MENENTUKAN');
  const [status, setStatus] = useState<PlanStatus>('draft');
  const [parentAgreement, setParentAgreement] = useState(false);
  const [notes, setNotes] = useState('');

  // Pilihan 1
  const [choice1School, setChoice1School] = useState('');
  const [choice1Type, setChoice1Type] = useState('SMA');
  const [choice1Major, setChoice1Major] = useState('');
  const [choice1Track, setChoice1Track] = useState('');

  // Pilihan 2
  const [choice2School, setChoice2School] = useState('');
  const [choice2Type, setChoice2Type] = useState('SMA');
  const [choice2Major, setChoice2Major] = useState('');

  // Minat & Karir
  const [interestField, setInterestField] = useState('');
  const [careerGoal, setCareerGoal] = useState('');
  const [interestReason, setInterestReason] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const effectiveToken =
    token ||
    (typeof window !== 'undefined' ? localStorage.getItem('smart_absensi_token') : null) ||
    'mock_token';

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      if (detail && detail.plan) {
        setContinuationType(detail.plan.continuationType || 'BELUM_MENENTUKAN');
        setStatus(detail.plan.status || 'draft');
        setParentAgreement(Boolean(detail.plan.parentAgreement));
        setNotes(detail.plan.revisionNote || '');

        const c1 = detail.choices && detail.choices[0];
        if (c1) {
          setChoice1School(c1.schoolName || '');
          setChoice1Type(c1.schoolType || 'SMA');
          setChoice1Major(c1.majorName || '');
          setChoice1Track(c1.registrationTrack || '');
        } else {
          setChoice1School('');
          setChoice1Type('SMA');
          setChoice1Major('');
          setChoice1Track('');
        }

        const c2 = detail.choices && detail.choices[1];
        if (c2) {
          setChoice2School(c2.schoolName || '');
          setChoice2Type(c2.schoolType || 'SMA');
          setChoice2Major(c2.majorName || '');
        } else {
          setChoice2School('');
          setChoice2Type('SMA');
          setChoice2Major('');
        }

        const it = detail.interests && detail.interests[0];
        if (it) {
          setInterestField(it.interestField || '');
          setCareerGoal(it.careerGoal || '');
          setInterestReason(it.reason || '');
        } else {
          setInterestField('');
          setCareerGoal('');
          setInterestReason('');
        }
      } else {
        // Kosongkan form untuk data baru
        setContinuationType('BELUM_MENENTUKAN');
        setStatus('draft');
        setParentAgreement(false);
        setNotes('');
        setChoice1School('');
        setChoice1Type('SMA');
        setChoice1Major('');
        setChoice1Track('');
        setChoice2School('');
        setChoice2Type('SMA');
        setChoice2Major('');
        setInterestField('');
        setCareerGoal('');
        setInterestReason('');
      }
    }
  }, [isOpen, detail]);

  if (!isOpen || !student) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const choicesPayload: SaveStudentPlanDTO['choices'] = [];
    if (choice1School.trim()) {
      choicesPayload.push({
        priority: 1,
        schoolName: choice1School.trim(),
        schoolType: choice1Type,
        majorName: choice1Major.trim() || null,
        registrationTrack: choice1Track.trim() || null,
      });
    }

    if (choice2School.trim()) {
      choicesPayload.push({
        priority: 2,
        schoolName: choice2School.trim(),
        schoolType: choice2Type,
        majorName: choice2Major.trim() || null,
      });
    }

    const interestsPayload: SaveStudentPlanDTO['interests'] = [];
    if (interestField.trim() || careerGoal.trim()) {
      interestsPayload.push({
        interestField: interestField.trim() || 'Umum',
        careerGoal: careerGoal.trim() || null,
        reason: interestReason.trim() || null,
      });
    }

    const dto: SaveStudentPlanDTO = {
      studentId: student.id,
      academicYear: '2026/2027',
      graduationYear: 2027,
      continuationType,
      status,
      parentAgreement,
      notes: notes.trim() || undefined,
      choices: choicesPayload,
      interests: interestsPayload,
    };

    try {
      const res = await HomeroomRepository.saveStudentPlan(dto, effectiveToken);
      if (!res.success) {
        throw new Error(res.message || 'Gagal menyimpan rencana studi.');
      }
      onPlanSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan saat menyimpan data rencana studi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-plan-modal-title"
    >
      <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-lg shrink-0">
              ✏️
            </div>
            <div className="min-w-0">
              <h2 id="edit-plan-modal-title" className="text-sm font-bold text-slate-800 truncate">
                Edit Rencana Studi Siswa
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {student.fullName} • Kelas {student.className || '9'} • Tahun Ajaran 2026/2027
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
            aria-label="Tutup form edit rencana studi"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Section 1: Tipe Kelanjutan & Status */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <h3 className="font-bold text-slate-700 flex items-center gap-1.5">
              <span>🎯</span> Jalur & Status Rencana Lanjutan (2026/2027)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Tipe Lanjutan Utama:
                </label>
                <select
                  value={continuationType}
                  onChange={(e) => setContinuationType(e.target.value as ContinuationType)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {CONTINUATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Status Rencana:
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PlanStatus)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Pilihan Sekolah 1 */}
          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-emerald-800 flex items-center gap-1.5">
                <span>🏫</span> Pilihan Sekolah 1 (Prioritas Utama)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md">
                Wajib / Utama
              </span>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Nama Sekolah Tujuan:
                </label>
                <input
                  type="text"
                  value={choice1School}
                  onChange={(e) => setChoice1School(e.target.value)}
                  placeholder="Contoh: SMAN 1 Bogor, SMKN 1 Cibinong"
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Jenis:</label>
                  <select
                    value={choice1Type}
                    onChange={(e) => setChoice1Type(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="SMA">SMA</option>
                    <option value="SMK">SMK</option>
                    <option value="MA">MA</option>
                    <option value="PESANTREN">Pondok Pesantren</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Jurusan / Konsentrasi:</label>
                  <input
                    type="text"
                    value={choice1Major}
                    onChange={(e) => setChoice1Major(e.target.value)}
                    placeholder="MIPA, Rekayasa Perangkat Lunak, dll."
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Jalur Masuk:</label>
                  <input
                    type="text"
                    value={choice1Track}
                    onChange={(e) => setChoice1Track(e.target.value)}
                    placeholder="Zonasi, Prestasi Rapor, Mandiri"
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Pilihan Sekolah 2 (Opsional) */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-700 flex items-center gap-1.5">
                <span>🏫</span> Pilihan Sekolah 2 (Cadangan / Alternatif)
              </h3>
              <span className="text-[10px] font-medium text-slate-400">Opsional</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-slate-600 font-semibold mb-1">Nama Sekolah Cadangan:</label>
                <input
                  type="text"
                  value={choice2School}
                  onChange={(e) => setChoice2School(e.target.value)}
                  placeholder="Contoh: SMAN 3 Bogor, SMKN 2 Cibinong"
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Jurusan:</label>
                <input
                  type="text"
                  value={choice2Major}
                  onChange={(e) => setChoice2Major(e.target.value)}
                  placeholder="MIPA, DKV, dll."
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Minat & Cita-Cita Karir */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <h3 className="font-bold text-slate-700 flex items-center gap-1.5">
              <span>💡</span> Minat, Bakat & Cita-Cita Karir
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Bidang Minat Siswa:</label>
                <input
                  type="text"
                  value={interestField}
                  onChange={(e) => setInterestField(e.target.value)}
                  placeholder="Teknologi Informasi, Seni Desain, Kedokteran"
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Cita-Cita Profesi:</label>
                <input
                  type="text"
                  value={careerGoal}
                  onChange={(e) => setCareerGoal(e.target.value)}
                  placeholder="Software Engineer, Arsitek, Dokter"
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Alasan / Catatan Pemilihan:</label>
              <textarea
                rows={2}
                value={interestReason}
                onChange={(e) => setInterestReason(e.target.value)}
                placeholder="Alasan siswa memilih jurusan atau sekolah tersebut..."
                className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
          </div>

          {/* Section 5: Restu Orang Tua & Catatan Wali Kelas */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <h3 className="font-bold text-slate-700 flex items-center gap-1.5">
              <span>👨‍👩‍👧</span> Persetujuan Orang Tua & Verifikasi Wali Kelas
            </h3>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={parentAgreement}
                onChange={(e) => setParentAgreement(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500"
              />
              <span className="text-slate-700 font-semibold">
                Orang tua / wali telah menyetujui rencana studi lanjutan siswa ini
              </span>
            </label>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Catatan Tambahan Wali Kelas:</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan hasil konsultasi atau pengarahan rencana studi..."
                className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
              className="flex-1 text-xs h-11 rounded-xl font-semibold"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 text-xs h-11 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-bold shadow-xs shadow-emerald-600/30"
            >
              {saving ? 'Menyimpan...' : '💾 Simpan Rencana Studi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
