/**
 * SMART ABSENSI GURU - ORAL EXAM (UJIAN LISAN) REPOSITORY
 * Menyimpan dan mengelola data sesi penilaian ujian lisan dengan persistensi lokal aman.
 */

import {
  getOralExamSessionTrack,
  type OralExamAssignment,
  type OralExamSession,
  type OralExamTemplateType,
  type OralExamStudentRecord,
  type OralExamSubjectScope,
  type OralExamTrack,
} from '../types/oral-exam.types';

export const ORAL_EXAM_STORAGE_KEY = 'smart_absensi_oral_exam_sessions_v1';
export const ORAL_EXAM_CHANGED_EVENT = 'smart_absensi_oral_exam_changed';

const memoryStore = new Map<string, string>();

const safeGetStorage = (key: string): string | null => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {
    // Memory fallback
  }
  return memoryStore.get(key) || null;
};

const safeSetStorage = (key: string, value: string): void => {
  memoryStore.set(key, value);
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Memory fallback
  }
};

export class OralExamRepository {
  /**
   * Mengambil semua sesi ujian lisan, dengan opsi filter tahun ajaran.
   */
  public static getAllSessions(academicYear?: string): OralExamSession[] {
    const raw = safeGetStorage(ORAL_EXAM_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed: OralExamSession[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      if (academicYear) {
        return parsed.filter((s) => s.academicYear === academicYear);
      }
      return parsed;
    } catch {
      return [];
    }
  }

  /**
   * Mengambil sesi berdasarkan ID.
   */
  public static getSessionById(id: string): OralExamSession | null {
    const all = this.getAllSessions();
    return all.find((s) => s.id === id) || null;
  }

  /**
   * Menyimpan atau memperbarui sesi ujian lisan.
   */
  public static saveSession(session: OralExamSession): OralExamSession {
    const all = this.getAllSessions();
    const existingIndex = all.findIndex((s) => s.id === session.id);

    const now = new Date().toISOString();
    const sessionToSave: OralExamSession = {
      ...session,
      updatedAt: now,
      createdAt: session.createdAt || now,
    };

    if (existingIndex >= 0) {
      all[existingIndex] = sessionToSave;
    } else {
      all.unshift(sessionToSave);
    }

    safeSetStorage(ORAL_EXAM_STORAGE_KEY, JSON.stringify(all));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(ORAL_EXAM_CHANGED_EVENT, { detail: { sessionId: session.id } })
      );
    }

    return sessionToSave;
  }

  /**
   * Menghapus sesi ujian lisan.
   */
  public static deleteSession(id: string): boolean {
    const all = this.getAllSessions();
    const filtered = all.filter((s) => s.id !== id);
    if (filtered.length === all.length) return false;

    safeSetStorage(ORAL_EXAM_STORAGE_KEY, JSON.stringify(filtered));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(ORAL_EXAM_CHANGED_EVENT, { detail: { sessionId: id } })
      );
    }
    return true;
  }

  /**
   * Helper pembuat sesi baru dengan siswa yang terdaftar.
   */
  public static createNewSession(params: {
    templateType: OralExamTemplateType;
    subjectScope?: OralExamSubjectScope;
    groupId?: string | null;
    title: string;
    academicYear: string;
    semester: 'GANJIL' | 'GENAP';
    examinerName: string;
    examinerNpp?: string | null;
    roomNumber?: string;
    className: string;
    date: string;
    students: Array<{ studentId: string; studentName: string; nisn?: string; className?: string }>;
  }): OralExamSession {
    const now = new Date().toISOString();
    const id = `oral_session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const initialStudents: OralExamStudentRecord[] = params.students.map((st) => {
      if (params.templateType === 'BAHASA_INGGRIS_ARAB') {
        const defaultEnglishChecklist = new Array(15).fill(false);
        const defaultArabicChecklist = new Array(15).fill(false);

        return {
          studentId: st.studentId,
          studentName: st.studentName,
          nisn: st.nisn,
          className: st.className || params.className,
          englishChecklist: defaultEnglishChecklist,
          englishCorrectCount: null,
          englishScore: null,
          englishPredicate: null,
          englishAssessed: false,
          arabicChecklist: defaultArabicChecklist,
          arabicCorrectCount: null,
          arabicScore: null,
          arabicPredicate: null,
          arabicAssessed: false,
        };
      }

      // Default BTQ & Hafalan
      return {
        studentId: st.studentId,
        studentName: st.studentName,
        nisn: st.nisn,
        className: st.className || params.className,
        btqScore: null,
        btqPredicate: null,
        hafalanScore: null,
        hafalanPredicate: null,
      };
    });

    const newSession: OralExamSession = {
      id,
      templateType: params.templateType,
      ...(params.subjectScope ? { subjectScope: params.subjectScope } : {}),
      ...(params.groupId !== undefined ? { groupId: params.groupId } : {}),
      title: params.title,
      academicYear: params.academicYear,
      semester: params.semester,
      examinerName: params.examinerName,
      examinerNpp: params.examinerNpp ?? null,
      roomNumber: params.roomNumber || 'Ruang 01',
      className: params.className,
      date: params.date,
      totalQuestions: 15,
      students: initialStudents,
      createdAt: now,
      updatedAt: now,
    };

    return this.saveSession(newSession);
  }

  /**
   * Mencari sesi ujian lisan yang sesuai penugasan Admin untuk penguji & track (BAHASA / BTQ),
   * atau langsung membuatnya secara otomatis tanpa langkah manual dari guru.
   * Jika Admin memperbarui penugasan siswa/ruang/scope, nilai siswa yang sudah ada tetap dipertahankan.
   */
  public static openOrSyncAssignedSession(params: {
    assignment: OralExamAssignment;
    track: OralExamTrack;
    academicYear: string;
    semester: 'GANJIL' | 'GENAP';
    examinerNpp?: string | null;
    date: string;
  }): OralExamSession {
    const { assignment, track, academicYear, semester, examinerNpp, date } = params;
    const templateType: OralExamTemplateType =
      track === 'BAHASA' ? 'BAHASA_INGGRIS_ARAB' : 'BTQ_HAFALAN';
    const subjectScope: OralExamSubjectScope =
      track === 'BAHASA' ? assignment.bahasaScope : assignment.btqScope;

    const existing = this.getAllSessions(academicYear).find(
      (s) => s.groupId === assignment.id && getOralExamSessionTrack(s) === track
    );

    const scopeLabel =
      track === 'BAHASA'
        ? (subjectScope === 'ENGLISH_ONLY'
            ? 'Bahasa Inggris'
            : subjectScope === 'ARABIC_ONLY'
              ? 'Bahasa Arab'
              : 'Bahasa Inggris & Arab')
        : (subjectScope === 'BTQ_ONLY'
            ? 'BTQ'
            : subjectScope === 'HAFALAN_ONLY'
              ? 'Hafalan'
              : 'BTQ & Hafalan');
    const classLabel = assignment.className === 'SMA' ? 'SMA' : `Kelas ${assignment.className}`;
    const defaultTitle = `Ujian Lisan ${scopeLabel} - ${classLabel}`;

    if (!existing) {
      return this.createNewSession({
        templateType,
        subjectScope,
        groupId: assignment.id,
        title: defaultTitle,
        academicYear,
        semester,
        examinerName: assignment.examinerName,
        examinerNpp: examinerNpp ?? assignment.examinerNpp ?? null,
        roomNumber: assignment.roomNumber,
        className: assignment.className,
        date,
        students: assignment.students,
      });
    }

    const existingById = new Map(existing.students.map((st) => [st.studentId, st]));
    const existingByName = new Map(
      existing.students.map((st) => [st.studentName.trim().toLowerCase(), st])
    );

    const syncedStudents: OralExamStudentRecord[] = assignment.students.map((as) => {
      const matched =
        existingById.get(as.studentId) ||
        existingByName.get(as.studentName.trim().toLowerCase());

      if (matched) {
        return {
          ...matched,
          studentId: as.studentId,
          studentName: as.studentName,
          nisn: as.nisn ?? matched.nisn,
          className: as.className || assignment.className,
        };
      }

      if (templateType === 'BAHASA_INGGRIS_ARAB') {
        return {
          studentId: as.studentId,
          studentName: as.studentName,
          nisn: as.nisn,
          className: as.className || assignment.className,
          englishChecklist: new Array(15).fill(false),
          englishCorrectCount: null,
          englishScore: null,
          englishPredicate: null,
          englishAssessed: false,
          arabicChecklist: new Array(15).fill(false),
          arabicCorrectCount: null,
          arabicScore: null,
          arabicPredicate: null,
          arabicAssessed: false,
        };
      }

      return {
        studentId: as.studentId,
        studentName: as.studentName,
        nisn: as.nisn,
        className: as.className || assignment.className,
        btqScore: null,
        btqPredicate: null,
        hafalanScore: null,
        hafalanPredicate: null,
      };
    });

    const syncedSession: OralExamSession = {
      ...existing,
      subjectScope,
      examinerName: assignment.examinerName,
      roomNumber: assignment.roomNumber,
      className: assignment.className,
      students: syncedStudents,
    };

    return this.saveSession(syncedSession);
  }
}
