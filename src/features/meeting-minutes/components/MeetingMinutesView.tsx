import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  Circle,
  Copy,
  Printer,
  Trash2,
  Search,
  ArrowLeft,
  Plus,
  ChevronDown,
  ChevronUp,
  Check,
  ListTodo,
  Layers,
  CheckCheck,
  RefreshCw,
} from 'lucide-react';
import type { UserProfile } from '../../../types/database.types';
import type {
  MeetingMinute,
  MeetingType,
  MeetingFormattedContent,
} from '../../../types/meeting-minutes.types';
import { MEETING_TYPE_LABELS } from '../../../types/meeting-minutes.types';
import {
  MeetingMinutesRepository,
  MEETING_MINUTES_UPDATED_EVENT,
} from '../../../repositories/MeetingMinutesRepository';
import { MeetingMinutesAIService } from '../../../services/meeting-minutes-ai.service';
import { useToastStore } from '../../../store/useToastStore';
import { getTodayDateInJakarta } from '../../../utils/time.utils';

export interface MeetingMinutesViewProps {
  currentUser?: UserProfile | null;
  onBack: () => void;
  initialMinuteId?: string;
  layoutMode?: 'auto' | 'mobile' | 'desktop';
}

export const MeetingMinutesView: React.FC<MeetingMinutesViewProps> = ({
  currentUser,
  onBack,
  initialMinuteId,
  layoutMode = 'auto',
}) => {
  const { showToast } = useToastStore();

  // Determine whether to render desktop enterprise layout or mobile view
  const isDesktop =
    layoutMode === 'desktop' ||
    (layoutMode !== 'mobile' &&
      (currentUser?.role === 'ADMIN' || currentUser?.role === 'KEPSEK'));

  const [activeTab, setActiveTab] = useState<'ARCHIVE' | 'RECORD'>('ARCHIVE');
  const [minutes, setMinutes] = useState<MeetingMinute[]>(() =>
    MeetingMinutesRepository.getAllMinutes()
  );
  const [selectedMinuteId, setSelectedMinuteId] = useState<string | null>(
    initialMinuteId || null
  );

  // Search & Filters for Archive
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | MeetingType>('ALL');

  // Form State for Recording New Minute
  const [formTitle, setFormTitle] = useState('');
  const [formMeetingType, setFormMeetingType] = useState<MeetingType>('DEWAN_GURU');
  const [formDate, setFormDate] = useState(getTodayDateInJakarta());
  const [formStartTime, setFormStartTime] = useState('13:00');
  const [formEndTime, setFormEndTime] = useState('15:00');
  const [formLocation, setFormLocation] = useState('Ruang Rapat Utama');
  const [formLeaderName, setFormLeaderName] = useState('Kepala Sekolah');
  const [formSecretaryName, setFormSecretaryName] = useState(
    currentUser?.full_name || 'Guru Notulis'
  );
  const [formAttendeesSummary, setFormAttendeesSummary] = useState(
    'Seluruh Dewan Guru & Tenaga Kependidikan'
  );
  const [formRoughNotes, setFormRoughNotes] = useState('');

  // AI Restructuring State
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [previewFormatted, setPreviewFormatted] = useState<MeetingFormattedContent | null>(null);
  const [aiSource, setAiSource] = useState<string | null>(null);

  // Saving State
  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showRawNotesInDetail, setShowRawNotesInDetail] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Reload minutes listener
  const refreshMinutes = useCallback(() => {
    setMinutes(MeetingMinutesRepository.getAllMinutes());
  }, []);

  // Fetch from cloud on mount, focus, & subscribe to real-time changes
  useEffect(() => {
    let isMounted = true;
    const syncData = async (silent = true) => {
      if (!silent) setIsSyncingCloud(true);
      try {
        const synced = await MeetingMinutesRepository.fetchAndSyncMinutes();
        if (isMounted) {
          setMinutes(synced);
        }
      } catch (err) {
        console.warn('Background sync minutes error:', err);
      } finally {
        if (isMounted && !silent) setIsSyncingCloud(false);
      }
    };

    // Initial background sync (auto-recovering any local minutes from HP to Cloud)
    syncData(false);

    // Initialize realtime Supabase listener
    const unsubRealtime = MeetingMinutesRepository.initRealtimeSubscription();

    const handleUpdate = () => refreshMinutes();
    const handleFocus = () => syncData(true);

    window.addEventListener(MEETING_MINUTES_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      unsubRealtime();
      window.removeEventListener(MEETING_MINUTES_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshMinutes]);

  // Manual trigger for user to force re-sync
  const handleManualSync = async () => {
    setIsSyncingCloud(true);
    try {
      const synced = await MeetingMinutesRepository.fetchAndSyncMinutes();
      setMinutes(synced);
      showToast('success', 'Sinkronisasi Cloud Berhasil', 'Data risalah rapat tersinkron penuh dengan server.');
    } catch {
      showToast('error', 'Gagal Sinkron', 'Tidak dapat menghubungkan ke server cloud saat ini.');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Mark as read when opening a specific minute
  useEffect(() => {
    if (selectedMinuteId && currentUser?.id) {
      MeetingMinutesRepository.markAsRead(selectedMinuteId, currentUser.id);
    }
  }, [selectedMinuteId, currentUser?.id]);

  // Filtered minutes list
  const filteredMinutes = useMemo(() => {
    let result = minutes;
    if (selectedTypeFilter !== 'ALL') {
      result = result.filter((m) => m.meetingType === selectedTypeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.leaderName.toLowerCase().includes(q) ||
          m.secretaryName.toLowerCase().includes(q) ||
          m.formattedContent?.executiveSummary?.toLowerCase().includes(q) ||
          m.roughNotes.toLowerCase().includes(q)
      );
    }
    return result;
  }, [minutes, selectedTypeFilter, searchQuery]);

  const activeMinute = useMemo(() => {
    if (!selectedMinuteId) return null;
    return minutes.find((m) => m.id === selectedMinuteId) || null;
  }, [minutes, selectedMinuteId]);

  // Quick stats for desktop header
  const stats = useMemo(() => {
    const total = minutes.length;
    const dewanGuru = minutes.filter((m) => m.meetingType === 'DEWAN_GURU').length;
    const kurikulum = minutes.filter((m) => m.meetingType === 'KURIKULUM').length;
    const kesiswaan = minutes.filter((m) => m.meetingType === 'KESISWAAN').length;
    const pendingActions = minutes.reduce(
      (acc, m) =>
        acc +
        (m.formattedContent?.actionItems?.filter((a) => a.status === 'PENDING').length || 0),
      0
    );
    return { total, dewanGuru, kurikulum, kesiswaan, pendingActions };
  }, [minutes]);

  // Trigger AI Restructuring
  const handleTriggerAI = async () => {
    if (!formRoughNotes.trim()) {
      showToast('error', 'Catatan Masih Kosong', 'Ketikkan beberapa poin jalannya rapat terlebih dahulu.');
      return;
    }

    setIsProcessingAI(true);
    try {
      const result = await MeetingMinutesAIService.restructureNotes({
        title: formTitle.trim() || 'Rapat Koordinasi Sekolah',
        meetingType: formMeetingType,
        roughNotes: formRoughNotes,
        leaderName: formLeaderName,
        secretaryName: formSecretaryName,
        attendeesSummary: formAttendeesSummary,
      });

      setPreviewFormatted(result.formattedContent);
      setAiSource(result.source);
      showToast(
        'success',
        '✨ Risalah Berhasil Dirapikan!',
        result.source === 'AI_GROQ'
          ? 'Groq AI sukses merestrukturisasi catatan rapat menjadi risalah resmi.'
          : 'Catatan berhasil distrukturkan oleh sistem analisis risalah.'
      );
    } catch (err) {
      console.warn('AI error:', err);
      showToast('error', 'Gagal Memproses AI', 'Terjadi kendala saat merapikan risalah. Coba lagi.');
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Insert Quick Demo Template
  const handleInsertTemplate = () => {
    setFormTitle('Rapat Pleno Koordinasi Persiapan Evaluasi & Ketertiban Sekolah');
    setFormMeetingType('KURIKULUM');
    setFormRoughNotes(`- Rapat pleno dibuka pimpinan jam 1 siang di ruang rapat
- Bahas persiapan ujian tengah semester target mulai 5 oktober
- Kisi-kisi soal dikumpul maks tgl 29 sept pic bu dewi sartika
- Ruang ujian disiapkan 6 rombel smp dan 4 rombel sma
- Pengawas ujian wajib hadir 15 menit sblm sesi 1 (jam 07.45)
- Cetak kartu peserta ujian format barcode NISN pic pak rahmat maks tgl 1 okt
- Siswa dgn kendala administrasi spp tdk boleh dilarang ujian, diarahkan konseling ke ruang bk
- Disiplin presensi guru ditingkatkan dan tdk boleh nitip absensi`);
    showToast('info', 'Template Dimuat', 'Draf catatan contoh berhasil dimasukkan.');
  };

  // Save new minute
  const handleSaveMinute = async () => {
    if (!formTitle.trim()) {
      showToast('error', 'Judul Wajib Diisi', 'Mohon isi judul atau topik rapat.');
      return;
    }
    if (!formRoughNotes.trim()) {
      showToast('error', 'Catatan Masih Kosong', 'Ketikkan catatan jalannya rapat.');
      return;
    }

    setIsSaving(true);
    try {
      let finalContent = previewFormatted;
      if (!finalContent) {
        // Auto structure if user hasn't clicked AI button yet
        const res = await MeetingMinutesAIService.restructureNotes({
          title: formTitle,
          roughNotes: formRoughNotes,
          leaderName: formLeaderName,
        });
        finalContent = res.formattedContent;
      }

      const created = await MeetingMinutesRepository.createMinute(
        {
          title: formTitle,
          meetingType: formMeetingType,
          date: formDate,
          startTime: formStartTime,
          endTime: formEndTime,
          location: formLocation,
          leaderName: formLeaderName,
          secretaryName: formSecretaryName,
          attendeesSummary: formAttendeesSummary,
          roughNotes: formRoughNotes,
          formattedContent: finalContent,
          status: 'PUBLISHED',
        },
        {
          id: currentUser?.id || 'usr_guru_sample',
          full_name: currentUser?.full_name || 'Guru Notulis',
        }
      );

      showToast('success', 'Notulen Diterbitkan!', 'Risalah rapat berhasil dipublikasikan untuk seluruh guru.');
      // Reset form
      setFormTitle('');
      setFormRoughNotes('');
      setPreviewFormatted(null);
      setAiSource(null);
      // Navigate to archive & select newly created minute
      setActiveTab('ARCHIVE');
      setSelectedMinuteId(created.id);
    } catch (err) {
      console.warn('Failed to save minute:', err);
      showToast('error', 'Gagal Menyimpan', 'Terjadi kesalahan saat menyimpan notulen rapat.');
    } finally {
      setIsSaving(false);
    }
  };

  // Copy WhatsApp / Text Share
  const handleCopyText = (minute: MeetingMinute) => {
    const text = MeetingMinutesRepository.exportAsText(minute);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setIsCopied(true);
          showToast('success', 'Risalah Disalin!', 'Format notulen siap dibagikan ke grup WhatsApp guru.');
          setTimeout(() => setIsCopied(false), 2500);
        })
        .catch(() => {
          showToast('info', 'Notulen Rapat', text.slice(0, 150));
        });
    }
  };

  // Toggle action item completion
  const handleToggleAction = (minuteId: string, actionId: string) => {
    MeetingMinutesRepository.toggleActionItem(minuteId, actionId);
    showToast('info', 'Status Tugas Diperbarui', 'Status tindak lanjut berhasil disesuaikan.');
  };

  // Delete minute
  const handleDeleteMinute = (minuteId: string, title?: string) => {
    const confirmMsg = title
      ? `Hapus notulen rapat "${title}" dari arsip?\n\nData yang dihapus tidak dapat dikembalikan.`
      : 'Apakah Anda yakin ingin menghapus notulen rapat ini?';
    if (window.confirm(confirmMsg)) {
      MeetingMinutesRepository.deleteMinute(minuteId);
      if (selectedMinuteId === minuteId) {
        setSelectedMinuteId(null);
      }
      setMinutes(MeetingMinutesRepository.getAllMinutes());
      showToast('info', 'Notulen Dihapus', 'Notulen rapat telah berhasil dihapus dari arsip.');
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER: DESKTOP VIEW (FOR ADMIN & KEPSEK)
  // ══════════════════════════════════════════════════════════════════════════════
  if (isDesktop) {
    return (
      <div className="w-full space-y-6 pb-16 text-[#023246] animate-fadeIn">
        {/* ── DESKTOP HEADER & STATS CARD ────────────────────────────────────── */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-card space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMinuteId) {
                      setSelectedMinuteId(null);
                    } else {
                      onBack();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#023246] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{selectedMinuteId ? 'Kembali ke Arsip' : 'Dashboard'}</span>
                </button>
                <span className="text-slate-300">/</span>
                <span className="px-2.5 py-0.5 bg-teal-100 text-teal-800 font-extrabold text-[11px] rounded-full border border-teal-200">
                  ✨ AI Notulen Terpadu
                </span>
                <span className="px-2.5 py-0.5 bg-sky-100 text-sky-800 font-extrabold text-[11px] rounded-full border border-sky-200">
                  🏛️ Akses Pimpinan &amp; Admin
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Notulen &amp; Risalah Rapat Sekolah
              </h1>
              <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
                Pusat perumusan risalah resmi berbasis AI, pencatatan hasil musyawarah dewan guru, dan
                distribusi transparan keputusan sekolah lintas perangkat laptop &amp; HP.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncingCloud}
                title="Sinkronkan risalah rapat dengan server cloud Supabase"
                className="text-xs py-2.5 px-3.5 font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer flex items-center gap-2 shadow-2xs disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-600 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                <span>{isSyncingCloud ? 'Sinkron Cloud...' : 'Sinkron Cloud'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedMinuteId(null);
                  setActiveTab('ARCHIVE');
                }}
                className={`text-xs py-2.5 px-4 font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'ARCHIVE' && !selectedMinuteId
                    ? 'bg-[#023246] text-white border-[#023246] shadow-sm'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Arsip Risalah ({minutes.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedMinuteId(null);
                  setActiveTab('RECORD');
                }}
                className={`text-xs py-2.5 px-4 font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'RECORD' && !selectedMinuteId
                    ? 'bg-[#023246] text-white border-[#023246] shadow-sm'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 shadow-2xs'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Catat Rapat Baru</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar on Desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">Total Risalah</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-900">{stats.total}</span>
                <span className="text-[10px] text-slate-400">Dokumen</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-1">
              <span className="text-[11px] font-bold text-blue-700 block">Dewan Guru</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-blue-900">{stats.dewanGuru}</span>
                <span className="text-[10px] text-blue-500">Sidang</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-1">
              <span className="text-[11px] font-bold text-indigo-700 block">Kurikulum &amp; KBM</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-indigo-900">{stats.kurikulum}</span>
                <span className="text-[10px] text-indigo-500">Rapat</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-1">
              <span className="text-[11px] font-bold text-emerald-700 block">Kesiswaan</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-emerald-900">{stats.kesiswaan}</span>
                <span className="text-[10px] text-emerald-500">Koordinasi</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-1">
              <span className="text-[11px] font-bold text-amber-800 block">Tindak Lanjut Aktif</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-amber-950">{stats.pendingActions}</span>
                <span className="text-[10px] text-amber-700">Tugas Pending</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── DETAIL VIEW DESKTOP (JIKA MEMILIH SALAH SATU NOTULEN) ─────────── */}
        {selectedMinuteId && activeMinute ? (
          <div className="space-y-6 animate-fadeIn">
            {/* Action Bar Detail */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-card flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMinuteId(null)}
                  className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-xs font-bold text-[#023246] flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Daftar Notulen</span>
                </button>
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-extrabold border ${
                    MEETING_TYPE_LABELS[activeMinute.meetingType]?.badgeClass ||
                    'bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  {MEETING_TYPE_LABELS[activeMinute.meetingType]?.icon}{' '}
                  {MEETING_TYPE_LABELS[activeMinute.meetingType]?.label}
                </span>
                <span className="text-xs text-slate-400 font-medium hidden md:inline">
                  ID: <code className="font-mono text-slate-600">{activeMinute.id}</code>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyText(activeMinute)}
                  className="h-10 px-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Salin teks resmi untuk WhatsApp"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Tersalin ke Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Salin Format WhatsApp</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-10 px-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cetak / Simpan PDF</span>
                </button>

                {(currentUser?.role === 'ADMIN' ||
                  currentUser?.role === 'KEPSEK' ||
                  activeMinute.createdByUserId === currentUser?.id) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMinute(activeMinute.id, activeMinute.title)}
                    className="h-10 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus</span>
                  </button>
                )}
              </div>
            </div>

            {/* Banner Ringkasan Eksekutif AI (Full Width) */}
            <div className="bg-linear-to-r from-teal-50 via-white to-sky-50 rounded-3xl p-6 border border-teal-200/90 shadow-card space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-teal-900 text-xs font-black uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>Ringkasan Eksekutif (AI Restructured Summary)</span>
                </div>
                <span className="text-[11px] text-teal-800 font-bold px-2 py-0.5 bg-teal-100 rounded-md">
                  Resmi &amp; Otomatis
                </span>
              </div>
              <p className="text-sm md:text-base text-slate-800 leading-relaxed font-medium">
                {activeMinute.formattedContent.executiveSummary}
              </p>
            </div>

            {/* 2-Column Desktop Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* KOLOM KIRI (7 Cols): Pembahasan, Keputusan, dan Catatan Asli */}
              <div className="lg:col-span-7 space-y-6">
                {/* Judul & Agenda */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-card space-y-4">
                  <div>
                    <span className="text-[11px] font-extrabold text-teal-800 uppercase tracking-wider block">
                      Topik Musyawarah / Rapat
                    </span>
                    <h2 className="text-xl font-black text-slate-900 leading-snug mt-1">
                      {activeMinute.title}
                    </h2>
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div className="flex items-center gap-2 text-slate-800 text-xs font-black uppercase tracking-wider">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>Pokok Agenda &amp; Pembahasan</span>
                    </div>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                      {activeMinute.formattedContent.agendaPoints.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                          <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed font-medium">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Keputusan Resmi Rapat */}
                <div className="bg-white rounded-3xl p-6 border-2 border-emerald-300 shadow-card space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-emerald-900 text-xs font-black uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Keputusan Resmi Rapat</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-xs font-black">
                      {activeMinute.formattedContent.keyDecisions.length} Putusan Sah
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {activeMinute.formattedContent.keyDecisions.map((decision, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-start gap-2.5 text-xs sm:text-sm text-slate-800"
                      >
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          ✓
                        </span>
                        <span className="font-semibold leading-relaxed">{decision}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Collapsible Catatan Mentah Awal Notulis */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowRawNotesInDetail(!showRawNotesInDetail)}
                    className="w-full p-4 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-slate-400" />
                      <span>Catatan Kasar Notulis (Draf Mentah Sebelum AI)</span>
                    </div>
                    {showRawNotesInDetail ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  {showRawNotesInDetail && (
                    <div className="p-4 bg-slate-50/90 border-t border-slate-100 text-xs text-slate-600 font-mono whitespace-pre-wrap leading-relaxed">
                      {activeMinute.roughNotes}
                    </div>
                  )}
                </div>
              </div>

              {/* KOLOM KANAN (5 Cols): Informasi Pelaksanaan & Tindak Lanjut PIC */}
              <div className="lg:col-span-5 space-y-6">
                {/* Informasi Rapat */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-card space-y-4">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Informasi Pelaksanaan
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Tanggal Pelaksanaan</span>
                      <span className="font-bold text-slate-800">{activeMinute.date}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Waktu / Durasi</span>
                      <span className="font-bold text-slate-800">
                        {activeMinute.startTime} - {activeMinute.endTime} WIB
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Tempat / Ruangan</span>
                      <span className="font-bold text-slate-800">{activeMinute.location}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Pimpinan Rapat</span>
                      <span className="font-bold text-slate-800">{activeMinute.leaderName}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Notulis Resmi</span>
                      <span className="font-bold text-slate-800">{activeMinute.secretaryName}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Kehadiran Peserta</span>
                      <span className="font-bold text-slate-800 text-right">
                        {activeMinute.attendeesSummary || 'Dewan Guru'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500 font-medium">Dicatat Oleh</span>
                      <span className="font-bold text-teal-800">{activeMinute.createdByName}</span>
                    </div>
                  </div>
                </div>

                {/* Tindak Lanjut & PIC (Action Items) */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-card space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-900 text-xs font-black uppercase tracking-wider">
                      <ListTodo className="w-4 h-4 text-teal-700" />
                      <span>Tindak Lanjut &amp; PIC</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Klik kotak untuk centang
                    </span>
                  </div>

                  {activeMinute.formattedContent.actionItems.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      Tidak ada tugas tindak lanjut khusus untuk rapat ini.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {activeMinute.formattedContent.actionItems.map((item) => {
                        const isDone = item.status === 'COMPLETED';
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleToggleAction(activeMinute.id, item.id)}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                              isDone
                                ? 'bg-slate-50 border-slate-200 text-slate-500'
                                : 'bg-white border-amber-200 hover:border-amber-300 shadow-2xs text-slate-800'
                            }`}
                          >
                            <button
                              type="button"
                              className="mt-0.5 text-slate-400 hover:text-emerald-600 shrink-0 cursor-pointer"
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Circle className="w-4 h-4 text-amber-500" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-xs sm:text-sm font-bold leading-snug ${
                                  isDone ? 'line-through text-slate-400' : 'text-slate-900'
                                }`}
                              >
                                {item.task}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px]">
                                <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200/80 font-bold">
                                  PIC: {item.pic}
                                </span>
                                {item.deadline && (
                                  <span className="text-slate-500">
                                    Target: <strong className="text-slate-700">{item.deadline}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeMinute.formattedContent.additionalNotes && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                      <span className="font-bold text-slate-700 block">Catatan Tambahan:</span>
                      <p className="leading-relaxed">{activeMinute.formattedContent.additionalNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── DESKTOP TABS: ARSIP RISALAH & CATAT RAPAT BARU ──────────────── */
          <div className="space-y-6">
            {/* ═════════════════ TAB 1: ARSIP RISALAH DESKTOP ═════════════════ */}
            {activeTab === 'ARCHIVE' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Search & Filter Bar */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-card space-y-3.5">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari topik rapat, pimpinan sidang, notulis, atau kata kunci keputusan..."
                        className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                      />
                    </div>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-2 cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Filter Pills Kategori Rapat */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setSelectedTypeFilter('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                        selectedTypeFilter === 'ALL'
                          ? 'bg-[#023246] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Semua Kategori ({minutes.length})
                    </button>
                    {(Object.keys(MEETING_TYPE_LABELS) as MeetingType[]).map((typeKey) => {
                      const count = minutes.filter((m) => m.meetingType === typeKey).length;
                      return (
                        <button
                          key={typeKey}
                          type="button"
                          onClick={() => setSelectedTypeFilter(typeKey)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                            selectedTypeFilter === typeKey
                              ? 'bg-[#023246] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span>{MEETING_TYPE_LABELS[typeKey].icon}</span>
                          <span>{MEETING_TYPE_LABELS[typeKey].label.replace('Rapat ', '')}</span>
                          <span className="text-[10px] opacity-75">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grid 3-Kolom Kartu Notulen Rapat di Desktop */}
                {filteredMinutes.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-card space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                      <FileText className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">Tidak Ada Notulen Rapat Ditemukan</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Coba sesuaikan kata kunci pencarian atau buat risalah baru dengan mengklik tombol "Catat Rapat Baru".
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredMinutes.map((minute) => {
                      const isReadByCurrentUser =
                        Boolean(currentUser?.id) && Boolean(minute.readBy?.includes(currentUser!.id));
                      const typeMeta = MEETING_TYPE_LABELS[minute.meetingType];
                      const pendingTasks =
                        minute.formattedContent.actionItems?.filter(
                          (a) => a.status === 'PENDING'
                        ).length || 0;

                      return (
                        <div
                          key={minute.id}
                          onClick={() => setSelectedMinuteId(minute.id)}
                          className="bg-white rounded-3xl p-5 border border-slate-200 shadow-card hover:border-teal-400 hover:shadow-md transition-all cursor-pointer space-y-3.5 flex flex-col justify-between group active:scale-[0.99]"
                        >
                          <div className="space-y-2.5">
                            {/* Header Kartu: Badge Tipe + Tanggal */}
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black border flex items-center gap-1.5 ${typeMeta.badgeClass}`}
                              >
                                <span>{typeMeta.icon}</span>
                                <span>{typeMeta.label}</span>
                              </span>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {!isReadByCurrentUser && (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black animate-pulse">
                                    Belum Dibaca
                                  </span>
                                )}
                                <span className="text-xs font-mono text-slate-400">
                                  {minute.date}
                                </span>
                              </div>
                            </div>

                            {/* Judul Notulen */}
                            <h3 className="text-base font-black text-slate-900 group-hover:text-teal-900 transition-colors leading-snug line-clamp-2">
                              {minute.title}
                            </h3>

                            {/* Ringkasan Eksekutif */}
                            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                              {minute.formattedContent.executiveSummary}
                            </p>
                          </div>

                          {/* Footer Info Kartu */}
                          <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                            <div className="flex items-center justify-between text-slate-500">
                              <div className="flex items-center gap-1.5 truncate">
                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{minute.leaderName}</span>
                              </div>
                              <span className="text-[11px] font-mono text-slate-400 shrink-0">
                                {minute.startTime} - {minute.endTime}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                              {minute.formattedContent.actionItems.length > 0 ? (
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                    pendingTasks > 0
                                      ? 'bg-amber-50 text-amber-900 border-amber-200'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  }`}
                                >
                                  {pendingTasks > 0 ? `${pendingTasks} Tugas Pending` : '✓ Selesai'}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">Tanpa tugas khusus</span>
                              )}

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMinute(minute.id, minute.title);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-90 transition-all cursor-pointer"
                                  title="Hapus Notulen Ini"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <span className="text-xs font-bold text-teal-800 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                                  <span>Buka Risalah</span>
                                  <span>→</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═════════════════ TAB 2: CATAT RAPAT BARU DESKTOP ═════════════════ */}
            {activeTab === 'RECORD' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fadeIn">
                {/* KOLOM KIRI (7 Cols): Form Pengisian */}
                <div className="lg:col-span-7 space-y-5">
                  {/* Tips Card */}
                  <div className="bg-amber-50/90 rounded-3xl p-5 border border-amber-200 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">💡</span>
                      <div className="text-xs text-amber-950 space-y-1 leading-snug">
                        <p className="font-black text-sm">Pencatatan Fleksibel &amp; Otomatisasi AI</p>
                        <p className="text-amber-800 leading-relaxed">
                          Tulis poin-poin atau singkatan rapat apa adanya di kolom catatan kasar. Model AI
                          kami otomatis mengekstrak ringkasan eksekutif, poin agenda, keputusan resmi, dan
                          PIC tindak lanjut.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleInsertTemplate}
                      className="px-3 py-1.5 rounded-xl bg-amber-200 hover:bg-amber-300 active:scale-95 text-amber-950 text-xs font-extrabold transition-all cursor-pointer shrink-0"
                    >
                      Gunakan Contoh
                    </button>
                  </div>

                  {/* Form Container */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-card space-y-4">
                    <div>
                      <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">
                        Judul / Topik Rapat <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Misal: Rapat Pleno Koordinasi Persiapan Evaluasi Semester & Kurikulum"
                        className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">
                          Kategori Rapat
                        </label>
                        <select
                          value={formMeetingType}
                          onChange={(e) => setFormMeetingType(e.target.value as MeetingType)}
                          className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        >
                          {(Object.keys(MEETING_TYPE_LABELS) as MeetingType[]).map((typeKey) => (
                            <option key={typeKey} value={typeKey}>
                              {MEETING_TYPE_LABELS[typeKey].label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">
                          Tanggal Pelaksanaan
                        </label>
                        <input
                          type="date"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">
                          Jam Mulai
                        </label>
                        <input
                          type="time"
                          value={formStartTime}
                          onChange={(e) => setFormStartTime(e.target.value)}
                          className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">
                          Jam Selesai
                        </label>
                        <input
                          type="time"
                          value={formEndTime}
                          onChange={(e) => setFormEndTime(e.target.value)}
                          className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">
                          Tempat / Ruang
                        </label>
                        <input
                          type="text"
                          value={formLocation}
                          onChange={(e) => setFormLocation(e.target.value)}
                          placeholder="Misal: Ruang Rapat Utama Lt. 2"
                          className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">
                          Pimpinan Rapat
                        </label>
                        <input
                          type="text"
                          value={formLeaderName}
                          onChange={(e) => setFormLeaderName(e.target.value)}
                          placeholder="Misal: Dr. H. Mulyadi, M.Pd (Kepala Sekolah)"
                          className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">
                          Notulis
                        </label>
                        <input
                          type="text"
                          value={formSecretaryName}
                          onChange={(e) => setFormSecretaryName(e.target.value)}
                          placeholder="Nama Notulis Rapat"
                          className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">
                          Ringkasan Kehadiran
                        </label>
                        <input
                          type="text"
                          value={formAttendeesSummary}
                          onChange={(e) => setFormAttendeesSummary(e.target.value)}
                          placeholder="Misal: Hadir 28 Guru & 5 Staf TU"
                          className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                          Catatan Kasar Notulis <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[11px] text-teal-800 font-bold">
                          ✨ AI siap merestrukturisasi
                        </span>
                      </div>
                      <textarea
                        rows={7}
                        value={formRoughNotes}
                        onChange={(e) => setFormRoughNotes(e.target.value)}
                        placeholder="Tuliskan catatan jalannya rapat di sini... Contoh:
- PTS mulai tanggal 5 okt
- Soal kumpul ke bu dewi maks tgl 29
- Pengawas wajib hadir jam 07.45
- Keputusan: siswa izin wajib konfirmasi H-1"
                        className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246] leading-relaxed resize-y"
                      />
                    </div>

                    {/* Tombol Ajaib AI */}
                    <button
                      type="button"
                      disabled={isProcessingAI || !formRoughNotes.trim()}
                      onClick={handleTriggerAI}
                      className={`w-full h-12 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md min-h-12 ${
                        isProcessingAI
                          ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                          : 'bg-linear-to-r from-teal-700 via-[#18536B] to-[#023246] hover:brightness-110 text-white active:scale-[0.98]'
                      }`}
                    >
                      <Sparkles
                        className={`w-4 h-4 text-amber-300 ${isProcessingAI ? 'animate-spin' : ''}`}
                      />
                      <span>
                        {isProcessingAI
                          ? 'AI Sedang Merapikan Risalah...'
                          : '✨ Rapikan dengan AI (Restrukturisasi Risalah)'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* KOLOM KANAN (5 Cols): Live AI Preview & Publikasikan */}
                <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-6">
                  {previewFormatted ? (
                    <div className="bg-white rounded-3xl p-6 border-2 border-teal-300 shadow-card space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 text-teal-900 text-xs font-black uppercase tracking-wider">
                          <Sparkles className="w-4 h-4 text-teal-600" />
                          <span>Hasil Risalah Rapi &amp; Resmi</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[11px] font-bold">
                          {aiSource === 'AI_GROQ' ? 'Groq AI Model' : 'Penyusun Terstruktur'}
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200 text-xs text-slate-800 space-y-1.5">
                        <span className="font-black text-teal-950 block">Ringkasan Eksekutif:</span>
                        <p className="leading-relaxed font-medium">{previewFormatted.executiveSummary}</p>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <span className="font-extrabold text-slate-800 block">Pokok Agenda:</span>
                        <ul className="list-disc pl-4 space-y-1 text-slate-700">
                          {previewFormatted.agendaPoints.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <span className="font-extrabold text-emerald-900 block">Keputusan Resmi:</span>
                        <div className="space-y-1.5">
                          {previewFormatted.keyDecisions.map((k, i) => (
                            <div key={i} className="p-2.5 rounded-xl bg-emerald-50 text-emerald-950 font-semibold leading-relaxed">
                              ✓ {k}
                            </div>
                          ))}
                        </div>
                      </div>

                      {previewFormatted.actionItems.length > 0 && (
                        <div className="space-y-1.5 text-xs">
                          <span className="font-extrabold text-slate-800 block">
                            Tindak Lanjut &amp; PIC ({previewFormatted.actionItems.length}):
                          </span>
                          <div className="space-y-1.5">
                            {previewFormatted.actionItems.map((a, i) => (
                              <div
                                key={i}
                                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                              >
                                <span className="font-bold text-slate-800 truncate">{a.task}</span>
                                <span className="text-[10px] text-teal-800 font-extrabold shrink-0 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                                  PIC: {a.pic}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tombol Simpan & Terbitkan */}
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleSaveMinute}
                        className="w-full h-12 rounded-xl bg-[#023246] hover:bg-[#03445e] active:scale-[0.98] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md min-h-12 mt-4"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>
                          {isSaving
                            ? 'Menyimpan Notulen...'
                            : 'Simpan & Publikasikan untuk Seluruh Guru'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl p-8 border border-dashed border-slate-300 text-center space-y-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 mx-auto flex items-center justify-center">
                        <Sparkles className="w-7 h-7" />
                      </div>
                      <h4 className="text-sm font-black text-slate-900">
                        Pratinjau Hasil Restrukturisasi AI
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                        Setelah Anda mengetikkan catatan kasar dan mengklik tombol "✨ Rapikan dengan AI",
                        hasil risalah resmi akan otomatis tampil di sini dan siap dipublikasikan.
                      </p>
                      <div className="pt-2 flex flex-col gap-2 text-[11px] text-slate-400 text-left max-w-xs mx-auto">
                        <div className="flex items-center gap-2">
                          <CheckCheck className="w-3.5 h-3.5 text-teal-600" />
                          <span>Ekstraksi Ringkasan Eksekutif</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCheck className="w-3.5 h-3.5 text-teal-600" />
                          <span>Identifikasi Keputusan Resmi Sah</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCheck className="w-3.5 h-3.5 text-teal-600" />
                          <span>Pemetaan PIC &amp; Deadline Tugas</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER: MOBILE VIEW (KHUSUS GURU — INFINIX NOTE 8 STANDARD: MAX 480PX)
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="w-full max-w-120 mx-auto px-4 py-4 space-y-4 pb-28 text-[#023246] animate-fadeIn">
      {/* ── TOP NAV BAR (NON-POPUP FULL VIEW) ───────────────────────────── */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-xs flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (selectedMinuteId) {
              setSelectedMinuteId(null);
            } else {
              onBack();
            }
          }}
          className="inline-flex items-center gap-2 h-11 px-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 text-xs font-bold text-[#023246] transition-all cursor-pointer min-h-11"
        >
          <ArrowLeft className="w-4 h-4 text-[#023246]" />
          <span>{selectedMinuteId ? 'Daftar Notulen' : 'Kembali'}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncingCloud}
            title="Sinkronkan Cloud"
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 text-[#023246] transition-all cursor-pointer min-h-11 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 text-cyan-700 ${isSyncingCloud ? 'animate-spin' : ''}`} />
          </button>
          <div className="text-right">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Modul Resmi
            </span>
            <span className="text-xs font-black text-[#023246]">Notulen Rapat AI</span>
          </div>
        </div>
      </div>

      {/* ── HERO BANNER ─────────────────────────────────────────────────── */}
      <div className="bg-linear-to-br from-[#023246] via-[#18536B] to-[#023246] rounded-2xl p-4 text-white shadow-sm space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/15">
              <FileText className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black leading-tight">
                Notulen &amp; Risalah Rapat
              </h1>
              <p className="text-[11px] text-cyan-100/90 font-medium">
                Pencatatan cerdas &amp; arsip keputusan resmi seluruh dewan guru
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/20 text-[10px] font-extrabold text-cyan-200 shrink-0">
            ✨ AI Ready
          </span>
        </div>
      </div>

      {/* ── DETAIL VIEW MOBILE (JIKA MEMILIH SALAH SATU NOTULEN) ────────── */}
      {selectedMinuteId && activeMinute ? (
        <div className="space-y-4 animate-fadeIn">
          {/* Action Bar Detail */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2 flex-wrap">
            <span
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${
                MEETING_TYPE_LABELS[activeMinute.meetingType]?.badgeClass ||
                'bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              {MEETING_TYPE_LABELS[activeMinute.meetingType]?.icon}{' '}
              {MEETING_TYPE_LABELS[activeMinute.meetingType]?.label}
            </span>

            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => handleCopyText(activeMinute)}
                className="h-10 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer transition-all"
                title="Salin ke WhatsApp"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Salin</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="h-10 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer transition-all"
                title="Cetak Risalah"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Cetak</span>
              </button>

              {(currentUser?.role === 'ADMIN' ||
                currentUser?.role === 'KEPSEK' ||
                activeMinute.createdByUserId === currentUser?.id) && (
                <button
                  type="button"
                  onClick={() => handleDeleteMinute(activeMinute.id)}
                  className="h-10 w-10 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 border border-rose-200 text-rose-700 flex items-center justify-center cursor-pointer transition-all shrink-0"
                  title="Hapus Notulen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Kartu 1: Identitas Rapat */}
          <section className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
            <div>
              <span className="text-[10px] font-extrabold text-teal-800 uppercase tracking-wider block">
                Topik Risalah Rapat
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug mt-0.5">
                {activeMinute.title}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-xs">
              <div className="flex items-start gap-1.5 text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Tanggal</span>
                  <span className="font-bold text-slate-800">{activeMinute.date}</span>
                </div>
              </div>

              <div className="flex items-start gap-1.5 text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Waktu</span>
                  <span className="font-bold text-slate-800">
                    {activeMinute.startTime} - {activeMinute.endTime} WIB
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-1.5 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Lokasi</span>
                  <span className="font-bold text-slate-800">{activeMinute.location}</span>
                </div>
              </div>

              <div className="flex items-start gap-1.5 text-slate-600">
                <User className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Pimpinan</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {activeMinute.leaderName}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Notulis: <strong className="text-slate-700">{activeMinute.secretaryName}</strong>
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {activeMinute.attendeesSummary || 'Dewan Guru'}
              </span>
            </div>
          </section>

          {/* Kartu 2: Ringkasan Eksekutif */}
          <section className="bg-linear-to-br from-teal-50/70 via-white to-sky-50/50 rounded-2xl p-4 border border-teal-200/90 shadow-xs space-y-2">
            <div className="flex items-center gap-1.5 text-teal-900 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Ringkasan Eksekutif (AI Summary)</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
              {activeMinute.formattedContent.executiveSummary}
            </p>
          </section>

          {/* Kartu 3: Poin-Poin Pembahasan */}
          <section className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-2.5">
            <div className="flex items-center gap-1.5 text-slate-700 text-xs font-black uppercase tracking-wider">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Pokok Agenda &amp; Pembahasan</span>
            </div>
            <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700">
              {activeMinute.formattedContent.agendaPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-snug">{point}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Kartu 4: Keputusan Resmi Rapat */}
          <section className="bg-white rounded-2xl p-4 border-2 border-emerald-300/80 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-emerald-900 text-xs font-black uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Keputusan Resmi Rapat</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-black">
                {activeMinute.formattedContent.keyDecisions.length} Putusan
              </span>
            </div>

            <div className="space-y-2">
              {activeMinute.formattedContent.keyDecisions.map((decision, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200/70 flex items-start gap-2 text-xs sm:text-sm text-slate-800"
                >
                  <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                  <span className="font-semibold leading-snug">{decision}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Kartu 5: Action Items & PIC */}
          <section className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-slate-900 text-xs font-black uppercase tracking-wider">
                <ListTodo className="w-4 h-4 text-teal-700" />
                <span>Tindak Lanjut &amp; PIC</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Centang jika tugas selesai
              </span>
            </div>

            {activeMinute.formattedContent.actionItems.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                Tidak ada tugas tindak lanjut khusus untuk rapat ini.
              </p>
            ) : (
              <div className="space-y-2">
                {activeMinute.formattedContent.actionItems.map((item) => {
                  const isDone = item.status === 'COMPLETED';
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleAction(activeMinute.id, item.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                        isDone
                          ? 'bg-slate-50 border-slate-200 text-slate-500'
                          : 'bg-white border-amber-200 hover:border-amber-300 shadow-2xs text-slate-800'
                      }`}
                    >
                      <button
                        type="button"
                        className="mt-0.5 text-slate-400 hover:text-emerald-600 shrink-0"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Circle className="w-4 h-4 text-amber-500" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs sm:text-sm font-bold leading-snug ${
                            isDone ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {item.task}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                          <span className="px-1.5 py-0.2 rounded-md bg-teal-50 text-teal-800 border border-teal-200/80 font-bold">
                            PIC: {item.pic}
                          </span>
                          {item.deadline && (
                            <span className="text-slate-500">
                              Target: <strong className="text-slate-700">{item.deadline}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeMinute.formattedContent.additionalNotes && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1">
                <span className="font-bold text-slate-700 block">Catatan Tambahan:</span>
                <p>{activeMinute.formattedContent.additionalNotes}</p>
              </div>
            )}
          </section>

          {/* Kartu 6: Collapsible Catatan Asli / Mentah */}
          <section className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => setShowRawNotesInDetail(!showRawNotesInDetail)}
              className="w-full p-3.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span>Catatan Mentah Awal Notulis</span>
              {showRawNotesInDetail ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
            {showRawNotesInDetail && (
              <div className="p-3.5 bg-slate-50/80 border-t border-slate-100 text-xs text-slate-600 font-mono whitespace-pre-wrap leading-relaxed">
                {activeMinute.roughNotes}
              </div>
            )}
          </section>
        </div>
      ) : (
        /* ── DUA TAB UTAMA MOBILE: ARSIP RISALAH & CATAT RAPAT BARU ─────── */
        <div className="space-y-4">
          {/* Segmented Control Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-200/70 border border-slate-300/60 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('ARCHIVE')}
              className={`h-11 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-11 ${
                activeTab === 'ARCHIVE'
                  ? 'bg-white text-[#023246] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Arsip Risalah ({minutes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('RECORD')}
              className={`h-11 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-11 ${
                activeTab === 'RECORD'
                  ? 'bg-[#023246] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Catat Rapat Baru</span>
            </button>
          </div>

          {/* ═════════════════ TAB 1: ARSIP RISALAH MOBILE ═════════════════ */}
          {activeTab === 'ARCHIVE' && (
            <div className="space-y-3.5 animate-fadeIn">
              {/* Search Bar & Filter */}
              <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari topik rapat, pimpinan, atau notulis..."
                    className="w-full h-11 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedTypeFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                      selectedTypeFilter === 'ALL'
                        ? 'bg-[#023246] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua ({minutes.length})
                  </button>
                  {(Object.keys(MEETING_TYPE_LABELS) as MeetingType[]).map((typeKey) => {
                    const count = minutes.filter((m) => m.meetingType === typeKey).length;
                    if (count === 0 && selectedTypeFilter !== typeKey) return null;
                    return (
                      <button
                        key={typeKey}
                        type="button"
                        onClick={() => setSelectedTypeFilter(typeKey)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                          selectedTypeFilter === typeKey
                            ? 'bg-[#023246] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <span>{MEETING_TYPE_LABELS[typeKey].icon}</span>
                        <span>{MEETING_TYPE_LABELS[typeKey].label.replace('Rapat ', '')}</span>
                        <span className="text-[9px] opacity-80">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Daftar Kartu Notulen */}
              {filteredMinutes.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">Tidak Ada Notulen Ditemukan</h3>
                  <p className="text-xs text-slate-400">
                    Coba ubah kata kunci pencarian atau klik tab "Catat Rapat Baru" untuk membuat risalah.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMinutes.map((minute) => {
                    const isReadByCurrentUser =
                      Boolean(currentUser?.id) && Boolean(minute.readBy?.includes(currentUser!.id));
                    const typeMeta = MEETING_TYPE_LABELS[minute.meetingType];
                    const pendingTasks =
                      minute.formattedContent.actionItems?.filter(
                        (a) => a.status === 'PENDING'
                      ).length || 0;

                    return (
                      <div
                        key={minute.id}
                        onClick={() => setSelectedMinuteId(minute.id)}
                        className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:border-teal-400 transition-all cursor-pointer space-y-2.5 group active:scale-[0.99]"
                      >
                        {/* Header Kartu: Badge Tipe + Status Baca */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black border flex items-center gap-1 ${typeMeta.badgeClass}`}
                          >
                            <span>{typeMeta.icon}</span>
                            <span>{typeMeta.label}</span>
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!isReadByCurrentUser && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black animate-pulse">
                                Belum Dibaca
                              </span>
                            )}
                            <span className="text-[11px] font-mono text-slate-400">
                              {minute.date}
                            </span>
                          </div>
                        </div>

                        {/* Judul Notulen */}
                        <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-teal-900 transition-colors leading-snug line-clamp-2">
                          {minute.title}
                        </h3>

                        {/* Ringkasan Cuplikan */}
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {minute.formattedContent.executiveSummary}
                        </p>

                        {/* Footer Kartu: Pimpinan + Action Items Count */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1 text-slate-500 truncate">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{minute.leaderName}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {minute.formattedContent.actionItems.length > 0 && (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  pendingTasks > 0
                                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                {pendingTasks > 0 ? `${pendingTasks} Tindak Lanjut` : '✓ Selesai'}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMinute(minute.id, minute.title);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-90 transition-all cursor-pointer"
                              title="Hapus Notulen Ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[11px] font-bold text-teal-800 group-hover:translate-x-0.5 transition-transform">
                              Buka →
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═════════════════ TAB 2: CATAT RAPAT BARU MOBILE ═════════════════ */}
          {activeTab === 'RECORD' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Petunjuk & Tombol Template Contoh */}
              <div className="bg-amber-50/80 rounded-2xl p-3.5 border border-amber-200 flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2">
                  <span className="text-base mt-0.5">💡</span>
                  <div className="text-xs text-amber-950 space-y-0.5 leading-snug">
                    <p className="font-bold">Ketik Cepat &amp; Berantakan Tidak Masalah!</p>
                    <p className="text-amber-800">
                      Tulis poin-poin atau singkatan rapat apa adanya. AI kami otomatis merapikannya
                      menjadi risalah resmi dinas.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleInsertTemplate}
                  className="px-2.5 py-1 rounded-xl bg-amber-200 hover:bg-amber-300 active:scale-95 text-amber-900 text-[11px] font-black transition-all cursor-pointer shrink-0"
                >
                  Contoh Draf
                </button>
              </div>

              {/* Form Input Data Rapat */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3.5">
                <div>
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                    Judul / Topik Rapat <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Misal: Rapat Pleno Koordinasi KBM & Kurikulum"
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Kategori Rapat
                    </label>
                    <select
                      value={formMeetingType}
                      onChange={(e) => setFormMeetingType(e.target.value as MeetingType)}
                      className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                    >
                      {(Object.keys(MEETING_TYPE_LABELS) as MeetingType[]).map((typeKey) => (
                        <option key={typeKey} value={typeKey}>
                          {MEETING_TYPE_LABELS[typeKey].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Tanggal Pelaksanaan
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Jam Mulai
                    </label>
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Jam Selesai
                    </label>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Tempat / Ruang
                    </label>
                    <input
                      type="text"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="Misal: Ruang Rapat Utama"
                      className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Pimpinan Rapat
                    </label>
                    <input
                      type="text"
                      value={formLeaderName}
                      onChange={(e) => setFormLeaderName(e.target.value)}
                      placeholder="Nama Pimpinan"
                      className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Notulis
                    </label>
                    <input
                      type="text"
                      value={formSecretaryName}
                      onChange={(e) => setFormSecretaryName(e.target.value)}
                      placeholder="Nama Notulis"
                      className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Kehadiran
                    </label>
                    <input
                      type="text"
                      value={formAttendeesSummary}
                      onChange={(e) => setFormAttendeesSummary(e.target.value)}
                      placeholder="Misal: 28 Hadir"
                      className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                      Catatan Kasar Rapat <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-teal-800 font-extrabold">
                      ✨ AI siap bantu
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={formRoughNotes}
                    onChange={(e) => setFormRoughNotes(e.target.value)}
                    placeholder="Tuliskan catatan jalannya rapat di sini... Contoh:
- PTS mulai tanggal 5 okt
- Soal kumpul ke bu dewi maks tgl 29
- Pengawas wajib hadir jam 07.45
- Keputusan: siswa izin wajib konfirmasi H-1"
                    className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246] leading-relaxed resize-y"
                  />
                </div>

                {/* Tombol Ajaib: ✨ Rapikan dengan AI */}
                <button
                  type="button"
                  disabled={isProcessingAI || !formRoughNotes.trim()}
                  onClick={handleTriggerAI}
                  className={`w-full h-12 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md min-h-12 ${
                    isProcessingAI
                      ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                      : 'bg-linear-to-r from-teal-700 via-[#18536B] to-[#023246] hover:brightness-110 text-white active:scale-[0.98]'
                  }`}
                >
                  <Sparkles
                    className={`w-4 h-4 text-amber-300 ${isProcessingAI ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {isProcessingAI
                      ? 'AI Sedang Merapikan Risalah...'
                      : '✨ Rapikan dengan AI (Restrukturisasi Risalah)'}
                  </span>
                </button>
              </div>

              {/* Preview Hasil Restrukturisasi AI jika ada */}
              {previewFormatted && (
                <div className="bg-white rounded-2xl p-4 border-2 border-teal-300 shadow-sm space-y-3.5 animate-fadeIn">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-teal-900 text-xs font-black uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 text-teal-600" />
                      <span>Hasil Risalah Rapi &amp; Resmi</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                      {aiSource === 'AI_GROQ' ? 'Groq AI Model' : 'Penyusun Terstruktur'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200 text-xs text-slate-800 space-y-1">
                    <span className="font-extrabold text-teal-950 block">Ringkasan Eksekutif:</span>
                    <p className="leading-relaxed">{previewFormatted.executiveSummary}</p>
                  </div>

                  <div className="space-y-1 text-xs">
                    <span className="font-extrabold text-slate-800 block">Pokok Agenda:</span>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700">
                      {previewFormatted.agendaPoints.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1 text-xs">
                    <span className="font-extrabold text-emerald-900 block">Keputusan Resmi:</span>
                    <div className="space-y-1">
                      {previewFormatted.keyDecisions.map((k, i) => (
                        <div key={i} className="p-2 rounded-lg bg-emerald-50 text-emerald-950 font-semibold">
                          ✓ {k}
                        </div>
                      ))}
                    </div>
                  </div>

                  {previewFormatted.actionItems.length > 0 && (
                    <div className="space-y-1 text-xs">
                      <span className="font-extrabold text-slate-800 block">
                        Tindak Lanjut &amp; PIC ({previewFormatted.actionItems.length}):
                      </span>
                      <div className="space-y-1">
                        {previewFormatted.actionItems.map((a, i) => (
                          <div
                            key={i}
                            className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                          >
                            <span className="font-bold text-slate-800 truncate">{a.task}</span>
                            <span className="text-[10px] text-teal-800 font-extrabold shrink-0">
                              PIC: {a.pic}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tombol Simpan & Terbitkan */}
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveMinute}
                    className="w-full h-12 rounded-xl bg-[#023246] hover:bg-[#03445e] active:scale-[0.98] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md min-h-12"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      {isSaving
                        ? 'Menyimpan Notulen...'
                        : 'Simpan & Publikasikan untuk Seluruh Guru'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
