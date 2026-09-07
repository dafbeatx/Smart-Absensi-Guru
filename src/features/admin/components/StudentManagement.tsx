import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { StudentItem } from '../../../types/database.types';
import { StudentRepository, STUDENTS_UPDATED_EVENT } from '../../../repositories/StudentRepository';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { useToastStore } from '../../../store/useToastStore';
import { SoundService } from '../../../services/audio.service';
import { StudentRfidKioskModal } from '../../attendance/components/StudentRfidKioskModal';
import {
  GraduationCap,
  Users,
  CreditCard,
  UserCheck,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  ScanLine,
  Radio,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
} from 'lucide-react';

const DEFAULT_CLASS_PRESETS = [
  '7',
  '8A',
  '8B',
  '9A',
  '9B',
  'SMA',
];

const ITEMS_PER_PAGE = 25;

export const StudentManagement: React.FC = () => {
  const { showToast } = useToastStore();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Search, Filter & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [rfidFilter, setRfidFilter] = useState<'ALL' | 'WITH_RFID' | 'NO_RFID'>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);

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

  // Count per class
  const classCounts = useMemo(() => {
    const map: Record<string, number> = {};
    students.forEach((s) => {
      if (s.className) {
        map[s.className] = (map[s.className] || 0) + 1;
      }
    });
    return map;
  }, [students]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedClass, rfidFilter]);

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

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / ITEMS_PER_PAGE));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudents.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredStudents, currentPage]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = students.length;
    const male = students.filter((s) => s.gender === 'L').length;
    const female = students.filter((s) => s.gender === 'P').length;
    const rfidActive = students.filter((s) => Boolean(s.rfidUid)).length;
    const classCount = new Set(students.map((s) => s.className).filter(Boolean)).size;
    const coveragePct = total > 0 ? Math.round((rfidActive / total) * 100) : 0;
    const malePct = total > 0 ? Math.round((male / total) * 100) : 0;
    const femalePct = total > 0 ? Math.round((female / total) * 100) : 0;
    return { total, male, female, rfidActive, classCount, coveragePct, malePct, femalePct };
  }, [students]);

  // Sync from GradeMaster
  const handleSyncFromGradeMaster = async () => {
    setIsSyncing(true);
    try {
      const res = await StudentRepository.syncFromGradeMaster('2026/2027');
      SoundService.playSuccess();
      showToast(
        'success',
        'Sinkronisasi Sukses',
        `Berhasil menyinkronkan ${res.syncedCount} siswa aktif (${res.classesCount} rombel) dari GradeMaster!`
      );
      loadData();
    } catch (err: any) {
      console.error('Sync error:', err);
      SoundService.playError();
      showToast('error', 'Sinkronisasi Gagal', err?.message || 'Gagal menyinkronkan data dari web nilai');
    } finally {
      setIsSyncing(false);
    }
  };

  const openAddModal = () => {
    setEditingStudent(null);
    setFormNisn('');
    setFormFullName('');
    const defaultCls = (selectedClass !== 'ALL' ? selectedClass : availableClasses[0]) || '7';
    setFormClass(defaultCls);
    setFormCustomClass('');
    setFormGender(defaultCls === '8A' || defaultCls === '9A' ? 'P' : 'L');
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
        SoundService.playSuccess();
        showToast('success', 'RFID Terpasang', `Kartu ${bindingUid.trim().toUpperCase()} berhasil ditautkan ke ${bindingStudent.fullName}`);
        setBindingStudent(null);
        setBindingUid('');
        loadData();
      } else {
        SoundService.playError();
        showToast('error', 'Konflik Kartu RFID', res.message);
      }
    } catch (err: any) {
      SoundService.playError();
      showToast('error', 'Gagal Menautkan', err?.message || 'Gagal menyimpan kartu ke database');
    } finally {
      setIsBinding(false);
    }
  };

  const handleUnbindRfid = async (studentId: string, studentName: string) => {
    try {
      await StudentRepository.unbindRfidCard(studentId);
      SoundService.playSuccess();
      showToast('info', 'RFID Dilepas', `Kartu RFID untuk ${studentName} telah dinonaktifkan`);
      loadData();
    } catch {
      SoundService.playError();
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
        const ok = await StudentRepository.updateStudent(editingStudent.id, {
          nisn: formNisn.trim() || undefined,
          fullName: formFullName.trim(),
          className: effectiveClass,
          gender: formGender,
          rfidUid: cleanRfid,
          cardStatus: cleanRfid ? 'ACTIVE' : 'INACTIVE',
          attendanceRate,
          notes: formNotes.trim() || undefined,
        });
        if (!ok) {
          throw new Error('Gagal memperbarui data siswa di server');
        }
        SoundService.playSuccess();
        showToast('success', 'Berhasil Diperbarui', `Data siswa "${formFullName.trim()}" berhasil diperbarui`);
      } else {
        await StudentRepository.createStudent({
          nisn: formNisn.trim(),
          fullName: formFullName.trim(),
          className: effectiveClass,
          academicYear: '2026/2027',
          gender: formGender,
          rfidUid: cleanRfid,
          cardStatus: cleanRfid ? 'ACTIVE' : 'INACTIVE',
          attendanceRate,
          notes: formNotes.trim() || undefined,
        });
        SoundService.playSuccess();
        showToast('success', 'Berhasil Ditambahkan', `Siswa "${formFullName.trim()}" berhasil ditambahkan ke direktori`);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Save student error:', err);
      SoundService.playError();
      showToast('error', 'Gagal Menyimpan', err?.message || 'Gagal menyimpan data siswa ke database');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      const ok = await StudentRepository.deleteStudent(deleteTarget.id);
      if (!ok) throw new Error('Gagal menghapus data siswa di server');
      SoundService.playSuccess();
      showToast('success', 'Berhasil Dihapus', `Data siswa "${deleteTarget.fullName}" berhasil dihapus`);
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      console.error('Delete student error:', err);
      SoundService.playError();
      showToast('error', 'Gagal Menghapus', err?.message || 'Gagal menghapus data siswa dari database');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-full">
      {/* 1. INSTITUTIONAL HEADER BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#023246]/5 text-[#023246] border border-[#023246]/15 flex items-center justify-center shrink-0">
            <GraduationCap className="w-6 h-6 text-[#023246]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[#023246] tracking-tight">
                Direktori Siswa & Kartu RFID
              </h2>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-md border border-slate-200">
                T.A. 2026/2027
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Master data 149 siswa aktif, penautan nomor kartu RFID, dan sinkronisasi presensi harian GradeMaster.
            </p>
          </div>
        </div>

        {/* Action Buttons Hierarchy */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sinkron Web Nilai */}
          <button
            type="button"
            onClick={handleSyncFromGradeMaster}
            disabled={isSyncing}
            className="h-10 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            title="Tarik data siswa terbaru dari GradeMaster Web Nilai"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkron Web Nilai'}</span>
          </button>

          {/* Kiosk Scanner */}
          <button
            type="button"
            onClick={() => setIsKioskOpen(true)}
            className="h-10 px-3.5 bg-[#023246] hover:bg-[#023246]/90 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shadow-2xs cursor-pointer active:scale-[0.98]"
          >
            <ScanLine className="w-4 h-4 text-emerald-400" />
            <span>Terminal Kiosk RFID</span>
          </button>

          {/* Tambah Siswa */}
          <Button
            variant="primary"
            onClick={openAddModal}
            className="h-10 px-3.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Siswa</span>
          </Button>
        </div>
      </div>

      {/* 2. PURPOSEFUL KPI STATS (ANTI AI-SLOP: DISTINCT, CONTEXTUAL METRICS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Metric 1: Total Siswa Aktif */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Siswa Terdaftar</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-[#023246] mt-1.5">{stats.total}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {stats.classCount} Rombel Aktif (T.A. 2026/2027)
          </p>
        </div>

        {/* Metric 2: Cakupan Kartu RFID */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Cakupan Kartu RFID</span>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <p className="text-2xl font-bold text-emerald-700">{stats.rfidActive}</p>
            <span className="text-xs font-semibold text-slate-500">/ {stats.total} siswa</span>
            <span className="ml-auto text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
              {stats.coveragePct}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.coveragePct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {stats.total - stats.rfidActive} siswa belum dipasangkan kartu
          </p>
        </div>

        {/* Metric 3: Distribusi Gender Siswa */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Distribusi Gender</span>
            <UserCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 bg-blue-50/70 border border-blue-200/60 rounded-lg p-2 text-center">
              <span className="text-[10px] font-semibold text-blue-700 block">Putra (L)</span>
              <span className="text-base font-bold text-blue-900">{stats.male}</span>
              <span className="text-[10px] text-blue-600 font-medium block">{stats.malePct}%</span>
            </div>
            <div className="flex-1 bg-rose-50/70 border border-rose-200/60 rounded-lg p-2 text-center">
              <span className="text-[10px] font-semibold text-rose-700 block">Putri (P)</span>
              <span className="text-base font-bold text-rose-900">{stats.female}</span>
              <span className="text-[10px] text-rose-600 font-medium block">{stats.femalePct}%</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 text-center">
            Kelas 8A & 9A dikhususkan 100% putri
          </p>
        </div>
      </div>

      {/* 3. HORIZONTAL CLASS FILTER STRIP (TACTILE & INTUITIVE NAVIGATION) */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedClass('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedClass === 'ALL'
                ? 'bg-[#023246] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <span>Semua Kelas</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                selectedClass === 'ALL' ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
              }`}
            >
              {stats.total}
            </span>
          </button>

          {availableClasses.map((cls) => {
            const count = classCounts[cls] || 0;
            const isSelected = selectedClass === cls;
            return (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedClass(cls)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-[#023246] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                <span>Kelas {cls}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. MAIN CARD: SEARCH, RFID FILTER & DIRECTORY LIST */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama siswa, NISN, kelas, atau UID RFID..."
              className="pl-9 pr-8 h-10 text-xs rounded-xl"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Segmented RFID Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/70 text-xs font-medium self-start md:self-auto">
            <button
              type="button"
              onClick={() => setRfidFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                rfidFilter === 'ALL'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua RFID
            </button>
            <button
              type="button"
              onClick={() => setRfidFilter('WITH_RFID')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                rfidFilter === 'WITH_RFID'
                  ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Terpasang ({stats.rfidActive})</span>
            </button>
            <button
              type="button"
              onClick={() => setRfidFilter('NO_RFID')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                rfidFilter === 'NO_RFID'
                  ? 'bg-amber-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Belum ({stats.total - stats.rfidActive})
            </button>
          </div>
        </div>

        {/* Directory Content */}
        {isLoading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-[#023246] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Memuat direktori siswa aktif...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-1">
              <GraduationCap className="w-6 h-6" />
            </div>
            {students.length === 0 ? (
              <>
                <h4 className="text-sm font-bold text-slate-800">Direktori Siswa Masih Kosong</h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Tarik 149 siswa aktif tahun ajaran 2026/2027 langsung dari web nilai GradeMaster.
                </p>
                <button
                  type="button"
                  onClick={handleSyncFromGradeMaster}
                  className="mt-3 px-4 py-2 bg-[#023246] text-white text-xs font-semibold rounded-xl hover:bg-[#023246]/90 transition-colors cursor-pointer"
                >
                  Sinkronkan Siswa dari GradeMaster
                </button>
              </>
            ) : (
              <>
                <h4 className="text-sm font-bold text-slate-800">Siswa Tidak Ditemukan</h4>
                <p className="text-xs text-slate-500">
                  Tidak ada data siswa yang cocok dengan kriteria pencarian dan filter kelas Anda.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedClass('ALL');
                    setRfidFilter('ALL');
                  }}
                  className="mt-2 text-xs text-[#023246] font-semibold underline cursor-pointer"
                >
                  Reset Semua Filter
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* A. DESKTOP VIEW: PRECISION TABLE (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/70 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Nama Siswa</th>
                    <th className="py-3 px-4">Rombel / Kelas</th>
                    <th className="py-3 px-4">Status Kartu RFID</th>
                    <th className="py-3 px-4 text-center">Kehadiran</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedStudents.map((std) => (
                    <tr key={std.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Siswa */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              std.gender === 'L'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                            }`}
                          >
                            {std.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[#023246] text-xs truncate">
                              {std.fullName}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              {std.nisn ? (
                                <span className="font-mono">NISN: {std.nisn}</span>
                              ) : (
                                <span>Tanpa NISN</span>
                              )}
                              <span>•</span>
                              <span
                                className={`font-semibold ${
                                  std.gender === 'L' ? 'text-blue-600' : 'text-rose-600'
                                }`}
                              >
                                {std.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Kelas */}
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200/70 whitespace-nowrap">
                          Kelas {std.className}
                        </span>
                      </td>

                      {/* Kartu RFID */}
                      <td className="py-3 px-4">
                        {std.rfidUid ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5">
                              <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              UID: {std.rfidUid}
                            </span>
                            <button
                              type="button"
                              onClick={() => openBindingModal(std)}
                              className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md border border-slate-200 hover:border-emerald-200 transition-colors cursor-pointer"
                              title="Ganti Kartu RFID Siswa"
                            >
                              Ganti
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openBindingModal(std)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Klik untuk menautkan kartu RFID"
                          >
                            <Radio className="w-3 h-3 text-amber-600 animate-pulse" />
                            <span>+ Pasang RFID</span>
                          </button>
                        )}
                      </td>

                      {/* Tingkat Kehadiran */}
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-md border border-slate-200">
                          {std.attendanceRate ?? 100}%
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(std)}
                            className="h-8 px-2.5 text-slate-600 hover:text-[#023246] hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1 text-xs font-medium"
                            title="Edit Data Siswa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(std)}
                            className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 hover:border-red-200 transition-colors cursor-pointer flex items-center justify-center"
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

            {/* B. MOBILE VIEW: ERGONOMIC CARDS (block md:hidden) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {paginatedStudents.map((std) => (
                <div key={std.id} className="p-4 space-y-3">
                  {/* Top: Avatar, Name, Class */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          std.gender === 'L'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                            : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                        }`}
                      >
                        {std.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-[#023246] text-xs truncate">
                          {std.fullName}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <span>{std.gender === 'L' ? 'Putra' : 'Putri'}</span>
                          {std.nisn && (
                            <>
                              <span>•</span>
                              <span className="font-mono">NISN: {std.nisn}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200/70 shrink-0">
                      Kelas {std.className}
                    </span>
                  </div>

                  {/* Middle: RFID Status & Binding Button */}
                  <div>
                    {std.rfidUid ? (
                      <div className="flex items-center justify-between bg-emerald-50/60 p-2 rounded-xl border border-emerald-200/60">
                        <div className="flex items-center gap-2 min-w-0">
                          <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="text-xs font-mono font-bold text-emerald-900 truncate">
                            UID: {std.rfidUid}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openBindingModal(std)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer shrink-0"
                        >
                          Ganti
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openBindingModal(std)}
                        className="w-full h-11 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-[0.98]"
                      >
                        <Radio className="w-4 h-4 text-amber-600 animate-pulse" />
                        <span>+ Pasang Kartu RFID</span>
                      </button>
                    )}
                  </div>

                  {/* Bottom: Attendance Rate & Action Controls */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-500 font-medium">
                      Kehadiran: <strong className="text-slate-800">{std.attendanceRate ?? 100}%</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(std)}
                        className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(std)}
                        className="h-9 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls Bar */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div>
                Menampilkan{' '}
                <strong className="text-slate-800">
                  {filteredStudents.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}
                </strong>
                –
                <strong className="text-slate-800">
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredStudents.length)}
                </strong>{' '}
                dari <strong className="text-slate-800">{filteredStudents.length}</strong> siswa
                {selectedClass !== 'ALL' && ` (Kelas ${selectedClass})`}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>

                  <span className="px-2 font-semibold text-slate-700">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 5. MODAL QUICK BIND RFID (HARDWARE-GRADE TACTILE MODAL) */}
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
            {/* Student Info preview */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                  bindingStudent.gender === 'L'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {bindingStudent.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">
                  {bindingStudent.fullName}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Kelas {bindingStudent.className}
                  {bindingStudent.nisn && ` • NISN: ${bindingStudent.nisn}`}
                </p>
              </div>
            </div>

            {/* Tap prompt visual */}
            <div className="bg-[#023246]/5 border border-[#023246]/15 rounded-xl p-3 text-center">
              <CreditCard className="w-5 h-5 text-[#023246] mx-auto mb-1 animate-bounce" />
              <p className="text-xs font-semibold text-[#023246]">
                Tempelkan Kartu RFID pada Scanner USB
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Reader akan otomatis mengisi kode UID dan menekan tombol simpan.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                UID Kartu RFID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  ref={bindInputRef}
                  type="text"
                  value={bindingUid}
                  onChange={(e) => setBindingUid(e.target.value.toUpperCase().trim())}
                  placeholder="Contoh: 0008123456"
                  required
                  className="font-mono text-xs font-bold pr-9 h-10"
                />
                <CreditCard className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              {bindingStudent.rfidUid ? (
                <button
                  type="button"
                  onClick={() => {
                    handleUnbindRfid(bindingStudent.id, bindingStudent.fullName);
                    setBindingStudent(null);
                  }}
                  className="text-xs text-red-600 font-semibold hover:underline cursor-pointer"
                >
                  Lepas Kartu Ini
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBindingStudent(null)}
                  className="text-xs h-10 px-3.5 rounded-xl"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!bindingUid.trim() || isBinding}
                  className="text-xs h-10 px-4 rounded-xl"
                >
                  {isBinding ? 'Menyimpan...' : 'Simpan Kartu'}
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* 6. MODAL ADD / EDIT STUDENT */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStudent ? 'Edit Data Siswa & RFID' : 'Tambah Siswa Baru ke Direktori'}
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
                className="text-xs font-mono h-10"
              />
            </div>

            {/* Jenis Kelamin */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jenis Kelamin <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormGender('L')}
                  className={`h-10 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    formGender === 'L'
                      ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Laki-laki (L)
                </button>
                <button
                  type="button"
                  onClick={() => setFormGender('P')}
                  className={`h-10 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    formGender === 'P'
                      ? 'bg-rose-50 border-rose-400 text-rose-800 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Perempuan (P)
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
              className="text-xs font-semibold h-10"
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
                onChange={(e) => {
                  const val = e.target.value;
                  setFormClass(val);
                  if (!editingStudent && (val === '8A' || val === '9A')) {
                    setFormGender('P');
                  }
                }}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#023246]"
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
                  placeholder="Ketik nama rombel baru..."
                  required
                  className="text-xs h-10"
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
              onChange={(e) => setFormRfidUid(e.target.value.toUpperCase().trim())}
              placeholder="Tempel kartu RFID pada scanner atau ketik UID..."
              className="text-xs font-mono font-bold h-10"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Dapat dikosongkan dan dipasangkan nanti melalui tombol &quot;+ Pasang RFID&quot;.
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
                className="text-xs font-mono h-10"
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
                className="text-xs h-10"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="text-xs h-10 px-4 rounded-xl cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving}
              className="text-xs h-10 px-5 rounded-xl cursor-pointer"
            >
              {isSaving ? 'Menyimpan...' : editingStudent ? 'Simpan Perubahan' : 'Tambah Siswa'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7. MODAL DELETE CONFIRMATION */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Konfirmasi Hapus Siswa"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Apakah Anda yakin ingin menghapus data siswa{' '}
            <strong className="text-slate-900">{deleteTarget?.fullName}</strong> (Kelas {deleteTarget?.className})?
            Data yang dihapus tidak dapat dikembalikan.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="text-xs h-10 px-3.5 rounded-xl cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleDeleteStudent}
              disabled={isSaving}
              className="text-xs h-10 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl cursor-pointer"
            >
              {isSaving ? 'Menghapus...' : 'Ya, Hapus Siswa'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 8. TERMINAL KIOSK MODAL */}
      <StudentRfidKioskModal
        isOpen={isKioskOpen}
        onClose={() => setIsKioskOpen(false)}
        onAttendanceRecorded={loadData}
      />
    </div>
  );
};

