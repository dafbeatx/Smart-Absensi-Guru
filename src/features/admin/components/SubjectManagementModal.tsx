import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToastStore } from '../../../store/useToastStore';
import type { ExtendedTeachingSlot } from './TeachingScheduleManagement';

export interface SubjectItem {
  id: string;
  name: string;
  category: 'Umum / Wajib' | 'Peminatan / Kejuruan' | 'Muatan Lokal' | 'Keagamaan' | 'Lainnya';
  code?: string;
}

export const DEFAULT_SUBJECTS: SubjectItem[] = [
  { id: 'sub_1', name: 'Pendidikan Agama Islam & Budi Pekerti', category: 'Keagamaan', code: 'PAI' },
  { id: 'sub_2', name: 'Pendidikan Pancasila & Kewarganegaraan', category: 'Umum / Wajib', code: 'PPKn' },
  { id: 'sub_3', name: 'Bahasa Indonesia', category: 'Umum / Wajib', code: 'BIND' },
  { id: 'sub_4', name: 'Matematika', category: 'Umum / Wajib', code: 'MTK' },
  { id: 'sub_5', name: 'Ilmu Pengetahuan Alam (IPA)', category: 'Umum / Wajib', code: 'IPA' },
  { id: 'sub_6', name: 'Ilmu Pengetahuan Sosial (IPS)', category: 'Umum / Wajib', code: 'IPS' },
  { id: 'sub_7', name: 'Bahasa Inggris', category: 'Umum / Wajib', code: 'BING' },
  { id: 'sub_8', name: 'Pendidikan Jasmani, Olahraga, & Kesehatan', category: 'Umum / Wajib', code: 'PJOK' },
  { id: 'sub_9', name: 'Informatika / TIK', category: 'Umum / Wajib', code: 'INF' },
  { id: 'sub_10', name: 'Seni Budaya', category: 'Umum / Wajib', code: 'SNB' },
  { id: 'sub_11', name: 'Prakarya & Kewirausahaan', category: 'Umum / Wajib', code: 'PKWU' },
  { id: 'sub_12', name: 'Bahasa Daerah / Sunda', category: 'Muatan Lokal', code: 'BSUN' },
  { id: 'sub_13', name: 'Bimbingan Konseling (BK)', category: 'Umum / Wajib', code: 'BK' },
  { id: 'sub_14', name: 'Bahasa Arab', category: 'Muatan Lokal', code: 'BARB' },
  { id: 'sub_15', name: 'Tahfidz / Al-Quran', category: 'Keagamaan', code: 'TAH' },
  { id: 'sub_16', name: 'Fisika', category: 'Peminatan / Kejuruan', code: 'FIS' },
  { id: 'sub_17', name: 'Kimia', category: 'Peminatan / Kejuruan', code: 'KIM' },
  { id: 'sub_18', name: 'Biologi', category: 'Peminatan / Kejuruan', code: 'BIO' },
  { id: 'sub_19', name: 'Ekonomi', category: 'Peminatan / Kejuruan', code: 'EKO' },
  { id: 'sub_20', name: 'Sosiologi', category: 'Peminatan / Kejuruan', code: 'SOS' },
  { id: 'sub_21', name: 'Geografi', category: 'Peminatan / Kejuruan', code: 'GEO' },
  { id: 'sub_22', name: 'Sejarah', category: 'Peminatan / Kejuruan', code: 'SEJ' },
];

export const SUBJECTS_STORAGE_KEY = 'smart_absensi_subjects';

interface SubjectManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: SubjectItem[];
  onUpdateSubjects: (subjects: SubjectItem[]) => void;
  schedules?: ExtendedTeachingSlot[];
}

export const SubjectManagementModal: React.FC<SubjectManagementModalProps> = ({
  isOpen,
  onClose,
  subjects,
  onUpdateSubjects,
  schedules = [],
}) => {
  const { showToast } = useToastStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Form add / edit state
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<SubjectItem['category']>('Umum / Wajib');
  const [codeInput, setCodeInput] = useState('');

  // Reset form
  const resetForm = () => {
    setEditingSubjectId(null);
    setNameInput('');
    setCategoryInput('Umum / Wajib');
    setCodeInput('');
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      setSearchQuery('');
    }
  }, [isOpen]);

  // Usage map for schedules
  const usageCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    schedules.forEach((slot) => {
      if (slot.subject) {
        const subName = slot.subject.trim().toLowerCase();
        map[subName] = (map[subName] || 0) + 1;
      }
    });
    return map;
  }, [schedules]);

  const handleStartEdit = (sub: SubjectItem) => {
    setEditingSubjectId(sub.id);
    setNameInput(sub.name);
    setCategoryInput(sub.category);
    setCodeInput(sub.code || '');
  };

  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();

    if (!cleanName) {
      showToast('error', 'Nama Wajib Diisi', 'Masukkan nama mata pelajaran.');
      return;
    }

    // Check duplicate name
    const isDuplicate = subjects.some(
      (s) => s.name.toLowerCase() === cleanName.toLowerCase() && s.id !== editingSubjectId
    );

    if (isDuplicate) {
      showToast('error', 'Mapel Sudah Ada', `Mata pelajaran "${cleanName}" sudah terdaftar.`);
      return;
    }

    if (editingSubjectId) {
      // Edit existing
      const updated = subjects.map((s) =>
        s.id === editingSubjectId
          ? {
              ...s,
              name: cleanName,
              category: categoryInput,
              code: codeInput.trim().toUpperCase() || undefined,
            }
          : s
      );
      onUpdateSubjects(updated);
      showToast('success', 'Mapel Diperbarui', `Mata pelajaran "${cleanName}" berhasil diperbarui.`);
      resetForm();
    } else {
      // Add new
      const newSubject: SubjectItem = {
        id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: cleanName,
        category: categoryInput,
        code: codeInput.trim().toUpperCase() || undefined,
      };
      onUpdateSubjects([newSubject, ...subjects]);
      showToast('success', 'Mapel Ditambahkan', `Mata pelajaran "${cleanName}" berhasil ditambahkan.`);
      resetForm();
    }
  };

  const handleDeleteSubject = (sub: SubjectItem) => {
    const usage = usageCountMap[sub.name.trim().toLowerCase()] || 0;
    const confirmMsg =
      usage > 0
        ? `Mata pelajaran "${sub.name}" saat ini digunakan di ${usage} jadwal mengajar.\n\nYakin tetap ingin menghapus mata pelajaran ini?`
        : `Apakah Anda yakin ingin menghapus mata pelajaran "${sub.name}"?`;

    if (window.confirm(confirmMsg)) {
      const updated = subjects.filter((s) => s.id !== sub.id);
      onUpdateSubjects(updated);
      showToast('success', 'Mapel Dihapus', `Mata pelajaran "${sub.name}" berhasil dihapus.`);
      if (editingSubjectId === sub.id) {
        resetForm();
      }
    }
  };

  const handleResetToDefault = () => {
    if (
      window.confirm(
        'Apakah Anda ingin mereset daftar mata pelajaran ke Standar Kurikulum Nasional? Data kustom akan digantikan dengan daftar standar.'
      )
    ) {
      onUpdateSubjects(DEFAULT_SUBJECTS);
      showToast('success', 'Kurikulum Direset', 'Daftar mata pelajaran telah dikembalikan ke standar.');
      resetForm();
    }
  };

  // Filtered list
  const filteredSubjects = useMemo(() => {
    return subjects.filter((sub) => {
      const matchSearch =
        sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sub.code && sub.code.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCat = selectedCategoryFilter === 'ALL' || sub.category === selectedCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [subjects, searchQuery, selectedCategoryFilter]);

  const categories: SubjectItem['category'][] = [
    'Umum / Wajib',
    'Peminatan / Kejuruan',
    'Muatan Lokal',
    'Keagamaan',
    'Lainnya',
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📚 Kelola Master Mata Pelajaran">
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* Form Add / Edit */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-[#023246] flex items-center gap-1.5">
              <span>{editingSubjectId ? '✏️ Edit Mata Pelajaran' : '➕ Tambah Mata Pelajaran Baru'}</span>
            </h4>
            {editingSubjectId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-700 underline cursor-pointer"
              >
                Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSaveSubject} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">Nama Mata Pelajaran *</label>
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Contoh: Matematika Terpadu / Robotika"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">Kode Mapel (Opsional)</label>
                <Input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="Contoh: MTK"
                  maxLength={8}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-2.5 pt-1">
              <div className="flex-1 space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">Kategori Mapel</label>
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value as SubjectItem['category'])}
                  className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none cursor-pointer"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="px-4 py-2 text-xs font-extrabold rounded-xl shadow-xs shrink-0 flex items-center justify-center gap-1.5"
              >
                {editingSubjectId ? '💾 Simpan Perubahan' : '➕ Tambah Mapel'}
              </Button>
            </div>
          </form>
        </div>

        {/* Filter & Search Bar */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-[#023246]">
              Daftar Mata Pelajaran ({filteredSubjects.length} dari {subjects.length})
            </span>
            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              🔄 Reset ke Kurikulum Standar
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Cari nama atau kode mapel..."
              />
            </div>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none cursor-pointer shrink-0"
            >
              <option value="ALL">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Subjects List */}
        <div className="space-y-2">
          {filteredSubjects.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400 font-medium">
              Tidak ada mata pelajaran yang cocok dengan pencarian "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredSubjects.map((sub) => {
                const count = usageCountMap[sub.name.trim().toLowerCase()] || 0;
                const isSelectedForEdit = editingSubjectId === sub.id;

                return (
                  <div
                    key={sub.id}
                    className={`p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2 ${
                      isSelectedForEdit
                        ? 'bg-emerald-50/50 border-emerald-400 ring-2 ring-emerald-200'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {sub.code && (
                            <span className="px-1.5 py-0.5 text-[9px] font-mono font-black uppercase bg-slate-100 text-slate-700 rounded-md border border-slate-200 shrink-0">
                              {sub.code}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md shrink-0 ${
                              sub.category === 'Keagamaan'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : sub.category === 'Muatan Lokal'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : sub.category === 'Peminatan / Kejuruan'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {sub.category}
                          </span>
                        </div>
                        <p className="text-xs font-black text-[#023246] truncate">{sub.name}</p>
                      </div>

                      {count > 0 && (
                        <span
                          title={`${count} jadwal mengajar menggunakan mapel ini`}
                          className="px-2 py-0.5 text-[10px] font-extrabold bg-[#023246]/5 text-[#023246] rounded-full shrink-0"
                        >
                          {count} jadwal
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(sub)}
                        className="px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubject(sub)}
                        className="px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 flex items-center justify-end border-t border-slate-100">
          <Button variant="secondary" type="button" onClick={onClose} className="px-5 py-2 text-xs font-extrabold">
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
};
