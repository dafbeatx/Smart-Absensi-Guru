import type { ErrorDefinition } from '../config/error-codes';
import type { LeaveRequest, RoleCode } from '../types/database.types';

export type ApprovalState =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLOSED';

export interface ApprovalTransitionResult {
  success: boolean;
  previousState: ApprovalState;
  newState: ApprovalState;
  error?: ErrorDefinition;
}

export class ApprovalEngine {
  /**
   * Validates state transition rules for Approval State Machine
   */
  public static canTransition(from: ApprovalState, to: ApprovalState): boolean {
    const validTransitions: Record<ApprovalState, ApprovalState[]> = {
      DRAFT: ['SUBMITTED'],
      SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      UNDER_REVIEW: ['APPROVED', 'REJECTED'],
      APPROVED: ['CLOSED'],
      REJECTED: ['CLOSED'],
      CLOSED: [],
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Executes Approval State Transition with Rule Validation
   */
  public static executeStateTransition(
    leaveRequest: LeaveRequest,
    action: 'APPROVE' | 'REJECT',
    actorRole: RoleCode,
    notes?: string
  ): ApprovalTransitionResult {
    const currentState: ApprovalState =
      leaveRequest.approval_status === 'APPROVED'
        ? 'APPROVED'
        : leaveRequest.approval_status === 'REJECTED'
        ? 'REJECTED'
        : 'SUBMITTED';

    // Role check: Only Kepsek or Operator can decide approvals
    if (actorRole !== 'KEPSEK' && actorRole !== 'OPERATOR') {
      return {
        success: false,
        previousState: currentState,
        newState: currentState,
        error: {
          code: 'AUTH_004',
          message: 'Anda tidak memiliki hak akses untuk menyetujui pengajuan.',
          solution: 'Persetujuan hanya dapat dilakukan oleh Kepala Sekolah atau Operator.',
        },
      };
    }

    const targetState: ApprovalState = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    if (!ApprovalEngine.canTransition(currentState, targetState)) {
      return {
        success: false,
        previousState: currentState,
        newState: currentState,
        error: {
          code: 'SYS_001',
          message: `Transisi status pengajuan dari ${currentState} ke ${targetState} tidak diperbolehkan.`,
          solution: 'Pengajuan yang sudah diputuskan tidak dapat diubah secara langsung.',
        },
      };
    }

    // Mandatory notes check for rejection
    if (action === 'REJECT' && (!notes || notes.trim().length < 5)) {
      return {
        success: false,
        previousState: currentState,
        newState: currentState,
        error: {
          code: 'LEV_004',
          message: 'Alasan penolakan pengajuan wajib diisi minimal 5 karakter.',
          solution: 'Tuliskan alasan penolakan agar guru memahami pertimbangan Anda.',
        },
      };
    }

    return {
      success: true,
      previousState: currentState,
      newState: targetState,
    };
  }
}
