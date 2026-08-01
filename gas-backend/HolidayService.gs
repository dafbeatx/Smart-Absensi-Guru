/**
 * ============================================================================
 * SMART ABSENSI GURU — HOLIDAY & ACADEMIC CALENDAR SERVICE (HolidayService.gs)
 * ============================================================================
 * Mengelola kalender akademik, hari libur nasional, libur sekolah, dan cuti bersama.
 * Pengaturan ini berlaku global untuk seluruh guru & staf.
 * ============================================================================
 */

var HolidayService = {

  /**
   * Mengambil seluruh daftar hari libur / kalender akademik.
   */
  getHolidays: function(requestId) {
    var records = DatabaseManager.findAll(DB.SHEETS.HOLIDAYS);
    // Sort berdasarkan tanggal ascending
    records.sort(function(a, b) {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return 0;
    });
    return Utils.successResponse("HOLIDAYS_FETCH_OK", "Kalender akademik berhasil dimuat.", records, requestId);
  },

  /**
   * Menambah tanggal libur / agenda akademik baru.
   */
  createHoliday: function(payload, currentUser, requestId) {
    return DatabaseManager.executeWithLock(function() {
      var actorId = (currentUser && (currentUser.sub || currentUser.id)) ? (currentUser.sub || currentUser.id) : "ADMIN";
      var dateStr = payload.date; // YYYY-MM-DD
      var name = payload.name || "Hari Libur";
      var type = payload.type || "NATIONAL_HOLIDAY"; // NATIONAL_HOLIDAY | SCHOOL_HOLIDAY | CUTI_BERSAMA | OTHER
      var description = payload.description || "";

      if (!dateStr || !name) {
        return Utils.errorResponse(ERRORS.SYS_005.code, "Tanggal dan Nama Libur wajib diisi.", null, requestId);
      }

      // Cek apakah tanggal sudah terdaftar
      var existing = DatabaseManager.findRecord(DB.SHEETS.HOLIDAYS, "date", dateStr);
      if (existing) {
        return Utils.errorResponse("HOLIDAY_EXISTS", "Tanggal " + dateStr + " sudah terdaftar sebagai hari libur (" + existing.name + ").", null, requestId);
      }

      var id = "hol_" + Utils.generateUUID().substring(0, 8);
      var now = Utils.now();

      var newRecord = {
        id: id,
        date: dateStr,
        name: name,
        type: type,
        description: description,
        created_at: now
      };

      DatabaseManager.appendRecord(DB.SHEETS.HOLIDAYS, newRecord);

      // Audit Log
      DatabaseManager.appendRecord(DB.SHEETS.AUDIT_LOGS, {
        id: Utils.generateUUID(),
        request_id: requestId,
        actor_id: actorId,
        actor_role: currentUser ? currentUser.role : ROLES.ADMIN,
        action_type: "CREATE_HOLIDAY",
        target_entity: "Holidays",
        before_value: "",
        after_value: JSON.stringify(newRecord),
        change_reason: "Menambah hari libur: " + name + " (" + dateStr + ")",
        ip_address: "",
        user_agent: "",
        request_method: "POST",
        execution_ms: "",
        stacktrace: "",
        created_at: now
      });

      return Utils.successResponse("HOLIDAY_CREATE_OK", "Hari libur berhasil ditambahkan ke kalender akademik.", newRecord, requestId);
    });
  },

  /**
   * Memperbarui informasi hari libur.
   */
  updateHoliday: function(payload, currentUser, requestId) {
    return DatabaseManager.executeWithLock(function() {
      var id = payload.id;
      if (!id) {
        return Utils.errorResponse(ERRORS.SYS_005.code, "ID hari libur wajib diisi.", null, requestId);
      }

      var existing = DatabaseManager.findRecord(DB.SHEETS.HOLIDAYS, "id", id);
      if (!existing) {
        return Utils.errorResponse("HOLIDAY_NOT_FOUND", "Data hari libur tidak ditemukan.", null, requestId);
      }

      var updates = {};
      if (payload.date !== undefined) updates.date = payload.date;
      if (payload.name !== undefined) updates.name = payload.name;
      if (payload.type !== undefined) updates.type = payload.type;
      if (payload.description !== undefined) updates.description = payload.description;

      DatabaseManager.updateRecord(DB.SHEETS.HOLIDAYS, "id", id, updates);

      return Utils.successResponse("HOLIDAY_UPDATE_OK", "Hari libur berhasil diperbarui.", updates, requestId);
    });
  },

  /**
   * Menghapus hari libur dari kalender akademik.
   */
  deleteHoliday: function(payload, currentUser, requestId) {
    return DatabaseManager.executeWithLock(function() {
      var id = payload.id;
      if (!id) {
        return Utils.errorResponse(ERRORS.SYS_005.code, "ID hari libur wajib diisi.", null, requestId);
      }

      var existing = DatabaseManager.findRecord(DB.SHEETS.HOLIDAYS, "id", id);
      if (!existing) {
        return Utils.errorResponse("HOLIDAY_NOT_FOUND", "Data hari libur tidak ditemukan.", null, requestId);
      }

      DatabaseManager.deleteRecord(DB.SHEETS.HOLIDAYS, "id", id);

      return Utils.successResponse("HOLIDAY_DELETE_OK", "Hari libur berhasil dihapus dari kalender akademik.", { id: id }, requestId);
    });
  },

  /**
   * Helper internal: Mengecek apakah suatu tanggal (YYYY-MM-DD) merupakan hari libur.
   */
  isHolidayDate: function(dateStr) {
    var rec = DatabaseManager.findRecord(DB.SHEETS.HOLIDAYS, "date", dateStr);
    return rec ? rec : null;
  }
};
