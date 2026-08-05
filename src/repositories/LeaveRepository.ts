import { ProviderFactory } from '../providers/provider-factory';
import type { LeaveRequest, LeaveType } from '../types/database.types';
import { useAuthStore } from '../store/useAuthStore';
import { logger } from '../utils/logger.utils';

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
    return ProviderFactory.getProvider().submitLeave(dto);
  }

  public static async approveLeave(leaveId: string, decision: 'APPROVED' | 'REJECTED', notes: string, token: string): Promise<boolean> {
    return ProviderFactory.getProvider().approveLeave(leaveId, decision, notes, token);
  }

  public static async getPendingLeaves(token: string): Promise<LeaveRequest[]> {
    return ProviderFactory.getProvider().getPendingLeaves(token);
  }
}
