/**
 * ============================================================================
 * SMART ABSENSI GURU — DATABASE MANAGER & ORM-LITE (DatabaseManager.gs)
 * ============================================================================
 * Single Spreadsheet, multi-sheet architecture.
 * Provides: initializeDatabase(), getSheet(), find(), findAll(),
 *           appendRecord(), updateRecord(), executeWithLock().
 * ============================================================================
 */

var DatabaseManager = (function () {

  /**
   * Cache Spreadsheet object agar tidak buka ulang setiap call.
   */
  var _ssCache = null;

  function _getSpreadsheet() {
    if (_ssCache) return _ssCache;

    var id = DB.SPREADSHEET_ID;
    if (!id || id === "REPLACE_WITH_YOUR_SPREADSHEET_ID") {
      // Development fallback: gunakan Active Spreadsheet (bound script)
      _ssCache = SpreadsheetApp.getActiveSpreadsheet();
    } else {
      // Jika user menempelkan full URL, ekstrak ID-nya secara otomatis (defensive programming)
      if (id.indexOf("http") === 0 || id.indexOf("docs.google.com") !== -1) {
        var matches = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (matches && matches[1]) {
          id = matches[1];
        }
      }
      _ssCache = SpreadsheetApp.openById(id);
    }
    return _ssCache;
  }

  // ─── SHEET ACCESS ──────────────────────────────────────────────────────

  /**
   * Opens a specific sheet tab by name.
   * @param {string} sheetName - Nama sheet (dari DB.SHEETS.*)
   * @returns {Sheet|null}
   */
  function getSheet(sheetName) {
    var ss = _getSpreadsheet();
    return ss.getSheetByName(sheetName);
  }

  // ─── DATABASE INITIALIZER ─────────────────────────────────────────────

  /**
   * Auto-create semua sheet + header jika belum ada.
   * Idempotent: aman dijalankan berulang kali.
   */
  function initializeDatabase() {
    var ss = _getSpreadsheet();
    var existingSheets = ss.getSheets().map(function (s) {
      return s.getName();
    });

    var sheetsCreated = [];
    var sheetsSkipped = [];

    // Iterasi seluruh definisi sheet dari Config
    var sheetNames = Object.keys(DB.HEADERS);
    for (var i = 0; i < sheetNames.length; i++) {
      var name = sheetNames[i];
      var headers = DB.HEADERS[name];

      if (existingSheets.indexOf(name) === -1) {
        // Buat sheet baru
        var newSheet = ss.insertSheet(name);
        newSheet.appendRow(headers);

        // Freeze header row & bold
        newSheet.setFrozenRows(1);
        newSheet
          .getRange(1, 1, 1, headers.length)
          .setFontWeight("bold")
          .setBackground("#e8eaed");

        sheetsCreated.push(name);
      } else {
        sheetsSkipped.push(name);
      }
    }

    // Hapus "Sheet1" default jika masih ada dan kita sudah punya sheet lain
    var defaultSheet = ss.getSheetByName("Sheet1");
    if (defaultSheet && ss.getSheets().length > 1) {
      try {
        ss.deleteSheet(defaultSheet);
      } catch (e) {
        // Ignore jika gagal (mungkin sudah dihapus)
      }
    }

    Logger.log("✅ initializeDatabase() selesai.");
    Logger.log("   Sheets dibuat: " + (sheetsCreated.length > 0 ? sheetsCreated.join(", ") : "(tidak ada)"));
    Logger.log("   Sheets dilewati: " + (sheetsSkipped.length > 0 ? sheetsSkipped.join(", ") : "(tidak ada)"));

    return {
      created: sheetsCreated,
      skipped: sheetsSkipped
    };
  }

  // ─── CONCURRENCY LOCK ─────────────────────────────────────────────────

  /**
   * Menjalankan callback di dalam script-level lock (mutex).
   * Timeout 10 detik — cocok untuk 12 guru scan simultan 06:45 WIB.
   * Mendukung re-entrancy agar dipanggil bersarang (nested) tanpa melepas lock prematur.
   *
   * PENTING: Lock acquisition error → SYS_002 "Server sedang sibuk".
   *          Callback error → di-propagate apa adanya (BUKAN diganti SYS_002).
   */
  function executeWithLock(callback) {
    var lock = LockService.getScriptLock();

    // ── Re-entrancy: jika lock sudah dipegang, langsung jalankan callback ──
    var alreadyLocked = false;
    try {
      alreadyLocked = lock.hasLock();
    } catch (ignore) {
      alreadyLocked = false;
    }

    if (alreadyLocked) {
      return callback();
    }

    // ── Acquire lock (hanya error timeout yang jadi SYS_002) ──
    try {
      lock.waitLock(10000);
    } catch (lockErr) {
      throw new Error(ERRORS.SYS_002.message);
    }

    // ── Jalankan callback; error dari callback di-propagate apa adanya ──
    try {
      return callback();
    } finally {
      try {
        lock.releaseLock();
      } catch (releaseErr) {
        // Ignore — lock mungkin sudah dilepas
      }
    }
  }

  // ─── READ OPERATIONS ──────────────────────────────────────────────────

  /**
   * Reads all rows from a sheet as array of objects keyed by header names.
   * @param {string} sheetName
   * @returns {Object[]}
   */
  function findAll(sheetName) {
    var sheet = getSheet(sheetName);
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    var headers = data[0];
    var result = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      // Skip empty rows (id kosong)
      if (!row[0] && row[0] !== 0) continue;
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = row[j];
      }
      result.push(obj);
    }
    return result;
  }

  /**
   * Find a single record by matching a field value.
   * @param {string} sheetName
   * @param {string} fieldName  - Kolom yang dicari
   * @param {*}      value      - Nilai yang dicocokkan
   * @returns {Object|null}
   */
  function findRecord(sheetName, fieldName, value) {
    var all = findAll(sheetName);
    for (var i = 0; i < all.length; i++) {
      if (String(all[i][fieldName]) === String(value)) {
        return all[i];
      }
    }
    return null;
  }

  /**
   * Find all records matching a field value.
   * @param {string} sheetName
   * @param {string} fieldName
   * @param {*}      value
   * @returns {Object[]}
   */
  function findRecords(sheetName, fieldName, value) {
    var all = findAll(sheetName);
    var results = [];
    for (var i = 0; i < all.length; i++) {
      if (String(all[i][fieldName]) === String(value)) {
        results.push(all[i]);
      }
    }
    return results;
  }

  // ─── WRITE OPERATIONS ─────────────────────────────────────────────────

  /**
   * Appends a new record to a sheet. Columns are matched by header names.
   * Wrapped in LockService for concurrency safety.
   * @param {string} sheetName
   * @param {Object} recordObj
   * @returns {boolean}
   */
  function appendRecord(sheetName, recordObj) {
    return executeWithLock(function () {
      var sheet = getSheet(sheetName);
      if (!sheet) throw new Error("Sheet '" + sheetName + "' tidak ditemukan.");

      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var row = [];
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i];
        row.push(recordObj[h] !== undefined ? recordObj[h] : "");
      }
      sheet.appendRow(row);
      return true;
    });
  }

  /**
   * Updates an existing record. Finds first row where fieldName === fieldValue,
   * then merges `updates` into that row.
   * @param {string} sheetName
   * @param {string} fieldName   - Kolom pencarian (biasanya "id")
   * @param {*}      fieldValue  - Nilai pencarian
   * @param {Object} updates     - Key-value pairs yang diupdate
   * @returns {boolean}
   */
  function updateRecord(sheetName, fieldName, fieldValue, updates) {
    return executeWithLock(function () {
      var sheet = getSheet(sheetName);
      if (!sheet) throw new Error("Sheet '" + sheetName + "' tidak ditemukan.");

      var data = sheet.getDataRange().getValues();
      if (data.length < 2) return false;

      var headers = data[0];
      var fieldIndex = headers.indexOf(fieldName);
      if (fieldIndex === -1) return false;

      for (var i = 1; i < data.length; i++) {
        if (String(data[i][fieldIndex]) === String(fieldValue)) {
          // Found — apply updates
          var updateKeys = Object.keys(updates);
          for (var u = 0; u < updateKeys.length; u++) {
            var colIndex = headers.indexOf(updateKeys[u]);
            if (colIndex !== -1) {
              // Sheet rows are 1-indexed, and data[0] is header, so row = i+1
              sheet.getRange(i + 1, colIndex + 1).setValue(updates[updateKeys[u]]);
            }
          }
          return true;
        }
      }
      return false; // Record not found
    });
  }

  // ─── PUBLIC API ────────────────────────────────────────────────────────

  return {
    initializeDatabase: initializeDatabase,
    getSheet: getSheet,
    executeWithLock: executeWithLock,
    findAll: findAll,
    findRecord: findRecord,
    findRecords: findRecords,
    appendRecord: appendRecord,
    updateRecord: updateRecord
  };
})();
