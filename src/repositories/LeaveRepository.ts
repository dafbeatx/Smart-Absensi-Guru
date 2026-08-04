import { ProviderFactory } from '../providers/provider-factory';
import type { LeaveRequest } from '../types/database.types';

export interface SubmitLeaveDTO {
  token: string;
  leave_type: 'SAKIT' | 'IZIN' | 'DINAS_LUAR' | 'KOREKSI_ABSEN';
  start_date: string;
  end_date: string;
  reason: string;
  attachment_base64?: string;
}

export class LeaveRepository {
  public static async submitLeave(dto: SubmitLeaveDTO): Promise<LeaveRequest> {
    return ProviderFactory.getProvider().submitLeave(dto);
  }

  public static async approveLeave(leaveId: string, decision: 'APPROVED' | 'REJECTED', notes: string, token: string): Promise<boolean> {
    return ProviderFactory.getProvider().approveLeave(leaveId, decision, notes, token);
  }

  public static async getPendingLeaves(token: string): Promise<LeaveRequest[]> {
    return ProviderFactory.getProvider().getPendingLeaves(token);
  }
}
