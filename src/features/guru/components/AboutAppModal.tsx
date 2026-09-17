import React from 'react';
import { AboutAppView, type AboutAppViewProps } from './AboutAppView';

export interface AboutAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  role?: 'GURU' | 'ADMIN' | 'KEPSEK';
}

/**
 * Backward-compatible wrapper for AboutApp.
 * When rendered as a standalone layer (preferred), use <AboutAppView onBack={onClose} />.
 */
export const AboutAppModal: React.FC<AboutAppModalProps> = ({ isOpen, onClose, role = 'GURU' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#F6F6F6] overflow-y-auto p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <AboutAppView
          onBack={onClose}
          backLabel="Tutup / Kembali"
          role={role}
        />
      </div>
    </div>
  );
};

export { AboutAppView };
export type { AboutAppViewProps };
