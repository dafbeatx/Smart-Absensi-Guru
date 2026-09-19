// api/_shared/homeroom-auth.ts
// Serverless Homeroom Authorization Middleware for Smart Absensi Guru (SAGA)
// Enforces database-verified homeroom assignments (public.homeroom_assignments)
// Built strictly on top of server-verifiable session token (saga_sess_)

import { authenticateUser, serverSupabase, type AuthenticatedUser } from './session-auth.js';

export interface HomeroomAuthSuccessContext {
  ok: true;
  userId: string;
  user: AuthenticatedUser;
  role: string;
  assignedClass: string;
  academicYear: string;
  targetGraduationYear: number;
  assignmentId?: string;
  isPrivileged: boolean;
  isReadOnly: boolean;
}

export interface HomeroomAuthErrorContext {
  ok: false;
  status: number;
  errorCode:
    | 'AUTH_SESSION_MISSING'
    | 'AUTH_SESSION_INVALID'
    | 'AUTH_SESSION_REVOKED'
    | 'AUTH_SESSION_EXPIRED'
    | 'AUTH_USER_INACTIVE'
    | 'AUTH_FORBIDDEN_NOT_HOMEROOM'
    | 'AUTH_FORBIDDEN_CLASS_MISMATCH'
    | 'AUTH_FORBIDDEN_ROLE';
  errorMessage: string;
}

export type HomeroomAuthContext = HomeroomAuthSuccessContext | HomeroomAuthErrorContext;

/**
 * Normalizes class strings for safe comparison (e.g. '9A', '9-A', 'IX-A', 'Kelas 9A')
 */
export function normalizeClassName(name: string | null | undefined): string {
  if (!name) return '';
  return String(name)
    .toUpperCase()
    .replace(/^KELAS\s+/i, '')
    .replace(/^KLS\s+/i, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Authenticates the user and verifies that they hold active homeroom authority for the given class
 */
export async function authenticateHomeroomTeacher(
  req: any,
  requestedClassName?: string
): Promise<HomeroomAuthContext> {
  // 1. Validasi sesi dasar melalui session middleware
  const auth = await authenticateUser(req);
  if (!auth.ok) {
    return auth;
  }

  const { userId, user, role } = auth;
  const normalizedRole = (role || '').toUpperCase();

  // 2. Privileged Access: ADMIN, OPERATOR, KEPSEK
  if (['ADMIN', 'OPERATOR', 'KEPSEK'].includes(normalizedRole)) {
    const isReadOnly = normalizedRole === 'KEPSEK';
    return {
      ok: true,
      userId,
      user,
      role: normalizedRole,
      assignedClass: requestedClassName || 'ALL',
      academicYear: '2026/2027',
      targetGraduationYear: 2027,
      isPrivileged: true,
      isReadOnly,
    };
  }

  // 3. Hak Akses Guru: Wajib tercatat sebagai wali kelas aktif di public.homeroom_assignments
  if (normalizedRole === 'GURU') {
    try {
      const { data: assignment, error } = await serverSupabase
        .from('homeroom_assignments')
        .select('id, teacher_id, class_name, academic_year, target_graduation_year, is_active')
        .eq('teacher_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !assignment) {
        return {
          ok: false,
          status: 403,
          errorCode: 'AUTH_FORBIDDEN_NOT_HOMEROOM',
          errorMessage: 'Akses Ditolak: Anda tidak terdaftar sebagai wali kelas aktif untuk rombel ini.',
        };
      }

      // Validasi kesesuaian rombel jika parameter spesifik diminta
      if (requestedClassName && requestedClassName !== 'ALL') {
        const normAssigned = normalizeClassName(assignment.class_name);
        const normRequested = normalizeClassName(requestedClassName);

        if (normAssigned !== normRequested) {
          return {
            ok: false,
            status: 403,
            errorCode: 'AUTH_FORBIDDEN_CLASS_MISMATCH',
            errorMessage: `Akses Ditolak: Anda adalah wali kelas untuk rombel ${assignment.class_name}, bukan ${requestedClassName}.`,
          };
        }
      }

      return {
        ok: true,
        userId,
        user,
        role: normalizedRole,
        assignedClass: assignment.class_name,
        academicYear: assignment.academic_year || '2026/2027',
        targetGraduationYear: assignment.target_graduation_year || 2027,
        assignmentId: assignment.id,
        isPrivileged: false,
        isReadOnly: false,
      };
    } catch {
      return {
        ok: false,
        status: 500,
        errorCode: 'AUTH_FORBIDDEN_NOT_HOMEROOM',
        errorMessage: 'Gagal memverifikasi wewenang wali kelas di server.',
      };
    }
  }

  return {
    ok: false,
    status: 403,
    errorCode: 'AUTH_FORBIDDEN_ROLE',
    errorMessage: 'Role pengguna tidak memiliki izin mengakses Ruang Wali Kelas.',
  };
}
