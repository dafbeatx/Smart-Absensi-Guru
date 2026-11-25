/**
 * SMART ABSENSI GURU — GELOMBANG 2C SECURITY & VERIFICATION TEST SUITE
 * Verifies:
 *   - Auth bypass elimination (mock_token, MOCK_, usr_, SB_JWT_) on teaching-schedules & exam-correction
 *   - Multi-platform CORS allowlist (Vercel, localhost, Capacitor, Electron) without wildcard *
 *   - GET /api/exam-correction ownership enforcement (anti-IDOR)
 *   - Server-controlled exam schedule / period / committee role + committee guard
 *   - Cryptographic fail-closed official document verification & school level segregation
 *   - SQL migration 72 RLS hardening presence
 */

import type { TestSuiteResult } from '../test-runner.service';
import { isServerVerifiableToken, resolveClientAuthToken } from '../../utils/api-auth.utils';

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
  };

  const resHeaders: Record<string, string> = {};
  let statusCode = 200;
  let jsonBody: any = null;
  let ended = false;

  const res = {
    setHeader(key: string, value: string) {
      resHeaders[key.toLowerCase()] = value;
    },
    getHeader(key: string) {
      return resHeaders[key.toLowerCase()];
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: any) {
      jsonBody = payload;
      ended = true;
      return this;
    },
    end() {
      ended = true;
      return this;
    },
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getJson: () => jsonBody,
    getHeaders: () => resHeaders,
    isEnded: () => ended,
  };
}

function createFakeSupabaseClient(config: {
  users?: Record<string, any>;
  gmSessions?: Record<string, any>;
  gmAuditLogs?: any[];
  examCommittees?: any[];
  systemSettings?: Record<string, string>;
}) {
  const settingsMap = new Map<string, string>(Object.entries(config.systemSettings || {}));

  return {
    rpc: async () => ({ data: null, error: { message: 'Mock RPC disabled' } }),
    from: (table: string) => {
      const filters: Record<string, any> = {};
      const inFilters: Record<string, any[]> = {};

      const chain: any = {
        select: () => chain,
        insert: async () => ({ data: null, error: null }),
        update: () => chain,
        upsert: async (payload: any) => {
          if (table === 'system_settings') {
            const rows = Array.isArray(payload) ? payload : [payload];
            for (const row of rows) {
              if (row?.key) settingsMap.set(row.key, row.value);
            }
          }
          return { data: payload, error: null };
        },
        delete: () => chain,
        eq: (col: string, val: any) => {
          filters[col] = val;
          return chain;
        },
        ilike: (col: string, val: any) => {
          filters[`ilike_${col}`] = val;
          return chain;
        },
        in: (col: string, vals: any[]) => {
          inFilters[col] = vals;
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        single: async () => {
          if (table === 'teaching_schedules') {
            return { data: { id: 'sched_1' }, error: null };
          }
          return { data: null, error: null };
        },
        maybeSingle: async () => {
          if (table === 'users') {
            if (filters.id && config.users?.[filters.id]) {
              return { data: config.users[filters.id], error: null };
            }
            if (filters.ilike_full_name && config.users) {
              const target = String(filters.ilike_full_name).toLowerCase();
              const found = Object.values(config.users).find(
                (u: any) => String(u.full_name || '').toLowerCase() === target
              );
              return { data: found || null, error: null };
            }
            return { data: null, error: null };
          }
          if (table === 'gm_sessions') {
            return { data: filters.id ? config.gmSessions?.[filters.id] || null : null, error: null };
          }
          if (table === 'system_settings') {
            if (filters.key && settingsMap.has(filters.key)) {
              return { data: { key: filters.key, value: settingsMap.get(filters.key) }, error: null };
            }
            return { data: null, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve: any) => {
          if (table === 'gm_grade_audit_logs') {
            return resolve({ data: config.gmAuditLogs || [], error: null });
          }
          if (table === 'exam_committees') {
            const matched = (config.examCommittees || []).filter((c) => {
              if (filters.user_id && c.user_id !== filters.user_id) return false;
              if (filters.is_active !== undefined && c.is_active !== filters.is_active) return false;
              if (filters.academic_year && c.academic_year !== filters.academic_year) return false;
              return true;
            });
            return resolve({ data: matched, error: null });
          }
          if (table === 'system_settings') {
            const keys = inFilters.key || (filters.key ? [filters.key] : []);
            const rows = keys
              .filter((k) => settingsMap.has(k))
              .map((k) => ({ key: k, value: settingsMap.get(k) }));
            if (table === 'system_settings' && filters.key && !inFilters.key) {
              settingsMap.delete(filters.key);
            }
            return resolve({ data: rows, error: null });
          }
          return resolve({ data: [], error: null });
        },
      };
      return chain;
    },
  };
}

export async function runWave2CSecurityTestSuite(): Promise<TestSuiteResult> {
  const results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }> = [];
  let passed = 0;
  let failed = 0;

  const assert = (name: string, cond: boolean, details?: string) => {
    if (cond) {
      passed++;
      results.push({ testName: name, status: 'PASS', details });
    } else {
      failed++;
      results.push({ testName: name, status: 'FAIL', details });
    }
  };

  // Client-side token helper hygiene test (runs in both Browser & Node)
  assert(
    'Wave 2C-01: Client token helper accepts only saga_sess_/saga_tok_ and rejects bypass tokens',
    isServerVerifiableToken('saga_sess_abc') &&
      isServerVerifiableToken('saga_tok_xyz.123') &&
      !isServerVerifiableToken('mock_token') &&
      !isServerVerifiableToken('MOCK_ADMIN') &&
      !isServerVerifiableToken('SB_JWT_usr_admin_123') &&
      !isServerVerifiableToken('usr_admin') &&
      resolveClientAuthToken('SB_JWT_usr_1_999') === null,
    'Legacy bypass strings stripped cleanly'
  );

  const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
  if (!isNode) {
    return { suiteName: 'Gelombang 2C Security & Verification Suite', passed, failed, results };
  }

  const fs = await import('node:fs');
  const path = await import('node:path');
  const { default: teachingSchedulesHandler } = await import('../../../api/admin/teaching-schedules');
  const { default: examCorrectionHandler } = await import('../../../api/exam-correction');
  const {
    signHmacSessionToken,
    setServerSupabaseClient,
    resetServerSupabaseClient,
  } = await import('../../../api/_shared/session-auth');

  const prevJwtSecret = process.env.AUTH_JWT_SECRET;
  const prevDocSecret = process.env.DOC_VERIFICATION_SECRET;
  process.env.AUTH_JWT_SECRET = 'test_wave2c_hmac_secret_2026_deterministic_key';
  process.env.DOC_VERIFICATION_SECRET = 'test_wave2c_doc_secret_2026_deterministic_key';

  try {
    const adminToken = signHmacSessionToken('usr_admin_1', 'ADMIN')!;
    const guruAToken = signHmacSessionToken('usr_guru_a', 'GURU')!;
    const guruBToken = signHmacSessionToken('usr_guru_b', 'GURU')!;

    setServerSupabaseClient(
      createFakeSupabaseClient({
        users: {
          usr_admin_1: {
            id: 'usr_admin_1',
            nip: '198001012005011001',
            full_name: 'Admin Sekolah',
            role: 'ADMIN',
            position: 'Admin',
            account_status: 'ACTIVE',
          },
          usr_guru_a: {
            id: 'usr_guru_a',
            nip: '198501012010011002',
            full_name: 'Guru A',
            role: 'GURU',
            position: 'Guru Mapel',
            account_status: 'ACTIVE',
          },
          usr_guru_b: {
            id: 'usr_guru_b',
            nip: null,
            full_name: 'Guru B',
            role: 'GURU',
            position: 'Guru Panitia',
            account_status: 'ACTIVE',
          },
          usr_kepsek_1: {
            id: 'usr_kepsek_1',
            nip: '-',
            full_name: 'Farhan Sopian Sahid, S.Pd.I',
            role: 'KEPSEK',
            position: 'Kepala Sekolah',
            account_status: 'ACTIVE',
          },
        },
        gmSessions: {
          sess_guru_a: {
            id: 'sess_guru_a',
            owner_user_id: 'usr_guru_a',
            teacher: 'Guru A',
            kkm: 75,
          },
        },
        gmAuditLogs: [{ id: 'log_1', session_id: 'sess_guru_a', actor_name: 'Guru A' }],
        examCommittees: [
          {
            id: 'comm_b',
            academic_year: '2026/2027',
            user_id: 'usr_guru_b',
            is_active: true,
          },
        ],
      })
    );

    // 2. Reject mock_token / MOCK_ / usr_ / SB_JWT_ on teaching-schedules
    for (const badToken of ['mock_token', 'MOCK_ADMIN', 'usr_admin_1', 'SB_JWT_usr_admin_1_123']) {
      const call = createMockReqRes({
        method: 'POST',
        headers: { authorization: `Bearer ${badToken}` },
        body: { teacher_user_id: 'usr_guru_a', class_name: '10A', subject: 'MTK', start_time: '07:00', end_time: '08:00' },
      });
      await teachingSchedulesHandler(call.req, call.res);
      assert(
        `Wave 2C-02 (${badToken}): teaching-schedules rejects forged bypass token cleanly`,
        call.getStatus() === 401 && call.getJson()?.success === false,
        `Status=${call.getStatus()}`
      );
    }

    // 3. Reject SB_JWT_ / mock_token on exam-correction
    for (const badToken of ['SB_JWT_usr_guru_a_999', 'mock_token']) {
      const call = createMockReqRes({
        method: 'GET',
        headers: { authorization: `Bearer ${badToken}` },
        query: { session_id: 'sess_guru_a' },
      });
      await examCorrectionHandler(call.req, call.res);
      assert(
        `Wave 2C-03 (${badToken}): exam-correction rejects legacy/mock token cleanly`,
        call.getStatus() === 401 && call.getJson()?.success === false,
        `Status=${call.getStatus()}`
      );
    }

    // 4. Multi-platform CORS checks (never wildcard *, rejects evil origin)
    const capCall = createMockReqRes({
      method: 'OPTIONS',
      headers: { origin: 'capacitor://localhost' },
    });
    await examCorrectionHandler(capCall.req, capCall.res);
    assert(
      'Wave 2C-04a: Capacitor origin reflected with Allow-Credentials true',
      capCall.getStatus() === 200 &&
        capCall.getHeaders()['access-control-allow-origin'] === 'capacitor://localhost' &&
        capCall.getHeaders()['access-control-allow-credentials'] === 'true'
    );

    const elecCall = createMockReqRes({
      method: 'OPTIONS',
      headers: { origin: 'null', 'x-saga-platform': 'electron' },
    });
    await teachingSchedulesHandler(elecCall.req, elecCall.res);
    assert(
      'Wave 2C-04b: Electron origin allowed when X-SAGA-Platform: electron is sent',
      elecCall.getStatus() === 200 &&
        elecCall.getHeaders()['access-control-allow-origin'] === 'null' &&
        elecCall.getHeaders()['access-control-allow-credentials'] === 'true'
    );

    const evilCall = createMockReqRes({
      method: 'OPTIONS',
      headers: { origin: 'https://evil-phishing.example' },
    });
    await examCorrectionHandler(evilCall.req, evilCall.res);
    assert(
      'Wave 2C-04c: Untrusted origin blocked (403 preflight, no ACAO header)',
      evilCall.getStatus() === 403 && !evilCall.getHeaders()['access-control-allow-origin']
    );

    // 5. GET /api/exam-correction ownership enforcement (IDOR test)
    const idorCall = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${guruBToken}` },
      query: { session_id: 'sess_guru_a' },
    });
    await examCorrectionHandler(idorCall.req, idorCall.res);
    assert(
      'Wave 2C-05a: GET /api/exam-correction blocks GURU B from reading GURU A audit logs',
      idorCall.getStatus() === 403 && idorCall.getJson()?.code === 'SESSION_ACCESS_DENIED',
      `Status=${idorCall.getStatus()}, code=${idorCall.getJson()?.code}`
    );

    const ownerReadCall = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${guruAToken}` },
      query: { session_id: 'sess_guru_a' },
    });
    await examCorrectionHandler(ownerReadCall.req, ownerReadCall.res);
    assert(
      'Wave 2C-05b: GET /api/exam-correction allows session owner GURU A',
      ownerReadCall.getStatus() === 200 && ownerReadCall.getJson()?.success === true
    );

    // 6. Server-controlled exam settings mutations & committee authorization
    const nonCommScheduleSave = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${guruAToken}` },
      query: { action: 'save_exam_schedule' },
      body: {
        action: 'save_exam_schedule',
        level: 'SMP',
        schedule: { config: { academicYear: '2026/2027', examType: 'ASTS', educationLevel: 'SMP' }, slots: [] },
      },
    });
    await teachingSchedulesHandler(nonCommScheduleSave.req, nonCommScheduleSave.res);
    assert(
      'Wave 2C-06a: Regular non-committee GURU blocked from saving exam schedule (403)',
      nonCommScheduleSave.getStatus() === 403
    );

    const commScheduleSave = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${guruBToken}` },
      query: { action: 'save_exam_schedule' },
      body: {
        action: 'save_exam_schedule',
        level: 'SMP',
        schedule: { config: { academicYear: '2026/2027', examType: 'ASTS', educationLevel: 'SMP' }, slots: [] },
      },
    });
    await teachingSchedulesHandler(commScheduleSave.req, commScheduleSave.res);
    assert(
      'Wave 2C-06b: Active committee member GURU B permitted to save exam schedule via serverSupabase',
      commScheduleSave.getStatus() === 200 && commScheduleSave.getJson()?.success === true
    );

    const commTrySaveCommittee = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${guruBToken}` },
      query: { action: 'save_exam_committee' },
      body: { action: 'save_exam_committee', academicYear: '2026/2027', members: [] },
    });
    await teachingSchedulesHandler(commTrySaveCommittee.req, commTrySaveCommittee.res);
    assert(
      'Wave 2C-06c: Non-admin GURU blocked from editing SK Panitia (403)',
      commTrySaveCommittee.getStatus() === 403
    );

    // 7. Fail-closed Official Document Verification
    const unsignedVerify = createMockReqRes({
      method: 'GET',
      query: {
        action: 'verify_document',
        no: '421.3/SAG-BOGOR/9/2026',
        type: 'REKAP_PRESENSI',
        month: 'September',
        year: '2026',
      },
    });
    await teachingSchedulesHandler(unsignedVerify.req, unsignedVerify.res);
    assert(
      'Wave 2C-07a: Unsigned QR verification URL strictly rejected (SIGNATURE_MISSING)',
      unsignedVerify.getJson()?.verified === false &&
        unsignedVerify.getJson()?.reasonCode === 'SIGNATURE_MISSING'
    );

    const issueCall = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
      query: { action: 'issue_document_token' },
      body: {
        action: 'issue_document_token',
        docNo: '421.3/IND-198501012010011002/2026-09',
        type: 'PRESENSI_INDIVIDU',
        month: 'September',
        year: '2026',
        teacher: 'Guru A',
        school: 'SMP TERPADU AL-ITTIHADIYAH',
        signatory: 'Farhan Sopian Sahid, S.Pd.I',
      },
    });
    await teachingSchedulesHandler(issueCall.req, issueCall.res);
    const issued = issueCall.getJson();
    assert(
      'Wave 2C-07b: Server issues HMAC doc_v1_ token for official report',
      issueCall.getStatus() === 200 && String(issued?.sig || '').startsWith('doc_v1_')
    );

    const validVerify = createMockReqRes({
      method: 'GET',
      query: {
        action: 'verify_document',
        no: issued.docNo,
        type: 'PRESENSI_INDIVIDU',
        month: 'September',
        year: '2026',
        teacher: 'Guru A',
        school: 'SMP TERPADU AL-ITTIHADIYAH',
        signatory: 'Farhan Sopian Sahid, S.Pd.I',
        iat: String(issued.iat),
        sig: String(issued.sig),
      },
    });
    await teachingSchedulesHandler(validVerify.req, validVerify.res);
    const validBody = validVerify.getJson();
    assert(
      'Wave 2C-07c: Signed document passes server verification with SMP level & null placeholder NPP',
      validBody?.verified === true &&
        validBody?.document?.schoolLevel === 'SMP' &&
        validBody?.document?.signatoryNpp === null
    );

    const tamperedVerify = createMockReqRes({
      method: 'GET',
      query: {
        action: 'verify_document',
        no: issued.docNo,
        type: 'PRESENSI_INDIVIDU',
        month: 'Oktober', // Tampered month!
        year: '2026',
        teacher: 'Guru A',
        school: 'SMP TERPADU AL-ITTIHADIYAH',
        signatory: 'Farhan Sopian Sahid, S.Pd.I',
        iat: String(issued.iat),
        sig: String(issued.sig),
      },
    });
    await teachingSchedulesHandler(tamperedVerify.req, tamperedVerify.res);
    assert(
      'Wave 2C-07d: Tampered document parameter rejected fail-closed (SIGNATURE_MISMATCH)',
      tamperedVerify.getJson()?.verified === false &&
        tamperedVerify.getJson()?.reasonCode === 'SIGNATURE_MISMATCH'
    );

    // 8. Check SQL migration 72 presence & content
    const sqlPath = path.resolve(process.cwd(), 'sql/72_harden_administration_and_exam_rls.sql');
    const sqlContent = fs.existsSync(sqlPath) ? fs.readFileSync(sqlPath, 'utf8') : '';
    assert(
      'Wave 2C-08: SQL Migration 72 closes permissive policies and revokes anon writes',
      sqlContent.includes('DROP POLICY IF EXISTS "student_scores_permissive_policy"') &&
        sqlContent.includes('DROP POLICY IF EXISTS "gm_answers_permissive_policy"') &&
        sqlContent.includes('DROP POLICY IF EXISTS "exam_committees_all_policy"') &&
        sqlContent.includes('REVOKE INSERT, UPDATE, DELETE ON public.student_scores FROM anon') &&
        sqlContent.includes('REVOKE DELETE ON public.system_settings FROM anon')
    );

    // 9. Verify Vercel 12-function count ceiling not exceeded
    const apiFiles: string[] = [];
    const scanApi = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '_shared') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) scanApi(full);
        else if (entry.name.endsWith('.ts')) apiFiles.push(full);
      }
    };
    scanApi(path.resolve(process.cwd(), 'api'));
    assert(
      'Wave 2C-09: Vercel serverless endpoints remain within 12-function limit',
      apiFiles.length <= 12,
      `Found ${apiFiles.length} serverless function files`
    );
  } finally {
    resetServerSupabaseClient();
    if (prevJwtSecret === undefined) delete process.env.AUTH_JWT_SECRET;
    else process.env.AUTH_JWT_SECRET = prevJwtSecret;
    if (prevDocSecret === undefined) delete process.env.DOC_VERIFICATION_SECRET;
    else process.env.DOC_VERIFICATION_SECRET = prevDocSecret;
  }

  return { suiteName: 'Gelombang 2C Security & Verification Suite', passed, failed, results };
}
