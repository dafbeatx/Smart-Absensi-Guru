import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { useBackHandler, BACK_PRIORITIES } from '../../hooks/useBackNavigation';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  modalId?: string;
  disableBackHandler?: boolean;
  mobileFullscreen?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
  modalId,
  disableBackHandler = false,
  mobileFullscreen = false,
}) => {
  const generatedId = useId();
  const effectiveModalId = modalId || (title ? `modal_${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : `modal_${generatedId}`);

  // 🛡️ Mobile Hardware & Gesture Back Button Handler
  useBackHandler({
    id: effectiveModalId,
    isOpen: isOpen && !disableBackHandler,
    priority: BACK_PRIORITIES.MODAL,
    title: title || 'Modal Window',
    onBack: onClose,
  });
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in ${
        mobileFullscreen ? 'p-0 sm:p-4' : 'p-3 sm:p-4'
      }`}
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative w-full ${widthClasses[maxWidth]} flex flex-col bg-white shadow-2xl border-slate-100 z-10 animate-scale-up overflow-hidden ${
          mobileFullscreen
            ? 'h-dvh sm:h-auto sm:max-h-[90dvh] rounded-none sm:rounded-3xl p-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))] sm:p-6 border-0 sm:border'
            : 'max-h-[90dvh] rounded-3xl p-5 sm:p-6 border'
        }`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
            <h3 className="text-base font-extrabold text-slate-900 truncate pr-2">{title}</h3>
            <button
              onClick={onClose}
              className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-colors cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
      </div>
    </div>,
    document.body
  );
};

