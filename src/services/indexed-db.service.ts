/**
 * SMART ABSENSI GURU - INDEXEDDB OFFLINE STORAGE SERVICE
 * Native IndexedDB Wrapper for Reliable Transaction Queuing
 */

export interface OfflineAttendanceRecord {
  id: string;
  user_id: string;
  qr_seed: string;
  user_lat: number;
  user_lng: number;
  distance_meters: number;
  gps_accuracy?: number;
  timestamp: string;
  sync_status: 'PENDING' | 'SYNCING' | 'FAILED';
  retry_count: number;
}

const DB_NAME = 'SmartAbsensiOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_attendance_queue';

class IndexedDBService {
  private db: IDBDatabase | null = null;

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is not supported in this environment (Node.js/Non-Browser)');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('user_id', 'user_id', { unique: false });
          store.createIndex('sync_status', 'sync_status', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB Error:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  public async enqueue(record: OfflineAttendanceRecord): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('IndexedDB enqueue skipped (non-browser environment):', (e as Error).message);
    }
  }

  public async getPendingQueue(): Promise<OfflineAttendanceRecord[]> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('sync_status');
        const req = index.getAll('PENDING');

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  public async remove(id: string): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Ignored in non-browser env
    }
  }

  public async clearAll(): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Ignored in non-browser env
    }
  }
}

export const indexedDBService = new IndexedDBService();
