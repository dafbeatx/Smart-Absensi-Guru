import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import {
  SagaMoodFaceIcon,
  SagaSeedlingCareIcon,
} from '../../../components/ui/SagaServiceIcons';
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
  label: string;
  sublabel: string;
  selectedClass: string;
  quote: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  {
    type: 'VERY_HAPPY',
    label: 'Semangat',
    sublabel: 'Prima & Siap',
    selectedClass: 'bg-[#0D5C46] text-white border-[#094736] shadow-sm',
    quote: 'Energi positif Bapak/Ibu akan menginspirasi murid hari ini.',
  },
  {
    type: 'HAPPY',
    label: 'Baik',
    sublabel: 'Stabil & Kondusif',
    selectedClass: 'bg-[#0D5C46] text-white border-[#094736] shadow-sm',
    quote: 'Semoga hari mengajar berjalan lancar dan penuh berkah.',
  },
  {
    type: 'NEUTRAL',
    label: 'Biasa',
    sublabel: 'Rutinitas Normal',
    selectedClass: 'bg-[#0D5C46] text-white border-[#094736] shadow-sm',
    quote: 'Tetap tenang dan jalani hari dengan santai. Semangat selalu.',
  },
  {
    type: 'TIRED',
    label: 'Lelah',
    sublabel: 'Kurang Fit',
    selectedClass: 'bg-[#0D5C46] text-white border-[#094736] shadow-sm',
    quote: 'Jangan lupa minum air dan beristirahat sejenak di sela KBM.',
  },
  {
    type: 'STRESSED',
    label: 'Stres',
    sublabel: 'Perlu Istirahat',
    selectedClass: 'bg-[#0D5C46] text-white border-[#094736] shadow-sm',
    quote: 'Kesehatan Anda adalah yang utama. Terima kasih sudah terus berjuang.',
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

      // Award +5 Engagement Points for Daily Quest
      try {
        await provider.recordTeacherPoint(
          {
            user_id: user.id,
            teacher_name: user.full_name,
            date: todayStr,
            points: 5,
            activity_type: 'MOOD_CHECKIN',
            title: 'Misi Refleksi: Jurnal Mood Harian',
            description: 'Refleksi suasana hati dan kesiapan mengajar (+5 Poin)',
          },
          token || undefined
        );
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`smart_absensi_quest_mood_${user.id}_${todayStr}`, '1');
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('smart_absensi_points_updated'));
        }
      } catch (ptErr) {
        console.warn('Mood check-in point award note:', ptErr);
      }

      showToast(
        'success',
        'Mood Check-in Tersimpan (+5 Poin)',
        chosenOption ? `${chosenOption.quote} Anda memperoleh +5 Poin Kedisiplinan & Keterlibatan.` : 'Mood berhasil disimpan. Anda memperoleh +5 Poin.'
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
    <Modal isOpen={isOpen} onClose={onClose} title="Mood Check-in Harian Guru" mobileFullscreen>
      <div className="flex flex-col justify-between min-h-full gap-4 pt-1">
        <div className="space-y-4">
          {/* Header Note */}
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-xs leading-relaxed flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
              <SagaSeedlingCareIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-[#0D5C46] block mb-0.5 text-sm">
                Kesejahteraan Anda Sangat Berharga
              </span>
              <p className="text-slate-700 font-normal text-sm leading-snug">
                Bagaimana perasaan dan tingkat energi Bapak/Ibu Guru pagi ini? Respon Anda dijaga kerahasiaannya untuk evaluasi kenyamanan kerja sekolah.
              </p>
            </div>
          </div>

          {/* Vector Doodle Mood Selector Grid */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 pt-1">
            {MOOD_OPTIONS.map((option) => {
              const isSelected = selectedMood === option.type;
              return (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => setSelectedMood(option.type)}
                  className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-2xl border transition-colors cursor-pointer text-center min-h-19 ${
                    isSelected
                      ? option.selectedClass
                      : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span className="mb-1.5">
                    <SagaMoodFaceIcon
                      mood={option.type}
                      tone={isSelected ? 'dark' : 'light'}
                      className="w-8 h-8"
                    />
                  </span>
                  <span className={`text-xs font-bold leading-tight ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Quote Banner */}
          {currentOption && (
            <div className="text-center py-3 px-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm font-semibold text-amber-950">
              &ldquo;{currentOption.quote}&rdquo;
            </div>
          )}

          {/* Optional Tag Selector */}
          <div className="space-y-2 pt-1">
            <label className="text-sm font-bold text-slate-800 block">
              Catatan Ringkas / Faktor Utama (Opsional):
            </label>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => {
                const isTagSelected = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(isTagSelected ? '' : tag)}
                    className={`px-3.5 py-2 text-xs rounded-xl border transition-colors cursor-pointer min-h-11 ${
                      isTagSelected
                        ? 'bg-[#0D5C46] text-white border-[#094736] font-bold'
                        : 'bg-[#F8FAFC] hover:bg-slate-100 text-slate-800 border-slate-200 font-semibold'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sticky Action Buttons */}
        <div className="sticky bottom-0 bg-white flex items-center justify-end gap-2.5 pt-3 pb-[max(4px,env(safe-area-inset-bottom))] border-t border-slate-100 z-10">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 sm:flex-none px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm rounded-xl border border-slate-200 transition-colors cursor-pointer min-h-12"
          >
            Nanti Saja
          </button>
          <button
            type="button"
            onClick={handleSaveMood}
            disabled={isSubmitting}
            className="flex-2 sm:flex-none px-6 py-3 bg-[#0D5C46] hover:bg-[#094736] text-white font-bold text-sm rounded-xl border border-[#094736] shadow-sm transition-colors active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5 min-h-12"
          >
            <span>Simpan Mood</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
