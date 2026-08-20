import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { ComplaintRepository } from '../../../repositories/ComplaintRepository';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { logger } from '../../../utils/logger.utils';
import type { ComplaintCategory } from '../../../types/database.types';

export interface AnonymousComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CATEGORIES: {
  type: ComplaintCategory;
  emoji: string;
  label: string;
  sublabel: string;
  badgeColor: string;
}[] = [
  {
    type: 'SARANA_PRASARANA',
    emoji: '🏢',
    label: 'Sarana & Fasilitas',
    sublabel: 'AC, Proyektor, Kebersihan, Toilet, Listrik',
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  {
    type: 'SISTEM_APLIKASI',
    emoji: '📱',
    label: 'Sistem & Aplikasi',
    sublabel: 'Aplikasi Absensi, GPS, Barcode, Error',
    badgeColor: 'text-sky-700 bg-sky-50 border-sky-200',
  },
  {
    type: 'KEBIJAKAN_MANAJEMEN',
    emoji: '📋',
    label: 'Kebijakan & Jadwal',
    sublabel: 'Jadwal Mengajar, Beban Kerja, Rapat Dinas',
    badgeColor: 'text-purple-700 bg-purple-50 border-purple-200',
  },
  {
    type: 'KESEJAHTERAAN',
    emoji: '🌱',
    label: 'Kesejahteraan Guru',
    sublabel: 'Kenyamanan Kerja & Lingkungan Sekolah',
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  },
  {
    type: 'LAINNYA',
    emoji: '💡',
    label: 'Aspirasi Lainnya',
    sublabel: 'Ide Inovasi & Masukan Konstruktif',
    badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  },
];

const QUICK_TOPICS = [
  { label: '🏢 Proyektor / AC Kelas', cat: 'SARANA_PRASARANA' as ComplaintCategory, prefix: 'Laporan kerusakan fasilitas: ' },
  { label: '📱 Kendala Scanner QR / GPS', cat: 'SISTEM_APLIKASI' as ComplaintCategory, prefix: 'Kendala saat melakukan absensi: ' },
  { label: '📋 Usulan Jadwal / Rapat', cat: 'KEBIJAKAN_MANAJEMEN' as ComplaintCategory, prefix: 'Usulan penyesuaian jadwal: ' },
  { label: '💡 Ide Inovasi Sekolah', cat: 'LAINNYA' as ComplaintCategory, prefix: 'Aspirasi ide untuk kemajuan sekolah: ' },
];

export const AnonymousComplaintModal: React.FC<AnonymousComplaintModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ComplaintCategory>('SARANA_PRASARANA');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, token } = useAuthStore();
  const { showToast } = useToastStore();

  const handleResetForm = () => {
    setSelectedCategory('SARANA_PRASARANA');
    setContent('');
  };

  const handleClose = () => {
    if (!isSubmitting) {
      handleResetForm();
      onClose();
    }
  };

  const handleQuickTopicClick = (topic: typeof QUICK_TOPICS[number]) => {
    setSelectedCategory(topic.cat);
    if (!content.trim()) {
      setContent(topic.prefix);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = content.trim();
    if (!trimmed) {
      showToast('warning', 'Isi Keluhan Masih Kosong', 'Silakan ketik catatan atau keluhan Anda terlebih dahulu.');
      return;
    }

    if (trimmed.length < 5) {
      showToast('warning', 'Keluhan Terlalu Singkat', 'Mohon tuliskan keterangan yang lebih jelas (minimal 5 karakter).');
      return;
    }

    if (!user) {
      showToast('error', 'Sesi Tidak Valid', 'Sesi login tidak ditemukan. Silakan masuk kembali.');
      return;
    }

    setIsSubmitting(true);
    try {
      await ComplaintRepository.submitComplaint(
        user.id,
        {
          category: selectedCategory,
          content: trimmed,
          is_anonymous: true,
        },
        token || undefined
      );

      showToast(
        'success',
        'Catatan Anonim Terkirim! 🔒',
        'Aspirasi Anda telah diteruskan ke Dashboard Admin & Kepsek secara 100% anonim.'
      );

      logger.info('AnonymousComplaintModal', 'Teacher complaint submitted anonymously', {
        category: selectedCategory,
      });

      handleResetForm();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      logger.error('AnonymousComplaintModal', 'Failed to submit complaint:', err);
      showToast(
        'error',
        'Gagal Mengirim Catatan',
        'Terjadi kendala saat menyimpan keluhan Anda. Silakan coba kembali.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const charPercent = Math.min(100, Math.round((content.length / 1000) * 100));

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="💬 Kotak Aspirasi & Keluhan Guru"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* 100% Guaranteed Privacy Assurance Card (iOS/Android Native Card feel) */}
        <div className="bg-linear-to-r from-emerald-50 via-teal-50 to-emerald-50/60 border border-emerald-200/90 p-3.5 rounded-2xl sm:rounded-3xl flex items-start gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-2xl bg-[#0D7A5F] text-white flex items-center justify-center text-base shrink-0 shadow-xs ring-2 ring-emerald-300/60">
            🔒
          </div>
          <div className="text-xs leading-relaxed min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-[#023246] tracking-tight">
                Jaminan Kerahasiaan 100% Anonim
              </span>
              <span className="px-2 py-0.2 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[9px] font-black rounded-full">
                Enkripsi Aktif
              </span>
            </div>
            <p className="text-slate-600 font-medium mt-0.5 text-[11px] sm:text-xs">
              Nama, NPP, foto profil, dan nomor HP Anda <b>disamarkan</b> sebagai <em>"Pendidik Anonim"</em> di dashboard Admin &amp; Kepala Sekolah.
            </p>
          </div>
        </div>

        {/* Category Pill / Touch Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-[#023246] uppercase tracking-wider block">
              Pilih Kategori Masalah / Aspirasi:
            </label>
            <span className="text-[10px] text-slate-400 font-bold">Wajib dipilih</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.type;
              return (
                <button
                  key={cat.type}
                  type="button"
                  onClick={() => setSelectedCategory(cat.type)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2.5 active:scale-[0.98] ${
                    isSelected
                      ? 'bg-[#023246] text-white border-[#023246] shadow-md ring-2 ring-[#287094]/40'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-2xl shrink-0">{cat.emoji}</span>
                    <div className="min-w-0">
                      <span className={`text-xs font-black block truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {cat.label}
                      </span>
                      <span className={`text-[10px] block truncate ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>
                        {cat.sublabel}
                      </span>
                    </div>
                  </div>

                  {isSelected ? (
                    <span className="w-5 h-5 rounded-full bg-[#0D7A5F] text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-xs">
                      ✓
                    </span>
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Topic Starter Chips */}
        <div className="space-y-1.5 pt-0.5">
          <span className="text-[11px] font-bold text-slate-500 block">
            💡 Topik Cepat (Ketuk untuk mulai menulis):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TOPICS.map((topic, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickTopicClick(topic)}
                className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 text-[11px] font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1 shadow-2xs"
              >
                <span>{topic.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Complaint Textarea Input with Dynamic Character Counter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="complaint-content" className="text-xs font-black text-[#023246] uppercase tracking-wider">
              Uraian Catatan / Keluhan:
            </label>
            <span
              className={`text-[11px] font-mono font-bold ${
                content.length >= 900
                  ? 'text-red-600'
                  : content.length >= 700
                  ? 'text-amber-600'
                  : 'text-slate-400'
              }`}
            >
              {content.length}/1000 karakter
            </span>
          </div>

          <div className="relative">
            <textarea
              id="complaint-content"
              rows={4}
              maxLength={1000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tuliskan kendala sarana, fasilitas kelas, sistem absensi, atau aspirasi Anda secara rinci..."
              className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#0D7A5F] transition-all resize-none shadow-2xs leading-relaxed min-h-28"
            />

            {/* Character Progress Bar */}
            <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full transition-all duration-300 ${
                  charPercent > 90 ? 'bg-red-500' : charPercent > 70 ? 'bg-amber-500' : 'bg-[#0D7A5F]'
                }`}
                style={{ width: `${charPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Bottom Action Button Bar (Full Mobile Touch Targets min 44-48px) */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
            className="min-h-12 sm:min-h-11 px-4 text-xs font-bold rounded-2xl w-full sm:w-auto"
          >
            Batal
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !content.trim()}
            className="min-h-12 sm:min-h-11 px-6 bg-[#0D7A5F] hover:bg-[#095744] text-white font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md active:scale-98 cursor-pointer w-full sm:w-auto"
          >
            <span>{isSubmitting ? 'Mengirim Catatan...' : '🔒 Kirim Secara Anonim'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
