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

const CATEGORIES: { type: ComplaintCategory; emoji: string; label: string; sublabel: string }[] = [
  {
    type: 'SARANA_PRASARANA',
    emoji: '🏢',
    label: 'Sarana & Fasilitas',
    sublabel: 'AC, Proyektor, Lab, Kebersihan, Toilet',
  },
  {
    type: 'SISTEM_APLIKASI',
    emoji: '📱',
    label: 'Sistem & Aplikasi',
    sublabel: 'Aplikasi Absensi, GPS, Barcode, Error',
  },
  {
    type: 'KEBIJAKAN_MANAJEMEN',
    emoji: '📋',
    label: 'Kebijakan & Jadwal',
    sublabel: 'Jadwal Mengajar, Beban Kerja, Rapat',
  },
  {
    type: 'KESEJAHTERAAN',
    emoji: '🌱',
    label: 'Kesejahteraan Guru',
    sublabel: 'Kenyamanan Kerja, Lingkungan Sekolah',
  },
  {
    type: 'LAINNYA',
    emoji: '💡',
    label: 'Aspirasi Lainnya',
    sublabel: 'Ide Inovasi & Masukan Konstruktif',
  },
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
        'Keluhan Anda telah diteruskan ke Dashboard Admin & Kepsek secara 100% anonim.'
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

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="💬 Kotak Aspirasi & Keluhan Anonim" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* 100% Guaranteed Privacy Assurance Banner */}
        <div className="bg-emerald-50/90 border border-emerald-300/80 p-3.5 rounded-2xl flex items-start gap-3 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-base shrink-0">
            🔒
          </div>
          <div className="text-xs leading-relaxed">
            <span className="font-extrabold text-[#0D7A5F] block">
              Jaminan Kerahasiaan 100% Anonim
            </span>
            <p className="text-slate-700 font-medium mt-0.5">
              Nama, NPP, foto profil, dan nomor HP Anda <b>tidak akan pernah ditampilkan</b> kepada siapapun (Admin &amp; Kepala Sekolah). Anda dapat memantau riwayat tanggapan sekolah di menu Riwayat HP Anda.
            </p>
          </div>
        </div>

        {/* Category Chip Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold text-slate-800 block">
            Pilih Kategori Masalah / Aspirasi:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.type;
              return (
                <button
                  key={cat.type}
                  type="button"
                  onClick={() => setSelectedCategory(cat.type)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-[#023246] text-white border-[#023246] shadow-sm ring-2 ring-[#287094]/30'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <span className="text-xl shrink-0 mt-0.5">{cat.emoji}</span>
                  <div className="min-w-0">
                    <span className={`text-xs font-extrabold block truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {cat.label}
                    </span>
                    <span className={`text-[10px] block truncate ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>
                      {cat.sublabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Complaint Textarea Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="complaint-content" className="text-xs font-extrabold text-slate-800">
              Uraian Catatan / Keluhan:
            </label>
            <span className="text-[11px] font-mono font-medium text-slate-400">
              {content.length}/1000 karakter
            </span>
          </div>
          <textarea
            id="complaint-content"
            rows={4}
            maxLength={1000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tuliskan kendala sarana, fasilitas kelas, sistem absensi, atau aspirasi Anda secara rinci..."
            className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D7A5F] transition-all resize-none shadow-2xs leading-relaxed"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
            className="min-h-11 px-4 text-xs font-bold"
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !content.trim()}
            className="min-h-11 px-5 bg-[#0D7A5F] hover:bg-[#095744] text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-98 cursor-pointer"
          >
            <span>{isSubmitting ? 'Mengirim...' : '🔒 Kirim Secara Anonim'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
