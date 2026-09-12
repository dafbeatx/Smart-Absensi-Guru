/**
 * SMART ABSENSI GURU - WEB TRAFFIC & ACTIVITY TRACKING TYPES
 */

export type TrafficCategory =
  | 'KURIKULUM_PMM'
  | 'PENILAIAN_RAPOR'
  | 'MEDIA_KBM'
  | 'ADMINISTRASI'
  | 'REFERENSI'
  | 'LAINNYA';

export interface WebTrafficLog {
  id: string;
  user_id: string;
  user_name: string;
  user_npp: string;
  user_role: string;
  website_name: string;
  domain: string;
  url: string;
  category: TrafficCategory;
  accessed_at: string;
  device: string;
  duration_seconds?: number;
}

export interface WebsiteTrafficSummary {
  domain: string;
  website_name: string;
  category: TrafficCategory;
  total_visits: number;
  unique_teachers: number;
  percentage: number;
  last_accessed_at: string;
  top_users?: { user_id: string; user_name: string; count: number }[];
}

export interface TeacherTrafficSummary {
  user_id: string;
  user_name: string;
  user_npp: string;
  user_role: string;
  total_visits: number;
  top_website: string;
  top_category: TrafficCategory;
  last_accessed_at: string;
}

export interface TrafficFilterOptions {
  dateRange: 'TODAY' | '7_DAYS' | '30_DAYS' | 'ALL';
  teacherId?: string;
  category?: TrafficCategory | 'ALL';
  searchQuery?: string;
}

export interface CategoryDistribution {
  category: TrafficCategory;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface HourlyTrafficPoint {
  hour: string;
  count: number;
}

export interface TrafficAnalyticsSummary {
  totalVisits: number;
  topWebsite: WebsiteTrafficSummary | null;
  mostActiveTeacher: TeacherTrafficSummary | null;
  topCategory: { category: TrafficCategory; label: string; count: number } | null;
  categoryDistribution: CategoryDistribution[];
  hourlyTrend: HourlyTrafficPoint[];
  topWebsites: WebsiteTrafficSummary[];
  teacherSummaries: TeacherTrafficSummary[];
}
