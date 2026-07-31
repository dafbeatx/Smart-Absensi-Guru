export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

export class DashboardCacheService {
  private static cacheMap = new Map<string, CacheEntry<unknown>>();

  public static set<T>(key: string, data: T, ttlMinutes: number = 5): void {
    const ttlMs = ttlMinutes * 60 * 1000;
    DashboardCacheService.cacheMap.set(key, {
      data,
      cachedAt: Date.now(),
      ttlMs,
    });
  }

  public static get<T>(key: string): T | null {
    const entry = DashboardCacheService.cacheMap.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const isExpired = Date.now() - entry.cachedAt > entry.ttlMs;
    if (isExpired) {
      DashboardCacheService.cacheMap.delete(key);
      return null;
    }

    return entry.data;
  }

  public static clear(key?: string): void {
    if (key) {
      DashboardCacheService.cacheMap.delete(key);
    } else {
      DashboardCacheService.cacheMap.clear();
    }
  }
}
