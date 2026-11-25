import React, { useEffect } from 'react';
import { X, FolderCheck } from 'lucide-react';
import type { UserProfile } from '../../../types/database.types';
import type { AdministrationModuleItem } from '../../../types/administration.types';
import { AdministrationHubView } from './AdministrationHubView';

export interface AdministrationHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
  onOpenModule: (actionId: string, item: AdministrationModuleItem, academicYear: string) => void;
}

export const AdministrationHubModal: React.FC<AdministrationHubModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenModule,
}) => {
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-4xl h-dvh sm:h-auto sm:max-h-[92dvh] rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border sm:border-slate-200 overflow-hidden flex flex-col">
        {/* Modal Topbar */}
        <div className="bg-[#023246] text-white pt-[max(14px,env(safe-area-inset-top))] pb-3.5 sm:p-4 px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0 border border-white/15">
              <FolderCheck className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base tracking-tight leading-tight">
                Administrasi Sekolah &amp; KBM
              </h3>
              <p className="text-[10px] sm:text-[11px] text-cyan-100/80 truncate">
                {currentUser?.full_name || 'Guru / Pendidik'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 custom-scrollbar bg-slate-50/50">
          <AdministrationHubView
            userId={currentUser?.id || 'guru_user'}
            userRole={currentUser?.role || 'GURU'}
            userName={currentUser?.full_name || 'Guru'}
            onOpenModule={(actionId, item, academicYear) => {
              onClose();
              onOpenModule(actionId, item, academicYear);
            }}
            isModalMode={true}
          />
        </div>

        {/* Footer */}
        <div className="p-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-white border-t border-slate-200 text-center shrink-0">
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
            Pengaturan modul dan tahun ajaran tersimpan otomatis di perangkat Anda.
          </p>
        </div>
      </div>
    </div>
  );
};
