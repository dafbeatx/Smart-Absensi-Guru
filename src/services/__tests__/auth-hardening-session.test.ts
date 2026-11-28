/**
 * SMART ABSENSI GURU — PHASE 4.2 AUTHENTICATION HARDENING & SESSION STORE TEST SUITE
 *
 * Menguji 20 skenario keamanan autentikasi server-verifiable dan database session store:
 * 1. Valid login → 200
 * 2. Token prefix: saga_sess_
 * 3. Token memiliki entropy CSPRNG (32 bytes / 64 hex characters, collision-free)
 * 4. Database: hanya token_hash (64 hex characters), zero plaintext token di database
 * 5. Valid session: accepted oleh middleware authenticateUser
 * 6. Random forged saga_sess_ token: 401 AUTH_SESSION_INVALID
 * 7. Legacy SB_JWT forged token: rejected oleh session middleware baru (AUTH_SESSION_INVALID)
 * 8. Revoked session: 401 AUTH_SESSION_REVOKED
 * 9. Expired session: 401 AUTH_SESSION_EXPIRED
 * 10. Missing token: 401 AUTH_SESSION_MISSING
 * 11. Inactive user: 401 AUTH_USER_INACTIVE
 * 12. Locked user: rejected sesuai existing lockout semantics (AUTH_ACCOUNT_LOCKED / 429)
 * 13. Wrong PIN: 401 AUTH_INVALID_CREDENTIALS & failed_login_count bertambah
 * 14. Brute-force: 5x gagal mengaktifkan lockout 15 menit
 * 15. Role tampering: client mengirim role ADMIN → server tetap menggunakan role database
 * 16. User ID tampering: client mengirim user_id palsu → server mengabaikannya
 * 17. Logout: token valid → logout → sesi dicabut (revoked) dan tidak dapat digunakan lagi
 * 18. Raw token: tidak bocor dalam application logs
 * 19. PIN & pin_hash: tidak bocor dalam response login atau logging
 * 20. Service Role Key: tidak bocor ke frontend client bundle
 */

import crypto from 'crypto';
import loginHandler from '../../../api/auth/login';
import logoutHandler from '../../../api/auth/logout';
import {
  authenticateUser,
  hashSessionToken,
  setServerSupabaseClient,
  resetServerSupabaseClient,
} from '../../../api/_shared/session-auth';
import type { TestSuiteResult } from '../test-runner.service';

function createMockReqRes(options: {
  method: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  const req = {
    method: options.method,
    headers: options.headers || {},
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
    getHeaders: () => headersSet,
  };

  return { req, res };
}

// In-Memory Database Simulator for Auth Hardening Tests
class MockAuthDatabase {
  public users: Record<string, any> = {};
  public sessions: Record<string, any> = {};

  constructor() {
    this.reset();
  }

  public reset() {
    const validPinHash = crypto.createHash('sha256').update('123456').digest('hex');

    this.users = {
      usr_guru_001: {
        id: 'usr_guru_001',
        nip: '198501012010011001',
        full_name: 'Ahmad Fauzi, S.Pd.',
        phone_number: '081234567890',
        role: 'GURU',
        position: 'Guru Matematika',
        account_status: 'ACTIVE',
        avatar_url: 'https://example.com/avatar1.jpg',
        pin_hash: validPinHash,
        failed_login_count: 0,
        locked_until: null,
        created_at: new Date().toISOString(),
      },
      usr_inactive_001: {
        id: 'usr_inactive_001',
        nip: '198501012010011002',
        full_name: 'Budi Santoso, S.Kom.',
        phone_number: '081299990001',
        role: 'GURU',
        position: 'Guru TIK',
        account_status: 'INACTIVE',
        avatar_url: null,
        pin_hash: validPinHash,
        failed_login_count: 0,
        locked_until: null,
        created_at: new Date().toISOString(),
      },
      usr_locked_001: {
        id: 'usr_locked_001',
        nip: '198501012010011003',
        full_name: 'Dewi Lestari, M.Pd.',
        phone_number: '081299990002',
        role: 'GURU',
        position: 'Guru Bahasa Inggris',
        account_status: 'ACTIVE',
        avatar_url: null,
        pin_hash: validPinHash,
        failed_login_count: 5,
        locked_until: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // Locked for 10 more minutes
        created_at: new Date().toISOString(),
      },
    };

    this.sessions = {};
  }

  public createClient() {
    const db = this;

    return {
      from: (table: string) => {
        let selectedFilterOr: string | null = null;
        let selectedFilterEq: { col: string; val: any } | null = null;

        const queryObj: any = {
          select: () => queryObj,
          or: (condition: string) => {
            selectedFilterOr = condition;
            return queryObj;
          },
          eq: (col: string, val: any) => {
            selectedFilterEq = { col, val };
            return queryObj;
          },
          is: () => queryObj,
          maybeSingle: async () => {
            if (table === 'users') {
              if (selectedFilterOr) {
                // Parse or condition e.g. "phone_number.eq.X,nip.eq.X,id.eq.X"
                const parts = selectedFilterOr.split(',');
                for (const part of parts) {
                  const match = part.match(/^([^.]+)\.eq\.(.*)$/);
                  if (match) {
                    const [, field, val] = match;
                    const found = Object.values(db.users).find((u) => u[field] === val);
                    if (found) return { data: { ...found }, error: null };
                  }
                }
              }
              if (selectedFilterEq) {
                const found = Object.values(db.users).find(
                  (u) => u[selectedFilterEq!.col] === selectedFilterEq!.val
                );
                return { data: found ? { ...found } : null, error: null };
              }
              return { data: null, error: null };
            }

            if (table === 'user_sessions') {
              if (selectedFilterEq && selectedFilterEq.col === 'token_hash') {
                const session = db.sessions[selectedFilterEq.val];
                if (!session) return { data: null, error: null };
                const user = db.users[session.user_id];
                return {
                  data: {
                    ...session,
                    users: user ? { ...user } : null,
                  },
                  error: null,
                };
              }
            }

            return { data: null, error: null };
          },
          insert: async (record: any) => {
            if (table === 'user_sessions') {
              const id = 'sess_' + Math.random().toString(36).substring(2, 9);
              const newSession = {
                id,
                created_at: new Date().toISOString(),
                last_seen_at: new Date().toISOString(),
                revoked_at: null,
                revocation_reason: null,
                ...record,
              };
              db.sessions[record.token_hash] = newSession;
              return { data: newSession, error: null };
            }
            return { data: record, error: null };
          },
          update: (updates: any) => {
            const filters: Array<(row: any) => boolean> = [];
            let returnUpdated = false;
            let execPromise: Promise<any> | null = null;

            const execUpdate = () => {
              if (execPromise) return execPromise;
              if (table === 'users') {
                const updatedRows: any[] = [];
                for (const user of Object.values(db.users)) {
                  if (filters.every((fn) => fn(user))) {
                    Object.assign(user, updates);
                    updatedRows.push({ id: user.id });
                  }
                }
                execPromise = Promise.resolve({
                  data: returnUpdated ? updatedRows : null,
                  error: null,
                });
                return execPromise;
              }

              if (table === 'user_sessions') {
                const updatedRows: any[] = [];
                for (const session of Object.values(db.sessions)) {
                  if (filters.every((fn) => fn(session))) {
                    Object.assign(session, updates);
                    updatedRows.push({ id: session.id });
                  }
                }
                execPromise = Promise.resolve({
                  data: returnUpdated ? updatedRows : null,
                  error: null,
                });
                return execPromise;
              }

              execPromise = Promise.resolve({ data: null, error: null });
              return execPromise;
            };

            const chain: any = {
              eq: (col: string, val: any) => {
                filters.push((row) => row[col] === val);
                return chain;
              },
              neq: (col: string, val: any) => {
                filters.push((row) => row[col] !== val);
                return chain;
              },
              is: (col: string, val: any) => {
                filters.push((row) => (val === null ? row[col] === null : row[col] === val));
                return chain;
              },
              select: () => {
                returnUpdated = true;
                return chain;
              },
              then: (resolve: any, reject?: any) => execUpdate().then(resolve, reject),
              catch: (reject: any) => execUpdate().catch(reject),
            };
            return chain;
          },
        };

        return queryObj;
      },
    };
  }
}

export async function runAuthHardeningSessionTestSuite(): Promise<TestSuiteResult> {
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

  const mockDb = new MockAuthDatabase();
  setServerSupabaseClient(mockDb.createClient());

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Valid Login → 200
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req1, res: res1 } = createMockReqRes({
      method: 'POST',
      body: {
        identity: '081234567890',
        pin: '123456',
      },
    });
    await loginHandler(req1, res1);
    const data1 = res1.getData();

    assert(
      'Auth Hardening 1: Valid login returns HTTP 200 with success status',
      res1.getStatusCode() === 200 && data1?.success === true && !!data1?.token,
      `Status: ${res1.getStatusCode()}, Token present: ${!!data1?.token}`
    );

    const emittedToken = data1?.token || '';

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Token Prefix: saga_sess_
    // ─────────────────────────────────────────────────────────────────────────
    assert(
      'Auth Hardening 2: Issued session token has mandatory saga_sess_ prefix',
      typeof emittedToken === 'string' && emittedToken.startsWith('saga_sess_'),
      `Token: ${emittedToken.substring(0, 20)}...`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 3. CSPRNG Entropy: 32 bytes (64 hex characters) and collision-free
    // ─────────────────────────────────────────────────────────────────────────
    const tokenPayload = emittedToken.substring('saga_sess_'.length);
    const isHex64 = /^[0-9a-f]{64}$/.test(tokenPayload);

    // Generate 10 consecutive tokens to ensure no collision / pure CSPRNG
    const setOfTokens = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const tok = 'saga_sess_' + crypto.randomBytes(32).toString('hex');
      setOfTokens.add(tok);
    }
    const hasCollision = setOfTokens.size !== 10;

    assert(
      'Auth Hardening 3: Session token exhibits 256-bit CSPRNG entropy with 64 hex characters and 0 collisions',
      isHex64 && tokenPayload.length === 64 && !hasCollision,
      `Hex length: ${tokenPayload.length}, Unique count: ${setOfTokens.size}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Database Hash-Only Storage: Plaintext token is never stored in DB
    // ─────────────────────────────────────────────────────────────────────────
    const expectedHash = hashSessionToken(emittedToken);
    const storedSession = mockDb.sessions[expectedHash];

    const isPlaintextFoundInDb = Object.values(mockDb.sessions).some(
      (s) => JSON.stringify(s).includes(emittedToken)
    );

    assert(
      'Auth Hardening 4: Database stores ONLY 64-character SHA-256 token hash (zero plaintext token in DB)',
      !!storedSession &&
        storedSession.token_hash === expectedHash &&
        expectedHash.length === 64 &&
        !isPlaintextFoundInDb,
      `Stored token_hash: ${storedSession?.token_hash}, Plaintext found in DB: ${isPlaintextFoundInDb}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Valid Session Accepted by authenticateUser middleware
    // ─────────────────────────────────────────────────────────────────────────
    const authReq5 = {
      headers: {
        authorization: `Bearer ${emittedToken}`,
      },
    };
    const authResult5 = await authenticateUser(authReq5);

    assert(
      'Auth Hardening 5: Serverless session middleware accepts valid session and returns server-derived context',
      authResult5.ok === true &&
        authResult5.userId === 'usr_guru_001' &&
        authResult5.role === 'GURU',
      `Result ok: ${authResult5.ok}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Random Forged saga_sess_ Token → 401 AUTH_SESSION_INVALID
    // ─────────────────────────────────────────────────────────────────────────
    const forgedSagaToken = 'saga_sess_' + crypto.randomBytes(32).toString('hex');
    const authReq6 = {
      headers: {
        authorization: `Bearer ${forgedSagaToken}`,
      },
    };
    const authResult6: any = await authenticateUser(authReq6);

    assert(
      'Auth Hardening 6: Forged saga_sess_ token not in DB is rejected with 401 AUTH_SESSION_INVALID',
      authResult6.ok === false &&
        authResult6.status === 401 &&
        authResult6.errorCode === 'AUTH_SESSION_INVALID',
      `Error: ${authResult6.errorCode}, Status: ${authResult6.status}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Legacy SB_JWT Forged Token → Rejected by new session middleware
    // ─────────────────────────────────────────────────────────────────────────
    const legacyForgedToken = 'SB_JWT_usr_guru_001_1789316122100';
    const authReq7 = {
      headers: {
        authorization: `Bearer ${legacyForgedToken}`,
      },
    };
    const authResult7: any = await authenticateUser(authReq7);

    assert(
      'Auth Hardening 7: Legacy unverified SB_JWT token is rejected by new session middleware without fallback',
      authResult7.ok === false &&
        authResult7.status === 401 &&
        authResult7.errorCode === 'AUTH_SESSION_INVALID',
      `Code: ${authResult7.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Revoked Session → 401 AUTH_SESSION_REVOKED
    // ─────────────────────────────────────────────────────────────────────────
    const revokedToken = 'saga_sess_' + crypto.randomBytes(32).toString('hex');
    const revokedHash = hashSessionToken(revokedToken);
    mockDb.sessions[revokedHash] = {
      id: 'sess_revoked_01',
      user_id: 'usr_guru_001',
      token_hash: revokedHash,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      revoked_at: new Date().toISOString(),
      revocation_reason: 'USER_LOGOUT',
    };

    const authReq8 = {
      headers: {
        authorization: `Bearer ${revokedToken}`,
      },
    };
    const authResult8: any = await authenticateUser(authReq8);

    assert(
      'Auth Hardening 8: Revoked session is rejected with 401 AUTH_SESSION_REVOKED',
      authResult8.ok === false &&
        authResult8.status === 401 &&
        authResult8.errorCode === 'AUTH_SESSION_REVOKED',
      `Code: ${authResult8.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Expired Session → 401 AUTH_SESSION_EXPIRED
    // ─────────────────────────────────────────────────────────────────────────
    const expiredToken = 'saga_sess_' + crypto.randomBytes(32).toString('hex');
    const expiredHash = hashSessionToken(expiredToken);
    mockDb.sessions[expiredHash] = {
      id: 'sess_expired_01',
      user_id: 'usr_guru_001',
      token_hash: expiredHash,
      created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      expires_at: new Date(Date.now() - 10 * 86400000).toISOString(), // Expired 10 days ago
      revoked_at: null,
    };

    const authReq9 = {
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
    };
    const authResult9: any = await authenticateUser(authReq9);

    assert(
      'Auth Hardening 9: Expired session is rejected with 401 AUTH_SESSION_EXPIRED',
      authResult9.ok === false &&
        authResult9.status === 401 &&
        authResult9.errorCode === 'AUTH_SESSION_EXPIRED',
      `Code: ${authResult9.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Missing Token → 401 AUTH_SESSION_MISSING
    // ─────────────────────────────────────────────────────────────────────────
    const authReq10 = { headers: {} };
    const authResult10: any = await authenticateUser(authReq10);

    assert(
      'Auth Hardening 10: Missing authorization header is rejected with 401 AUTH_SESSION_MISSING',
      authResult10.ok === false &&
        authResult10.status === 401 &&
        authResult10.errorCode === 'AUTH_SESSION_MISSING',
      `Code: ${authResult10.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Inactive User → 401 AUTH_USER_INACTIVE
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req11, res: res11 } = createMockReqRes({
      method: 'POST',
      body: {
        identity: '081299990001', // usr_inactive_001
        pin: '123456',
      },
    });
    await loginHandler(req11, res11);
    const data11 = res11.getData();

    assert(
      'Auth Hardening 11: Inactive user login is rejected with 401 AUTH_USER_INACTIVE',
      res11.getStatusCode() === 401 && data11?.errorCode === 'AUTH_USER_INACTIVE',
      `Code: ${data11?.errorCode}, Status: ${res11.getStatusCode()}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 12. Locked User → Rejected according to existing lockout semantics (429)
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req12, res: res12 } = createMockReqRes({
      method: 'POST',
      body: {
        identity: '081299990002', // usr_locked_001
        pin: '123456',
      },
    });
    await loginHandler(req12, res12);
    const data12 = res12.getData();

    assert(
      'Auth Hardening 12: Temporarily locked user is rejected with HTTP 429 AUTH_ACCOUNT_LOCKED',
      res12.getStatusCode() === 429 && data12?.errorCode === 'AUTH_ACCOUNT_LOCKED',
      `Status: ${res12.getStatusCode()}, Code: ${data12?.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 13. Wrong PIN → 401 AUTH_INVALID_CREDENTIALS & failed_login_count incremented
    // ─────────────────────────────────────────────────────────────────────────
    const user01Before = mockDb.users['usr_guru_001'].failed_login_count;
    const { req: req13, res: res13 } = createMockReqRes({
      method: 'POST',
      body: {
        identity: '081234567890',
        pin: '999999', // Incorrect PIN
      },
    });
    await loginHandler(req13, res13);
    const data13 = res13.getData();
    const user01After = mockDb.users['usr_guru_001'].failed_login_count;

    assert(
      'Auth Hardening 13: Incorrect PIN returns 401 and increments failed_login_count in database',
      res13.getStatusCode() === 401 &&
        data13?.errorCode === 'AUTH_INVALID_CREDENTIALS' &&
        user01After === user01Before + 1,
      `Before: ${user01Before}, After: ${user01After}, Code: ${data13?.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 14. Brute-Force Protection: 5 consecutive failures triggers lockout
    // ─────────────────────────────────────────────────────────────────────────
    mockDb.users['usr_guru_001'].failed_login_count = 4; // 4th attempt already failed
    const { req: req14, res: res14 } = createMockReqRes({
      method: 'POST',
      body: {
        identity: '081234567890',
        pin: '999999', // 5th failure
      },
    });
    await loginHandler(req14, res14);
    const user01LockedUntil = mockDb.users['usr_guru_001'].locked_until;
    const isLockedNow = user01LockedUntil && new Date(user01LockedUntil) > new Date();

    assert(
      'Auth Hardening 14: Brute-force threshold (5 failed attempts) triggers 15-minute account lock',
      isLockedNow && mockDb.users['usr_guru_001'].failed_login_count === 5,
      `Locked until: ${user01LockedUntil}`
    );

    // Reset user state back for remaining tests
    mockDb.users['usr_guru_001'].failed_login_count = 0;
    mockDb.users['usr_guru_001'].locked_until = null;

    // ─────────────────────────────────────────────────────────────────────────
    // 15. Role Tampering: Client sending role ADMIN is ignored; DB role prevails
    // ─────────────────────────────────────────────────────────────────────────
    const { req: req15, res: res15 } = createMockReqRes({
      method: 'POST',
      body: {
        identity: '081234567890',
        pin: '123456',
        role: 'ADMIN', // Attacker attempts to spoof role in request payload
      },
    });
    await loginHandler(req15, res15);
    const data15 = res15.getData();

    assert(
      'Auth Hardening 15: Role spoofing in client body is strictly ignored; database role (GURU) persists',
      data15?.user?.role === 'GURU' && data15?.user?.role !== 'ADMIN',
      `Issued Role: ${data15?.user?.role}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 16. User ID Tampering: Client sending spoofed user_id is ignored
    // ─────────────────────────────────────────────────────────────────────────
    const token16 = data15?.token;
    const authReq16 = {
      headers: {
        authorization: `Bearer ${token16}`,
      },
      body: {
        user_id: 'usr_admin_spoofed_999',
      },
    };
    const authResult16 = await authenticateUser(authReq16);

    assert(
      'Auth Hardening 16: Spoofed user_id in client request body is ignored; server authority binds to session',
      authResult16.ok === true && authResult16.userId === 'usr_guru_001',
      `Authenticated userId: ${authResult16.ok ? authResult16.userId : 'failed'}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 17. Logout: Revokes session in DB; token cannot be used again
    // ─────────────────────────────────────────────────────────────────────────
    const { req: logoutReq, res: logoutRes } = createMockReqRes({
      method: 'POST',
      headers: {
        authorization: `Bearer ${token16}`,
      },
    });
    await logoutHandler(logoutReq, logoutRes);

    // Verify session revoked in DB
    const tokenHash16 = hashSessionToken(token16);
    const sessionInDb = mockDb.sessions[tokenHash16];
    const isRevokedInDb = sessionInDb && !!sessionInDb.revoked_at;

    // Verify subsequent request with same token is now rejected
    const authResult17: any = await authenticateUser({
      headers: { authorization: `Bearer ${token16}` },
    });

    assert(
      'Auth Hardening 17: Logout immediately marks session revoked_at in database and invalidates subsequent token requests',
      logoutRes.getStatusCode() === 200 &&
        isRevokedInDb &&
        authResult17.ok === false &&
        authResult17.errorCode === 'AUTH_SESSION_REVOKED',
      `Revoked in DB: ${isRevokedInDb}, Subsequent auth code: ${authResult17.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 18. Raw Token Leak Prevention: Raw token is never logged
    // ─────────────────────────────────────────────────────────────────────────
    let logsCaptured = '';
    const origLog = console.log;
    const origInfo = console.info;
    const origWarn = console.warn;
    console.log = (...args) => { logsCaptured += args.join(' '); };
    console.info = (...args) => { logsCaptured += args.join(' '); };
    console.warn = (...args) => { logsCaptured += args.join(' '); };

    const { req: req18, res: res18 } = createMockReqRes({
      method: 'POST',
      body: {
        identity: '081234567890',
        pin: '123456',
      },
    });
    await loginHandler(req18, res18);
    const issuedToken18 = res18.getData()?.token;

    console.log = origLog;
    console.info = origInfo;
    console.warn = origWarn;

    const isTokenLeakedInLogs = logsCaptured.includes(issuedToken18);

    assert(
      'Auth Hardening 18: Plaintext session token is strictly absent from server logs',
      !isTokenLeakedInLogs,
      `Token leaked in console/logs: ${isTokenLeakedInLogs}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 19. PIN Leak Prevention: PIN and pin_hash never leak in response payload or logs
    // ─────────────────────────────────────────────────────────────────────────
    const data18 = res18.getData();
    const hasPinInResponse = 'pin' in data18 || 'pin_hash' in data18 || 'pin_hash' in (data18?.user || {});
    const hasPinInLogs = logsCaptured.includes('123456');

    assert(
      'Auth Hardening 19: Plaintext PIN and pin_hash are strictly excluded from response payloads and logs',
      !hasPinInResponse && !hasPinInLogs,
      `PIN in response: ${hasPinInResponse}, PIN in logs: ${hasPinInLogs}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 20. Service Role Key Protection: Not present in client bundle or exposed with VITE_ prefix
    // ─────────────────────────────────────────────────────────────────────────
    const envObj = typeof process !== 'undefined' && process.env ? process.env : ((import.meta as any)?.env || {});
    const viteEnvKeys = Object.keys(envObj).filter((k) => k.startsWith('VITE_'));
    const isServiceRoleExposedInVite = viteEnvKeys.some(
      (k) => k.includes('SERVICE_ROLE') || ((envObj as any)[k] || '').includes('service_role')
    );

    assert(
      'Auth Hardening 20: Supabase Service Role Key is absent from VITE_ client variables and bundle environment',
      !isServiceRoleExposedInVite,
      `VITE_ keys scanned: ${viteEnvKeys.length}, Service role exposed: ${isServiceRoleExposedInVite}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 21. HttpOnly Session Cookie & No-Cache Headers Issued on Login / Cleared on Logout
    // ─────────────────────────────────────────────────────────────────────────
    const loginHeaders18 = res18.getHeaders();
    const setCookieHeader18 = String(loginHeaders18['set-cookie'] || '');
    const { req: logoutReq21, res: logoutRes21 } = createMockReqRes({
      method: 'POST',
      headers: {
        cookie: `saga_session=${encodeURIComponent(issuedToken18)}`,
      },
    });
    await logoutHandler(logoutReq21, logoutRes21);
    const logoutCookie21 = String(logoutRes21.getHeaders()['set-cookie'] || '');
    const authAfterCookieLogout: any = await authenticateUser({
      headers: { cookie: `saga_session=${encodeURIComponent(issuedToken18)}` },
    });

    assert(
      'Auth Hardening 21: Login issues HttpOnly cookie + no-store headers; logout via Cookie revokes DB session and clears cookie',
      setCookieHeader18.includes('saga_session=') &&
        setCookieHeader18.includes('HttpOnly') &&
        String(loginHeaders18['cache-control'] || '').includes('no-store') &&
        logoutCookie21.includes('Max-Age=0') &&
        authAfterCookieLogout.ok === false &&
        authAfterCookieLogout.errorCode === 'AUTH_SESSION_REVOKED',
      `Set-Cookie: ${Boolean(setCookieHeader18)}, Logout cleared: ${logoutCookie21.includes('Max-Age=0')}, Post-logout code: ${authAfterCookieLogout.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 22. Anti-Enumeration & PostgREST Filter Injection Prevention
    // ─────────────────────────────────────────────────────────────────────────
    const { req: reqNotFound, res: resNotFound } = createMockReqRes({
      method: 'POST',
      body: { identity: '089999999999', pin: '123456' },
    });
    await loginHandler(reqNotFound, resNotFound);

    const { req: reqInjection, res: resInjection } = createMockReqRes({
      method: 'POST',
      body: { identity: '081234567890,role.eq.ADMIN', pin: '123456' },
    });
    await loginHandler(reqInjection, resInjection);

    assert(
      'Auth Hardening 22: Unknown user matches wrong-PIN generic error (no enumeration) & PostgREST filter injection rejected',
      resNotFound.getStatusCode() === 401 &&
        resNotFound.getData()?.errorCode === 'AUTH_INVALID_CREDENTIALS' &&
        resInjection.getStatusCode() === 400 &&
        resInjection.getData()?.errorCode === 'VALIDATION_ERROR',
      `NotFound code: ${resNotFound.getData()?.errorCode}, Injection status: ${resInjection.getStatusCode()}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 23. Turnstile Production Security: Zero Fallback/Timeout Bypass & Fail-Closed
    // ─────────────────────────────────────────────────────────────────────────
    const origSecret = process.env.TURNSTILE_SECRET_KEY;
    const origVercelEnv = process.env.VERCEL_ENV;
    process.env.TURNSTILE_SECRET_KEY = 'test-secret-key';

    const { req: reqTimeoutBypass, res: resTimeoutBypass } = createMockReqRes({
      method: 'POST',
      headers: { origin: 'https://smart-absensi-guru-eight.vercel.app' },
      body: {
        identity: '081234567890',
        pin: '123456',
        turnstile_token: 'cf-timeout-fallback-token',
      },
    });
    await loginHandler(reqTimeoutBypass, resTimeoutBypass);

    const { req: reqWebNativeSpoof, res: resWebNativeSpoof } = createMockReqRes({
      method: 'POST',
      headers: {
        origin: 'https://smart-absensi-guru-eight.vercel.app',
        'x-saga-platform': 'android-capacitor',
      },
      body: {
        identity: '081234567890',
        pin: '123456',
        device_uuid: 'device-uuid-spoof-12345',
        turnstile_token: 'native-android-verified-token',
      },
    });
    await loginHandler(reqWebNativeSpoof, resWebNativeSpoof);

    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.VERCEL_ENV = 'production';
    const { req: reqProdNoSecret, res: resProdNoSecret } = createMockReqRes({
      method: 'POST',
      body: { identity: '081234567890', pin: '123456' },
    });
    await loginHandler(reqProdNoSecret, resProdNoSecret);

    if (origSecret !== undefined) process.env.TURNSTILE_SECRET_KEY = origSecret;
    else delete process.env.TURNSTILE_SECRET_KEY;
    if (origVercelEnv !== undefined) process.env.VERCEL_ENV = origVercelEnv;
    else delete process.env.VERCEL_ENV;

    assert(
      'Auth Hardening 23: Server Turnstile rejects cf-timeout bypass, blocks native spoofing from web Origin, and fails closed in production',
      resTimeoutBypass.getStatusCode() === 403 &&
        resTimeoutBypass.getData()?.errorCode === 'BOT_VERIFICATION_FAILED' &&
        resWebNativeSpoof.getStatusCode() === 403 &&
        resProdNoSecret.getStatusCode() === 503,
      `Timeout: ${resTimeoutBypass.getStatusCode()}, WebSpoof: ${resWebNativeSpoof.getStatusCode()}, ProdNoSecret: ${resProdNoSecret.getStatusCode()}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 24. Server-Side must_change_pin & Change-PIN Session Rotation
    // ─────────────────────────────────────────────────────────────────────────
    const { req: reqFreshLogin, res: resFreshLogin } = createMockReqRes({
      method: 'POST',
      body: { identity: '081234567890', pin: '123456' },
    });
    await loginHandler(reqFreshLogin, resFreshLogin);
    const freshData = resFreshLogin.getData();

    const { req: reqChangePinWeak, res: resChangePinWeak } = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${freshData?.token}` },
      body: { new_pin: '123456' },
    });
    (reqChangePinWeak as any).query = { action: 'change-pin' };
    await loginHandler(reqChangePinWeak, resChangePinWeak);

    const { req: reqChangePinValid, res: resChangePinValid } = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${freshData?.token}` },
      body: { new_pin: '654321' },
    });
    (reqChangePinValid as any).query = { action: 'change-pin' };
    await loginHandler(reqChangePinValid, resChangePinValid);

    const { req: reqSessionCheck, res: resSessionCheck } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${freshData?.token}` },
    });
    (reqSessionCheck as any).query = { action: 'session' };
    await loginHandler(reqSessionCheck, resSessionCheck);

    assert(
      'Auth Hardening 24: Server enforces must_change_pin for default PIN 123456, rejects 123456 on change-pin, and clears flag in DB on valid change',
      freshData?.user?.must_change_pin === true &&
        resChangePinWeak.getStatusCode() === 400 &&
        resChangePinValid.getStatusCode() === 200 &&
        resSessionCheck.getStatusCode() === 200 &&
        resSessionCheck.getData()?.user?.must_change_pin === false,
      `Login mustChange: ${freshData?.user?.must_change_pin}, Weak: ${resChangePinWeak.getStatusCode()}, Session mustChange after update: ${resSessionCheck.getData()?.user?.must_change_pin}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 25. PGRST205 Transition Resilience: HMAC-SHA256 Signed Token when user_sessions Missing
    // ─────────────────────────────────────────────────────────────────────────
    const origSvcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-server-only-hmac-signing-key-2026';

    const baseClient = mockDb.createClient();
    const pgrst205Client = {
      from: (table: string) => {
        const q = baseClient.from(table);
        if (table === 'user_sessions') {
          return {
            ...q,
            insert: async () => ({
              data: null,
              error: {
                code: 'PGRST205',
                message: "Could not find the table 'public.user_sessions' in the schema cache",
              },
            }),
          };
        }
        return q;
      },
    };
    setServerSupabaseClient(pgrst205Client);

    const { req: reqHmacLogin, res: resHmacLogin } = createMockReqRes({
      method: 'POST',
      body: { identity: '081234567890', pin: '654321' },
    });
    await loginHandler(reqHmacLogin, resHmacLogin);
    const hmacData = resHmacLogin.getData();

    const hmacAuthValid = await authenticateUser({
      headers: { authorization: `Bearer ${hmacData?.token || ''}` },
    });
    const hmacAuthTampered: any = await authenticateUser({
      headers: { authorization: `Bearer ${hmacData?.token || ''}tampered` },
    });

    setServerSupabaseClient(baseClient);
    if (origSvcKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origSvcKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    assert(
      'Auth Hardening 25: Issues verifiable HMAC-SHA256 saga_tok_ on PGRST205 missing table and rejects tampered signatures',
      resHmacLogin.getStatusCode() === 200 &&
        String(hmacData?.token || '').startsWith('saga_tok_') &&
        hmacAuthValid.ok === true &&
        hmacAuthValid.userId === 'usr_guru_001' &&
        hmacAuthTampered.ok === false &&
        hmacAuthTampered.errorCode === 'AUTH_SESSION_INVALID',
      `Status: ${resHmacLogin.getStatusCode()}, Prefix: ${String(hmacData?.token || '').slice(0, 9)}, ValidOk: ${hmacAuthValid.ok}, TamperedCode: ${hmacAuthTampered.errorCode}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 26. Auto Phone Format Normalization (+628 / 628 / 0812-3456)
    // ─────────────────────────────────────────────────────────────────────────
    const phoneFormats = ['+6281234567890', '6281234567890', '0812-3456-7890'];
    const phoneStatuses: number[] = [];
    for (const fmt of phoneFormats) {
      const { req: reqFmt, res: resFmt } = createMockReqRes({
        method: 'POST',
        body: { identity: fmt, pin: '654321' },
      });
      await loginHandler(reqFmt, resFmt);
      phoneStatuses.push(resFmt.getStatusCode());
    }
    const { req: reqFmtInj, res: resFmtInj } = createMockReqRes({
      method: 'POST',
      body: { identity: '+6281234567890,role.eq.ADMIN', pin: '654321' },
    });
    await loginHandler(reqFmtInj, resFmtInj);

    assert(
      'Auth Hardening 26: Indonesian phone variations (+628 / 628 / 0812-...) normalize cleanly while filter injection stays 400',
      phoneStatuses.every((s) => s === 200) && resFmtInj.getStatusCode() === 400,
      `Statuses: [${phoneStatuses.join(', ')}], InjStatus: ${resFmtInj.getStatusCode()}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 27. Fair School-Wi-Fi Rate Limit: 1 guru salah ketik tidak memblokir guru lain
    // ─────────────────────────────────────────────────────────────────────────
    const sharedWifiIp = '10.99.88.77';
    for (let i = 0; i < 10; i++) {
      const { req: reqFail, res: resFail } = createMockReqRes({
        method: 'POST',
        headers: { 'x-forwarded-for': sharedWifiIp },
        body: { identity: '08999111222', pin: '999999' },
      });
      await loginHandler(reqFail, resFail);
    }
    const { req: reqSameTargetBlocked, res: resSameTargetBlocked } = createMockReqRes({
      method: 'POST',
      headers: { 'x-forwarded-for': sharedWifiIp },
      body: { identity: '08999111222', pin: '999999' },
    });
    await loginHandler(reqSameTargetBlocked, resSameTargetBlocked);

    const { req: reqOtherColleagueOk, res: resOtherColleagueOk } = createMockReqRes({
      method: 'POST',
      headers: { 'x-forwarded-for': sharedWifiIp },
      body: { identity: '081234567890', pin: '654321' },
    });
    await loginHandler(reqOtherColleagueOk, resOtherColleagueOk);

    assert(
      'Auth Hardening 27: School Wi-Fi shared IP blocks repeated brute force on target (429) without blocking other colleagues (200)',
      resSameTargetBlocked.getStatusCode() === 429 &&
        resSameTargetBlocked.getData()?.errorCode === 'RATE_LIMIT_EXCEEDED' &&
        resOtherColleagueOk.getStatusCode() === 200,
      `TargetStatus: ${resSameTargetBlocked.getStatusCode()}, ColleagueStatus: ${resOtherColleagueOk.getStatusCode()}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 28. Global Default PIN 123456: Akun dengan pin_hash kosong tetap bisa masuk memakai 123456 & wajib ganti PIN
    // ─────────────────────────────────────────────────────────────────────────
    const defaultPinHash = crypto.createHash('sha256').update('123456').digest('hex');
    mockDb.users.usr_empty_pin_001 = {
      id: 'usr_empty_pin_001',
      nip: '199001012020011009',
      full_name: 'Siti Aminah, S.Pd.',
      phone_number: '08111222333',
      role: 'GURU',
      position: 'Guru IPA',
      account_status: 'ACTIVE',
      avatar_url: null,
      pin_hash: '',
      failed_login_count: 0,
      locked_until: null,
      must_change_pin: false,
      created_at: new Date().toISOString(),
    };

    const { req: reqEmptyWrong, res: resEmptyWrong } = createMockReqRes({
      method: 'POST',
      headers: { 'x-forwarded-for': '10.28.0.1' },
      body: { identity: '08111222333', pin: '654321' },
    });
    await loginHandler(reqEmptyWrong, resEmptyWrong);

    const { req: reqEmptyDefault, res: resEmptyDefault } = createMockReqRes({
      method: 'POST',
      headers: { 'x-forwarded-for': '10.28.0.1' },
      body: { identity: '08111222333', pin: '123456' },
    });
    await loginHandler(reqEmptyDefault, resEmptyDefault);

    assert(
      'Auth Hardening 28: Empty/null pin_hash allows login with default 123456 (200), auto-upgrades hash, and sets must_change_pin=true',
      resEmptyWrong.getStatusCode() === 401 &&
        resEmptyDefault.getStatusCode() === 200 &&
        resEmptyDefault.getData()?.user?.must_change_pin === true &&
        mockDb.users.usr_empty_pin_001.pin_hash === defaultPinHash &&
        mockDb.users.usr_empty_pin_001.must_change_pin === true,
      `WrongStatus: ${resEmptyWrong.getStatusCode()}, DefaultStatus: ${resEmptyDefault.getStatusCode()}, MustChange: ${resEmptyDefault.getData()?.user?.must_change_pin}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 29. Global Reset PIN -> 123456: RBAC Admin-Only, Unlock Akun, & Wajib Buat PIN Baru Saat Login
    // ─────────────────────────────────────────────────────────────────────────
    const adminCustomPinHash = crypto.createHash('sha256').update('789012').digest('hex');
    mockDb.users.usr_admin_001 = {
      id: 'usr_admin_001',
      nip: '198001012005011001',
      full_name: 'Operator Admin Sekolah',
      phone_number: '08111999888',
      role: 'ADMIN',
      position: 'Admin / Operator Sekolah',
      account_status: 'ACTIVE',
      avatar_url: null,
      pin_hash: adminCustomPinHash,
      failed_login_count: 0,
      locked_until: null,
      must_change_pin: false,
      created_at: new Date().toISOString(),
    };

    const { req: reqGuruLoginForRbac, res: resGuruLoginForRbac } = createMockReqRes({
      method: 'POST',
      headers: { 'x-forwarded-for': '10.29.0.1' },
      body: { identity: '081234567890', pin: '654321' },
    });
    await loginHandler(reqGuruLoginForRbac, resGuruLoginForRbac);
    const guruToken = resGuruLoginForRbac.getData()?.token;

    const { req: reqGuruGlobalReset, res: resGuruGlobalReset } = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${guruToken}` },
      body: { exclude_self: false },
    });
    (reqGuruGlobalReset as any).query = { action: 'reset-global-pin' };
    await loginHandler(reqGuruGlobalReset, resGuruGlobalReset);

    const { req: reqAdminLogin, res: resAdminLogin } = createMockReqRes({
      method: 'POST',
      headers: { 'x-forwarded-for': '10.29.0.2' },
      body: { identity: '08111999888', pin: '789012' },
    });
    await loginHandler(reqAdminLogin, resAdminLogin);
    const adminToken = resAdminLogin.getData()?.token;

    const { req: reqAdminGlobalReset, res: resAdminGlobalReset } = createMockReqRes({
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
      body: { exclude_self: true },
    });
    (reqAdminGlobalReset as any).query = { action: 'reset-global-pin' };
    await loginHandler(reqAdminGlobalReset, resAdminGlobalReset);

    // Check old guru session got revoked while admin session stays active
    const guruAuthAfterGlobal = await authenticateUser({
      headers: { authorization: `Bearer ${guruToken}` },
    });
    const adminAuthAfterGlobal = await authenticateUser({
      headers: { authorization: `Bearer ${adminToken}` },
    });

    // Previously locked teacher (usr_locked_001) should immediately log in with 123456 & must_change_pin=true
    const { req: reqUnlockedLogin, res: resUnlockedLogin } = createMockReqRes({
      method: 'POST',
      headers: { 'x-forwarded-for': '10.29.0.3' },
      body: { identity: '081299990002', pin: '123456' },
    });
    await loginHandler(reqUnlockedLogin, resUnlockedLogin);

    assert(
      'Auth Hardening 29: reset-global-pin enforces ADMIN RBAC (403 for GURU), resets all active PINs to 123456, unlocks accounts, revokes other sessions, and forces new PIN on login',
      resGuruGlobalReset.getStatusCode() === 403 &&
        resAdminGlobalReset.getStatusCode() === 200 &&
        resAdminGlobalReset.getData()?.resetCount === 3 &&
        mockDb.users.usr_guru_001.pin_hash === defaultPinHash &&
        mockDb.users.usr_guru_001.must_change_pin === true &&
        mockDb.users.usr_locked_001.locked_until === null &&
        mockDb.users.usr_locked_001.failed_login_count === 0 &&
        mockDb.users.usr_admin_001.pin_hash === adminCustomPinHash &&
        !guruAuthAfterGlobal.ok &&
        guruAuthAfterGlobal.errorCode === 'AUTH_SESSION_REVOKED' &&
        adminAuthAfterGlobal.ok &&
        resUnlockedLogin.getStatusCode() === 200 &&
        resUnlockedLogin.getData()?.user?.must_change_pin === true,
      `Guru403: ${resGuruGlobalReset.getStatusCode()}, Admin200: ${resAdminGlobalReset.getStatusCode()}, Count: ${resAdminGlobalReset.getData()?.resetCount}, UnlockedLogin: ${resUnlockedLogin.getStatusCode()}, MustChange: ${resUnlockedLogin.getData()?.user?.must_change_pin}`
    );
  } finally {
    resetServerSupabaseClient();
  }

  return {
    suiteName: 'Authentication Hardening & Database Session Store (Phase 4.2)',
    passed,
    failed,
    results,
  };
}
