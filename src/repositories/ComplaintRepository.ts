import { ProviderFactory } from '../providers/provider-factory';
import type {
  TeacherComplaint,
  SubmitComplaintDTO,
  UpdateComplaintStatusDTO,
  ComplaintCategory,
  ComplaintStatus,
} from '../types/database.types';

export interface CategoryMetadata {
  label: string;
  emoji: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

export interface StatusMetadata {
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  badgeStatus: 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALFA' | 'DEFAULT';
}

export class ComplaintRepository {
  public static readonly CATEGORY_META: Record<ComplaintCategory, CategoryMetadata> = {
    SARANA_PRASARANA: {
      label: 'Sarana & Fasilitas',
      emoji: '🏢',
      colorClass: 'text-amber-800',
      bgClass: 'bg-amber-50',
      borderClass: 'border-amber-200',
    },
    SISTEM_APLIKASI: {
      label: 'Sistem & Aplikasi',
      emoji: '📱',
      colorClass: 'text-sky-800',
      bgClass: 'bg-sky-50',
      borderClass: 'border-sky-200',
    },
    KEBIJAKAN_MANAJEMEN: {
      label: 'Kebijakan & Jadwal',
      emoji: '📋',
      colorClass: 'text-purple-800',
      bgClass: 'bg-purple-50',
      borderClass: 'border-purple-200',
    },
    KESEJAHTERAAN: {
      label: 'Kesejahteraan & Lingkungan',
      emoji: '🌱',
      colorClass: 'text-emerald-800',
      bgClass: 'bg-emerald-50',
      borderClass: 'border-emerald-200',
    },
    LAINNYA: {
      label: 'Aspirasi & Masukan Lain',
      emoji: '💡',
      colorClass: 'text-slate-800',
      bgClass: 'bg-slate-100',
      borderClass: 'border-slate-300',
    },
  };

  public static readonly STATUS_META: Record<ComplaintStatus, StatusMetadata> = {
    SUBMITTED: {
      label: 'Terkirim (Menunggu)',
      colorClass: 'text-amber-800',
      bgClass: 'bg-amber-50',
      borderClass: 'border-amber-300',
      badgeStatus: 'TERLAMBAT',
    },
    IN_REVIEW: {
      label: 'Sedang Ditinjau',
      colorClass: 'text-sky-800',
      bgClass: 'bg-sky-50',
      borderClass: 'border-sky-300',
      badgeStatus: 'IZIN',
    },
    RESOLVED: {
      label: 'Ditindaklanjuti / Selesai',
      colorClass: 'text-emerald-800',
      bgClass: 'bg-emerald-50',
      borderClass: 'border-emerald-300',
      badgeStatus: 'HADIR',
    },
    ARCHIVED: {
      label: 'Diarsipkan',
      colorClass: 'text-slate-600',
      bgClass: 'bg-slate-100',
      borderClass: 'border-slate-300',
      badgeStatus: 'DEFAULT',
    },
  };

  /**
   * Submit a new anonymous complaint/feedback
   */
  public static async submitComplaint(
    userId: string,
    dto: SubmitComplaintDTO,
    token?: string
  ): Promise<TeacherComplaint> {
    const result = await ProviderFactory.getProvider().submitComplaint(userId, dto, token);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smart_absensi_complaints_updated'));
    }
    return result;
  }

  /**
   * Get all complaints for the current teacher (for HP Guru personal history)
   */
  public static async getUserComplaints(userId: string, token?: string): Promise<TeacherComplaint[]> {
    return ProviderFactory.getProvider().getUserComplaints(userId, token);
  }

  /**
   * Get all complaints for Admin & Kepsek (all sender identities are strictly masked)
   */
  public static async getAllComplaints(token?: string): Promise<TeacherComplaint[]> {
    return ProviderFactory.getProvider().getAllComplaints(token);
  }

  /**
   * Update complaint status and provide official school management response
   */
  public static async updateComplaintStatus(
    dto: UpdateComplaintStatusDTO,
    token?: string
  ): Promise<boolean> {
    const success = await ProviderFactory.getProvider().updateComplaintStatus(dto, token);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smart_absensi_complaints_updated'));
    }
    return success;
  }
}
