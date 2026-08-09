import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import type { TeacherMoodType } from '../../../types/database.types';
import { ProviderFactory } from '../../../providers/provider-factory';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { getTodayDateInJakarta } from '../../../utils/time.utils';
import { logger } from '../../../utils/logger.utils';

export interface MoodCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (mood: TeacherMoodType) => void;
}

interface MoodOption {
  type: TeacherMoodType;
  emoji: string;
  label: string;
  sublabel: string;
  colorClass: string;
  bgSelectedClass: string;
  borderSelectedClass: string;
  quote: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  {
    type: 'VERY_HAPPY',
    emoji: '😊',
    label: 'Semangat',
    sublabel: 'Prima & Siap Mengajar',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgSelectedClass: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderSelectedClass: 'border-emerald-500 ring-2 ring-emerald-500/20',
    quote: 'Energi positif Bapak/Ibu akan menginspirasi murid hari ini! 🌟',
  },
  {
    type: 'HAPPY',
    emoji: '🙂',
    label: 'Baik',
    sublabel: 'Stabil & Kondusif',
    colorClass: 'text-sky-600 dark:text-sky-400',
    bgSelectedClass: 'bg-sky-50 dark:bg-sky-950/40',
    borderSelectedClass: 'border-sky-500 ring-2 ring-sky-500/20',
    quote: 'Semoga hari mengajar berjalan lancar dan penuh berkah! ✨',
  },
  {
    type: 'NEUTRAL',
    emoji: '😐',
    label: 'Biasa',
    sublabel: 'Rutinitas Normal',
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgSelectedClass: 'bg-amber-50 dark:bg-amber-950/40',
    borderSelectedClass: 'border-amber-500 ring-2 ring-amber-500/20',
    quote: 'Tetap tenang dan jalani hari dengan santai. Semangat! 👍',
  },
  {
    type: 'TIRED',
    emoji: '😟',
    label: 'Lelah',
    sublabel: 'Cukup Berat / Kurang Fit',
    colorClass: 'text-orange-600 dark:text-orange-400',
    bgSelectedClass: 'bg-orange-50 dark:bg-orange-950/40',
    borderSelectedClass: 'border-orange-500 ring-2 ring-orange-500/20',
    quote: 'Jangan lupa minum air dan beristirahat sejenak di sela KBM. ☕',
  },
  {
    type: 'STRESSED',
    emoji: '😫',
    label: 'Stres',
    sublabel: 'Beban Padat / Perlu Istirahat',
    colorClass: 'text-rose-600 dark:text-rose-400',
    bgSelectedClass: 'bg-rose-50 dark:bg-rose-950/40',
    borderSelectedClass: 'border-rose-500 ring-2 ring-rose-500/20',
    quote: 'Kesehatan Anda adalah yang utama. Terima kasih sudah terus berjuang! ❤️',
  },
];

const TAG_OPTIONS = [
  'Beban KBM / JTM Padat',
  'Kesehatan Kurang Fit',
  'Kondisi Kelas & Siswa',
  'Urusan Admin / Berkas',
  'Urusan Pribadi',
];

export const MoodCheckinModal: React.FC<MoodCheckinModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [selectedMood, setSelectedMood] = useState<TeacherMoodType | null>('VERY_HAPPY');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, token } = useAuthStore();
  const { showToast } = useToastStore();

  const handleSaveMood = async () => {
    if (!selectedMood) {
      showToast('warning', 'Pilih Mood', 'Pilih perasaan Anda hari ini terlebih dahulu.');
      return;
    }

    if (!user) {
      showToast('error', 'Sesi Tidak Valid', 'Sesi pengguna tidak ditemukan.');
      return;
    }

    setIsSubmitting(true);
    const todayStr = getTodayDateInJakarta();

    try {
      const provider = ProviderFactory.getProvider();
      await provider.saveTeacherMood(
        user.id,
        todayStr,
        selectedMood,
        selectedTag || undefined,
        token || undefined
      );

      const chosenOption = MOOD_OPTIONS.find((m) => m.type === selectedMood);
      showToast(
        'success',
        'Mood Check-in Tersimpan! ✨',
        chosenOption ? chosenOption.quote : 'Mood berhasil disimpan! Terima kasih.'
      );

      logger.info('MoodCheckinModal', 'Teacher mood saved successfully', { mood: selectedMood });

      if (onSaved) {
        onSaved(selectedMood);
      }
      onClose();
    } catch (err: unknown) {
      logger.error('MoodCheckinModal', 'Failed to save mood:', err);
      showToast('error', 'Gagal Menyimpan Mood', 'Gagal menyimpan catatan mood. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentOption = MOOD_OPTIONS.find((m) => m.type === selectedMood);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💚 Mood Check-in Harian Guru">
      <div className="space-y-5">
        {/* Header Note */}
        <div className="bg-linear-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-3.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex items-start space-x-2.5">
          <span className="text-base shrink-0">🌱</span>
          <div>
            <span className="font-semibold text-emerald-800 dark:text-emerald-300 block mb-0.5">
              Kesejahteraan Anda Sangat Berharga
            </span>
            Bagaimana perasaan dan tingkat energi Bapak/Ibu Guru pagi ini? Respon Anda dijaga kerahasiaannya untuk evaluasi kenyamanan kerja sekolah.
          </div>
        </div>

        {/* Emoji Selector Grid */}
        <div className="grid grid-cols-5 gap-2">
          {MOOD_OPTIONS.map((option) => {
            const isSelected = selectedMood === option.type;
            return (
              <button
                key={option.type}
                type="button"
                onClick={() => setSelectedMood(option.type)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 cursor-pointer text-center relative ${
                  isSelected
                    ? `${option.bgSelectedClass} ${option.borderSelectedClass} shadow-md scale-105`
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 opacity-80 hover:opacity-100'
                }`}
              >
                <span className="text-3xl mb-1.5 transition-transform duration-200 transform group-hover:scale-110">
                  {option.emoji}
                </span>
                <span className={`text-xs font-semibold ${option.colorClass}`}>
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Quote Banner */}
        {currentOption && (
          <div className="text-center py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs italic text-slate-600 dark:text-slate-400">
            "{currentOption.quote}"
          </div>
        )}

        {/* Optional Tag Selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">
            Catatan Ringkas / Faktor Utama (Opsional):
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TAG_OPTIONS.map((tag) => {
              const isTagSelected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(isTagSelected ? '' : tag)}
                  className={`px-2.5 py-1 text-[11px] rounded-lg border transition-colors ${
                    isTagSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 font-medium'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
            Nanti Saja
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveMood}
            isLoading={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Simpan Mood ✨
          </Button>
        </div>
      </div>
    </Modal>
  );
};
