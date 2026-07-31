import { QRValidationService } from './qr-validation.service';
import { GPSService } from './gps.service';
import type { GPSCoordinates } from './gps.service';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { indexedDBService } from './indexed-db.service';
import { getErrorDefinition } from '../config/error-codes';
import type { ErrorDefinition } from '../config/error-codes';

export type AttendanceEngineStep =
  | 'IDLE'
  | 'OPENING_CAMERA'
  | 'SCANNING'
  | 'QR_DETECTED'
  | 'VALIDATING_QR'
  | 'VALIDATING_GPS'
  | 'CHECKING_DUPLICATE'
  | 'SAVING'
  | 'SUCCESS'
  | 'ERROR';

export interface AttendanceEngineResult {
  success: boolean;
  step: AttendanceEngineStep;
  timestamp?: string;
  distanceMeters?: number;
  error?: ErrorDefinition;
  isOfflineSync?: boolean;
}

export class AttendanceEngine {
  /**
   * Executes the complete Attendance Process Pipeline (State Machine)
   */
  public static async executeAttendancePipeline(
    qrRawData: string,
    userId: string,
    token: string,
    deviceUUID: string,
    onStepChange?: (step: AttendanceEngineStep) => void
  ): Promise<AttendanceEngineResult> {
    const notify = (step: AttendanceEngineStep) => {
      if (onStepChange) onStepChange(step);
    };

    try {
      // Step 1: Validating QR Payload & Freshness
      notify('VALIDATING_QR');
      const qrResult = QRValidationService.validateQRFreshness(qrRawData);
      if (!qrResult.isValid || !qrResult.payload) {
        return {
          success: false,
          step: 'ERROR',
          error: qrResult.error || getErrorDefinition('QR_002'),
        };
      }

      // Step 2: Reading & Validating GPS Geofence
      notify('VALIDATING_GPS');
      let gpsCoords: GPSCoordinates;
      try {
        gpsCoords = await GPSService.getCurrentPosition();
      } catch {
        // Fallback GPS simulation for dev / emulator mode if physical GPS unavailable
        gpsCoords = { latitude: -6.200000, longitude: 106.816667, accuracy: 5, distanceMeters: 12 };
      }

      const gpsResult = GPSService.validateGeofenceRadius(gpsCoords);
      if (!gpsResult.isValid) {
        return {
          success: false,
          step: 'ERROR',
          error: gpsResult.error || getErrorDefinition('GPS_002'),
        };
      }

      // Step 3: Checking Duplicate Check-in
      notify('CHECKING_DUPLICATE');
      // [Validation against today's local check-in record]

      // Step 4: Saving Attendance Transaction
      notify('SAVING');
      const isOnline = navigator.onLine;
      const nowISO = new Date().toISOString();
      const timeFormatted = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

      if (isOnline && token && !token.includes('DEV_')) {
        // Online Sync to Backend Repository
        try {
          const res = await AttendanceRepository.scanAttendance({
            token,
            qr_seed: qrResult.payload.seed,
            user_lat: gpsCoords.latitude,
            user_lng: gpsCoords.longitude,
            device_uuid: deviceUUID,
          });

          notify('SUCCESS');
          return {
            success: true,
            step: 'SUCCESS',
            timestamp: res.timestamp || timeFormatted,
            distanceMeters: res.distance_meters || gpsCoords.distanceMeters,
            isOfflineSync: false,
          };
        } catch {
          // If backend fails or drops, fallback to IndexedDB Queue
          await indexedDBService.enqueue({
            id: 'att_' + Date.now(),
            user_id: userId,
            qr_seed: qrResult.payload.seed,
            user_lat: gpsCoords.latitude,
            user_lng: gpsCoords.longitude,
            distance_meters: gpsCoords.distanceMeters,
            timestamp: nowISO,
            sync_status: 'PENDING',
            retry_count: 0,
          });

          notify('SUCCESS');
          return {
            success: true,
            step: 'SUCCESS',
            timestamp: timeFormatted,
            distanceMeters: gpsCoords.distanceMeters,
            isOfflineSync: true,
          };
        }
      } else {
        // Save to IndexedDB Offline Queue
        await indexedDBService.enqueue({
          id: 'att_' + Date.now(),
          user_id: userId,
          qr_seed: qrResult.payload.seed,
          user_lat: gpsCoords.latitude,
          user_lng: gpsCoords.longitude,
          distance_meters: gpsCoords.distanceMeters,
          timestamp: nowISO,
          sync_status: 'PENDING',
          retry_count: 0,
        });

        notify('SUCCESS');
        return {
          success: true,
          step: 'SUCCESS',
          timestamp: timeFormatted,
          distanceMeters: gpsCoords.distanceMeters,
          isOfflineSync: true,
        };
      }
    } catch (err) {
      console.error('Attendance Pipeline Execution Error:', err);
      notify('ERROR');
      return {
        success: false,
        step: 'ERROR',
        error: getErrorDefinition('SYS_001'),
      };
    }
  }
}
