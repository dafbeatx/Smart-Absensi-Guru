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
}

export const MeetingMinutesView: React.FC<MeetingMinutesViewProps> = ({
  currentUser,
  onBack,
  initialMinuteId,
}) => {
  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<'ARCHIVE' | 'RECORD'>('ARCHIVE');
  const [minutes, setMinutes] = useState<MeetingMinute[]>(() =>
    MeetingMinutesRepository.getAllMinutes()
  );
  const [selectedMinuteId, setSelectedMinuteId] = useState<string | null>(initialMinuteId || null);

  // Search & Filters for Archive
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | MeetingType>('ALL');

  // Form State for Recording New Minute
  const [formTitle, setFormTitle] = useState('');
  const [formMeetingType, setFormMeetingType] = useState<MeetingType>('DEWAN_GURU');
  const [formDate, setFormDate] = useState(() => getTodayDateInJakarta());
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('11:00');
  const [formLocation, setFormLocation] = useState('Ruang Rapat / Ruang Guru');
  const [formLeaderName, setFormLeaderName] = useState('Kepala Sekolah');
  const [formSecretaryName, setFormSecretaryName] = useState(() => currentUser?.full_name || 'Notulis');
  const [formAttendeesSummary, setFormAttendeesSummary] = useState('Seluruh Dewan Guru & Staf');
  const [formRoughNotes, setFormRoughNotes] = useState('');

  // AI Processing State
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiSource, setAiSource] = useState<'AI_GROQ' | 'LOCAL_RULE_PARSER' | null>(null);
  const [previewFormatted, setPreviewFormatted] = useState<MeetingFormattedContent | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Detail View UI toggles
  const [showRawNotesInDetail, setShowRawNotesInDetail] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Sync state with storage events
  const refreshMinutes = useCallback(() => {
    setMinutes(MeetingMinutesRepository.getAllMinutes());
  }, []);

  useEffect(() => {
    refreshMinutes();
    window.addEventListener(MEETING_MINUTES_UPDATED_EVENT, refreshMinutes);
    window.addEventListener('storage', refreshMinutes);
    return () => {
      window.removeEventListener(MEETING_MINUTES_UPDATED_EVENT, refreshMinutes);
      window.removeEventListener('storage', refreshMinutes);
    };
  }, [refreshMinutes]);

  // Selected minute data
  const activeMinute = useMemo(() => {
    if (!selectedMinuteId) return null;
    return minutes.find((m) => m.id === selectedMinuteId) || null;
  }, [selectedMinuteId, minutes]);

  // Auto-mark as read when opened
  useEffect(() => {
    if (activeMinute && currentUser?.id) {
      if (!activeMinute.readBy || !activeMinute.readBy.includes(currentUser.id)) {
        MeetingMinutesRepository.markAsRead(activeMinute.id, currentUser.id);
      }
    }
  }, [activeMinute, currentUser?.id]);

  // Filtered Archive
  const filteredMinutes = useMemo(() => {
    return minutes.filter((m) => {
      if (selectedTypeFilter !== 'ALL' && m.meetingType !== selectedTypeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchLeader = m.leaderName.toLowerCase().includes(q);
        const matchSecretary = m.secretaryName.toLowerCase().includes(q);
        const matchSummary = m.formattedContent.executiveSummary.toLowerCase().includes(q);
        if (!matchTitle && !matchLeader && !matchSecretary && !matchSummary) {
          return false;
        }
      }
      return true;
    });
  }, [minutes, selectedTypeFilter, searchQuery]);

  // Handle AI Restructuring Trigger
  const handleTriggerAI = async () => {
    if (!formRoughNotes.trim()) {
      showToast('error', 'Catatan Kosong', 'Ketikkan catatan rapat terlebih dahulu sebelum merapikan.');
      return;
    }

    setIsProcessingAI(true);
    try {
      const result = await MeetingMinutesAIService.restructureNotes({
        title: formTitle || 'Rapat Koordinasi Sekolah',
        roughNotes: formRoughNotes,
        meetingType: MEETING_TYPE_LABELS[formMeetingType].label,
        leaderName: formLeaderName,
        secretaryName: formSecretaryName,
        date: formDate,
      });

      setPreviewFormatted(result.formattedContent);
      setAiSource(result.source);
      showToast(
        'success',
        result.source === 'AI_GROQ' ? 'AI Selesai Merapikan' : 'Risalah Terstruktur',
        result.source === 'AI_GROQ'
          ? 'Catatan berhasil dirapikan dengan AI menjadi risalah resmi.'
          : 'Catatan berhasil distrukturisasi ke format resmi dewan guru.'
      );
    } catch (err) {
      console.warn('AI format error:', err);
      // Fallback
      const fallback = MeetingMinutesAIService.parseRoughNotesDeterministic({
        title: formTitle || 'Rapat Koordinasi Sekolah',
        roughNotes: formRoughNotes,
        leaderName: formLeaderName,
      });
      setPreviewFormatted(fallback);
      setAiSource('LOCAL_RULE_PARSER');
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Insert Quick Demo Template for convenience
  const handleInsertTemplate = () => {
    setFormTitle('Rapat Evaluasi Disiplin & Pelaksanaan KBM Semester Ganjil');
    setFormMeetingType('DEWAN_GURU');
    setFormRoughNotes(`- Rapat dipimpin langsung oleh Kepala Sekolah mulai jam 09.00
- Bahas ketepatan waktu presensi guru yang masih ada toleransi keterlambatan
- Jam pulang guru hari jumat disepakati mulai 11.30 WIB
- Evaluasi perangkat ajar modul KBM harus lengkap diupload
- Tugas: pengumpulan modul ajar batas akhir tanggal 30 September pic Bu Fatimah
- Tugas: rekapitulasi absensi siswa pic Pak Hendra target 3 hari kedepan
- Putusan: guru piket wajib stand by di gerbang sekolah jam 06.45 WIB
- Putusan: siswa yang terlambat lebih dari 3x diberi pembinaan wali kelas`);
  };

  // Save new minute
  const handleSaveMinute = async () => {
    if (!formTitle.trim()) {
      showToast('error', 'Judul Wajib Diisi', 'Masukkan judul atau topik rapat terlebih dahulu.');
      return;
    }
    if (!formRoughNotes.trim()) {
      showToast('error', 'Catatan Masih Kosong', 'Tuliskan catatan poin rapat sebelum menyimpan.');
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
  const handleDeleteMinute = (minuteId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus notulen rapat ini?')) {
      MeetingMinutesRepository.deleteMinute(minuteId);
      setSelectedMinuteId(null);
      showToast('info', 'Notulen Dihapus', 'Notulen rapat telah dihapus dari arsip.');
    }
  };

  return (
    <div className="w-full max-w-[480px] mx-auto px-4 py-4 space-y-4 pb-28 text-[#023246] animate-fadeIn">
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
          className="inline-flex items-center gap-2 h-11 px-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 text-xs font-bold text-[#023246] transition-all cursor-pointer min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4 text-[#023246]" />
          <span>{selectedMinuteId ? 'Daftar Notulen' : 'Kembali'}</span>
        </button>

        <div className="text-right">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
            Modul Resmi
          </span>
          <span className="text-xs font-black text-[#023246]">Notulen Rapat AI</span>
        </div>
      </div>

      {/* ── HERO BANNER ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#023246] via-[#18536B] to-[#023246] rounded-2xl p-4 text-white shadow-sm space-y-2">
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

      {/* ── DETAIL VIEW (JIKA MEMILIH SALAH SATU NOTULEN) ───────────────── */}
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
          <section className="bg-gradient-to-br from-teal-50/70 via-white to-sky-50/50 rounded-2xl p-4 border border-teal-200/90 shadow-xs space-y-2">
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
        /* ── DUA TAB UTAMA: ARSIP RISALAH & CATAT RAPAT BARU ────────────── */
        <div className="space-y-4">
          {/* Segmented Control Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-200/70 border border-slate-300/60 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('ARCHIVE')}
              className={`h-11 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] ${
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
              className={`h-11 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] ${
                activeTab === 'RECORD'
                  ? 'bg-[#023246] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Catat Rapat Baru</span>
            </button>
          </div>

          {/* ═════════════════ TAB 1: ARSIP RISALAH ═════════════════ */}
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
                    className="w-full h-11 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#023246]"
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

          {/* ═════════════════ TAB 2: CATAT RAPAT BARU ═════════════════ */}
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
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-amber-100 active:scale-95 border border-amber-300 text-[10px] font-black text-amber-900 shrink-0 cursor-pointer transition-all"
                >
                  Contoh Cepat
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
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#023246]"
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
                      Tempat Rapat
                    </label>
                    <input
                      type="text"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="Ruang Guru / Lab"
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
                      placeholder="Kepala Sekolah / Wakasek"
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
                      Kehadiran Peserta
                    </label>
                    <input
                      type="text"
                      value={formAttendeesSummary}
                      onChange={(e) => setFormAttendeesSummary(e.target.value)}
                      placeholder="Misal: Seluruh Dewan Guru"
                      className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                    />
                  </div>
                </div>

                {/* Kolom Catatan Mentah Berantakan */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Catatan Mentah / Poin Rapat <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {formRoughNotes.length} karakter
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
                    className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#023246] leading-relaxed resize-y"
                  />
                </div>

                {/* Tombol Ajaib: ✨ Rapikan dengan AI */}
                <button
                  type="button"
                  disabled={isProcessingAI || !formRoughNotes.trim()}
                  onClick={handleTriggerAI}
                  className={`w-full h-12 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md min-h-[48px] ${
                    isProcessingAI
                      ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-teal-700 via-[#18536B] to-[#023246] hover:brightness-110 text-white active:scale-[0.98]'
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
                    className="w-full h-12 rounded-xl bg-[#023246] hover:bg-[#03445e] active:scale-[0.98] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md min-h-[48px]"
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
