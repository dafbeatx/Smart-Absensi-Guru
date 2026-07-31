import { create } from 'zustand';
import type { OfflineAttendanceRecord } from '../services/indexed-db.service';

export type SyncEngineState = 'IDLE' | 'SYNCING' | 'SUCCESS' | 'FAILED';

export interface SyncQueueState {
  pendingItems: OfflineAttendanceRecord[];
  syncState: SyncEngineState;
  lastSyncedCount: number;
  lastError: string | null;
  setPendingItems: (items: OfflineAttendanceRecord[]) => void;
  setSyncState: (state: SyncEngineState) => void;
  setLastSyncedCount: (count: number) => void;
  setLastError: (error: string | null) => void;
}

export const useSyncQueueStore = create<SyncQueueState>((set) => ({
  pendingItems: [],
  syncState: 'IDLE',
  lastSyncedCount: 0,
  lastError: null,

  setPendingItems: (pendingItems) => set({ pendingItems }),
  setSyncState: (syncState) => set({ syncState }),
  setLastSyncedCount: (lastSyncedCount) => set({ lastSyncedCount }),
  setLastError: (lastError) => set({ lastError }),
}));
