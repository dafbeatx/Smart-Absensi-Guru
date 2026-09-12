import React, { useState, useEffect, useMemo } from 'react';
import { InventorySarprasRepository } from '../../../repositories/InventorySarprasRepository';
import { useToastStore } from '../../../store/useToastStore';
import type {
  InventorySarprasItem,
  UserProfile,
  SarprasCondition,
  UpdateInventorySarprasDTO,
} from '../../../types/database.types';
import {
  Boxes,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Search,
  X,
  Info,
  ArrowLeft,
  Edit2,
  Trash2,
  Save,
  Building2,
  Calendar,
  Coins,
} from 'lucide-react';
import { ModernSarprasSelect } from './ModernSarprasSelect';

interface SarprasExecutiveViewProps {
  currentUser?: UserProfile | null;
  onBackToDashboard?: () => void;
}

export const SarprasExecutiveView: React.FC<SarprasExecutiveViewProps> = ({
  currentUser: _currentUser,
  onBackToDashboard,
}) => {
  const { showToast } = useToastStore();
  const [items, setItems] = useState<InventorySarprasItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState('ALL');
  const [selectedConditionFilter, setSelectedConditionFilter] = useState<'ALL' | 'LAYAK' | 'RUSAK'>('ALL');
  const [selectedFundingFilter, setSelectedFundingFilter] = useState('ALL');

  // Modal Detail Item
  const [selectedItemDetail, setSelectedItemDetail] = useState<InventorySarprasItem | null>(null);

  // Modal Delete State
  const [deletingItem, setDeletingItem] = useState<InventorySarprasItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal Edit State
  const [editingItem, setEditingItem] = useState<InventorySarprasItem | null>(null);
  const [editRuanganPreset, setEditRuanganPreset] = useState<string>(InventorySarprasRepository.COMMON_ROOMS[0]);
  const [editRuanganCustom, setEditRuanganCustom] = useState('');
  const [editNamaBarang, setEditNamaBarang] = useState('');
  const [editJumlahTotal, setEditJumlahTotal] = useState<number | string>(1);
  const [editMerek, setEditMerek] = useState('');
  const [editTahunPerolehan, setEditTahunPerolehan] = useState<number>(new Date().getFullYear());
  const [editKondisi, setEditKondisi] = useState<SarprasCondition>('LAYAK');
  const [editYangHarusDibeli, setEditYangHarusDibeli] = useState('0');
  const [editSumberDanaPreset, setEditSumberDanaPreset] = useState<string>(InventorySarprasRepository.COMMON_FUNDING_SOURCES[0]);
  const [editSumberDanaCustom, setEditSumberDanaCustom] = useState('');
  const [editKeterangan, setEditKeterangan] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await InventorySarprasRepository.getAll();
      setItems(data);
    } catch (err) {
      console.warn('Gagal memuat data sarpras eksekutif:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartEdit = (item: InventorySarprasItem) => {
    setEditingItem(item);
    if (InventorySarprasRepository.COMMON_ROOMS.includes(item.ruangan)) {
      setEditRuanganPreset(item.ruangan);
      setEditRuanganCustom('');
    } else {
      setEditRuanganPreset('LAINNYA');
      setEditRuanganCustom(item.ruangan);
    }
    setEditNamaBarang(item.nama_barang);
    setEditJumlahTotal(item.jumlah_total);
    setEditMerek(item.merek);
    setEditTahunPerolehan(item.tahun_perolehan);
    setEditKondisi(item.kondisi);
    setEditYangHarusDibeli(item.yang_harus_dibeli || '0');
    if (InventorySarprasRepository.COMMON_FUNDING_SOURCES.includes(item.sumber_dana)) {
      setEditSumberDanaPreset(item.sumber_dana);
      setEditSumberDanaCustom('');
    } else {
      setEditSumberDanaPreset('LAINNYA');
      setEditSumberDanaCustom(item.sumber_dana);
    }
    setEditKeterangan(item.keterangan || '');
    if (selectedItemDetail?.id === item.id) {
      setSelectedItemDetail(null);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const finalRuangan = editRuanganPreset === 'LAINNYA' ? editRuanganCustom.trim() : editRuanganPreset;
    const finalSumberDana = editSumberDanaPreset === 'LAINNYA' ? editSumberDanaCustom.trim() : editSumberDanaPreset;

    if (!finalRuangan) {
      showToast('warning', 'Validasi Form', 'Silakan pilih atau isi nama ruangan.');
      return;
    }
    if (!editNamaBarang.trim()) {
      showToast('warning', 'Validasi Form', 'Nama barang wajib diisi.');
      return;
    }
    if (!editMerek.trim()) {
      showToast('warning', 'Validasi Form', 'Merek barang wajib diisi.');
      return;
    }
    if (!editJumlahTotal || Number(editJumlahTotal) <= 0) {
      showToast('warning', 'Validasi Form', 'Jumlah total barang minimal 1 unit.');
      return;
    }

    setIsUpdating(true);
    try {
      const dto: UpdateInventorySarprasDTO = {
        ruangan: finalRuangan,
        nama_barang: editNamaBarang.trim(),
        jumlah_total: Number(editJumlahTotal),
        merek: editMerek.trim(),
        tahun_perolehan: Number(editTahunPerolehan),
        kondisi: editKondisi,
        yang_harus_dibeli: editYangHarusDibeli.trim() || '0',
        sumber_dana: finalSumberDana,
        keterangan: editKeterangan.trim() || undefined,
      };

      await InventorySarprasRepository.update(editingItem.id, dto);
      setItems((prev) =>
        prev.map((i) => (i.id === editingItem.id ? { ...i, ...dto, updated_at: new Date().toISOString() } : i))
      );
      showToast('success', 'Pembaruan Berhasil', `Data inventaris ${editNamaBarang} berhasil diperbarui.`);
      setEditingItem(null);
    } catch (err) {
      console.warn('Gagal memperbarui sarpras:', err);
      showToast('error', 'Gagal Memperbarui', 'Terjadi kesalahan saat memperbarui data inventaris.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      await InventorySarprasRepository.delete(deletingItem.id);
      setItems((prev) => prev.filter((i) => i.id !== deletingItem.id));
      if (selectedItemDetail?.id === deletingItem.id) {
        setSelectedItemDetail(null);
      }
      showToast('success', 'Barang Dihapus', `${deletingItem.nama_barang} telah dihapus dari inventaris.`);
      setDeletingItem(null);
    } catch (err) {
      console.warn('Gagal menghapus sarpras:', err);
      showToast('error', 'Gagal Menghapus', 'Tidak dapat menghapus item inventaris.');
    } finally {
      setIsDeleting(false);
    }
  };

  const stats = useMemo(() => InventorySarprasRepository.calculateStatistics(items), [items]);

  const uniqueRooms = useMemo(() => {
    const list = Array.from(new Set(items.map((i) => i.ruangan.trim()))).filter(Boolean);
    return list.sort();
  }, [items]);

  const uniqueFundingSources = useMemo(() => {
    const list = Array.from(new Set(items.map((i) => i.sumber_dana.trim()))).filter(Boolean);
    return list.sort();
  }, [items]);

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

  const filterFundingOptions = useMemo(() => {
    const opts = [{ value: 'ALL', label: 'Semua Sumber Dana' }];
    uniqueFundingSources.forEach((f) => opts.push({ value: f, label: f }));
    return opts;
  }, [uniqueFundingSources]);

  const editRoomOptions = useMemo(() => {
    const opts = InventorySarprasRepository.COMMON_ROOMS.map((r) => ({
      value: r,
      label: r,
    }));
    opts.push({ value: 'LAINNYA', label: '➕ Ruangan Lainnya (Ketik Manual)...' });
    return opts;
  }, []);

  const editFundingOptions = useMemo(() => {
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
      const matchFunding =
        selectedFundingFilter === 'ALL' || item.sumber_dana === selectedFundingFilter;

      return matchQuery && matchRoom && matchCondition && matchFunding;
    });
  }, [items, searchQuery, selectedRoomFilter, selectedConditionFilter, selectedFundingFilter]);

  // Cetak Dokumen Resmi PDF
  const handlePrintOfficialReport = () => {
    if (typeof window === 'undefined') return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Mohon izinkan pop-up browser untuk mencetak laporan inventaris sarpras.');
      return;
    }

    const todayDateFormatted = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const rowsHtml = filteredItems
      .map(
        (item, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 8px 6px; text-align: center;">${idx + 1}</td>
          <td style="padding: 8px 6px; font-weight: bold;">${item.ruangan}</td>
          <td style="padding: 8px 6px;">${item.nama_barang}</td>
          <td style="padding: 8px 6px;">${item.merek}</td>
          <td style="padding: 8px 6px; text-align: center;">${item.tahun_perolehan}</td>
          <td style="padding: 8px 6px; text-align: center; font-weight: bold;">${item.jumlah_total}</td>
          <td style="padding: 8px 6px; text-align: center;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; ${
              item.kondisi === 'LAYAK'
                ? 'background: #dcfce7; color: #166534;'
                : 'background: #ffe4e6; color: #9f1239;'
            }">
              ${item.kondisi === 'LAYAK' ? 'Layak Pakai' : 'Rusak'}
            </span>
          </td>
          <td style="padding: 8px 6px; color: #92400e;">${item.yang_harus_dibeli || '0'}</td>
          <td style="padding: 8px 6px;">${item.sumber_dana}</td>
          <td style="padding: 8px 6px; font-size: 10px; color: #475569;">${item.keterangan || '-'}</td>
        </tr>
      `
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Laporan Inventaris Sarana dan Prasarana Sekolah</title>
        <style>
          @page { size: landscape; margin: 15mm; }
          body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 15px; }
          .header-box { text-align: center; border-bottom: 3px double #023246; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 18px; font-weight: 900; color: #023246; text-transform: uppercase; margin: 0; }
          .subtitle { font-size: 12px; color: #475569; margin-top: 4px; }
          .meta-table { width: 100%; margin-bottom: 15px; font-size: 11px; }
          .data-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .data-table th { background: #023246; color: white; padding: 9px 6px; font-size: 11px; text-align: left; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; page-break-inside: avoid; }
          .sig-col { text-align: center; width: 260px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div class="title">LEMBAR INVENTARIS SARANA DAN PRASARANA (SARPRAS)</div>
          <div class="subtitle">SMP Terpadu Al-Ittihadiyah &amp; SMA Terpadu As Salaam • Tahun Ajaran 2026/2027</div>
        </div>

        <table class="meta-table">
          <tr>
            <td><strong>Tanggal Cetak:</strong> ${todayDateFormatted}</td>
            <td><strong>Total Jenis Aset:</strong> ${stats.totalItems} Barang</td>
            <td><strong>Total Fisik:</strong> ${stats.totalUnits} Unit</td>
            <td><strong>Layak:</strong> ${stats.layakUnits} Unit | <strong>Rusak:</strong> ${stats.rusakUnits} Unit</td>
          </tr>
        </table>

        <table class="data-table">
          <thead>
            <tr>
              <th style="text-align: center; width: 30px;">No</th>
              <th>Ruangan</th>
              <th>Nama Barang</th>
              <th>Merek</th>
              <th style="text-align: center; width: 50px;">Tahun</th>
              <th style="text-align: center; width: 50px;">Total</th>
              <th style="text-align: center; width: 80px;">Kondisi</th>
              <th>Yang Harus Dibeli</th>
              <th>Sumber Dana</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-col">
            <p>Petugas Penanggung Jawab Sarpras,</p>
            <p style="color: #64748b; font-size: 10px;">Wakasek Sarana dan Prasarana</p>
            <div style="height: 60px;"></div>
            <p style="font-weight: bold; text-decoration: underline; margin: 0;">Muhammad Iqbal Gustiawan, S.Pd., G.r</p>
            <p style="font-size: 11px; margin-top: 2px;">NPP: 199304152021021002</p>
          </div>

          <div class="sig-col">
            <p>Bogor, ${todayDateFormatted}</p>
            <p style="font-weight: bold; margin: 0;">Mengetahui,</p>
            <p style="color: #64748b; font-size: 10px;">Kepala Sekolah</p>
            <div style="height: 60px; position: relative;">
              <img 
                src="/stempel-ttd-kepsek-as-salaam.png" 
                alt="Stempel & TTD Kepala Sekolah" 
                style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); height: 75px; object-fit: contain; pointer-events: none;" 
              />
            </div>
            <p style="font-weight: bold; text-decoration: underline; margin: 0; position: relative; z-index: 5;">Farhan Sopian Sahid, S.Pd.I</p>
            <p style="font-size: 11px; margin-top: 2px; position: relative; z-index: 5;">NPP: 198807212015041001</p>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto font-sans text-[#023246]">
      {/* ── HEADER & KONTROL EKSEKUTIF KEPALA SEKOLAH ─────────────────── */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#023246] text-white flex items-center justify-center shrink-0 shadow-md">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-[#023246]">
                  Laporan Inventaris Sarana &amp; Prasarana
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                  👑 Mode Tinjauan Kepala Sekolah
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                Pemantauan aset fasilitas sekolah, kondisi barang per ruangan, dan kebutuhan pengadaan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => InventorySarprasRepository.exportToCSV(filteredItems)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Ekspor CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrintOfficialReport}
              className="px-4 py-2 bg-[#023246] hover:bg-[#18536B] text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Laporan PDF</span>
            </button>
          </div>
        </div>

        {/* Banner Penanggung Jawab Form (M. Iqbal Gustiawan) */}
        <div className="bg-[#18536B]/10 border border-[#18536B]/25 rounded-2xl p-3 sm:p-3.5 flex items-center gap-3">
          <Info className="w-5 h-5 text-[#18536B] shrink-0" />
          <p className="text-xs text-slate-700 leading-relaxed">
            Data inventaris ini diisi dan diverifikasi langsung oleh{' '}
            <span className="font-extrabold text-[#023246]">Muhammad Iqbal Gustiawan, S.Pd., G.r</span> (Wakasek Sarana dan Prasarana). Form pengisian terkunci secara aman hanya pada akun beliau.
          </p>
        </div>

        {/* ── CARD METRIK STATISTIK EKSEKUTIF ──────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3.5 pt-1">
          {/* Card 1: Total Macam Barang */}
          <div className="p-3.5 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-wider">
              Total Jenis Aset
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-[#023246]">{stats.totalItems}</span>
              <span className="text-xs font-semibold text-slate-500">Barang</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Total {stats.totalUnits} unit fisik</p>
          </div>

          {/* Card 2: Layak Pakai */}
          <div className="p-3.5 sm:p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 shadow-2xs">
            <span className="text-[10px] sm:text-[11px] font-black text-emerald-800 uppercase tracking-wider">
              Kondisi Layak
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-emerald-700">{stats.layakUnits}</span>
              <span className="text-xs font-semibold text-emerald-800/80">Unit</span>
            </div>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">{stats.layakCount} jenis barang</p>
          </div>

          {/* Card 3: Kondisi Rusak */}
          <div className="p-3.5 sm:p-4 bg-rose-50/60 rounded-2xl border border-rose-200 shadow-2xs">
            <span className="text-[10px] sm:text-[11px] font-black text-rose-800 uppercase tracking-wider">
              Kondisi Rusak
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-rose-700">{stats.rusakUnits}</span>
              <span className="text-xs font-semibold text-rose-800/80">Unit</span>
            </div>
            <p className="text-[11px] text-rose-600 font-semibold mt-0.5">{stats.rusakCount} jenis barang</p>
          </div>

          {/* Card 4: Kebutuhan Pembelian */}
          <div className="p-3.5 sm:p-4 bg-amber-50/60 rounded-2xl border border-amber-200 shadow-2xs">
            <span className="text-[10px] sm:text-[11px] font-black text-amber-900 uppercase tracking-wider">
              Harus Dibeli
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-amber-700">{stats.needPurchaseCount}</span>
              <span className="text-xs font-semibold text-amber-900/80">Item</span>
            </div>
            <p className="text-[11px] text-amber-700 font-semibold mt-0.5">Prioritas anggaran</p>
          </div>

          {/* Card 5: Sebaran Ruangan */}
          <div className="p-3.5 sm:p-4 bg-blue-50/60 rounded-2xl border border-blue-200 shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-[10px] sm:text-[11px] font-black text-blue-900 uppercase tracking-wider">
              Ruangan
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-blue-800">{stats.roomsCount}</span>
              <span className="text-xs font-semibold text-blue-900/80">Lokasi</span>
            </div>
            <p className="text-[11px] text-blue-600 font-semibold mt-0.5">Terdata menyeluruh</p>
          </div>
        </div>
      </div>

      {/* ── FILTER & TABEL DATA INVENTARIS ────────────────────────────── */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        {/* Search & Filter Controls */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama barang, merek, ruangan, atau keterangan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto">
            {/* Filter Ruangan */}
            <ModernSarprasSelect
              compact
              placeholder="Filter Ruangan..."
              options={filterRoomOptions}
              value={selectedRoomFilter}
              onChange={(val) => setSelectedRoomFilter(val)}
              searchable
            />

            {/* Filter Kondisi */}
            <ModernSarprasSelect
              compact
              placeholder="Filter Kondisi..."
              options={filterConditionOptions}
              value={selectedConditionFilter}
              onChange={(val) => setSelectedConditionFilter(val as any)}
            />

            {/* Filter Sumber Dana */}
            <ModernSarprasSelect
              compact
              placeholder="Filter Sumber Dana..."
              options={filterFundingOptions}
              value={selectedFundingFilter}
              onChange={(val) => setSelectedFundingFilter(val)}
              searchable
            />
          </div>
        </div>

        {/* Tabel Desktop / Card Mobile */}
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-9 h-9 border-3 border-[#18536B] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Memuat data inventaris sekolah...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-xl shadow-2xs">
              📦
            </div>
            <h4 className="font-extrabold text-slate-800 text-sm">
              {searchQuery || selectedRoomFilter !== 'ALL' || selectedConditionFilter !== 'ALL' || selectedFundingFilter !== 'ALL'
                ? 'Data Inventaris Tidak Ditemukan'
                : 'Belum Ada Data Inventaris'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || selectedRoomFilter !== 'ALL' || selectedConditionFilter !== 'ALL' || selectedFundingFilter !== 'ALL'
                ? 'Tidak ada aset yang sesuai dengan kriteria pencarian atau filter yang dipilih.'
                : 'Daftar inventaris sarana dan prasarana masih kosong. Formulir input akan diisi oleh Wakasek Sarpras (M. Iqbal Gustiawan).'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                    <th className="py-3 px-3.5 text-center w-12">No</th>
                    <th className="py-3 px-3.5">Ruangan</th>
                    <th className="py-3 px-3.5">Nama Barang</th>
                    <th className="py-3 px-3.5">Merek</th>
                    <th className="py-3 px-3.5 text-center">Tahun</th>
                    <th className="py-3 px-3.5 text-center">Jumlah</th>
                    <th className="py-3 px-3.5 text-center">Kondisi</th>
                    <th className="py-3 px-3.5">Yang Harus Dibeli</th>
                    <th className="py-3 px-3.5">Sumber Dana</th>
                    <th className="py-3 px-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredItems.map((item, idx) => {
                    const isLayak = item.kondisi === 'LAYAK';
                    const hasPurchaseReq =
                      item.yang_harus_dibeli &&
                      item.yang_harus_dibeli !== '0' &&
                      item.yang_harus_dibeli !== '-';

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedItemDetail(item)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-3.5 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3.5 font-bold text-[#023246]">
                          {item.ruangan}
                        </td>
                        <td className="py-3 px-3.5 font-extrabold text-[#18536B]">
                          {item.nama_barang}
                        </td>
                        <td className="py-3 px-3.5">{item.merek}</td>
                        <td className="py-3 px-3.5 text-center">{item.tahun_perolehan}</td>
                        <td className="py-3 px-3.5 text-center font-black text-[#023246]">
                          {item.jumlah_total}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
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
                            <span>{isLayak ? 'Layak' : 'Rusak'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3.5">
                          {hasPurchaseReq ? (
                            <span className="font-bold text-amber-700">{item.yang_harus_dibeli}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-slate-600">{item.sumber_dana}</td>
                        <td className="py-3 px-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItemDetail(item);
                              }}
                              className="px-2 py-1 text-[11px] font-bold text-[#18536B] hover:bg-[#18536B]/10 rounded-lg transition-colors cursor-pointer"
                              title="Lihat Rincian"
                            >
                              Rincian
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(item);
                              }}
                              className="p-1.5 text-slate-500 hover:text-[#023246] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit Aset"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingItem(item);
                              }}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Aset"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-2.5">
              {filteredItems.map((item) => {
                const isLayak = item.kondisi === 'LAYAK';
                const hasPurchaseReq =
                  item.yang_harus_dibeli &&
                  item.yang_harus_dibeli !== '0' &&
                  item.yang_harus_dibeli !== '-';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemDetail(item)}
                    className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 active:scale-[0.99] transition-all space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-[#023246]/10 text-[#023246]">
                        📍 {item.ruangan}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black ${
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
                        <span>{isLayak ? 'Layak' : 'Rusak'}</span>
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-extrabold text-[#023246]">{item.nama_barang}</h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Merek: <span className="font-bold text-slate-800">{item.merek}</span> • Total:{' '}
                        <span className="font-black text-[#023246]">{item.jumlah_total} Unit</span> • Thn{' '}
                        {item.tahun_perolehan}
                      </p>
                    </div>

                    {hasPurchaseReq && (
                      <div className="p-2 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] font-bold text-amber-900">
                        🛒 Yang Harus Dibeli: {item.yang_harus_dibeli}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
                      <span>Sumber: {item.sumber_dana}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(item);
                          }}
                          className="p-1 text-slate-500 hover:text-[#023246] hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                          title="Edit Aset"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingItem(item);
                          }}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-100/60 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Aset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[#18536B] font-bold">Rincian →</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── MODAL RINCIAN ITEM DETAIL ──────────────────────────────────── */}
      {selectedItemDetail && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedItemDetail(null)}
        >
          <div
            className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-[#023246] text-white">
                  📍 {selectedItemDetail.ruangan}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-black rounded-lg ${
                    selectedItemDetail.kondisi === 'LAYAK'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {selectedItemDetail.kondisi === 'LAYAK' ? '✅ Layak Pakai' : '⚠️ Rusak'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-black text-[#023246]">
                {selectedItemDetail.nama_barang}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Merek: <span className="font-bold text-slate-800">{selectedItemDetail.merek}</span> • Tahun Perolehan:{' '}
                <span className="font-bold text-slate-800">{selectedItemDetail.tahun_perolehan}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
              <div>
                <span className="text-slate-500 font-bold block text-[10px] uppercase">Jumlah Total</span>
                <span className="text-base font-black text-[#023246]">
                  {selectedItemDetail.jumlah_total} Unit
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block text-[10px] uppercase">Sumber Pendanaan</span>
                <span className="font-extrabold text-slate-800">{selectedItemDetail.sumber_dana}</span>
              </div>
            </div>

            {/* Kebutuhan Pengadaan */}
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/80 space-y-1">
              <span className="text-[10px] font-black uppercase text-amber-900 flex items-center gap-1">
                <span>🛒 Yang Harus Dibeli / Pengadaan Baru:</span>
              </span>
              <p className="text-xs font-bold text-amber-950">
                {selectedItemDetail.yang_harus_dibeli &&
                selectedItemDetail.yang_harus_dibeli !== '0' &&
                selectedItemDetail.yang_harus_dibeli !== '-'
                  ? selectedItemDetail.yang_harus_dibeli
                  : 'Tidak ada kebutuhan pembelian saat ini (kondisi tercukupi).'}
              </p>
            </div>

            {/* Keterangan */}
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400">
                Keterangan &amp; Catatan Khusus
              </span>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                {selectedItemDetail.keterangan || 'Tidak ada keterangan tambahan.'}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span>
                Diinput oleh:{' '}
                <strong className="text-slate-800">
                  {selectedItemDetail.created_by_name || 'M. Iqbal Gustiawan'}
                </strong>
              </span>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    const item = selectedItemDetail;
                    setSelectedItemDetail(null);
                    handleStartEdit(item);
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-[#023246] font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[#18536B]" />
                  <span>Edit Data</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const item = selectedItemDetail;
                    setSelectedItemDetail(null);
                    setDeletingItem(item);
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Hapus</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItemDetail(null)}
                  className="px-4 py-2 bg-[#023246] hover:bg-[#18536B] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDIT ITEM SARPRAS (EKSEKUTIF) ─────────────────────────── */}
      {editingItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditingItem(null)}
        >
          <div
            className="bg-white rounded-3xl p-5 sm:p-6 max-w-xl w-full space-y-4 shadow-2xl my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#18536B]/10 text-[#18536B] rounded-xl">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-[#023246]">Edit Data Inventaris Sarpras</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Perbarui rincian aset atau kebutuhan pengadaan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Ruangan */}
                <div className="space-y-1 sm:col-span-2">
                  <ModernSarprasSelect
                    label="Ruangan Mana?"
                    required
                    icon={<Building2 className="w-3.5 h-3.5" />}
                    placeholder="Pilih Ruangan..."
                    options={editRoomOptions}
                    value={editRuanganPreset}
                    onChange={(val) => setEditRuanganPreset(val)}
                    allowCustomInput
                    customValue={editRuanganCustom}
                    onCustomChange={(val) => setEditRuanganCustom(val)}
                    customPlaceholder="Ketik nama ruangan baru..."
                    searchable
                  />
                </div>

                {/* Nama Barang */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-extrabold text-[#023246]">
                    Nama Barang <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editNamaBarang}
                    onChange={(e) => setEditNamaBarang(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                    required
                  />
                </div>

                {/* Merek */}
                <div className="space-y-1">
                  <label className="font-extrabold text-[#023246]">
                    Merek <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editMerek}
                    onChange={(e) => setEditMerek(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                    required
                  />
                </div>

                {/* Jumlah Total */}
                <div className="space-y-1">
                  <label className="font-extrabold text-[#023246]">
                    Jumlah Total (Unit) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editJumlahTotal}
                    onChange={(e) => setEditJumlahTotal(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                    required
                  />
                </div>

                {/* Tahun Perolehan */}
                <div className="space-y-1">
                  <ModernSarprasSelect
                    label="Tahun Perolehan"
                    required
                    icon={<Calendar className="w-3.5 h-3.5" />}
                    placeholder="Pilih Tahun..."
                    options={yearOptions}
                    value={String(editTahunPerolehan)}
                    onChange={(val) => setEditTahunPerolehan(Number(val))}
                  />
                </div>

                {/* Kondisi */}
                <div className="space-y-1">
                  <label className="font-extrabold text-[#023246]">
                    Kondisi Aset <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditKondisi('LAYAK')}
                      className={`p-2 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-all ${
                        editKondisi === 'LAYAK'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Layak</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditKondisi('RUSAK')}
                      className={`p-2 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-all ${
                        editKondisi === 'RUSAK'
                          ? 'border-rose-500 bg-rose-50 text-rose-800'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Rusak</span>
                    </button>
                  </div>
                </div>

                {/* Yang Harus Dibeli */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-extrabold text-[#023246] flex items-center justify-between">
                    <span>Yang Harus Dibeli (Pengadaan / Penggantian)</span>
                    <span className="text-[10px] font-normal text-slate-400">Isi '0' jika tidak ada</span>
                  </label>
                  <input
                    type="text"
                    value={editYangHarusDibeli}
                    onChange={(e) => setEditYangHarusDibeli(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                  />
                </div>

                {/* Sumber Dana */}
                <div className="space-y-1 sm:col-span-2">
                  <ModernSarprasSelect
                    label="Sumber Dana"
                    required
                    icon={<Coins className="w-3.5 h-3.5" />}
                    placeholder="Pilih Sumber Dana..."
                    options={editFundingOptions}
                    value={editSumberDanaPreset}
                    onChange={(val) => setEditSumberDanaPreset(val)}
                    allowCustomInput
                    customValue={editSumberDanaCustom}
                    onCustomChange={(val) => setEditSumberDanaCustom(val)}
                    customPlaceholder="Ketik sumber dana lain..."
                    searchable
                  />
                </div>

                {/* Keterangan */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-extrabold text-[#023246]">Keterangan Tambahan</label>
                  <textarea
                    rows={2}
                    value={editKeterangan}
                    onChange={(e) => setEditKeterangan(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  disabled={isUpdating}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#023246] hover:bg-[#18536B] text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  disabled={isUpdating}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL KONFIRMASI HAPUS ──────────────────────────────────────── */}
      {deletingItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeletingItem(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Hapus Barang Dari Inventaris?</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Aset <strong>{deletingItem.nama_barang}</strong> ({deletingItem.ruangan}) akan dihapus secara permanen dari daftar inventaris sarpras sekolah.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                disabled={isDeleting}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                disabled={isDeleting}
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Aset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
