/**
 * SMART ABSENSI GURU — PHASE 4.3 HOMEROOM & STUDENT CONTINUATION SECURITY TEST SUITE
 *
 * Menguji seluruh skenario keamanan, autorisasi, dan isolasi data Ruang Wali Kelas:
 * 1. Overview API: Wali kelas 9A berhasil mengakses overview kelas 9A dengan kalkulasi statistik akurat.
 * 2. Students Roster API: Wali kelas 9A berhasil memuat daftar siswa rombel 9A.
 * 3. Student Detail API: Wali kelas 9A berhasil memuat data relasional lengkap siswa rombel 9A.
 * 4. Class Isolation (Detail): Wali kelas 9A diblokir dengan 403 AUTH_FORBIDDEN_CLASS_MISMATCH saat mencoba mengakses detail siswa rombel 9B.
 * 5. Class Isolation (Download): Wali kelas 9A diblokir dengan 403 AUTH_FORBIDDEN_CLASS_MISMATCH saat mencoba mengunduh dokumen siswa rombel 9B.
 * 6. Non-Homeroom Teacher Blocked: Guru tanpa SK wewenang wali kelas diblokir dengan 403 AUTH_FORBIDDEN_NOT_HOMEROOM.
 * 7. Inactive Assignment Blocked: Guru dengan wewenang nonaktif (is_active = false) diblokir dengan 403 AUTH_FORBIDDEN_NOT_HOMEROOM.
 * 8. Missing Session Token: Request tanpa header Authorization ditolak dengan 401 AUTH_SESSION_MISSING.
 * 9. Forged Session Token: Token sesi palsu/buatan client ditolak dengan 401 AUTH_SESSION_INVALID.
 * 10. Zero-Trust Class Spoofing: Parameter class_name manipulatif diabaikan; server mengikat otoritas dari database assignment.
 * 11. Plan Verification (Approval): Verifikasi persetujuan (verified) berhasil mengeksekusi stored procedure rpc_verify_continuation_plan.
 * 12. Plan Verification (Revision Validation): Keputusan needs_revision tanpa catatan wajib ditolak 400 VALIDATION_ERROR.
 * 13. Read-Only Protection: Role KEPSEK diblokir dari mutasi verifikasi dengan 403 AUTH_FORBIDDEN_READONLY.
 * 14. Privileged Cross-Class Access: Role ADMIN dapat mengakses data rombel manapun secara tersentralisasi.
 * 15. Short-Lived Signed URL: Dokumen private menghasilkan signed URL berbatas waktu 15 menit (900 detik).
 * 16. Provider Pattern Abstraction: HomeroomRepository memanggil ProviderFactory.getProvider() secara konsisten.
 */

import crypto from 'crypto';
import overviewHandler from '../../../api/homeroom/overview';
import studentsHandler from '../../../api/homeroom/students';
import studentDetailHandler from '../../../api/homeroom/student-detail';
import verifyPlanHandler from '../../../api/homeroom/verify-plan';
import documentDownloadHandler from '../../../api/homeroom/document-download';
import {
  hashSessionToken,
  setServerSupabaseClient,
  resetServerSupabaseClient,
} from '../../../api/_shared/session-auth';
import { HomeroomRepository } from '../../repositories/HomeroomRepository';
import { ProviderFactory } from '../../providers/provider-factory';
import { MockProvider } from '../../providers/mock-provider.service';
import type { TestSuiteResult } from '../test-runner.service';

function createMockReqRes(options: {
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
}) {
  const req = {
    method: options.method,
    headers: options.headers || {},
    query: options.query || {},
    body: options.body || {},
    socket: { remoteAddress: '127.0.0.1' },
  };

  let statusCode = 200;
  let responseData: any = null;
  const headersSet: Record<string, string> = {};

  const res = {
    setHeader: (name: string, value: string) => {
      headersSet[name.toLowerCase()] = value;
      return res;
    },
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: any) => {
      responseData = data;
      return res;
    },
    end: () => res,
    getStatusCode: () => statusCode,
    getData: () => responseData,
  };

  return { req, res };
}

// In-Memory Database Simulator for Homeroom Security Tests
class MockHomeroomDatabase {
  public users: Record<string, any> = {};
  public sessions: Record<string, any> = {};
  public homeroomAssignments: Record<string, any> = {};
  public students: Record<string, any> = {};
  public plans: Record<string, any> = {};
  public choices: Record<string, any> = {};
  public interests: Record<string, any> = {};
  public achievements: Record<string, any> = {};
  public documents: Record<string, any> = {};
  public verificationLogs: Record<string, any> = {};

  constructor() {
    this.reset();
  }

  public reset() {
    const dummyPinHash = crypto.createHash('sha256').update('123456').digest('hex');

    // Users
    this.users = {
      usr_guru_9a: {
        id: 'usr_guru_9a',
        nip: '198501012010011001',
        full_name: 'Ahmad Fauzi, S.Pd.',
        role: 'GURU',
        position: 'Wali Kelas 9A',
        account_status: 'ACTIVE',
        avatar_url: 'https://example.com/fauzi.jpg',
        pin_hash: dummyPinHash,
        failed_login_count: 0,
        locked_until: null,
      },
      usr_guru_9b: {
        id: 'usr_guru_9b',
        nip: '198602022011011002',
        full_name: 'Bambang Soepeno, S.Pd.',
        role: 'GURU',
        position: 'Wali Kelas 9B',
        account_status: 'ACTIVE',
        avatar_url: null,
        pin_hash: dummyPinHash,
        failed_login_count: 0,
        locked_until: null,
      },
      usr_guru_regular: {
        id: 'usr_guru_regular',
        nip: '198703032012012003',
        full_name: 'Siti Rohmah, S.Pd.',
        role: 'GURU',
        position: 'Guru Seni Budaya',
        account_status: 'ACTIVE',
        avatar_url: null,
        pin_hash: dummyPinHash,
        failed_login_count: 0,
        locked_until: null,
      },
      usr_guru_inactive_hr: {
        id: 'usr_guru_inactive_hr',
        nip: '198804042013011004',
        full_name: 'Dedi Mulyadi, S.Pd.',
        role: 'GURU',
        position: 'Guru Olahraga',
        account_status: 'ACTIVE',
        avatar_url: null,
        pin_hash: dummyPinHash,
        failed_login_count: 0,
        locked_until: null,
      },
      usr_kepsek: {
        id: 'usr_kepsek',
        nip: '197001011995011001',
        full_name: 'Drs. H. M. Yusuf, M.Pd.',
        role: 'KEPSEK',
        position: 'Kepala Sekolah',
        account_status: 'ACTIVE',
        avatar_url: null,
        pin_hash: dummyPinHash,
        failed_login_count: 0,
        locked_until: null,
      },
      usr_admin: {
        id: 'usr_admin',
        nip: '199005052015012005',
        full_name: 'Rina Fitriani, S.Kom.',
        role: 'ADMIN',
        position: 'Administrator IT',
        account_status: 'ACTIVE',
        avatar_url: null,
        pin_hash: dummyPinHash,
        failed_login_count: 0,
        locked_until: null,
      },
    };

    // Sessions (empty initially)
    this.sessions = {};

    // Homeroom Assignments
    this.homeroomAssignments = {
      asgn_9a: {
        id: 'asgn_9a',
        teacher_id: 'usr_guru_9a',
        class_name: '9A',
        academic_year: '2026/2027',
        target_graduation_year: 2027,
        is_active: true,
      },
      asgn_9b: {
        id: 'asgn_9b',
        teacher_id: 'usr_guru_9b',
        class_name: '9B',
        academic_year: '2026/2027',
        target_graduation_year: 2027,
        is_active: true,
      },
      asgn_inactive: {
        id: 'asgn_inactive',
        teacher_id: 'usr_guru_inactive_hr',
        class_name: '9C',
        academic_year: '2026/2027',
        target_graduation_year: 2027,
        is_active: false,
      },
    };

    // Students
    this.students = {
      std_9a_01: {
        id: 'std_9a_01',
        nis: '26001',
        nisn: '0081112221',
        full_name: 'Muhammad Rizky Pratama',
        class_name: '9A',
        gender: 'L',
        photo_url: null,
      },
      std_9a_02: {
        id: 'std_9a_02',
        nis: '26002',
        nisn: '0081112222',
        full_name: 'Aisyah Putri Azzahra',
        class_name: '9A',
        gender: 'P',
        photo_url: null,
      },
      std_9b_01: {
        id: 'std_9b_01',
        nis: '26010',
        nisn: '0081112230',
        full_name: 'Budi Darmawan',
        class_name: '9B',
        gender: 'L',
        photo_url: null,
      },
    };

    // Continuation Plans
    this.plans = {
      plan_9a_01: {
        id: 'plan_9a_01',
        student_id: 'std_9a_01',
        academic_year: '2026/2027',
        graduation_year: 2027,
        continuation_type: 'SMA_NEGERI',
        status: 'submitted',
        parent_agreement: true,
        parent_notes: 'Mendukung penuh pilihan anak',
        financial_readiness: 'SIAP',
        submitted_at: '2026-09-01T08:00:00Z',
        verified_at: null,
        verified_by: null,
        revision_note: null,
      },
      plan_9a_02: {
        id: 'plan_9a_02',
        student_id: 'std_9a_02',
        academic_year: '2026/2027',
        graduation_year: 2027,
        continuation_type: 'SMK_NEGERI',
        status: 'pending_verification',
        parent_agreement: true,
        parent_notes: null,
        financial_readiness: 'SIAP',
        submitted_at: '2026-09-02T08:00:00Z',
        verified_at: null,
        verified_by: null,
        revision_note: null,
      },
      plan_9b_01: {
        id: 'plan_9b_01',
        student_id: 'std_9b_01',
        academic_year: '2026/2027',
        graduation_year: 2027,
        continuation_type: 'SMA_NEGERI',
        status: 'submitted',
        parent_agreement: true,
        parent_notes: null,
        financial_readiness: 'SIAP',
        submitted_at: '2026-09-03T08:00:00Z',
        verified_at: null,
        verified_by: null,
        revision_note: null,
      },
    };

    // Choices
    this.choices = {
      choice_9a_01: {
        id: 'choice_9a_01',
        continuation_plan_id: 'plan_9a_01',
        priority: 1,
        school_name: 'SMAN 1 Bogor',
        school_type: 'SMA',
        major_name: 'MIPA',
        registration_track: 'Prestasi',
        notes: 'Pilihan utama',
      },
    };

    // Interests
    this.interests = {
      int_9a_01: {
        id: 'int_9a_01',
        student_id: 'std_9a_01',
        interest_field: 'Teknologi & Komputer',
        reason: 'Minat coding dan robotika',
        career_goal: 'Software Engineer',
      },
    };

    // Achievements
    this.achievements = {
      ach_9a_01: {
        id: 'ach_9a_01',
        student_id: 'std_9a_01',
        achievement_title: 'Juara 1 OSN Matematika',
        achievement_type: 'Akademik',
        level: 'Kabupaten',
        year: 2025,
        organizer: 'Disdik',
      },
    };

    // Documents
    this.documents = {
      doc_9a_01: {
        id: 'doc_9a_01',
        student_id: 'std_9a_01',
        document_type: 'KARTU_KELUARGA',
        storage_path: 'std_9a_01/kk_rizky.pdf',
        original_filename: 'kk_rizky.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 204800,
        status: 'pending',
        is_active: true,
      },
      doc_9b_01: {
        id: 'doc_9b_01',
        student_id: 'std_9b_01',
        document_type: 'KARTU_KELUARGA',
        storage_path: 'std_9b_01/kk_budi.pdf',
        original_filename: 'kk_budi.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 180000,
        status: 'pending',
        is_active: true,
      },
    };

    // Verification Logs
    this.verificationLogs = {};
  }

  public createSession(userId: string): string {
    const rawEntropy = crypto.randomBytes(32).toString('hex');
    const token = `saga_sess_${rawEntropy}`;
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    this.sessions[tokenHash] = {
      id: `sess_${rawEntropy.substring(0, 8)}`,
      user_id: userId,
      token_hash: tokenHash,
      ip_address: '127.0.0.1',
      user_agent: 'MockTestAgent/1.0',
      device_uuid: 'dev_uuid_test',
      expires_at: expiresAt,
      revoked_at: null,
      revocation_reason: null,
      created_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    };

    return token;
  }

  public createClient() {
    const db = this;

    return {
      from: (table: string) => {
        let filters: Array<{ type: 'eq' | 'in'; col: string; val: any }> = [];
        let orderField: string | null = null;
        let isAscending = true;

        const queryObj: any = {
          select: () => queryObj,
          update: (updates: any) => {
            if (table === 'user_sessions') {
              for (const f of filters) {
                if (f.type === 'eq' && f.col === 'id') {
                  const s = Object.values(db.sessions).find((sess: any) => sess.id === f.val);
                  if (s) Object.assign(s, updates);
                }
              }
            }
            return queryObj;
          },
          insert: (records: any) => {
            const arr = Array.isArray(records) ? records : [records];
            for (const r of arr) {
              if (table === 'user_sessions') db.sessions[r.token_hash] = r;
            }
            return queryObj;
          },
          delete: () => queryObj,
          order: (field: string, opts?: { ascending?: boolean }) => {
            orderField = field;
            isAscending = opts?.ascending ?? true;
            return queryObj;
          },
          eq: (col: string, val: any) => {
            filters.push({ type: 'eq', col, val });
            return queryObj;
          },
          in: (col: string, vals: any[]) => {
            filters.push({ type: 'in', col, val: vals });
            return queryObj;
          },
          is: () => queryObj,
          maybeSingle: async () => {
            const data = await queryObj.then();
            return { data: Array.isArray(data.data) ? (data.data[0] || null) : data.data, error: null };
          },
          then: async (resolve?: any) => {
            let records: any[] = [];

            if (table === 'users') {
              records = Object.values(db.users);
            } else if (table === 'user_sessions') {
              records = Object.values(db.sessions).map((s) => ({
                ...s,
                users: db.users[s.user_id] || null,
              }));
            } else if (table === 'homeroom_assignments') {
              records = Object.values(db.homeroomAssignments);
            } else if (table === 'students') {
              records = Object.values(db.students);
            } else if (table === 'student_continuation_plans') {
              records = Object.values(db.plans);
            } else if (table === 'student_school_choices') {
              records = Object.values(db.choices);
            } else if (table === 'student_interests') {
              records = Object.values(db.interests);
            } else if (table === 'student_achievements') {
              records = Object.values(db.achievements);
            } else if (table === 'student_documents') {
              records = Object.values(db.documents).map((doc) => ({
                ...doc,
                students: db.students[doc.student_id] || null,
              }));
            } else if (table === 'student_verification_logs') {
              records = Object.values(db.verificationLogs);
            }

            // Apply filters
            for (const f of filters) {
              if (f.type === 'eq') {
                records = records.filter((r) => r[f.col] === f.val);
              } else if (f.type === 'in') {
                records = records.filter((r) => f.val.includes(r[f.col]));
              }
            }

            // Apply ordering if needed
            if (orderField) {
              records.sort((a, b) => {
                const va = a[orderField!];
                const vb = b[orderField!];
                if (va < vb) return isAscending ? -1 : 1;
                if (va > vb) return isAscending ? 1 : -1;
                return 0;
              });
            }

            const res = { data: records, error: null };
            if (resolve) return resolve(res);
            return res;
          },
        };

        return queryObj;
      },

      rpc: async (functionName: string, args: any) => {
        if (functionName === 'rpc_verify_continuation_plan') {
          const { p_plan_id, p_verifier_user_id, p_decision, p_notes } = args;
          const plan = db.plans[p_plan_id];
          if (!plan) {
            return { data: null, error: { message: 'Rencana studi tidak ditemukan' } };
          }

          // Simulate RPC execution
          plan.status = p_decision;
          plan.verified_at = new Date().toISOString();
          plan.verified_by = p_verifier_user_id;
          plan.revision_note = p_decision === 'needs_revision' ? p_notes : null;

          const logId = `log_${Date.now()}`;
          db.verificationLogs[logId] = {
            id: logId,
            continuation_plan_id: p_plan_id,
            verifier_user_id: p_verifier_user_id,
            action: p_decision.toUpperCase(),
            note: p_notes,
            created_at: new Date().toISOString(),
          };

          return {
            data: {
              plan_id: p_plan_id,
              status: p_decision,
              verified_at: plan.verified_at,
              notes: p_notes,
            },
            error: null,
          };
        }
        return { data: null, error: { message: `Unknown function ${functionName}` } };
      },

      storage: {
        from: (bucket: string) => ({
          createSignedUrl: async (path: string, expiresIn: number) => {
            if (bucket === 'student-documents') {
              return {
                data: {
                  signedUrl: `https://supabase.mock.storage/${bucket}/${path}?token=mock_signed_token&expires=${expiresIn}`,
                },
                error: null,
              };
            }
            return { data: null, error: { message: 'Bucket not found' } };
          },
        }),
      },
    };
  }
}

export async function runHomeroomAuthorizationTestSuite(): Promise<TestSuiteResult> {
  const results: TestSuiteResult['results'] = [];
  let passed = 0;
  let failed = 0;

  function assert(testName: string, condition: boolean, details?: string) {
    if (condition) {
      passed++;
      results.push({ testName, status: 'PASS' });
    } else {
      failed++;
      results.push({ testName, status: 'FAIL', details });
    }
  }

  const mockDb = new MockHomeroomDatabase();
  setServerSupabaseClient(mockDb.createClient());

  try {
    const tokenGuru9A = mockDb.createSession('usr_guru_9a');
    const tokenGuru9B = mockDb.createSession('usr_guru_9b');
    const tokenGuruRegular = mockDb.createSession('usr_guru_regular');
    const tokenGuruInactive = mockDb.createSession('usr_guru_inactive_hr');
    const tokenKepsek = mockDb.createSession('usr_kepsek');
    const tokenAdmin = mockDb.createSession('usr_admin');

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Overview API: Wali Kelas 9A memuat overview kelas 9A
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req1, res: res1 } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${tokenGuru9A}` },
    });
    await overviewHandler(req1, res1);
    const data1 = res1.getData();

    assert(
      'Homeroom 01: Wali kelas 9A berhasil mengakses overview rombel 9A (200 OK)',
      res1.getStatusCode() === 200 && data1?.success === true && data1?.overview?.assignedClass === '9A',
      `Status: ${res1.getStatusCode()}, assignedClass: ${data1?.overview?.assignedClass}`
    );

    const { req: req1b, res: res1b } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${tokenGuru9B}` },
    });
    await overviewHandler(req1b, res1b);
    const data1b = res1b.getData();

    assert(
      'Homeroom 01b: Wali kelas 9B berhasil mengakses overview rombel 9B miliknya sendiri',
      res1b.getStatusCode() === 200 && data1b?.success === true && data1b?.overview?.assignedClass === '9B',
      `Status: ${res1b.getStatusCode()}, assignedClass: ${data1b?.overview?.assignedClass}`
    );

    assert(
      'Homeroom 02: Overview menghitung statistik kelas secara akurat',
      data1?.overview?.totalStudents === 2 &&
        data1?.overview?.stats?.submitted === 1 &&
        data1?.overview?.stats?.pendingVerification === 1,
      `Total: ${data1?.overview?.totalStudents}, Stats: ${JSON.stringify(data1?.overview?.stats)}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Students Roster API: Wali Kelas 9A memuat daftar siswa rombel 9A
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req2, res: res2 } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${tokenGuru9A}` },
    });
    await studentsHandler(req2, res2);
    const data2 = res2.getData();

    const allAre9A = (data2?.students || []).every((s: any) => s.className === '9A');
    assert(
      'Homeroom 03: Wali kelas 9A memuat roster siswa 9A dengan data pilihan sekolah ke-1',
      res2.getStatusCode() === 200 && data2?.students?.length === 2 && allAre9A,
      `Count: ${data2?.students?.length}, All 9A: ${allAre9A}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Student Detail API: Wali Kelas 9A memuat data relasional siswa rombel 9A
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req3, res: res3 } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${tokenGuru9A}` },
      query: { student_id: 'std_9a_01' },
    });
    await studentDetailHandler(req3, res3);
    const data3 = res3.getData();

    assert(
      'Homeroom 04: Wali kelas 9A berhasil memuat detail rencana relasional siswa rombel 9A',
      res3.getStatusCode() === 200 &&
        data3?.detail?.student?.fullName === 'Muhammad Rizky Pratama' &&
        Array.isArray(data3?.detail?.choices) &&
        Array.isArray(data3?.detail?.documents),
      `Status: ${res3.getStatusCode()}, Student: ${data3?.detail?.student?.fullName}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Class Isolation: Wali Kelas 9A diblokir mengakses detail siswa 9B
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req4, res: res4 } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${tokenGuru9A}` },
      query: { student_id: 'std_9b_01' }, // Siswa kelas 9B!
    });
    await studentDetailHandler(req4, res4);
    const data4 = res4.getData();

    assert(
      'Homeroom 05: Akses detail siswa kelas lain (9B) diblokir dengan 403 AUTH_FORBIDDEN_CLASS_MISMATCH',
      res4.getStatusCode() === 403 && data4?.errorCode === 'AUTH_FORBIDDEN_CLASS_MISMATCH',
      `Status: ${res4.getStatusCode()}, Code: ${data4?.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Class Isolation: Unduh Dokumen Siswa 9B oleh Wali Kelas 9A diblokir
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req5, res: res5 } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${tokenGuru9A}` },
      query: { document_id: 'doc_9b_01' }, // Dokumen milik siswa 9B!
    });
    await documentDownloadHandler(req5, res5);
    const data5 = res5.getData();

    assert(
      'Homeroom 06: Unduh dokumen siswa kelas lain diblokir dengan 403 AUTH_FORBIDDEN_CLASS_MISMATCH',
      res5.getStatusCode() === 403 && data5?.errorCode === 'AUTH_FORBIDDEN_CLASS_MISMATCH',
      `Status: ${res5.getStatusCode()}, Code: ${data5?.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Non-Homeroom Teacher diblokir mengakses Ruang Wali Kelas
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req6, res: res6 } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${tokenGuruRegular}` },
    });
    await overviewHandler(req6, res6);
    const data6 = res6.getData();

    assert(
      'Homeroom 07: Guru bukan wali kelas diblokir dengan 403 AUTH_FORBIDDEN_NOT_HOMEROOM',
      res6.getStatusCode() === 403 && data6?.errorCode === 'AUTH_FORBIDDEN_NOT_HOMEROOM',
      `Status: ${res6.getStatusCode()}, Code: ${data6?.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Inactive Homeroom Assignment diblokir
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req7, res: res7 } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${tokenGuruInactive}` },
    });
    await overviewHandler(req7, res7);
    const data7 = res7.getData();

    assert(
      'Homeroom 08: SK Wali kelas nonaktif (is_active = false) diblokir dengan 403 AUTH_FORBIDDEN_NOT_HOMEROOM',
      res7.getStatusCode() === 403 && data7?.errorCode === 'AUTH_FORBIDDEN_NOT_HOMEROOM',
      `Status: ${res7.getStatusCode()}, Code: ${data7?.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Missing Session Token
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req8, res: res8 } = createMockReqRes({
      method: 'GET',
      headers: {}, // No Authorization header
    });
    await overviewHandler(req8, res8);
    const data8 = res8.getData();

    assert(
      'Homeroom 09: Request tanpa session token ditolak dengan 401 AUTH_SESSION_MISSING',
      res8.getStatusCode() === 401 && data8?.errorCode === 'AUTH_SESSION_MISSING',
      `Status: ${res8.getStatusCode()}, Code: ${data8?.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Forged Session Token
    // ─────────────────────────────────────────────────────────────────────────
    const forgedToken = 'saga_sess_attacker_forged_random_fake_token_0000000000000000000000';
    const { req: req9, res: res9 } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${forgedToken}` },
    });
    await overviewHandler(req9, res9);
    const data9 = res9.getData();

    assert(
      'Homeroom 10: Token sesi tiruan/palsu ditolak dengan 401 AUTH_SESSION_INVALID',
      res9.getStatusCode() === 401 && data9?.errorCode === 'AUTH_SESSION_INVALID',
      `Status: ${res9.getStatusCode()}, Code: ${data9?.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Zero-Trust Class Spoofing: Wali 9A meminta ?class_name=9B
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req10, res: res10 } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${tokenGuru9A}` },
      query: { class_name: '9B' }, // Spoofing attempt!
    });
    await overviewHandler(req10, res10);
    const data10 = res10.getData();

    assert(
      'Homeroom 11: Upaya spoofing kelas via parameter query ditolak server (403 AUTH_FORBIDDEN_CLASS_MISMATCH)',
      res10.getStatusCode() === 403 && data10?.errorCode === 'AUTH_FORBIDDEN_CLASS_MISMATCH',
      `Status: ${res10.getStatusCode()}, Code: ${data10?.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Plan Verification: Persetujuan (verified) via RPC
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req11, res: res11 } = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${tokenGuru9A}` },
      body: {
        plan_id: 'plan_9a_01',
        decision: 'verified',
        notes: 'Pilihan sesuai dan berkas lengkap.',
      },
    });
    await verifyPlanHandler(req11, res11);
    const data11 = res11.getData();

    assert(
      'Homeroom 12: Eksekusi persetujuan rencana via RPC atomik berhasil (200 OK)',
      res11.getStatusCode() === 200 && data11?.success === true && mockDb.plans['plan_9a_01'].status === 'verified',
      `Status: ${res11.getStatusCode()}, DB Status: ${mockDb.plans['plan_9a_01']?.status}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 12. Plan Verification: Revisi wajib menyertakan catatan perbaikan
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req12, res: res12 } = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${tokenGuru9A}` },
      body: {
        plan_id: 'plan_9a_02',
        decision: 'needs_revision',
        notes: '   ', // Kosong / whitespace!
      },
    });
    await verifyPlanHandler(req12, res12);
    const data12 = res12.getData();

    assert(
      'Homeroom 13: Permintaan revisi tanpa catatan ditolak dengan 400 VALIDATION_ERROR',
      res12.getStatusCode() === 400 && data12?.errorCode === 'VALIDATION_ERROR',
      `Status: ${res12.getStatusCode()}, Code: ${data12?.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 13. Read-Only Protection: Role KEPSEK diblokir dari aksi verifikasi
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req13, res: res13 } = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${tokenKepsek}` },
      body: {
        plan_id: 'plan_9a_02',
        decision: 'verified',
      },
    });
    await verifyPlanHandler(req13, res13);
    const data13 = res13.getData();

    assert(
      'Homeroom 14: Role KEPSEK (monitoring/read-only) diblokir dari verifikasi dengan 403 AUTH_FORBIDDEN_READONLY',
      res13.getStatusCode() === 403 && data13?.errorCode === 'AUTH_FORBIDDEN_READONLY',
      `Status: ${res13.getStatusCode()}, Code: ${data13?.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 14. Privileged Access: Role ADMIN dapat mengakses data rombel manapun
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req14, res: res14 } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${tokenAdmin}` },
      query: { class_name: '9B' },
    });
    await overviewHandler(req14, res14);
    const data14 = res14.getData();

    assert(
      'Homeroom 15: Role ADMIN memiliki akses lintas-rombel (Privileged Oversight) tanpa hambatan',
      res14.getStatusCode() === 200 && data14?.success === true,
      `Status: ${res14.getStatusCode()}, Success: ${data14?.success}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 15. Short-Lived Signed URL untuk berkas siswa yang sah
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req15, res: res15 } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${tokenGuru9A}` },
      query: { document_id: 'doc_9a_01' },
    });
    await documentDownloadHandler(req15, res15);
    const data15 = res15.getData();

    assert(
      'Homeroom 16: Dokumen siswa rombel yang sah menghasilkan signed URL dengan TTL 900 detik (15 menit)',
      res15.getStatusCode() === 200 &&
        typeof data15?.downloadUrl === 'string' &&
        data15?.expiresInSeconds === 900,
      `Status: ${res15.getStatusCode()}, URL: ${data15?.downloadUrl}, TTL: ${data15?.expiresInSeconds}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 16. Provider Pattern & HomeroomRepository Abstraction
    // ─────────────────────────────────────────────────────────────────────────
    ProviderFactory.setProvider(new MockProvider());
    const repoOverview = await HomeroomRepository.getOverview('mock_token', '9A');
    const repoStudents = await HomeroomRepository.getStudents('mock_token', '9A');
    const repoDetail = await HomeroomRepository.getStudentDetail('std_mock_001', 'mock_token');
    const repoVerify = await HomeroomRepository.verifyPlan(
      { plan_id: 'plan_mock_001', decision: 'verified' },
      'mock_token'
    );
    const repoDocUrl = await HomeroomRepository.getDocumentUrl('doc_mock_001', 'mock_token');

    assert(
      'Homeroom 17: HomeroomRepository mengeksekusi getOverview, getStudents, getDetail, verify, docUrl via Provider Pattern',
      repoOverview.assignedClass === '9A' &&
        repoStudents.length > 0 &&
        repoDetail.student.id === 'std_mock_001' &&
        repoVerify.success === true &&
        typeof repoDocUrl === 'string',
      `AssignedClass: ${repoOverview.assignedClass}, StudentCount: ${repoStudents.length}`
    );
  } finally {
    resetServerSupabaseClient();
  }

  return {
    suiteName: 'Ruang Wali Kelas & Continuation Authorization Security (Phase 4.3)',
    passed,
    failed,
    results,
  };
}
