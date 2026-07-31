# 📘 Backend Implementation Guide (BIG) — Smart Absensi Guru

**Sub-Branding:** SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam  
**Status:** 🟢 **Frontend Complete Candidate (UI Frozen)**  
**Document Purpose:** Architectural Master Blueprint for Google Apps Script & Google Spreadsheet Integration (Sprint B1 – B6)

---

## 🗄️ 1. Multi-Spreadsheet Database Architecture

To bypass Google Spreadsheet single-file row limits and maximize query throughput, database tables are partitioned into 5 independent Google Spreadsheets:

```text
Google Drive Root / Database_SmartAbsensi/
├── DB_MASTER_USERS.xlsx           (Sheet: Users, Device_Binding, Sessions)
├── DB_MASTER_SETTINGS.xlsx        (Sheet: System_Settings, Shifts, Holidays)
├── DB_TRANSACTION_ATTENDANCE.xlsx (Sheet: Attendance, Attendance_Log)
├── DB_TRANSACTION_APPROVAL.xlsx  (Sheet: Leave_Requests, Approvals)
└── DB_AUDIT_LOG.xlsx              (Sheet: Audit_Logs, Migrations)
```

---

## 🛠️ 2. Database Initializer & Automated Seeder Spec (`DatabaseSeeder.gs`)

The GAS script provides an automated 1-click initialiser function `initializeDatabase()` that automatically creates all 5 Spreadsheets, applies tab names, and writes strict headers:

```javascript
function initializeDatabase() {
  var userSs = SpreadsheetApp.create("DB_MASTER_USERS");
  var userSheet = userSs.getActiveSheet();
  userSheet.setName("Users");
  userSheet.appendRow([
    "id", "nip", "full_name", "phone_number", "pin_hash", "pin_salt", 
    "role", "position", "avatar_url", "is_active", "created_at"
  ]);

  // Seed default admin operator & principal
  userSheet.appendRow([
    "usr_op_1", "199501012020011001", "Operator IT", "081234567890",
    "HASHED_PIN", "SALT", "OPERATOR", "Admin IT Sekolah", "", true, new Date().toISOString()
  ]);
  
  Logger.log("✅ Database initialized automatically!");
}
```

---

## 🔄 3. Database Migration System (`MigrationEngine.gs`)

Database schema evolution is managed via immutable migration scripts. Editing spreadsheets manually in production is strictly prohibited.

```javascript
var MigrationEngine = {
  runMigrations: function() {
    var applied = DatabaseManager.getSheetDataObjects("AUDIT", "Migrations");
    var appliedIds = applied.map(function(m) { return m.migration_id; });

    if (appliedIds.indexOf("Migration_001_AddLastSync") === -1) {
      MigrationEngine.migration001();
    }
  },

  migration001: function() {
    var ss = DatabaseManager.getSpreadsheet("ATTENDANCE");
    var sheet = ss.getSheetByName("Attendance");
    sheet.getRange(1, sheet.getLastColumn() + 1).setValue("last_sync_timestamp");

    DatabaseManager.appendRecord("AUDIT", "Migrations", {
      migration_id: "Migration_001_AddLastSync",
      description: "Added last_sync_timestamp column to Attendance sheet",
      applied_at: new Date().toISOString()
    });
  }
};
```

---

## 🔒 4. Concurrency & LockService Strategy

To prevent duplicate check-in race conditions when 12 teachers scan simultaneously at 06:45 WIB:

```javascript
function executeWithLock(callback) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 10 seconds wait timeout
    return callback();
  } catch (e) {
    return Utils.jsonResponse({
      status: "error",
      code: "SYS_002",
      message: "Server sedang sibuk menangani absensi simultan. Silakan coba 3 detik lagi."
    }, 503);
  } finally {
    lock.releaseLock();
  }
}
```

---

## 🛣️ 5. Sprint B1 – B6 Backend Implementation Roadmap

### **Sprint B1: Authentication & Session Engine**
- `LOGIN` (NIP/WA + PIN check, Argon2id/SHA256 HMAC hash, Device Binding validation)
- `VERIFY_SESSION` (JWT token signature check)
- `RESET_DEVICE` (Operator reset device fingerprint)

### **Sprint B2: Core Attendance Engine & 5-Tier Pipeline**
- `SCAN_ATTENDANCE` (TOTP seed validation, Haversine GPS radius check, `ATT_005` duplicate check, sheet append)

### **Sprint B3: Leave Management & Approval Engine**
- `SUBMIT_LEAVE` (Date range validation, overlap check, Drive attachment upload)
- `APPROVE_LEAVE` (Kepsek State machine transition, mandatory notes check)

### **Sprint B4: Role Dashboard Aggregation API**
- `GET_TEACHER_DASHBOARD`
- `GET_KEPSEK_DASHBOARD`
- `GET_OPERATOR_DASHBOARD`

### **Sprint B5: Multi-Sheet Report Aggregator**
- `GENERATE_MONTHLY_REPORT` (Returns JSON dataset for 5-Sheet Excel file)

### **Sprint B6: System Settings & Multi-Tenant Branding**
- `GET_PUBLIC_SETTINGS` & `UPDATE_SETTINGS`

---

## 📂 6. GAS Backend Folder Architecture

```text
gas-backend/
├── Config.gs             # Multi-Spreadsheet IDs, Shifts, Geofence Defaults
├── Utils.gs              # JSON response, Haversine GPS Math, Date Formatters
├── DatabaseManager.gs    # Sheet connectors, LockService wrapper
├── Security.gs           # HMAC PIN Hashing, Device Fingerprinting, JWT
├── AuthService.gs        # Login handler, NIP/WA validation, Device Binding
├── AttendanceService.gs  # 5-Tier QR check-in & duplicate protection
├── LeaveService.gs       # Leave request & approval state machine
├── ReportService.gs      # Multi-Sheet report aggregator
├── MigrationEngine.gs    # Database schema migration runner
├── DatabaseSeeder.gs     # Automated initializeDatabase() script
└── Main.gs               # Action Dispatcher Router (doGet & doPost)
```

---
*Backend Implementation Guide — Finalized for Sprint B1 – B6 Backend Phase.*
