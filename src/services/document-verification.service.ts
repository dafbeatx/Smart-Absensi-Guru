// src/services/document-verification.service.ts
// Client service for issuing server HMAC document signatures and verifying QR links fail-closed.

import { buildAuthenticatedFetchOptions, detectClientPlatformHeader, resolveClientAuthToken } from '../utils/api-auth.utils';

export interface SignedDocumentTokenResult {
  docNo: string;
  type: string;
  month: string;
  year: string;
  iat: string;
  sig: string;
  docHash: string;
  verifyUrl: string;
}

export interface DocumentVerificationResponse {
  verified: boolean;
  status: 'VALID' | 'INVALID';
  reasonCode: string;
  reason: string;
  document?: {
    docNo: string;
    type: string;
    month: string;
    year: string;
    teacher: string | null;
    school: string;
    schoolLevel: 'SMP' | 'SMA';
    address: string;
    signatory: string;
    signatoryNpp: string | null;
    iat: number | null;
    verifiedAt: string;
    fingerprint: string;
  };
}

export function resolveReportBaseUrl(): string {
  if (
    typeof window !== 'undefined' &&
    window.location?.origin &&
    !window.location.origin.includes('localhost') &&
    window.location.origin !== 'null' &&
    !window.location.protocol.startsWith('file') &&
    !window.location.protocol.startsWith('capacitor')
  ) {
    return window.location.origin;
  }
  return 'https://smart-absensi-guru-eight.vercel.app';
}

export function buildVerifyDocumentUrl(
  baseUrl: string,
  params: {
    docNo: string;
    type: string;
    month: string;
    year: string;
    teacher?: string;
    school: string;
    signatory: string;
    iat?: string;
    sig?: string;
  }
): string {
  const qs = new URLSearchParams();
  qs.set('no', params.docNo);
  qs.set('type', params.type);
  qs.set('month', params.month);
  qs.set('year', params.year);
  if (params.teacher) {
    qs.set('teacher', params.teacher);
  }
  qs.set('school', params.school);
  qs.set('signatory', params.signatory);
  if (params.iat) qs.set('iat', params.iat);
  if (params.sig) qs.set('sig', params.sig);

  return `${baseUrl}/verify-document?${qs.toString()}`;
}

export class DocumentVerificationService {
  /**
   * Requests a cryptographic server signature from /api/admin/teaching-schedules?action=issue_document_token
   * when the staff user holds an authenticated session. Returns null if offline/unauthenticated.
   */
  public static async issueDocumentSignature(params: {
    docNo: string;
    docCode?: string;
    docId?: string;
    type: string;
    month: string;
    year: string;
    teacher?: string;
    school: string;
    signatory: string;
  }): Promise<SignedDocumentTokenResult | null> {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
      return null;
    }
    const token = resolveClientAuthToken();
    if (!token) {
      return null;
    }

    try {
      const resp = await fetch(
        '/api/admin/teaching-schedules?action=issue_document_token',
        buildAuthenticatedFetchOptions(
          'POST',
          {
            action: 'issue_document_token',
            docNo: params.docNo,
            docCode: params.docCode || params.docNo,
            docId: params.docId,
            type: params.type,
            month: params.month,
            year: params.year,
            teacher: params.teacher,
            school: params.school,
            signatory: params.signatory,
          },
          token
        )
      );

      if (!resp.ok) {
        return null;
      }

      const json = await resp.json().catch(() => null);
      if (!json?.success || !json?.sig || !json?.iat) {
        return null;
      }

      const baseUrl = resolveReportBaseUrl();
      const verifyUrl = buildVerifyDocumentUrl(baseUrl, {
        docNo: params.docNo,
        type: params.type,
        month: params.month,
        year: params.year,
        teacher: params.teacher,
        school: params.school,
        signatory: params.signatory,
        iat: String(json.iat),
        sig: String(json.sig),
      });

      return {
        docNo: params.docNo,
        type: params.type,
        month: params.month,
        year: params.year,
        iat: String(json.iat),
        sig: String(json.sig),
        docHash: String(json.docHash || ''),
        verifyUrl,
      };
    } catch {
      return null;
    }
  }

  /**
   * Verifies document authenticity fail-closed against the backend endpoint.
   */
  public static async verifyDocumentRemote(params: {
    docNo?: string;
    code?: string;
    docId?: string;
    type?: string;
    month?: string;
    year?: string;
    teacher?: string;
    school?: string;
    signatory?: string;
    iat?: string;
    sig?: string;
  }): Promise<DocumentVerificationResponse> {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
      return {
        verified: false,
        status: 'INVALID',
        reasonCode: 'CLIENT_UNAVAILABLE',
        reason: 'Layanan verifikasi dokumen hanya tersedia melalui jaringan aktif.',
      };
    }

    const qs = new URLSearchParams();
    qs.set('action', 'verify_document');
    if (params.docNo) qs.set('no', params.docNo);
    if (params.code) qs.set('code', params.code);
    if (params.docId) qs.set('docId', params.docId);
    if (params.type) qs.set('type', params.type);
    if (params.month) qs.set('month', params.month);
    if (params.year) qs.set('year', params.year);
    if (params.teacher) qs.set('teacher', params.teacher);
    if (params.school) qs.set('school', params.school);
    if (params.signatory) qs.set('signatory', params.signatory);
    if (params.iat) qs.set('iat', params.iat);
    if (params.sig) qs.set('sig', params.sig);

    try {
      const resp = await fetch(`/api/admin/teaching-schedules?${qs.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'X-SAGA-Platform': detectClientPlatformHeader(),
        },
      });

      const json = await resp.json().catch(() => null);
      if (!json || typeof json.verified !== 'boolean') {
        return {
          verified: false,
          status: 'INVALID',
          reasonCode: 'INVALID_SERVER_RESPONSE',
          reason: 'Respons verifikasi dari server tidak valid.',
        };
      }

      return {
        verified: json.verified === true,
        status: json.verified === true ? 'VALID' : 'INVALID',
        reasonCode: String(json.reasonCode || (json.verified ? 'VERIFIED' : 'INVALID')),
        reason: String(json.reason || (json.verified ? 'Dokumen sah.' : 'Data dokumen tidak terverifikasi.')),
        document: json.document,
      };
    } catch {
      return {
        verified: false,
        status: 'INVALID',
        reasonCode: 'SERVER_UNREACHABLE',
        reason: 'Gagal menghubungi server verifikasi dokumen. Pastikan koneksi internet aktif.',
      };
    }
  }
}
