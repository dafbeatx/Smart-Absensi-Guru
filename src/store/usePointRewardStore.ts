import { create } from 'zustand';
import type { PointRewardData } from '../components/ui/PointRewardCelebrationOverlay';

interface PointRewardStore {
  isOpen: boolean;
  data: PointRewardData | null;
  lastTriggerTimestamp: number;
  seenTransactionIds: Set<string>;
  triggerCelebration: (data: PointRewardData) => void;
  markAsSeen: (txId: string) => void;
  closeCelebration: () => void;
}

// Inisialisasi BroadcastChannel untuk sinkronisasi antar-tab
let pointBroadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    pointBroadcastChannel = new BroadcastChannel('smart_absensi_point_celebration_channel');
  } catch {
    // Graceful fallback jika BroadcastChannel dibatasi browser
  }
}

// Inisialisasi daftar transaksi yang sudah dilihat dari sessionStorage
function getInitialSeenTransactions(): Set<string> {
  const seen = new Set<string>();
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('seen_point_tx_')) {
          const txId = key.replace('seen_point_tx_', '');
          if (txId) seen.add(txId);
        }
      }
    } catch {
      // ignore storage access errors
    }
  }
  return seen;
}

export const usePointRewardStore = create<PointRewardStore>((set, get) => {
  const initialSeen = getInitialSeenTransactions();

  // Dengarkan siaran antar-tab agar popup tidak muncul ganda di tab lain
  if (pointBroadcastChannel) {
    pointBroadcastChannel.onmessage = (event) => {
      const { type, txId } = event.data || {};
      if (type === 'POINT_SEEN' && txId) {
        get().seenTransactionIds.add(txId);
        try {
          sessionStorage.setItem(`seen_point_tx_${txId}`, 'true');
        } catch {
          // ignore
        }
      }
    };
  }

  return {
    isOpen: false,
    data: null,
    lastTriggerTimestamp: 0,
    seenTransactionIds: initialSeen,

    markAsSeen: (txId: string) => {
      if (!txId) return;
      get().seenTransactionIds.add(txId);
      if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
        try {
          sessionStorage.setItem(`seen_point_tx_${txId}`, 'true');
        } catch {
          // ignore
        }
      }
      if (pointBroadcastChannel) {
        try {
          pointBroadcastChannel.postMessage({ type: 'POINT_SEEN', txId });
        } catch {
          // ignore
        }
      }
    },

    triggerCelebration: (data: PointRewardData) => {
      const now = Date.now();
      const current = get();

      const txId = data.id || data.dedupeKey;

      // 1. Deduplikasi Berbasis ID Transaksi Database / Idempotency Key (At-Most-Once)
      if (txId) {
        const alreadySeenLocally = current.seenTransactionIds.has(txId);
        const alreadySeenInSession =
          typeof sessionStorage !== 'undefined' &&
          sessionStorage.getItem(`seen_point_tx_${txId}`) === 'true';

        if (alreadySeenLocally || alreadySeenInSession) {
          return; // Abaikan: Transaksi ini sudah pernah ditampilkan kepada pengguna
        }
      }

      // 2. Cegah pemicuan beruntun dalam 2.5 detik untuk data yang identik
      if (
        current.isOpen &&
        current.data &&
        current.data.points === data.points &&
        current.data.reason === data.reason &&
        now - current.lastTriggerTimestamp < 2500
      ) {
        return;
      }

      // 3. Tandai transaksi sebagai seen seketika agar tidak ter-trigger ganda saat re-render
      if (txId) {
        current.markAsSeen(txId);
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
  };
});
