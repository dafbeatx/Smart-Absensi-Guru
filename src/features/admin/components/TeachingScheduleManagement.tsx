import React, { useState, useEffect, useMemo } from 'react';
import type { UserProfile, TeachingSlot } from '../../../types/database.types';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { SearchableSelect, type SelectOption } from '../../../components/ui/SearchableSelect';
import { useToastStore } from '../../../store/useToastStore';
import { TeachingScheduleRepository } from '../../../repositories/TeachingScheduleRepository';
import {
  SubjectManagementModal,
  DEFAULT_SUBJECTS,
  SUBJECTS_STORAGE_KEY,
} from './SubjectManagementModal';
import type { SubjectItem } from './SubjectManagementModal';

export interface ExtendedTeachingSlot extends TeachingSlot {
  user_id?: string; // Associated teacher user ID or NIP
  teacher_name?: string;
}

export interface TeachingScheduleManagementProps {
  teachers: UserProfile[];
}

const STORAGE_KEY = 'smart_absensi_teaching_schedules';
const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const FILTER_DAYS = ['Semua', ...DAYS];

const TIME_PRESETS = [
  { label: 'Jam 1-2 (07:30 - 08:50)', start: '07:30', end: '08:50' },
  { label: 'Jam 3-4 (08:50 - 10:10)', start: '08:50', end: '10:10' },
  { label: 'Jam 5-6 (10:30 - 11:50)', start: '10:30', end: '11:50' },
  { label: 'Jam 7-8 (12:30 - 13:50)', start: '12:30', end: '13:50' },
];

const CLASS_PRESETS = ['Kelas VII-A', 'Kelas VII-B', 'Kelas VIII-A', 'Kelas VIII-B', 'Kelas IX-A', 'Kelas IX-B'];
const ROOM_PRESETS = ['Ruang Teori 7A', 'Ruang Teori 8A', 'Ruang Teori 9A', 'Lab Komputer', 'Lab IPA', 'Lapangan'];

export const TeachingScheduleManagement: React.FC<TeachingScheduleManagementProps> = ({ teachers }) => {
  const { showToast } = useToastStore();

  const [schedules, setSchedules] = useState<ExtendedTeachingSlot[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.warn('Failed to parse cached schedules:', e);
      }
    }
    return [];
  });

  // Master Data: Subjects List
  const [subjects, setSubjects] = useState<SubjectItem[]>(() => {
    const saved = localStorage.getItem(SUBJECTS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.warn('Failed to parse cached subjects:', e);
      }
    }
    return DEFAULT_SUBJECTS;
  });

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('ALL');
  const [selectedDay, setSelectedDay] = useState<string>('Semua');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('ALL');

  // Modal State for Add / Edit Schedule
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modal State for Subject Management
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);

  // Form Fields
  const [formTeacherId, setFormTeacherId] = useState<string>('');
  const [formDay, setFormDay] = useState<string>('Senin');
  const [formTimeStart, setFormTimeStart] = useState<string>('07:30');
  const [formTimeEnd, setFormTimeEnd] = useState<string>('08:50');
  const [formClassName, setFormClassName] = useState<string>('');
  const [formSubject, setFormSubject] = useState<string>('');
  const [formRoom, setFormRoom] = useState<string>('');

  // Initial load from cloud provider repository with cache fallback
  useEffect(() => {
    TeachingScheduleRepository.getSchedules().then((fetched) => {
      if (Array.isArray(fetched) && fetched.length > 0) {
        setSchedules(fetched);
      }
    });
  }, []);

  // Persist schedules to cloud provider & local cache
  useEffect(() => {
    TeachingScheduleRepository.saveSchedules(schedules);
  }, [schedules]);

  // Handle subjects update
  const handleUpdateSubjects = (newSubjects: SubjectItem[]) => {
    setSubjects(newSubjects);
    localStorage.setItem(SUBJECTS_STORAGE_KEY, JSON.stringify(newSubjects));
    window.dispatchEvent(new CustomEvent('smart_absensi_subjects_updated', { detail: newSubjects }));
  };

  // Sync subjects across tabs / events
  useEffect(() => {
    const onSubjectsUpdated = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setSubjects(e.detail);
      } else {
        const saved = localStorage.getItem(SUBJECTS_STORAGE_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) setSubjects(parsed);
          } catch (err) {
            console.warn('Failed to re-sync subjects:', err);
          }
        }
      }
    };
    window.addEventListener('smart_absensi_subjects_updated', onSubjectsUpdated);
    return () => window.removeEventListener('smart_absensi_subjects_updated', onSubjectsUpdated);
  }, []);

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormTeacherId(teachers[0]?.id || '');
    setFormDay('Senin');
    setFormTimeStart('07:30');
    setFormTimeEnd('08:50');
    setFormClassName('Kelas VII-A');
    setFormSubject(subjects[0]?.name || '');
    setFormRoom('Ruang Teori 7A');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (slot: ExtendedTeachingSlot) => {
    setEditingId(slot.id);
    setFormTeacherId(slot.user_id || '');
    setFormDay(slot.day || 'Senin');

    // Parse time range e.g. "07:30 - 08:50 WIB"
    if (slot.time) {
      const parts = slot.time.replace(' WIB', '').split('-');
      if (parts.length === 2) {
        setFormTimeStart(parts[0].trim());
        setFormTimeEnd(parts[1].trim());
      }
    }

    setFormClassName(slot.className || '');
    setFormSubject(slot.subject || '');
    setFormRoom(slot.room || '');
    setIsModalOpen(true);
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTeacherId) {
      showToast('error', 'Pilih Guru', 'Pilih nama guru yang akan diajukan jadwalnya.');
      return;
    }
    if (!formSubject.trim()) {
      showToast('error', 'Mata Pelajaran Wajib', 'Pilih mata pelajaran yang diajarkan.');
      return;
    }
    if (!formClassName.trim()) {
      showToast('error', 'Kelas Wajib', 'Masukkan nama kelas.');
      return;
    }

    const selectedTeacher = teachers.find((t) => t.id === formTeacherId);
    const timeFormatted = `${formTimeStart} - ${formTimeEnd} WIB`;

    if (editingId) {
      setSchedules((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                user_id: formTeacherId,
                teacher_name: selectedTeacher?.full_name || 'Guru',
                day: formDay,
                time: timeFormatted,
                className: formClassName,
                subject: formSubject,
                room: formRoom || 'Ruang Kelas',
              }
            : item
        )
      );
      showToast('success', 'Jadwal Diperbarui', 'Jadwal mengajar berhasil diperbarui.');
    } else {
      const newSlot: ExtendedTeachingSlot = {
        id: 'sch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        user_id: formTeacherId,
        teacher_name: selectedTeacher?.full_name || 'Guru',
        day: formDay,
        time: timeFormatted,
        className: formClassName,
        subject: formSubject,
        room: formRoom || 'Ruang Kelas',
      };
      setSchedules((prev) => [...prev, newSlot]);
      showToast('success', 'Jadwal Ditambahkan', 'Jadwal mengajar baru berhasil disimpan.');
    }

    setIsModalOpen(false);
  };

  const handleDeleteSchedule = (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus jam mengajar ini?')) {
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      showToast('success', 'Jadwal Dihapus', 'Jam mengajar berhasil dihapus.');
    }
  };

  // Helper to extract initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  // Teacher Options for SearchableSelect
  const teacherOptions: SelectOption[] = useMemo(() => {
    return teachers.map((t) => ({
      value: t.id,
      label: t.full_name,
      subtitle: t.position || 'Guru Pengajar',
      avatarText: getInitials(t.full_name),
      avatarUrl: t.avatar_url || undefined,
      badge: t.role === 'KEPSEK' ? 'Kepsek' : t.role === 'ADMIN' ? 'Admin' : undefined,
      badgeClass: t.role === 'KEPSEK' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700',
    }));
  }, [teachers]);

  // Subject Options for SearchableSelect
  const subjectOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = subjects.map((s) => ({
      value: s.name,
      label: s.name,
      badge: s.category,
      badgeClass:
        s.category === 'Keagamaan'
          ? 'bg-amber-50 text-amber-800 border border-amber-200'
          : s.category === 'Muatan Lokal'
          ? 'bg-purple-50 text-purple-800 border border-purple-200'
          : s.category === 'Peminatan / Kejuruan'
          ? 'bg-blue-50 text-blue-800 border border-blue-200'
          : 'bg-emerald-50 text-emerald-800 border border-emerald-200',
      subtitle: s.code ? `Kode: ${s.code}` : undefined,
    }));

    // If editing a slot with custom subject not in standard list
    if (formSubject && !subjects.some((s) => s.name.toLowerCase() === formSubject.toLowerCase())) {
      list.unshift({
        value: formSubject,
        label: `${formSubject} (Kustom)`,
        badge: 'Kustom',
        badgeClass: 'bg-slate-100 text-slate-700',
      });
    }

    return list;
  }, [subjects, formSubject]);

  // Filtered List
  const filteredSchedules = schedules.filter((s) => {
    const matchTeacher = selectedTeacherId === 'ALL' || s.user_id === selectedTeacherId;
    const matchDay = selectedDay === 'Semua' || s.day === selectedDay;
    const matchSubject = selectedSubjectFilter === 'ALL' || s.subject === selectedSubjectFilter;
    return matchTeacher && matchDay && matchSubject;
  });

  return (
    <div className="space-y-5 bg-white p-5 rounded-3xl border border-[#D4D4CE]/40 shadow-card">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-black text-[#023246]">🗓️ Kelola Jadwal Mengajar Guru</h2>
          <p className="text-xs text-slate-500 font-medium">
            Input & atur alokasi mata pelajaran, kelas, dan jam mengajar guru
          </p>
        </div>

        {/* Action Buttons: Kelola Mapel & Tambah Jadwal */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsSubjectModalOpen(true)}
            className="px-3.5 py-2.5 text-xs font-extrabold text-[#023246] bg-slate-100 hover:bg-slate-200 border border-slate-300/80 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Kelola master daftar mata pelajaran sekolah"
          >
            <span>📚</span> Kelola Mata Pelajaran
          </button>

          <Button
            variant="primary"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 text-xs font-extrabold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span>➕</span> Tambah Jadwal Mengajar
          </Button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
        {/* Teacher Filter */}
        <div className="space-y-1">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
            Filter Guru:
          </label>
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none cursor-pointer"
          >
            <option value="ALL">👥 Semua Guru ({teachers.length})</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} ({t.position || 'Guru'})
              </option>
            ))}
          </select>
        </div>

        {/* Subject Filter */}
        <div className="space-y-1">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
            Filter Mata Pelajaran:
          </label>
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none cursor-pointer"
          >
            <option value="ALL">📚 Semua Mata Pelajaran</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Day Filter */}
        <div className="space-y-1">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
            Filter Hari:
          </label>
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {FILTER_DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDay(d)}
                className={`py-2 px-2.5 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer whitespace-nowrap flex-1 text-center ${
                  selectedDay === d
                    ? 'bg-[#023246] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Schedule Items Grid / Table */}
      <div className="space-y-3">
        {filteredSchedules.length === 0 ? (
          <div className="text-center py-12 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 font-medium space-y-2">
            <span className="text-3xl block">☕</span>
            <p className="font-bold text-[#023246]">Belum Ada Jadwal Mengajar</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Klik tombol <strong className="text-emerald-700">"Tambah Jadwal Mengajar"</strong> di atas untuk menginput jadwal kelas untuk guru.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredSchedules.map((slot) => (
              <div
                key={slot.id}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-emerald-100 text-[#0D7A5F] rounded-md border border-emerald-200 shrink-0">
                        {slot.day}
                      </span>
                      <span className="text-xs font-black text-[#023246] truncate">
                        {slot.className}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 truncate">
                      📖 {slot.subject}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500 truncate">
                      👤 {slot.teacher_name || 'Guru'}
                    </p>
                  </div>

                  <div className="text-right space-y-1 shrink-0">
                    <span className="inline-block px-2.5 py-1 text-[10px] font-mono font-bold bg-slate-100 text-slate-800 rounded-lg border border-slate-200">
                      ⏱️ {slot.time}
                    </span>
                    <p className="text-[10px] text-slate-400 font-medium">📍 {slot.room}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenEditModal(slot)}
                    className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDeleteSchedule(slot.id)}
                    className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                  >
                    🗑️ Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modern Add / Edit Schedule Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#023246] text-white flex items-center justify-center text-lg shadow-xs">
                🗓️
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#023246]">
                  {editingId ? 'Edit Jadwal Mengajar' : 'Tambah Jadwal Mengajar Guru'}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Atur alokasi pengajar, mata pelajaran, waktu, dan ruang kelas
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-colors cursor-pointer text-sm"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSaveSchedule} className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
            {/* Section 1: Guru Pengajar & Mata Pelajaran */}
            <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                1. Pengajar & Mata Pelajaran
              </span>

              {/* Custom Searchable Teacher Selector */}
              <SearchableSelect
                label="Pilih Guru Pengajar"
                placeholder="-- Pilih Guru Pengajar --"
                options={teacherOptions}
                value={formTeacherId}
                onChange={setFormTeacherId}
                required
                emptyText="Nama guru tidak ditemukan"
              />

              {/* Custom Searchable Subject Selector */}
              <SearchableSelect
                label="Mata Pelajaran"
                placeholder="-- Pilih Mata Pelajaran --"
                options={subjectOptions}
                value={formSubject}
                onChange={setFormSubject}
                required
                actionButton={{
                  label: '➕ Kelola Mapel',
                  onClick: () => setIsSubjectModalOpen(true),
                }}
                emptyText="Mata pelajaran tidak ditemukan"
              />
            </div>

            {/* Section 2: Waktu & Alokasi Hari */}
            <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                2. Hari & Jam Mengajar
              </span>

              {/* Day Segmented Selector */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Hari Mengajar *</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setFormDay(d)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                        formDay === d
                          ? 'bg-[#023246] text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Jam Mulai *</label>
                  <Input
                    type="time"
                    value={formTimeStart}
                    onChange={(e) => setFormTimeStart(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Jam Selesai *</label>
                  <Input
                    type="time"
                    value={formTimeEnd}
                    onChange={(e) => setFormTimeEnd(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Time Presets */}
              <div className="flex gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] font-bold text-slate-400 self-center">Preset:</span>
                {TIME_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setFormTimeStart(p.start);
                      setFormTimeEnd(p.end);
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      formTimeStart === p.start && formTimeEnd === p.end
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {p.start} - {p.end}
                  </button>
                ))}
              </div>
            </div>

            {/* Section 3: Kelas & Ruangan */}
            <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                3. Ruang & Alokasi Kelas
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Kelas *</label>
                  <Input
                    value={formClassName}
                    onChange={(e) => setFormClassName(e.target.value)}
                    placeholder="Contoh: Kelas VII-A"
                    required
                  />
                  {/* Quick Class Chips */}
                  <div className="flex gap-1 overflow-x-auto no-scrollbar pt-1">
                    {CLASS_PRESETS.slice(0, 4).map((cls) => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setFormClassName(cls)}
                        className="px-1.5 py-0.5 text-[9px] font-bold bg-white text-slate-600 border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer shrink-0"
                      >
                        {cls.replace('Kelas ', '')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Ruangan / Lab</label>
                  <Input
                    value={formRoom}
                    onChange={(e) => setFormRoom(e.target.value)}
                    placeholder="Contoh: Ruang Teori 7A"
                  />
                  {/* Quick Room Chips */}
                  <div className="flex gap-1 overflow-x-auto no-scrollbar pt-1">
                    {ROOM_PRESETS.slice(0, 3).map((rm) => (
                      <button
                        key={rm}
                        type="button"
                        onClick={() => setFormRoom(rm)}
                        className="px-1.5 py-0.5 text-[9px] font-bold bg-white text-slate-600 border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer shrink-0"
                      >
                        {rm}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                Batal
              </Button>
              <Button variant="primary" type="submit" className="px-5">
                {editingId ? '💾 Simpan Perubahan' : '➕ Tambah Jadwal'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Subject Management Modal */}
      <SubjectManagementModal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        subjects={subjects}
        onUpdateSubjects={handleUpdateSubjects}
        schedules={schedules}
      />
    </div>
  );
};
