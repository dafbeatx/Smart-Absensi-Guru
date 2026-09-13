// src/types/homeroom.types.ts
// Domain Types for Ruang Wali Kelas (Homeroom) & Student Continuation Plans

export type ContinuationType =
  | 'SMA_NEGERI'
  | 'SMA_SWASTA'
  | 'SMK_NEGERI'
  | 'SMK_SWASTA'
  | 'MA_NEGERI'
  | 'MA_SWASTA'
  | 'PONDOK_PESANTREN'
  | 'LUAR_DAERAH'
  | 'BELUM_MENENTUKAN';

export type PlanStatus =
  | 'draft'
  | 'submitted'
  | 'pending_verification'
  | 'needs_revision'
  | 'verified';

export interface HomeroomStats {
  draft: number;
  submitted: number;
  pendingVerification: number;
  verified: number;
  needsRevision: number;
  parentAgreed: number;
}

export interface HomeroomOverview {
  teacherId: string;
  teacherName: string;
  teacherRole: string;
  assignedClass: string;
  academicYear: string;
  targetGraduationYear: number;
  totalStudents: number;
  completionRate: number;
  stats: HomeroomStats;
}

export interface StudentPlanSummary {
  id: string | null;
  continuationType: ContinuationType;
  status: PlanStatus;
  parentAgreement: boolean;
  submittedAt: string | null;
  verifiedAt: string | null;
  revisionNote: string | null;
  firstChoice: {
    schoolName: string;
    schoolType?: string;
    majorName?: string | null;
  } | null;
}

export interface HomeroomStudentItem {
  id: string;
  nis: string | null;
  nisn: string | null;
  fullName: string;
  className: string;
  gender: 'L' | 'P' | string | null;
  photoUrl: string | null;
  plan: StudentPlanSummary;
}

export interface StudentSchoolChoiceItem {
  id: string;
  priority: number;
  schoolName: string;
  schoolType: string;
  majorName: string | null;
  registrationTrack: string | null;
  notes: string | null;
}

export interface StudentInterestItem {
  id: string;
  interestField: string;
  reason: string | null;
  careerGoal: string | null;
}

export interface StudentAchievementItem {
  id: string;
  achievementTitle: string;
  achievementType: string;
  level: string | null;
  year: number | null;
  organizer: string | null;
}

export interface StudentDocumentItem {
  id: string;
  studentId: string;
  documentType: string;
  versionNumber: number;
  isActive: boolean;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  status: string;
  verificationNotes: string | null;
  createdAt: string;
}

export interface StudentVerificationLogItem {
  id: string;
  action: string;
  performedByType: string;
  performedByUserId: string;
  actorName: string;
  note: string | null;
  createdAt: string;
}

export interface StudentPlanDetail {
  student: {
    id: string;
    nis: string | null;
    nisn: string | null;
    fullName: string;
    className: string;
    gender: string | null;
    photoUrl: string | null;
  };
  plan: {
    id: string;
    academicYear: string;
    graduationYear: number;
    continuationType: ContinuationType;
    status: PlanStatus;
    submittedAt: string | null;
    verifiedAt: string | null;
    verifiedByName: string | null;
    revisionNote: string | null;
    parentAgreement: boolean;
  } | null;
  choices: StudentSchoolChoiceItem[];
  interests: StudentInterestItem[];
  achievements: StudentAchievementItem[];
  documents: StudentDocumentItem[];
  verificationLogs: StudentVerificationLogItem[];
}

export interface VerifyPlanDTO {
  plan_id: string;
  decision: 'verified' | 'needs_revision';
  notes?: string;
}

export interface VerifyPlanResult {
  success: boolean;
  message: string;
  result?: any;
}

export interface MasterSchool {
  id: string;
  npsn: string | null;
  name: string;
  type: string;
  status: 'NEGERI' | 'SWASTA';
  city: string;
}

export interface MasterSmkMajor {
  id: string;
  code: string;
  name: string;
  field: string;
}

export interface SaveStudentPlanDTO {
  student_id: string;
  continuation_type: ContinuationType;
  parent_agreement: boolean;
  first_choice_school_name?: string;
  first_choice_major_name?: string;
  second_choice_school_name?: string;
  second_choice_major_name?: string;
  parent_notes?: string;
}

export interface UploadStudentDocumentDTO {
  student_id: string;
  document_type: string;
  file_base64: string;
  file_name: string;
  mime_type: string;
}

export interface UploadDocumentResult {
  success: boolean;
  message: string;
  document?: StudentDocumentItem;
}
