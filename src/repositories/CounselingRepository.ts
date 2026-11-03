import { ProviderFactory } from '../providers/provider-factory';
import type {
  CounselingRecord,
  CreateCounselingDTO,
  UpdateCounselingDTO,
  CounselingFilter,
  CounselingStatistics,
} from '../types/counseling.types';
import {
  COUNSELING_TYPE_LABELS,
  COUNSELING_STATUS_LABELS,
  COUNSELING_URGENCY_LABELS,
} from '../types/counseling.types';
import { logger } from '../utils/logger.utils';

export const COUNSELING_CHANGED_EVENT = 'smart_absensi_counseling_updated';

export class CounselingRepository {
  /**
   * Mengambil seluruh data catatan BK dengan filter opsional.
   */
  static async getAll(filter?: CounselingFilter, token?: string): Promise<CounselingRecord[]> {
    try {
      const provider = ProviderFactory.getProvider();
      const records = await provider.getCounselingRecords(filter, token);
      return Array.isArray(records) ? records : [];
    } catch (error) {
      logger.error('CounselingRepository', 'Failed to fetch counseling records:', error);
      return [];
    }
  }

  /**
   * Membuat catatan BK baru dan menyinkronkannya.
   */
  static async create(dto: CreateCounselingDTO, token?: string): Promise<CounselingRecord> {
    const provider = ProviderFactory.getProvider();
    const result = await provider.createCounselingRecord(dto, token);
    this.broadcastChange();
    return result;
  }

  /**
   * Memperbarui data catatan BK.
   */
  static async update(
    id: string,
    dto: UpdateCounselingDTO,
    token?: string
  ): Promise<CounselingRecord | null> {
    const provider = ProviderFactory.getProvider();
    const result = await provider.updateCounselingRecord(id, dto, token);
    this.broadcastChange();
    return result;
  }

  /**
   * Menghapus catatan BK dari sistem.
   */
  static async delete(id: string, token?: string): Promise<boolean> {
    const provider = ProviderFactory.getProvider();
    const success = await provider.deleteCounselingRecord(id, token);
    if (success) {
      this.broadcastChange();
    }
    return success;
  }

  /**
   * Menghitung statistik metrik catatan BK untuk KPI header.
   */
  static calculateStatistics(records: CounselingRecord[]): CounselingStatistics {
    let resolvedCount = 0;
    let inProgressCount = 0;
    let highUrgencyCount = 0;
    let parentInvolvedCount = 0;
    let publicToNawasenaCount = 0;

    for (const r of records) {
      if (r.status === 'RESOLVED') resolvedCount++;
      if (r.status === 'IN_PROGRESS' || r.status === 'SCHEDULED' || r.status === 'MONITORING') inProgressCount++;
      if (r.urgency === 'HIGH') highUrgencyCount++;
      if (r.counseling_type === 'PARENT_CONFERENCE' || r.parent_involvement) parentInvolvedCount++;
      if (r.visibility === 'PUBLIC_STUDENT') publicToNawasenaCount++;
    }

    return {
      totalRecords: records.length,
      resolvedCount,
      inProgressCount,
      highUrgencyCount,
      parentInvolvedCount,
      publicToNawasenaCount,
    };
  }

  /**
   * Mengunduh rekap catatan BK dalam format CSV resmi.
   */
  static exportToCsv(records: CounselingRecord[]): void {
    if (!records || records.length === 0) return;

    const headers = [
      'No',
      'Tanggal',
      'Waktu',
      'Nama Siswa',
      'NISN',
      'Kelas',
      'Guru BK / Konselor',
      'NPP Konselor',
      'Jenis Layanan',
      'Tingkat Urgensi',
      'Status',
      'Visibilitas Nawasena',
      'Pokok Bahasan / Topik',
      'Latar Belakang / Masalah',
      'Tindakan / Solusi',
      'Komitmen Siswa',
      'Tindak Lanjut Orang Tua',
      'Rencana Pemantauan',
      'Tahun Ajaran',
    ];

    const rows = records.map((r, index) => [
      String(index + 1),
      r.counseling_date || '',
      r.counseling_time || '-',
      `"${(r.student_name || '').replace(/"/g, '""')}"`,
      r.student_nisn || '-',
      r.class_name || '',
      `"${(r.counselor_name || '').replace(/"/g, '""')}"`,
      r.counselor_npp || '-',
      COUNSELING_TYPE_LABELS[r.counseling_type] || r.counseling_type,
      COUNSELING_URGENCY_LABELS[r.urgency] || r.urgency,
      COUNSELING_STATUS_LABELS[r.status] || r.status,
      r.visibility === 'PUBLIC_STUDENT' ? 'Tampil di Nawasena Siswa' : 'Rahasia / Internal',
      `"${(r.topic || '').replace(/"/g, '""')}"`,
      `"${(r.background_narrative || '').replace(/"/g, '""')}"`,
      `"${(r.action_taken || '').replace(/"/g, '""')}"`,
      `"${(r.student_commitment || '').replace(/"/g, '""')}"`,
      `"${(r.parent_involvement || '').replace(/"/g, '""')}"`,
      `"${(r.follow_up_plan || '').replace(/"/g, '""')}"`,
      r.academic_year || '2026/2027',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rekap_Catatan_BK_SMPT_Al_Ittihadiyah_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Memancarkan event broadcast agar seluruh UI reaktif seketika.
   */
  static broadcastChange(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(COUNSELING_CHANGED_EVENT));
    }
  }
}

