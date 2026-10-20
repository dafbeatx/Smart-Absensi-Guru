/**
 * SMART ABSENSI GURU - ONLINE ATTENDANCE GEOFENCE & SANITIZATION TEST SUITE
 * Suite 54: Verifikasi pencegahan penolakan absensi saat online (menggunakan internet):
 * 1. Sanitasi otomatis koordinat (format tanpa desimal, offset legacy 14km 106.812...)
 * 2. Buffer radius aman 500m di seluruh metode absensi (QR & Biometrik)
 * 3. Pencegahan false-positive Fake GPS pada guru yang berdiri diam menghadap kamera
 * 4. Harmonisasi pengaturan geofence antara client dan database cloud Supabase
 */

import type { TestResultItem } from '../test-runner.service';
import { CONSTANTS } from '../../config/constants';
import {
  sanitizeCoordinate,
  sanitizeSchoolCoordinates,
  getEffectiveAllowedRadius,
  calculateDistanceMeters,
} from '../../utils/geofence.utils';
import { GPSService } from '../gps.service';

export const runOnlineAttendanceGeofenceFixTestSuite = async (): Promise<{
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

  // ── 1. Coordinate Sanitizer Tests ─────────────────────────────────────────
  const sanitizedLat1 = sanitizeCoordinate('-6.613144', true, CONSTANTS.DEFAULTS.GEOFENCE_LAT);
  assert(
    '1. Format latitude desimal valid dipertahankan secara presisi',
    sanitizedLat1 === -6.613144,
    `Hasil: ${sanitizedLat1}`
  );

  const sanitizedLat2 = sanitizeCoordinate('-6613144', true, CONSTANTS.DEFAULTS.GEOFENCE_LAT);
  assert(
    '2. Format latitude tanpa desimal (-6613144) otomatis disanitasi menjadi desimal (-6.613144)',
    sanitizedLat2 === -6.613144,
    `Hasil: ${sanitizedLat2}`
  );

  const sanitizedLng1 = sanitizeCoordinate('106684975', false, CONSTANTS.DEFAULTS.GEOFENCE_LNG);
  assert(
    '3. Format longitude tanpa desimal (106684975) otomatis disanitasi menjadi desimal (106.684975)',
    sanitizedLng1 === 106.684975,
    `Hasil: ${sanitizedLng1}`
  );

  const fallbackLat = sanitizeCoordinate('', true, CONSTANTS.DEFAULTS.GEOFENCE_LAT);
  assert(
    '4. Input koordinat kosong dengan aman fallback ke koordinat sekolah resmi',
    fallbackLat === CONSTANTS.DEFAULTS.GEOFENCE_LAT,
    `Fallback: ${fallbackLat}`
  );

  // ── 2. School Coordinates Resolution Tests (14 KM Mismatch Fix) ───────────
  // Legacy / outdated coordinates from database: -6.613144, 106.812294
  const legacyCoords = sanitizeSchoolCoordinates('-6.613144', '106.812294');
  assert(
    '5. Nilai legacy database 106.812294 otomatis dikoreksi ke koordinat resmi 106.684975',
    legacyCoords.lng === CONSTANTS.DEFAULTS.GEOFENCE_LNG && legacyCoords.lat === CONSTANTS.DEFAULTS.GEOFENCE_LAT,
    `Terkoreksi ke: ${legacyCoords.lat}, ${legacyCoords.lng}`
  );

  const monasCoords = sanitizeSchoolCoordinates('-6.200000', '106.812000');
  assert(
    '6. Nilai koordinat Monas Jakarta otomatis diganti dengan koordinat sekolah resmi',
    monasCoords.lat === CONSTANTS.DEFAULTS.GEOFENCE_LAT && monasCoords.lng === CONSTANTS.DEFAULTS.GEOFENCE_LNG,
    `Terkoreksi ke: ${monasCoords.lat}, ${monasCoords.lng}`
  );

  const validSchoolCoords = sanitizeSchoolCoordinates(-6.613144, 106.684975);
  assert(
    '7. Koordinat kanonikal sekolah dipertahankan secara utuh tanpa distorsi',
    validSchoolCoords.lat === -6.613144 && validSchoolCoords.lng === 106.684975,
    `Kanonikal: ${validSchoolCoords.lat}, ${validSchoolCoords.lng}`
  );

  // ── 3. Distance Math Verification ─────────────────────────────────────────
  // Before fix: distance between real teacher (106.684975) and legacy database (106.812294) was ~14,082m
  const rawDistanceWithBug = calculateDistanceMeters(-6.613144, 106.684975, -6.613144, 106.812294);
  assert(
    '8. Jarak bug lama terbukti mencapai 14 KM (alasan utama data selalu ditolak saat online)',
    rawDistanceWithBug > 14000,
    `Jarak bug: ${rawDistanceWithBug} meter`
  );

  // After fix: distance is 0m when sanitized against official school coordinates
  const distanceFixed = calculateDistanceMeters(-6.613144, 106.684975, legacyCoords.lat, legacyCoords.lng);
  assert(
    '9. Jarak setelah sanitasi di area sekolah adalah 0 meter (absensi langsung diterima)',
    distanceFixed === 0,
    `Jarak tervalidasi: ${distanceFixed} meter`
  );

  // ── 4. Effective Allowed Radius Buffer ────────────────────────────────────
  const radiusWithBuffer = getEffectiveAllowedRadius(100, 500);
  assert(
    '10. getEffectiveAllowedRadius mengunci batas buffer minimal 500m untuk absensi sekolah',
    radiusWithBuffer === 500,
    `Radius buffer: ${radiusWithBuffer}m`
  );

  const radiusCustomHigh = getEffectiveAllowedRadius(650, 500);
  assert(
    '11. Radius konfigurasi yang lebih besar (650m) tetap dihormati hingga batas maksimal 2000m',
    radiusCustomHigh === 650,
    `Radius besar: ${radiusCustomHigh}m`
  );

  // ── 5. GPSService Mock Location Stationary Detection ──────────────────────
  // Stationary teacher standing still holding phone: same coordinates after 3 seconds
  const stationaryFix1 = {
    coords: {
      latitude: -6.613144,
      longitude: 106.684975,
      accuracy: 10,
      distanceMeters: 5,
    },
    timestamp: Date.now() - 3000,
  };

  const currentStationaryPosition = {
    coords: {
      latitude: -6.613144,
      longitude: 106.684975,
      accuracy: 10,
      altitude: null,
      speed: 0,
      heading: null,
    },
  } as unknown as GeolocationPosition;

  const mockCheck = GPSService.detectMockLocation(currentStationaryPosition, stationaryFix1);
  assert(
    '12. Guru yang berdiri diam memegang HP selama 3 detik TIDAK ditolak atau dituduh Fake GPS',
    mockCheck.isMock === false,
    `Status mock: ${mockCheck.isMock}`
  );

  return { passed, failed, results };
};
