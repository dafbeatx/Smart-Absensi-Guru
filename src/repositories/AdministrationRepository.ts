import type {
  AdministrationModuleItem,
  SemesterType,
} from '../types/administration.types';
import {
  DEFAULT_ADMINISTRATION_MODULES,
  AVAILABLE_ACADEMIC_YEARS,
} from '../types/administration.types';

export {
  DEFAULT_ADMINISTRATION_MODULES,
  AVAILABLE_ACADEMIC_YEARS,
};

export const ADMIN_MODULES_STORAGE_PREFIX = 'smart_absensi_admin_modules';
export const ADMIN_ACTIVE_YEAR_KEY = 'smart_absensi_active_academic_year';
export const ADMIN_ACTIVE_SEMESTER_KEY = 'smart_absensi_active_semester';
export const ADMIN_YEAR_CHANGED_EVENT = 'smart_absensi_academic_year_changed';
export const ADMIN_MODULES_CHANGED_EVENT = 'smart_absensi_admin_modules_changed';

const memoryStore = new Map<string, string>();

const safeGetStorage = (key: string): string | null => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {
    // Memory fallback
  }
  return memoryStore.get(key) || null;
};

const safeSetStorage = (key: string, value: string): void => {
  memoryStore.set(key, value);
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Memory fallback
  }
};

export class AdministrationRepository {
  /**
   * Retrieves active academic year.
   * Defaults to '2026/2027'.
   */
  public static getActiveAcademicYear(): string {
    const saved = safeGetStorage(ADMIN_ACTIVE_YEAR_KEY);
    if (saved && AVAILABLE_ACADEMIC_YEARS.some((y) => y.year === saved)) {
      return saved;
    }
    return '2026/2027';
  }

  /**
   * Sets active academic year and broadcasts event across windows/components.
   */
  public static setActiveAcademicYear(year: string): void {
    safeSetStorage(ADMIN_ACTIVE_YEAR_KEY, year);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(ADMIN_YEAR_CHANGED_EVENT, { detail: { year } })
      );
    }
  }

  /**
   * Retrieves active semester ('GANJIL' | 'GENAP').
   * Defaults to 'GANJIL'.
   */
  public static getActiveSemester(): SemesterType {
    const saved = safeGetStorage(ADMIN_ACTIVE_SEMESTER_KEY);
    if (saved === 'GANJIL' || saved === 'GENAP') {
      return saved;
    }
    return 'GANJIL';
  }

  /**
   * Sets active semester and broadcasts event.
   */
  public static setActiveSemester(semester: SemesterType): void {
    safeSetStorage(ADMIN_ACTIVE_SEMESTER_KEY, semester);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(ADMIN_YEAR_CHANGED_EVENT, { detail: { semester } })
      );
    }
  }

  /**
   * Builds the storage key for a user and academic year.
   */
  private static getStorageKey(userId: string, academicYear: string): string {
    const safeUser = userId || 'default';
    const safeYear = academicYear || '2026/2027';
    return `${ADMIN_MODULES_STORAGE_PREFIX}_${safeUser}_${safeYear}`;
  }

  /**
   * Retrieves administration modules configured for user and academic year.
   */
  public static getModules(userId: string, academicYear: string): AdministrationModuleItem[] {
    const key = this.getStorageKey(userId, academicYear);
    const saved = safeGetStorage(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with any newly introduced default modules
          const parsedMap = new Map<string, AdministrationModuleItem>();
          parsed.forEach((m) => parsedMap.set(m.id, m));

          const merged: AdministrationModuleItem[] = [...parsed];
          DEFAULT_ADMINISTRATION_MODULES.forEach((def) => {
            if (!parsedMap.has(def.id)) {
              merged.push(def);
            }
          });

          return merged.sort((a, b) => (a.order || 0) - (b.order || 0));
        }
      } catch {
        // ignore parse error and fallback to default
      }
    }

    return [...DEFAULT_ADMINISTRATION_MODULES];
  }

  /**
   * Saves modules configuration for user and academic year.
   */
  public static saveModules(
    userId: string,
    academicYear: string,
    modules: AdministrationModuleItem[]
  ): void {
    const key = this.getStorageKey(userId, academicYear);
    safeSetStorage(key, JSON.stringify(modules));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(ADMIN_MODULES_CHANGED_EVENT, { detail: { userId, academicYear, modules } })
      );
    }
  }

  /**
   * Resets modules to system defaults for user and academic year.
   */
  public static resetToDefault(userId: string, academicYear: string): AdministrationModuleItem[] {
    const def = [...DEFAULT_ADMINISTRATION_MODULES];
    this.saveModules(userId, academicYear, def);
    return def;
  }

  /**
   * Toggles enabled/disabled status of a specific module.
   */
  public static toggleModule(
    userId: string,
    academicYear: string,
    moduleId: string,
    isEnabled: boolean
  ): AdministrationModuleItem[] {
    const current = this.getModules(userId, academicYear);
    const updated = current.map((m) => (m.id === moduleId ? { ...m, isEnabled } : m));
    this.saveModules(userId, academicYear, updated);
    return updated;
  }

  /**
   * Adds a new custom module item (e.g. customized exam / admin tool).
   */
  public static addCustomModule(
    userId: string,
    academicYear: string,
    newModule: Omit<AdministrationModuleItem, 'id' | 'order'>
  ): AdministrationModuleItem[] {
    const current = this.getModules(userId, academicYear);
    const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const maxOrder = current.reduce((max, m) => Math.max(max, m.order || 0), 0);
    const item: AdministrationModuleItem = {
      ...newModule,
      id,
      order: maxOrder + 1,
      isEnabled: true,
      category: newModule.category || 'CUSTOM',
    };
    const updated = [...current, item];
    this.saveModules(userId, academicYear, updated);
    return updated;
  }

  /**
   * Removes a custom module item.
   */
  public static removeCustomModule(
    userId: string,
    academicYear: string,
    moduleId: string
  ): AdministrationModuleItem[] {
    const current = this.getModules(userId, academicYear);
    const updated = current.filter((m) => m.id !== moduleId);
    this.saveModules(userId, academicYear, updated);
    return updated;
  }
}
