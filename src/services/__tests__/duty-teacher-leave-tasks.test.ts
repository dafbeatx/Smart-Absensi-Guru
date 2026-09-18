/**
 * SMART ABSENSI GURU - DUTY TEACHER LEAVE TASKS & BROADCAST TEST SUITE
 * Verifies that:
 * 1. Leave submission accepts and persists `duty_teacher_notes` (tugas titipan untuk guru piket).
 * 2. Broadcast notification is triggered for all teachers/staff upon leave application.
 * 3. Leaves overlapping today with duty notes are correctly filtered for the duty teacher's Beranda.
 */

import { LeaveRepository } from '../../repositories/LeaveRepository';
import { NotificationService } from '../notification-permission.service';
import { ProviderFactory } from '../../providers/provider-factory';
import { useAuthStore } from '../../store/useAuthStore';
import type { TestResultItem } from '../test-runner.service';
import type { LeaveRequest } from '../../types/database.types';

export const runDutyTeacherLeaveTasksTestSuite = async (): Promise<{
  passed: number;
  failed: number;
  results: TestResultItem[];
}> => {
  const results: TestResultItem[] = [];
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

  const provider = ProviderFactory.getProvider();
  const todayStr = new Date().toISOString().split('T')[0];

  // Save current auth user state to restore afterwards
  const previousAuthUser = useAuthStore.getState().user;

  try {
    // Setup authenticated teacher for testing
    useAuthStore.setState({
      user: {
        id: 'usr_test_duty_01',
        full_name: 'Budi Santoso, S.Pd.',
        npp: 'NPP-102938',
        role: 'GURU',
        email: 'budi@sekolah.sch.id',
        department: 'Matematika',
      } as any,
    });

    // =========================================================================
    // Test 1: Submit leave with duty_teacher_notes via LeaveRepository
    // =========================================================================
    const testDutyNotes = 'Tugas Mandiri: Kerjakan LKS Matematika Halaman 45-48 di buku tugas.';
    const submittedLeave = await LeaveRepository.submitLeave({
      token: 'mock_duty_test_token',
      leave_type: 'IZIN',
      start_date: todayStr,
      end_date: todayStr,
      reason: 'Menghadiri lokakarya kurikulum dinas pendidikan',
      duty_teacher_notes: testDutyNotes,
    });

    assert(
      'Leave Submission - Berhasil mengirim permohonan izin dengan catatan tugas guru piket',
      Boolean(submittedLeave && submittedLeave.id),
      `Leave ID: ${submittedLeave?.id}`
    );

    assert(
      'Leave Persistence - duty_teacher_notes tersimpan dengan nilai yang sesuai',
      submittedLeave.duty_teacher_notes === testDutyNotes,
      `Tersimpan: ${submittedLeave.duty_teacher_notes}`
    );

    // =========================================================================
    // Test 2: Provider retrieval preserves duty_teacher_notes
    // =========================================================================
    const userLeaves = await provider.getUserLeaves('usr_test_duty_01', 'mock_token');
    const foundLeave = userLeaves.find((l) => l.id === submittedLeave.id);

    assert(
      'Provider Retrieval - getUserLeaves mengembalikan duty_teacher_notes lengkap',
      foundLeave !== undefined && foundLeave.duty_teacher_notes === testDutyNotes,
      foundLeave ? `Notes: ${foundLeave.duty_teacher_notes}` : 'Leave tidak ditemukan'
    );

    // =========================================================================
    // Test 3: Broadcast notification to all teachers/staff on leave application
    // =========================================================================
    const broadcastNotification = NotificationService.broadcastTeacherLeaveAnnouncement(
      'Budi Santoso, S.Pd.',
      'IZIN',
      todayStr,
      todayStr,
      'Menghadiri lokakarya kurikulum dinas pendidikan',
      testDutyNotes
    );

    assert(
      'Broadcast Notification - Menghasilkan notifikasi dengan roleTarget ALL untuk seluruh guru',
      broadcastNotification.roleTarget === 'ALL' && broadcastNotification.type === 'PENGUMUMAN',
      `RoleTarget: ${broadcastNotification.roleTarget}, Type: ${broadcastNotification.type}`
    );

    assert(
      'Broadcast Content - Pesan memuat nama guru, jenis izin, dan catatan titipan',
      broadcastNotification.body.includes('Budi Santoso, S.Pd.') &&
        broadcastNotification.body.includes('IZIN') &&
        broadcastNotification.body.includes('Tugas untuk guru piket'),
      `Body: ${broadcastNotification.body}`
    );

    // =========================================================================
    // Test 4: Duty Teacher Beranda Task Filter Logic
    // =========================================================================
    // Emulate GuruDashboardPage filter:
    // start_date <= todayStr && end_date >= todayStr && status !== 'REJECTED' && user_id !== currentDutyTeacherId
    const currentDutyTeacherId = 'usr_duty_teacher_today_99';
    const allLeaves = await provider.getAllLeaves('mock_token');

    // Create another leave that is REJECTED to verify it is filtered out
    const rejectedLeave: LeaveRequest = {
      id: 'leave_rejected_mock',
      user_id: 'usr_other_teacher_02',
      leave_type: 'SAKIT',
      start_date: todayStr,
      end_date: todayStr,
      reason: 'Sakit flu',
      duty_teacher_notes: 'Tugas yang ditolak tidak boleh muncul di piket',
      attachment_url: null,
      approval_deadline: new Date().toISOString(),
      approval_status: 'REJECTED',
      created_at: new Date().toISOString(),
    };

    const activeLeavesForDutyTeacher = [...allLeaves, rejectedLeave].filter((l) => {
      const isDateMatch = l.start_date <= todayStr && l.end_date >= todayStr;
      const isNotRejected = l.approval_status !== 'REJECTED';
      const isNotMe = l.user_id !== currentDutyTeacherId;
      return isDateMatch && isNotRejected && isNotMe && Boolean(l.duty_teacher_notes);
    });

    const hasOurSubmittedTask = activeLeavesForDutyTeacher.some(
      (l) => l.user_id === 'usr_test_duty_01' && l.duty_teacher_notes === testDutyNotes
    );

    const hasRejectedTask = activeLeavesForDutyTeacher.some((l) => l.id === 'leave_rejected_mock');

    assert(
      'Duty Teacher Filter - Menemukan tugas titipan guru izin hari ini untuk beranda piket',
      hasOurSubmittedTask === true,
      `Found tasks count: ${activeLeavesForDutyTeacher.length}`
    );

    assert(
      'Duty Teacher Filter - Mengabaikan tugas dari izin berstatus REJECTED',
      hasRejectedTask === false,
      'Rejected task wrongly included'
    );
  } finally {
    // Restore previous auth state
    useAuthStore.setState({ user: previousAuthUser });
  }

  return { passed, failed, results };
};
