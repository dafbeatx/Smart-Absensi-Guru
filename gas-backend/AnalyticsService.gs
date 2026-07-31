/**
 * ============================================================================
 * SMART ABSENSI GURU — ANALYTICS SERVICE (AnalyticsService.gs)
 * ============================================================================
 * Mesin kalkulasi analitik berbasis context.
 * Meminimalkan pembacaan Spreadsheet berkali-kali dengan memproses data yang
 * dimuat di memori (Context-based processing).
 * ============================================================================
 */

var AnalyticsService = {

  // ═══════════════════════════════════════════════════════════════════════════
  // GURU STATS
  // ═══════════════════════════════════════════════════════════════════════════

  getGuruStats: function(context, userId, monthStr) {
    var todayStr = Utils.formatDate(new Date());
    var userAttendance = context.attendance.filter(function(a) {
      return String(a.user_id) === String(userId);
    });

    // 1. Status hari ini
    var todayRecord = userAttendance.filter(function(a) {
      return String(a.date) === todayStr;
    })[0] || null;

    var todayStats = {
      status: todayRecord ? todayRecord.status : "BELUM_ABSEN",
      checkIn: todayRecord && todayRecord.check_in_time ? todayRecord.check_in_time.substring(0, 5) : "",
      checkOut: todayRecord && todayRecord.check_out_time ? todayRecord.check_out_time.substring(0, 5) : ""
    };

    // 2. Ringkasan bulanan
    var monthStats = AnalyticsService._calculateMonthlySummary(userAttendance, monthStr);

    // 3. Izin Pending
    var pendingLeaves = context.leaves.filter(function(l) {
      return String(l.user_id) === String(userId) && l.approval_status === APPROVAL_STATUS.SUBMITTED;
    }).length;

    return {
      today: todayStats,
      month: monthStats,
      leavePending: pendingLeaves,
      notifications: [] // Placeholder for future sprints
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KEPSEK STATS
  // ═══════════════════════════════════════════════════════════════════════════

  getKepsekStats: function(context) {
    var todayStr = Utils.formatDate(new Date());
    
    // Filter guru aktif (excl. Kepsek/Admin)
    var teachers = context.users.filter(function(u) {
      return u.role === ROLES.GURU && (!u.deleted_at || String(u.deleted_at).length === 0);
    });

    var todayAttendance = context.attendance.filter(function(a) {
      return String(a.date) === todayStr;
    });

    // 1. Ringkasan kehadiran hari ini
    var todaySummary = AnalyticsService._calculateTodaySummary(teachers, todayAttendance);

    // 2. KPI Kehadiran (Target vs Aktual)
    var activeCount = teachers.length;
    var presentCount = todaySummary.hadir + todaySummary.terlambat;
    var attendanceRate = activeCount > 0 ? Math.round((presentCount / activeCount) * 100) : 100;
    var kpiStatus = "OK";
    if (attendanceRate < DASHBOARD.TARGET_KEHADIRAN_PERSEN) {
      kpiStatus = "WARNING";
    }

    // 3. Izin yang butuh persetujuan
    var pendingApprovalCount = AnalyticsService._calculatePendingApproval(context.leaves);

    // 4. Guru Terlambat hari ini
    var lateTeachers = AnalyticsService._calculateLateSummary(teachers, todayAttendance);

    // 5. Tren Absensi (Configurable trend days)
    var trendDays = DASHBOARD.DEFAULT_TREND_DAYS;
    var trend = AnalyticsService._calculateTrend(context.attendance, teachers, trendDays);

    // 6. Riwayat Absensi Terbaru (10 record terakhir)
    var recentAttendance = todayAttendance
      .map(function(a) {
        var u = teachers.filter(function(t) { return t.id === a.user_id; })[0];
        return {
          id: a.id,
          name: u ? u.full_name : "Unknown",
          role: u ? u.role : "",
          time: a.check_in_time ? a.check_in_time.substring(0, 5) : "",
          status: a.status,
          method: a.verification_method
        };
      })
      .slice(0, 10);

    return {
      today: todaySummary,
      kpi: {
        percentage: attendanceRate,
        target: DASHBOARD.TARGET_KEHADIRAN_PERSEN,
        status: kpiStatus
      },
      pendingApproval: pendingApprovalCount,
      lateTeachers: lateTeachers,
      recentAttendance: recentAttendance,
      trend: trend
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN STATS
  // ═══════════════════════════════════════════════════════════════════════════

  getAdminStats: function(context) {
    var todayStr = Utils.formatDate(new Date());

    // 1. Metadata sistem
    var isMaintenance = false;
    var maintenanceSetting = context.settings.filter(function(s) { return s.key === "maintenance_mode"; })[0];
    if (maintenanceSetting && maintenanceSetting.value === "true") {
      isMaintenance = true;
    }

    // Hitung audit log hari ini
    var todayAuditLogs = context.auditLogs.filter(function(a) {
      return String(a.created_at).indexOf(todayStr) === 0;
    }).length;

    // Hitung total request hari ini (dari request logs)
    var todayRequests = context.requestLogs.filter(function(r) {
      return String(r.created_at).indexOf(todayStr) === 0;
    });

    var totalRequestsCount = todayRequests.length;

    // Hitung Cache Hit rate dari request logs hari ini
    var cacheHits = todayRequests.filter(function(r) {
      return String(r.response_code).indexOf("CACHE_HIT") !== -1;
    }).length;
    var cacheHitRate = totalRequestsCount > 0 ? Math.round((cacheHits / totalRequestsCount) * 100) : 0;

    // Rata-rata execution time hari ini
    var totalExecutionMs = 0;
    var validExecutionCount = 0;
    for (var i = 0; i < todayRequests.length; i++) {
      var ms = parseInt(todayRequests[i].execution_ms, 10);
      if (!isNaN(ms)) {
        totalExecutionMs += ms;
        validExecutionCount++;
      }
    }
    var avgResponseTime = validExecutionCount > 0 ? Math.round(totalExecutionMs / validExecutionCount) : 0;

    var teachers = context.users.filter(function(u) {
      return u.role === ROLES.GURU && (!u.deleted_at || String(u.deleted_at).length === 0);
    });

    var todayAttendance = context.attendance.filter(function(a) {
      return String(a.date) === todayStr;
    });

    var pendingLeaves = context.leaves.filter(function(l) {
      return l.approval_status === APPROVAL_STATUS.SUBMITTED;
    }).length;

    return {
      system: {
        online: true,
        maintenanceMode: isMaintenance,
        database: "Healthy",
        cacheHitRate: cacheHitRate + "%",
        todayRequests: totalRequestsCount,
        averageResponseTimeMs: avgResponseTime
      },
      teacherCount: teachers.length,
      todayAttendance: todayAttendance.length,
      pendingLeave: pendingLeaves,
      auditToday: todayAuditLogs
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE STATS HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  _calculateTodaySummary: function(teachers, todayAttendance) {
    var stats = { hadir: 0, terlambat: 0, belumAbsen: 0, izin: 0 };
    var presentUserIds = {};

    for (var i = 0; i < todayAttendance.length; i++) {
      var a = todayAttendance[i];
      presentUserIds[a.user_id] = true;
      if (a.status === ATT_STATUS.HADIR) {
        stats.hadir++;
      } else if (a.status === ATT_STATUS.TERLAMBAT) {
        stats.terlambat++;
      } else if (a.status === ATT_STATUS.IZIN || a.status === ATT_STATUS.SAKIT || a.status === ATT_STATUS.DINAS_LUAR) {
        stats.izin++;
      }
    }

    // Belum absen adalah guru aktif yang tidak ada di todayAttendance
    for (var j = 0; j < teachers.length; j++) {
      if (!presentUserIds[teachers[j].id]) {
        stats.belumAbsen++;
      }
    }

    return stats;
  },

  _calculateMonthlySummary: function(userAttendance, monthStr) {
    if (!monthStr) {
      monthStr = Utils.formatDate(new Date()).substring(0, 7); // YYYY-MM
    }

    var monthlyRecs = userAttendance.filter(function(a) {
      return String(a.date).indexOf(monthStr) === 0;
    });

    var stats = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0 };

    for (var i = 0; i < monthlyRecs.length; i++) {
      var s = monthlyRecs[i].status;
      if (s === ATT_STATUS.HADIR) stats.hadir++;
      else if (s === ATT_STATUS.TERLAMBAT) stats.terlambat++;
      else if (s === ATT_STATUS.IZIN) stats.izin++;
      else if (s === ATT_STATUS.SAKIT) stats.sakit++;
      else if (s === ATT_STATUS.DINAS_LUAR) stats.izin++; // DL dihitung izin di summary harian guru
      else if (s === ATT_STATUS.ALFA) stats.alfa++;
    }

    // Hari kerja bulan ini (jumlah hari senin-jumat di bulan ini)
    var year = parseInt(monthStr.substring(0, 4), 10);
    var month = parseInt(monthStr.substring(5, 7), 10) - 1; // 0-indexed
    var totalWorkDays = AnalyticsService._getWeekdaysCount(year, month);

    var sudahHadirCount = stats.hadir + stats.terlambat;

    return {
      hadir: stats.hadir,
      terlambat: stats.terlambat,
      izin: stats.izin,
      sakit: stats.sakit,
      alfa: stats.alfa,
      hariKerja: totalWorkDays,
      sudahHadir: sudahHadirCount,
      sisaHariKerja: Math.max(0, totalWorkDays - sudahHadirCount)
    };
  },

  _calculateLateSummary: function(teachers, todayAttendance) {
    var lates = todayAttendance.filter(function(a) {
      return a.status === ATT_STATUS.TERLAMBAT;
    });

    return lates.map(function(a) {
      var u = teachers.filter(function(t) { return t.id === a.user_id; })[0];
      return {
        name: u ? u.full_name : "Unknown",
        time: a.check_in_time ? a.check_in_time.substring(0, 5) : "",
        lateMinutes: a.late_minutes || 0
      };
    });
  },

  _calculatePendingApproval: function(leaves) {
    return leaves.filter(function(l) {
      return l.approval_status === APPROVAL_STATUS.SUBMITTED;
    }).length;
  },

  _calculateTrend: function(attendance, teachers, days) {
    var trend = [];
    var now = new Date();
    
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(now.getDate() - i);
      
      // Lewati akhir pekan untuk tren absensi sekolah
      if (d.getDay() === 0 || d.getDay() === 6) {
        continue;
      }

      var dateStr = Utils.formatDate(d);
      var dayAttendance = attendance.filter(function(a) {
        return String(a.date) === dateStr;
      });

      var present = dayAttendance.filter(function(a) {
        return a.status === ATT_STATUS.HADIR || a.status === ATT_STATUS.TERLAMBAT;
      }).length;

      trend.push({
        date: dateStr.substring(5), // MM-DD
        present: present,
        total: teachers.length
      });
    }

    return trend;
  },

  /**
   * Helper untuk menghitung jumlah hari kerja (Senin-Jumat) dalam satu bulan.
   */
  _getWeekdaysCount: function(year, month) {
    var count = 0;
    var d = new Date(year, month, 1);
    while (d.getMonth() === month) {
      var day = d.getDay();
      if (day !== 0 && day !== 6) {
        count++;
      }
      d.setDate(d.getDate() + 1);
    }
    return count;
  }
};
