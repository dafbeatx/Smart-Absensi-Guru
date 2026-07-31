export interface NotificationVariables {
  nama?: string;
  jenis?: string;
  tanggal?: string;
  waktu?: string;
  status?: string;
  alasan?: string;
  link?: string;
  [key: string]: string | undefined;
}

export const DEFAULT_TEMPLATES: Record<string, string> = {
  LEAVE_SUBMIT:
    '📩 *Pengajuan {{jenis}}*\n👤 *{{nama}}*\n📅 Tanggal: {{tanggal}} ({{waktu}})\n📝 Alasan: {{alasan}}\n🔗 {{link}}',

  LEAVE_APPROVE:
    '🟢 *Pengajuan {{jenis}} Disetujui*\n👤 *{{nama}}*\n📅 Tanggal: {{tanggal}}\n📝 Catatan Kepsek: {{alasan}}\n🔗 {{link}}',

  LEAVE_REJECT:
    '🔴 *Pengajuan {{jenis}} Ditolak*\n👤 *{{nama}}*\n📅 Tanggal: {{tanggal}}\n📝 Alasan Penolakan: {{alasan}}\n🔗 {{link}}',

  CORRECTION_SUBMIT:
    '⚠️ *Pengajuan Koreksi Absen*\n👤 *{{nama}}*\n📅 Tanggal: {{tanggal}} ({{waktu}})\n📝 Alasan: {{alasan}}\n🔗 {{link}}',

  AUDIT_ALERT:
    '🛠️ *Perubahan Data Absensi oleh Operator*\n👤 Guru: *{{nama}}*\n🔄 Perubahan: {{status}}\n📝 Alasan: {{alasan}}\n🔗 {{link}}',
};

export class NotificationTemplateEngine {
  /**
   * Renders a notification template by replacing mustache variables {{var}}
   */
  public static render(templateCode: string, variables: NotificationVariables): string {
    const rawTemplate = DEFAULT_TEMPLATES[templateCode] || templateCode;

    return rawTemplate.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] !== undefined ? variables[key]! : '';
    });
  }
}
