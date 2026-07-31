/**
 * SMART ABSENSI GURU - LEAVE & APPROVAL ENGINE TEST SUITE
 */

import { LeaveValidationService } from '../leave-validation.service';
import { ApprovalEngine } from '../approval-engine.service';
import type { LeaveRequest } from '../../types/database.types';

export const runLeaveApprovalTestSuite = async (): Promise<{
  passed: number;
  failed: number;
  results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }>;
}> => {
  const results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }> = [];
  let passed = 0;
  let failed = 0;

  const assert = (testName: string, condition: boolean, details?: string) => {
    if (condition) {
      passed++;
      results.push({ testName, status: 'PASS', details });
    } else {
      failed++;
      results.push({ testName, status: 'FAIL', details });
    }
  };

  // Test 1: Leave Date Range Validation (End date before start date -> LEV_001)
  const invalidDateRange = LeaveValidationService.validateLeaveRequest(
    '2026-08-05',
    '2026-08-01',
    'Alasan berobat sakit demam tinggi'
  );
  assert(
    'Leave Validation - End Date Before Start Date Ditolak (LEV_001)',
    invalidDateRange.isValid === false && invalidDateRange.error?.code === 'LEV_001'
  );

  // Test 2: Leave Reason Minimum Length Validation (< 10 chars -> LEV_004)
  const shortReason = LeaveValidationService.validateLeaveRequest(
    '2026-08-01',
    '2026-08-02',
    'Sakit'
  );
  assert(
    'Leave Validation - Reason Under 10 Chars Ditolak (LEV_004)',
    shortReason.isValid === false && shortReason.error?.code === 'LEV_004'
  );

  // Test 3: Overlapping Active Leave Detection (LEV_003)
  const mockActiveLeaves: LeaveRequest[] = [
    {
      id: 'leave_101',
      user_id: 'usr_uuid_1001',
      leave_type: 'SAKIT',
      start_date: '2026-08-01',
      end_date: '2026-08-05',
      reason: 'Sakit dirawat di rumah sakit',
      attachment_url: null,
      approval_status: 'PENDING',
      approval_deadline: '2026-08-04T00:00:00Z',
      created_at: new Date().toISOString(),
    },
  ];

  const overlappingRequest = LeaveValidationService.validateLeaveRequest(
    '2026-08-03',
    '2026-08-07',
    'Izin keperluan keluarga mendesak',
    mockActiveLeaves
  );
  assert(
    'Leave Validation - Overlapping Leave Detection Ditolak (LEV_003)',
    overlappingRequest.isValid === false && overlappingRequest.error?.code === 'LEV_003'
  );

  // Test 4: Approval State Machine - Valid Transition (SUBMITTED -> APPROVED by KEPSEK)
  const mockLeaveReq: LeaveRequest = {
    id: 'leave_102',
    user_id: 'usr_uuid_1001',
    leave_type: 'IZIN',
    start_date: '2026-08-10',
    end_date: '2026-08-11',
    reason: 'Izin mengurus dokumen resmi keluarga',
    attachment_url: null,
    approval_status: 'PENDING',
    approval_deadline: '2026-08-13T00:00:00Z',
    created_at: new Date().toISOString(),
  };

  const validApproval = ApprovalEngine.executeStateTransition(
    mockLeaveReq,
    'APPROVE',
    'KEPSEK'
  );
  assert(
    'Approval Engine - Valid Transition SUBMITTED -> APPROVED by KEPSEK',
    validApproval.success === true && validApproval.newState === 'APPROVED'
  );

  // Test 5: Approval State Machine - Rejection requires mandatory notes
  const invalidRejection = ApprovalEngine.executeStateTransition(
    mockLeaveReq,
    'REJECT',
    'KEPSEK',
    '' // Empty notes
  );
  assert(
    'Approval Engine - Rejection Without Mandatory Notes Ditolak (LEV_004)',
    invalidRejection.success === false && invalidRejection.error?.code === 'LEV_004'
  );

  return { passed, failed, results };
};
