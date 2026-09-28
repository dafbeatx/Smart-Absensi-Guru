// src/types/meeting-minutes.types.ts

export type MeetingType =
  | 'DEWAN_GURU'
  | 'KURIKULUM'
  | 'KESISWAAN'
  | 'KOMITE'
  | 'EVALUASI'
  | 'KEDISIPLINAN'
  | 'LAINNYA';

export interface MeetingActionItem {
  id: string;
  task: string;
  pic: string;
  deadline?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface MeetingFormattedContent {
  executiveSummary: string;
  agendaPoints: string[];
  keyDecisions: string[];
  actionItems: MeetingActionItem[];
  additionalNotes?: string;
}

export interface MeetingMinute {
  id: string;
  title: string;
  meetingType: MeetingType;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location: string;
  leaderName: string;
  secretaryName: string;
  attendeesSummary?: string;
  roughNotes: string;
  formattedContent: MeetingFormattedContent;
  status: 'DRAFT' | 'PUBLISHED';
  readBy: string[]; // List of user IDs who have read this notulen
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMeetingMinuteDTO {
  title: string;
  meetingType: MeetingType;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  leaderName: string;
  secretaryName: string;
  attendeesSummary?: string;
  roughNotes: string;
  formattedContent?: Partial<MeetingFormattedContent>;
  status?: 'DRAFT' | 'PUBLISHED';
}

export const MEETING_TYPE_LABELS: Record<MeetingType, { label: string; badgeClass: string; icon: string }> = {
  DEWAN_GURU: {
    label: 'Rapat Dewan Guru',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
    icon: '👥',
  },
  KURIKULUM: {
    label: 'Rapat Kurikulum & KBM',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    icon: '📚',
  },
  KESISWAAN: {
    label: 'Rapat Kesiswaan & Tatib',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: '🎯',
  },
  KOMITE: {
    label: 'Rapat Komite & Orang Tua',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    icon: '🏛️',
  },
  EVALUASI: {
    label: 'Rapat Evaluasi Bulanan',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    icon: '📊',
  },
  KEDISIPLINAN: {
    label: 'Rapat Khusus Disiplin',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    icon: '⚖️',
  },
  LAINNYA: {
    label: 'Rapat Koordinasi Khusus',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
    icon: '📝',
  },
};
