import React, { useState, useEffect } from 'react';
import { ProviderFactory } from '../../../providers/provider-factory';
import { useToastStore } from '../../../store/useToastStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import type { HolidayRecord, HolidayType } from '../../../types/database.types';

export const AcademicCalendarManagement: React.FC = () => {
  const { token } = useAuthStore();
  const { showToast } = useToastStore();

  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'LIST'>('CALENDAR');

  // Month navigation for Grid view (0 = Jan, 11 = Dec)
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth()); // 0-based

  // Search & Filters for List view
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<HolidayRecord | null>(null);

  // Form Fields
  const [formData, setFormData] = useState<{
    date: string;
    name: string;
    type: HolidayType;
    description: string;
  }>({
    date: new Date().toISOString().substring(0, 10),
    name: '',
    type: 'NATIONAL_HOLIDAY',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [deletingHoliday, setDeletingHoliday] = useState<HolidayRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchHolidays = async () => {
    setIsLoading(true);
    try {
      const provider = ProviderFactory.getProvider();
      const list = await provider.getHolidays(token || undefined);
      setHolidays(list || []);
    } catch (err) {
      console.error('Error fetching holidays:', err);
      showToast('error', 'Gagal Memuat Kalender', 'Gagal mengambil data kalender akademik.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [token]);

  const handleOpenAdd = (defaultDate?: string) => {
    setEditingHoliday(null);
    setFormData({
      date: defaultDate || new Date().toISOString().substring(0, 10),
      name: '',
      type: 'NATIONAL_HOLIDAY',
      description: '',
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (item: HolidayRecord) => {
    setEditingHoliday(item);
    setFormData({
      date: item.date,
      name: item.name,
      type: item.type,
      description: item.description || '',
    });
    setIsFormModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.name.trim()) {
      showToast('error', 'Input Tidak Lengkap', 'Tanggal dan Nama Libur wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const provider = ProviderFactory.getProvider();
      if (editingHoliday) {
        await provider.updateHoliday(editingHoliday.id, formData, token || undefined);
        showToast('success', 'Perubahan Disimpan', `Hari libur "${formData.name}" berhasil diperbarui.`);
      } else {
        await provider.createHoliday(formData, token || undefined);
        showToast('success', 'Hari Libur Ditambahkan', `"${formData.name}" berhasil dimasukkan ke Kalender Akademik.`);
      }
      setIsFormModalOpen(false);
      await fetchHolidays();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan hari libur';
      showToast('error', 'Gagal Menyimpan', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingHoliday) return;
    setIsDeleting(true);
    try {
      const provider = ProviderFactory.getProvider();
      await provider.deleteHoliday(deletingHoliday.id, token || undefined);
      showToast('info', 'Hari Libur Dihapus', `"${deletingHoliday.name}" telah dihapus.`);
      setDeletingHoliday(null);
      await fetchHolidays();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus hari libur';
      showToast('error', 'Gagal Menghapus', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLoadPresets = async () => {
    try {
      localStorage.removeItem('smart_absensi_holidays');
      await fetchHolidays();
      showToast('success', 'Preset Berhasil Dimuat!', 'Kalender Akademik & Tanggal Merah 2026 diperbarui.');
    } catch (err) {
      showToast('error', 'Gagal Memuat Preset', String(err));
    }
  };

  // Helper formatting for holiday type badges
  const getTypeBadge = (type: HolidayType) => {
    switch (type) {
      case 'NATIONAL_HOLIDAY':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-200">🔴 Libur Nasional</span>;
      case 'SCHOOL_HOLIDAY':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">🏫 Libur Sekolah</span>;
      case 'CUTI_BERSAMA':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">🗓️ Cuti Bersama</span>;
      case 'OTHER':
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">📢 Agenda Khusus</span>;
    }
  };

  // Filtering for List view
  const filteredHolidays = holidays.filter((h) => {
    const matchesSearch = h.name.toLowerCase().includes(searchQuery.toLowerCase()) || h.date.includes(searchQuery);
    const matchesType = filterType === 'ALL' || h.type === filterType;
    return matchesSearch && matchesType;
  });

  // Calendar Grid calculations
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfWeek = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // 0 = Monday, 6 = Sunday
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);

  // Map holidays by YYYY-MM-DD for fast lookup in grid
  const holidaysMap = new Map<string, HolidayRecord>();
  holidays.forEach((h) => holidaysMap.set(h.date, h));

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-card space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 font-extrabold text-[11px] rounded-full border border-purple-200">
              📅 Terintegrasi Seluruh Guru & Sekolah
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900">Kalender Akademik & Hari Libur Global</h2>
          <p className="text-xs text-slate-500">
            Kelola hari libur nasional, libur sekolah, dan agenda terpusat tanpa perlu disetel satu per satu oleh guru.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleLoadPresets}
            className="text-xs py-2 px-3.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-extrabold rounded-2xl border border-amber-300 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <span>⚡</span> Preset Tanggal Merah 2026
          </button>

          <Button
            variant="primary"
            onClick={() => handleOpenAdd()}
            className="text-xs py-2 px-3.5 flex items-center gap-1.5"
          >
            <span>➕</span> Tambah Hari Libur
          </Button>
        </div>
      </div>

      {/* View Selector & Summary */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
          <button
            onClick={() => setViewMode('CALENDAR')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              viewMode === 'CALENDAR'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            🗓️ Grid Kalender
          </button>
          <button
            onClick={() => setViewMode('LIST')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              viewMode === 'LIST'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            📋 Daftar Agregat ({holidays.length})
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-600 font-semibold overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Libur Nasional
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" /> Libur Sekolah
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Cuti Bersama
          </span>
        </div>
      </div>

      {/* Mode 1: Interactive Grid Calendar */}
      {viewMode === 'CALENDAR' && (
        <div className="space-y-4">
          {/* Calendar Month Header Controller */}
          <div className="flex items-center justify-between bg-slate-900 text-white p-4 rounded-2xl shadow-md">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-slate-800 rounded-xl transition-colors font-extrabold text-sm"
            >
              ◀️ Bulan Sebelumnya
            </button>
            <div className="text-center">
              <h3 className="text-base font-black tracking-wide">
                {monthNames[currentMonth]} {currentYear}
              </h3>
              <p className="text-[11px] text-purple-300 font-semibold mt-0.5">
                {holidays.filter((h) => {
                  const [y, m] = h.date.split('-').map(Number);
                  return y === currentYear && m === currentMonth + 1;
                }).length} Hari Libur di Bulan Ini
              </p>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-slate-800 rounded-xl transition-colors font-extrabold text-sm"
            >
              Bulan Berikutnya ▶️
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-black text-xs text-slate-500 bg-slate-100 p-2 rounded-xl">
            <span>Senin</span>
            <span>Selasa</span>
            <span>Rabu</span>
            <span>Kamis</span>
            <span>Jumat</span>
            <span className="text-amber-600">Sabtu</span>
            <span className="text-red-600">Minggu</span>
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Empty Offset Cells */}
            {Array.from({ length: firstDay }).map((_, idx) => (
              <div key={`empty-${idx}`} className="min-h-24 bg-slate-50/50 rounded-2xl border border-slate-100 opacity-30" />
            ))}

            {/* Month Day Cells */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const monthStr = String(currentMonth + 1).padStart(2, '0');
              const dayStr = String(dayNum).padStart(2, '0');
              const dateIso = `${currentYear}-${monthStr}-${dayStr}`;

              const isSunday = (firstDay + idx) % 7 === 6;
              const isSaturday = (firstDay + idx) % 7 === 5;
              const holiday = holidaysMap.get(dateIso);

              return (
                <div
                  key={dateIso}
                  onClick={() => {
                    if (holiday) {
                      handleOpenEdit(holiday);
                    } else {
                      handleOpenAdd(dateIso);
                    }
                  }}
                  className={`min-h-24 p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                    holiday
                      ? holiday.type === 'NATIONAL_HOLIDAY'
                        ? 'bg-red-50/80 border-red-200 hover:border-red-400'
                        : holiday.type === 'SCHOOL_HOLIDAY'
                        ? 'bg-purple-50/80 border-purple-200 hover:border-purple-400'
                        : holiday.type === 'CUTI_BERSAMA'
                        ? 'bg-amber-50/80 border-amber-200 hover:border-amber-400'
                        : 'bg-blue-50/80 border-blue-200 hover:border-blue-400'
                      : isSunday
                      ? 'bg-red-50/30 border-slate-100 hover:bg-slate-50'
                      : isSaturday
                      ? 'bg-amber-50/20 border-slate-100 hover:bg-slate-50'
                      : 'bg-white border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span
                      className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${
                        holiday
                          ? 'bg-white shadow-xs font-extrabold text-slate-900'
                          : isSunday
                          ? 'text-red-600 font-bold'
                          : isSaturday
                          ? 'text-amber-600 font-bold'
                          : 'text-slate-700'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {holiday && (
                      <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity font-bold text-slate-500">
                        ✏️ Edit
                      </span>
                    )}
                  </div>

                  {holiday ? (
                    <div className="space-y-0.5 mt-1">
                      <p className="text-[11px] font-extrabold text-slate-900 leading-tight line-clamp-2">
                        {holiday.name}
                      </p>
                      <p className="text-[9px] text-slate-500 font-medium">
                        {holiday.type === 'NATIONAL_HOLIDAY' ? '🔴 Nasional' : holiday.type === 'SCHOOL_HOLIDAY' ? '🏫 Sekolah' : '🗓️ Cuti'}
                      </p>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                      + Libur
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode 2: Aggregate Table List */}
      {viewMode === 'LIST' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-72">
              <Input
                placeholder="Cari hari libur atau tanggal (YYYY-MM-DD)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500">Kategori:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-xs font-bold p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              >
                <option value="ALL">Semua Kategori ({holidays.length})</option>
                <option value="NATIONAL_HOLIDAY">🔴 Libur Nasional</option>
                <option value="SCHOOL_HOLIDAY">🏫 Libur Sekolah</option>
                <option value="CUTI_BERSAMA">🗓️ Cuti Bersama</option>
                <option value="OTHER">📢 Agenda Khusus</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl text-xs font-semibold text-slate-400">
              ⏳ Memuat data kalender...
            </div>
          ) : filteredHolidays.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white font-extrabold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Tanggal (YYYY-MM-DD)</th>
                    <th className="py-3 px-4">Nama Hari Libur / Agenda</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-medium">
                  {filteredHolidays.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {item.date}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        {item.name}
                      </td>
                      <td className="py-3 px-4">
                        {getTypeBadge(item.type)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {item.description || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold rounded-lg transition-colors"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => setDeletingHoliday(item)}
                            className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 font-bold rounded-lg transition-colors"
                          >
                            🗑️ Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-2xl space-y-2 border border-slate-200">
              <span className="text-3xl">🗓️</span>
              <p className="font-extrabold text-slate-800 text-sm">Tidak Ada Data Hari Libur</p>
              <p className="text-xs text-slate-500">Tidak ada jadwal libur yang sesuai pencarian/kategori.</p>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Holiday Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingHoliday ? '✏️ Edit Hari Libur / Agenda' : '➕ Tambah Hari Libur Baru'}
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <Input
            label="Tanggal Libur (YYYY-MM-DD)"
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
          />

          <Input
            label="Nama Hari Libur / Agenda Akademik"
            type="text"
            required
            placeholder="Contoh: Hari Raya Idul Fitri / Libur Kenaikan Kelas"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          />

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">Kategori Hari Libur</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as HolidayType }))}
              className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            >
              <option value="NATIONAL_HOLIDAY">🔴 Libur Nasional / Tanggal Merah</option>
              <option value="SCHOOL_HOLIDAY">🏫 Libur Sekolah / Semester</option>
              <option value="CUTI_BERSAMA">🗓️ Cuti Bersama Pemerintah</option>
              <option value="OTHER">📢 Agenda / Kegiatan Sekolah</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">Keterangan Tambahan (Opsional)</label>
            <textarea
              rows={3}
              className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              placeholder="Catatan tambahan seperti edaran Kepala Sekolah atau SKB 3 Menteri..."
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="pt-2 flex items-center gap-2">
            <Button type="button" variant="secondary" className="w-1/2" onClick={() => setIsFormModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" className="w-1/2 bg-purple-600 hover:bg-purple-700" isLoading={isSubmitting}>
              {editingHoliday ? 'Simpan Perubahan' : 'Tambah Ke Kalender'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingHoliday}
        onClose={() => setDeletingHoliday(null)}
        title="⚠️ Konfirmasi Hapus Hari Libur"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Apakah Anda yakin ingin menghapus <strong className="text-slate-900">{deletingHoliday?.name}</strong> ({deletingHoliday?.date}) dari Kalender Akademik?
          </p>

          <div className="p-3 bg-red-50 rounded-2xl border border-red-100 text-[11px] text-red-800 font-semibold">
            Tindakan ini akan membatalkan status libur global untuk tanggal tersebut pada sistem absensi.
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button variant="secondary" className="w-1/2" onClick={() => setDeletingHoliday(null)}>
              Batal
            </Button>
            <Button variant="danger" className="w-1/2" isLoading={isDeleting} onClick={handleDeleteConfirm}>
              Ya, Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
