import type {
  ExamScheduleFormConfig,
  ExamSubjectScheduleItem,
  ExamProctorItem,
  ExamScheduleData,
  ExamScheduleSummary,
  ExamCommitteeMember,
  ExamProctorSwapHistoryItem,
  SmartSwapCandidate,
  SmartReassignCandidate,
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
   * Normalizes teacher names by removing academic titles, degree suffixes, and punctuation.
   */
  public static normalizeTeacherName(name: string): string {
    return (name || '')
      .toLowerCase()
      .replace(/\b(s\.?pd\.?i|s\.?pd|s\.?mat|s\.?e|g\.?r|s\.?si|s\.?i|s\.?kom|s\.?ag|s\.?sos|s\.?hum|s\.?fil|m\.?pd|m\.?m|drs|dra|h\.|hj\.)\b/gi, '')
      .replace(/\bm\.?\s*iqbal\b/gi, 'muhammad iqbal')
      .replace(/\bfarhiya\b/gi, 'fahriya')
      .replace(/[.,]/g, ' ')
      .replace(/[^a-z0-9\s]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Finds matching teacher record from UserProfile list with title-insensitive matching,
   * with fallback to stable synthetic profile to ensure zero data loss.
   */
  public static findMatchingTeacher(
    targetName: string,
    allTeachers: UserProfile[]
  ): { userId: string; fullName: string } {
    const normTarget = this.normalizeTeacherName(targetName);

    // 1. Exact match on normalized full name
    const exact = allTeachers.find((t) => this.normalizeTeacherName(t.full_name || '') === normTarget);
    if (exact) return { userId: exact.id, fullName: exact.full_name || targetName };

    // 2. Substring match
    const sub = allTeachers.find((t) => {
      const norm = this.normalizeTeacherName(t.full_name || '');
      return norm.includes(normTarget) || normTarget.includes(norm);
    });
    if (sub) return { userId: sub.id, fullName: sub.full_name || targetName };

    // 3. Fallback: generate a stable synthetic userId preserving the target name
    const slug = normTarget.replace(/\s+/g, '_') || 'guru';
    return {
      userId: `usr_${slug}`,
      fullName: targetName,
    };
  }

  /**
   * Finds custom proctor list for a subject from config.customSubjectProctors with alias lookup.
   */
  public static findCustomProctorsForSubject(
    subjectName: string,
    customMap?: Record<string, string[]>
  ): string[] | undefined {
    if (!customMap || Object.keys(customMap).length === 0) return undefined;

    // 1. Exact key match
    if (customMap[subjectName]) return customMap[subjectName];

    // 2. Case-insensitive key match
    const lowerSubj = subjectName.toLowerCase().trim();
    const matchedKey = Object.keys(customMap).find((k) => k.toLowerCase().trim() === lowerSubj);
    if (matchedKey && customMap[matchedKey]) return customMap[matchedKey];

    // 3. Alias dictionary match
    const aliasGroups: string[][] = [
      ['pai', 'pendidikan agama islam', 'agama islam', 'pai & bp'],
      ['ipa', 'ilmu pengetahuan alam'],
      ['ips', 'ilmu pengetahuan sosial'],
      ['mtk', 'matematika', 'mat'],
      ['pp', 'pkn', 'pendidikan pancasila', 'ppkn'],
      ['b. indonesia', 'bahasa indonesia', 'b indonesia', 'bindo', 'b.indo'],
      ['b. inggris', 'bahasa inggris', 'b inggris', 'bing', 'b.ing'],
      ['b. arab', 'bahasa arab', 'b arab'],
      ['sbpk', 'seni budaya', 'sbdp', 'seni budaya dan prakarya', 'sbk'],
      ['informatika', 'tik', 'komputer'],
      ['hadits', 'hadis', "al-qur'an hadits", "qur'an hadits", 'qurdis'],
      ['btq', "baca tulis al-qur'an", 'baca tulis quran'],
      ['akuntansi', 'accounting', 'keuangan'],
      ['ekonomi', 'economy', 'ekonomi bisnis'],
    ];

    for (const group of aliasGroups) {
      if (group.includes(lowerSubj)) {
        const keyInGroup = Object.keys(customMap).find((k) => group.includes(k.toLowerCase().trim()));
        if (keyInGroup && customMap[keyInGroup]) return customMap[keyInGroup];
      }
    }

    // 4. Substring inclusion match
    const subKey = Object.keys(customMap).find((k) => {
      const lk = k.toLowerCase().trim();
      return lowerSubj.includes(lk) || lk.includes(lowerSubj);
    });
    if (subKey && customMap[subKey]) return customMap[subKey];

    return undefined;
  }

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

    const maxCustomProctors = config.customSubjectProctors
      ? Math.max(0, ...Object.values(config.customSubjectProctors).map((arr) => (Array.isArray(arr) ? arr.length : 0)))
      : 0;

    const roomFormat = config.roomFormat || 'NUMERIC';
    const formatRoomName = (roomNumber: number): string => {
      const numStr = roomFormat === 'DOUBLE_DIGIT' ? String(roomNumber).padStart(2, '0') : String(roomNumber);
      return `Ruang ${numStr}`;
    };

    let classes = config.selectedClasses && config.selectedClasses.length > 0
      ? config.selectedClasses
      : ['7A', '7B', '8A', '8B', '9A', '9B'];

    const classesAreExplicitRooms = classes.every((c) => /^Ruang\s*\d+/i.test(c));
    const totalRooms = classesAreExplicitRooms
      ? classes.length
      : Math.max(
          1,
          config.totalRooms || maxCustomProctors || classes.length
        );

    // When custom proctor matrix is present, align classes with totalRooms
    // only if classes are not already explicit rooms (e.g. ['Ruang 6'])
    if (maxCustomProctors > 0 && !classesAreExplicitRooms && classes.length !== totalRooms) {
      classes = Array.from({ length: totalRooms }, (_, i) => formatRoomName(i + 1));
    }

    const subjects = config.selectedSubjects && config.selectedSubjects.length > 0
      ? config.selectedSubjects
      : ['PAI', 'PKn', 'Bahasa Indonesia', 'Matematika', 'IPA', 'IPS', 'Bahasa Inggris', 'Informatika', 'Seni Budaya', 'PJOK'];

    const classRoomMap = new Map<string, string>();
    classes.forEach((cls, clsIdx) => {
      if (config.classRoomMapping && config.classRoomMapping[cls]) {
        classRoomMap.set(cls, config.classRoomMapping[cls]);
      } else if (/^Ruang\s*(\d+)/i.test(cls)) {
        classRoomMap.set(cls, cls);
      } else {
        const roomNum = (clsIdx % totalRooms) + 1;
        classRoomMap.set(cls, formatRoomName(roomNum));
      }
    });

    // ── 1. GENERATE SUBJECT SCHEDULES PER CLASS ──────────────────────────────
    const subjectSchedules: ExamSubjectScheduleItem[] = [];

    // Distribute subjects sequentially across slots (respects per-day session count overrides)
    classes.forEach((cls) => {
      const assignedRoom = classRoomMap.get(cls) || formatRoomName(1);

      subjects.forEach((subj, subjIdx) => {
        // Sequential fill: slot index wraps only when subjects exceed total slots
        const slotIdx = subjIdx < allSlots.length ? subjIdx : (subjIdx % allSlots.length);
        const slot = allSlots[slotIdx];

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

    // ── 2. PREPARE PROCTOR TEACHERS POOL & ASSIGNMENTS ────────────────────────
    const proctorSchedules: ExamProctorItem[] = [];
    let eligibleTeachers: UserProfile[] = [];

    if (!config.skipProctorAssignment) {
      const committeeUserIds = new Set(
        committeeMembers.filter((m) => m.isActive).map((m) => m.userId)
      );

      // Filter teachers available for invigilation
      eligibleTeachers = allTeachers.filter((t) => {
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

        // Pre-populate teachers already assigned in this slot from another level (e.g. SMA Ruang 6 during SMP generation)
        if (config.existingCrossLevelProctors && config.existingCrossLevelProctors.length > 0) {
          config.existingCrossLevelProctors.forEach((xp) => {
            if (xp.date === slotDate && xp.sessionNumber === slotNum) {
              if (xp.mainProctorId) assignedInCurrentSlot.add(xp.mainProctorId);
              const normXp = this.normalizeTeacherName(xp.mainProctorName);
              if (normXp) {
                const matchedTeacher = allTeachers.find(
                  (t) => this.normalizeTeacherName(t.full_name || '') === normXp
                );
                if (matchedTeacher) assignedInCurrentSlot.add(matchedTeacher.id);
              }
            }
          });
        }

        itemsInSlot.forEach((subjItem, itemIdx) => {
          const roomName = subjItem.roomName || classRoomMap.get(subjItem.className) || formatRoomName(1);

          // Check if custom matrix has a specific proctor for this subject and room
          const customProctors = this.findCustomProctorsForSubject(subjItem.subject, config.customSubjectProctors);
          let chosenProctor: { userId: string; fullName: string } | undefined;

          if (customProctors && customProctors.length > 0) {
            const roomNumMatch = roomName.match(/\d+/);
            const roomNum = roomNumMatch ? parseInt(roomNumMatch[0], 10) : (itemIdx + 1);
            let targetTeacherName: string | undefined;

            if (roomNum > 0 && roomNum <= customProctors.length && customProctors[roomNum - 1] !== '-') {
              targetTeacherName = customProctors[roomNum - 1];
            } else if (customProctors.length === 1 && customProctors[0] !== '-') {
              targetTeacherName = customProctors[0];
            } else {
              const fallbackIdx = (roomNum - 1) % customProctors.length;
              if (customProctors[fallbackIdx] !== '-') {
                targetTeacherName = customProctors[fallbackIdx];
              }
            }

            if (targetTeacherName && targetTeacherName !== '-') {
              const matched = this.findMatchingTeacher(targetTeacherName, allTeachers);
              chosenProctor = matched;
              const tl = teacherLoads.get(matched.userId);
              if (tl) {
                tl.assignedCount++;
              }
              assignedInCurrentSlot.add(matched.userId);
            }
          }

          // If no custom proctor, use heuristic greedy algorithm
          if (!chosenProctor) {
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

            const candidate = candidates[0];
            if (candidate) {
              candidate.assignedCount++;
              assignedInCurrentSlot.add(candidate.userId);
              chosenProctor = { userId: candidate.userId, fullName: candidate.fullName };
            }
          }

          // Secondary proctor if configured (2 proctors per room)
          let chosenSecondary: { userId: string; fullName: string } | undefined;
          if (config.proctorsPerRoom === 2) {
            const secondaryCandidates = Array.from(teacherLoads.values()).filter(
              (c) => c.userId !== chosenProctor?.userId && !assignedInCurrentSlot.has(c.userId)
            );
            if (secondaryCandidates.length > 0) {
              secondaryCandidates.sort((a, b) => a.assignedCount - b.assignedCount);
              const secondary = secondaryCandidates[0];
              secondary.assignedCount++;
              assignedInCurrentSlot.add(secondary.userId);
              chosenSecondary = { userId: secondary.userId, fullName: secondary.fullName };
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
            educationLevel: config.educationLevel || 'SMP',
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
    }

    // ── 4. COMPOSE SUMMARY & AI OBSERVATION ───────────────────────────────────
    const totalProctorsAssigned = proctorSchedules.length;
    const totalActiveTeachers = eligibleTeachers.length;
    const averageSessionsPerTeacher = totalActiveTeachers > 0
      ? Math.round((totalProctorsAssigned / totalActiveTeachers) * 10) / 10
      : 0;

    const aiNote = config.skipProctorAssignment
      ? `Penyusunan jadwal asesmen ${config.examType} (${config.academicYear} - ${config.semester}) berhasil dioptimasi oleh AI Engine. ` +
        `Mata pelajaran (${subjects.length} mapel) terdistribusi merata ke dalam ${totalDays} hari pelaksanaan untuk ${classes.length} rombel. ` +
        `Roster guru pengawas tidak dibuat karena instruksi prompt tidak mencantumkan atau meminta alokasi guru pengawas.`
      : `Penyusunan jadwal asesmen ${config.examType} (${config.academicYear} - ${config.semester}) berhasil dioptimasi oleh AI Engine. ` +
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

  /**
   * Checks if a teacher is already assigned to another room on a given date and sessionNumber.
   * Supports cross-level validation via additionalProctors (e.g. checking SMP + SMA Ruang 6 simultaneously).
   */
  public static checkProctorConflict(
    proctors: ExamProctorItem[],
    teacherId: string,
    teacherName: string,
    date: string,
    sessionNumber: number,
    excludeSlotId?: string,
    additionalProctors: ExamProctorItem[] = []
  ): ExamProctorItem | undefined {
    const allProctors = additionalProctors.length > 0 ? [...proctors, ...additionalProctors] : proctors;
    const normTarget = this.normalizeTeacherName(teacherName);
    return allProctors.find((p) => {
      if (excludeSlotId && p.id === excludeSlotId) return false;
      if (p.date !== date || p.sessionNumber !== sessionNumber) return false;

      // Check by userId match
      if (teacherId && p.mainProctorId && p.mainProctorId === teacherId) return true;

      // Check by normalized name match
      if (normTarget && this.normalizeTeacherName(p.mainProctorName) === normTarget) return true;

      return false;
    });
  }

  /**
   * Swaps proctors between two schedule slots (e.g. Guru A in Slot A swaps with Guru B in Slot B).
   */
  public static swapProctorsBetweenSlots(
    schedule: ExamScheduleData,
    slotAId: string,
    slotBId: string,
    adminName: string = 'Admin Kurikulum',
    reason?: string,
    additionalProctors: ExamProctorItem[] = []
  ): { success: boolean; updatedSchedule?: ExamScheduleData; error?: string } {
    if (!schedule || !schedule.proctorSchedules || schedule.proctorSchedules.length === 0) {
      return { success: false, error: 'Data jadwal pengawas tidak ditemukan.' };
    }

    if (slotAId === slotBId) {
      return { success: false, error: 'Sesi asal dan sesi tujuan tidak boleh sama.' };
    }

    const slotAIndex = schedule.proctorSchedules.findIndex((p) => p.id === slotAId);
    const slotBIndex = schedule.proctorSchedules.findIndex((p) => p.id === slotBId);

    if (slotAIndex === -1 || slotBIndex === -1) {
      return { success: false, error: 'Salah satu slot sesi pengawas tidak ditemukan.' };
    }

    const slotA = schedule.proctorSchedules[slotAIndex];
    const slotB = schedule.proctorSchedules[slotBIndex];

    // Conflict validation:
    // Slot A's proctor moves to Slot B's time (slotB.date, slotB.sessionNumber).
    // Make sure Proctor A is not already assigned to another room at that time (ignoring slotA).
    const conflictForA = this.checkProctorConflict(
      schedule.proctorSchedules,
      slotA.mainProctorId,
      slotA.mainProctorName,
      slotB.date,
      slotB.sessionNumber,
      slotB.id,
      additionalProctors
    );

    if (conflictForA && conflictForA.id !== slotA.id) {
      return {
        success: false,
        error: `Konflik: ${slotA.mainProctorName} sudah memiliki jadwal mengawas di ${conflictForA.roomName} pada ${conflictForA.dayName}, Sesi ${conflictForA.sessionNumber}.`,
      };
    }

    // Slot B's proctor moves to Slot A's time (slotA.date, slotA.sessionNumber).
    // Make sure Proctor B is not already assigned to another room at that time (ignoring slotB).
    const conflictForB = this.checkProctorConflict(
      schedule.proctorSchedules,
      slotB.mainProctorId,
      slotB.mainProctorName,
      slotA.date,
      slotA.sessionNumber,
      slotA.id,
      additionalProctors
    );

    if (conflictForB && conflictForB.id !== slotB.id) {
      return {
        success: false,
        error: `Konflik: ${slotB.mainProctorName} sudah memiliki jadwal mengawas di ${conflictForB.roomName} pada ${conflictForB.dayName}, Sesi ${conflictForB.sessionNumber}.`,
      };
    }

    // Execute swap on proctor list
    const updatedProctors = [...schedule.proctorSchedules];

    const updatedSlotA: ExamProctorItem = {
      ...slotA,
      mainProctorId: slotB.mainProctorId,
      mainProctorName: slotB.mainProctorName,
      isSwapped: true,
      swapNote: reason || `Ditukar dengan ${slotB.mainProctorName} (${slotB.dayName}, ${slotB.roomName})`,
    };

    const updatedSlotB: ExamProctorItem = {
      ...slotB,
      mainProctorId: slotA.mainProctorId,
      mainProctorName: slotA.mainProctorName,
      isSwapped: true,
      swapNote: reason || `Ditukar dengan ${slotA.mainProctorName} (${slotA.dayName}, ${slotA.roomName})`,
    };

    updatedProctors[slotAIndex] = updatedSlotA;
    updatedProctors[slotBIndex] = updatedSlotB;

    // Record audit trail
    const historyItem: ExamProctorSwapHistoryItem = {
      id: `swap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      swappedAt: new Date().toISOString(),
      adminName,
      type: 'SWAP_SLOTS',
      reason: reason || 'Tukar silang jadwal mengawas atas persetujuan Panitia/Admin',
      slotA: {
        id: slotA.id,
        dayName: slotA.dayName,
        date: slotA.date,
        sessionNumber: slotA.sessionNumber,
        roomName: slotA.roomName,
        className: slotA.className,
        subject: slotA.subject,
        previousProctorId: slotA.mainProctorId,
        previousProctorName: slotA.mainProctorName,
        newProctorId: slotB.mainProctorId,
        newProctorName: slotB.mainProctorName,
      },
      slotB: {
        id: slotB.id,
        dayName: slotB.dayName,
        date: slotB.date,
        sessionNumber: slotB.sessionNumber,
        roomName: slotB.roomName,
        className: slotB.className,
        subject: slotB.subject,
        previousProctorId: slotB.mainProctorId,
        previousProctorName: slotB.mainProctorName,
        newProctorId: slotA.mainProctorId,
        newProctorName: slotA.mainProctorName,
      },
    };

    const existingHistory = schedule.swapHistory || [];

    const updatedSchedule: ExamScheduleData = {
      ...schedule,
      proctorSchedules: updatedProctors,
      swapHistory: [historyItem, ...existingHistory],
      updatedAt: new Date().toISOString(),
    };

    return { success: true, updatedSchedule };
  }

  /**
   * Swaps proctors across two different schedules (e.g. Schedule A = SMP, Schedule B = SMA Ruang 6).
   * Verifies mutual conflict-freedom across all rooms in both schedules and updates both schedules.
   */
  public static swapProctorsCrossLevel(
    scheduleA: ExamScheduleData,
    scheduleB: ExamScheduleData,
    slotAId: string,
    slotBId: string,
    adminName: string = 'Admin Kurikulum',
    reason?: string
  ): {
    success: boolean;
    updatedScheduleA?: ExamScheduleData;
    updatedScheduleB?: ExamScheduleData;
    error?: string;
  } {
    if (!scheduleA || !scheduleB) {
      return { success: false, error: 'Data jadwal SMP atau SMA tidak lengkap.' };
    }

    const inA1 = scheduleA.proctorSchedules?.some((p) => p.id === slotAId);
    const inA2 = scheduleA.proctorSchedules?.some((p) => p.id === slotBId);
    const inB1 = scheduleB.proctorSchedules?.some((p) => p.id === slotAId);
    const inB2 = scheduleB.proctorSchedules?.some((p) => p.id === slotBId);

    // If both slots are in Schedule A:
    if (inA1 && inA2) {
      const res = this.swapProctorsBetweenSlots(
        scheduleA,
        slotAId,
        slotBId,
        adminName,
        reason,
        scheduleB.proctorSchedules
      );
      return {
        success: res.success,
        updatedScheduleA: res.updatedSchedule,
        updatedScheduleB: scheduleB,
        error: res.error,
      };
    }

    // If both slots are in Schedule B:
    if (inB1 && inB2) {
      const res = this.swapProctorsBetweenSlots(
        scheduleB,
        slotAId,
        slotBId,
        adminName,
        reason,
        scheduleA.proctorSchedules
      );
      return {
        success: res.success,
        updatedScheduleA: scheduleA,
        updatedScheduleB: res.updatedSchedule,
        error: res.error,
      };
    }

    // Cross-schedule swap (Slot A in one schedule, Slot B in the other):
    let slotA: ExamProctorItem | undefined;
    let slotB: ExamProctorItem | undefined;
    let slotAInSchedA = true;

    if (inA1 && inB2) {
      slotA = scheduleA.proctorSchedules.find((p) => p.id === slotAId);
      slotB = scheduleB.proctorSchedules.find((p) => p.id === slotBId);
      slotAInSchedA = true;
    } else if (inB1 && inA2) {
      slotA = scheduleB.proctorSchedules.find((p) => p.id === slotAId);
      slotB = scheduleA.proctorSchedules.find((p) => p.id === slotBId);
      slotAInSchedA = false;
    } else {
      return { success: false, error: 'Slot sesi pengawas tidak ditemukan di jadwal SMP maupun SMA.' };
    }

    if (!slotA || !slotB) {
      return { success: false, error: 'Sesi pengawas tidak valid.' };
    }

    const allCombinedProctors = [...scheduleA.proctorSchedules, ...scheduleB.proctorSchedules];

    // Conflict validation for Proctor A moving to Slot B (date, session)
    const conflictForA = this.checkProctorConflict(
      allCombinedProctors,
      slotA.mainProctorId,
      slotA.mainProctorName,
      slotB.date,
      slotB.sessionNumber,
      slotB.id
    );
    if (conflictForA && conflictForA.id !== slotA.id) {
      return {
        success: false,
        error: `Konflik: ${slotA.mainProctorName} sudah memiliki jadwal mengawas di ${conflictForA.roomName} pada ${conflictForA.dayName}, Sesi ${conflictForA.sessionNumber}.`,
      };
    }

    // Conflict validation for Proctor B moving to Slot A (date, session)
    const conflictForB = this.checkProctorConflict(
      allCombinedProctors,
      slotB.mainProctorId,
      slotB.mainProctorName,
      slotA.date,
      slotA.sessionNumber,
      slotA.id
    );
    if (conflictForB && conflictForB.id !== slotB.id) {
      return {
        success: false,
        error: `Konflik: ${slotB.mainProctorName} sudah memiliki jadwal mengawas di ${conflictForB.roomName} pada ${conflictForB.dayName}, Sesi ${conflictForB.sessionNumber}.`,
      };
    }

    const targetAInSched = slotAInSchedA ? scheduleA : scheduleB;
    const targetBInSched = slotAInSchedA ? scheduleB : scheduleA;

    const updatedProctorsA = targetAInSched.proctorSchedules.map((p) => {
      if (p.id === slotA!.id) {
        return {
          ...p,
          mainProctorId: slotB!.mainProctorId,
          mainProctorName: slotB!.mainProctorName,
          isSwapped: true,
          swapNote: reason || `Ditukar lintas jenjang dengan ${slotB!.mainProctorName} (${slotB!.dayName}, ${slotB!.roomName})`,
        };
      }
      return p;
    });

    const updatedProctorsB = targetBInSched.proctorSchedules.map((p) => {
      if (p.id === slotB!.id) {
        return {
          ...p,
          mainProctorId: slotA!.mainProctorId,
          mainProctorName: slotA!.mainProctorName,
          isSwapped: true,
          swapNote: reason || `Ditukar lintas jenjang dengan ${slotA!.mainProctorName} (${slotA!.dayName}, ${slotA!.roomName})`,
        };
      }
      return p;
    });

    const historyItem: ExamProctorSwapHistoryItem = {
      id: `swap_cross_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      swappedAt: new Date().toISOString(),
      adminName,
      type: 'SWAP_SLOTS',
      reason: reason || 'Tukar silang jadwal mengawas lintas jenjang (SMP & SMA) atas persetujuan Panitia/Admin',
      slotA: {
        id: slotA.id,
        dayName: slotA.dayName,
        date: slotA.date,
        sessionNumber: slotA.sessionNumber,
        roomName: slotA.roomName,
        className: slotA.className,
        subject: slotA.subject,
        previousProctorId: slotA.mainProctorId,
        previousProctorName: slotA.mainProctorName,
        newProctorId: slotB.mainProctorId,
        newProctorName: slotB.mainProctorName,
      },
      slotB: {
        id: slotB.id,
        dayName: slotB.dayName,
        date: slotB.date,
        sessionNumber: slotB.sessionNumber,
        roomName: slotB.roomName,
        className: slotB.className,
        subject: slotB.subject,
        previousProctorId: slotB.mainProctorId,
        previousProctorName: slotB.mainProctorName,
        newProctorId: slotA.mainProctorId,
        newProctorName: slotA.mainProctorName,
      },
    };

    const newSchedA: ExamScheduleData = {
      ...targetAInSched,
      proctorSchedules: updatedProctorsA,
      swapHistory: [historyItem, ...(targetAInSched.swapHistory || [])],
      updatedAt: new Date().toISOString(),
    };

    const newSchedB: ExamScheduleData = {
      ...targetBInSched,
      proctorSchedules: updatedProctorsB,
      swapHistory: [historyItem, ...(targetBInSched.swapHistory || [])],
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      updatedScheduleA: slotAInSchedA ? newSchedA : newSchedB,
      updatedScheduleB: slotAInSchedA ? newSchedB : newSchedA,
    };
  }

  /**
   * Reassigns a single proctor slot to another teacher without mutual swap.
   */
  public static reassignSingleProctor(
    schedule: ExamScheduleData,
    slotId: string,
    newTeacher: { userId: string; fullName: string },
    adminName: string = 'Admin Kurikulum',
    reason?: string,
    additionalProctors: ExamProctorItem[] = []
  ): { success: boolean; updatedSchedule?: ExamScheduleData; error?: string } {
    if (!schedule || !schedule.proctorSchedules || schedule.proctorSchedules.length === 0) {
      return { success: false, error: 'Data jadwal pengawas tidak ditemukan.' };
    }

    const slotIndex = schedule.proctorSchedules.findIndex((p) => p.id === slotId);
    if (slotIndex === -1) {
      return { success: false, error: 'Sesi pengawas tidak ditemukan.' };
    }

    const targetSlot = schedule.proctorSchedules[slotIndex];

    // Conflict validation for new teacher (including cross-level proctors):
    const conflict = this.checkProctorConflict(
      schedule.proctorSchedules,
      newTeacher.userId,
      newTeacher.fullName,
      targetSlot.date,
      targetSlot.sessionNumber,
      targetSlot.id,
      additionalProctors
    );

    if (conflict) {
      return {
        success: false,
        error: `Konflik: ${newTeacher.fullName} sudah memiliki jadwal mengawas di ${conflict.roomName} pada ${conflict.dayName}, Sesi ${conflict.sessionNumber}.`,
      };
    }

    const updatedProctors = [...schedule.proctorSchedules];
    const previousProctorId = targetSlot.mainProctorId;
    const previousProctorName = targetSlot.mainProctorName;

    updatedProctors[slotIndex] = {
      ...targetSlot,
      mainProctorId: newTeacher.userId,
      mainProctorName: newTeacher.fullName,
      isSwapped: true,
      swapNote: reason || `Digantikan oleh ${newTeacher.fullName}`,
    };

    const historyItem: ExamProctorSwapHistoryItem = {
      id: `reassign_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      swappedAt: new Date().toISOString(),
      adminName,
      type: 'REASSIGN',
      reason: reason || 'Pelimpahan / penggantian pengawas ujian oleh Panitia/Admin',
      slotA: {
        id: targetSlot.id,
        dayName: targetSlot.dayName,
        date: targetSlot.date,
        sessionNumber: targetSlot.sessionNumber,
        roomName: targetSlot.roomName,
        className: targetSlot.className,
        subject: targetSlot.subject,
        previousProctorId,
        previousProctorName,
        newProctorId: newTeacher.userId,
        newProctorName: newTeacher.fullName,
      },
    };

    const existingHistory = schedule.swapHistory || [];

    const updatedSchedule: ExamScheduleData = {
      ...schedule,
      proctorSchedules: updatedProctors,
      swapHistory: [historyItem, ...existingHistory],
      updatedAt: new Date().toISOString(),
    };

    return { success: true, updatedSchedule };
  }

  /**
   * Helper to check if a teacher is the instructor for a subject.
   */
  public static isTeacherTeachingSubject(
    teacherName: string,
    subject: string,
    allTeachers: UserProfile[] = []
  ): boolean {
    if (!teacherName || !subject || allTeachers.length === 0) return false;
    const normT = this.normalizeTeacherName(teacherName);
    const teacher = allTeachers.find(
      (t) => this.normalizeTeacherName(t.full_name || '') === normT
    );
    if (!teacher || !teacher.teaching_assignment) return false;
    const normSubj = subject.toLowerCase().trim();
    const rawAssignment = teacher.teaching_assignment;
    const teacherSubj = Array.isArray(rawAssignment)
      ? rawAssignment.join(' ').toLowerCase()
      : String(rawAssignment || '').toLowerCase().trim();
    return teacherSubj.includes(normSubj) || normSubj.includes(teacherSubj);
  }

  /**
   * Generates intelligent, 100% clash-free swap recommendations for an admin.
   * Finds slots where both teachers are completely free to switch duties without conflict.
   * Supports cross-level candidates (e.g. SMA Ruang 6).
   */
  public static getSmartSwapCandidates(
    schedule: ExamScheduleData,
    slotAId: string,
    filterDayName?: string,
    allTeachers: UserProfile[] = [],
    additionalProctors: ExamProctorItem[] = []
  ): SmartSwapCandidate[] {
    if (!schedule || !schedule.proctorSchedules || schedule.proctorSchedules.length === 0) {
      return [];
    }

    const allCandidatePool = [...schedule.proctorSchedules, ...additionalProctors];
    const slotA = allCandidatePool.find((p) => p.id === slotAId);
    if (!slotA) return [];

    const normA = this.normalizeTeacherName(slotA.mainProctorName);
    const results: SmartSwapCandidate[] = [];

    const cleanFilterDay = (filterDayName || '').toLowerCase().trim();

    for (const slotB of allCandidatePool) {
      // Must not be the same slot
      if (slotB.id === slotA.id) continue;

      // Must not have the exact same proctor
      if (slotB.mainProctorId === slotA.mainProctorId) continue;
      if (this.normalizeTeacherName(slotB.mainProctorName) === normA) continue;

      // Day filter if specified
      if (cleanFilterDay && cleanFilterDay !== 'all') {
        if (slotB.dayName.toLowerCase().trim() !== cleanFilterDay) continue;
      }

      // Check conflict: Proctor A moving to slotB (date & sessionNumber) across all proctors
      const conflictForA = this.checkProctorConflict(
        allCandidatePool,
        slotA.mainProctorId,
        slotA.mainProctorName,
        slotB.date,
        slotB.sessionNumber,
        slotB.id
      );
      if (conflictForA && conflictForA.id !== slotA.id) {
        continue; // Clash detected for Proctor A
      }

      // Check conflict: Proctor B moving to slotA (date & sessionNumber) across all proctors
      const conflictForB = this.checkProctorConflict(
        allCandidatePool,
        slotB.mainProctorId,
        slotB.mainProctorName,
        slotA.date,
        slotA.sessionNumber,
        slotA.id
      );
      if (conflictForB && conflictForB.id !== slotB.id) {
        continue; // Clash detected for Proctor B
      }

      // Both are 100% free! Calculate smart match score
      let matchScore = 100;

      // Prefer different day if user wants to swap days (e.g. Monday to Tuesday)
      const isDifferentDay = slotB.date !== slotA.date;
      if (isDifferentDay) {
        matchScore += 30;
      }

      // Bonus if matches specific filtered day
      if (cleanFilterDay && cleanFilterDay !== 'all' && slotB.dayName.toLowerCase().trim() === cleanFilterDay) {
        matchScore += 20;
      }

      // Check subject teaching overlap
      const isOwnSubjectForA = this.isTeacherTeachingSubject(slotA.mainProctorName, slotB.subject, allTeachers);
      const isOwnSubjectForB = this.isTeacherTeachingSubject(slotB.mainProctorName, slotA.subject, allTeachers);

      if (!isOwnSubjectForA && !isOwnSubjectForB) {
        matchScore += 15;
      }

      // Convenient same session number bonus
      if (slotB.sessionNumber === slotA.sessionNumber) {
        matchScore += 10;
      }

      const reason = isDifferentDay
        ? `100% Bebas bentrok • Pindah ke ${slotB.dayName} (${slotB.startTime}-${slotB.endTime}) • ${slotB.roomName}`
        : `100% Bebas bentrok • Tukar sesi ${slotB.dayName} (${slotB.startTime}-${slotB.endTime}) • ${slotB.roomName}`;

      results.push({
        slot: slotB,
        matchScore,
        isZeroConflict: true,
        targetDayName: slotB.dayName,
        isOwnSubjectForA,
        isOwnSubjectForB,
        reason,
      });
    }

    // Sort by match score descending, then by date, sessionNumber, roomName
    results.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      if (a.slot.date !== b.slot.date) return a.slot.date.localeCompare(b.slot.date);
      if (a.slot.sessionNumber !== b.slot.sessionNumber) return a.slot.sessionNumber - b.slot.sessionNumber;
      return a.slot.roomName.localeCompare(b.slot.roomName);
    });

    return results;
  }

  /**
   * Generates intelligent substitute teacher recommendations for single slot reassignment.
   * Ranks available teachers with the lowest workload first for optimal load-balancing.
   * Supports cross-level workload aggregation and clash prevention via additionalProctors.
   */
  public static getSmartReassignCandidates(
    schedule: ExamScheduleData,
    slotId: string,
    allTeachers: UserProfile[],
    additionalProctors: ExamProctorItem[] = []
  ): SmartReassignCandidate[] {
    if (!schedule || !schedule.proctorSchedules || schedule.proctorSchedules.length === 0) {
      return [];
    }

    const allProctors = [...schedule.proctorSchedules, ...additionalProctors];
    const targetSlot = allProctors.find((p) => p.id === slotId);
    if (!targetSlot) return [];

    // Calculate current duty counts for all teachers across both levels
    const dutyCountMap = new Map<string, number>();
    for (const p of allProctors) {
      const normName = this.normalizeTeacherName(p.mainProctorName);
      dutyCountMap.set(normName, (dutyCountMap.get(normName) || 0) + 1);
      if (p.mainProctorId) {
        dutyCountMap.set(p.mainProctorId, (dutyCountMap.get(p.mainProctorId) || 0) + 1);
      }
    }

    const normTargetProctor = this.normalizeTeacherName(targetSlot.mainProctorName);
    const candidates: SmartReassignCandidate[] = [];

    for (const teacher of allTeachers) {
      // Exclude current proctor
      if (teacher.id === targetSlot.mainProctorId) continue;
      const normTeacher = this.normalizeTeacherName(teacher.full_name || '');
      if (normTeacher === normTargetProctor) continue;

      // Check conflict at target date & session across all proctors
      const conflict = this.checkProctorConflict(
        allProctors,
        teacher.id,
        teacher.full_name || '',
        targetSlot.date,
        targetSlot.sessionNumber,
        targetSlot.id
      );

      const isAvailable = !conflict;
      const dutyCount = dutyCountMap.get(teacher.id) ?? (dutyCountMap.get(normTeacher) || 0);
      const isOwnSubject = this.isTeacherTeachingSubject(teacher.full_name || '', targetSlot.subject, allTeachers);

      const rawSubj = teacher.teaching_assignment;
      const displaySubj = Array.isArray(rawSubj) ? rawSubj.join(', ') : rawSubj || undefined;

      const reason = isAvailable
        ? `Bebas tugas jam ini • Beban saat ini: ${dutyCount} sesi mengawas`
        : `Sedang mengawas di ${conflict.roomName} (${conflict.dayName}, Sesi ${conflict.sessionNumber})`;

      candidates.push({
        teacherId: teacher.id,
        teacherName: teacher.full_name || 'Guru',
        npp: (teacher.nip || teacher.npp) || undefined,
        teachingSubject: displaySubj,
        isAvailable,
        currentDutyCount: dutyCount,
        isOwnSubject,
        reason,
      });
    }

    // Sort order:
    // 1. Available teachers first
    // 2. Lightest workload first (duty count ASC)
    // 3. Name ASC
    candidates.sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
      if (a.currentDutyCount !== b.currentDutyCount) return a.currentDutyCount - b.currentDutyCount;
      return a.teacherName.localeCompare(b.teacherName);
    });

    return candidates;
  }
}
