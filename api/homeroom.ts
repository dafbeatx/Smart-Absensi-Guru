// api/homeroom.ts
// Consolidated Serverless Homeroom Endpoint for Smart Absensi Guru (SAGA)
// Serves /api/homeroom/:action endpoints while remaining within Vercel Hobby plan 12-function quota

import overviewHandler from './_shared/homeroom/overview.js';
import studentsHandler from './_shared/homeroom/students.js';
import studentDetailHandler from './_shared/homeroom/student-detail.js';
import verifyPlanHandler from './_shared/homeroom/verify-plan.js';
import documentDownloadHandler from './_shared/homeroom/document-download.js';

export {
  overviewHandler,
  studentsHandler,
  studentDetailHandler,
  verifyPlanHandler,
  documentDownloadHandler,
};

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Resolve action from query params (Vercel rewrite: /api/homeroom/:action -> /api/homeroom?action=:action)
  let action = req.query?.action as string | undefined;

  // 2. Fallback: Parse action from pathname if query param not present
  if (!action && req.url) {
    const pathname = req.url.split('?')[0];
    const segments = pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && last !== 'homeroom') {
      action = last;
    }
  }

  switch (action) {
    case 'overview':
      return overviewHandler(req, res);
    case 'students':
      return studentsHandler(req, res);
    case 'student-detail':
      return studentDetailHandler(req, res);
    case 'verify-plan':
      return verifyPlanHandler(req, res);
    case 'document-download':
      return documentDownloadHandler(req, res);
    default:
      return res.status(404).json({
        success: false,
        errorCode: 'ENDPOINT_NOT_FOUND',
        errorMessage: `Aksi homeroom "${action || 'unknown'}" tidak ditemukan.`,
      });
  }
}
