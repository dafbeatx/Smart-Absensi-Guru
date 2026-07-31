/**
 * ============================================================================
 * SMART ABSENSI GURU — MIGRATION ENGINE (MigrationEngine.gs)
 * ============================================================================
 * Sistem migrasi skema database terstruktur.
 * Format nama migrasi: YYYYMMDD_Description (date-based).
 * Idempotent: migrasi yang sudah dijalankan tidak dijalankan ulang.
 * ============================================================================
 */

var MigrationEngine = {

  /**
   * Jalankan semua migrasi yang belum pernah diaplikasikan.
   */
  runPendingMigrations: function() {
    var applied = MigrationEngine._getAppliedMigrations();
    var migrations = MigrationEngine._getAllMigrations();
    var newlyApplied = [];

    for (var i = 0; i < migrations.length; i++) {
      var m = migrations[i];
      if (applied.indexOf(m.id) === -1) {
        Logger.log("🔄 Running migration: " + m.id + " — " + m.description);

        try {
          m.execute();

          // Catat migrasi berhasil
          DatabaseManager.appendRecord(DB.SHEETS.MIGRATIONS, {
            migration_id: m.id,
            description: m.description,
            applied_at: Utils.now()
          });

          newlyApplied.push(m.id);
          Logger.log("✅ Migration applied: " + m.id);
        } catch (e) {
          Logger.log("❌ Migration FAILED: " + m.id + " — " + e.toString());
          throw e; // Stop pada kegagalan — jangan lanjutkan migrasi berikutnya
        }
      }
    }

    if (newlyApplied.length === 0) {
      Logger.log("✅ Semua migrasi sudah teraplikasi. Tidak ada yang baru.");
    }

    return newlyApplied;
  },

  /**
   * Returns array of migration IDs yang sudah diaplikasikan.
   */
  _getAppliedMigrations: function() {
    var records = DatabaseManager.findAll(DB.SHEETS.MIGRATIONS);
    return records.map(function(r) { return r.migration_id; });
  },

  /**
   * Registry seluruh migrasi. Tambahkan migrasi baru di bawah.
   * Urutan HARUS kronologis (paling lama di atas).
   */
  _getAllMigrations: function() {
    return [
      {
        id: "20260730_InitialSchema",
        description: "Initial database schema — auto-created by initializeDatabase()",
        execute: function() {
          // initializeDatabase() sudah menangani pembuatan seluruh sheet.
          // Migrasi ini hanya sebagai penanda bahwa skema awal telah dibuat.
          DatabaseManager.initializeDatabase();
        }
      }

      // ── Tambahkan migrasi baru di bawah ini ──────────────────────────
      // {
      //   id: "20260815_AddNotificationSheet",
      //   description: "Tambahkan sheet Notifications untuk push notif",
      //   execute: function() {
      //     var ss = SpreadsheetApp.getActiveSpreadsheet();
      //     var sheet = ss.insertSheet("Notifications");
      //     sheet.appendRow(["id", "user_id", "type", "message", "is_read", "created_at"]);
      //     sheet.setFrozenRows(1);
      //   }
      // }
    ];
  }
};
