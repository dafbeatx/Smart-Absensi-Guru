/**
 * ============================================================================
 * SMART ABSENSI GURU — BACKEND CONFIGURATION (Config.gs)
 * ============================================================================
 * Institusi : SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam
 * Version   : 1.0.0-RC1
 * Purpose   : Single source of truth untuk seluruh konstanta backend.
 *             TIDAK BOLEH ada function di file ini.
 * ============================================================================
 */

// ─── APPLICATION ─────────────────────────────────────────────────────────────

var APP = {
  NAME: "Smart Absensi Guru",
  INSTITUTION: "SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam",
  VERSION: "1.0.0-RC1",
  ENVIRONMENT: "development" // "development" | "production"
};

// ─── DATABASE ────────────────────────────────────────────────────────────────
// 1 Spreadsheet, multi-sheet. Semua data dalam 1 file untuk kemudahan
// backup, restore, dan portabilitas (12 guru, 1 sekolah).

var DB = {
  // Ganti dengan Spreadsheet ID sesungguhnya setelah deployment
  SPREADSHEET_ID: "REPLACE_WITH_YOUR_SPREADSHEET_ID",

  // Sheet names — sumber kebenaran tunggal untuk seluruh DatabaseManager
  SHEETS: {
    USERS:           "Users",
    DEVICE_BINDING:  "Device_Binding",
    SESSIONS:        "Sessions",
    SYSTEM_SETTINGS: "System_Settings",
    HOLIDAYS:        "Holidays",
    ATTENDANCE:      "Attendance",
    LEAVE_REQUESTS:  "Leave_Requests",
    AUDIT_LOGS:      "Audit_Logs",
    REQUEST_LOGS:    "Request_Logs",
    ERROR_LOGS:      "Error_Logs",
    MIGRATIONS:      "Migrations"
  },

  // Header kolom untuk setiap sheet — initializeDatabase() mengacu ke sini
  HEADERS: {
    Users: [
      "id", "nip", "full_name", "phone_number", "pin_hash",
      "role", "position", "avatar_url",
      "account_status", "failed_login_count", "locked_until", "must_change_pin",
      "created_at", "updated_at", "deleted_at"
    ],
    Device_Binding: [
      "id", "user_id", "device_uuid", "device_model",
      "browser", "os", "user_agent",
      "last_ip", "last_login",
      "bound_at", "last_active_at"
    ],
    Sessions: [
      "id", "user_id", "token_hash", "refresh_token_hash",
      "device_uuid", "ip_address", "user_agent",
      "last_activity_at", "created_at", "expires_at", "is_active"
    ],
    System_Settings: [
      "key", "value", "description", "updated_at", "updated_by"
    ],
    Holidays: [
      "id", "date", "name", "type", "created_at"
    ],
    Attendance: [
      "id", "user_id", "date",
      "check_in_time", "check_out_time",
      "status", "late_minutes", "working_duration",
      "check_in_lat", "check_in_lng", "check_in_distance_meters",
      "verification_method", "verification_level", "verified_by",
      "attendance_source", "is_offline",
      "created_at"
    ],
    Leave_Requests: [
      "id", "user_id", "leave_type",
      "start_date", "end_date", "reason", "attachment_url",
      "approval_status", "approved_by", "approval_notes",
      "approved_at", "rejected_at", "approval_deadline",
      "created_at", "updated_at"
    ],
    Audit_Logs: [
      "id", "request_id", "actor_id", "actor_role",
      "action_type", "target_entity",
      "before_value", "after_value", "change_reason",
      "ip_address", "user_agent",
      "request_method", "execution_ms", "stacktrace",
      "created_at"
    ],
    Request_Logs: [
      "id", "request_id", "action", "method",
      "actor_id", "actor_role",
      "ip_address", "user_agent",
      "payload_size_bytes", "response_code",
      "execution_ms", "success",
      "created_at"
    ],
    Error_Logs: [
      "id", "request_id", "action",
      "actor_id", "error_code", "error_message",
      "stacktrace", "payload_snapshot",
      "created_at"
    ],
    Migrations: [
      "migration_id", "description", "applied_at"
    ]
  }
};

// ─── SECURITY ────────────────────────────────────────────────────────────────

var SECURITY = {
  JWT_SECRET: "SMART_ABSENSI_GURU_SECRET_KEY_PROD_2026_HMAC_SHA256",
  JWT_EXPIRATION_HOURS: 24 * 7,      // 7 hari
  QR_SECRET: "QR_TOTP_SEED_AL_ITTIHADIYAH_2026",
  QR_WINDOW_SECONDS: 30,              // Masa berlaku QR payload
  HMAC_SALT: "SALT_AL_ITTIHADIYAH_AS_SALAAM_2026",
  MAX_LOGIN_ATTEMPTS: 5,              // Maks PIN salah sebelum lock
  LOCKOUT_MINUTES: 10,                // Durasi lock akun (menit)
  DEFAULT_PIN: "123456"               // PIN default untuk seeder saja
};

// ─── SHIFT & GEOFENCE ───────────────────────────────────────────────────────

var SHIFT = {
  WORK_CHECKIN_START: "06:00",
  WORK_CHECKIN_END: "07:15",
  WORK_CHECKOUT_START: "15:30",
  FRIDAY_CHECKOUT_START: "11:00",     // Khusus hari Jumat pulang jam 11:00
  SATURDAY_IS_HOLIDAY: true,          // Sabtu libur rutin
  SUNDAY_IS_HOLIDAY: true,            // Minggu libur rutin
  WORK_CHECKOUT_END: "17:00",
  LATE_THRESHOLD_MINUTES: 15,         // Terlambat jika > 07:15
  AUTO_ALFA_TIME: "16:30",            // Auto ALFA jika belum absen
  GEOFENCE_LAT: -6.613143,
  GEOFENCE_LNG: 106.684976,
  GEOFENCE_RADIUS_METERS: 50
};

// ─── ROLES ───────────────────────────────────────────────────────────────────

var ROLES = {
  GURU: "GURU",
  KEPSEK: "KEPSEK",
  ADMIN: "ADMIN"
};

// ─── ACCOUNT STATUS ──────────────────────────────────────────────────────────

var ACCOUNT_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  LOCKED: "LOCKED",
  PENDING: "PENDING"
};

// ─── ATTENDANCE STATUS ───────────────────────────────────────────────────────

var ATT_STATUS = {
  HADIR: "HADIR",
  TERLAMBAT: "TERLAMBAT",
  ALFA: "ALFA",
  IZIN: "IZIN",
  SAKIT: "SAKIT",
  DINAS_LUAR: "DINAS_LUAR",
  BELUM_ABSEN: "BELUM_ABSEN"
};

// ─── APPROVAL STATUS ─────────────────────────────────────────────────────────

var APPROVAL_STATUS = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CLOSED: "CLOSED"
};

// ─── DASHBOARD & ANALYTICS ───────────────────────────────────────────────────

var DASHBOARD = {
  DEFAULT_TREND_DAYS: 7,
  TARGET_KEHADIRAN_PERSEN: 95.0,
  CACHE_TTL_SECONDS: 60
};

// ─── BACKEND FEATURE FLAGS ──────────────────────────────────────────────────

var FEATURE_FLAGS = {
  ENABLE_QR: true,
  ENABLE_GPS: true,
  ENABLE_OFFLINE_SYNC: true,
  ENABLE_REPORT: true,
  ENABLE_NOTIFICATION: true,
  ENABLE_AUDIT: true,
  ENABLE_STRICT_DEVICE_BINDING: false, // false = Bebas login di Laptop & HP (Auto-rebind). true = Strict 1 HP per Guru.
  ENABLE_MAINTENANCE_MODE: false       // true = semua non-ADMIN diblokir
};

// ─── ERROR REGISTRY ──────────────────────────────────────────────────────────
// Satu tempat terpusat. Tidak ada error code baru yang dibuat di file lain.

var ERRORS = {
  // Auth
  AUTH_001: { code: "AUTH_001", message: "Login berhasil." },
  AUTH_002: { code: "AUTH_002", message: "Nomor WA / NIP tidak terdaftar dalam sistem." },
  AUTH_003: { code: "AUTH_003", message: "Akun Anda terikat pada perangkat HP lain." },
  AUTH_004: { code: "AUTH_004", message: "PIN 6-digit yang Anda masukkan salah." },
  AUTH_005: { code: "AUTH_005", message: "Akun Anda sedang dinonaktifkan oleh Admin Website." },
  AUTH_006: { code: "AUTH_006", message: "Akun Anda terkunci sementara karena terlalu banyak percobaan PIN salah." },
  AUTH_007: { code: "AUTH_007", message: "Sesi login telah kadaluwarsa. Silakan login kembali." },
  AUTH_008: { code: "AUTH_008", message: "Token authorization tidak ditemukan." },
  AUTH_009: { code: "AUTH_009", message: "Akun Anda masih dalam status Pending. Hubungi Admin Website." },
  AUTH_010: { code: "AUTH_010", message: "Input tidak valid. NIP/WA dan PIN wajib diisi." },

  // Attendance
  ATT_001: { code: "ATT_001", message: "Sesi pengguna tidak valid untuk absensi." },
  ATT_002: { code: "ATT_002", message: "Perangkat yang digunakan tidak sesuai dengan perangkat terdaftar." },
  ATT_003: { code: "ATT_003", message: "Posisi GPS Anda berada di luar radius area sekolah." },
  ATT_004: { code: "ATT_004", message: "Kode QR tidak valid atau sudah kadaluwarsa." },
  ATT_005: { code: "ATT_005", message: "Anda sudah melakukan absensi masuk hari ini." },
  ATT_006: { code: "ATT_006", message: "Anda belum melakukan absensi masuk hari ini. Tidak dapat checkout." },
  ATT_007: { code: "ATT_007", message: "Anda sudah melakukan absensi pulang hari ini." },
  ATT_008: { code: "ATT_008", message: "Waktu absensi pulang belum dimulai." },
  ATT_009: { code: "ATT_009", message: "Sesi offline tidak valid." },

  // GPS
  GPS_001: { code: "GPS_001", message: "Gagal mendapatkan lokasi GPS perangkat." },
  GPS_002: { code: "GPS_002", message: "Posisi GPS di luar radius geofence sekolah." },

  // QR
  QR_001: { code: "QR_001", message: "Format QR Code tidak dikenali." },
  QR_002: { code: "QR_002", message: "QR Code sudah kadaluwarsa (lebih dari 30 detik)." },

  // Leave
  LEV_001: { code: "LEV_001", message: "Rentang tanggal pengajuan izin tidak valid." },
  LEV_002: { code: "LEV_002", message: "Tanggal pengajuan jatuh pada hari libur." },
  LEV_003: { code: "LEV_003", message: "Terdapat pengajuan izin yang tumpang tindih." },
  LEV_004: { code: "LEV_004", message: "Alasan pengajuan izin terlalu singkat (minimal 10 karakter)." },

  // Report
  REP_001: { code: "REP_001", message: "Gagal menghasilkan laporan bulanan." },

  // Settings
  SET_001: { code: "SET_001", message: "Gagal menyimpan pengaturan sistem." },

  // System
  SYS_001: { code: "SYS_001", message: "Terjadi kesalahan internal server." },
  SYS_002: { code: "SYS_002", message: "Server sedang sibuk. Silakan coba lagi dalam beberapa detik." },
  SYS_003: { code: "SYS_003", message: "Sistem sedang dalam pemeliharaan. Silakan coba beberapa saat lagi." },
  SYS_004: { code: "SYS_004", message: "Action tidak dikenali oleh sistem." },
  SYS_005: { code: "SYS_005", message: "Request body kosong atau tidak valid." }
};
