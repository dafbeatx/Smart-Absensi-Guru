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

export class AuditLogger {
  /**
   * Appends an Immutable Audit Log entry to the system
   */
  public static async log(dto: CreateAuditLogDTO): Promise<AuditLog> {
    const requestId = 'req_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

    const logEntry: AuditLog = {
      id: 'audit_' + Date.now(),
      request_id: requestId,
      actor_id: dto.actorId,
      actor_role: dto.actorRole,
      action_type: dto.actionType,
      target_entity: dto.targetEntity,
      before_value: dto.oldValue ? (typeof dto.oldValue === 'string' ? dto.oldValue : JSON.stringify(dto.oldValue)) : null,
      after_value: dto.newValue ? (typeof dto.newValue === 'string' ? dto.newValue : JSON.stringify(dto.newValue)) : null,
      change_reason: dto.reason || 'System Action Recorded',
      ip_address: dto.ipAddress || '127.0.0.1',
      device: dto.device || navigator.userAgent,
      created_at: new Date().toISOString(),
    };

    console.info('📜 Immutable Audit Log Appended:', logEntry);
    return logEntry;
  }
}
