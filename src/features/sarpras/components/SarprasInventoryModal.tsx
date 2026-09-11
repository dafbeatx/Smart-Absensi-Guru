import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useToastStore } from '../../../store/useToastStore';
import { InventorySarprasRepository } from '../../../repositories/InventorySarprasRepository';
import { isUserSarprasOfficer } from '../utils/sarpras-access.utils';
import { ModernSarprasSelect } from './ModernSarprasSelect';
import type {
  InventorySarprasItem,
  CreateInventorySarprasDTO,
  UpdateInventorySarprasDTO,
  SarprasCondition,
  UserProfile,
} from '../../../types/database.types';
import {
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Trash2,
  Save,
  ArrowLeft,
  ArrowRight,
  X,
  FileSpreadsheet,
  Building2,
  Boxes,
  Calendar,
  Coins,
  Minus,
  Check,
  Layers,
} from 'lucide-react';

interface SarprasInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
}

export const SarprasInventoryModal: React.FC<SarprasInventoryModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const { showToast } = useToastStore();
  const isOfficer = isUserSarprasOfficer(currentUser);

  const [items, setItems] = useState<InventorySarprasItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState('ALL');
  const [selectedConditionFilter, setSelectedConditionFilter] = useState<'ALL' | 'LAYAK' | 'RUSAK'>('ALL');

  // Form states: 'LIST' | 'CREATE' | 'EDIT'
  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'EDIT'>('LIST');
  const [formStep, setFormStep] = useState<1 | 2 | 3 | 4>(1);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Form input states
  const [ruanganPreset, setRuanganPreset] = useState<string>(InventorySarprasRepository.COMMON_ROOMS[0]);
  const [ruanganCustom, setRuanganCustom] = useState('');
  const [namaBarang, setNamaBarang] = useState('');
  const [jumlahTotal, setJumlahTotal] = useState<number | string>(1);
  const [merek, setMerek] = useState('');
  const [tahunPerolehan, setTahunPerolehan] = useState<number>(new Date().getFullYear());
  const [kondisi, setKondisi] = useState<SarprasCondition>('LAYAK');
  const [yangHarusDibeli, setYangHarusDibeli] = useState('0');
  const [sumberDanaPreset, setSumberDanaPreset] = useState<string>(InventorySarprasRepository.COMMON_FUNDING_SOURCES[0]);
  const [sumberDanaCustom, setSumberDanaCustom] = useState('');
  const [keterangan, setKeterangan] = useState('');

  // Delete confirmation
  const [deletingItem, setDeletingItem] = useState<InventorySarprasItem | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await InventorySarprasRepository.getAll();
      setItems(data);
    } catch (err) {
      console.warn('Gagal memuat inventaris sarpras:', err);
      showToast('error', 'Gagal Memuat Data', 'Tidak dapat mengambil inventaris sarana dan prasarana.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setViewMode('LIST');
      setFormStep(1);
      setEditingItemId(null);
    }
  }, [isOpen]);

  const resetForm = () => {
    setRuanganPreset(InventorySarprasRepository.COMMON_ROOMS[0]);
    setRuanganCustom('');
    setNamaBarang('');
    setJumlahTotal(1);
    setMerek('');
    setTahunPerolehan(new Date().getFullYear());
    setKondisi('LAYAK');
    setYangHarusDibeli('0');
    setSumberDanaPreset(InventorySarprasRepository.COMMON_FUNDING_SOURCES[0]);
    setSumberDanaCustom('');
    setKeterangan('');
    setFormStep(1);
    setEditingItemId(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setViewMode('CREATE');
  };

  const handleStartEdit = (item: InventorySarprasItem) => {
    setEditingItemId(item.id);
    if (InventorySarprasRepository.COMMON_ROOMS.includes(item.ruangan)) {
      setRuanganPreset(item.ruangan);
      setRuanganCustom('');
    } else {
      setRuanganPreset('LAINNYA');
      setRuanganCustom(item.ruangan);
    }

    setNamaBarang(item.nama_barang);
    setJumlahTotal(item.jumlah_total);
    setMerek(item.merek);
    setTahunPerolehan(item.tahun_perolehan);
    setKondisi(item.kondisi);
    setYangHarusDibeli(item.yang_harus_dibeli || '0');

    if (InventorySarprasRepository.COMMON_FUNDING_SOURCES.includes(item.sumber_dana)) {
      setSumberDanaPreset(item.sumber_dana);
      setSumberDanaCustom('');
    } else {
      setSumberDanaPreset('LAINNYA');
      setSumberDanaCustom(item.sumber_dana);
    }

    setKeterangan(item.keterangan || '');
    setFormStep(1);
    setViewMode('EDIT');
  };

  const validateStep = (step: number): boolean => {
    const finalRuangan = ruanganPreset === 'LAINNYA' ? ruanganCustom.trim() : ruanganPreset;
    const finalSumberDana = sumberDanaPreset === 'LAINNYA' ? sumberDanaCustom.trim() : sumberDanaPreset;

    if (step === 1) {
      if (!finalRuangan) {
        showToast('warning', 'Validasi Ruangan', 'Silakan pilih atau isi nama ruangan aset.');
        return false;
      }
      if (!namaBarang.trim()) {
        showToast('warning', 'Validasi Nama Barang', 'Nama barang / aset wajib diisi.');
        return false;
      }
      if (!merek.trim()) {
        showToast('warning', 'Validasi Merek', 'Merek barang wajib diisi (isi "-" jika tanpa merek).');
        return false;
      }
    } else if (step === 2) {
      if (!jumlahTotal || Number(jumlahTotal) <= 0) {
        showToast('warning', 'Validasi Jumlah', 'Jumlah total barang minimal 1 unit.');
        return false;
      }
      if (!tahunPerolehan) {
        showToast('warning', 'Validasi Tahun', 'Tahun perolehan wajib dipilih.');
        return false;
      }
    } else if (step === 3) {
      if (!finalSumberDana) {
        showToast('warning', 'Validasi Sumber Dana', 'Sumber dana pengadaan wajib diisi.');
        return false;
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(formStep)) {
      setFormStep((prev) => Math.min(prev + 1, 4) as 1 | 2 | 3 | 4);
    }
  };

  const handlePrevStep = () => {
    setFormStep((prev) => Math.max(prev - 1, 1) as 1 | 2 | 3 | 4);
  };

  const handleSubmitForm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
    }

    const finalRuangan = ruanganPreset === 'LAINNYA' ? ruanganCustom.trim() : ruanganPreset;
    const finalSumberDana = sumberDanaPreset === 'LAINNYA' ? sumberDanaCustom.trim() : sumberDanaPreset;

    setIsSubmitting(true);
    try {
      if (viewMode === 'CREATE') {
        const dto: CreateInventorySarprasDTO = {
          ruangan: finalRuangan,
          nama_barang: namaBarang.trim(),
          jumlah_total: Number(jumlahTotal),
          merek: merek.trim(),
          tahun_perolehan: Number(tahunPerolehan),
          kondisi,
          yang_harus_dibeli: yangHarusDibeli.trim() || '0',
          sumber_dana: finalSumberDana,
          keterangan: keterangan.trim() || undefined,
          created_by: currentUser?.id || 'usr_guru_002',
          created_by_name: currentUser?.full_name || 'Muhammad Iqbal Gustiawan, S.Pd., G.r',
        };

        const created = await InventorySarprasRepository.create(dto);
        setItems((prev) => [created, ...prev]);
        showToast('success', 'Barang Tersimpan', `Aset ${created.nama_barang} berhasil ditambahkan ke inventaris.`);
      } else if (viewMode === 'EDIT' && editingItemId) {
        const dto: UpdateInventorySarprasDTO = {
          ruangan: finalRuangan,
          nama_barang: namaBarang.trim(),
          jumlah_total: Number(jumlahTotal),
          merek: merek.trim(),
          tahun_perolehan: Number(tahunPerolehan),
          kondisi,
          yang_harus_dibeli: yangHarusDibeli.trim() || '0',
          sumber_dana: finalSumberDana,
          keterangan: keterangan.trim() || undefined,
        };

        await InventorySarprasRepository.update(editingItemId, dto);
        setItems((prev) =>
          prev.map((item) =>
            item.id === editingItemId
              ? {
                  ...item,
                  ...dto,
                  ruangan: finalRuangan,
                  nama_barang: namaBarang.trim(),
                  jumlah_total: Number(jumlahTotal),
                  merek: merek.trim(),
                  tahun_perolehan: Number(tahunPerolehan),
                  kondisi,
                  yang_harus_dibeli: yangHarusDibeli.trim() || '0',
                  sumber_dana: finalSumberDana,
                  keterangan: keterangan.trim() || undefined,
                  updated_at: new Date().toISOString(),
                }
              : item
          )
        );
        showToast('success', 'Pembaruan Berhasil', 'Data inventaris sarpras berhasil diperbarui.');
      }

      resetForm();
      setViewMode('LIST');
    } catch (err) {
      console.warn('Gagal menyimpan sarpras:', err);
      showToast('error', 'Gagal Menyimpan', 'Terjadi kesalahan sistem saat menyimpan data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    try {
      await InventorySarprasRepository.delete(deletingItem.id);
      setItems((prev) => prev.filter((i) => i.id !== deletingItem.id));
      showToast('success', 'Barang Dihapus', `${deletingItem.nama_barang} telah dihapus dari inventaris.`);
      setDeletingItem(null);
    } catch (err) {
      console.warn('Gagal menghapus sarpras:', err);
      showToast('error', 'Gagal Menghapus', 'Tidak dapat menghapus item inventaris.');
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchQuery =
        item.nama_barang.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.merek.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.ruangan.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.keterangan || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchRoom = selectedRoomFilter === 'ALL' || item.ruangan === selectedRoomFilter;
      const matchCondition =
        selectedConditionFilter === 'ALL' || item.kondisi === selectedConditionFilter;

      return matchQuery && matchRoom && matchCondition;
    });
  }, [items, searchQuery, selectedRoomFilter, selectedConditionFilter]);

  const stats = useMemo(() => InventorySarprasRepository.calculateStatistics(items), [items]);

  const uniqueRooms = useMemo(() => {
    const list = Array.from(new Set(items.map((i) => i.ruangan.trim()))).filter(Boolean);
    return list.sort();
  }, [items]);

  // Options for Dropdowns
  const roomOptions = useMemo(() => {
    const opts = InventorySarprasRepository.COMMON_ROOMS.map((r) => ({
      value: r,
      label: r,
    }));
    opts.push({ value: 'LAINNYA', label: '➕ Ruangan Lainnya (Ketik Manual)...' });
    return opts;
  }, []);

  const fundingOptions = useMemo(() => {
    const opts = InventorySarprasRepository.COMMON_FUNDING_SOURCES.map((f) => ({
      value: f,
      label: f,
    }));
    opts.push({ value: 'LAINNYA', label: '➕ Sumber Dana Lainnya (Ketik Manual)...' });
    return opts;
  }, []);

  const yearOptions = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => {
      const y = new Date().getFullYear() - i;
      return { value: String(y), label: `Tahun ${y}` };
    });
  }, []);

  const filterRoomOptions = useMemo(() => {
    const opts = [{ value: 'ALL', label: `Semua Ruangan (${uniqueRooms.length})` }];
    uniqueRooms.forEach((r) => opts.push({ value: r, label: r }));
    return opts;
  }, [uniqueRooms]);

  const filterConditionOptions = [
    { value: 'ALL', label: 'Semua Kondisi' },
    { value: 'LAYAK', label: '✅ Layak Pakai' },
    { value: 'RUSAK', label: '⚠️ Rusak' },
  ];

  if (!isOpen) return null;

  // Keamanan Akses: Khusus M. Iqbal Gustiawan (Wakasek Sarpras)
  if (!isOfficer) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Akses Ditolak" maxWidth="md">
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto text-2xl">
            🔒
          </div>
          <h3 className="font-extrabold text-[#023246] text-lg">Akses Khusus Wakasek Sarpras</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Menu dan pengisian formulir Inventaris Sarana dan Prasarana hanya dapat diakses oleh{' '}
            <span className="font-bold text-[#023246]">M. Iqbal Gustiawan, S.Pd., G.r</span> (Wakasek Sarpras).
          </p>
          <Button onClick={onClose} variant="primary" className="w-full">
            Kembali ke Dashboard
          </Button>
        </div>
      </Modal>
    );
  }

  const stepsConfig = [
    { num: 1, title: 'Identitas', desc: 'Ruangan & Nama' },
    { num: 2, title: 'Kondisi', desc: 'Jumlah & Fisik' },
    { num: 3, title: 'Anggaran', desc: 'Kebutuhan & Dana' },
    { num: 4, title: 'Ringkasan', desc: 'Konfirmasi Simpan' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        viewMode === 'LIST'
          ? 'Inventaris Sarana & Prasarana'
          : viewMode === 'CREATE'
          ? 'Tambah Aset Inventaris'
          : 'Ubah Data Aset'
      }
      maxWidth="xl"
    >
      <div className="space-y-3.5 sm:space-y-4 font-sans text-[#023246] max-w-full">
        {/* Header Portal Badge Wakasek Sarpras */}
        <div className="bg-[#18536B]/10 border border-[#18536B]/20 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#023246] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Boxes className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-extrabold text-[#023246] truncate">
                  Sarpras Sekolah
                </span>
                <span className="px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black uppercase rounded-full bg-[#18536B] text-white">
                  Wakasek
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
                PJ: <span className="font-bold text-[#023246]">{currentUser?.full_name || 'M. Iqbal Gustiawan'}</span>
              </p>
            </div>
          </div>

          {viewMode === 'LIST' && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => InventorySarprasRepository.exportToCSV(items)}
                className="px-2.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1 transition-all shadow-2xs active:scale-95 cursor-pointer"
                title="Unduh CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Ekspor</span>
              </button>
              <button
                type="button"
                onClick={handleStartCreate}
                className="px-3 py-2 bg-[#023246] hover:bg-[#18536B] text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tambah</span>
              </button>
            </div>
          )}
        </div>

        {/* ── MODE FORM STEPPER (3-4 LAYER NEXT-NEXT UNTUK INFINIX NOTE 8) ──────────────── */}
        {viewMode !== 'LIST' ? (
          <div className="space-y-3.5 pt-0.5">
            {/* Top Navigation & Step Indicator Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setViewMode('LIST');
                }}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[#023246] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Daftar Aset</span>
              </button>
              <div className="flex items-center gap-1 text-[11px] font-extrabold text-[#18536B]">
                <Layers className="w-3.5 h-3.5" />
                <span>Langkah {formStep} dari 4</span>
              </div>
            </div>

            {/* Stepper Bar (4 Layer) */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {stepsConfig.map((s) => {
                const isCurrent = formStep === s.num;
                const isPassed = formStep > s.num;

                return (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => {
                      if (isPassed || formStep === s.num) {
                        setFormStep(s.num as any);
                      } else if (validateStep(formStep)) {
                        setFormStep(s.num as any);
                      }
                    }}
                    className={`p-1.5 sm:p-2 rounded-xl text-center transition-all cursor-pointer border ${
                      isCurrent
                        ? 'bg-[#023246] text-white border-[#023246] shadow-xs'
                        : isPassed
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {isPassed ? (
                        <Check className="w-3 h-3 text-emerald-600 stroke-3" />
                      ) : (
                        <span className={`text-[10px] font-black ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                          {s.num}
                        </span>
                      )}
                      <span className="text-[10px] sm:text-xs font-extrabold truncate">{s.title}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* LAYER 1: IDENTITAS & RUANGAN */}
            {formStep === 1 && (
              <div className="p-3.5 sm:p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                  <Building2 className="w-4 h-4 text-[#18536B]" />
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-[#023246]">
                      Langkah 1: Ruangan &amp; Identitas Barang
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-500">
                      Tentukan lokasi penempatan dan spesifikasi dasar aset
                    </p>
                  </div>
                </div>

                {/* Dropdown Ruangan Modern */}
                <ModernSarprasSelect
                  label="Ruangan Penempatan"
                  required
                  icon={<Building2 className="w-3.5 h-3.5" />}
                  placeholder="Pilih Ruangan Sekolah..."
                  options={roomOptions}
                  value={ruanganPreset}
                  onChange={(val) => setRuanganPreset(val)}
                  allowCustomInput
                  customValue={ruanganCustom}
                  onCustomChange={(val) => setRuanganCustom(val)}
                  customPlaceholder="Ketik nama ruangan baru..."
                  searchable
                />

                {/* Nama Barang */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-[#023246]">
                    Nama Barang / Aset <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Proyektor LCD, Laptop Core i5, Meja Guru..."
                    value={namaBarang}
                    onChange={(e) => setNamaBarang(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                    required
                  />
                </div>

                {/* Merek / Brand */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-[#023246]">
                    Merek / Brand Pembuat <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Epson, Asus, Daikin, Olympic (atau '-' jika custom)..."
                    value={merek}
                    onChange={(e) => setMerek(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                    required
                  />
                </div>

                {/* Tombol Navigasi Step 1 */}
                <div className="pt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleNextStep}
                    className="w-full sm:w-auto bg-[#023246] hover:bg-[#18536B] min-h-11.5 flex items-center justify-center gap-1.5"
                  >
                    <span>Lanjutkan: Jumlah &amp; Kondisi</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* LAYER 2: JUMLAH & KONDISI FISIK */}
            {formStep === 2 && (
              <div className="p-3.5 sm:p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                  <Boxes className="w-4 h-4 text-[#18536B]" />
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-[#023246]">
                      Langkah 2: Jumlah &amp; Kondisi Fisik
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-500">
                      Catat kuantitas unit, tahun perolehan, dan kelayakan barang
                    </p>
                  </div>
                </div>

                {/* Jumlah Total dengan Quick Stepper */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#023246]">
                    Jumlah Total (Unit / Buah) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setJumlahTotal((prev) => Math.max(1, Number(prev || 1) - 1))}
                      className="w-11 h-11 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center font-bold text-lg active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={jumlahTotal}
                      onChange={(e) => setJumlahTotal(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full text-center px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setJumlahTotal((prev) => Number(prev || 1) + 1)}
                      className="w-11 h-11 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center font-bold text-lg active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tahun Perolehan Dropdown Modern */}
                <ModernSarprasSelect
                  label="Tahun Perolehan / Pengadaan"
                  required
                  icon={<Calendar className="w-3.5 h-3.5" />}
                  placeholder="Pilih Tahun..."
                  options={yearOptions}
                  value={String(tahunPerolehan)}
                  onChange={(val) => setTahunPerolehan(Number(val))}
                />

                {/* Kondisi Barang - 2 Interactive Cards */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#023246]">
                    Kondisi Fisik Barang <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setKondisi('LAYAK')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer active:scale-98 ${
                        kondisi === 'LAYAK'
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2
                          className={`w-4 h-4 ${kondisi === 'LAYAK' ? 'text-emerald-600' : 'text-slate-400'}`}
                        />
                        <span className={`text-xs font-black ${kondisi === 'LAYAK' ? 'text-emerald-900' : 'text-slate-700'}`}>
                          Layak Pakai
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                        Berfungsi normal dan siap digunakan
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setKondisi('RUSAK')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer active:scale-98 ${
                        kondisi === 'RUSAK'
                          ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle
                          className={`w-4 h-4 ${kondisi === 'RUSAK' ? 'text-rose-600' : 'text-slate-400'}`}
                        />
                        <span className={`text-xs font-black ${kondisi === 'RUSAK' ? 'text-rose-900' : 'text-slate-700'}`}>
                          Rusak
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                        Perlu servis atau penggantian unit
                      </p>
                    </button>
                  </div>
                </div>

                {/* Tombol Navigasi Step 2 */}
                <div className="pt-2 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevStep}
                    className="min-h-11.5 px-3.5"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    <span>Kembali</span>
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleNextStep}
                    className="bg-[#023246] hover:bg-[#18536B] min-h-11.5 flex items-center gap-1.5 flex-1 sm:flex-initial justify-center"
                  >
                    <span>Lanjutkan: Anggaran</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* LAYER 3: RENCANA PENGADAAN & ANGGARAN */}
            {formStep === 3 && (
              <div className="p-3.5 sm:p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                  <Coins className="w-4 h-4 text-[#18536B]" />
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-[#023246]">
                      Langkah 3: Rencana Pengadaan &amp; Anggaran
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-500">
                      Rencana penggantian unit rusak dan asal sumber pendanaan
                    </p>
                  </div>
                </div>

                {/* Yang Harus Dibeli dengan Quick Chips */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-[#023246]">
                      Kebutuhan Unit yang Harus Dibeli
                    </label>
                    <span className="text-[10px] text-slate-400">Pilih cepat atau ketik</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['0', '1 Unit', '2 Unit', '3 Unit', '5 Unit'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setYangHarusDibeli(chip)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          yangHarusDibeli === chip
                            ? 'bg-[#18536B] text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Contoh: 2 unit pengganti / 0 jika cukup..."
                    value={yangHarusDibeli}
                    onChange={(e) => setYangHarusDibeli(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30 mt-1"
                  />
                </div>

                {/* Sumber Dana Dropdown Modern */}
                <ModernSarprasSelect
                  label="Sumber Dana Pengadaan"
                  required
                  icon={<Coins className="w-3.5 h-3.5" />}
                  placeholder="Pilih Sumber Dana..."
                  options={fundingOptions}
                  value={sumberDanaPreset}
                  onChange={(val) => setSumberDanaPreset(val)}
                  allowCustomInput
                  customValue={sumberDanaCustom}
                  onCustomChange={(val) => setSumberDanaCustom(val)}
                  customPlaceholder="Ketik sumber dana lain..."
                  searchable
                />

                {/* Keterangan Tambahan */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-[#023246]">
                    Catatan Detail / Letak Posisi Spesifik
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Terpasang di plafon barat, kabel HDMI 10 meter, nomor inventaris 04/LAB/2026..."
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                  />
                </div>

                {/* Tombol Navigasi Step 3 */}
                <div className="pt-2 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevStep}
                    className="min-h-11.5 px-3.5"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    <span>Kembali</span>
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleNextStep}
                    className="bg-[#023246] hover:bg-[#18536B] min-h-11.5 flex items-center gap-1.5 flex-1 sm:flex-initial justify-center"
                  >
                    <span>Lanjutkan: Pratinjau</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* LAYER 4: PRATINJAU & KONFIRMASI SIMPAN */}
            {formStep === 4 && (
              <div className="p-3.5 sm:p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-[#023246]">
                      Langkah 4: Tinjauan &amp; Konfirmasi Aset
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-500">
                      Periksa data sebelum disimpan ke basis data inventaris sekolah
                    </p>
                  </div>
                </div>

                {/* Kartu Ringkasan Editorial (Anti AI-Slop Design) */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 space-y-3 shadow-2xs">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-[#023246]/10 text-[#023246]">
                        📍 {ruanganPreset === 'LAINNYA' ? ruanganCustom : ruanganPreset}
                      </span>
                      <h4 className="text-sm sm:text-base font-black text-[#023246] mt-1.5">
                        {namaBarang || '-'}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Merek: <span className="font-bold text-slate-800">{merek || '-'}</span>
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 text-xs font-black rounded-xl flex items-center gap-1 shrink-0 ${
                        kondisi === 'LAYAK'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {kondisi === 'LAYAK' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      )}
                      <span>{kondisi === 'LAYAK' ? 'Layak Pakai' : 'Rusak'}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold block">JUMLAH TOTAL</span>
                      <span className="font-black text-[#023246] text-sm">{jumlahTotal} Unit</span>
                    </div>

                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold block">TAHUN PENGADAAN</span>
                      <span className="font-black text-[#023246] text-sm">{tahunPerolehan}</span>
                    </div>

                    <div className="p-2 bg-slate-50 rounded-xl col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-slate-400 font-bold block">SUMBER DANA</span>
                      <span className="font-bold text-slate-800 text-xs truncate block">
                        {sumberDanaPreset === 'LAINNYA' ? sumberDanaCustom : sumberDanaPreset}
                      </span>
                    </div>
                  </div>

                  {yangHarusDibeli && yangHarusDibeli !== '0' && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                      <span className="font-bold">🛒 Rencana Beli / Tambah:</span>
                      <span className="font-black">{yangHarusDibeli}</span>
                    </div>
                  )}

                  {keterangan && (
                    <div className="pt-1">
                      <span className="text-[10px] text-slate-400 font-bold block">CATATAN KHUSUS</span>
                      <p className="text-xs text-slate-600 italic mt-0.5">"{keterangan}"</p>
                    </div>
                  )}
                </div>

                {/* Tombol Simpan Akhir */}
                <div className="pt-2 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevStep}
                    disabled={isSubmitting}
                    className="min-h-11.5 px-3.5"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    <span>Ubah Data</span>
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => handleSubmitForm()}
                    isLoading={isSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-700 min-h-11.5 flex items-center gap-1.5 flex-1 sm:flex-initial justify-center font-black"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    <span>{viewMode === 'CREATE' ? 'Simpan ke Inventaris' : 'Simpan Perubahan'}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── MODE TAMPILAN DAFTAR BARANG (LIST VIEW) ────────────────────────── */
          <div className="space-y-3">
            {/* Kartu Ringkasan Statistik Cepat */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
              <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase block">
                  Total Barang
                </span>
                <p className="text-base sm:text-lg font-black text-[#023246] mt-0.5">
                  {stats.totalItems}{' '}
                  <span className="text-[10px] font-semibold text-slate-400">
                    ({stats.totalUnits} unit)
                  </span>
                </p>
              </div>

              <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-emerald-200/80 shadow-2xs">
                <span className="text-[9px] sm:text-[10px] font-bold text-emerald-700 uppercase block">
                  Layak Pakai
                </span>
                <p className="text-base sm:text-lg font-black text-emerald-600 mt-0.5">
                  {stats.layakCount}{' '}
                  <span className="text-[10px] font-semibold text-emerald-600/70">
                    ({stats.layakUnits} unit)
                  </span>
                </p>
              </div>

              <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-rose-200/80 shadow-2xs">
                <span className="text-[9px] sm:text-[10px] font-bold text-rose-700 uppercase block">
                  Kondisi Rusak
                </span>
                <p className="text-base sm:text-lg font-black text-rose-600 mt-0.5">
                  {stats.rusakCount}{' '}
                  <span className="text-[10px] font-semibold text-rose-600/70">
                    ({stats.rusakUnits} unit)
                  </span>
                </p>
              </div>

              <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-amber-200/80 shadow-2xs">
                <span className="text-[9px] sm:text-[10px] font-bold text-amber-700 uppercase block">
                  Kebutuhan Beli
                </span>
                <p className="text-base sm:text-lg font-black text-amber-600 mt-0.5">
                  {stats.needPurchaseCount}{' '}
                  <span className="text-[10px] font-semibold text-amber-600/70">item</span>
                </p>
              </div>
            </div>

            {/* Filter & Pencarian Modern Tanpa Dropdown Jadul */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama barang, merek, ruangan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Modern Filter Ruangan */}
                <ModernSarprasSelect
                  compact
                  placeholder="Filter Ruangan..."
                  options={filterRoomOptions}
                  value={selectedRoomFilter}
                  onChange={(val) => setSelectedRoomFilter(val)}
                  searchable
                />

                {/* Modern Filter Kondisi */}
                <ModernSarprasSelect
                  compact
                  placeholder="Filter Kondisi..."
                  options={filterConditionOptions}
                  value={selectedConditionFilter}
                  onChange={(val) => setSelectedConditionFilter(val as any)}
                />
              </div>
            </div>

            {/* List Barang */}
            {isLoading ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <div className="w-8 h-8 border-3 border-[#18536B] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold">Memuat data sarana &amp; prasarana...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-10 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-5 space-y-3">
                <div className="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-lg">
                  📦
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm">Tidak Ada Data Ditemukan</h4>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    {searchQuery || selectedRoomFilter !== 'ALL' || selectedConditionFilter !== 'ALL'
                      ? 'Tidak ada barang yang cocok dengan kriteria filter.'
                      : 'Belum ada data inventaris sarpras yang dicatat.'}
                  </p>
                </div>
                <Button onClick={handleStartCreate} variant="primary" className="text-xs min-h-11">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Tambah Barang Sekarang</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-0.5">
                {filteredItems.map((item) => {
                  const isLayak = item.kondisi === 'LAYAK';
                  const needsBuy =
                    item.yang_harus_dibeli &&
                    item.yang_harus_dibeli !== '0' &&
                    item.yang_harus_dibeli !== '-';

                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-white rounded-2xl border border-slate-200/90 hover:border-[#18536B]/40 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-black rounded-lg bg-[#023246]/10 text-[#023246]">
                            📍 {item.ruangan}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold rounded-lg flex items-center gap-1 ${
                              isLayak
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isLayak ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                            )}
                            <span>{isLayak ? 'Layak Pakai' : 'Rusak'}</span>
                          </span>
                          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
                            Thn {item.tahun_perolehan} • {item.sumber_dana}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-xs sm:text-sm font-extrabold text-[#023246] group-hover:text-[#18536B] transition-colors">
                            {item.nama_barang}
                          </h4>
                          <p className="text-[11px] sm:text-xs text-slate-600 font-medium mt-0.5">
                            Merek: <span className="font-bold text-slate-800">{item.merek}</span> • Total:{' '}
                            <span className="font-black text-[#023246]">{item.jumlah_total} Unit</span>
                          </p>
                        </div>

                        {needsBuy && (
                          <div className="p-1.5 bg-amber-50 border border-amber-200/80 rounded-xl text-[10px] sm:text-[11px] font-bold text-amber-900 flex items-center gap-1">
                            <span>🛒 Kebutuhan:</span>
                            <span className="font-medium text-amber-950">{item.yang_harus_dibeli}</span>
                          </div>
                        )}

                        {item.keterangan && (
                          <p className="text-[10px] sm:text-[11px] text-slate-500 italic line-clamp-1">
                            "{item.keterangan}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="p-2 text-slate-600 hover:text-[#023246] hover:bg-slate-100 rounded-xl transition-all cursor-pointer min-h-10 min-w-10 flex items-center justify-center active:scale-95"
                          title="Edit Barang"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingItem(item)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer min-h-10 min-w-10 flex items-center justify-center active:scale-95"
                          title="Hapus Barang"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal Konfirmasi Hapus */}
        {deletingItem && (
          <div className="fixed inset-0 z-60 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-3 shadow-2xl text-center animate-in zoom-in-95 duration-150">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl">
                ⚠️
              </div>
              <h4 className="text-base font-extrabold text-[#023246]">Hapus Barang Ini?</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus <span className="font-bold text-slate-900">"{deletingItem.nama_barang}"</span> ({deletingItem.ruangan})? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" onClick={() => setDeletingItem(null)} className="min-h-11">
                  Batal
                </Button>
                <Button
                  variant="primary"
                  onClick={handleDeleteItem}
                  className="bg-rose-600 hover:bg-rose-700 min-h-11"
                >
                  Ya, Hapus
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
