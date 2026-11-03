import { ProviderFactory } from '../providers/provider-factory';
import type {
  BimtekRecord,
  CreateBimtekDTO,
  UpdateBimtekDTO,
  VerifyBimtekDTO,
  BimtekStatistics,
  BimtekActivityType,
  BimtekScope,
} from '../types/bimtek.types';
import {
  BIMTEK_ACTIVITY_LABELS,
  BIMTEK_SCOPE_LABELS,
  BIMTEK_ROLE_LABELS,
  BIMTEK_METHOD_LABELS,
  BIMTEK_STATUS_LABELS,
} from '../types/bimtek.types';

export const BIMTEK_CHANGED_EVENT = 'smart_absensi_bimtek_changed';

export class BimtekRepository {
  /**
   * Mengambil semua catatan bimtek untuk Admin dan Kepala Sekolah
   */
  public static async getAll(token?: string): Promise<BimtekRecord[]> {
    const provider = ProviderFactory.getProvider();
    return provider.getBimtekRecords(undefined, token);
  }

  /**
   * Mengambil catatan bimtek milik guru tertentu
   */
  public static async getByUserId(userId: string, token?: string): Promise<BimtekRecord[]> {
    const provider = ProviderFactory.getProvider();
    return provider.getBimtekRecords(userId, token);
  }

  /**
   * Mencatat kegiatan bimtek baru
   */
  public static async create(dto: CreateBimtekDTO, token?: string): Promise<BimtekRecord> {
    const provider = ProviderFactory.getProvider();
    const result = await provider.createBimtekRecord(dto, token);
    this.broadcastChange();
    return result;
  }

  /**
   * Memperbarui data bimtek yang sudah ada
   */
  public static async update(
    id: string,
    dto: UpdateBimtekDTO,
    token?: string
  ): Promise<BimtekRecord | null> {
    const provider = ProviderFactory.getProvider();
    const result = await provider.updateBimtekRecord(id, dto, token);
    this.broadcastChange();
    return result;
  }

  /**
   * Memvalidasi atau merevisi bukti sertifikat bimtek (oleh Kepsek / Admin)
   */
  public static async verify(
    id: string,
    dto: VerifyBimtekDTO,
    token?: string
  ): Promise<boolean> {
    const provider = ProviderFactory.getProvider();
    const result = await provider.verifyBimtekRecord(id, dto, token);
    this.broadcastChange();
    return result;
  }

  /**
   * Menghapus catatan bimtek
   */
  public static async delete(id: string, token?: string): Promise<boolean> {
    const provider = ProviderFactory.getProvider();
    const result = await provider.deleteBimtekRecord(id, token);
    this.broadcastChange();
    return result;
  }

  /**
   * Memancarkan event pembaruan ke seluruh komponen
   */
  public static broadcastChange(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(BIMTEK_CHANGED_EVENT));
    }
  }

  /**
   * Menghitung statistik akumulasi JP, jenis kegiatan, dan sertifikat bimtek
   */
  public static calculateStatistics(records: BimtekRecord[]): BimtekStatistics {
    const initialByActivity: Record<BimtekActivityType, number> = {
      BIMTEK: 0,
      DIKLAT: 0,
      WORKSHOP: 0,
      WEBINAR: 0,
      SEMINAR: 0,
      PELATIHAN_MANDIRI_PMM: 0,
      LAINNYA: 0,
    };

    const initialByScope: Record<BimtekScope, number> = {
      SEKOLAH: 0,
      GUGUS_KECAMATAN: 0,
      KOTA_KABUPATEN: 0,
      PROVINSI: 0,
      NASIONAL: 0,
      INTERNASIONAL: 0,
    };

    let totalDurationHours = 0;
    let totalCertificates = 0;
    let approvedCount = 0;
    let submittedCount = 0;
    let revisionCount = 0;
    const uniqueTeachers = new Set<string>();

    for (const item of records) {
      totalDurationHours += Number(item.duration_hours) || 0;
      if (item.certificate_number || item.certificate_url) {
        totalCertificates += 1;
      }
      if (item.status === 'APPROVED') approvedCount += 1;
      else if (item.status === 'REVISION') revisionCount += 1;
      else submittedCount += 1;

      if (item.user_id) {
        uniqueTeachers.add(item.user_id);
      }

      if (item.activity_type && initialByActivity[item.activity_type] !== undefined) {
        initialByActivity[item.activity_type] += 1;
      }
      if (item.scope && initialByScope[item.scope] !== undefined) {
        initialByScope[item.scope] += 1;
      }
    }

    return {
      totalActivities: records.length,
      totalDurationHours,
      totalCertificates,
      approvedCount,
      submittedCount,
      revisionCount,
      activeTeachersCount: uniqueTeachers.size,
      byActivityType: initialByActivity,
      byScope: initialByScope,
    };
  }

  /**
   * Ekspor data rekapitulasi bimtek ke format CSV resmi
   */
  public static exportToCsv(records: BimtekRecord[], academicYear: string = '2026/2027'): void {
    if (typeof window === 'undefined' || records.length === 0) return;

    const headers = [
      'No',
      'Nama Guru',
      'NPP',
      'Nama Kegiatan Bimtek/Diklat',
      'Jenis Kegiatan',
      'Penyelenggara',
      'Tingkat/Cakupan',
      'Peran',
      'Metode',
      'Tanggal Mulai',
      'Tanggal Selesai',
      'Durasi (JP)',
      'Tempat / Platform',
      'Nomor Sertifikat',
      'Tautan Dokumen Sertifikat',
      'Nomor Surat Tugas',
      'Status Validasi',
      'Verifikator',
    ];

    const rows = records.map((r, index) => [
      String(index + 1),
      `"${(r.teacher_name || '').replace(/"/g, '""')}"`,
      `"${(r.teacher_nip || '-').replace(/"/g, '""')}"`,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${BIMTEK_ACTIVITY_LABELS[r.activity_type] || r.activity_type}"`,
      `"${(r.organizer || '').replace(/"/g, '""')}"`,
      `"${BIMTEK_SCOPE_LABELS[r.scope] || r.scope}"`,
      `"${BIMTEK_ROLE_LABELS[r.role] || r.role}"`,
      `"${BIMTEK_METHOD_LABELS[r.execution_method] || r.execution_method}"`,
      r.start_date || '-',
      r.end_date || '-',
      String(r.duration_hours || 0),
      `"${(r.location_or_platform || '').replace(/"/g, '""')}"`,
      `"${(r.certificate_number || '-').replace(/"/g, '""')}"`,
      `"${(r.certificate_url || '-').replace(/"/g, '""')}"`,
      `"${(r.assignment_letter_number || '-').replace(/"/g, '""')}"`,
      `"${BIMTEK_STATUS_LABELS[r.status] || r.status}"`,
      `"${(r.verified_by || '-').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeYear = academicYear.replace('/', '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rekap_Bimtek_Guru_${safeYear}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
