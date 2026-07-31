import type { OfflineAttendanceRecord } from './indexed-db.service';
import type { AttendanceRecord } from '../types/database.types';

export type ResolutionStrategy = 'CLIENT_WINS' | 'SERVER_WINS' | 'MERGE';

export interface ConflictResolutionResult {
  strategyUsed: ResolutionStrategy;
  finalRecord: AttendanceRecord | OfflineAttendanceRecord;
  hasConflict: boolean;
}

export class ConflictResolver {
  /**
   * Resolves transaction conflicts between offline IndexedDB queue and backend database
   */
  public static resolveAttendanceConflict(
    clientRecord: OfflineAttendanceRecord,
    serverRecord: AttendanceRecord | null,
    preferredStrategy: ResolutionStrategy = 'CLIENT_WINS'
  ): ConflictResolutionResult {
    if (!serverRecord) {
      return {
        strategyUsed: preferredStrategy,
        finalRecord: clientRecord,
        hasConflict: false,
      };
    }

    // Conflict exists if server already has check-in time
    if (serverRecord.check_in_time && preferredStrategy === 'SERVER_WINS') {
      return {
        strategyUsed: 'SERVER_WINS',
        finalRecord: serverRecord,
        hasConflict: true,
      };
    }

    // Client wins strategy (Default for offline check-ins)
    return {
      strategyUsed: 'CLIENT_WINS',
      finalRecord: clientRecord,
      hasConflict: true,
    };
  }
}
