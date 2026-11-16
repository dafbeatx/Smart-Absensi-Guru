import { useEffect, useRef } from 'react';
import {
  BackNavigationService,
  BACK_PRIORITIES,
} from '../services/back-navigation.service';

export { BACK_PRIORITIES };

export interface UseBackHandlerOptions {
  id: string;
  isOpen?: boolean;
  onBack: () => boolean | void;
  priority?: number;
  title?: string;
  pushHistory?: boolean;
}

/**
 * Hook untuk mendaftarkan satu handler navigasi kembali (back button).
 * Cocok untuk komponen modal mandiri, drawer, atau overlay.
 */
export function useBackHandler({
  id,
  isOpen = true,
  onBack,
  priority = BACK_PRIORITIES.MODAL,
  title,
  pushHistory,
}: UseBackHandlerOptions): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!isOpen) return;

    const unregister = BackNavigationService.register({
      id,
      onBack: () => onBackRef.current(),
      priority,
      title,
      pushHistory,
    });

    return () => {
      unregister();
    };
  }, [id, isOpen, priority, title, pushHistory]);
}

export interface ModalBackItem {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  priority?: number;
  title?: string;
  pushHistory?: boolean;
}

/**
 * Hook untuk mendaftarkan sekumpulan modal pada level halaman (Dashboard).
 * Secara cerdas memelihara urutan pembukaan (LIFO) sehingga saat tombol back HP ditekan,
 * modal yang dibuka paling akhir akan tertutup terlebih dahulu, tanpa menutup modal sebelumnya.
 */
export function usePageModalBackStack(modals: ModalBackItem[]): void {
  const activeUnregistersRef = useRef<Map<string, () => void>>(new Map());
  const modalsRef = useRef(modals);
  modalsRef.current = modals;

  useEffect(() => {
    const activeMap = activeUnregistersRef.current;
    const currentModals = modalsRef.current;

    // 1. Daftarkan modal yang baru saja terbuka (isOpen = true)
    currentModals.forEach((modal) => {
      if (modal.isOpen && !activeMap.has(modal.id)) {
        const unregister = BackNavigationService.register({
          id: modal.id,
          onBack: () => {
            const target = modalsRef.current.find((m) => m.id === modal.id);
            if (target && target.isOpen) {
              target.onClose();
              return true;
            }
            return false;
          },
          priority: modal.priority ?? BACK_PRIORITIES.MODAL,
          title: modal.title,
          pushHistory: modal.pushHistory,
        });

        activeMap.set(modal.id, unregister);
      }
    });

    // 2. Bersihkan modal yang ditutup dari UI (isOpen = false)
    const currentOpenIds = new Set(
      currentModals.filter((m) => m.isOpen).map((m) => m.id)
    );

    activeMap.forEach((unregister, id) => {
      if (!currentOpenIds.has(id)) {
        unregister();
        activeMap.delete(id);
      }
    });
  });

  // Cleanup seluruh unregister saat komponen halaman unmount
  useEffect(() => {
    const activeMap = activeUnregistersRef.current;
    return () => {
      activeMap.forEach((unregister) => unregister());
      activeMap.clear();
    };
  }, []);
}

export interface UseTabBackNavigationOptions {
  id: string;
  activeTab: string;
  defaultTab: string;
  onBackToDefault: () => void;
  priority?: number;
}

/**
 * Hook untuk menavigasikan tab non-default kembali ke tab beranda/default
 * saat pengguna menekan tombol back HP (bukan langsung keluar dari aplikasi).
 */
export function useTabBackNavigation({
  id,
  activeTab,
  defaultTab,
  onBackToDefault,
  priority = BACK_PRIORITIES.TAB,
}: UseTabBackNavigationOptions): void {
  const isSubTab = activeTab !== defaultTab;

  useBackHandler({
    id,
    isOpen: isSubTab,
    onBack: onBackToDefault,
    priority,
    title: `Tab Navigation (${activeTab} -> ${defaultTab})`,
    pushHistory: true,
  });
}
