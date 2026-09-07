import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { StudentItem } from '../../../types/database.types';
import { StudentRepository, STUDENTS_UPDATED_EVENT } from '../../../repositories/StudentRepository';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { useToastStore } from '../../../store/useToastStore';
import { StudentRfidKioskModal } from '../../attendance/components/StudentRfidKioskModal';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  School,
  CreditCard,
  RefreshCw,
  ScanLine,
  Radio,
} from 'lucide-react';

const DEFAULT_CLASS_PRESETS = [
  '7',
  '8A',
  '8B',
  '9A',
  '9B',
  'SMA',
];

export const StudentManagement: React.FC = () => {
  const { showToast } = useToastStore();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [rfidFilter, setRfidFilter] = useState<'ALL' | 'WITH_RFID' | 'NO_RFID'>('ALL');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);

  // Quick RFID Binding Modal State
  const [bindingStudent, setBindingStudent] = useState<StudentItem | null>(null);
  const [bindingUid, setBindingUid] = useState('');
  const [isBinding, setIsBinding] = useState(false);
  const bindInputRef = useRef<HTMLInputElement>(null);

  // Terminal Kiosk Modal State
  const [isKioskOpen, setIsKioskOpen] = useState(false);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<StudentItem | null>(null);

  // Form State
  const [formNisn, setFormNisn] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formClass, setFormClass] = useState('7');
  const [formCustomClass, setFormCustomClass] = useState('');
  const [formGender, setFormGender] = useState<'L' | 'P'>('L');
  const [formRfidUid, setFormRfidUid] = useState('');
  const [formAttendanceRate, setFormAttendanceRate] = useState('100');
  const [formNotes, setFormNotes] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await StudentRepository.getStudents();
      setStudents(data || []);
    } catch (err) {
      console.warn('Gagal memuat data siswa:', err);
      showToast('error', 'Gagal Memuat', 'Gagal memuat data siswa dari database');
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
        (s.nisn && s.nisn.toLowerCase().includes(q)) ||
        (s.rfidUid && s.rfidUid.toLowerCase().includes(q)) ||
        s.className.toLowerCase().includes(q);

      const matchRfid =
        rfidFilter === 'ALL' ||
        (rfidFilter === 'WITH_RFID' && Boolean(s.rfidUid)) ||
        (rfidFilter === 'NO_RFID' && !s.rfidUid);

      return matchClass && matchQuery && matchRfid;
    });
  }, [students, selectedClass, searchQuery, rfidFilter]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = students.length;
    const male = students.filter((s) => s.gender === 'L').length;
    const female = students.filter((s) => s.gender === 'P').length;
    const rfidActive = students.filter((s) => Boolean(s.rfidUid)).length;
    const classCount = new Set(students.map((s) => s.className).filter(Boolean)).size;
    return { total, male, female, rfidActive, classCount };
  }, [students]);

  // Sync from GradeMaster
  const handleSyncFromGradeMaster = async () => {
    setIsSyncing(true);
    try {
      const res = await StudentRepository.syncFromGradeMaster('2026/2027');
      showToast(
        'success',
        'Sinkronisasi Sukses',
        `Berhasil menyinkronkan ${res.syncedCount} siswa aktif (${res.classesCount} kelas) dari GradeMaster!`
      );
      loadData();
    } catch (err: any) {
      console.error('Sync error:', err);
      showToast('error', 'Sinkronisasi Gagal', err?.message || 'Gagal menyinkronkan data dari web nilai');
    } finally {
      setIsSyncing(false);
    }
  };

  const openAddModal = () => {
    setEditingStudent(null);
    setFormNisn('');
    setFormFullName('');
    setFormClass(availableClasses[0] || '7');
    setFormCustomClass('');
    setFormGender('L');
    setFormRfidUid('');
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
    setFormRfidUid(std.rfidUid || '');
    setFormAttendanceRate(String(std.attendanceRate ?? 100));
    setFormNotes(std.notes || std.address || '');
    setIsModalOpen(true);
  };

  // Open Quick RFID Binding Modal
  const openBindingModal = (std: StudentItem) => {
    setBindingStudent(std);
    setBindingUid(std.rfidUid || '');
    setTimeout(() => {
      if (bindInputRef.current) bindInputRef.current.focus();
    }, 150);
  };

  const handleSaveRfidBinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bindingStudent || !bindingUid.trim()) return;

    setIsBinding(true);
    try {
      const res = await StudentRepository.bindRfidCard(bindingStudent.id, bindingUid.trim());
      if (res.success) {
        showToast('success', 'RFID Terpasang', `Kartu ${bindingUid.trim().toUpperCase()} berhasil ditautkan ke ${bindingStudent.fullName}`);
        setBindingStudent(null);
        setBindingUid('');
        loadData();
      } else {
        showToast('error', 'Konflik Kartu RFID', res.message);
      }
    } catch (err: any) {
      showToast('error', 'Gagal Menautkan', err?.message || 'Gagal menyimpan kartu ke database');
    } finally {
      setIsBinding(false);
    }
  };

  const handleUnbindRfid = async (studentId: string, studentName: string) => {
    try {
      await StudentRepository.unbindRfidCard(studentId);
      showToast('info', 'RFID Dilepas', `Kartu RFID untuk ${studentName} telah dinonaktifkan`);
      loadData();
    } catch {
      showToast('error', 'Gagal', 'Gagal melepas kartu RFID');
    }
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

    setIsSaving(true);
    try {
      const parsedRate = Number(formAttendanceRate);
      const attendanceRate = !isNaN(parsedRate) && parsedRate >= 0 && parsedRate <= 100 ? parsedRate : 100;
      const cleanRfid = formRfidUid.trim().toUpperCase() || undefined;

      if (editingStudent) {
        // Update existing student
        await StudentRepository.updateStudent(editingStudent.id, {
          nisn: formNisn.trim(),
          fullName: formFullName.trim(),
          className: effectiveClass,
          gender: formGender,
          rfidUid: cleanRfid,
          cardStatus: cleanRfid ? 'ACTIVE' : 'INACTIVE',
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
          academicYear: '2026/2027',
          gender: formGender,
          rfidUid: cleanRfid,
          cardStatus: cleanRfid ? 'ACTIVE' : 'INACTIVE',
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
                Direktori Siswa & Kartu RFID
              </h2>
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 text-[11px] font-extrabold rounded-full border border-emerald-200">
                T.A. 2026/2027 Aktif
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Master data siswa aktif, binding nomor kartu RFID, dan sinkronisasi real-time ke tabel presensi GradeMaster.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncFromGradeMaster}
            disabled={isSyncing}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Tarik data siswa terbaru dari GradeMaster Web Nilai"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkron dari Web Nilai'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsKioskOpen(true)}
            className="px-4 py-2 bg-[#023246] hover:bg-[#023246]/90 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <ScanLine className="w-4 h-4 text-emerald-400" />
            <span>Terminal Absensi RFID</span>
          </button>

          <Button
            variant="primary"
            onClick={openAddModal}
            className="flex items-center gap-1.5 text-xs py-2 px-3.5 rounded-xl cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Siswa</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Total Siswa Aktif</span>
            <Users className="w-4 h-4 text-cyan-600" />
          </div>
          <p className="text-xl font-black text-[#023246] mt-1">{stats.total}</p>
          <span className="text-[10px] text-slate-400 font-semibold">{stats.classCount} Rombel Terdaftar</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Kartu RFID Terpasang</span>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-700 mt-1">{stats.rfidActive}</p>
          <span className="text-[10px] text-emerald-600 font-bold">
            {stats.total > 0 ? Math.round((stats.rfidActive / stats.total) * 100) : 0}% ter-cover RFID
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Siswa Putra (L)</span>
            <span className="text-xs">👦</span>
          </div>
          <p className="text-xl font-black text-blue-700 mt-1">{stats.male}</p>
          <span className="text-[10px] text-slate-400 font-semibold">Laki-laki</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Siswa Putri (P)</span>
            <span className="text-xs">👧</span>
          </div>
          <p className="text-xl font-black text-pink-700 mt-1">{stats.female}</p>
          <span className="text-[10px] text-slate-400 font-semibold">Perempuan</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-[#D4D4CE]/40 shadow-card overflow-hidden">
        {/* Filter Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, kelas, atau UID RFID..."
              className="pl-9 pr-4 py-2 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters Group */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* RFID Status Filter */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setRfidFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  rfidFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua RFID
              </button>
              <button
                type="button"
                onClick={() => setRfidFilter('WITH_RFID')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  rfidFilter === 'WITH_RFID' ? 'bg-emerald-600 text-white shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Punya RFID ({stats.rfidActive})
              </button>
              <button
                type="button"
                onClick={() => setRfidFilter('NO_RFID')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  rfidFilter === 'NO_RFID' ? 'bg-amber-600 text-white shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Belum ({stats.total - stats.rfidActive})
              </button>
            </div>

            {/* Class Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <School className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                {filterClassOptions.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls === 'ALL' ? 'Semua Kelas' : `Kelas ${cls}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Memuat direktori siswa...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-xl text-slate-400 mb-2">
              🎓
            </div>
            {students.length === 0 ? (
              <>
                <h4 className="text-sm font-extrabold text-slate-700">Direktori Siswa Masih Kosong</h4>
                <p className="text-xs text-slate-400 max-w-sm">
                  Klik tombol di bawah untuk langsung menyinkronkan 149 siswa aktif tahun ajaran 2026/2027 dari Web Nilai.
                </p>
                <button
                  type="button"
                  onClick={handleSyncFromGradeMaster}
                  className="mt-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-emerald-700 transition-all cursor-pointer"
                >
                  Tarik Data Siswa dari GradeMaster
                </button>
              </>
            ) : (
              <>
                <h4 className="text-sm font-extrabold text-slate-700">Siswa Tidak Ditemukan</h4>
                <p className="text-xs text-slate-400">Tidak ada siswa yang cocok dengan filter pencarian Anda.</p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-extrabold tracking-wider uppercase">
                  <th className="py-3 px-4">Siswa</th>
                  <th className="py-3 px-4">Kelas / Rombel</th>
                  <th className="py-3 px-4">Status Kartu RFID</th>
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
                            std.gender === 'L' ? 'bg-blue-600' : 'bg-pink-600'
                          }`}
                        >
                          {std.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-[#023246] text-xs truncate">
                            {std.fullName}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {std.nisn ? `NISN: ${std.nisn} • ` : ''}{std.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Kelas */}
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200/80 whitespace-nowrap">
                        Kelas {std.className}
                      </span>
                    </td>

                    {/* Kartu RFID */}
                    <td className="py-3.5 px-4">
                      {std.rfidUid ? (
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300/80 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-2xs">
                            <CreditCard className="w-3 h-3 text-emerald-600 shrink-0" />
                            UID: {std.rfidUid}
                          </span>
                          <button
                            type="button"
                            onClick={() => openBindingModal(std)}
                            className="p-1 text-slate-400 hover:text-emerald-700 rounded hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="Ganti Kartu RFID"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openBindingModal(std)}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300/70 rounded-lg text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Klik untuk menautkan kartu RFID baru"
                        >
                          <Radio className="w-3 h-3 text-amber-600 animate-pulse" />
                          <span>+ Pasang RFID</span>
                        </button>
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

      {/* Modal Quick Bind RFID */}
      {bindingStudent && (
        <Modal
          isOpen={Boolean(bindingStudent)}
          onClose={() => {
            setBindingStudent(null);
            setBindingUid('');
          }}
          title="Tautkan Kartu RFID ke Siswa"
          maxWidth="md"
        >
          <form onSubmit={handleSaveRfidBinding} className="space-y-4">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm">
                {bindingStudent.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">{bindingStudent.fullName}</h4>
                <p className="text-[11px] text-slate-500 font-semibold">Kelas {bindingStudent.className}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                UID Kartu RFID / Scan Sensor USB <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  ref={bindInputRef}
                  type="text"
                  value={bindingUid}
                  onChange={(e) => setBindingUid(e.target.value.toUpperCase())}
                  placeholder="Tempel kartu pada reader atau ketik UID..."
                  required
                  className="font-mono text-xs font-bold pr-9"
                />
                <CreditCard className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Reader USB keyboard wedge akan otomatis mengisi UID dan menekan Enter.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              {bindingStudent.rfidUid ? (
                <button
                  type="button"
                  onClick={() => {
                    handleUnbindRfid(bindingStudent.id, bindingStudent.fullName);
                    setBindingStudent(null);
                  }}
                  className="text-xs text-red-600 font-bold hover:underline cursor-pointer"
                >
                  Lepas Kartu Ini
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBindingStudent(null)}
                  className="text-xs py-2 px-3 rounded-xl"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!bindingUid.trim() || isBinding}
                  className="text-xs py-2 px-4 rounded-xl"
                >
                  {isBinding ? 'Menyimpan...' : 'Simpan Kartu'}
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Add / Edit Student */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStudent ? 'Edit Data Siswa & Kartu RFID' : 'Tambah Siswa Baru ke Direktori'}
        maxWidth="lg"
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
                className="text-xs font-mono"
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
                className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
              >
                {availableClasses.map((c) => (
                  <option key={c} value={c}>
                    Kelas {c}
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

          {/* UID Kartu RFID */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              UID Kartu RFID (Opsional)
            </label>
            <Input
              type="text"
              value={formRfidUid}
              onChange={(e) => setFormRfidUid(e.target.value.toUpperCase())}
              placeholder="Tempel kartu RFID pada reader atau isi manual UID..."
              className="text-xs font-mono font-bold"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Dapat diisi nanti atau langsung di-tap melalui reader USB.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Attendance Rate */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tingkat Kehadiran Awal (%)
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

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Siswa (Opsional)
              </label>
              <Input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Contoh: Siswa berprestasi / OSIS"
                className="text-xs"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="text-xs py-2 px-4 rounded-xl cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving}
              className="text-xs py-2 px-5 rounded-xl cursor-pointer"
            >
              {isSaving ? 'Menyimpan...' : editingStudent ? 'Simpan Perubahan' : 'Tambah Siswa'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Delete Confirmation */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Konfirmasi Hapus Siswa"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Apakah Anda yakin ingin menghapus data siswa{' '}
            <strong className="text-slate-900">{deleteTarget?.fullName}</strong> ({deleteTarget?.className})?
            Data yang dihapus tidak dapat dikembalikan.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="text-xs py-2 px-3 rounded-xl cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleDeleteStudent}
              disabled={isSaving}
              className="text-xs py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl cursor-pointer"
            >
              {isSaving ? 'Menghapus...' : 'Ya, Hapus Siswa'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Terminal Kiosk Modal */}
      <StudentRfidKioskModal
        isOpen={isKioskOpen}
        onClose={() => setIsKioskOpen(false)}
        onAttendanceRecorded={loadData}
      />
    </div>
  );
};
