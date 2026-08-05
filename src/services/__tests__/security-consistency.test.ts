/**
 * SMART ABSENSI GURU - SECURITY & CONSISTENCY TEST SUITE
 * Unit tests verifying GPS security, PIN hashing, Supabase authentication, and radius consistency.
 */

import { GPSService } from '../gps.service';
import { hashPin } from '../../utils/hash.utils';
import { SupabaseProvider } from '../../providers/supabase-provider.service';
import type { LoginDTO } from '../../repositories/AuthRepository';

export const runSecurityConsistencyTestSuite = async (): Promise<{
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

  // 1. Test PIN Hashing Consistency
  const pin1 = '123456';
  const hash1 = await hashPin(pin1);
  const hash2 = await hashPin(pin1);
  assert('PIN Hashing - Deterministic & Consistent Hash', hash1 === hash2 && hash1.length === 64);

  // 2. Test PIN Hashing Non-Plaintext
  const pinRaw = '030501';
  const hashRaw = await hashPin(pinRaw);
  assert('PIN Hashing - Never Stores Plaintext', hashRaw !== pinRaw && hashRaw.length === 64);

  // 3. Test SupabaseProvider Login PIN Validation (Wrong PIN Rejected)
  const supabaseProvider = new SupabaseProvider();
  try {
    const wrongLoginDto: LoginDTO = {
      identity: '081234567890',
      pin: '999999', // Wrong PIN
      device_uuid: 'DEV_TEST_UUID',
      device_model: 'Web Browser',
    };
    await supabaseProvider.login(wrongLoginDto);
    assert('Supabase Login - Reject Invalid PIN', false, 'Should have thrown error on wrong PIN');
  } catch (err: unknown) {
    const msg = String(err);
    assert('Supabase Login - Reject Invalid PIN', msg.includes('PIN') || msg.includes('tidak ditemukan'));
  }

  // 4. Test GPS Service Geofence Validation Consistency
  const allowedRadius = 500;
  const testCoords = { latitude: -6.2, longitude: 106.8, accuracy: 5, distanceMeters: 450 };
  const validCheck = GPSService.validateGeofenceRadius(testCoords, allowedRadius);
  assert('UI & Validation Radius Indicator - Consistent Allowed Radius (450m <= 500m)', validCheck.isValid === true);

  const outCoords = { latitude: -6.2, longitude: 106.8, accuracy: 5, distanceMeters: 550 };
  const invalidCheck = GPSService.validateGeofenceRadius(outCoords, allowedRadius);
  assert('UI & Validation Radius Indicator - Reject Out of Range (550m > 500m)', invalidCheck.isValid === false);

  return { passed, failed, results };
};
