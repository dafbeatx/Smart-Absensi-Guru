/**
 * ============================================================================
 * SMART ABSENSI GURU — SETTINGS SERVICE (SettingsService.gs)
 * ============================================================================
 * Mengelola pembacaan dan pembaruan pengaturan sistem, jam kerja, & geofence.
 * ============================================================================
 */

var SettingsService = {

  /**
   * Mengambil semua pengaturan sistem
   */
  getSettings: function(requestId) {
    var records = DatabaseManager.findAll(DB.SHEETS.SYSTEM_SETTINGS);
    var settingsMap = {};
    for (var i = 0; i < records.length; i++) {
      settingsMap[records[i].key] = records[i].value;
    }
    return Utils.successResponse("SETTINGS_FETCH_OK", "Pengaturan sistem berhasil dimuat", settingsMap, requestId);
  },

  /**
   * Memperbarui pengaturan jam kerja, geofence, dan identitas sekolah secara permanen
   */
  updateSettings: function(payload, currentUser, requestId) {
    return DatabaseManager.executeWithLock(function() {
      var settingsData = payload.settings || payload;
      var actorId = (currentUser && (currentUser.sub || currentUser.id)) ? (currentUser.sub || currentUser.id) : "ADMIN";

      // Flatten payload jika dikirim dengan camelCase dari frontend
      var settingsToUpdate = {
        app_name: settingsData.app_name || settingsData.appName,
        institution_name: settingsData.institution_name || settingsData.institution,
        work_checkin_start: settingsData.work_checkin_start || settingsData.checkInStart,
        work_checkin_end: settingsData.work_checkin_end || settingsData.checkInEnd,
        work_checkout_start: settingsData.work_checkout_start || settingsData.checkOutStart,
        geofence_lat: settingsData.geofence_lat !== undefined ? String(settingsData.geofence_lat) : settingsData.geofenceLat,
        geofence_lng: settingsData.geofence_lng !== undefined ? String(settingsData.geofence_lng) : settingsData.geofenceLng,
        geofence_radius: settingsData.geofence_radius !== undefined ? String(settingsData.geofence_radius) : settingsData.geofenceRadius
      };

      var keys = Object.keys(settingsToUpdate);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var val = settingsToUpdate[key];
        if (val !== undefined && val !== null) {
          var existing = DatabaseManager.findRecord(DB.SHEETS.SYSTEM_SETTINGS, "key", key);
          if (existing) {
            DatabaseManager.updateRecord(DB.SHEETS.SYSTEM_SETTINGS, "key", key, {
              value: String(val),
              updated_at: Utils.now(),
              updated_by: actorId
            });
          } else {
            DatabaseManager.appendRecord(DB.SHEETS.SYSTEM_SETTINGS, {
              key: key,
              value: String(val),
              description: key,
              updated_at: Utils.now(),
              updated_by: actorId
            });
          }
        }
      }

      // Proactive Cache Invalidation untuk dashboard
      try {
        var cache = CacheService.getScriptCache();
        cache.remove("dashboard:kepsek");
        cache.remove("dashboard:admin");
      } catch (e) {
        Logger.log("Cache invalidation warning: " + e.toString());
      }

      return Utils.successResponse(
        "SETTINGS_UPDATE_OK",
        "Pengaturan jam kerja & geofence berhasil disimpan permanen ke Spreadsheet.",
        settingsToUpdate,
        requestId
      );
    });
  }
};
