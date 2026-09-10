import React, { useState, useEffect, useMemo } from 'react';
import { InventorySarprasRepository } from '../../../repositories/InventorySarprasRepository';
import type {
  InventorySarprasItem,
  UserProfile,
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
} from 'lucide-react';

interface SarprasExecutiveViewProps {
  currentUser?: UserProfile | null;
  onBackToDashboard?: () => void;
}

export const SarprasExecutiveView: React.FC<SarprasExecutiveViewProps> = ({
  currentUser: _currentUser,
  onBackToDashboard,
}) => {
  const [items, setItems] = useState<InventorySarprasItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState('ALL');
  const [selectedConditionFilter, setSelectedConditionFilter] = useState<'ALL' | 'LAYAK' | 'RUSAK'>('ALL');
  const [selectedFundingFilter, setSelectedFundingFilter] = useState('ALL');

  // Modal Detail Item
  const [selectedItemDetail, setSelectedItemDetail] = useState<InventorySarprasItem | null>(null);

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

  const stats = useMemo(() => InventorySarprasRepository.calculateStatistics(items), [items]);

  const uniqueRooms = useMemo(() => {
    const list = Array.from(new Set(items.map((i) => i.ruangan.trim()))).filter(Boolean);
    return list.sort();
  }, [items]);

  const uniqueFundingSources = useMemo(() => {
    const list = Array.from(new Set(items.map((i) => i.sumber_dana.trim()))).filter(Boolean);
    return list.sort();
  }, [items]);

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
            <div style="height: 60px;"></div>
            <p style="font-weight: bold; text-decoration: underline; margin: 0;">Farhan Sopian Sahid, S.Pd.I</p>
            <p style="font-size: 11px; margin-top: 2px;">NPP: 198807212015041001</p>
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

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Ruangan */}
            <select
              value={selectedRoomFilter}
              onChange={(e) => setSelectedRoomFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
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
              onChange={(e) => setSelectedConditionFilter(e.target.value as any)}
              className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
            >
              <option value="ALL">Semua Kondisi</option>
              <option value="LAYAK">✅ Layak Pakai</option>
              <option value="RUSAK">⚠️ Rusak</option>
            </select>

            {/* Filter Sumber Dana */}
            <select
              value={selectedFundingFilter}
              onChange={(e) => setSelectedFundingFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-[#023246] focus:outline-none focus:ring-2 focus:ring-[#18536B]/30"
            >
              <option value="ALL">Semua Sumber Dana</option>
              {uniqueFundingSources.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabel Desktop / Card Mobile */}
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-9 h-9 border-3 border-[#18536B] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Memuat data inventaris sekolah...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-3">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto text-xl shadow-2xs">
              📦
            </div>
            <h4 className="font-extrabold text-slate-800 text-sm">Data Inventaris Tidak Ditemukan</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Tidak ada aset yang sesuai dengan kriteria pencarian atau filter yang dipilih.
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
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItemDetail(item);
                            }}
                            className="px-2 py-1 text-[11px] font-bold text-[#18536B] hover:bg-[#18536B]/10 rounded-lg transition-colors cursor-pointer"
                          >
                            Rincian
                          </button>
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

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                      <span>Sumber: {item.sumber_dana}</span>
                      <span className="text-[#18536B] font-bold">Lihat Detail →</span>
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

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>
                Diinput oleh:{' '}
                <strong className="text-slate-800">
                  {selectedItemDetail.created_by_name || 'M. Iqbal Gustiawan'}
                </strong>
              </span>
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
      )}
    </div>
  );
};
