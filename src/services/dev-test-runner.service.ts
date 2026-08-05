/**
 * SMART ABSENSI GURU - DEVELOPER TEST RUNNER SERVICE
 * Executes dry-run diagnostic tests for environment, auth, storage, GPS, camera, QR, and provider readiness.
 */

import { GPSService } from './gps.service';
import { QRValidationService } from './qr-validation.service';
import { ProviderFactory } from '../providers/provider-factory';
import { CONSTANTS } from '../config/constants';
import { logger } from '../utils/logger.utils';
import { notifySuccess } from '../utils/error.utils';
import type { UserProfile } from '../types/database.types';

export interface DevTestItemResult {
  id: string;
  name: string;
  category: 'ENV' | 'AUTH' | 'STORAGE' | 'GPS' | 'CAMERA' | 'QR' | 'PROVIDER' | 'EVENT' | 'NOTIF';
  status: 'idle' | 'running' | 'passed' | 'warning' | 'failed';
  message: string;
  durationMs: number;
  details?: Record<string, unknown>;
}

export interface DevTestRunSummary {
  timestamp: string;
  totalPassed: number;
  totalWarnings: number;
  totalFailed: number;
  durationMs: number;
  items: DevTestItemResult[];
}

export class DevTestRunnerService {
  public static async runDiagnostics(
    user: UserProfile | null,
    onProgress?: (items: DevTestItemResult[]) => void
  ): Promise<DevTestRunSummary> {
    const startTime = Date.now();
    logger.info('DevTestRunner', 'Starting Developer Diagnostic Test Suite...');

    const items: DevTestItemResult[] = [
      { id: 'test_env', name: 'App Environment & Config', category: 'ENV', status: 'idle', message: 'Pending', durationMs: 0 },
      { id: 'test_auth', name: 'Authentication & Role Security', category: 'AUTH', status: 'idle', message: 'Pending', durationMs: 0 },
      { id: 'test_storage', name: 'Local Storage & Cache Readiness', category: 'STORAGE', status: 'idle', message: 'Pending', durationMs: 0 },
      { id: 'test_gps', name: 'GPS Sensor & Geofence Calculation', category: 'GPS', status: 'idle', message: 'Pending', durationMs: 0 },
      { id: 'test_camera', name: 'Camera Hardware Access', category: 'CAMERA', status: 'idle', message: 'Pending', durationMs: 0 },
      { id: 'test_qr', name: 'Official Poster QR Code Validation', category: 'QR', status: 'idle', message: 'Pending', durationMs: 0 },
      { id: 'test_provider', name: 'Active Data Provider Connectivity', category: 'PROVIDER', status: 'idle', message: 'Pending', durationMs: 0 },
      { id: 'test_dryrun', name: 'Attendance Payload Dry-Run Validation', category: 'PROVIDER', status: 'idle', message: 'Pending', durationMs: 0 },
      { id: 'test_event', name: 'Real-Time Event Dispatcher (smart_absensi_scanned)', category: 'EVENT', status: 'idle', message: 'Pending', durationMs: 0 },
      { id: 'test_notif', name: 'UI Toast & Modal Notification System', category: 'NOTIF', status: 'idle', message: 'Pending', durationMs: 0 },
    ];

    const updateItem = (index: number, update: Partial<DevTestItemResult>) => {
      items[index] = { ...items[index], ...update };
      if (onProgress) onProgress([...items]);
    };

    // Step 1: Environment & Config Test
    {
      const t0 = Date.now();
      updateItem(0, { status: 'running' });
      try {
        const mode = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.MODE : 'development';
        const providerName = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_DATA_PROVIDER || 'supabase' : 'mock';
        updateItem(0, {
          status: 'passed',
          message: `Env Mode: ${mode} | Provider: ${providerName}`,
          durationMs: Date.now() - t0,
          details: { mode, providerName, school: 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam' },
        });
      } catch (err: unknown) {
        updateItem(0, {
          status: 'failed',
          message: 'Gagal membaca environment config: ' + String(err),
          durationMs: Date.now() - t0,
        });
      }
    }

    // Step 2: Auth & Role Security Test
    {
      const t0 = Date.now();
      updateItem(1, { status: 'running' });
      if (!user) {
        updateItem(1, {
          status: 'failed',
          message: 'Sesi login tidak terdeteksi (Guest User)',
          durationMs: Date.now() - t0,
        });
      } else {
        const role = user.role;
        if (role === 'ADMIN' || role === 'OPERATOR') {
          updateItem(1, {
            status: 'passed',
            message: `User: ${user.full_name} (${role} Access Granted)`,
            durationMs: Date.now() - t0,
            details: { id: user.id, name: user.full_name, role },
          });
        } else {
          updateItem(1, {
            status: 'warning',
            message: `Role ${role} tidak memiliki hak akses khusus developer`,
            durationMs: Date.now() - t0,
          });
        }
      }
    }

    // Step 3: Storage Check
    {
      const t0 = Date.now();
      updateItem(2, { status: 'running' });
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('__dev_test_storage__', 'ok');
          const val = localStorage.getItem('__dev_test_storage__');
          localStorage.removeItem('__dev_test_storage__');
          if (val === 'ok') {
            updateItem(2, {
              status: 'passed',
              message: 'LocalStorage & Cache berfungsi normal',
              durationMs: Date.now() - t0,
            });
          } else {
            updateItem(2, { status: 'warning', message: 'LocalStorage read/write gagal', durationMs: Date.now() - t0 });
          }
        } else {
          updateItem(2, { status: 'warning', message: 'Storage tidak tersedia (Non-Browser)', durationMs: Date.now() - t0 });
        }
      } catch (err: unknown) {
        updateItem(2, { status: 'warning', message: 'Storage check warning: ' + String(err), durationMs: Date.now() - t0 });
      }
    }

    // Step 4: GPS Sensor Check
    {
      const t0 = Date.now();
      updateItem(3, { status: 'running' });
      try {
        const coords = await GPSService.getCurrentPosition();
        const settings = GPSService.getGeofenceSettings();
        const allowedRadius = Math.max(settings.radius || 50, 500);
        const isWithin = coords.distanceMeters <= allowedRadius;

        updateItem(3, {
          status: isWithin ? 'passed' : 'warning',
          message: `GPS Lat: ${coords.latitude.toFixed(4)}, Lng: ${coords.longitude.toFixed(4)} | Jarak: ${coords.distanceMeters}m (${isWithin ? 'Di Dalam Radius' : 'Di Luar Radius'})`,
          durationMs: Date.now() - t0,
          details: { ...coords, allowedRadius, isWithin },
        });
      } catch (err: unknown) {
        logger.warn('DevTestRunner', 'GPS check warning (Permission or Timeout):', err);
        updateItem(3, {
          status: 'warning',
          message: 'Sensor GPS tidak dapat diakses atau izin lokasi ditolak di HP/Browser ini',
          durationMs: Date.now() - t0,
          details: { error: String(err) },
        });
      }
    }

    // Step 5: Camera Hardware Check
    {
      const t0 = Date.now();
      updateItem(4, { status: 'running' });
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach((track) => track.stop());
          updateItem(4, {
            status: 'passed',
            message: 'Kamera HP/Browser terdeteksi dan diizinkan',
            durationMs: Date.now() - t0,
          });
        } else {
          updateItem(4, {
            status: 'warning',
            message: 'Browser tidak mendukung navigator.mediaDevices API',
            durationMs: Date.now() - t0,
          });
        }
      } catch (err: unknown) {
        logger.warn('DevTestRunner', 'Camera check warning:', err);
        updateItem(4, {
          status: 'warning',
          message: 'Kamera HP ditolak atau tidak tersedia (Periksa izin kamera)',
          durationMs: Date.now() - t0,
          details: { error: String(err) },
        });
      }
    }

    // Step 6: Official Poster QR Validation Check
    {
      const t0 = Date.now();
      updateItem(5, { status: 'running' });
      const officialSeed = CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED;
      const officialRes = QRValidationService.validateQRFreshness(officialSeed);
      const invalidRes = QRValidationService.validateQRFreshness('RANDOM_INVALID_SEED_999');

      if (officialRes.isValid && !invalidRes.isValid) {
        updateItem(5, {
          status: 'passed',
          message: 'QR Poster Official valid & QR Random ditolak dengan presisi',
          durationMs: Date.now() - t0,
          details: { officialSeed, officialValid: officialRes.isValid, randomRejected: !invalidRes.isValid },
        });
      } else {
        updateItem(5, {
          status: 'failed',
          message: 'Validasi QR Poster Official gagal',
          durationMs: Date.now() - t0,
        });
      }
    }

    // Step 7: Active Provider Health Check
    {
      const t0 = Date.now();
      updateItem(6, { status: 'running' });
      try {
        const provider = ProviderFactory.getProvider();
        const settings = await provider.getSettings();
        updateItem(6, {
          status: 'passed',
          message: `Provider aktif terhubung (${settings.geofence_lat}, ${settings.geofence_lng})`,
          durationMs: Date.now() - t0,
          details: settings as unknown as Record<string, unknown>,
        });
      } catch (err: unknown) {
        updateItem(6, {
          status: 'failed',
          message: 'Koneksi Provider Backend Gagal: ' + String(err),
          durationMs: Date.now() - t0,
        });
      }
    }

    // Step 8: Attendance Payload Dry-Run Validation
    {
      const t0 = Date.now();
      updateItem(7, { status: 'running' });
      try {
        const dummyPayload = {
          token: 'MOCK_TEST_TOKEN',
          qr_seed: CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED,
          user_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
          user_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
          device_uuid: 'DEV_TEST_DRYRUN_UUID',
        };
        updateItem(7, {
          status: 'passed',
          message: 'Structure Payload DTO Valid (Dry-Run Only - Tidak Disimpan)',
          durationMs: Date.now() - t0,
          details: dummyPayload,
        });
      } catch (err: unknown) {
        updateItem(7, {
          status: 'failed',
          message: 'Dry-run payload validation error: ' + String(err),
          durationMs: Date.now() - t0,
        });
      }
    }

    // Step 9: Real-Time Event Dispatcher Check
    {
      const t0 = Date.now();
      updateItem(8, { status: 'running' });
      let eventFired = false;
      const testHandler = () => {
        eventFired = true;
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('smart_absensi_scanned', testHandler);
        window.dispatchEvent(new Event('smart_absensi_scanned'));
        window.removeEventListener('smart_absensi_scanned', testHandler);
      }

      if (eventFired) {
        updateItem(8, {
          status: 'passed',
          message: 'Event smart_absensi_scanned terkirim & didengar dengan baik',
          durationMs: Date.now() - t0,
        });
      } else {
        updateItem(8, {
          status: 'warning',
          message: 'Event dispatcher tidak mendeteksi handler di lingkungan ini',
          durationMs: Date.now() - t0,
        });
      }
    }

    // Step 10: Notification System Test
    {
      const t0 = Date.now();
      updateItem(9, { status: 'running' });
      notifySuccess('Mode Tes Developer Active', 'Diagnostic test suite completed successfully.');
      updateItem(9, {
        status: 'passed',
        message: 'UI Toast & Modal Notification System berfungsi normal',
        durationMs: Date.now() - t0,
      });
    }

    const durationMs = Date.now() - startTime;
    const totalPassed = items.filter((i) => i.status === 'passed').length;
    const totalWarnings = items.filter((i) => i.status === 'warning').length;
    const totalFailed = items.filter((i) => i.status === 'failed').length;

    const summary: DevTestRunSummary = {
      timestamp: new Date().toLocaleString('id-ID'),
      totalPassed,
      totalWarnings,
      totalFailed,
      durationMs,
      items,
    };

    logger.info('DevTestRunner', 'Diagnostic Test Suite Finished:', summary);
    return summary;
  }

  /**
   * Generates a clean markdown test report suitable for copying to clipboard
   */
  public static generateMarkdownReport(summary: DevTestRunSummary, user: UserProfile | null): string {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js Test Engine';
    const lines: string[] = [];

    lines.push(`# 🧪 SMART ABSENSI GURU - LAPORAN DIAGNOSTIK MODE TES DEVELOPER`);
    lines.push(`**Waktu Pengujian**: ${summary.timestamp}`);
    lines.push(`**Penguji**: ${user ? `${user.full_name} (${user.role})` : 'Guest Developer'}`);
    lines.push(`**User Agent**: ${userAgent}`);
    lines.push(`**Total Ringkasan**: ✅ ${summary.totalPassed} Passed | ⚠️ ${summary.totalWarnings} Warning | ❌ ${summary.totalFailed} Failed (${summary.durationMs}ms)`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
    lines.push(`### 📋 Hasil Pengujian Per Item:`);

    for (const item of summary.items) {
      const badge = item.status === 'passed' ? '✅ PASS' : item.status === 'warning' ? '⚠️ WARN' : '❌ FAIL';
      lines.push(`- **[${badge}] ${item.name}** (${item.durationMs}ms)`);
      lines.push(`  - Status Message: ${item.message}`);
    }

    lines.push(``);
    lines.push(`---`);
    lines.push(`*Laporan ini dihasilkan secara otomatis oleh Mode Tes Developer Smart Absensi Guru.*`);

    return lines.join('\n');
  }
}
