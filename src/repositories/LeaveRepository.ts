import { ProviderFactory } from '../providers/provider-factory';
import type { LeaveRequest, LeaveType } from '../types/database.types';
import { useAuthStore } from '../store/useAuthStore';
import { logger } from '../utils/logger.utils';
import { AuditLogger } from '../services/audit-logger.service';

export interface SubmitLeaveDTO {
  token: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  attachment_url?: string;
  attachment_base64?: string;
}

export class LeaveRepository {
  public static async submitLeave(dto: SubmitLeaveDTO): Promise<LeaveRequest> {
    const activeUser = useAuthStore.getState().user;
    if (!activeUser || !activeUser.id) {
      logger.error('LeaveRepository', 'submitLeave failed: Active user ID not found in auth store');
      throw new Error('Sesi pengguna tidak valid. Silakan login ulang.');
    }

    logger.info('LeaveRepository', 'Submitting leave application for user:', { userId: activeUser.id, leave_type: dto.leave_type });
    const res = await ProviderFactory.getProvider().submitLeave(dto);

    await AuditLogger.log({
      actorId: activeUser.id,
      actorRole: activeUser.role || 'GURU',
      actionType: 'SUBMIT_LEAVE',
      targetEntity: 'Leave_Requests',
      newValue: { leave_type: dto.leave_type, start_date: dto.start_date, end_date: dto.end_date },
      reason: `Pengajuan ${dto.leave_type}: ${dto.reason}`,
    }).catch(() => {});

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smart_absensi_leave_updated'));
      window.dispatchEvent(new Event('smart_absensi_records_updated'));
    }
    return res;
  }

  public static async approveLeave(leaveId: string, decision: 'APPROVED' | 'REJECTED', notes: string, token: string): Promise<boolean> {
    const activeUser = useAuthStore.getState().user;
    const res = await ProviderFactory.getProvider().approveLeave(leaveId, decision, notes, token);

    await AuditLogger.log({
      actorId: activeUser?.id || 'usr_kepsek_1',
      actorRole: activeUser?.role || 'KEPSEK',
      actionType: decision === 'APPROVED' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
      targetEntity: 'Leave_Requests',
      oldValue: { approval_status: 'PENDING' },
      newValue: { approval_status: decision },
      reason: notes || `Keputusan ${decision} permohonan izin ID ${leaveId}`,
    }).catch(() => {});

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smart_absensi_leave_updated'));
      window.dispatchEvent(new Event('smart_absensi_records_updated'));
    }
    return res;
  }

  public static async getPendingLeaves(token: string): Promise<LeaveRequest[]> {
    return ProviderFactory.getProvider().getPendingLeaves(token);
  }
}
