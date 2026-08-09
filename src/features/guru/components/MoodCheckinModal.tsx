import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
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
  selectedClass: string;
  quote: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  {
    type: 'VERY_HAPPY',
    emoji: '😊',
    label: 'Semangat',
    sublabel: 'Prima & Siap',
    selectedClass: 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/40 scale-105',
    quote: 'Energi positif Bapak/Ibu akan menginspirasi murid hari ini! 🌟',
  },
  {
    type: 'HAPPY',
    emoji: '🙂',
    label: 'Baik',
    sublabel: 'Stabil & Kondusif',
    selectedClass: 'bg-sky-600 text-white border-sky-700 shadow-md ring-2 ring-sky-400/40 scale-105',
    quote: 'Semoga hari mengajar berjalan lancar dan penuh berkah! ✨',
  },
  {
    type: 'NEUTRAL',
    emoji: '😐',
    label: 'Biasa',
    sublabel: 'Rutinitas Normal',
    selectedClass: 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400/40 scale-105',
    quote: 'Tetap tenang dan jalani hari dengan santai. Semangat! 👍',
  },
  {
    type: 'TIRED',
    emoji: '😟',
    label: 'Lelah',
    sublabel: 'Kurang Fit',
    selectedClass: 'bg-orange-600 text-white border-orange-700 shadow-md ring-2 ring-orange-400/40 scale-105',
    quote: 'Jangan lupa minum air dan beristirahat sejenak di sela KBM. ☕',
  },
  {
    type: 'STRESSED',
    emoji: '😫',
    label: 'Stres',
    sublabel: 'Perlu Istirahat',
    selectedClass: 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-400/40 scale-105',
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
      <div className="space-y-4 pt-1">
        {/* Header Note - High Contrast Light Pastel Banner */}
        <div className="bg-emerald-50/90 border border-emerald-200/80 p-3.5 rounded-2xl text-xs leading-relaxed flex items-start space-x-3 shadow-2xs">
          <span className="text-xl shrink-0">🌱</span>
          <div>
            <span className="font-extrabold text-[#0D7A5F] block mb-0.5 text-xs sm:text-sm">
              Kesejahteraan Anda Sangat Berharga
            </span>
            <p className="text-slate-700 font-medium text-xs">
              Bagaimana perasaan dan tingkat energi Bapak/Ibu Guru pagi ini? Respon Anda dijaga kerahasiaannya untuk evaluasi kenyamanan kerja sekolah.
            </p>
          </div>
        </div>

        {/* Emoji Selector Grid - Crisp Modern Cards */}
        <div className="grid grid-cols-5 gap-2 pt-1">
          {MOOD_OPTIONS.map((option) => {
            const isSelected = selectedMood === option.type;
            return (
              <button
                key={option.type}
                type="button"
                onClick={() => setSelectedMood(option.type)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 cursor-pointer text-center relative ${
                  isSelected
                    ? option.selectedClass
                    : 'bg-slate-50 border-slate-200/90 text-slate-800 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <span className="text-3xl mb-1 transition-transform duration-200 transform group-hover:scale-110">
                  {option.emoji}
                </span>
                <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Quote Banner */}
        {currentOption && (
          <div className="text-center py-2.5 px-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-xs italic font-extrabold text-amber-900 shadow-2xs">
            "{currentOption.quote}"
          </div>
        )}

        {/* Optional Tag Selector */}
        <div className="space-y-2 pt-1">
          <label className="text-xs font-extrabold text-slate-800 block">
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
                  className={`px-3 py-1.5 text-xs rounded-xl border transition-all cursor-pointer ${
                    isTagSelected
                      ? 'bg-[#0D7A5F] text-white border-[#0D7A5F] font-extrabold shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200/90 font-semibold'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
          >
            Nanti Saja
          </button>
          <button
            type="button"
            onClick={handleSaveMood}
            disabled={isSubmitting}
            className="px-5 py-2 bg-[#0D7A5F] hover:bg-[#095744] text-white font-black text-xs rounded-xl border border-[#0D7A5F] shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <span>Simpan Mood ✨</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
