import React, { useState, useEffect } from 'react';
import type { TeacherLeaderboardItem } from '../../../utils/teacher-appreciation.utils';
import { GroqAIService } from '../../../services/groq-ai.service';
import { useToastStore } from '../../../store/useToastStore';
import {
  Sparkles,
  Trophy,
  CheckCircle2,
  X,
  Send,
  RotateCcw,
  Award,
} from 'lucide-react';

interface KepsekRewardSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  championTeacher: TeacherLeaderboardItem | null;
  periodMonthYear?: string;
  onRewardSaved?: (rewardText: string) => void;
}

export const KepsekRewardSuggestionModal: React.FC<KepsekRewardSuggestionModalProps> = ({
  isOpen,
  onClose,
  championTeacher,
  periodMonthYear = 'September 2026',
  onRewardSaved,
}) => {
  const { showToast } = useToastStore();
  const [rewardInput, setRewardInput] = useState('');
  const [originalDraft, setOriginalDraft] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [savedReward, setSavedReward] = useState<string | null>(null);

  const storageKey = `smart_absensi_kepsek_reward_champion_${periodMonthYear.replace(/\s+/g, '_')}`;

  // Muat hadiah yang telah disimpan sebelumnya jika ada
  useEffect(() => {
    if (!isOpen) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.rewardText) {
          setSavedReward(parsed.rewardText);
          setRewardInput(parsed.rewardText);
        }
      }
    } catch {
      // Ignored
    }
  }, [isOpen, storageKey]);

  if (!isOpen || !championTeacher) return null;

  const handleRefineWithAI = async () => {
    if (!rewardInput.trim()) {
      showToast('warning', 'Teks Masih Kosong', 'Silakan ketik usulan hadiah terlebih dahulu sebelum disempurnakan AI.');
      return;
    }

    setIsRefining(true);
    setOriginalDraft(rewardInput);
    try {
      const result = await GroqAIService.refinePrincipalRewardProposal({
        rawRewardText: rewardInput,
        teacherName: championTeacher.name,
        totalPoints: championTeacher.totalPoints,
        monthName: periodMonthYear,
      });

      if (result.polishedText) {
        setAiSuggestion(result.polishedText);
        showToast('success', 'Kalimat Disempurnakan!', 'AI telah merapikan ejaan dan tata bahasa resmi apresiasi.');
      }
    } catch {
      showToast('error', 'Gagal Memproses AI', 'Terjadi kendala saat menyempurnakan teks dengan AI.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleApplyAISuggestion = () => {
    if (aiSuggestion) {
      setRewardInput(aiSuggestion);
      setAiSuggestion('');
      showToast('info', 'Saran Diterapkan', 'Kalimat AI telah dipasang ke kolom hadiah.');
    }
  };

  const handleRevertDraft = () => {
    if (originalDraft) {
      setRewardInput(originalDraft);
      setAiSuggestion('');
    }
  };

  const handleSaveReward = () => {
    const trimmed = rewardInput.trim();
    if (!trimmed) {
      showToast('warning', 'Harap Isi Hadiah', 'Tentukan hadiah untuk guru Juara 1 bulan ini.');
      return;
    }

    const payload = {
      teacherId: championTeacher.id,
      teacherName: championTeacher.name,
      rewardText: trimmed,
      totalPoints: championTeacher.totalPoints,
      period: periodMonthYear,
      decidedAt: new Date().toISOString(),
    };

    localStorage.setItem(storageKey, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('smart_absensi_kepsek_reward_updated', { detail: payload }));

    setSavedReward(trimmed);
    if (onRewardSaved) {
      onRewardSaved(trimmed);
    }

    showToast('success', 'Hadiah Resmi Ditetapkan! 🎁', `Apresiasi untuk ${championTeacher.name} telah disimpan dan diumumkan.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border-2 border-amber-300 z-10 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header Ribbon */}
        <div className="p-4 bg-linear-to-r from-[#023246] via-[#0A4158] to-[#18536B] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-xl shrink-0">
              🎁
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 block">
                Hak Prerogatif Kepala Sekolah
              </span>
              <h3 className="text-xs sm:text-sm font-black text-white truncate leading-tight">
                Penetapan Hadiah Juara 1 Disiplin Bulan Ini
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 grow">
          {/* Champion Teacher Profile Card */}
          <div className="p-3.5 rounded-2xl bg-linear-to-br from-amber-500/10 via-amber-50 to-orange-50/50 border border-amber-200/90 flex items-center gap-3.5">
            <div className="relative w-12 h-12 rounded-2xl bg-white border-2 border-amber-400 flex items-center justify-center text-2xl shadow-xs shrink-0">
              <span>🥇</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-md">
                  Poin Terbanyak (#{championTeacher.rank})
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  {periodMonthYear}
                </span>
              </div>
              <h4 className="text-sm font-black text-slate-900 truncate mt-0.5">
                {championTeacher.name}
              </h4>
              <p className="text-xs text-slate-600 font-medium">
                {championTeacher.position || 'Pendidik'} •{' '}
                <strong className="text-emerald-700 font-extrabold">
                  {championTeacher.totalPoints} PTS
                </strong>
              </p>
            </div>
          </div>

          {/* Pengantar untuk Kepala Sekolah */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed space-y-1">
            <p className="font-semibold text-slate-800">
              Bapak Farhan Sopian Sahid, S.Pd.I (Kepala Sekolah),
            </p>
            <p>
              Sistem telah menyiapkan <strong>Piagam Penghargaan Resmi</strong> untuk Juara 1, 2, dan 3. Khusus untuk <strong>Juara 1</strong>, silakan Bapak ketikkan hadiah apresiasi yang ingin diberikan. Jika kalimat kurang pas atau ada salah ketik, <strong>AI akan menyempurnakannya secara otomatis</strong>.
            </p>
          </div>

          {/* Form Input Hadiah */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="reward-input" className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-600" />
                <span>Ketik Hadiah / Apresiasi dari Kepala Sekolah:</span>
              </label>
              {originalDraft && (
                <button
                  type="button"
                  onClick={handleRevertDraft}
                  className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-bold"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Kembalikan Teks Awal</span>
                </button>
              )}
            </div>

            <textarea
              id="reward-input"
              rows={3}
              value={rewardInput}
              onChange={(e) => setRewardInput(e.target.value)}
              placeholder="Contoh: Voucher blanja 300rb dan parcel buah segar..."
              className="w-full p-3 rounded-2xl border border-slate-300 focus:border-[#18536B] focus:ring-2 focus:ring-[#18536B]/20 text-xs sm:text-sm font-medium text-slate-800 bg-white shadow-inner resize-none transition-all placeholder:text-slate-400"
            />

            {/* Tombol AI Refinement */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10.5px] text-slate-400">
                AI akan memperbaiki typo dan merapikan susunan kalimat resmi.
              </span>

              <button
                type="button"
                onClick={handleRefineWithAI}
                disabled={isRefining || !rewardInput.trim()}
                className="px-3.5 py-2 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isRefining ? 'animate-spin' : ''}`} />
                <span>{isRefining ? 'AI Memperbaiki...' : 'Sempurnakan dengan AI ✨'}</span>
              </button>
            </div>
          </div>

          {/* AI Suggestion Box (Muncul setelah AI selesai memperbaiki) */}
          {aiSuggestion && (
            <div className="p-3.5 rounded-2xl bg-linear-to-br from-purple-50 via-indigo-50 to-blue-50 border-2 border-indigo-300/80 shadow-xs space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Hasil Perbaikan Kalimat oleh AI:</span>
                </span>
                <span className="text-[10px] font-extrabold bg-indigo-200/80 text-indigo-900 px-2 py-0.5 rounded-md">
                  Typo Diperbaiki ✓
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/90 border border-indigo-200 text-xs text-slate-800 leading-relaxed font-medium">
                &ldquo;{aiSuggestion}&rdquo;
              </div>

              <div className="flex items-center justify-end gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setAiSuggestion('')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  Abaikan
                </button>
                <button
                  type="button"
                  onClick={handleApplyAISuggestion}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Terapkan Kalimat AI Ini</span>
                </button>
              </div>
            </div>
          )}

          {/* Status Hadiah yang Sedang Aktif / Tersimpan */}
          {savedReward && !aiSuggestion && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
              <Award className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block">Hadiah Aktif Terpilih:</strong>
                <p className="mt-0.5">{savedReward}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 rounded-2xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all cursor-pointer"
          >
            Nanti Saja
          </button>

          <button
            type="button"
            onClick={handleSaveReward}
            className="h-11 px-5 rounded-2xl bg-[#023246] hover:bg-[#034560] active:scale-95 text-white font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Send className="w-3.5 h-3.5 text-amber-300" />
            <span>Tetapkan &amp; Simpan Hadiah Resmi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
