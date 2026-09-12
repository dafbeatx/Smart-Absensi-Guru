/**
 * SMART ABSENSI GURU - IN-APP FEATURE & MENU USAGE TRAFFIC TYPES
 * Pelacakan penggunaan fitur dan menu di dalam website Smart-Absensi-Guru (100% internal).
 */

export type TrafficCategory =
  | 'AKADEMIK_NILAI'
  | 'PRESENSI_ABSENSI'
  | 'KESISWAAN_KARAKTER'
  | 'KOMUNIKASI_LAYANAN'
  | 'LAINNYA';

export interface WebTrafficLog {
  id: string;
  user_id: string;
  user_name: string;
  user_npp: string;
  user_role: string;
  feature_id: string;
  feature_name: string;
  feature_icon?: string;
  category: TrafficCategory;
  accessed_at: string;
  device: string;
  duration_seconds?: number;
  // Aliases for compatibility
  website_name?: string;
  domain?: string;
  url?: string;
}

export interface FeatureTrafficSummary {
  feature_id: string;
  feature_name: string;
  feature_icon?: string;
  category: TrafficCategory;
  total_visits: number;
  unique_teachers: number;
  percentage: number;
  last_accessed_at: string;
  top_users?: { user_id: string; user_name: string; count: number }[];
  // Backwards compatibility aliases
  domain?: string;
  website_name?: string;
}

export type WebsiteTrafficSummary = FeatureTrafficSummary;

export interface TeacherTrafficSummary {
  user_id: string;
  user_name: string;
  user_npp: string;
  user_role: string;
  total_visits: number;
  top_feature: string;
  top_website?: string;
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
  topFeature: FeatureTrafficSummary | null;
  topWebsite?: FeatureTrafficSummary | null;
  mostActiveTeacher: TeacherTrafficSummary | null;
  topCategory: { category: TrafficCategory; label: string; count: number } | null;
  categoryDistribution: CategoryDistribution[];
  hourlyTrend: HourlyTrafficPoint[];
  topFeatures: FeatureTrafficSummary[];
  topWebsites?: FeatureTrafficSummary[];
  teacherSummaries: TeacherTrafficSummary[];
}
