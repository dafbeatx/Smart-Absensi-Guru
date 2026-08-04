/**
 * ============================================================================
 * SMART ABSENSI GURU — MAIN ENTRY POINT & ROUTER (Main.gs)
 * ============================================================================
 * Pure dispatcher. ZERO business logic di file ini.
 *
 *   doGet()  → PING, GET_VERSION, GET_PUBLIC_SETTINGS
 *   doPost() → parseRequest → logRequest → maintenanceGuard
 *              → authenticate → dispatchAction → logResponse → returnJson
 * ============================================================================
 */

// ─── HTTP GET HANDLER ────────────────────────────────────────────────────────

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "PING";
  var requestId = Utils.generateRequestId();

  // Health Check
  if (action === "PING") {
    var dbConnected = false;
    try {
      var sheet = DatabaseManager.getSheet(DB.SHEETS.USERS);
      dbConnected = (sheet !== null);
    } catch (err) {
      dbConnected = false;
    }

    return Utils.successResponse("SYS_PING", "OK", {
      app: APP.NAME,
      institution: APP.INSTITUTION,
      version: APP.VERSION,
      database: dbConnected ? "connected" : "disconnected",
      environment: APP.ENVIRONMENT,
      server_time: Utils.now()
    }, requestId);
  }

  // Version Check (untuk frontend auto-update detection)
  if (action === "GET_VERSION") {
    return Utils.successResponse("SYS_VERSION", "Version info", {
      version: APP.VERSION,
      environment: APP.ENVIRONMENT
    }, requestId);
  }

  // Public Settings (tidak perlu auth)
  if (action === "GET_PUBLIC_SETTINGS") {
    var settings = DatabaseManager.findAll(DB.SHEETS.SYSTEM_SETTINGS);
    var settingsMap = {};
    for (var i = 0; i < settings.length; i++) {
      settingsMap[settings[i].key] = settings[i].value;
    }
    return Utils.successResponse("SET_PUBLIC", "Pengaturan publik", settingsMap, requestId);
  }

  return Utils.errorResponse(ERRORS.SYS_004.code, ERRORS.SYS_004.message, null, requestId);
}

// ─── HTTP POST HANDLER ───────────────────────────────────────────────────────

function doPost(e) {
  var requestId = Utils.generateRequestId();
  var startTime = Date.now();
  var action = "UNKNOWN";
  var actorId = "";
  var actorRole = "";

  try {
    // ── 1. Parse Request ──────────────────────────────────────────────────
    if (!e || !e.postData || !e.postData.contents) {
      return Utils.errorResponse(ERRORS.SYS_005.code, ERRORS.SYS_005.message, null, requestId);
    }

    var payload = JSON.parse(e.postData.contents);
    action = (e.parameter && e.parameter.action) ? e.parameter.action : payload.action;

    if (!action) {
      return Utils.errorResponse(ERRORS.SYS_004.code, "Parameter 'action' wajib diisi.", null, requestId);
    }

    // ── 2. Log Request ────────────────────────────────────────────────────
    RequestLogger.logRequest({
      requestId: requestId,
      action: action,
      method: "POST",
      ipAddress: "",
      userAgent: payload.user_agent || "",
      payloadSize: e.postData.contents.length
    });

    // ── 3. Public Actions (No Auth Required) ──────────────────────────────
    if (action === "LOGIN") {
      var loginResult = AuthService.login(payload, requestId);
      _logResponseTime(requestId, startTime, action);
      return loginResult;
    }

    // ── 4. JWT Authentication Guard ───────────────────────────────────────
    var token = (e.parameter && e.parameter.token) ? e.parameter.token : payload.token;
    var authCheck = Security.verifyToken(token);

    if (!authCheck.valid) {
      RequestLogger.logResponse(requestId, Date.now() - startTime, false, ERRORS.AUTH_008.code);
      return Utils.errorResponse(ERRORS.AUTH_008.code, authCheck.message, null, requestId);
    }

    var currentUser = authCheck.payload;
    actorId = currentUser.sub || "";
    actorRole = currentUser.role || "";

    // Update request log with actor info
    RequestLogger.logResponse(requestId, 0, true, "AUTHENTICATED", actorId, actorRole);

    // ── 5. Maintenance Mode Guard ─────────────────────────────────────────
    if (FEATURE_FLAGS.ENABLE_MAINTENANCE_MODE && actorRole !== ROLES.ADMIN) {
      var maintenanceSetting = DatabaseManager.findRecord(
        DB.SHEETS.SYSTEM_SETTINGS, "key", "maintenance_mode"
      );
      if (maintenanceSetting && maintenanceSetting.value === "true") {
        var resp = Utils.errorResponse(ERRORS.SYS_003.code, ERRORS.SYS_003.message, null, requestId);
        _logResponseTime(requestId, startTime, action, actorId, actorRole);
        return resp;
      }
    }

    // ── 6. Action Dispatcher Router ───────────────────────────────────────
    var result;

    switch (action) {

      // ── Auth & Session ───────────────────────────────────────────────
      case "VERIFY_SESSION":
        result = AuthService.verifySession(currentUser, requestId);
        break;

      case "LOGOUT":
        result = AuthService.logout(payload, currentUser, requestId);
        break;

      case "CHANGE_PIN":
        result = AuthService.changePIN(payload, currentUser, requestId);
        break;

      // ── User Management (Admin) ──────────────────────────────────────
      case "GET_ALL_USERS":
        result = AuthService.getAllUsers(currentUser, requestId);
        break;

      case "CREATE_USER":
        result = AuthService.createUser(payload, currentUser, requestId);
        break;

      case "DELETE_USER":
        result = AuthService.deleteUser(payload, currentUser, requestId);
        break;

      case "TOGGLE_USER_STATUS":
        result = AuthService.toggleUserStatus(payload, currentUser, requestId);
        break;

      // ── Attendance ───────────────────────────────────────────────────
      case "SCAN_ATTENDANCE":
        result = AttendanceService.processCheckIn(payload, currentUser, requestId);
        break;

      case "CHECK_OUT":
        result = AttendanceService.processCheckOut(payload, currentUser, requestId);
        break;

      case "SYNC_OFFLINE_ATTENDANCE":
        result = AttendanceService.syncOfflineQueue(payload, currentUser, requestId);
        break;

      // ── Leave Management ─────────────────────────────────────────────
      case "SUBMIT_LEAVE":
        result = LeaveService.submitLeave(payload, currentUser, requestId);
        break;

      case "APPROVE_LEAVE":
        result = LeaveService.approveLeave(payload, currentUser, requestId);
        break;

      case "GET_PENDING_LEAVES":
        result = LeaveService.getPendingLeaves(currentUser, payload, requestId);
        break;

      // ── Dashboard APIs ───────────────────────────────────────────────
      case "GET_GURU_DASHBOARD":
        result = DashboardService.getGuruDashboard(currentUser, payload, requestId);
        break;

      case "GET_KEPSEK_DASHBOARD":
        result = DashboardService.getKepsekDashboard(currentUser, payload, requestId);
        break;

      case "GET_ADMIN_DASHBOARD":
        result = DashboardService.getAdminDashboard(currentUser, payload, requestId);
        break;

      // ── Reports ──────────────────────────────────────────────────────
      case "GENERATE_REPORT":
      case "GENERATE_MONTHLY_REPORT":
        result = ReportService.generateMonthlyReport(payload, currentUser, requestId);
        break;

      // ── Admin User Management & Security ─────────────────────────────
      case "RESET_DEVICE":
        result = AuthService.resetDevice(payload, currentUser, requestId);
        break;

      case "RESET_PIN":
        result = AuthService.resetPIN(payload, currentUser, requestId);
        break;

      // ── Settings ─────────────────────────────────────────────────────
      case "GET_SETTINGS":
        result = SettingsService.getSettings(requestId);
        break;

      case "UPDATE_SETTINGS":
        result = SettingsService.updateSettings(payload, currentUser, requestId);
        break;

      // ── Academic Calendar & Holidays ─────────────────────────────────
      case "GET_HOLIDAYS":
        result = HolidayService.getHolidays(requestId);
        break;

      case "CREATE_HOLIDAY":
        result = HolidayService.createHoliday(payload, currentUser, requestId);
        break;

      case "UPDATE_HOLIDAY":
        result = HolidayService.updateHoliday(payload, currentUser, requestId);
        break;

      case "DELETE_HOLIDAY":
        result = HolidayService.deleteHoliday(payload, currentUser, requestId);
        break;

      default:
        result = Utils.errorResponse(
          ERRORS.SYS_004.code,
          "Action '" + action + "' belum diimplementasikan.",
          null,
          requestId
        );
    }

    _logResponseTime(requestId, startTime, action, actorId, actorRole);
    return result;

  } catch (err) {
    // ── Global Error Handler ──────────────────────────────────────────────
    var errMsg = err.toString();

    RequestLogger.logError({
      requestId: requestId,
      action: action,
      actorId: actorId,
      errorCode: ERRORS.SYS_001.code,
      errorMessage: errMsg,
      stacktrace: err.stack || "",
      payloadSnapshot: (e && e.postData) ? e.postData.contents.substring(0, 500) : ""
    });

    RequestLogger.logResponse(requestId, Date.now() - startTime, false, ERRORS.SYS_001.code, actorId, actorRole);

    return Utils.errorResponse(
      ERRORS.SYS_001.code,
      ERRORS.SYS_001.message + " Detail: " + errMsg,
      null,
      requestId
    );
  }
}

// ─── INTERNAL HELPER ─────────────────────────────────────────────────────────

function _logResponseTime(requestId, startTime, action, actorId, actorRole) {
  var executionMs = Date.now() - startTime;
  RequestLogger.logResponse(requestId, executionMs, true, action + "_OK", actorId, actorRole);
}
