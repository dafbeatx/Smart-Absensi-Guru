import type { AuditLog, RoleCode } from '../types/database.types';
import { TelegramService } from './telegram.service';

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

export class AuditLogger {
  /**
   * Fetches latest audit logs (now routed to Telegram Channel)
   */
  public static getLogs(): AuditLog[] {
    return [];
  }

  /**
   * Dispatches an Audit Log entry directly to the Telegram Channel
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

    console.info('🛡️ Telegram Audit Log Dispatch:', logEntry);

    // Forward immediately to Telegram Bot Channel
    TelegramService.sendAuditLog({
      actorId: dto.actorId,
      actorRole: dto.actorRole,
      actionType: dto.actionType,
      targetEntity: dto.targetEntity,
      reason: dto.reason,
      details: dto.newValue ? (typeof dto.newValue === 'string' ? dto.newValue : JSON.stringify(dto.newValue)) : undefined,
    }).catch((err) => {
      console.warn('Telegram audit dispatch error:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smart_absensi_audit_log_added'));
    }

    return logEntry;
  }
}

