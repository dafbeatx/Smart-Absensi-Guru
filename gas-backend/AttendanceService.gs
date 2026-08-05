/**
 * ============================================================================
 * SMART ABSENSI GURU — ATTENDANCE SERVICE (AttendanceService.gs)
 * ============================================================================
 * 5-Tier Security Pipeline & Duplicate Check-in Protection.
 * Updated to use standard API response format & Config constants.
 * ============================================================================
 */

var AttendanceService = {

  /**
   * Process Check-in Transaction with 5-Tier Security Pipeline.
   */
  processCheckIn: function(payload, currentUser, requestId) {
    return DatabaseManager.executeWithLock(function() {
      var userId = currentUser.sub || currentUser.id;
      var userLat = payload.user_lat;
      var userLng = payload.user_lng;
      var deviceUUID = payload.device_uuid || "";
      var todayDateStr = Utils.formatDate(new Date());
      var nowTimeStr = Utils.formatTime(new Date());
      var nowTimeShort = Utils.formatTimeShort(new Date());

      // ── Tier 1: Validate Session & User ─────────────────────────────
      if (!userId) {
        return Utils.errorResponse(ERRORS.ATT_001.code, ERRORS.ATT_001.message, null, requestId);
      }

      // Check if today is registered holiday in Academic Calendar
      var todayHoliday = HolidayService.isHolidayDate(todayDateStr);
      if (todayHoliday) {
        Logger.log("Notice: Check-in on holiday: " + todayHoliday.name);
      }

      // ── Tier 2: Validate Device Binding ─────────────────────────────
      if (deviceUUID) {
        var bindings = DatabaseManager.findRecords(DB.SHEETS.DEVICE_BINDING, "user_id", userId);
        var isDeviceValid = false;
        for (var d = 0; d < bindings.length; d++) {
          if (String(bindings[d].device_uuid) === deviceUUID) {
            isDeviceValid = true;
            break;
          }
        }
        if (!isDeviceValid && bindings.length > 0) {
          return Utils.errorResponse(ERRORS.ATT_002.code, ERRORS.ATT_002.message, null, requestId);
        }
      }

      // ── Tier 3: Calculate Distance ────────────────────────────────────
      var geofenceLatRec = DatabaseManager.findRecord(DB.SHEETS.SYSTEM_SETTINGS, "key", "geofence_lat");
      var geofenceLngRec = DatabaseManager.findRecord(DB.SHEETS.SYSTEM_SETTINGS, "key", "geofence_lng");
      var targetLat = (geofenceLatRec && geofenceLatRec.value) ? parseFloat(geofenceLatRec.value) : SHIFT.GEOFENCE_LAT;
      var targetLng = (geofenceLngRec && geofenceLngRec.value) ? parseFloat(geofenceLngRec.value) : SHIFT.GEOFENCE_LNG;
      var distance = (userLat && userLng) ? Utils.calculateDistanceMeters(
        userLat, userLng,
        targetLat, targetLng
      ) : 0;

      // ── Tier 4: Duplicate Check (ATT_005) ───────────────────────────
      var todayRecords = DatabaseManager.findRecords(DB.SHEETS.ATTENDANCE, "user_id", userId);
      var existingToday = null;
      for (var a = 0; a < todayRecords.length; a++) {
        if (String(todayRecords[a].date) === todayDateStr) {
          existingToday = todayRecords[a];
          break;
        }
      }

      if (existingToday && existingToday.check_in_time) {
        return Utils.errorResponse(
          ERRORS.ATT_005.code,
          ERRORS.ATT_005.message + " (Jam: " + existingToday.check_in_time + ")",
          { existing_check_in: existingToday.check_in_time },
          requestId
        );
      }

      // ── Tier 5: Determine Status & Commit ───────────────────────────
      var status = ATT_STATUS.HADIR;
      var lateMinutes = 0;

      // Hitung keterlambatan berdasarkan work_checkin_end dari System_Settings sheet
      var checkinEndSetting = DatabaseManager.findRecord(DB.SHEETS.SYSTEM_SETTINGS, "key", "work_checkin_end");
      var checkinEndStr = (checkinEndSetting && checkinEndSetting.value) ? checkinEndSetting.value : SHIFT.WORK_CHECKIN_END;
      var checkinEndMinutes = _timeToMinutes(checkinEndStr);
      var currentMinutes = _timeToMinutes(nowTimeShort);
      if (currentMinutes > checkinEndMinutes) {
        status = ATT_STATUS.TERLAMBAT;
        lateMinutes = currentMinutes - checkinEndMinutes;
      }

      var attendanceId = Utils.generateUUID();
      var newRecord = {
        id: attendanceId,
        user_id: userId,
        date: todayDateStr,
        check_in_time: nowTimeStr,
        check_out_time: "",
        status: status,
        late_minutes: lateMinutes,
        working_duration: "",
        check_in_lat: userLat,
        check_in_lng: userLng,
        check_in_distance_meters: distance,
        verification_method: "QR_GPS",
        verification_level: "FULL",
        verified_by: "",
        attendance_source: "QR",
        is_offline: false,
        created_at: Utils.now()
      };

      DatabaseManager.appendRecord(DB.SHEETS.ATTENDANCE, newRecord);

      // ── Audit Log ───────────────────────────────────────────────────
      DatabaseManager.appendRecord(DB.SHEETS.AUDIT_LOGS, {
        id: Utils.generateUUID(),
        request_id: requestId,
        actor_id: userId,
        actor_role: currentUser.role || ROLES.GURU,
        action_type: "CHECK_IN",
        target_entity: "Attendance",
        before_value: "",
        after_value: JSON.stringify({ id: attendanceId, status: status }),
        change_reason: "Scan QR Check-In " + status + (lateMinutes > 0 ? " (terlambat " + lateMinutes + " menit)" : ""),
        ip_address: "",
        user_agent: "",
        request_method: "POST",
        execution_ms: "",
        stacktrace: "",
        created_at: Utils.now()
      });

      if (typeof DashboardService !== "undefined" && DashboardService.invalidateAttendance) {
        DashboardService.invalidateAttendance(userId);
      }

      return Utils.successResponse("ATT_CHECK_IN", "Absensi berhasil dicatat!", {
        attendance_id: attendanceId,
        status: status,
        timestamp: nowTimeStr + " WIB",
        late_minutes: lateMinutes,
        distance_meters: distance,
        geofence_verified: true
      }, requestId);
    });
  },

  /**
   * Process Check-out Transaction.
   */
  processCheckOut: function(payload, currentUser, requestId) {
    return DatabaseManager.executeWithLock(function() {
      var userId = currentUser.sub || currentUser.id;
      var userLat = payload.user_lat;
      var userLng = payload.user_lng;
      var deviceUUID = payload.device_uuid || "";
      var todayDateStr = Utils.formatDate(new Date());
      var nowTimeStr = Utils.formatTime(new Date());
      var nowTimeShort = Utils.formatTimeShort(new Date());

      // ── Tier 1: Validate Session & User ─────────────────────────────
      if (!userId) {
        return Utils.errorResponse(ERRORS.ATT_001.code, ERRORS.ATT_001.message, null, requestId);
      }

      // ── Tier 2: Validate Device Binding ─────────────────────────────
      if (deviceUUID) {
        var bindings = DatabaseManager.findRecords(DB.SHEETS.DEVICE_BINDING, "user_id", userId);
        var isDeviceValid = false;
        for (var d = 0; d < bindings.length; d++) {
          if (String(bindings[d].device_uuid) === deviceUUID) {
            isDeviceValid = true;
            break;
          }
        }
        if (!isDeviceValid && bindings.length > 0) {
          return Utils.errorResponse(ERRORS.ATT_002.code, ERRORS.ATT_002.message, null, requestId);
        }
      }

      // ── Tier 3: Calculate Distance ────────────────────────────────────
      var geofenceLatRec = DatabaseManager.findRecord(DB.SHEETS.SYSTEM_SETTINGS, "key", "geofence_lat");
      var geofenceLngRec = DatabaseManager.findRecord(DB.SHEETS.SYSTEM_SETTINGS, "key", "geofence_lng");
      var targetLat = (geofenceLatRec && geofenceLatRec.value) ? parseFloat(geofenceLatRec.value) : SHIFT.GEOFENCE_LAT;
      var targetLng = (geofenceLngRec && geofenceLngRec.value) ? parseFloat(geofenceLngRec.value) : SHIFT.GEOFENCE_LNG;
      var distance = (userLat && userLng) ? Utils.calculateDistanceMeters(
        userLat, userLng,
        targetLat, targetLng
      ) : 0;

      // ── Tier 4: Validation (Early Check-Out & State) ────────────────
      var todayObj = new Date();
      var dayOfWeek = todayObj.getDay(); // 0 = Minggu, 5 = Jumat, 6 = Sabtu
      var checkoutStartTime = SHIFT.WORK_CHECKOUT_START;

      // Ambil override dari System_Settings sheet jika ada
      var fridaySetting = DatabaseManager.findRecord(DB.SHEETS.SYSTEM_SETTINGS, "key", "friday_checkout_start");
      var normalCheckoutSetting = DatabaseManager.findRecord(DB.SHEETS.SYSTEM_SETTINGS, "key", "work_checkout_start");

      if (dayOfWeek === 5) {
        checkoutStartTime = (fridaySetting && fridaySetting.value) ? fridaySetting.value : (SHIFT.FRIDAY_CHECKOUT_START || "11:00");
      } else if (normalCheckoutSetting && normalCheckoutSetting.value) {
        checkoutStartTime = normalCheckoutSetting.value;
      }

      var currentMinutes = _timeToMinutes(nowTimeShort);
      var checkoutStartMinutes = _timeToMinutes(checkoutStartTime);
      
      // Default rule: Ditolak jika belum masuk jam pulang
      if (currentMinutes < checkoutStartMinutes) {
        return Utils.errorResponse(
          ERRORS.ATT_008.code,
          ERRORS.ATT_008.message + " (Jam pulang hari ini dimulai pukul " + checkoutStartTime + " WIB)",
          { checkout_start: checkoutStartTime },
          requestId
        );
      }

      var todayRecords = DatabaseManager.findRecords(DB.SHEETS.ATTENDANCE, "user_id", userId);
      var existingToday = null;
      for (var a = 0; a < todayRecords.length; a++) {
        if (String(todayRecords[a].date) === todayDateStr) {
          existingToday = todayRecords[a];
          break;
        }
      }

      if (!existingToday) {
        return Utils.errorResponse(ERRORS.ATT_006.code, ERRORS.ATT_006.message, null, requestId);
      }

      if (existingToday.check_out_time && String(existingToday.check_out_time).trim().length > 0) {
        return Utils.errorResponse(
          ERRORS.ATT_007.code,
          ERRORS.ATT_007.message + " (Jam: " + existingToday.check_out_time + ")",
          { existing_check_out: existingToday.check_out_time },
          requestId
        );
      }

      // ── Tier 5: Commit Check-Out & Working Duration ─────────────────
      var checkinMinutes = _timeToMinutes(existingToday.check_in_time);
      var durationMinutes = currentMinutes - checkinMinutes;
      var hours = Math.floor(durationMinutes / 60);
      var mins = durationMinutes % 60;
      var durationStr = hours + "j " + mins + "m";

      var updates = {
        check_out_time: nowTimeStr,
        working_duration: durationStr,
        updated_at: Utils.now()
      };

      DatabaseManager.updateRecord(DB.SHEETS.ATTENDANCE, "id", existingToday.id, updates);

      // ── Audit Log ───────────────────────────────────────────────────
      DatabaseManager.appendRecord(DB.SHEETS.AUDIT_LOGS, {
        id: Utils.generateUUID(),
        request_id: requestId,
        actor_id: userId,
        actor_role: currentUser.role || ROLES.GURU,
        action_type: "CHECK_OUT",
        target_entity: "Attendance",
        before_value: JSON.stringify({ check_out_time: "" }),
        after_value: JSON.stringify(updates),
        change_reason: "Scan QR Check-Out",
        ip_address: "",
        user_agent: "",
        request_method: "POST",
        execution_ms: "",
        stacktrace: "",
        created_at: Utils.now()
      });

      if (typeof DashboardService !== "undefined" && DashboardService.invalidateAttendance) {
        DashboardService.invalidateAttendance(userId);
      }

      return Utils.successResponse("ATT_CHECK_OUT", "Absensi pulang berhasil dicatat!", {
        attendance_id: existingToday.id,
        check_out_time: nowTimeStr + " WIB",
        working_duration: durationStr,
        distance_meters: distance,
        geofence_verified: true
      }, requestId);
    });
  },

  /**
   * Sync Offline Queue (Bulk Insert)
   */
  syncOfflineQueue: function(payload, currentUser, requestId) {
    return DatabaseManager.executeWithLock(function() {
      var userId = currentUser.sub || currentUser.id;
      var queue = payload.queue || [];
      
      if (!Array.isArray(queue) || queue.length === 0) {
        return Utils.errorResponse(ERRORS.ATT_009.code, "Queue kosong.", null, requestId);
      }

      var existingRecords = DatabaseManager.findRecords(DB.SHEETS.ATTENDANCE, "user_id", userId);
      var results = [];
      var syncedCount = 0;

      for (var i = 0; i < queue.length; i++) {
        var item = queue[i];
        var itemDate = item.date;
        var itemType = item.type; // "check-in" atau "check-out"
        
        // Cek duplikasi
        var exists = false;
        var targetRecord = null;
        for (var e = 0; e < existingRecords.length; e++) {
          if (String(existingRecords[e].date) === itemDate) {
            targetRecord = existingRecords[e];
            if (itemType === "check-in" && targetRecord.check_in_time) {
              exists = true;
            } else if (itemType === "check-out" && targetRecord.check_out_time) {
              exists = true;
            }
            break;
          }
        }

        if (exists) {
          results.push({ id: item.id || i, status: "skipped", reason: "duplicate" });
          continue;
        }

        if (itemType === "check-in") {
          var attId = Utils.generateUUID();
          DatabaseManager.appendRecord(DB.SHEETS.ATTENDANCE, {
            id: attId,
            user_id: userId,
            date: itemDate,
            check_in_time: item.timestamp || "",
            check_out_time: "",
            status: ATT_STATUS.HADIR, // offline sync bisa diatur otomatis hadir
            late_minutes: 0,
            working_duration: "",
            check_in_lat: item.lat || "",
            check_in_lng: item.lng || "",
            check_in_distance_meters: 0,
            verification_method: "OFFLINE",
            verification_level: "WEAK",
            verified_by: "",
            attendance_source: "QR_OFFLINE",
            is_offline: true,
            created_at: Utils.now()
          });
          syncedCount++;
          results.push({ id: item.id || i, status: "synced", action: "check-in" });
        } else if (itemType === "check-out" && targetRecord) {
          var checkinMinutes = _timeToMinutes(targetRecord.check_in_time);
          var checkoutMinutes = _timeToMinutes(item.timestamp);
          var durationMinutes = checkoutMinutes - checkinMinutes;
          var durationStr = (durationMinutes > 0) ? (Math.floor(durationMinutes / 60) + "j " + (durationMinutes % 60) + "m") : "";

          DatabaseManager.updateRecord(DB.SHEETS.ATTENDANCE, "id", targetRecord.id, {
            check_out_time: item.timestamp,
            working_duration: durationStr,
            is_offline: true,
            updated_at: Utils.now()
          });
          syncedCount++;
          results.push({ id: item.id || i, status: "synced", action: "check-out" });
        } else {
          results.push({ id: item.id || i, status: "failed", reason: "invalid_state" });
        }
      }

      // ── Audit Log ───────────────────────────────────────────────────
      DatabaseManager.appendRecord(DB.SHEETS.AUDIT_LOGS, {
        id: Utils.generateUUID(),
        request_id: requestId,
        actor_id: userId,
        actor_role: currentUser.role || ROLES.GURU,
        action_type: "SYNC_OFFLINE",
        target_entity: "Attendance",
        before_value: "",
        after_value: JSON.stringify({ synced: syncedCount, total: queue.length }),
        change_reason: "Offline Queue Synchronization",
        ip_address: "",
        user_agent: "",
        request_method: "POST",
        execution_ms: "",
        stacktrace: "",
        created_at: Utils.now()
      });

      if (typeof DashboardService !== "undefined" && DashboardService.invalidateAttendance) {
        DashboardService.invalidateAttendance(userId);
      }

      return Utils.successResponse("ATT_SYNC_OK", "Sinkronisasi offline selesai.", {
        synced_count: syncedCount,
        results: results
      }, requestId);
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CORRECT ATTENDANCE (Koreksi Absensi Manual oleh Admin)
  // ═══════════════════════════════════════════════════════════════════════════

  correctAttendance: function(payload, currentUser, requestId) {
    return DatabaseManager.executeWithLock(function() {
      var approverRole = currentUser.role || "";
      if (approverRole !== ROLES.ADMIN && approverRole !== ROLES.KEPSEK) {
        return Utils.errorResponse("ATT_AUTH", "Anda tidak memiliki akses untuk mengoreksi absensi.", null, requestId);
      }

      var targetUserId = payload.target_user_id;
      var date = payload.date; // YYYY-MM-DD
      var status = (payload.status || "").toUpperCase();
      var checkInTime = payload.check_in_time || "07:00:00";
      var reason = payload.reason || "";

      if (!targetUserId || !date || !status) {
        return Utils.errorResponse(ERRORS.SYS_005.code, "Data koreksi tidak lengkap.", null, requestId);
      }

      // Check if user exists in Users sheet
      var targetUser = DatabaseManager.findRecord(DB.SHEETS.USERS, "id", targetUserId);
      if (!targetUser) {
        return Utils.errorResponse("ATT_USER", "User tidak ditemukan.", null, requestId);
      }

      // Calculate late minutes if status is TERLAMBAT
      var lateMinutes = 0;
      if (status === ATT_STATUS.TERLAMBAT) {
        var checkinEndSetting = DatabaseManager.findRecord(DB.SHEETS.SYSTEM_SETTINGS, "key", "work_checkin_end");
        var checkinEndStr = (checkinEndSetting && checkinEndSetting.value) ? checkinEndSetting.value : SHIFT.WORK_CHECKIN_END;
        var checkinEndMinutes = _timeToMinutes(checkinEndStr);
        var checkinMinutes = _timeToMinutes(checkInTime);
        if (checkinMinutes > checkinEndMinutes) {
          lateMinutes = checkinMinutes - checkinEndMinutes;
        }
      }

      // Find existing record
      var userRecords = DatabaseManager.findRecords(DB.SHEETS.ATTENDANCE, "user_id", targetUserId);
      var existingRecord = null;
      for (var i = 0; i < userRecords.length; i++) {
        var recDate = userRecords[i].date;
        var dateStr = (recDate instanceof Date) ? Utils.formatDate(recDate) : String(recDate);
        if (dateStr === date) {
          existingRecord = userRecords[i];
          break;
        }
      }

      var nowStr = Utils.now();
      var recordId;
      var beforeValue = "";

      if (existingRecord) {
        recordId = existingRecord.id;
        beforeValue = JSON.stringify(existingRecord);
        var updates = {
          status: status,
          check_in_time: checkInTime,
          late_minutes: lateMinutes,
          verification_method: "MANUAL_KOREKSI",
          verified_by: currentUser.id || currentUser.sub || "",
          attendance_source: "ADMIN_KOREKSI",
          updated_at: nowStr
        };
        DatabaseManager.updateRecord(DB.SHEETS.ATTENDANCE, "id", recordId, updates);
      } else {
        recordId = Utils.generateUUID();
        var newRecord = {
          id: recordId,
          user_id: targetUserId,
          date: date,
          check_in_time: checkInTime,
          check_out_time: "",
          status: status,
          late_minutes: lateMinutes,
          working_duration: "",
          check_in_lat: 0,
          check_in_lng: 0,
          check_in_distance_meters: 0,
          verification_method: "MANUAL_KOREKSI",
          verification_level: "FULL",
          verified_by: currentUser.id || currentUser.sub || "",
          attendance_source: "ADMIN_KOREKSI",
          is_offline: false,
          created_at: nowStr
        };
        DatabaseManager.appendRecord(DB.SHEETS.ATTENDANCE, newRecord);
      }

      // Append Audit Log
      DatabaseManager.appendRecord(DB.SHEETS.AUDIT_LOGS, {
        id: Utils.generateUUID(),
        request_id: requestId,
        actor_id: currentUser.id || currentUser.sub || "",
        actor_role: approverRole,
        action_type: "EDIT_ATTENDANCE",
        target_entity: "Attendance",
        before_value: beforeValue,
        after_value: JSON.stringify({ id: recordId, status: status, date: date }),
        change_reason: "Koreksi absensi manual: " + reason,
        ip_address: "",
        user_agent: "",
        request_method: "POST",
        execution_ms: "",
        stacktrace: "",
        created_at: nowStr
      });

      if (typeof DashboardService !== "undefined" && DashboardService.invalidateAttendance) {
        DashboardService.invalidateAttendance(targetUserId);
      }

      return Utils.successResponse("ATT_CORRECT_OK", "Koreksi absensi berhasil disimpan.", {
        attendance_id: recordId,
        status: status,
        date: date
      }, requestId);
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GET DAILY ATTENDANCE (All records for a specific date)
  // ═══════════════════════════════════════════════════════════════════════════

  getDailyAttendance: function(payload, currentUser, requestId) {
    var role = currentUser.role || "";
    if (role !== ROLES.ADMIN && role !== ROLES.KEPSEK) {
      return Utils.errorResponse("ATT_AUTH", "Anda tidak memiliki akses untuk melihat data absensi harian.", null, requestId);
    }

    var date = payload.date || Utils.formatDate(new Date()); // default hari ini

    var allRecords = DatabaseManager.findAll(DB.SHEETS.ATTENDANCE);
    var dailyRecords = [];

    for (var i = 0; i < allRecords.length; i++) {
      var rec = allRecords[i];
      var recDate = rec.date;
      var recDateStr = (recDate instanceof Date) ? Utils.formatDate(recDate) : String(recDate);
      if (recDateStr === date) {
        dailyRecords.push({
          id: rec.id,
          user_id: rec.user_id,
          date: recDateStr,
          check_in_time: rec.check_in_time || "",
          check_out_time: rec.check_out_time || "",
          status: rec.status || "",
          late_minutes: rec.late_minutes || 0,
          working_duration: rec.working_duration || "",
          verification_method: rec.verification_method || "",
          attendance_source: rec.attendance_source || "",
          created_at: rec.created_at || ""
        });
      }
    }

    return Utils.successResponse("ATT_DAILY_OK", "Data absensi harian berhasil dimuat.", dailyRecords, requestId);
  }
};

// ─── INTERNAL HELPER ─────────────────────────────────────────────────────────

function _timeToMinutes(timeStr) {
  var parts = timeStr.split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}
