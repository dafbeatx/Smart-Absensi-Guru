import React, { useEffect } from 'react';
import { SurveyAnalyticsView } from './SurveyAnalyticsView';

export interface MonthlySurveyAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * MonthlySurveyAnalyticsModal — Full-Screen Layer Wrapper
 * Menggantikan popup melayang menjadi dedicated layer satu layar penuh
 * yang nyaman dibaca dan dioperasikan di perangkat mobile maupun desktop.
 */
export const MonthlySurveyAnalyticsModal: React.FC<MonthlySurveyAnalyticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 bg-[#F4F6F8] overflow-y-auto p-2 sm:p-5 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Layer Suara Pendidik, Hasil Survei & Rencana Solusi Sekolah"
    >
      <SurveyAnalyticsView
        onBack={onClose}
        backLabel="Tutup &amp; Kembali"
      />
    </div>
  );
};
