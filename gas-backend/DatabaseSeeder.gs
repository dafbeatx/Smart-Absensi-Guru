/**
 * ============================================================================
 * SMART ABSENSI GURU — DATABASE SEEDER (DatabaseSeeder.gs)
 * ============================================================================
 * Seed data awal: 5 akun (1 Admin, 1 Kepsek, 3 Guru) + System Settings.
 * PIN default untuk semua akun seeder: 123456
 * Jalankan 1x setelah initializeDatabase().
 * ============================================================================
 */

var DatabaseSeeder = {

  /**
   * Entry point: seed semua data default.
   * Idempotent — cek apakah Admin sudah ada sebelum insert.
   */
  seedDefaultData: function() {
    var existingAdmin = DatabaseManager.findRecord(
      DB.SHEETS.USERS, "role", ROLES.ADMIN
    );

    if (existingAdmin) {
      // Update existing admin account to phone 0895351251395 and PIN 030501
      var newPinHash = Security.hashPIN("030501", "0895351251395");
      DatabaseManager.updateRecord(DB.SHEETS.USERS, "role", ROLES.ADMIN, {
        phone_number: "0895351251395",
        pin_hash: newPinHash,
        failed_login_count: 0,
        account_status: ACCOUNT_STATUS.ACTIVE,
        locked_until: "",
        updated_at: Utils.now()
      });
      Logger.log("✅ Admin account updated to 0895351251395 & PIN 030501.");
      return { seeded: true, updated: true };
    }

    DatabaseSeeder._seedUsers();
    DatabaseSeeder._seedSystemSettings();

    Logger.log("✅ seedDefaultData() selesai. 5 akun + settings berhasil dibuat.");
    return { seeded: true };
  },

  /**
   * Seed 5 akun pengguna default.
   */
  _seedUsers: function() {
    var now = Utils.now();

    var users = [
      {
        id: "usr_admin_001",
        nip: "199501012020011001",
        full_name: "Rina Fitriani, S.Kom.",
        phone_number: "0895351251395",
        pin: "030501",
        role: ROLES.ADMIN,
        position: "Admin Website & IT Sekolah",
        account_status: ACCOUNT_STATUS.ACTIVE
      },
      {
        id: "usr_kepsek_001",
        nip: "197504122003121001",
        full_name: "Drs. H. M. Yusuf, M.Pd.",
        phone_number: "081200002222",
        role: ROLES.KEPSEK,
        position: "Kepala Sekolah",
        account_status: ACCOUNT_STATUS.ACTIVE
      },
      {
        id: "usr_guru_001",
        nip: "198507122010011008",
        full_name: "Ahmad Hidayat, S.Pd.",
        phone_number: "081234567890",
        role: ROLES.GURU,
        position: "Guru Matematika",
        account_status: ACCOUNT_STATUS.ACTIVE
      },
      {
        id: "usr_guru_002",
        nip: "199002142018021002",
        full_name: "Budi Santoso, M.Pd.",
        phone_number: "081398765432",
        role: ROLES.GURU,
        position: "Guru Fisika",
        account_status: ACCOUNT_STATUS.ACTIVE
      },
      {
        id: "usr_guru_003",
        nip: "199203082019032004",
        full_name: "Siti Nurhaliza, S.Pd.",
        phone_number: "081356789012",
        role: ROLES.GURU,
        position: "Guru Bahasa Indonesia",
        account_status: ACCOUNT_STATUS.ACTIVE
      }
    ];

    for (var i = 0; i < users.length; i++) {
      var u = users[i];

      var userPin = u.pin || SECURITY.DEFAULT_PIN;
      var pinHash = Security.hashPIN(userPin, u.phone_number);

      DatabaseManager.appendRecord(DB.SHEETS.USERS, {
        id: u.id,
        nip: u.nip,
        full_name: u.full_name,
        phone_number: u.phone_number,
        pin_hash: pinHash,
        role: u.role,
        position: u.position,
        avatar_url: "",
        account_status: u.account_status,
        failed_login_count: 0,
        locked_until: "",
        created_at: now,
        updated_at: now,
        deleted_at: ""
      });

      Logger.log("   👤 Seeded: " + u.full_name + " (" + u.role + ")");
    }
  },

  /**
   * Seed system settings default.
   */
  _seedSystemSettings: function() {
    var now = Utils.now();

    var settings = [
      { key: "app_name", value: APP.NAME, description: "Nama utama aplikasi" },
      { key: "institution_name", value: APP.INSTITUTION, description: "Identitas sekolah" },
      { key: "app_version", value: APP.VERSION, description: "Versi aplikasi" },
      { key: "work_checkin_start", value: SHIFT.WORK_CHECKIN_START, description: "Jam mulai absen masuk" },
      { key: "work_checkin_end", value: SHIFT.WORK_CHECKIN_END, description: "Batas tepat waktu masuk" },
      { key: "work_checkout_start", value: SHIFT.WORK_CHECKOUT_START, description: "Jam buka pulang" },
      { key: "geofence_lat", value: String(SHIFT.GEOFENCE_LAT), description: "Latitude GPS sekolah" },
      { key: "geofence_lng", value: String(SHIFT.GEOFENCE_LNG), description: "Longitude GPS sekolah" },
      { key: "geofence_radius", value: String(SHIFT.GEOFENCE_RADIUS_METERS), description: "Radius izin GPS (meter)" },
      { key: "maintenance_mode", value: "false", description: "Mode pemeliharaan (true = aktif)" },
      { key: "enable_qr", value: "true", description: "Feature flag: QR Scanner" },
      { key: "enable_report", value: "true", description: "Feature flag: Export Laporan" },
      { key: "enable_notification", value: "true", description: "Feature flag: Notifikasi WA" }
    ];

    for (var i = 0; i < settings.length; i++) {
      var s = settings[i];
      DatabaseManager.appendRecord(DB.SHEETS.SYSTEM_SETTINGS, {
        key: s.key,
        value: s.value,
        description: s.description,
        updated_at: now,
        updated_by: "SYSTEM_SEEDER"
      });
    }

    Logger.log("   ⚙️ Seeded: " + settings.length + " system settings.");
  }
};

// ─── CONVENIENCE ENTRY POINT ─────────────────────────────────────────────────
// Jalankan fungsi ini 1x dari Google Apps Script Editor untuk setup awal.

function setupDatabase() {
  Logger.log("═══════════════════════════════════════════════════════");
  Logger.log("  SMART ABSENSI GURU — DATABASE SETUP");
  Logger.log("═══════════════════════════════════════════════════════");

  // Step 1: Buat semua sheet + header
  var dbResult = DatabaseManager.initializeDatabase();
  Logger.log("📊 Sheets created: " + dbResult.created.length);

  // Step 2: Jalankan migrasi
  var migrations = MigrationEngine.runPendingMigrations();
  Logger.log("🔄 Migrations applied: " + migrations.length);

  // Step 3: Seed data default
  var seedResult = DatabaseSeeder.seedDefaultData();
  Logger.log("🌱 Seeded: " + JSON.stringify(seedResult));

  Logger.log("═══════════════════════════════════════════════════════");
  Logger.log("  ✅ SETUP SELESAI — Database siap digunakan!");
  Logger.log("═══════════════════════════════════════════════════════");
}
