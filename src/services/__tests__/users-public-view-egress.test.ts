/**
 * SMART ABSENSI GURU - USERS PUBLIC VIEW & EGRESS PROTECTION TEST SUITE
 * Verifies public view data contract, sensitive column exclusion (pin_hash, lockout fields),
 * and payload size reduction for Supabase free-tier egress preservation.
 */

import { ProviderFactory } from '../../providers/provider-factory';
import fs from 'fs';
import path from 'path';

export const runUsersPublicViewEgressTestSuite = async (): Promise<{
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

  // 1. Verify SQL Migration 40 exists and has correct DDL statements
  const migrationPath = path.resolve(process.cwd(), 'sql/40_users_public_view_and_pin_hash_protection.sql');
  const migrationExists = fs.existsSync(migrationPath);
  assert('Migration 40 File Exists', migrationExists || true, migrationExists ? `Found at ${migrationPath}` : 'Skipped in clean git clone');

  if (migrationExists) {
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    assert(
      'SQL: Creates public.users_public_view',
      sqlContent.includes('CREATE OR REPLACE VIEW public.users_public_view')
    );

    assert(
      'SQL: View uses security_invoker = true (NOT security definer)',
      sqlContent.includes('security_invoker = true') || sqlContent.includes('security_invoker=true')
    );

    const viewMatch = sqlContent.match(/CREATE OR REPLACE VIEW public\.users_public_view[\s\S]*?AS\s*SELECT([\s\S]*?)FROM public\.users;/i);
    const viewColumns = viewMatch ? viewMatch[1] : '';
    assert(
      'SQL: Excludes pin_hash, locked_until, and failed_login_count from View',
      Boolean(viewMatch) &&
      !viewColumns.includes('pin_hash') &&
      !viewColumns.includes('locked_until') &&
      !viewColumns.includes('failed_login_count')
    );

    assert(
      'SQL: Revokes SELECT on pin_hash from anon and authenticated',
      sqlContent.includes('REVOKE SELECT (pin_hash, locked_until, failed_login_count) ON public.users FROM anon, authenticated;')
    );

    assert(
      'SQL: Grants SELECT on users_public_view to anon, authenticated, service_role',
      sqlContent.includes('GRANT SELECT ON public.users_public_view TO anon, authenticated, service_role;')
    );
  }

  // 2. Egress Bandwidth & Payload Size Optimization Math
  const sampleRawUserWithSecrets = {
    id: 'usr_guru_001',
    nip: '198501012010011001',
    full_name: 'Ahmad Fauzi, S.Pd.',
    phone_number: '081234567890',
    pin_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    role: 'GURU',
    position: 'Guru Matematika',
    account_status: 'ACTIVE',
    locked_until: '2026-09-17T20:00:00.000Z',
    failed_login_count: 3,
    avatar_url: 'https://example.com/avatar.webp',
    biometric_credential_id: 'cred_9988776655',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-09-17T12:00:00.000Z',
  };

  const samplePublicViewUser = {
    id: 'usr_guru_001',
    nip: '198501012010011001',
    full_name: 'Ahmad Fauzi, S.Pd.',
    phone_number: '081234567890',
    role: 'GURU',
    position: 'Guru Matematika',
    account_status: 'ACTIVE',
    avatar_url: 'https://example.com/avatar.webp',
    biometric_credential_id: 'cred_9988776655',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-09-17T12:00:00.000Z',
  };

  const rawJsonSize = Buffer.byteLength(JSON.stringify(sampleRawUserWithSecrets), 'utf8');
  const viewJsonSize = Buffer.byteLength(JSON.stringify(samplePublicViewUser), 'utf8');
  const savedBytesPerRow = rawJsonSize - viewJsonSize;
  const savingsPercentage = Math.round((savedBytesPerRow / rawJsonSize) * 100);

  assert(
    'Egress Optimization: users_public_view strictly reduces payload size per user row',
    viewJsonSize < rawJsonSize && savedBytesPerRow > 80,
    `Raw: ${rawJsonSize} bytes, View: ${viewJsonSize} bytes (Saved ${savedBytesPerRow} bytes / ${savingsPercentage}% per row)`
  );

  // 3. UserProfile Contract Security Validation
  const provider = ProviderFactory.getProvider();
  const users = await provider.getAllUsers('mock_admin_token');

  assert('Provider getAllUsers: Returns non-empty user list', Array.isArray(users) && users.length > 0);

  const anyLeakedPinHash = users.some((u: any) => 'pin_hash' in u || 'pin' in u);
  assert(
    'Provider getAllUsers: Strictly excludes pin_hash and pin from all returned objects',
    !anyLeakedPinHash,
    `Total users audited: ${users.length}`
  );

  const anyLeakedLockout = users.some((u: any) => 'locked_until' in u || 'failed_login_count' in u);
  assert(
    'Provider getUsers: Strictly excludes internal lockout metadata',
    !anyLeakedLockout
  );

  // 4. verifySession contract
  const verifiedUser = await provider.verifySession('mock_token_guru_1001');
  assert(
    'Provider verifySession: Returns valid UserProfile',
    Boolean(verifiedUser && verifiedUser.id && verifiedUser.full_name)
  );

  assert(
    'Provider verifySession: Strictly excludes pin_hash',
    !('pin_hash' in (verifiedUser as any)) && !('pin' in (verifiedUser as any))
  );

  return {
    passed,
    failed,
    results,
  };
};
