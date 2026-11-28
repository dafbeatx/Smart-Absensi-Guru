/**
 * SMART ABSENSI GURU — GPS ANTI-JUMP, CLOCK SKEW, & BOUNDED COMPENSATION TEST SUITE
 * Verifies:
 * 1. Stale position rejection (> 10s) and Android device clock-skew calibration
 * 2. BTS cell-tower bounce rejection (> 50 m/s in < 2s) without false Fake GPS GPS_003
 * 3. Sustained high-accuracy (<= 35m) jump still triggers GPS_003 anti-cheat protection
 * 4. Multi-sampling cluster median / best-accuracy selection (never keeping worse fix)
 * 5. Bounded accuracy compensation B_max (25m Biometric vs 35m QR) synchronized on client & server
 * 6. Approximate / coarse location detection (> 150m repeated -> GPS_005)
 * 7. Watcher lifecycle cleanup on modal close
 */

import type { TestResultItem } from '../test-runner.service';
import { CONSTANTS } from '../../config/constants';
import {
  calculateCompensatedDistance,
  evaluateCoordinateJump,
  evaluatePositionFreshness,
  evaluateServerGeofenceGate,
  selectBestGpsSample,
  shouldReplaceWithBetterFix,
} from '../../utils/geofence.utils';
import { GPSService, type GeolocationLike } from '../gps.service';

function makeMockPosition(
  lat: number,
  lng: number,
  accuracy: number,
  timestamp: number,
  extra?: Record<string, unknown>
): GeolocationPosition {
  return {
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      ...(extra || {}),
    },
    timestamp,
    ...(extra?.isMock ? { isMock: true } : {}),
  } as unknown as GeolocationPosition;
}

export const runGpsStabilityAntiJumpTestSuite = async (): Promise<{
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

  const schoolLat = CONSTANTS.DEFAULTS.GEOFENCE_LAT;
  const schoolLng = CONSTANTS.DEFAULTS.GEOFENCE_LNG;

  GPSService.resetStateForTesting();

  // 1. Freshness & Clock-Skew Helper Tests
  const now = 1_795_880_000_000;
  const staleCheck = evaluatePositionFreshness(now - 20_000, now, 10_000, 0);
  assert(
    'GPS 01: Rejects stale OS/BTS timestamp > 10s old',
    staleCheck.isStale === true && staleCheck.anomaly === 'STALE_TIMESTAMP',
    `age=${staleCheck.ageMs}`
  );

  const clockBehindCheck = evaluatePositionFreshness(now + 25_000, now, 10_000, 0);
  assert(
    'GPS 02: Handles device clock lagging satellite GPS (+25s ahead) safely without false stale rejection',
    clockBehindCheck.isStale === false && clockBehindCheck.anomaly === 'DEVICE_CLOCK_BEHIND',
    `skew=${clockBehindCheck.suggestedClockSkewMs}`
  );

  // 2. Frozen stale OS cache is rejected while advancing device-clock-ahead callbacks auto-calibrate skew
  let seqNow = now;
  let staleFeedIdx = 0;
  const frozenStaleGeo: GeolocationLike = {
    getCurrentPosition: (success) => {
      // Every callback freezes at identical timestamp 25s in the past -> true OS stale cache
      success(makeMockPosition(schoolLat, schoolLng, 15, seqNow - 25_000));
    },
    watchPosition: () => 1,
    clearWatch: () => {},
  };

  let frozenRejected = false;
  try {
    await GPSService.getCurrentPosition(schoolLat, schoolLng, {
      geolocationProvider: frozenStaleGeo,
      minSamples: 2,
      maxSamples: 3,
      sampleIntervalMs: 0,
      sampleWindowMs: 50,
      hardTimeoutMs: 500,
      nowFn: () => seqNow,
    });
  } catch (err: unknown) {
    frozenRejected = (err as { code?: string })?.code === 'GPS_001';
  }
  assert('GPS 03: Frozen stale cache (identical old timestamp across samples) is strictly rejected', frozenRejected);

  // Fast device clock (+120s ahead of satellite, advancing timestamp across live callbacks)
  let fastClockStep = 0;
  const skewedFastClockGeo: GeolocationLike = {
    getCurrentPosition: (success) => {
      fastClockStep += 1;
      seqNow += 200;
      const satTs = seqNow - 120_000; // Phone clock is 2 minutes ahead of satellite!
      success(makeMockPosition(schoolLat, schoolLng, 12, satTs));
      staleFeedIdx += 1;
    },
    watchPosition: () => 1,
    clearWatch: () => {},
  };
  const skewedResult = await GPSService.getCurrentPosition(schoolLat, schoolLng, {
    geolocationProvider: skewedFastClockGeo,
    minSamples: 2,
    maxSamples: 4,
    sampleIntervalMs: 0,
    sampleWindowMs: 50,
    hardTimeoutMs: 500,
    nowFn: () => seqNow,
  });
  assert(
    'GPS 04: Auto-calibrates fast phone clock skew when live timestamps advance in sync with wall clock',
    skewedResult.latitude === schoolLat && !skewedResult.isMock && fastClockStep >= 2,
    `acc=${skewedResult.accuracy}, dist=${skewedResult.distanceMeters}`
  );
  void staleFeedIdx;

  // 3. BTS Coarse Jump (> 50 m/s in < 2s) discarded from pool WITHOUT false GPS_003 accusation
  let jumpStep = 0;
  let btsNow = now;
  const btsJumpGeo: GeolocationLike = {
    getCurrentPosition: (success) => {
      jumpStep += 1;
      btsNow += 400; // 0.4s per sample
      if (jumpStep === 2) {
        // Sudden BTS cell tower bounce ~1.4km away with coarse 95m accuracy
        success(makeMockPosition(schoolLat + 0.012, schoolLng + 0.008, 95, btsNow));
        return;
      }
      // Samples 1, 3, 4 cleanly at school (~0m, high precision)
      success(makeMockPosition(schoolLat, schoolLng, 12 + jumpStep, btsNow));
    },
    watchPosition: () => 1,
    clearWatch: () => {},
  };

  const btsFiltered = await GPSService.getCurrentPosition(schoolLat, schoolLng, {
    mode: 'QR_SCAN',
    geolocationProvider: btsJumpGeo,
    minSamples: 3,
    maxSamples: 4,
    sampleIntervalMs: 0,
    sampleWindowMs: 2000,
    hardTimeoutMs: 2500,
    nowFn: () => btsNow,
  });
  assert(
    'GPS 05: Discards noisy BTS jump (>50 m/s in <2s) from pool and avoids false Fake GPS GPS_003',
    !btsFiltered.isMock &&
      (btsFiltered.rejectedOutliers ?? 0) >= 1 &&
      btsFiltered.distanceMeters <= 10,
    `rejectedOutliers=${btsFiltered.rejectedOutliers}, dist=${btsFiltered.distanceMeters}`
  );

  // 4. Sustained High-Accuracy Teleport (<= 35m across consecutive fixes) STILL triggers GPS_003
  let spoofStep = 0;
  let spoofNow = now;
  const sustainedSpoofGeo: GeolocationLike = {
    getCurrentPosition: (success) => {
      spoofStep += 1;
      spoofNow += 500;
      if (spoofStep === 1) {
        success(makeMockPosition(schoolLat, schoolLng, 8, spoofNow));
      } else {
        // Two consecutive high-accuracy teleports far away
        success(makeMockPosition(schoolLat + 0.05 * spoofStep, schoolLng + 0.05, 8, spoofNow));
      }
    },
    watchPosition: () => 1,
    clearWatch: () => {},
  };
  const spoofCoords = await GPSService.getCurrentPosition(schoolLat, schoolLng, {
    geolocationProvider: sustainedSpoofGeo,
    minSamples: 3,
    maxSamples: 4,
    sampleIntervalMs: 0,
    sampleWindowMs: 2500,
    hardTimeoutMs: 3000,
    nowFn: () => spoofNow,
  });
  const spoofValidation = GPSService.validateGeofenceRadius(spoofCoords, 500, { mode: 'QR_SCAN' });
  assert(
    'GPS 06: Sustained high-accuracy (<=35m) teleport still flagged as GPS_003 Fake GPS',
    spoofCoords.isMock === true && !spoofValidation.isValid && spoofValidation.error?.code === 'GPS_003',
    `isMock=${spoofCoords.isMock}, reason=${spoofCoords.mockReason}`
  );

  // 5. Bounded Compensation (B_max: 25m Biometric vs 35m QR) on Client & Backend
  const bioEdgeComp = calculateCompensatedDistance(520, 80, 25); // max 25m comp -> 495m (passes 500m)
  const bioFarComp = calculateCompensatedDistance(530, 80, 25);  // max 25m comp -> 505m (rejected > 500m)
  const homeCheatComp = calculateCompensatedDistance(1200, 900, 35); // even 900m accuracy only gets <=35m -> 1165m!
  assert(
    'GPS 07: Bounded B_max=25m Biometric accepts 520m indoor edge (495m) but rejects 530m and 1200m+home',
    bioEdgeComp.effectiveDistanceMeters === 495 &&
      bioFarComp.effectiveDistanceMeters === 505 &&
      homeCheatComp.compensationMeters === 35 &&
      homeCheatComp.effectiveDistanceMeters === 1165
  );

  // Server gate rejects NaN/negative/excessive accuracy safely & differentiates Biometric (25m) vs QR (35m)
  const serverNanAcc = evaluateServerGeofenceGate({
    rawDistanceMeters: 510,
    gpsAccuracy: Number.NaN,
    allowedRadiusMeters: 500,
    isBiometric: true,
  });
  const serverBioTight = evaluateServerGeofenceGate({
    rawDistanceMeters: 530,
    gpsAccuracy: 80,
    allowedRadiusMeters: 500,
    isBiometric: true,
  });
  const serverQrInside = evaluateServerGeofenceGate({
    rawDistanceMeters: 530,
    gpsAccuracy: 80,
    allowedRadiusMeters: 500,
    isBiometric: false,
  });
  const serverHomeReject = evaluateServerGeofenceGate({
    rawDistanceMeters: 850,
    gpsAccuracy: 45,
    allowedRadiusMeters: 500,
    isBiometric: false,
  });
  assert(
    'GPS 08: Server geofence gate handles NaN accuracy (=0), enforces Biometric B_max=25m & QR B_max=35m, rejects home distance',
    serverNanAcc.compensationMeters === 0 &&
      !serverNanAcc.isAllowed &&
      !serverBioTight.isAllowed &&
      serverQrInside.isAllowed &&
      !serverHomeReject.isAllowed
  );

  // 6. Never Overwrite Better Fix with Worse Fix + Median Cluster Selection
  const shouldKeepBetter = shouldReplaceWithBetterFix(
    { accuracy: 12, timestamp: now - 1000 },
    { accuracy: 68 },
    10_000,
    now
  );
  const medianPick = selectBestGpsSample([
    { latitude: -6.613100, longitude: 106.684900, accuracy: 20, timestamp: now - 1500 },
    { latitude: -6.613144, longitude: 106.684975, accuracy: 15, timestamp: now - 1000 },
    { latitude: -6.613200, longitude: 106.685020, accuracy: 18, timestamp: now - 500 },
    { latitude: -6.619000, longitude: 106.690000, accuracy: 95, timestamp: now - 200 },
  ]);
  assert(
    'GPS 09: Accurate fresh fix is never overwritten by coarser sample; median cluster picks center stable point',
    shouldKeepBetter === false &&
      medianPick !== null &&
      medianPick.selectionMethod === 'MEDIAN_CLUSTER' &&
      Math.abs(medianPick.latitude - -6.613144) < 0.0001
  );

  // 7. Android Coarse / "Lokasi Perkiraan" Detection (> 150m repeated -> GPS_005)
  let coarseNow = now;
  const approxGeo: GeolocationLike = {
    getCurrentPosition: (success) => {
      coarseNow += 300;
      success(makeMockPosition(schoolLat, schoolLng, 280, coarseNow));
    },
    watchPosition: () => 1,
    clearWatch: () => {},
  };
  const approxCoords = await GPSService.getCurrentPosition(schoolLat, schoolLng, {
    mode: 'QR_SCAN',
    geolocationProvider: approxGeo,
    minSamples: 3,
    maxSamples: 3,
    sampleIntervalMs: 0,
    sampleWindowMs: 1500,
    hardTimeoutMs: 2000,
    nowFn: () => coarseNow,
  });
  const approxValidation = GPSService.validateGeofenceRadius(approxCoords, 500, { mode: 'QR_SCAN' });
  assert(
    'GPS 10: Repeated coarse readings (>150m) trigger approximate location guide GPS_005',
    approxCoords.isApproximateLocation === true && !approxValidation.isValid && approxValidation.error?.code === 'GPS_005',
    `acc=${approxCoords.accuracy}, code=${approxValidation.error?.code}`
  );

  // 8. Jump Evaluator Direct Speed & Watch Cleanup Check
  const jumpCheck = evaluateCoordinateJump(
    { latitude: schoolLat + 0.005, longitude: schoolLng, accuracy: 90, timestamp: now + 1000 },
    { latitude: schoolLat, longitude: schoolLng, accuracy: 15, timestamp: now },
    { maxOutlierSpeedMps: 50, windowMs: 2000, coarseAccuracyThreshold: 50 }
  );
  let clearedWatchId: number | null = null;
  const watchMockGeo: GeolocationLike = {
    getCurrentPosition: () => {},
    watchPosition: () => 77,
    clearWatch: (id) => {
      clearedWatchId = id;
    },
  };
  GPSService.resetStateForTesting();
  const stopSub = GPSService.subscribeLivePosition({
    geolocationProvider: watchMockGeo,
    onUpdate: () => {},
  });
  stopSub();
  assert(
    'GPS 11: Jump evaluator identifies coarse BTS spike (>50 m/s in <2s) & subscribeLivePosition clears watch cleanly on unmount',
    jumpCheck.isJump && jumpCheck.isCoarseJump && jumpCheck.withinSpikeWindow && clearedWatchId === 77
  );

  GPSService.resetStateForTesting();
  return { passed, failed, results };
};
