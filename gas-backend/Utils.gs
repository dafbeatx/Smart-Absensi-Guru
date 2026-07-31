/**
 * ============================================================================
 * SMART ABSENSI GURU — UTILITIES & HELPERS (Utils.gs)
 * ============================================================================
 * Standard API response format, UUID generator, date/time formatters,
 * Haversine GPS distance calculator.
 * ============================================================================
 */

var Utils = {

  // ─── STANDARD API RESPONSE ───────────────────────────────────────────────

  /**
   * Creates a success JSON response.
   * @param {string} code     - Error/success code from ERRORS registry
   * @param {string} message  - Human-readable message
   * @param {Object} data     - Payload data object
   * @param {string} requestId - Request tracking ID
   * @returns {TextOutput}
   */
  successResponse: function(code, message, data, requestId) {
    return Utils._buildResponse(true, code, message, data, requestId);
  },

  /**
   * Creates an error JSON response.
   * @param {string} code      - Error code from ERRORS registry
   * @param {string} message   - Human-readable error message
   * @param {Object} [data]    - Optional additional error context
   * @param {string} requestId - Request tracking ID
   * @returns {TextOutput}
   */
  errorResponse: function(code, message, data, requestId) {
    return Utils._buildResponse(false, code, message, data || null, requestId);
  },

  /**
   * Internal response builder. All responses follow this exact shape:
   * {
   *   "success": true/false,
   *   "code": "AUTH_001",
   *   "message": "Login berhasil",
   *   "data": {},
   *   "requestId": "req_a8f3b21c",
   *   "timestamp": "2026-07-30T12:00:00.000Z"
   * }
   */
  _buildResponse: function(success, code, message, data, requestId) {
    var body = {
      success: success,
      code: code || "",
      message: message || "",
      data: data || null,
      requestId: requestId || "",
      timestamp: new Date().toISOString()
    };
    var output = ContentService.createTextOutput(JSON.stringify(body));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  },

  // ─── REQUEST ID GENERATOR ────────────────────────────────────────────────

  /**
   * Generates a prefixed request ID for tracking: "req_xxxxxxxx"
   */
  generateRequestId: function() {
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var id = "req_";
    for (var i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  },

  // ─── UUID GENERATOR ──────────────────────────────────────────────────────

  /**
   * Generates a UUID v4 string.
   */
  generateUUID: function() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  // ─── DATE / TIME FORMATTERS ──────────────────────────────────────────────

  /**
   * Format Date to YYYY-MM-DD
   */
  formatDate: function(dateObj) {
    var d = new Date(dateObj);
    var month = "" + (d.getMonth() + 1);
    var day = "" + d.getDate();
    var year = d.getFullYear();
    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;
    return [year, month, day].join("-");
  },

  /**
   * Format Date to HH:mm:ss
   */
  formatTime: function(dateObj) {
    var d = new Date(dateObj);
    var h = "" + d.getHours();
    var m = "" + d.getMinutes();
    var s = "" + d.getSeconds();
    if (h.length < 2) h = "0" + h;
    if (m.length < 2) m = "0" + m;
    if (s.length < 2) s = "0" + s;
    return [h, m, s].join(":");
  },

  /**
   * Format Date to HH:mm (tanpa detik, untuk tampilan UI)
   */
  formatTimeShort: function(dateObj) {
    var d = new Date(dateObj);
    var h = "" + d.getHours();
    var m = "" + d.getMinutes();
    if (h.length < 2) h = "0" + h;
    if (m.length < 2) m = "0" + m;
    return h + ":" + m;
  },

  /**
   * Calculate minutes between two HH:mm time strings.
   * Returns negative if timeA is after timeB.
   */
  minutesBetween: function(timeA, timeB) {
    var partsA = timeA.split(":");
    var partsB = timeB.split(":");
    var minsA = parseInt(partsA[0], 10) * 60 + parseInt(partsA[1], 10);
    var minsB = parseInt(partsB[0], 10) * 60 + parseInt(partsB[1], 10);
    return minsB - minsA;
  },

  // ─── GPS HAVERSINE ────────────────────────────────────────────────────────

  /**
   * Haversine formula: distance in meters between two GPS coordinates.
   */
  calculateDistanceMeters: function(lat1, lon1, lat2, lon2) {
    var R = 6371000;
    var dLat = Utils._deg2rad(lat2 - lat1);
    var dLon = Utils._deg2rad(lon2 - lon1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(Utils._deg2rad(lat1)) *
        Math.cos(Utils._deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  },

  _deg2rad: function(deg) {
    return deg * (Math.PI / 180);
  },

  // ─── MISC HELPERS ─────────────────────────────────────────────────────────

  /**
   * Safe JSON parse with fallback.
   */
  safeParseJSON: function(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  },

  /**
   * Returns current ISO timestamp string.
   */
  now: function() {
    return new Date().toISOString();
  }
};
