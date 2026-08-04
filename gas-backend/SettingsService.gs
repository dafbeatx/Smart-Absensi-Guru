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
        friday_checkout_start: settingsData.friday_checkout_start || settingsData.fridayCheckoutStart || "11:00",
        saturday_is_holiday: settingsData.saturday_is_holiday !== undefined ? String(settingsData.saturday_is_holiday) : "true",
        sunday_is_holiday: settingsData.sunday_is_holiday !== undefined ? String(settingsData.sunday_is_holiday) : "true",
        geofence_lat: settingsData.geofence_lat !== undefined ? String(settingsData.geofence_lat) : settingsData.geofenceLat,
        geofence_lng: settingsData.geofence_lng !== undefined ? String(settingsData.geofence_lng) : settingsData.geofenceLng,
        geofence_radius: settingsData.geofence_radius !== undefined ? String(settingsData.geofence_radius) : settingsData.geofenceRadius
      };

      var sheet = DatabaseManager.getSheet(DB.SHEETS.SYSTEM_SETTINGS);
      if (!sheet) throw new Error("Sheet '" + DB.SHEETS.SYSTEM_SETTINGS + "' tidak ditemukan.");

      var data = sheet.getDataRange().getValues();
      var headers = DB.HEADERS.System_Settings;

      // Jika sheet belum memiliki data sama sekali
      if (!data || data.length === 0 || (data.length === 1 && !data[0][0])) {
        data = [headers];
      }

      var currentHeaders = data[0];
      var keyCol = currentHeaders.indexOf("key");
      var valCol = currentHeaders.indexOf("value");
      var descCol = currentHeaders.indexOf("description");
      var updatedAtCol = currentHeaders.indexOf("updated_at");
      var updatedByCol = currentHeaders.indexOf("updated_by");

      if (keyCol === -1 || valCol === -1) {
        data[0] = headers;
        keyCol = 0;
        valCol = 1;
        descCol = 2;
        updatedAtCol = 3;
        updatedByCol = 4;
      }

      var nowStr = Utils.now();
      var keys = Object.keys(settingsToUpdate);

      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = settingsToUpdate[k];
        if (v === undefined || v === null) continue;
        var valStr = String(v);

        var foundRowIndex = -1;
        for (var r = 1; r < data.length; r++) {
          if (String(data[r][keyCol]) === String(k)) {
            foundRowIndex = r;
            break;
          }
        }

        if (foundRowIndex !== -1) {
          data[foundRowIndex][valCol] = valStr;
          if (updatedAtCol !== -1) data[foundRowIndex][updatedAtCol] = nowStr;
          if (updatedByCol !== -1) data[foundRowIndex][updatedByCol] = actorId;
        } else {
          var newRow = new Array(headers.length);
          for (var col = 0; col < headers.length; col++) newRow[col] = "";
          newRow[keyCol] = k;
          newRow[valCol] = valStr;
          if (descCol !== -1) newRow[descCol] = k;
          if (updatedAtCol !== -1) newRow[updatedAtCol] = nowStr;
          if (updatedByCol !== -1) newRow[updatedByCol] = actorId;
          data.push(newRow);
        }
      }

      // Single Batch Write seluruh data ke Spreadsheet dalam 1 kali API call!
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);

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
