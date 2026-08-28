import React, { useState, useEffect } from 'react';
import type { UserProfile } from '../../../types/database.types';

interface TeachingMaterialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
}

interface MaterialItem {
  id: string;
  title: string;
  subject: string;
  className: string;
  type: 'PDF' | 'DOC' | 'PPT' | 'VIDEO' | 'LINK';
  fileUrl: string;
  uploadedAt: string;
  chapter: string;
}

export const TeachingMaterialsModal: React.FC<TeachingMaterialsModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const [selectedTab, setSelectedTab] = useState<'LIST' | 'ADD'>('LIST');
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState(
    user.position ? user.position.replace(/^Guru\s*/i, '').trim() : ''
  );
  const [newClass, setNewClass] = useState('Kelas VII-A');
  const [newChapter, setNewChapter] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [materials, setMaterials] = useState<MaterialItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('smart_absensi_teaching_materials');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse saved teaching materials:', e);
      }
    }
    return [];
  });

  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem('smart_absensi_teaching_materials');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setMaterials(parsed);
        } else {
          setMaterials([]);
        }
      } catch (e) {
        console.warn('Failed to sync teaching materials:', e);
      }
    };

    window.addEventListener('smart_absensi_materials_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('smart_absensi_materials_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    let detectedType: MaterialItem['type'] = 'PDF';
    const lowerUrl = newUrl.toLowerCase();
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be') || lowerUrl.includes('vimeo')) {
      detectedType = 'VIDEO';
    } else if (lowerUrl.endsWith('.ppt') || lowerUrl.endsWith('.pptx') || lowerUrl.includes('presentation')) {
      detectedType = 'PPT';
    } else if (lowerUrl.endsWith('.doc') || lowerUrl.endsWith('.docx') || lowerUrl.includes('document')) {
      detectedType = 'DOC';
    } else if (lowerUrl.endsWith('.pdf')) {
      detectedType = 'PDF';
    } else {
      detectedType = 'LINK';
    }

    const newMat: MaterialItem = {
      id: `mat-${Date.now()}`,
      title: newTitle.trim(),
      subject: newSubject.trim() || 'Mata Pelajaran',
      className: newClass,
      type: detectedType,
      fileUrl: newUrl.trim(),
      uploadedAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      chapter: newChapter.trim() || 'Umum',
    };

    const updated = [newMat, ...materials];
    setMaterials(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('smart_absensi_teaching_materials', JSON.stringify(updated));
      window.dispatchEvent(new Event('smart_absensi_materials_updated'));
    }

    setNewTitle('');
    setNewChapter('');
    setNewUrl('');
    setSelectedTab('LIST');
  };

  const handleDeleteMaterial = (id: string) => {
    const updated = materials.filter((m) => m.id !== id);
    setMaterials(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('smart_absensi_teaching_materials', JSON.stringify(updated));
      window.dispatchEvent(new Event('smart_absensi_materials_updated'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-120 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-violet-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-xs shrink-0">
              📚
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold leading-tight truncate">Modul &amp; Bahan Ajar KBM</h3>
              <p className="text-[11px] text-violet-300 font-semibold truncate">{materials.length} Materi Pembelajaran Tersimpan</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-slate-200 transition-colors cursor-pointer text-sm font-bold shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-3 px-4 bg-slate-50 border-b border-slate-200 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedTab('LIST')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              selectedTab === 'LIST'
                ? 'bg-[#023246] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Daftar Modul ({materials.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('ADD')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              selectedTab === 'ADD'
                ? 'bg-[#0D7A5F] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            + Upload Bahan Baru
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {selectedTab === 'LIST' ? (
            materials.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-4xl block">📚</span>
                <h4 className="font-extrabold text-[#023246] text-sm">Belum Ada Modul &amp; Bahan Ajar</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Materi pembelajaran KBM belum diunggah atau diatur oleh Admin/Guru. Klik tombol <strong>+ Upload Bahan Baru</strong> untuk membagikan modul, slide presentasi, atau video KBM.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTab('ADD')}
                    className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#095744] text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    + Upload Bahan Pertama
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {materials.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-violet-300 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {m.type}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-xs text-[#023246] leading-tight truncate">
                            {m.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {m.chapter} • {m.className} • {m.subject}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteMaterial(m.id)}
                        className="text-slate-300 hover:text-rose-600 transition-colors text-xs font-bold p-1 cursor-pointer"
                        title="Hapus Bahan Ajar"
                      >
                        🗑️
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                      <span className="text-slate-400">Diunggah: {m.uploadedAt}</span>
                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 bg-violet-50 text-violet-800 hover:bg-violet-100 font-extrabold rounded-lg border border-violet-200 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Buka Bahan ↗</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <form onSubmit={handleAddMaterial} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Judul Modul / Bahan Ajar
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Modul 1 - Pendahuluan Materi"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Mata Pelajaran
                </label>
                <input
                  type="text"
                  required
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Contoh: Matematika / IPA / Bahasa"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Kelas Target
                  </label>
                  <select
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                  >
                    <option value="Kelas VII-A">Kelas VII-A</option>
                    <option value="Kelas VII-B">Kelas VII-B</option>
                    <option value="Kelas VIII-A">Kelas VIII-A</option>
                    <option value="Kelas VIII-B">Kelas VIII-B</option>
                    <option value="Kelas IX-A">Kelas IX-A</option>
                    <option value="Kelas IX-B">Kelas IX-B</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Bab / Topik
                  </label>
                  <input
                    type="text"
                    value={newChapter}
                    onChange={(e) => setNewChapter(e.target.value)}
                    placeholder="Contoh: Bab 1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Link File / Google Drive / Video
                </label>
                <input
                  type="url"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#0D7A5F] hover:bg-[#095744] text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer active:scale-98"
              >
                Simpan &amp; Bagikan Materi
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 px-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
