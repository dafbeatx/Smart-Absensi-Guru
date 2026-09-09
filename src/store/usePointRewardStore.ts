import { create } from 'zustand';
import type { PointRewardData } from '../components/ui/PointRewardCelebrationOverlay';

interface PointRewardStore {
  isOpen: boolean;
  data: PointRewardData | null;
  lastTriggerTimestamp: number;
  triggerCelebration: (data: PointRewardData) => void;
  closeCelebration: () => void;
}

export const usePointRewardStore = create<PointRewardStore>((set, get) => ({
  isOpen: false,
  data: null,
  lastTriggerTimestamp: 0,
  triggerCelebration: (data: PointRewardData) => {
    const now = Date.now();
    const current = get();

    // Prevent duplicate rapid re-trigger within 2.5 seconds with same points & reason
    if (
      current.isOpen &&
      current.data &&
      current.data.points === data.points &&
      current.data.reason === data.reason &&
      now - current.lastTriggerTimestamp < 2500
    ) {
      return;
    }

    set({
      isOpen: true,
      data,
      lastTriggerTimestamp: now,
    });
  },
  closeCelebration: () => {
    set({
      isOpen: false,
      data: null,
    });
  },
}));
