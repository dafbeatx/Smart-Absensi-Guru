/**
 * ============================================================================
 * SMART ABSENSI GURU — DASHBOARD ORCHESTRATION & CACHE (DashboardService.gs)
 * ============================================================================
 * Orchestration Layer untuk Dashboard Guru, Kepala Sekolah, dan Admin.
 * Mengimplementasikan Google Apps Script CacheService dengan format terstruktur
 * dan proactive cache invalidation.
 * ============================================================================
 */

var DashboardService = {

  VERSION: "1.0",

  // ═══════════════════════════════════════════════════════════════════════════
  // GET GURU DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  getGuruDashboard: function(currentUser, payload, requestId) {
    var userId = currentUser.sub || currentUser.id;
    var cacheKey = "dashboard:guru:" + userId;
    var monthStr = payload.month || Utils.formatDate(new Date()).substring(0, 7);

    return DashboardService._getOrUpdateDashboard(cacheKey, requestId, function() {
      var context = DashboardService._buildAnalyticsContext();
      return AnalyticsService.getGuruStats(context, userId, monthStr);
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GET KEPSEK DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  getKepsekDashboard: function(currentUser, payload, requestId) {
    var cacheKey = "dashboard:kepsek";

    return DashboardService._getOrUpdateDashboard(cacheKey, requestId, function() {
      var context = DashboardService._buildAnalyticsContext();
      return AnalyticsService.getKepsekStats(context);
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GET ADMIN DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  getAdminDashboard: function(currentUser, payload, requestId) {
    var cacheKey = "dashboard:admin";

    return DashboardService._getOrUpdateDashboard(cacheKey, requestId, function() {
      var context = DashboardService._buildAnalyticsContext();
      return AnalyticsService.getAdminStats(context);
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROACTIVE CACHE INVALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  invalidateAttendance: function(userId) {
    DashboardService._clearDashboardCaches(userId);
    Logger.log("🧹 Cache invalidated due to Attendance change for user: " + userId);
  },

  invalidateLeave: function(userId) {
    DashboardService._clearDashboardCaches(userId);
    Logger.log("🧹 Cache invalidated due to Leave change for user: " + userId);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE CACHE & CONTEXT HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Mengambil data dari cache atau menghitung ulang melalui callback jika miss.
   */
  _getOrUpdateDashboard: function(cacheKey, requestId, generateCallback) {
    var cache = CacheService.getScriptCache();
    var cachedDataStr = cache.get(cacheKey);

    if (cachedDataStr) {
      var cachedObj = Utils.safeParseJSON(cachedDataStr);
      if (cachedObj && cachedObj.version === DashboardService.VERSION) {
        var cacheAgeSeconds = Math.round((Date.now() - new Date(cachedObj.cachedAt).getTime()) / 1000);
        
        // Tandai di logger sebagai CACHE_HIT
        _updateRequestLogCacheStatus(requestId, "CACHE_HIT");

        return Utils.successResponse("DASH_CACHE", "Dashboard loaded from cache.", {
          meta: {
            cached: true,
            cacheAge: cacheAgeSeconds,
            generatedAt: cachedObj.cachedAt,
            version: DashboardService.VERSION
          },
          data: cachedObj.payload
        }, requestId);
      }
    }

    // CACHE_MISS — Lakukan hitung ulang
    _updateRequestLogCacheStatus(requestId, "CACHE_MISS");

    var payloadData = generateCallback();
    var newCacheObj = {
      version: DashboardService.VERSION,
      cachedAt: new Date().toISOString(),
      payload: payloadData
    };

    // Simpan ke cache dengan TTL (default 60 detik)
    try {
      cache.put(cacheKey, JSON.stringify(newCacheObj), DASHBOARD.CACHE_TTL_SECONDS);
    } catch (e) {
      Logger.log("⚠️ Gagal menyimpan cache dashboard: " + e.toString());
    }

    return Utils.successResponse("DASH_LIVE", "Dashboard generated live.", {
      meta: {
        cached: false,
        cacheAge: 0,
        generatedAt: newCacheObj.cachedAt,
        version: DashboardService.VERSION
      },
      data: payloadData
    }, requestId);
  },

  /**
   * Menghapus cache dashboard milik guru tertentu, kepsek, dan admin.
   */
  _clearDashboardCaches: function(userId) {
    var cache = CacheService.getScriptCache();
    var keys = ["dashboard:kepsek", "dashboard:admin"];
    if (userId) {
      keys.push("dashboard:guru:" + userId);
    }
    try {
      cache.removeAll(keys);
    } catch (e) {
      Logger.log("⚠️ Gagal menghapus cache dashboard: " + e.toString());
    }
  },

  /**
   * Membangun context database yang dimuat sekali saja ke memori.
   */
  _buildAnalyticsContext: function() {
    return {
      users: DatabaseManager.findAll(DB.SHEETS.USERS),
      attendance: DatabaseManager.findAll(DB.SHEETS.ATTENDANCE),
      leaves: DatabaseManager.findAll(DB.SHEETS.LEAVE_REQUESTS),
      settings: DatabaseManager.findAll(DB.SHEETS.SYSTEM_SETTINGS),
      auditLogs: DatabaseManager.findAll(DB.SHEETS.AUDIT_LOGS),
      requestLogs: DatabaseManager.findAll(DB.SHEETS.REQUEST_LOGS)
    };
  }
};

// ─── INTERNAL HELPER UNTUK LOG ───────────────────────────────────────────────

function _updateRequestLogCacheStatus(requestId, status) {
  try {
    DatabaseManager.updateRecord(
      DB.SHEETS.REQUEST_LOGS,
      "request_id",
      requestId,
      { response_code: status }
    );
  } catch (e) {
    // Abaikan jika logger request belum siap
  }
}
