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

const CATEGORIES: SubjectItem['category'][] = [
  'Umum / Wajib',
  'Keagamaan',
  'Muatan Lokal',
  'Peminatan / Kejuruan',
  'Lainnya',
];

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

  // Form toggle & state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<SubjectItem['category']>('Umum / Wajib');
  const [codeInput, setCodeInput] = useState('');

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingSubjectId(null);
    setNameInput('');
    setCategoryInput('Umum / Wajib');
    setCodeInput('');
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      setSearchQuery('');
      setSelectedCategoryFilter('ALL');
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

  const handleStartAdd = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleStartEdit = (sub: SubjectItem) => {
    setEditingSubjectId(sub.id);
    setNameInput(sub.name);
    setCategoryInput(sub.category);
    setCodeInput(sub.code || '');
    setIsFormOpen(true);
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

  const getCategoryBadgeClass = (category: SubjectItem['category']) => {
    switch (category) {
      case 'Keagamaan':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Muatan Lokal':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'Peminatan / Kejuruan':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Umum / Wajib':
      default:
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="lg">
      <div className="space-y-4 max-h-[80vh] flex flex-col">
        {/* Header Section */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg shrink-0">
              📚
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#023246]">Kelola Mata Pelajaran</h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {subjects.length} mata pelajaran terdaftar
              </p>
            </div>
          </div>

          {!isFormOpen && (
            <button
              type="button"
              onClick={handleStartAdd}
              className="px-3 py-1.5 text-xs font-extrabold bg-[#023246] hover:bg-[#287094] text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>➕</span> Tambah Mapel
            </button>
          )}
        </div>

        {/* Collapsible Add / Edit Form */}
        {isFormOpen && (
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#023246] flex items-center gap-1.5">
                {editingSubjectId ? '✏️ Edit Mata Pelajaran' : '➕ Tambah Mata Pelajaran Baru'}
              </span>
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Batal
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Nama Mata Pelajaran *
                  </label>
                  <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Contoh: Matematika Terpadu"
                    autoFocus
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Kode Singkat
                  </label>
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
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Kategori
                  </label>
                  <select
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value as SubjectItem['category'])}
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none cursor-pointer"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetForm}
                    className="px-3 py-2 text-xs font-bold"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    className="px-4 py-2 text-xs font-extrabold shadow-xs"
                  >
                    {editingSubjectId ? 'Simpan' : 'Tambahkan'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Search & Filter Category Pills */}
        <div className="space-y-2">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Cari mata pelajaran..."
              className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-8 outline-none focus:bg-white focus:border-slate-400 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategoryFilter === 'ALL'
                  ? 'bg-[#023246] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({subjects.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = subjects.filter((s) => s.category === cat).length;
              if (count === 0 && selectedCategoryFilter !== cat) return null;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategoryFilter === cat
                      ? 'bg-[#023246] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Subjects List (Clean & Compact Table/Rows) */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 max-h-[42vh] divide-y divide-slate-100">
          {filteredSubjects.length === 0 ? (
            <div className="text-center py-10 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400 font-medium space-y-2">
              <span className="text-2xl block">🔍</span>
              <p className="font-bold text-slate-700">Mata Pelajaran Tidak Ditemukan</p>
              <p className="text-[11px] text-slate-400">
                {searchQuery
                  ? `Tidak ada mapel dengan kata kunci "${searchQuery}"`
                  : 'Belum ada mata pelajaran dalam kategori ini.'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Reset Pencarian
                </button>
              )}
            </div>
          ) : (
            filteredSubjects.map((sub) => {
              const count = usageCountMap[sub.name.trim().toLowerCase()] || 0;
              const isSelected = editingSubjectId === sub.id;

              return (
                <div
                  key={sub.id}
                  className={`py-2 px-3 rounded-xl transition-colors flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-emerald-50/70 border border-emerald-300'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Left: Code, Name, Category */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {sub.code && (
                      <span className="px-1.5 py-0.5 text-[9px] font-mono font-black uppercase bg-slate-100 text-slate-700 rounded-md shrink-0">
                        {sub.code}
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-800 truncate" title={sub.name}>
                      {sub.name}
                    </span>
                    <span
                      className={`hidden sm:inline-block px-2 py-0.5 text-[9px] font-bold rounded-md border shrink-0 ${getCategoryBadgeClass(
                        sub.category
                      )}`}
                    >
                      {sub.category}
                    </span>
                  </div>

                  {/* Right: Usage & Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {count > 0 && (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {count} jadwal
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(sub)}
                        title="Edit Mapel"
                        className="w-7 h-7 flex items-center justify-center text-xs text-amber-700 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubject(sub)}
                        title="Hapus Mapel"
                        className="w-7 h-7 flex items-center justify-center text-xs text-rose-600 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:underline flex items-center gap-1 cursor-pointer"
          >
            🔄 Reset Standar Kurikulum
          </button>

          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="px-4 py-2 text-xs font-extrabold"
          >
            Selesai
          </Button>
        </div>
      </div>
    </Modal>
  );
};
