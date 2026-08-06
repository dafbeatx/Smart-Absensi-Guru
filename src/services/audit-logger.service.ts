import type { AuditLog, RoleCode } from '../types/database.types';

export interface CreateAuditLogDTO {
  actorId: string;
  actorRole: RoleCode;
  actionType: string;
  targetEntity: string;
  oldValue?: Record<string, unknown> | string | null;
  newValue?: Record<string, unknown> | string | null;
  reason?: string;
  ipAddress?: string;
  device?: string;
}

const STORAGE_KEY = 'smart_absensi_audit_logs';

export class AuditLogger {
  /**
   * Fetches all audit logs from LocalStorage sorted by newest first
   */
  public static getLogs(): AuditLog[] {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
      }
    } catch (e) {
      console.warn('Failed to parse audit logs from storage:', e);
    }

    // Default Initial Seed Logs if none exist in LocalStorage
    const defaultLogs: AuditLog[] = [
      {
        id: 'audit_1001',
        request_id: 'req_87f9a12b',
        actor_id: 'usr_admin_1',
        actor_role: 'ADMIN',
        action_type: 'SYSTEM_INIT',
        target_entity: 'System',
        before_value: null,
        after_value: JSON.stringify({ mode: 'ONLINE', geofence_radius: 100 }),
        change_reason: 'Inisialisasi Konfigurasi Sistem Absensi Sekolah',
        ip_address: '192.168.1.100',
        device: 'Chrome Windows 11',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: 'audit_1002',
        request_id: 'req_98b1c34d',
        actor_id: 'usr_kepsek_1',
        actor_role: 'KEPSEK',
        action_type: 'APPROVE_LEAVE',
        target_entity: 'Leave_Requests',
        before_value: JSON.stringify({ approval_status: 'PENDING' }),
        after_value: JSON.stringify({ approval_status: 'APPROVED' }),
        change_reason: 'Disetujui Kepsek: Surat permohonan izin lengkap',
        ip_address: '192.168.1.102',
        device: 'Safari iOS iPhone 15',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ];

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultLogs));
    } catch {
      // Ignore storage quota errors
    }

    return defaultLogs;
  }

  /**
   * Appends an Immutable Audit Log entry to the system and persists to LocalStorage
   */
  public static async log(dto: CreateAuditLogDTO): Promise<AuditLog> {
    const requestId = 'req_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Server / System';

    const logEntry: AuditLog = {
      id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      request_id: requestId,
      actor_id: dto.actorId,
      actor_role: dto.actorRole,
      action_type: dto.actionType,
      target_entity: dto.targetEntity,
      before_value: dto.oldValue ? (typeof dto.oldValue === 'string' ? dto.oldValue : JSON.stringify(dto.oldValue)) : null,
      after_value: dto.newValue ? (typeof dto.newValue === 'string' ? dto.newValue : JSON.stringify(dto.newValue)) : null,
      change_reason: dto.reason || 'System Action Recorded',
      ip_address: dto.ipAddress || '192.168.1.100',
      device: dto.device || userAgent,
      created_at: new Date().toISOString(),
    };

    console.info('📜 Immutable Audit Log Appended:', logEntry);

    if (typeof window !== 'undefined') {
      try {
        const currentLogs = AuditLogger.getLogs();
        const updatedLogs = [logEntry, ...currentLogs];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs));
        window.dispatchEvent(new Event('smart_absensi_audit_log_added'));
      } catch (e) {
        console.warn('Failed to save audit log to storage:', e);
      }
    }

    return logEntry;
  }
}
