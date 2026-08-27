import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { StudentItem } from '../../../types/database.types';
import { StudentRepository, STUDENTS_UPDATED_EVENT } from '../../../repositories/StudentRepository';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { useToastStore } from '../../../store/useToastStore';
import { Users, Plus, Search, Phone, Edit2, Trash2, School } from 'lucide-react';

const DEFAULT_CLASS_PRESETS = [
  'Kelas VII-A',
  'Kelas VII-B',
  'Kelas VIII-A',
  'Kelas VIII-B',
  'Kelas IX-A',
  'Kelas IX-B',
  'Kelas X-1',
  'Kelas X-2',
  'Kelas XI-IPA',
  'Kelas XI-IPS',
  'Kelas XII-IPA',
  'Kelas XII-IPS',
];

export const StudentManagement: React.FC = () => {
  const { showToast } = useToastStore();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<StudentItem | null>(null);

  // Form State
  const [formNisn, setFormNisn] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formClass, setFormClass] = useState('Kelas VII-A');
  const [formCustomClass, setFormCustomClass] = useState('');
  const [formGender, setFormGender] = useState<'L' | 'P'>('L');
  const [formParentName, setFormParentName] = useState('');
  const [formParentPhone, setFormParentPhone] = useState('');
  const [formAttendanceRate, setFormAttendanceRate] = useState('100');
  const [formNotes, setFormNotes] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await StudentRepository.getStudents();
      setStudents(data || []);
    } catch (err) {
      console.warn('Gagal memuat data siswa:', err);
      showToast('error', 'Gagal Memuat', 'Gagal memuat data siswa dari server');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
    const handleUpdated = () => loadData();
    window.addEventListener(STUDENTS_UPDATED_EVENT, handleUpdated);
    window.addEventListener('storage', handleUpdated);
    return () => {
      window.removeEventListener(STUDENTS_UPDATED_EVENT, handleUpdated);
      window.removeEventListener('storage', handleUpdated);
    };
  }, [loadData]);

  // Derived Class Options
  const availableClasses = useMemo(() => {
    const fromStudents = students.map((s) => s.className).filter(Boolean);
    const combined = Array.from(new Set([...DEFAULT_CLASS_PRESETS, ...fromStudents])).sort();
    return combined;
  }, [students]);

  const filterClassOptions = useMemo(() => {
    const usedClasses = Array.from(new Set(students.map((s) => s.className).filter(Boolean))).sort();
    return ['ALL', ...usedClasses];
  }, [students]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchClass = selectedClass === 'ALL' || s.className === selectedClass;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        s.nisn.toLowerCase().includes(q) ||
        s.parentName.toLowerCase().includes(q);
      return matchClass && matchQuery;
    });
  }, [students, selectedClass, searchQuery]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = students.length;
    const male = students.filter((s) => s.gender === 'L').length;
    const female = students.filter((s) => s.gender === 'P').length;
    const classCount = new Set(students.map((s) => s.className).filter(Boolean)).size;
    return { total, male, female, classCount };
  }, [students]);

  const openAddModal = () => {
    setEditingStudent(null);
    setFormNisn('');
    setFormFullName('');
    setFormClass(availableClasses[0] || 'Kelas VII-A');
    setFormCustomClass('');
    setFormGender('L');
    setFormParentName('');
    setFormParentPhone('');
    setFormAttendanceRate('100');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (std: StudentItem) => {
    setEditingStudent(std);
    setFormNisn(std.nisn || '');
    setFormFullName(std.fullName);
    if (availableClasses.includes(std.className)) {
      setFormClass(std.className);
      setFormCustomClass('');
    } else {
      setFormClass('CUSTOM');
      setFormCustomClass(std.className);
    }
    setFormGender(std.gender || 'L');
    setFormParentName(std.parentName || '');
    setFormParentPhone(std.parentPhone || '');
    setFormAttendanceRate(String(std.attendanceRate ?? 100));
    setFormNotes(std.notes || std.address || '');
    setIsModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveClass = formClass === 'CUSTOM' ? formCustomClass.trim() : formClass.trim();

    if (!formFullName.trim()) {
      showToast('warning', 'Validasi Form', 'Nama lengkap siswa wajib diisi');
      return;
    }
    if (!effectiveClass) {
      showToast('warning', 'Validasi Form', 'Kelas rombel siswa wajib dipilih atau diisi');
      return;
    }
    if (!formParentName.trim()) {
      showToast('warning', 'Validasi Form', 'Nama orang tua / wali murid wajib diisi');
      return;
    }
    if (!formParentPhone.trim()) {
      showToast('warning', 'Validasi Form', 'Nomor WhatsApp / HP wali murid wajib diisi');
      return;
    }

    setIsSaving(true);
    try {
      const parsedRate = Number(formAttendanceRate);
      const attendanceRate = !isNaN(parsedRate) && parsedRate >= 0 && parsedRate <= 100 ? parsedRate : 100;

      if (editingStudent) {
        // Update existing student
        await StudentRepository.updateStudent(editingStudent.id, {
          nisn: formNisn.trim(),
          fullName: formFullName.trim(),
          className: effectiveClass,
          gender: formGender,
          parentName: formParentName.trim(),
          parentPhone: formParentPhone.trim(),
          attendanceRate,
          notes: formNotes.trim(),
        });
        showToast('success', 'Berhasil Diperbarui', `Data siswa "${formFullName.trim()}" berhasil diperbarui`);
      } else {
        // Create new student
        await StudentRepository.createStudent({
          nisn: formNisn.trim(),
          fullName: formFullName.trim(),
          className: effectiveClass,
          gender: formGender,
          parentName: formParentName.trim(),
          parentPhone: formParentPhone.trim(),
          attendanceRate,
          notes: formNotes.trim(),
        });
        showToast('success', 'Berhasil Ditambahkan', `Siswa "${formFullName.trim()}" berhasil ditambahkan ke direktori`);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Save student error:', err);
      showToast('error', 'Gagal Menyimpan', 'Gagal menyimpan data siswa ke database');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await StudentRepository.deleteStudent(deleteTarget.id);
      showToast('success', 'Berhasil Dihapus', `Data siswa "${deleteTarget.fullName}" berhasil dihapus`);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      console.error('Delete student error:', err);
      showToast('error', 'Gagal Menghapus', 'Gagal menghapus data siswa dari database');
    } finally {
      setIsSaving(false);
    }
  };

  const formatWaUrl = (phone: string, parentName: string, studentName: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const msg = `Assalamu'alaikum Warahmatullahi Wabarakatuh Bapak/Ibu ${parentName}, saya pihak manajemen sekolah terkait ananda ${studentName}.`;
    return `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 text-emerald-700 border border-emerald-600/20 flex items-center justify-center text-2xl shrink-0">
            🎓
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-[#023246]">
                Direktori Siswa & Kontak Wali Murid
              </h2>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[11px] font-extrabold rounded-full border border-emerald-200">
                Master Data
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola direktori siswa, kelas/rombel, dan nomor WhatsApp orang tua/wali murid untuk diakses guru.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="primary" onClick={openAddModal} className="flex items-center gap-2 shadow-xs">
            <Plus className="w-4 h-4" />
            <span>Tambah Siswa Baru</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Total Siswa</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#023246]">{stats.total}</p>
          <span className="text-[10px] text-slate-400 font-semibold">Terdaftar di sistem</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Laki-laki (L)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-blue-700">{stats.male}</p>
          <span className="text-[10px] text-slate-400 font-semibold">Siswa putra</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Perempuan (P)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-pink-700">{stats.female}</p>
          <span className="text-[10px] text-slate-400 font-semibold">Siswa putri</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Rombel / Kelas</span>
            <School className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-purple-700">{stats.classCount}</p>
          <span className="text-[10px] text-slate-400 font-semibold">Kelas aktif</span>
        </div>
      </div>

      {/* Main Table / Directory Card */}
      <div className="bg-white rounded-3xl border border-[#D4D4CE]/40 shadow-card overflow-hidden">
        {/* Controls: Search & Class Filter */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/70 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama siswa, NISN, atau wali..."
              className="pl-9 pr-8 text-xs font-semibold py-2"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Class Filter Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            {filterClassOptions.map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedClass(cls)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                  selectedClass === cls
                    ? 'bg-[#0D7A5F] text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cls === 'ALL' ? `Semua Kelas (${students.length})` : cls}
              </button>
            ))}
          </div>
        </div>

        {/* Content Table / List */}
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-[#0D7A5F] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-500">Memuat direktori siswa...</p>
          </div>
        ) : students.length === 0 ? (
          /* Zero State: No Students in Database */
          <div className="p-10 sm:p-14 text-center space-y-4 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center text-3xl mx-auto shadow-inner">
              👥
            </div>
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-[#023246] text-base sm:text-lg">
                Direktori Siswa Masih Kosong
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Belum ada master data siswa dan kontak wali murid. Sebagai Admin Website, Anda dapat menambahkan data siswa sekarang agar dewan guru dapat melihat daftar siswa dan menghubungi orang tua/wali via WhatsApp.
              </p>
            </div>
            <Button variant="primary" onClick={openAddModal} className="inline-flex items-center gap-2 shadow-xs">
              <Plus className="w-4 h-4" />
              <span>Tambah Siswa Pertama</span>
            </Button>
          </div>
        ) : filteredStudents.length === 0 ? (
          /* Filter / Search Zero State */
          <div className="p-12 text-center space-y-2">
            <Search className="w-8 h-8 text-slate-300 mx-auto" />
            <h4 className="text-sm font-extrabold text-slate-700">Siswa Tidak Ditemukan</h4>
            <p className="text-xs text-slate-400">Tidak ada siswa yang cocok dengan kata kunci "{searchQuery}".</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-extrabold tracking-wider uppercase">
                  <th className="py-3 px-4">Siswa</th>
                  <th className="py-3 px-4">Kelas / Rombel</th>
                  <th className="py-3 px-4">Orang Tua / Wali</th>
                  <th className="py-3 px-4">Kontak WA</th>
                  <th className="py-3 px-4 text-center">Kehadiran</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((std) => (
                  <tr key={std.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Siswa */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0 shadow-2xs ${
                            std.gender === 'L' ? 'bg-blue-500' : 'bg-pink-500'
                          }`}
                        >
                          {std.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-[#023246] text-xs truncate">
                            {std.fullName}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono">
                            NISN: {std.nisn || '-'} • {std.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Kelas */}
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200/80 whitespace-nowrap">
                        {std.className}
                      </span>
                    </td>

                    {/* Wali Murid */}
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-bold text-slate-800 text-xs">{std.parentName}</p>
                        {std.notes && (
                          <p className="text-[10px] text-slate-400 truncate max-w-xs">{std.notes}</p>
                        )}
                      </div>
                    </td>

                    {/* Kontak WA */}
                    <td className="py-3.5 px-4">
                      {std.parentPhone ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-600 text-[11px]">
                            {std.parentPhone}
                          </span>
                          <a
                            href={formatWaUrl(std.parentPhone, std.parentName, std.fullName)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition-colors"
                            title="Buka Chat WhatsApp"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Tidak ada nomor</span>
                      )}
                    </td>

                    {/* Kehadiran */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-black rounded-lg border border-emerald-200">
                        {std.attendanceRate ?? 100}%
                      </span>
                    </td>

                    {/* Aksi */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(std)}
                          className="p-1.5 text-slate-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg border border-slate-200 hover:border-cyan-200 transition-colors cursor-pointer"
                          title="Edit Data Siswa"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(std)}
                          className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-slate-200 hover:border-red-200 transition-colors cursor-pointer"
                          title="Hapus Siswa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStudent ? 'Edit Data Siswa & Kontak Wali' : 'Tambah Siswa Baru ke Direktori'}
      >
        <form onSubmit={handleSaveStudent} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* NISN */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                NISN (Nomor Induk Siswa Nasional)
              </label>
              <Input
                type="text"
                value={formNisn}
                onChange={(e) => setFormNisn(e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="Contoh: 0081234567"
                className="text-xs"
              />
            </div>

            {/* Jenis Kelamin */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jenis Kelamin
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormGender('L')}
                  className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                    formGender === 'L'
                      ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  👦 Laki-laki
                </button>
                <button
                  type="button"
                  onClick={() => setFormGender('P')}
                  className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                    formGender === 'P'
                      ? 'bg-pink-50 border-pink-400 text-pink-800 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  👧 Perempuan
                </button>
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Lengkap Siswa <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formFullName}
              onChange={(e) => setFormFullName(e.target.value)}
              placeholder="Contoh: Muhammad Rizky Pratama"
              required
              className="text-xs font-semibold"
            />
          </div>

          {/* Class / Rombel */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Kelas / Rombel Siswa <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={formClass}
                onChange={(e) => setFormClass(e.target.value)}
                className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0D7A5F]"
              >
                {availableClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="CUSTOM">+ Tulis Kelas Baru / Lainnya</option>
              </select>

              {formClass === 'CUSTOM' && (
                <Input
                  type="text"
                  value={formCustomClass}
                  onChange={(e) => setFormCustomClass(e.target.value)}
                  placeholder="Ketik nama kelas baru..."
                  required
                  className="text-xs"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
            {/* Guardian Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Orang Tua / Wali Murid <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={formParentName}
                onChange={(e) => setFormParentName(e.target.value)}
                placeholder="Contoh: H. Bambang Irawan"
                required
                className="text-xs font-semibold"
              />
            </div>

            {/* Guardian Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                No. WhatsApp / HP Wali Murid <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={formParentPhone}
                onChange={(e) => setFormParentPhone(e.target.value.replace(/[^\d+]/g, ''))}
                placeholder="Contoh: 081234567890"
                required
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Attendance Rate */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tingkat Kehadiran (%)
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formAttendanceRate}
                onChange={(e) => setFormAttendanceRate(e.target.value)}
                placeholder="100"
                className="text-xs font-mono"
              />
            </div>

            {/* Notes / Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Khusus / Alamat (Opsional)
              </label>
              <Input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Contoh: Domisili dekat sekolah / alergi"
                className="text-xs"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? 'Menyimpan...' : editingStudent ? 'Simpan Perubahan' : 'Tambah ke Direktori'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Konfirmasi Hapus Siswa"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Apakah Anda yakin ingin menghapus data siswa{' '}
            <strong className="text-slate-900 font-bold">{deleteTarget?.fullName}</strong> ({deleteTarget?.className}) dari direktori sekolah?
          </p>
          <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
            ⚠️ Tindakan ini akan menghapus kontak wali murid dari direktori guru.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isSaving}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteStudent}
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isSaving ? 'Menghapus...' : 'Ya, Hapus Data'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
