/**
 * ============================================================================
 * SMART ABSENSI GURU — LEAVE MANAGEMENT SERVICE (LeaveService.gs)
 * ============================================================================
 * Pengajuan Izin (Sakit, Izin, DL) dan Approval Workflow.
 * Fitur Utama:
 *   - submitLeave() : Diajukan oleh Guru (status PENDING).
 *   - approveLeave(): Disetujui/Ditolak oleh Kepsek/Admin. Jika disetujui,
 *                     otomatis meng-inject data kehadiran kosong (status Izin)
 *                     ke sheet Attendance (Single Source of Truth).
 * ============================================================================
 */

var LeaveService = {

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBMIT LEAVE (Diajukan oleh Guru)
  // ═══════════════════════════════════════════════════════════════════════════

  submitLeave: function(payload, currentUser, requestId) {
    return DatabaseManager.executeWithLock(function() {
      var userId = currentUser.sub || currentUser.id;
      var leaveType = (payload.leave_type || "").toUpperCase(); // IZIN, SAKIT, DINAS_LUAR
      var startDate = payload.start_date || "";
      var endDate = payload.end_date || "";
      var reason = payload.reason || "";
      var attachmentUrl = payload.attachment_url || "";

      // ── 1. Validasi Input ──────────────────────────────────────────────────
      if (!leaveType || !startDate || !endDate || !reason) {
        return Utils.errorResponse(ERRORS.SYS_005.code, "Data pengajuan tidak lengkap.", null, requestId);
      }

      var start = new Date(startDate);
      var end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        return Utils.errorResponse(ERRORS.LEV_001.code, ERRORS.LEV_001.message, null, requestId);
      }

      if (reason.trim().length < 10) {
        return Utils.errorResponse(ERRORS.LEV_004.code, ERRORS.LEV_004.message, null, requestId);
      }

      var allowedTypes = [ATT_STATUS.IZIN, ATT_STATUS.SAKIT, ATT_STATUS.DINAS_LUAR];
      if (allowedTypes.indexOf(leaveType) === -1) {
        return Utils.errorResponse("LEV_TYPE", "Tipe izin tidak valid.", null, requestId);
      }

      // ── 2. Cek Overlap (Tumpang Tindih) ────────────────────────────────────
      var existingLeaves = DatabaseManager.findRecords(DB.SHEETS.LEAVE_REQUESTS, "user_id", userId);
      for (var i = 0; i < existingLeaves.length; i++) {
        var el = existingLeaves[i];
        if (el.approval_status !== APPROVAL_STATUS.REJECTED) {
          var elStart = new Date(el.start_date);
          var elEnd = new Date(el.end_date);
          // Overlap check
          if (start <= elEnd && end >= elStart) {
            return Utils.errorResponse(
              ERRORS.LEV_003.code,
              ERRORS.LEV_003.message + " (Terdapat pengajuan " + el.leave_type + " pada " + el.start_date + " - " + el.end_date + ")",
              null,
              requestId
            );
          }
        }
      }

      // ── 3. Simpan Pengajuan ────────────────────────────────────────────────
      var leaveId = Utils.generateUUID();
      var nowStr = Utils.now();

      var newRecord = {
        id: leaveId,
        user_id: userId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason,
        attachment_url: attachmentUrl,
        approval_status: APPROVAL_STATUS.SUBMITTED,
        approved_by: "",
        approval_notes: "",
        approved_at: "",
        rejected_at: "",
        approval_deadline: "",
        created_at: nowStr,
        updated_at: nowStr
      };

      DatabaseManager.appendRecord(DB.SHEETS.LEAVE_REQUESTS, newRecord);

      // ── 4. Audit Log ───────────────────────────────────────────────────────
      DatabaseManager.appendRecord(DB.SHEETS.AUDIT_LOGS, {
        id: Utils.generateUUID(),
        request_id: requestId,
        actor_id: userId,
        actor_role: currentUser.role || ROLES.GURU,
        action_type: "SUBMIT_LEAVE",
        target_entity: "Leave_Requests",
        before_value: "",
        after_value: JSON.stringify({ leave_id: leaveId, type: leaveType, status: APPROVAL_STATUS.SUBMITTED }),
        change_reason: "Pengajuan " + leaveType + " (" + startDate + " s.d " + endDate + ")",
        ip_address: "",
        user_agent: "",
        request_method: "POST",
        execution_ms: "",
        stacktrace: "",
        created_at: nowStr
      });

      DashboardService.invalidateLeave(userId);

      return Utils.successResponse("LEV_SUBMIT_OK", "Pengajuan izin berhasil dikirim.", {
        leave_id: leaveId,
        status: APPROVAL_STATUS.SUBMITTED
      }, requestId);
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // APPROVE LEAVE (Diproses oleh Kepsek / Admin)
  // ═══════════════════════════════════════════════════════════════════════════

  approveLeave: function(payload, currentUser, requestId) {
    return DatabaseManager.executeWithLock(function() {
      var approverId = currentUser.sub || currentUser.id;
      var approverRole = currentUser.role || "";

      // ── 1. Validasi Role ───────────────────────────────────────────────────
      if (approverRole !== ROLES.KEPSEK && approverRole !== ROLES.ADMIN) {
        return Utils.errorResponse("LEV_AUTH", "Anda tidak memiliki akses untuk menyetujui izin.", null, requestId);
      }

      var leaveId = payload.leave_id;
      var newStatus = (payload.status || "").toUpperCase(); // APPROVED, REJECTED
      var notes = payload.notes || "";

      if (!leaveId || !newStatus) {
        return Utils.errorResponse(ERRORS.SYS_005.code, "ID Izin dan Status wajib diisi.", null, requestId);
      }

      if (newStatus !== APPROVAL_STATUS.APPROVED && newStatus !== APPROVAL_STATUS.REJECTED) {
        return Utils.errorResponse("LEV_STATUS", "Status persetujuan tidak valid.", null, requestId);
      }

      // ── 2. Cari Data Pengajuan ─────────────────────────────────────────────
      var leaveRecord = DatabaseManager.findRecord(DB.SHEETS.LEAVE_REQUESTS, "id", leaveId);
      if (!leaveRecord) {
        return Utils.errorResponse("LEV_NOT_FOUND", "Data pengajuan izin tidak ditemukan.", null, requestId);
      }

      if (leaveRecord.approval_status === APPROVAL_STATUS.APPROVED || leaveRecord.approval_status === APPROVAL_STATUS.REJECTED) {
        return Utils.errorResponse("LEV_PROCESSED", "Pengajuan izin ini sudah diproses sebelumnya.", null, requestId);
      }

      // ── 3. Update Status ───────────────────────────────────────────────────
      var nowStr = Utils.now();
      var updates = {
        approval_status: newStatus,
        approved_by: approverId,
        approval_notes: notes,
        updated_at: nowStr
      };

      if (newStatus === APPROVAL_STATUS.APPROVED) {
        updates.approved_at = nowStr;
      } else {
        updates.rejected_at = nowStr;
      }

      DatabaseManager.updateRecord(DB.SHEETS.LEAVE_REQUESTS, "id", leaveId, updates);

      // ── 4. (Rekomendasi) Auto-Inject ke Sheet Attendance jika APPROVED ─────
      var injectedCount = 0;
      if (newStatus === APPROVAL_STATUS.APPROVED) {
        injectedCount = LeaveService._injectAttendance(
          leaveRecord.user_id,
          leaveRecord.leave_type,
          leaveRecord.start_date,
          leaveRecord.end_date,
          approverId
        );
      }

      // ── 5. Audit Log ───────────────────────────────────────────────────────
      DatabaseManager.appendRecord(DB.SHEETS.AUDIT_LOGS, {
        id: Utils.generateUUID(),
        request_id: requestId,
        actor_id: approverId,
        actor_role: approverRole,
        action_type: "APPROVE_LEAVE",
        target_entity: "Leave_Requests",
        before_value: JSON.stringify({ status: leaveRecord.approval_status }),
        after_value: JSON.stringify(updates),
        change_reason: "Persetujuan izin: " + newStatus,
        ip_address: "",
        user_agent: "",
        request_method: "POST",
        execution_ms: "",
        stacktrace: "",
        created_at: nowStr
      });

      DashboardService.invalidateLeave(leaveRecord.user_id);

      return Utils.successResponse("LEV_APPROVE_OK", "Pengajuan izin berhasil diproses (" + newStatus + ").", {
        leave_id: leaveId,
        status: newStatus,
        attendance_injected: injectedCount
      }, requestId);
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Meng-inject baris kehadiran kosong untuk setiap hari dalam rentang izin
   * yang disetujui. Ini membuat sheet Attendance menjadi Single Source of Truth.
   */
  _injectAttendance: function(userId, leaveType, startDateStr, endDateStr, approverId) {
    var start = new Date(startDateStr);
    var end = new Date(endDateStr);
    var injected = 0;

    // Looping dari startDate sampai endDate
    for (var d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      // Abaikan akhir pekan (opsional, tergantung config, di sini Sabtu/Minggu diabaikan sementara)
      if (d.getDay() === 0 || d.getDay() === 6) {
        continue;
      }

      var dateStr = Utils.formatDate(d);
      
      // Pastikan belum ada attendance untuk tanggal ini (atau overwrite jika belum lengkap)
      var existingRecords = DatabaseManager.findRecords(DB.SHEETS.ATTENDANCE, "user_id", userId);
      var exists = false;
      for (var i = 0; i < existingRecords.length; i++) {
        if (String(existingRecords[i].date) === dateStr) {
          exists = true;
          break;
        }
      }

      if (!exists) {
        DatabaseManager.appendRecord(DB.SHEETS.ATTENDANCE, {
          id: Utils.generateUUID(),
          user_id: userId,
          date: dateStr,
          check_in_time: "00:00:00",
          check_out_time: "00:00:00",
          status: leaveType,          // SAKIT / IZIN / DINAS_LUAR
          late_minutes: 0,
          working_duration: "0j 0m",
          check_in_lat: 0,
          check_in_lng: 0,
          check_in_distance_meters: 0,
          verification_method: "SYSTEM_APPROVED",
          verification_level: "FULL",
          verified_by: approverId,
          attendance_source: "SYSTEM",
          is_offline: false,
          created_at: Utils.now()
        });
        injected++;
      }
    }
    
    return injected;
  }
};
