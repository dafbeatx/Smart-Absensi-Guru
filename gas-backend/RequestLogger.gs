/**
 * ============================================================================
 * SMART ABSENSI GURU — REQUEST & ERROR LOGGER (RequestLogger.gs)
 * ============================================================================
 * Middleware logger terpisah:
 *   - Request_Logs : Setiap request masuk (semua action)
 *   - Error_Logs   : Exception & error kritis
 *   - Audit_Logs   : Perubahan data (diisi oleh service masing-masing)
 * ============================================================================
 */

var RequestLogger = {

  /**
   * Log sebuah incoming request ke sheet Request_Logs.
   * Dipanggil di awal Main.gs setelah parsing.
   *
   * @param {Object} params
   * @param {string} params.requestId
   * @param {string} params.action
   * @param {string} params.method        - "GET" atau "POST"
   * @param {string} [params.actorId]
   * @param {string} [params.actorRole]
   * @param {string} [params.ipAddress]
   * @param {string} [params.userAgent]
   * @param {number} [params.payloadSize]
   */
  logRequest: function(params) {
    try {
      DatabaseManager.appendRecord(DB.SHEETS.REQUEST_LOGS, {
        id: Utils.generateUUID(),
        request_id: params.requestId || "",
        action: params.action || "UNKNOWN",
        method: params.method || "POST",
        actor_id: params.actorId || "",
        actor_role: params.actorRole || "",
        ip_address: params.ipAddress || "",
        user_agent: params.userAgent || "",
        payload_size_bytes: params.payloadSize || 0,
        response_code: "",
        execution_ms: "",
        success: "",
        created_at: Utils.now()
      });
    } catch (e) {
      // Logger gagal tidak boleh mematikan request utama
      Logger.log("⚠️ RequestLogger.logRequest failed: " + e.toString());
    }
  },

  /**
   * Update request log setelah response selesai (execution time & status).
   * Karena appendRecord sudah dilakukan, kita update baris terakhir.
   *
   * @param {string} requestId
   * @param {number} executionMs
   * @param {boolean} success
   * @param {string} responseCode
   * @param {string} [actorId]
   * @param {string} [actorRole]
   */
  logResponse: function(requestId, executionMs, success, responseCode, actorId, actorRole) {
    try {
      var updates = {
        execution_ms: executionMs,
        success: success,
        response_code: responseCode || ""
      };
      if (actorId) updates.actor_id = actorId;
      if (actorRole) updates.actor_role = actorRole;

      DatabaseManager.updateRecord(
        DB.SHEETS.REQUEST_LOGS,
        "request_id",
        requestId,
        updates
      );
    } catch (e) {
      Logger.log("⚠️ RequestLogger.logResponse failed: " + e.toString());
    }
  },

  /**
   * Log error/exception ke sheet Error_Logs.
   *
   * @param {Object} params
   * @param {string} params.requestId
   * @param {string} params.action
   * @param {string} [params.actorId]
   * @param {string} params.errorCode
   * @param {string} params.errorMessage
   * @param {string} [params.stacktrace]
   * @param {string} [params.payloadSnapshot]  - Truncated payload untuk debugging
   */
  logError: function(params) {
    try {
      DatabaseManager.appendRecord(DB.SHEETS.ERROR_LOGS, {
        id: Utils.generateUUID(),
        request_id: params.requestId || "",
        action: params.action || "UNKNOWN",
        actor_id: params.actorId || "",
        error_code: params.errorCode || "SYS_001",
        error_message: params.errorMessage || "",
        stacktrace: params.stacktrace || "",
        payload_snapshot: params.payloadSnapshot || "",
        created_at: Utils.now()
      });
    } catch (e) {
      Logger.log("⚠️ RequestLogger.logError failed: " + e.toString());
    }
  }
};
