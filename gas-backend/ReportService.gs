/**
 * ============================================================================
 * SMART ABSENSI GURU — REPORT SERVICE (ReportService.gs)
 * ============================================================================
 * Server-Side Multi-Sheet Data Aggregator.
 * Updated to use standard API response format & Config constants.
 * Will be expanded in Sprint B5.
 * ============================================================================
 */

var ReportService = {

  /**
   * Generates Monthly Aggregated Report Data for Excel export.
   */
  generateMonthlyReport: function(payload, currentUser, requestId) {
    var month = payload.month || "07";
    var year = payload.year || "2026";
    var prefix = year + "-" + month;

    // 1. Fetch all data
    var users = DatabaseManager.findAll(DB.SHEETS.USERS);
    var attendance = DatabaseManager.findAll(DB.SHEETS.ATTENDANCE);
    var leaves = DatabaseManager.findAll(DB.SHEETS.LEAVE_REQUESTS);
    var auditLogs = DatabaseManager.findAll(DB.SHEETS.AUDIT_LOGS);

    // 2. Filter by period
    var filteredAttendance = attendance.filter(function(a) {
      return String(a.date).indexOf(prefix) === 0;
    });

    var filteredLeaves = leaves.filter(function(l) {
      return String(l.start_date).indexOf(prefix) === 0;
    });

    // 3. Return aggregated data
    return Utils.successResponse("REP_MONTHLY", "Laporan bulanan " + month + "-" + year, {
      period: month + "-" + year,
      teachers: users.filter(function(u) { return u.role === ROLES.GURU; }),
      attendance_records: filteredAttendance,
      leave_requests: filteredLeaves,
      audit_logs: auditLogs.slice(0, 100)
    }, requestId);
  }
};
