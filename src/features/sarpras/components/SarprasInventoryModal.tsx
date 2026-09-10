import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useToastStore } from '../../../store/useToastStore';
import { InventorySarprasRepository } from '../../../repositories/InventorySarprasRepository';
import { isUserSarprasOfficer } from '../utils/sarpras-access.utils';
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
  X,
  FileSpreadsheet,
  Building2,
  Boxes,
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
    setViewMode('EDIT');
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalRuangan = ruanganPreset === 'LAINNYA' ? ruanganCustom.trim() : ruanganPreset;
    const finalSumberDana = sumberDanaPreset === 'LAINNYA' ? sumberDanaCustom.trim() : sumberDanaPreset;

    if (!finalRuangan) {
      showToast('warning', 'Validasi Form', 'Silakan pilih atau isi nama ruangan.');
      return;
    }
    if (!namaBarang.trim()) {
      showToast('warning', 'Validasi Form', 'Nama barang wajib diisi.');
      return;
    }
    if (!merek.trim()) {
      showToast('warning', 'Validasi Form', 'Merek barang wajib diisi.');
      return;
    }
    if (!jumlahTotal || Number(jumlahTotal) <= 0) {
      showToast('warning', 'Validasi Form', 'Jumlah total barang minimal 1 unit.');
      return;
    }
    if (!finalSumberDana) {
      showToast('warning', 'Validasi Form', 'Sumber dana wajib diisi.');
      return;
    }

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

  if (!isOpen) return null;

  // Keamanan Akses: Jika bukan M. Iqbal Gustiawan
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        viewMode === 'LIST'
          ? 'Inventaris Sarana & Prasarana'
          : viewMode === 'CREATE'
          ? 'Tambah Barang Inventaris Baru'
          : 'Edit Barang Inventaris'
      }
      maxWidth="2xl"
    >
      <div className="space-y-4 font-sans text-[#023246]">
        {/* Header Banner Wakasek Sarpras */}
        <div className="bg-[#18536B]/10 border border-[#18536B]/20 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#023246] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-extrabold text-[#023246]">
                  Portal Pengelolaan Sarpras Sekolah
                </h2>
                <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-[#18536B] text-white">
                  Wakasek Sarpras
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5">
                Petugas Penanggung Jawab: <span className="font-bold text-[#023246]">{currentUser?.full_name || 'M. Iqbal Gustiawan'}</span> • Data otomatis terhubung ke Kepala Sekolah
              </p>
            </div>
          </div>

          {viewMode === 'LIST' && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => InventorySarprasRepository.exportToCSV(items)}
                className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                title="Unduh CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">Ekspor CSV</span>
              </button>
              <button
                type="button"
                onClick={handleStartCreate}
                className="px-3.5 py-2 bg-[#023246] hover:bg-[#18536B] text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Barang</span>
              </button>
            </div>
          )}
        </div>

        {/* ── MODE TAMPILAN FORM (CREATE / EDIT) ─────────────────────────── */}
        {viewMode !== 'LIST' ? (
          <form onSubmit={handleSubmitForm} className="space-y-4 pt-1">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setViewMode('LIST');
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#023246] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Daftar</span>
              </button>
              <span className="text-[11px] font-semibold text-slate-500">
                {viewMode === 'CREATE' ? 'Formulir Inventaris Baru' : 'Ubah Data Inventaris'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              {/* 1. Ruangan */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-[#023246] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#18536B]" />
                  <span>Ruangan Mana? <span className="text-rose-500">*</span></span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={ruanganPreset}
                    onChange={(e) => setRuanganPreset(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                  >
                    {InventorySarprasRepository.COMMON_ROOMS.map((room) => (
                      <option key={room} value={room}>
                        {room}
                      </option>
                    ))}
                    <option value="LAINNYA">Ruangan Lainnya (Ketik Manual)...</option>
                  </select>

                  {ruanganPreset === 'LAINNYA' && (
                    <input
                      type="text"
                      placeholder="Masukkan nama ruangan spesifik..."
                      value={ruanganCustom}
                      onChange={(e) => setRuanganCustom(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                      required
                    />
                  )}
                </div>
              </div>

              {/* 2. Nama Barang */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-[#023246]">
                  Nama Barang / Aset <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Proyektor LCD, Laptop Core i5, Meja Guru..."
                  value={namaBarang}
                  onChange={(e) => setNamaBarang(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                  required
                />
              </div>

              {/* 3. Merek */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#023246]">
                  Merek / Brand <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Epson, Asus, Daikin, Olympic..."
                  value={merek}
                  onChange={(e) => setMerek(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                  required
                />
              </div>

              {/* 4. Jumlah Total */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#023246]">
                  Jumlah Total (Unit / Buah) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Contoh: 1, 20, 30..."
                  value={jumlahTotal}
                  onChange={(e) => setJumlahTotal(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                  required
                />
              </div>

              {/* 5. Tahun Perolehan */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#023246]">
                  Tahun Perolehan / Pengadaan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={tahunPerolehan}
                  onChange={(e) => setTahunPerolehan(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                >
                  {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* 6. Kondisi (Layak / Rusak) */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#023246]">
                  Kondisi Barang <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setKondisi('LAYAK')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      kondisi === 'LAYAK'
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Layak Pakai</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setKondisi('RUSAK')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      kondisi === 'RUSAK'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Rusak</span>
                  </button>
                </div>
              </div>

              {/* 7. Yang Harus Dibeli */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-[#023246] flex items-center justify-between">
                  <span>Yang Harus Dibeli (Kebutuhan Pengadaan / Penggantian)</span>
                  <span className="text-[10px] font-normal text-slate-400">Isi '0' jika tidak ada</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 2 unit pengganti yang rusak / 0 jika cukup..."
                  value={yangHarusDibeli}
                  onChange={(e) => setYangHarusDibeli(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                />
              </div>

              {/* 8. Sumber Dana */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-[#023246]">
                  Sumber Dana <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={sumberDanaPreset}
                    onChange={(e) => setSumberDanaPreset(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                  >
                    {InventorySarprasRepository.COMMON_FUNDING_SOURCES.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                    <option value="LAINNYA">Sumber Dana Lainnya (Ketik Manual)...</option>
                  </select>

                  {sumberDanaPreset === 'LAINNYA' && (
                    <input
                      type="text"
                      placeholder="Masukkan sumber dana..."
                      value={sumberDanaCustom}
                      onChange={(e) => setSumberDanaCustom(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                      required
                    />
                  )}
                </div>
              </div>

              {/* 9. Keterangan */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-[#023246]">
                  Keterangan Tambahan / Lokasi Detail
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan kondisi spesifik, letak bracket, nomor seri, kelengkapan kabel..."
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                />
              </div>
            </div>

            {/* Tombol Simpan Form */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setViewMode('LIST');
                }}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                className="bg-[#023246] hover:bg-[#18536B]"
              >
                <Save className="w-4 h-4 mr-1.5" />
                <span>{viewMode === 'CREATE' ? 'Simpan ke Inventaris' : 'Simpan Perubahan'}</span>
              </Button>
            </div>
          </form>
        ) : (
          /* ── MODE TAMPILAN DAFTAR BARANG (LIST) ────────────────────────── */
          <div className="space-y-3.5">
            {/* Kartu Ringkasan Statistik Cepat */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase">
                  Total Barang
                </span>
                <p className="text-lg sm:text-xl font-black text-[#023246] mt-0.5">
                  {stats.totalItems}{' '}
                  <span className="text-[11px] font-semibold text-slate-400">
                    ({stats.totalUnits} unit)
                  </span>
                </p>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-emerald-200/80 shadow-2xs">
                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 uppercase">
                  Kondisi Layak
                </span>
                <p className="text-lg sm:text-xl font-black text-emerald-600 mt-0.5">
                  {stats.layakCount}{' '}
                  <span className="text-[11px] font-semibold text-emerald-600/70">
                    ({stats.layakUnits} unit)
                  </span>
                </p>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-rose-200/80 shadow-2xs">
                <span className="text-[10px] sm:text-[11px] font-bold text-rose-700 uppercase">
                  Kondisi Rusak
                </span>
                <p className="text-lg sm:text-xl font-black text-rose-600 mt-0.5">
                  {stats.rusakCount}{' '}
                  <span className="text-[11px] font-semibold text-rose-600/70">
                    ({stats.rusakUnits} unit)
                  </span>
                </p>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-amber-200/80 shadow-2xs">
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 uppercase">
                  Kebutuhan Beli
                </span>
                <p className="text-lg sm:text-xl font-black text-amber-600 mt-0.5">
                  {stats.needPurchaseCount}{' '}
                  <span className="text-[11px] font-semibold text-amber-600/70">item</span>
                </p>
              </div>
            </div>

            {/* Filter & Pencarian */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama barang, merek, ruangan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Filter Ruangan */}
                <select
                  value={selectedRoomFilter}
                  onChange={(e) => setSelectedRoomFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-[#023246] focus:outline-none"
                >
                  <option value="ALL">Semua Ruangan ({uniqueRooms.length})</option>
                  {uniqueRooms.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>

                {/* Filter Kondisi */}
                <select
                  value={selectedConditionFilter}
                  onChange={(e) =>
                    setSelectedConditionFilter(e.target.value as 'ALL' | 'LAYAK' | 'RUSAK')
                  }
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-[#023246] focus:outline-none"
                >
                  <option value="ALL">Semua Kondisi</option>
                  <option value="LAYAK">✅ Layak Pakai</option>
                  <option value="RUSAK">⚠️ Rusak</option>
                </select>
              </div>
            </div>

            {/* List Barang */}
            {isLoading ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <div className="w-8 h-8 border-3 border-[#18536B] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold">Memuat data sarana &amp; prasarana...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-3">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-xl">
                  📦
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">Tidak Ada Data Ditemukan</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {searchQuery || selectedRoomFilter !== 'ALL' || selectedConditionFilter !== 'ALL'
                      ? 'Tidak ada barang yang cocok dengan kriteria filter.'
                      : 'Belum ada data inventaris sarpras yang dicatat.'}
                  </p>
                </div>
                <Button onClick={handleStartCreate} variant="primary" className="text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Tambah Barang Sekarang</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[52vh] overflow-y-auto pr-1">
                {filteredItems.map((item) => {
                  const isLayak = item.kondisi === 'LAYAK';
                  const needsBuy =
                    item.yang_harus_dibeli &&
                    item.yang_harus_dibeli !== '0' &&
                    item.yang_harus_dibeli !== '-';

                  return (
                    <div
                      key={item.id}
                      className="p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/90 hover:border-[#18536B]/40 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-[#023246]/10 text-[#023246]">
                            📍 {item.ruangan}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-extrabold rounded-lg flex items-center gap-1 ${
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
                          <span className="text-[11px] font-semibold text-slate-500">
                            Thn {item.tahun_perolehan} • Sumber: {item.sumber_dana}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-extrabold text-[#023246] group-hover:text-[#18536B] transition-colors">
                            {item.nama_barang}
                          </h4>
                          <p className="text-xs text-slate-600 font-medium mt-0.5">
                            Merek: <span className="font-bold text-slate-800">{item.merek}</span> • Total:{' '}
                            <span className="font-black text-[#023246]">{item.jumlah_total} Unit</span>
                          </p>
                        </div>

                        {needsBuy && (
                          <div className="p-1.5 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                            <span>🛒 Kebutuhan Beli:</span>
                            <span className="font-medium text-amber-950">{item.yang_harus_dibeli}</span>
                          </div>
                        )}

                        {item.keterangan && (
                          <p className="text-[11px] text-slate-500 italic line-clamp-2">
                            "{item.keterangan}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="p-2 text-slate-600 hover:text-[#023246] hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                          title="Edit Barang"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingItem(item)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
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
            <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-3 shadow-2xl text-center">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl">
                ⚠️
              </div>
              <h4 className="text-base font-extrabold text-[#023246]">Hapus Barang Ini?</h4>
              <p className="text-xs text-slate-600">
                Apakah Anda yakin ingin menghapus <span className="font-bold text-slate-900">"{deletingItem.nama_barang}"</span> ({deletingItem.ruangan})? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" onClick={() => setDeletingItem(null)}>
                  Batal
                </Button>
                <Button
                  variant="primary"
                  onClick={handleDeleteItem}
                  className="bg-rose-600 hover:bg-rose-700"
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
