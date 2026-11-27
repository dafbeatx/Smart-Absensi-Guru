/**
 * SMART ABSENSI GURU - ORAL EXAM (UJIAN LISAN) REPOSITORY
 * Menyimpan dan mengelola seluruh data sesi & nilai penilaian ujian lisan
 * langsung di Supabase Cloud melalui ProviderFactory (zero localStorage agar tidak pernah hilang).
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
import { ProviderFactory } from '../providers/provider-factory';

export const ORAL_EXAM_CHANGED_EVENT = 'smart_absensi_oral_exam_changed';

export class OralExamRepository {
  /**
   * Mengambil semua sesi ujian lisan dari Supabase Cloud (atau MockProvider saat testing),
   * dengan opsi filter tahun ajaran.
   */
  public static async getAllSessions(academicYear?: string, token?: string): Promise<OralExamSession[]> {
    const provider = ProviderFactory.getProvider();
    if (provider.getOralExamSessions) {
      const sessions = await provider.getOralExamSessions(academicYear, token);
      return Array.isArray(sessions) ? sessions : [];
    }
    return [];
  }

  /**
   * Mengambil satu sesi berdasarkan ID secara akurat dari database cloud.
   */
  public static async getSessionById(
    id: string,
    academicYear?: string,
    token?: string
  ): Promise<OralExamSession | null> {
    const all = await this.getAllSessions(academicYear, token);
    return all.find((s) => s.id === id) || null;
  }

  /**
   * Menyimpan atau memperbarui sesi & seluruh nilai ujian lisan ke Supabase Cloud.
   */
  public static async saveSession(session: OralExamSession, token?: string): Promise<OralExamSession> {
    const now = new Date().toISOString();
    const sessionToSave: OralExamSession = {
      ...session,
      updatedAt: now,
      createdAt: session.createdAt || now,
    };

    const provider = ProviderFactory.getProvider();
    if (!provider.saveOralExamSession) {
      throw new Error('Penyedia penyimpanan Supabase Ujian Lisan belum tersedia.');
    }

    const saved = await provider.saveOralExamSession(sessionToSave, token);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(ORAL_EXAM_CHANGED_EVENT, { detail: { sessionId: saved.id } })
      );
    }

    return saved;
  }

  /**
   * Menghapus sesi ujian lisan dari Supabase Cloud.
   */
  public static async deleteSession(id: string, token?: string): Promise<boolean> {
    const provider = ProviderFactory.getProvider();
    if (!provider.deleteOralExamSession) {
      return false;
    }

    const ok = await provider.deleteOralExamSession(id, token);
    if (ok && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(ORAL_EXAM_CHANGED_EVENT, { detail: { sessionId: id } })
      );
    }
    return ok;
  }

  /**
   * Helper pembuat sesi baru beserta peserta terdaftar lalu menyimpannya ke Supabase Cloud.
   */
  public static async createNewSession(
    params: {
      templateType: OralExamTemplateType;
      subjectScope?: OralExamSubjectScope;
      groupId?: string | null;
      title: string;
      academicYear: string;
      semester: 'GANJIL' | 'GENAP';
      examinerUserId?: string | null;
      examinerName: string;
      examinerNpp?: string | null;
      roomNumber?: string;
      className: string;
      date: string;
      students: Array<{ studentId: string; studentName: string; nisn?: string; className?: string }>;
    },
    token?: string
  ): Promise<OralExamSession> {
    const now = new Date().toISOString();
    const id = `oral_session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const initialStudents: OralExamStudentRecord[] = params.students.map((st) => {
      if (params.templateType === 'BAHASA_INGGRIS_ARAB') {
        return {
          studentId: st.studentId,
          studentName: st.studentName,
          nisn: st.nisn,
          className: st.className || params.className,
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
      ...(params.examinerUserId !== undefined ? { examinerUserId: params.examinerUserId } : {}),
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

    return this.saveSession(newSession, token);
  }

  /**
   * Mencari sesi ujian lisan yang sesuai penugasan Admin di Supabase untuk penguji & track (BAHASA / BTQ),
   * atau langsung membuatnya secara otomatis tanpa langkah manual dari guru.
   * Jika Admin memperbarui penugasan siswa/ruang/scope, nilai siswa yang sudah tersimpan di cloud tetap dipertahankan.
   */
  public static async openOrSyncAssignedSession(
    params: {
      assignment: OralExamAssignment;
      track: OralExamTrack;
      academicYear: string;
      semester: 'GANJIL' | 'GENAP';
      examinerNpp?: string | null;
      date: string;
    },
    token?: string
  ): Promise<OralExamSession> {
    const { assignment, track, academicYear, semester, examinerNpp, date } = params;
    const templateType: OralExamTemplateType =
      track === 'BAHASA' ? 'BAHASA_INGGRIS_ARAB' : 'BTQ_HAFALAN';
    const subjectScope: OralExamSubjectScope =
      track === 'BAHASA' ? assignment.bahasaScope : assignment.btqScope;

    const allSessions = await this.getAllSessions(academicYear, token);
    const existing = allSessions.find(
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
      return this.createNewSession(
        {
          templateType,
          subjectScope,
          groupId: assignment.id,
          title: defaultTitle,
          academicYear,
          semester,
          examinerUserId: assignment.examinerUserId ?? null,
          examinerName: assignment.examinerName,
          examinerNpp: examinerNpp ?? assignment.examinerNpp ?? null,
          roomNumber: assignment.roomNumber,
          className: assignment.className,
          date,
          students: assignment.students,
        },
        token
      );
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
      examinerUserId: assignment.examinerUserId ?? existing.examinerUserId ?? null,
      examinerName: assignment.examinerName,
      examinerNpp: examinerNpp ?? assignment.examinerNpp ?? existing.examinerNpp ?? null,
      roomNumber: assignment.roomNumber,
      className: assignment.className,
      students: syncedStudents,
    };

    return this.saveSession(syncedSession, token);
  }
}
