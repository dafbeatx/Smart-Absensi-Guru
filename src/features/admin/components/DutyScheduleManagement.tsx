import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { useToastStore } from '../../../store/useToastStore';
import { DutyScheduleRepository } from '../../../repositories/DutyScheduleRepository';
import { ProviderFactory } from '../../../providers/provider-factory';
import type { TeacherDutySchedule, UserProfile } from '../../../types/database.types';

const DAYS_OF_WEEK = [
  { day: 1, name: 'Senin', color: 'bg-red-500', textLight: 'text-red-700', bgLight: 'bg-red-50' },
  { day: 2, name: 'Selasa', color: 'bg-amber-500', textLight: 'text-amber-700', bgLight: 'bg-amber-50' },
  { day: 3, name: 'Rabu', color: 'bg-emerald-500', textLight: 'text-emerald-700', bgLight: 'bg-emerald-50' },
  { day: 4, name: 'Kamis', color: 'bg-blue-500', textLight: 'text-blue-700', bgLight: 'bg-blue-50' },
  { day: 5, name: 'Jumat', color: 'bg-indigo-500', textLight: 'text-indigo-700', bgLight: 'bg-indigo-50' },
];

export const DutyScheduleManagement: React.FC = () => {
  const { showToast } = useToastStore();
  const [selectedDay, setSelectedDay] = useState<number>(1); // Default: 1 (Senin)
  const [schedules, setSchedules] = useState<TeacherDutySchedule[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modal State for adding teacher duty
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [dutyNotes, setDutyNotes] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const provider = ProviderFactory.getProvider();
      const token = localStorage.getItem('smart_absensi_token') || '';

      // 1. Fetch Teachers List
      const usersList = await provider.getAllUsers(token);
      setTeachers(usersList.filter((u) => u.role === 'GURU' || u.role === 'KEPSEK' || u.is_active));

      // 2. Fetch Duty Schedules
      const fetchedSchedules = await DutyScheduleRepository.getDutySchedules(token);
      setSchedules(fetchedSchedules);
    } catch (err) {
      console.warn('Gagal memuat jadwal piket:', err);
      showToast('error', 'Gagal Memuat Data', 'Gagal memuat data jadwal piket.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter schedules for the current selected day
  const daySchedules = schedules.filter((s) => s.day_of_week === selectedDay);

  const handleAddTeacherDuty = () => {
    if (!selectedTeacherId) {
      showToast('warning', 'Pilih Guru', 'Pilih guru terlebih dahulu dari daftar.');
      return;
    }

    const teacherObj = teachers.find((t) => t.id === selectedTeacherId);
    if (!teacherObj) return;

    // Check if teacher already added for this day
    const alreadyExists = daySchedules.some((s) => s.teacher_id === selectedTeacherId);
    if (alreadyExists) {
      showToast('warning', 'Guru Sudah Terdaftar', `${teacherObj.full_name} sudah terdaftar sebagai Guru Piket di hari ini.`);
      return;
    }

    const newEntry: TeacherDutySchedule = {
      id: 'temp_' + Date.now(),
      day_of_week: selectedDay,
      teacher_id: teacherObj.id,
      teacher_name: teacherObj.full_name,
      notes: dutyNotes.trim() || 'Tugas Piket & Pengawasan Ketertiban Presensi',
      created_at: new Date().toISOString(),
    };

    setSchedules((prev) => [...prev, newEntry]);
    setIsAddModalOpen(false);
    setSelectedTeacherId('');
    setDutyNotes('');
    showToast('success', 'Guru Piket Ditambahkan', `Berhasil menambahkan ${teacherObj.full_name} ke Jadwal Piket.`);
  };

  const handleRemoveDuty = (teacherId: string) => {
    setSchedules((prev) => prev.filter((s) => !(s.day_of_week === selectedDay && s.teacher_id === teacherId)));
    showToast('info', 'Dihapus Dari Jadwal', 'Guru piket dihapus dari jadwal hari ini.');
  };

  const handleSaveAllSchedules = async () => {
    setIsSaving(true);
    try {
      const payload = schedules.map((s) => ({
        day_of_week: s.day_of_week,
        teacher_id: s.teacher_id,
        teacher_name: s.teacher_name,
        notes: s.notes || 'Pengawasan Ketertiban Presensi & Piket Sekolah',
      }));

      await DutyScheduleRepository.saveDutySchedules(payload);
      showToast('success', 'Jadwal Disimpan', 'Jadwal Piket Guru berhasil disimpan dan diperbarui!');
      await loadData();
    } catch (err) {
      console.error('Gagal menyimpan jadwal piket:', err);
      showToast('error', 'Gagal Menyimpan', 'Gagal menyimpan jadwal piket.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeDayObj = DAYS_OF_WEEK.find((d) => d.day === selectedDay) || DAYS_OF_WEEK[0];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-[#023246] via-[#1E5670] to-[#287094] rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-15 pointer-events-none">
          <span className="text-9xl">🛡️</span>
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-semibold mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Khusus Senin – Jumat
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Jadwal Piket Guru</h2>
          <p className="text-sm text-cyan-100 mt-1 leading-relaxed">
            Kelola pembagian tugas Guru Piket harian. Notifikasi pengingat akan muncul otomatis di halaman depan guru bertugas dan ucapan audio khusus akan diputar saat scan presensi berhasil.
          </p>
        </div>
      </div>

      {/* Day Selector Tabs (Senin - Jumat) */}
      <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap gap-2">
        {DAYS_OF_WEEK.map((d) => {
          const isSelected = selectedDay === d.day;
          const count = schedules.filter((s) => s.day_of_week === d.day).length;
          return (
            <button
              key={d.day}
              onClick={() => setSelectedDay(d.day)}
              className={`flex-1 min-w-27.5 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                isSelected
                  ? `${d.color} text-white shadow-md scale-[1.02]`
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span>{d.name}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                  isSelected ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Day Schedule Detail Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className={`w-3.5 h-3.5 rounded-full ${activeDayObj.color}`}></span>
              Daftar Guru Piket Hari {activeDayObj.name}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Guru bertugas di hari {activeDayObj.name} akan menerima notifikasi dan sapaan piket khusus.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-bold"
            >
              <span>➕ Tambah Guru Piket</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveAllSchedules}
              disabled={isSaving}
              className="bg-[#287094] hover:bg-[#023246] text-white font-bold flex items-center gap-2"
            >
              {isSaving ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Memuat data piket guru...</div>
        ) : daySchedules.length === 0 ? (
          <div className="p-10 text-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 space-y-3">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              🛡️
            </div>
            <h4 className="text-base font-bold text-gray-800">Belum Ada Guru Piket Hari {activeDayObj.name}</h4>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Klik tombol "Tambah Guru Piket" di atas untuk menugaskan guru pada hari {activeDayObj.name}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {daySchedules.map((item, idx) => {
              const teacherObj = teachers.find((t) => t.id === item.teacher_id);
              return (
                <div
                  key={item.id || idx}
                  className="p-4 rounded-xl border border-gray-200 hover:border-[#287094]/40 bg-gray-50/50 hover:bg-white transition-all shadow-sm flex items-start justify-between gap-4 group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#023246] text-white font-bold flex items-center justify-center shrink-0 shadow-sm">
                      {item.teacher_name ? item.teacher_name.charAt(0) : 'G'}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h4 className="text-sm font-bold text-gray-900 truncate">{item.teacher_name}</h4>
                      <p className="text-xs text-gray-500">NIP: {teacherObj?.nip || '-'}</p>
                      <div className="inline-block bg-amber-100 text-amber-800 text-[11px] font-semibold px-2 py-0.5 rounded">
                        📋 {item.notes || 'Piket Kedisiplinan & Presensi'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveDuty(item.teacher_id)}
                    className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    title="Hapus dari Piket"
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Tambah Guru Piket */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={`Tambah Guru Piket (Hari ${activeDayObj.name})`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Pilih Guru / Pendidik *</label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium focus:ring-2 focus:ring-[#287094]"
            >
              <option value="">-- Pilih Guru --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.position || 'Guru'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Catatan / Area Tugas Piket (Opsional)</label>
            <input
              type="text"
              placeholder="Contoh: Piket Pintu Gerbang Utama & Pengawasan Presensi Pagi"
              value={dutyNotes}
              onChange={(e) => setDutyNotes(e.target.value)}
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium focus:ring-2 focus:ring-[#287094]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddTeacherDuty}>
              Tambahkan ke Hari {activeDayObj.name}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
