/**
 * SMART ABSENSI GURU - ORAL EXAM (UJIAN LISAN) REPOSITORY
 * Menyimpan dan mengelola data sesi penilaian ujian lisan dengan persistensi lokal aman.
 */

import type {
  OralExamSession,
  OralExamTemplateType,
  OralExamStudentRecord,
} from '../types/oral-exam.types';
import { calculateChecklistScoreAndPredicate } from '../utils/oral-exam-scoring.utils';

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
    title: string;
    academicYear: string;
    semester: 'GANJIL' | 'GENAP';
    examinerName: string;
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
        const engCalc = calculateChecklistScoreAndPredicate(defaultEnglishChecklist, 15);
        const arabCalc = calculateChecklistScoreAndPredicate(defaultArabicChecklist, 15);

        return {
          studentId: st.studentId,
          studentName: st.studentName,
          nisn: st.nisn,
          className: st.className || params.className,
          englishChecklist: defaultEnglishChecklist,
          englishCorrectCount: engCalc.correctCount,
          englishScore: engCalc.score,
          englishPredicate: engCalc.predicate,
          arabicChecklist: defaultArabicChecklist,
          arabicCorrectCount: arabCalc.correctCount,
          arabicScore: arabCalc.score,
          arabicPredicate: arabCalc.predicate,
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
      title: params.title,
      academicYear: params.academicYear,
      semester: params.semester,
      examinerName: params.examinerName,
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
}
