import React, { useState } from 'react';
import {
  X,
  Settings2,
  RotateCcw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import type { AdministrationModuleItem, AdministrationCategory } from '../../../types/administration.types';
import { AdministrationRepository } from '../../../repositories/AdministrationRepository';

interface CustomizeAdministrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  academicYear: string;
  modules: AdministrationModuleItem[];
  onModulesUpdated: (updated: AdministrationModuleItem[]) => void;
}

export const CustomizeAdministrationModal: React.FC<CustomizeAdministrationModalProps> = ({
  isOpen,
  onClose,
  userId,
  academicYear,
  modules,
  onModulesUpdated,
}) => {
  const [items, setItems] = useState<AdministrationModuleItem[]>(modules);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customIcon, setCustomIcon] = useState('📑');
  const [customUrl, setCustomUrl] = useState('');
  const [customCategory, setCustomCategory] = useState<AdministrationCategory>('UJIAN');
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggle = (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, isEnabled: !item.isEnabled } : item
    );
    setItems(updated);
    AdministrationRepository.saveModules(userId, academicYear, updated);
    onModulesUpdated(updated);
    setFeedback('Perubahan tersimpan!');
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleReset = () => {
    const def = AdministrationRepository.resetToDefault(userId, academicYear);
    setItems(def);
    onModulesUpdated(def);
    setFeedback('Direset ke pengaturan standar.');
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;

    const newMod = {
      title: customTitle.trim(),
      description: customDescription.trim() || 'Modul administrasi tambahan',
      icon: customIcon.trim() || '📑',
      colorClass: 'from-[#023246] to-[#18536B]',
      category: customCategory,
      badge: 'Kustom',
      actionId: 'custom_link',
      customUrl: customUrl.trim() || undefined,
      isEnabled: true,
    };

    const updated = AdministrationRepository.addCustomModule(userId, academicYear, newMod);
    setItems(updated);
    onModulesUpdated(updated);
    setIsAddingCustom(false);
    setCustomTitle('');
    setCustomDescription('');
    setCustomUrl('');
    setFeedback('Modul kustom berhasil ditambahkan!');
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleDeleteCustom = (id: string) => {
    const updated = AdministrationRepository.removeCustomModule(userId, academicYear, id);
    setItems(updated);
    onModulesUpdated(updated);
    setFeedback('Modul kustom dihapus.');
    setTimeout(() => setFeedback(null), 2000);
  };

  const categories: Array<{ id: AdministrationCategory; label: string }> = [
    { id: 'UJIAN', label: 'Ujian & Penilaian' },
    { id: 'PERANGKAT_AJAR', label: 'Perangkat Ajar & KBM' },
    { id: 'KESISWAAN', label: 'Kesiswaan & Rombel' },
    { id: 'AGENDA_REKAP', label: 'Agenda & Rekap' },
    { id: 'CUSTOM', label: 'Modul Kustom' },
  ];

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0 border border-white/15">
              <Settings2 className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base tracking-tight leading-tight">
                Atur Modul Administrasi
              </h3>
              <p className="text-[11px] text-cyan-100/80">
                Tahun Ajaran: {academicYear}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-header notice & feedback */}
        <div className="bg-slate-50 px-5 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>Pilih modul yang ingin ditampilkan di beranda Administrasi:</span>
          {feedback && (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 animate-fadeIn">
              {feedback}
            </span>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Group by category */}
          {categories.map((cat) => {
            const catItems = items.filter((i) => i.category === cat.id);
            if (catItems.length === 0) return null;

            return (
              <div key={cat.id} className="space-y-2">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <span>{cat.label}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    ({catItems.filter((i) => i.isEnabled).length}/{catItems.length} Aktif)
                  </span>
                </h4>

                <div className="space-y-1.5">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        item.isEnabled
                          ? 'bg-white border-slate-200 shadow-2xs'
                          : 'bg-slate-50/70 border-slate-200/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0 p-1.5 rounded-xl bg-slate-100 border border-slate-200/80">
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {item.title}
                            </p>
                            {item.badge && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-[#023246]/10 text-[#023246] rounded-md">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.id.startsWith('custom_') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustom(item.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus Modul Kustom"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggle(item.id)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            item.isEnabled
                              ? 'bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {item.isEnabled ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Tampil</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Sembunyi</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Form Tambah Modul Kustom */}
          {isAddingCustom ? (
            <form
              onSubmit={handleAddCustom}
              className="p-4 rounded-2xl bg-cyan-50/70 border border-cyan-200 space-y-3 animate-fadeIn"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-[#023246] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-600" />
                  Tambah Ikon / Modul Kustom
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddingCustom(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Nama Modul:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: CBT Ujian Online"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#023246]/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Ikon (Emoji):
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 📝, 💻, 📊, 📑"
                    value={customIcon}
                    onChange={(e) => setCustomIcon(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#023246]/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  Kategori:
                </label>
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value as AdministrationCategory)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#023246]/20"
                >
                  <option value="UJIAN">Ujian & Penilaian</option>
                  <option value="PERANGKAT_AJAR">Perangkat Ajar & KBM</option>
                  <option value="KESISWAAN">Kesiswaan & Rombel</option>
                  <option value="AGENDA_REKAP">Agenda & Rekap</option>
                  <option value="CUSTOM">Lainnya / Eksternal</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  Deskripsi Singkat:
                </label>
                <input
                  type="text"
                  placeholder="Keterangan singkat fungsi modul"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#023246]/20"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  URL / Tautan Eksternal (Opsional):
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/... atau https://cbt.sekolah.sch.id"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#023246]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingCustom(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#023246] hover:bg-[#18536B] rounded-xl cursor-pointer shadow-xs"
                >
                  Simpan Modul
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingCustom(true)}
              className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-[#023246] rounded-2xl text-xs font-bold text-slate-600 hover:text-[#023246] flex items-center justify-center gap-1.5 transition-colors cursor-pointer bg-slate-50/50 hover:bg-cyan-50/40"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Ikon / Modul Kustom Baru</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer hover:underline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset ke Standar</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-white bg-[#023246] hover:bg-[#18536B] rounded-xl cursor-pointer shadow-xs"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
