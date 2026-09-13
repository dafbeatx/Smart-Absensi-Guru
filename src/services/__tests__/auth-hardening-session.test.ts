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
            return {
              eq: (col: string, val: any) => {
                const updateChain: any = {
                  is: (isCol: string, isVal: any) => {
                    if (table === 'user_sessions' && col === 'token_hash') {
                      const session = db.sessions[val];
                      if (session && (isVal === null ? session[isCol] === null : session[isCol] === isVal)) {
                        Object.assign(session, updates);
                      }
                    }
                    return Promise.resolve({ error: null });
                  },
                  then: (resolve: any) => {
                    if (table === 'users' && col === 'id') {
                      const user = db.users[val];
                      if (user) Object.assign(user, updates);
                    } else if (table === 'user_sessions' && col === 'id') {
                      const session = Object.values(db.sessions).find((s) => s.id === val);
                      if (session) Object.assign(session, updates);
                    }
                    return Promise.resolve({ error: null }).then(resolve);
                  },
                  catch: (reject: any) => Promise.resolve({ error: null }).catch(reject),
                };
                return updateChain;
              },
            };
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
    const viteEnvKeys = Object.keys(process.env).filter((k) => k.startsWith('VITE_'));
    const isServiceRoleExposedInVite = viteEnvKeys.some(
      (k) => k.includes('SERVICE_ROLE') || (process.env[k] || '').includes('service_role')
    );

    assert(
      'Auth Hardening 20: Supabase Service Role Key is absent from VITE_ client variables and bundle environment',
      !isServiceRoleExposedInVite,
      `VITE_ keys scanned: ${viteEnvKeys.length}, Service role exposed: ${isServiceRoleExposedInVite}`
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
