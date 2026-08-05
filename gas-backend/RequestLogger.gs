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
      Logger.log("📥 [Request] " + (params.action || "UNKNOWN") + " | RequestID: " + (params.requestId || ""));
    } catch (e) {
      // Logger gagal tidak boleh mematikan request utama
    }
  },

  /**
   * Log execution summary ke Apps Script transcript tanpa overhead Google Sheet.
   */
  logResponse: function(requestId, executionMs, success, responseCode, actorId, actorRole) {
    try {
      Logger.log("📤 [Response] RequestID: " + requestId + " | Time: " + executionMs + "ms | Success: " + success + " | Code: " + (responseCode || "200"));
    } catch (e) {
      // Logger gagal tidak boleh mematikan request utama
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
