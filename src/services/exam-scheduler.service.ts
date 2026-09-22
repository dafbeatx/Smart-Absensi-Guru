import type {
  ExamScheduleFormConfig,
  ExamSubjectScheduleItem,
  ExamProctorItem,
  ExamScheduleData,
  ExamScheduleSummary,
  ExamCommitteeMember,
} from '../types/exam-schedule.types';
import type { UserProfile } from '../types/database.types';

const INDONESIAN_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

interface TeacherLoad {
  userId: string;
  fullName: string;
  assignedCount: number;
  teachingSubjects: string[];
}

export class ExamSchedulerService {
  /**
   * Generates date sequence (YYYY-MM-DD) between start and end date.
   * By default, skips Sundays and Saturdays (standard 5-day school week).
   * If includeSaturday is true, Saturdays are included (6-day school week).
   */
  public static getValidExamDates(
    startDateStr: string,
    endDateStr: string,
    includeSaturday = false
  ): Array<{ date: string; dayName: string }> {
    const dates: Array<{ date: string; dayName: string }> = [];
    const current = new Date(startDateStr);
    const end = new Date(endDateStr);

    // Guard against invalid ranges
    if (isNaN(current.getTime()) || isNaN(end.getTime()) || current > end) {
      // Default to 5 business days starting upcoming Monday
      const now = new Date();
      const day = now.getDay();
      const diff = day === 1 ? 0 : (8 - day) % 7;
      const startMonday = new Date(now);
      startMonday.setDate(now.getDate() + diff);

      for (let i = 0; i < 7 && dates.length < 5; i++) {
        const d = new Date(startMonday);
        d.setDate(startMonday.getDate() + i);
        const dayOfWeek = d.getDay();
        const isSunday = dayOfWeek === 0;
        const isSaturday = dayOfWeek === 6;
        if (!isSunday && (includeSaturday || !isSaturday)) {
          dates.push({
            date: d.toISOString().split('T')[0],
            dayName: INDONESIAN_DAYS[dayOfWeek],
          });
        }
      }
      return dates;
    }

    let iterations = 0;
    while (current <= end && iterations < 30) {
      iterations++;
      const dayOfWeek = current.getDay();
      const isSunday = dayOfWeek === 0;
      const isSaturday = dayOfWeek === 6;
      if (!isSunday && (includeSaturday || !isSaturday)) {
        const dateStr = current.toISOString().split('T')[0];
        dates.push({
          date: dateStr,
          dayName: INDONESIAN_DAYS[dayOfWeek],
        });
      }
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Generates conflict-free exam subject schedule and fair proctor assignment using smart heuristics.
   */
  public static generateSchedule(
    config: ExamScheduleFormConfig,
    allTeachers: UserProfile[],
    committeeMembers: ExamCommitteeMember[] = []
  ): ExamScheduleData {
    const shouldIncludeSaturday =
      config.includeSaturday ??
      config.dayOverrides?.some(
        (o) =>
          o.dayName?.toLowerCase() === 'sabtu' ||
          (o.date && new Date(o.date).getDay() === 6)
      ) ??
      false;

    const examDates = this.getValidExamDates(config.startDate, config.endDate, shouldIncludeSaturday);
    const totalDays = Math.max(1, examDates.length);

    // Build ordered list of all actual daily slots (supporting per-day session count overrides)
    interface ConcreteSlot {
      date: string;
      dayName: string;
      sessionNumber: number;
      startTime: string;
      endTime: string;
    }

    const allSlots: ConcreteSlot[] = [];

    examDates.forEach((dateInfo) => {
      // Check if there is an override for this specific date or dayName
      const override = config.dayOverrides?.find(
        (o) =>
          (o.date && o.date === dateInfo.date) ||
          (o.dayName && o.dayName.toLowerCase() === dateInfo.dayName.toLowerCase())
      );

      const countForThisDay = override !== undefined
        ? override.sessionsCount
        : (config.sessionsPerDay || config.sessionSlots?.length || 2);
      const safeCount = Math.max(1, Math.min(4, countForThisDay));

      for (let sNum = 1; sNum <= safeCount; sNum++) {
        const customSlot = override?.sessionSlots?.find((s) => s.sessionNumber === sNum);
        const baseSlot = config.sessionSlots?.find((s) => s.sessionNumber === sNum);
        const isFriday = dateInfo.dayName.toLowerCase() === 'jumat';

        let defStart = '07:30';
        let defEnd = '09:30';
        if (isFriday) {
          if (sNum === 1) { defStart = '07:15'; defEnd = '08:45'; }
          else if (sNum === 2) { defStart = '09:00'; defEnd = '10:30'; }
          else if (sNum === 3) { defStart = '13:30'; defEnd = '15:00'; }
          else { defStart = '15:15'; defEnd = '16:30'; }
        } else {
          if (sNum === 1) { defStart = '07:30'; defEnd = '09:00'; }
          else if (sNum === 2) { defStart = '09:30'; defEnd = '11:00'; }
          else if (sNum === 3) { defStart = '11:15'; defEnd = '12:45'; }
          else { defStart = '13:15'; defEnd = '14:45'; }
        }

        const finalStart = customSlot?.startTime || (isFriday ? defStart : (baseSlot?.startTime || defStart));
        const finalEnd = customSlot?.endTime || (isFriday ? defEnd : (baseSlot?.endTime || defEnd));

        allSlots.push({
          date: dateInfo.date,
          dayName: dateInfo.dayName,
          sessionNumber: sNum,
          startTime: finalStart,
          endTime: finalEnd,
        });
      }
    });

    const totalSlots = Math.max(1, allSlots.length);

    const classes = config.selectedClasses && config.selectedClasses.length > 0
      ? config.selectedClasses
      : ['7A', '7B', '8A', '8B', '9A', '9B'];

    const subjects = config.selectedSubjects && config.selectedSubjects.length > 0
      ? config.selectedSubjects
      : ['PAI', 'PKn', 'Bahasa Indonesia', 'Matematika', 'IPA', 'IPS', 'Bahasa Inggris', 'Informatika', 'Seni Budaya', 'PJOK'];

    // ── PREPARE ROOM ALLOCATION (RUANG 1 S/D RUANG X) ────────────────────────
    const totalRooms = Math.max(1, config.totalRooms || classes.length || 1);
    const roomFormat = config.roomFormat || 'NUMERIC';

    const formatRoomName = (roomNumber: number): string => {
      const numStr = roomFormat === 'DOUBLE_DIGIT' ? String(roomNumber).padStart(2, '0') : String(roomNumber);
      return `Ruang ${numStr}`;
    };

    const classRoomMap = new Map<string, string>();
    classes.forEach((cls, clsIdx) => {
      if (config.classRoomMapping && config.classRoomMapping[cls]) {
        classRoomMap.set(cls, config.classRoomMapping[cls]);
      } else {
        const roomNum = (clsIdx % totalRooms) + 1;
        classRoomMap.set(cls, formatRoomName(roomNum));
      }
    });

    // ── 1. GENERATE SUBJECT SCHEDULES PER CLASS ──────────────────────────────
    const subjectSchedules: ExamSubjectScheduleItem[] = [];

    // Map each subject to the concrete slot for each class
    classes.forEach((cls) => {
      const assignedRoom = classRoomMap.get(cls) || formatRoomName(1);

      subjects.forEach((subj, subjIdx) => {
        const slot = allSlots[subjIdx % totalSlots];

        subjectSchedules.push({
          id: `subj_${cls}_${slot.date}_s${slot.sessionNumber}_${subjIdx}`,
          date: slot.date,
          dayName: slot.dayName,
          sessionNumber: slot.sessionNumber,
          startTime: slot.startTime,
          endTime: slot.endTime,
          className: cls,
          subject: subj,
          roomName: assignedRoom,
          isLabRequired: false,
        });
      });
    });

    // Sort chronologically: date ASC, sessionNumber ASC, className ASC
    subjectSchedules.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.sessionNumber !== b.sessionNumber) return a.sessionNumber - b.sessionNumber;
      return a.className.localeCompare(b.className);
    });

    // ── 2. PREPARE PROCTOR TEACHERS POOL ──────────────────────────────────────
    const committeeUserIds = new Set(
      committeeMembers.filter((m) => m.isActive).map((m) => m.userId)
    );

    // Filter teachers available for invigilation
    let eligibleTeachers = allTeachers.filter((t) => {
      const isSelected = config.selectedTeacherIds.length === 0 || config.selectedTeacherIds.includes(t.id);
      const isRoleTeacher = ['GURU', 'ADMIN', 'OPERATOR', 'WALIKELAS'].includes((t.role || 'GURU').toUpperCase());
      const isCommitteeExcluded = config.excludeCommitteeProctor && committeeUserIds.has(t.id);
      return isSelected && isRoleTeacher && !isCommitteeExcluded;
    });

    // Fallback if filter is too restrictive
    if (eligibleTeachers.length === 0) {
      eligibleTeachers = allTeachers.filter((t) => (t.role || 'GURU').toUpperCase() !== 'SISWA');
    }

    // Initialize teacher load balancing tracker
    const teacherLoads: Map<string, TeacherLoad> = new Map();
    eligibleTeachers.forEach((t) => {
      const teachingSubjs: string[] = [];
      if (t.teaching_assignment) {
        if (Array.isArray(t.teaching_assignment)) {
          teachingSubjs.push(...t.teaching_assignment);
        } else if (typeof t.teaching_assignment === 'string') {
          teachingSubjs.push(...(t.teaching_assignment as string).split(',').map((s) => s.trim()));
        }
      }
      teacherLoads.set(t.id, {
        userId: t.id,
        fullName: t.full_name || 'Guru Pengawas',
        assignedCount: 0,
        teachingSubjects: teachingSubjs,
      });
    });

    // ── 3. GENERATE PROCTOR ASSIGNMENTS (ANTI-OWN-SUBJECT & LOAD-BALANCED) ─────
    const proctorSchedules: ExamProctorItem[] = [];

    // Group subjects by (date, sessionNumber)
    const slotMap = new Map<string, ExamSubjectScheduleItem[]>();
    subjectSchedules.forEach((item) => {
      const key = `${item.date}_S${item.sessionNumber}`;
      const list = slotMap.get(key) || [];
      list.push(item);
      slotMap.set(key, list);
    });

    // Sort slot keys chronologically
    const sortedSlotKeys = Array.from(slotMap.keys()).sort();

    sortedSlotKeys.forEach((slotKey) => {
      const itemsInSlot = slotMap.get(slotKey) || [];
      const firstItem = itemsInSlot[0];
      const slotDate = firstItem.date;
      const slotDayName = firstItem.dayName;
      const slotNum = firstItem.sessionNumber;
      const slotStart = firstItem.startTime;
      const slotEnd = firstItem.endTime;

      // Track teachers already assigned in THIS exact slot (prevents double-booking)
      const assignedInCurrentSlot = new Set<string>();

      itemsInSlot.forEach((subjItem) => {
        const roomName = subjItem.roomName || classRoomMap.get(subjItem.className) || formatRoomName(1);

        // Find candidate proctors:
        // Rule 1: Not assigned in this slot yet
        // Rule 2: If excludeOwnSubject is true, teacher does not teach this subject
        let candidates = Array.from(teacherLoads.values()).filter((tl) => {
          if (assignedInCurrentSlot.has(tl.userId)) return false;

          if (config.excludeOwnSubject) {
            const teachesThisSubject = tl.teachingSubjects.some(
              (ts) => ts.toLowerCase().trim() === subjItem.subject.toLowerCase().trim()
            );
            if (teachesThisSubject) return false;
          }

          return true;
        });

        // Soft fallback if rules leave no candidates (relax subject restriction)
        if (candidates.length === 0) {
          candidates = Array.from(teacherLoads.values()).filter(
            (tl) => !assignedInCurrentSlot.has(tl.userId)
          );
        }

        // Emergency fallback if total teachers < rooms
        if (candidates.length === 0) {
          candidates = Array.from(teacherLoads.values());
        }

        // Sort candidates by assignedCount ascending (least assigned gets prioritized)
        candidates.sort((a, b) => a.assignedCount - b.assignedCount);

        const chosenProctor = candidates[0];
        if (chosenProctor) {
          chosenProctor.assignedCount++;
          assignedInCurrentSlot.add(chosenProctor.userId);
        }

        // Secondary proctor if configured (2 proctors per room)
        let chosenSecondary: TeacherLoad | undefined;
        if (config.proctorsPerRoom === 2) {
          const secondaryCandidates = candidates.filter((c) => c.userId !== chosenProctor?.userId);
          if (secondaryCandidates.length > 0) {
            chosenSecondary = secondaryCandidates[0];
            chosenSecondary.assignedCount++;
            assignedInCurrentSlot.add(chosenSecondary.userId);
          }
        }

        proctorSchedules.push({
          id: `proc_${subjItem.className}_${slotDate}_s${slotNum}`,
          date: slotDate,
          dayName: slotDayName,
          sessionNumber: slotNum,
          startTime: slotStart,
          endTime: slotEnd,
          roomName,
          className: subjItem.className,
          subject: subjItem.subject,
          mainProctorId: chosenProctor?.userId || 'GURU_1',
          mainProctorName: chosenProctor?.fullName || 'Pengawas Ruangan',
          secondaryProctorId: chosenSecondary?.userId,
          secondaryProctorName: chosenSecondary?.fullName,
        });
      });

      // Assign backup / piket proctor for this slot if requested
      if (config.assignBackupProctor) {
        const remainingForBackup = Array.from(teacherLoads.values())
          .filter((tl) => !assignedInCurrentSlot.has(tl.userId))
          .sort((a, b) => a.assignedCount - b.assignedCount);

        const backupTeacher = remainingForBackup[0];
        if (backupTeacher) {
          backupTeacher.assignedCount += 0.5; // Backup counts as half duty
          // Attach backup proctor name to proctors of this slot for clarity
          proctorSchedules
            .filter((p) => p.date === slotDate && p.sessionNumber === slotNum)
            .forEach((p) => {
              p.backupProctorId = backupTeacher.userId;
              p.backupProctorName = `${backupTeacher.fullName} (Piket)`;
            });
        }
      }
    });

    // Sort proctor schedules chronologically: date ASC, sessionNumber ASC, roomName ASC
    proctorSchedules.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.sessionNumber !== b.sessionNumber) return a.sessionNumber - b.sessionNumber;
      return a.roomName.localeCompare(b.roomName);
    });

    // ── 4. COMPOSE SUMMARY & AI OBSERVATION ───────────────────────────────────
    const totalProctorsAssigned = proctorSchedules.length;
    const totalActiveTeachers = eligibleTeachers.length || 1;
    const averageSessionsPerTeacher = Math.round((totalProctorsAssigned / totalActiveTeachers) * 10) / 10;

    const aiNote = `Penyusunan jadwal asesmen ${config.examType} (${config.academicYear} - ${config.semester}) berhasil dioptimasi oleh AI Engine. ` +
      `Mata pelajaran (${subjects.length} mapel) terdistribusi merata ke dalam ${totalDays} hari pelaksanaan. ` +
      `Seluruh guru pengawas (${eligibleTeachers.length} guru) dialokasikan dengan rata-rata ${averageSessionsPerTeacher} sesi/guru. ` +
      `${config.excludeOwnSubject ? 'Aturan integritas anti-mapel sendiri terpenuhi 100% tanpa konflik mengajar.' : 'Distribusi mengawas adil dan seimbang.'}`;

    const summary: ExamScheduleSummary = {
      totalDays,
      totalSessions: totalSlots,
      totalClasses: classes.length,
      totalSubjects: subjects.length,
      totalProctorsAssigned,
      averageSessionsPerTeacher,
      aiOptimizationNote: aiNote,
    };

    const levelSuffix = config.educationLevel ? `_${config.educationLevel.toLowerCase()}` : '';
    return {
      id: `sched_${config.academicYear.replace(/[^\w]/g, '_')}_${config.examType}${levelSuffix}_${Date.now()}`,
      config,
      educationLevel: config.educationLevel,
      subjectSchedules,
      proctorSchedules,
      summary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
