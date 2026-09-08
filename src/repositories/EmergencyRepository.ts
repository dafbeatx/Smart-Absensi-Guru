import { ProviderFactory } from '../providers/provider-factory';
import type {
  ClassroomEmergencyAlert,
  CreateEmergencyAlertDTO,
  EmergencyCategory,
} from '../types/database.types';
import { logger } from '../utils/logger.utils';

export const EMERGENCY_STORAGE_KEY = 'smart_absensi_classroom_emergencies';
export const EMERGENCY_UPDATED_EVENT = 'smart_absensi_emergency_updated';

export interface EmergencyCategoryMeta {
  id: EmergencyCategory;
  label: string;
  shortLabel: string;
  subtitle: string;
  emoji: string;
  accentColor: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
}

export class EmergencyRepository {
  public static readonly CATEGORY_META: Record<EmergencyCategory, EmergencyCategoryMeta> = {
    MEDIS_UKS: {
      id: 'MEDIS_UKS',
      label: 'Medis & UKS (Siswa Sakit / Pingsan)',
      shortLabel: 'Medis / UKS',
      subtitle: 'Pingsan, mimisan, lemas, asma kambuh, atau cedera fisik',
      emoji: '🩺',
      accentColor: '#E11D48',
      bgClass: 'bg-rose-50',
      borderClass: 'border-rose-200',
      textClass: 'text-rose-700',
    },
    DISIPLIN_PERKELAHIAN: {
      id: 'DISIPLIN_PERKELAHIAN',
      label: 'Disiplin & Perkelahian',
      shortLabel: 'Perkelahian / Disiplin',
      subtitle: 'Keributan antar-siswa, agresi fisik, atau perundungan darurat',
      emoji: '⚡',
      accentColor: '#D97706',
      bgClass: 'bg-amber-50',
      borderClass: 'border-amber-200',
      textClass: 'text-amber-700',
    },
    LAB_K3: {
      id: 'LAB_K3',
      label: 'Insiden Laboratorium & Bahaya Fisik',
      shortLabel: 'Lab & Fisik',
      subtitle: 'Tumpahan bahan kimia, luka bakar, kebakaran kecil, atau pecahan kaca',
      emoji: '🧪',
      accentColor: '#EA580C',
      bgClass: 'bg-orange-50',
      borderClass: 'border-orange-200',
      textClass: 'text-orange-700',
    },
    LAINNYA: {
      id: 'LAINNYA',
      label: 'Kedaruratan Kelas Lainnya',
      shortLabel: 'Darurat Lain',
      subtitle: 'Situasi darurat umum yang membutuhkan kehadiran Guru Piket segera',
      emoji: '⚠️',
      accentColor: '#DC2626',
      bgClass: 'bg-red-50',
      borderClass: 'border-red-200',
      textClass: 'text-red-700',
    },
  };

  /**
   * Mengambil semua riwayat panggilan darurat kelas (localStorage + Provider Sync)
   */
  public static async getAlerts(token?: string): Promise<ClassroomEmergencyAlert[]> {
    // 1. Coba baca dari Supabase provider jika ada
    try {
      const provider = ProviderFactory.getProvider();
      if ('getClassroomEmergencies' in provider && typeof (provider as any).getClassroomEmergencies === 'function') {
        const cloudAlerts = await (provider as any).getClassroomEmergencies(token);
        if (Array.isArray(cloudAlerts)) {
          this.persistToLocal(cloudAlerts);
          return cloudAlerts;
        }
      }
    } catch (err) {
      logger.warn('EmergencyRepository', 'Failed to fetch emergencies from cloud provider, using local fallback:', err);
    }

    // 2. Fallback ke Local Storage
    return this.getLocalAlerts();
  }

  /**
   * Mengambil hanya panggilan darurat yang masih berstatus AKTIF atau SEDANG DITANGANI (RESPONDED)
   */
  public static async getActiveAlerts(token?: string): Promise<ClassroomEmergencyAlert[]> {
    const all = await this.getAlerts(token);
    return all.filter((a) => a.status === 'ACTIVE' || a.status === 'RESPONDED');
  }

  /**
   * Membuat panggilan darurat baru (SOS)
   */
  public static async createAlert(
    teacherId: string,
    teacherName: string,
    dto: CreateEmergencyAlertDTO,
    token?: string
  ): Promise<ClassroomEmergencyAlert> {
    const newAlert: ClassroomEmergencyAlert = {
      id: `sos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      teacher_id: teacherId,
      teacher_name: teacherName,
      room_name: dto.room_name.trim(),
      class_name: dto.class_name?.trim() || undefined,
      category: dto.category,
      notes: dto.notes?.trim() || undefined,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    };

    // 1. Simpan ke local storage
    const current = this.getLocalAlerts();
    const updated = [newAlert, ...current];
    this.persistToLocal(updated);

    // 2. Broadcast event lintas window/tab
    this.broadcastUpdate(updated);

    // 3. Simpan ke cloud provider jika didukung
    try {
      const provider = ProviderFactory.getProvider();
      if ('createClassroomEmergency' in provider && typeof (provider as any).createClassroomEmergency === 'function') {
        await (provider as any).createClassroomEmergency(newAlert, token);
      }
    } catch (err) {
      logger.warn('EmergencyRepository', 'Cloud save failed for emergency alert, saved locally:', err);
    }

    return newAlert;
  }

  /**
   * Guru Piket / UKS merespon panggilan darurat ("Sedang Menuju Kelas")
   */
  public static async respondToAlert(id: string, responderName: string, token?: string): Promise<boolean> {
    const alerts = this.getLocalAlerts();
    const targetIdx = alerts.findIndex((a) => a.id === id);
    if (targetIdx === -1) return false;

    alerts[targetIdx] = {
      ...alerts[targetIdx],
      status: 'RESPONDED',
      responded_by: responderName,
      responded_at: new Date().toISOString(),
    };

    this.persistToLocal(alerts);
    this.broadcastUpdate(alerts);

    try {
      const provider = ProviderFactory.getProvider();
      if ('updateClassroomEmergencyStatus' in provider && typeof (provider as any).updateClassroomEmergencyStatus === 'function') {
        await (provider as any).updateClassroomEmergencyStatus(id, 'RESPONDED', responderName, undefined, token);
      }
    } catch (err) {
      logger.warn('EmergencyRepository', 'Cloud status update failed for respondToAlert:', err);
    }

    return true;
  }

  /**
   * Menyelesaikan panggilan darurat (Tuntas tertangani)
   */
  public static async resolveAlert(id: string, resolutionNotes?: string, token?: string): Promise<boolean> {
    const alerts = this.getLocalAlerts();
    const targetIdx = alerts.findIndex((a) => a.id === id);
    if (targetIdx === -1) return false;

    alerts[targetIdx] = {
      ...alerts[targetIdx],
      status: 'RESOLVED',
      resolved_at: new Date().toISOString(),
      resolution_notes: resolutionNotes?.trim() || undefined,
    };

    this.persistToLocal(alerts);
    this.broadcastUpdate(alerts);

    try {
      const provider = ProviderFactory.getProvider();
      if ('updateClassroomEmergencyStatus' in provider && typeof (provider as any).updateClassroomEmergencyStatus === 'function') {
        await (provider as any).updateClassroomEmergencyStatus(id, 'RESOLVED', undefined, resolutionNotes, token);
      }
    } catch (err) {
      logger.warn('EmergencyRepository', 'Cloud status update failed for resolveAlert:', err);
    }

    return true;
  }

  /**
   * Membatalkan panggilan darurat (Misal kepencet atau situasi sudah terkendali sendiri)
   */
  public static async cancelAlert(id: string, token?: string): Promise<boolean> {
    const alerts = this.getLocalAlerts();
    const targetIdx = alerts.findIndex((a) => a.id === id);
    if (targetIdx === -1) return false;

    alerts[targetIdx] = {
      ...alerts[targetIdx],
      status: 'CANCELLED',
      resolved_at: new Date().toISOString(),
      resolution_notes: 'Dibatalkan oleh pengirim',
    };

    this.persistToLocal(alerts);
    this.broadcastUpdate(alerts);

    try {
      const provider = ProviderFactory.getProvider();
      if ('updateClassroomEmergencyStatus' in provider && typeof (provider as any).updateClassroomEmergencyStatus === 'function') {
        await (provider as any).updateClassroomEmergencyStatus(id, 'CANCELLED', undefined, 'Dibatalkan oleh pengirim', token);
      }
    } catch (err) {
      logger.warn('EmergencyRepository', 'Cloud status update failed for cancelAlert:', err);
    }

    return true;
  }

  // --- Helper Methods ---

  private static getLocalAlerts(): ClassroomEmergencyAlert[] {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(EMERGENCY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      logger.error('EmergencyRepository', 'Failed to read emergency alerts from localStorage:', err);
    }
    return [];
  }

  private static persistToLocal(alerts: ClassroomEmergencyAlert[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(EMERGENCY_STORAGE_KEY, JSON.stringify(alerts));
    } catch (err) {
      logger.error('EmergencyRepository', 'Failed to persist emergency alerts to localStorage:', err);
    }
  }

  private static broadcastUpdate(alerts: ClassroomEmergencyAlert[]): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(EMERGENCY_UPDATED_EVENT, { detail: alerts }));
  }
}
