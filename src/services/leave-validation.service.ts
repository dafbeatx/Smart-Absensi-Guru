import { getErrorDefinition } from '../config/error-codes';
import type { ErrorDefinition } from '../config/error-codes';
import type { LeaveRequest } from '../types/database.types';

export interface LeaveValidationResult {
  isValid: boolean;
  error?: ErrorDefinition;
}

export class LeaveValidationService {
  /**
   * Validates leave request date range, overlaps, and reason rules
   */
  public static validateLeaveRequest(
    startDateStr: string,
    endDateStr: string,
    reason: string,
    existingActiveLeaves: LeaveRequest[] = []
  ): LeaveValidationResult {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    // Rule 1: End date cannot be before start date (LEV_001)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return {
        isValid: false,
        error: getErrorDefinition('LEV_001'),
      };
    }

    // Rule 2: Minimum reason length 10 characters (LEV_004)
    if (!reason || reason.trim().length < 10) {
      return {
        isValid: false,
        error: getErrorDefinition('LEV_004'),
      };
    }

    // Rule 3: Check overlap with active leaves (LEV_003)
    for (const leave of existingActiveLeaves) {
      if (leave.approval_status !== 'REJECTED') {
        const leaveStart = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);

        const isOverlapping =
          (start >= leaveStart && start <= leaveEnd) ||
          (end >= leaveStart && end <= leaveEnd) ||
          (start <= leaveStart && end >= leaveEnd);

        if (isOverlapping) {
          return {
            isValid: false,
            error: getErrorDefinition('LEV_003'),
          };
        }
      }
    }

    return { isValid: true };
  }
}
