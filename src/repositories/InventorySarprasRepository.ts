import { ProviderFactory } from '../providers/provider-factory';
import type {
  InventorySarprasItem,
  CreateInventorySarprasDTO,
  UpdateInventorySarprasDTO,
} from '../types/database.types';

export interface SarprasStatistics {
  totalItems: number;        // Total macam/jenis aset
  totalUnits: number;        // Akumulasi unit fisik
  layakCount: number;        // Jumlah barang layak
  layakUnits: number;        // Total unit layak
  rusakCount: number;        // Jumlah barang rusak
  rusakUnits: number;        // Total unit rusak
  roomsCount: number;        // Jumlah ruangan terdata
  needPurchaseCount: number; // Jumlah jenis aset yang butuh pengadaan/beli
}

export class InventorySarprasRepository {
  public static readonly COMMON_ROOMS: string[] = [
    'Ruang Guru',
    'Ruang Kepala Sekolah',
    'Lab Komputer',
    'Lab IPA',
    'Perpustakaan',
    'Ruang Tata Usaha (TU)',
    'Ruang UKS',
    'Ruang Kelas 7A',
    'Ruang Kelas 7B',
    'Ruang Kelas 8A',
    'Ruang Kelas 8B',
    'Ruang Kelas 9A',
    'Ruang Kelas 9B',
    'Musholla / Masjid',
    'Gudang Sarpras',
    'Lapangan Olahraga',
  ];

  public static readonly COMMON_FUNDING_SOURCES: string[] = [
    'BOS Reguler',
    'BOS Kinerja',
    'Yayasan / Komite Sekolah',
    'Bantuan Pemerintah (DAK)',
    'Bantuan Hibah / Donatur',
    'Swadaya Sekolah',
  ];

  public static async getAll(token?: string): Promise<InventorySarprasItem[]> {
    const provider = ProviderFactory.getProvider();
    return provider.getInventorySarpras(token);
  }

  public static async create(
    dto: CreateInventorySarprasDTO,
    token?: string
  ): Promise<InventorySarprasItem> {
    const provider = ProviderFactory.getProvider();
    return provider.createInventorySarpras(dto, token);
  }

  public static async update(
    id: string,
    dto: UpdateInventorySarprasDTO,
    token?: string
  ): Promise<boolean> {
    const provider = ProviderFactory.getProvider();
    return provider.updateInventorySarpras(id, dto, token);
  }

  public static async delete(id: string, token?: string): Promise<boolean> {
    const provider = ProviderFactory.getProvider();
    return provider.deleteInventorySarpras(id, token);
  }

  public static calculateStatistics(items: InventorySarprasItem[]): SarprasStatistics {
    let totalUnits = 0;
    let layakCount = 0;
    let layakUnits = 0;
    let rusakCount = 0;
    let rusakUnits = 0;
    let needPurchaseCount = 0;
    const roomSet = new Set<string>();

    for (const item of items) {
      const units = Number(item.jumlah_total) || 0;
      totalUnits += units;
      if (item.ruangan) roomSet.add(item.ruangan.trim());

      if (item.kondisi === 'LAYAK') {
        layakCount++;
        layakUnits += units;
      } else {
        rusakCount++;
        rusakUnits += units;
      }

      const purchaseReq = (item.yang_harus_dibeli || '').trim();
      if (purchaseReq && purchaseReq !== '0' && purchaseReq !== '-') {
        needPurchaseCount++;
      }
    }

    return {
      totalItems: items.length,
      totalUnits,
      layakCount,
      layakUnits,
      rusakCount,
      rusakUnits,
      roomsCount: roomSet.size,
      needPurchaseCount,
    };
  }

  public static exportToCSV(items: InventorySarprasItem[]): void {
    if (typeof window === 'undefined') return;

    const headers = [
      'No',
      'Ruangan',
      'Nama Barang',
      'Jumlah Total',
      'Merek',
      'Tahun Perolehan',
      'Kondisi',
      'Yang Harus Dibeli',
      'Sumber Dana',
      'Keterangan',
      'Diisi Oleh',
      'Terakhir Diperbarui',
    ];

    const rows = items.map((item, idx) => [
      idx + 1,
      `"${(item.ruangan || '').replace(/"/g, '""')}"`,
      `"${(item.nama_barang || '').replace(/"/g, '""')}"`,
      item.jumlah_total,
      `"${(item.merek || '').replace(/"/g, '""')}"`,
      item.tahun_perolehan,
      item.kondisi,
      `"${(item.yang_harus_dibeli || '0').replace(/"/g, '""')}"`,
      `"${(item.sumber_dana || '').replace(/"/g, '""')}"`,
      `"${(item.keterangan || '-').replace(/"/g, '""')}"`,
      `"${(item.created_by_name || 'M. Iqbal Gustiawan').replace(/"/g, '""')}"`,
      item.updated_at ? new Date(item.updated_at).toLocaleDateString('id-ID') : '-',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Inventaris_Sarpras_Sekolah_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
