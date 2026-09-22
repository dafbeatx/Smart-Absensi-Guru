/**
 * SMART ABSENSI GURU — EXAM SCHEDULE & PROCTOR AI GENERATOR SERVICE
 * Generates conflict-free exam subject schedules and fair proctor rosters
 * from natural language prompts using Serverless AI (/api/ai) with a robust
 * local Indonesian NLP heuristic fallback engine.
 */

import type {
  ExamScheduleFormConfig,
  ExamScheduleData,
  ExamType,
  SessionTimeSlot,
  DaySessionOverride,
  ExamCommitteeMember,
} from '../types/exam-schedule.types';
import type { UserProfile } from '../types/database.types';
import { ExamSchedulerService } from './exam-scheduler.service';
import { ExamScheduleRepository } from '../repositories/ExamScheduleRepository';
import { logger } from '../utils/logger.utils';

export interface AIPromptPreset {
  id: string;
  title: string;
  badge: string;
  description: string;
  prompt: string;
}

export const EXAM_AI_PROMPT_PRESETS: AIPromptPreset[] = [
  {
    id: 'asts_standard_5days',
    title: 'ASTS Ganjil Standar (5 Hari, 2 Sesi/Hari)',
    badge: 'Paling Populer',
    description: 'Senin s/d Jumat, 2 sesi/hari (Jumat 1 sesi), pembagian pengawas merata & adil.',
    prompt:
      'Buatkan jadwal ASTS (Asesmen Sumatif Tengah Semester) ganjil untuk semua kelas dari tanggal 29 September sampai 3 Oktober 2026. 2 sesi per hari (sesi 1 jam 07:30 - 09:00, sesi 2 jam 09:30 - 11:00), khusus hari Jumat 1 sesi saja (07:15 - 08:45). Mapel: PAI, Matematika, Bahasa Indonesia, IPA, IPS, Bahasa Inggris, PJOK, Seni Budaya, Informatika, PKn. Bagi rata seluruh guru sebagai pengawas, 1 guru per ruang, jangan tugaskan guru mengawas mata pelajarannya sendiri.',
  },
  {
    id: 'asts_quick_all',
    title: 'ASTS Kilat (Semua Rombel & Guru Aktif)',
    badge: 'Instan',
    description: 'Jadwal otomatis 5 hari kerja dengan seluruh rombel dan seluruh guru yang aktif.',
    prompt:
      'Buatkan jadwal ASTS kilat untuk semua rombel yang ada, 2 sesi per hari, hari Jumat 1 sesi, semua guru aktif ditugaskan mengawas secara adil dan merata, 1 pengawas per ruang, jangan mengawas mapel sendiri.',
  },
  {
    id: 'asas_6days_saturday',
    title: 'ASAS Lengkap 6 Hari (Termasuk Sabtu)',
    badge: 'Semester Lengkap',
    description: 'Senin s/d Sabtu, 2 sesi per hari, seluruh mata pelajaran pokok dan muatan lokal.',
    prompt:
      'Buatkan jadwal ASAS (Asesmen Sumatif Akhir Semester) selama 6 hari dari Senin sampai Sabtu, sertakan hari Sabtu, 2 sesi per hari, 1 pengawas per ruang, seluruh mata pelajaran lengkap, tetapkan pengawas cadangan.',
  },
  {
    id: 'asts_morning_3sessions',
    title: 'ASTS Intensif 3 Sesi (Pagi s/d Siang)',
    badge: '3 Sesi',
    description: '3 sesi per hari (Jumat 2 sesi), alokasi ruang dan pengawas proporsional.',
    prompt:
      'Buatkan jadwal ASTS intensif 3 sesi per hari mulai jam 07:30 WIB, khusus hari Jumat 2 sesi sebelum sholat Jumat. Rombel lengkap, 1 pengawas per ruang, bagi rata jadwal mengawas antar guru.',
  },
];

export interface ExamAIGenerateParams {
  prompt: string;
  academicYear: string;
  semester: string;
  teachers: UserProfile[];
  committeeMembers?: ExamCommitteeMember[];
  availableClasses: string[];
  availableSubjects: string[];
}

export interface ExamAIGenerateResult {
  schedule: ExamScheduleData;
  config: ExamScheduleFormConfig;
  usedFallback: boolean;
  aiExplanation?: string;
}

export class ExamScheduleAIGeneratorService {
  /**
   * Main entry point: Generates exam schedule and proctor roster from natural language prompt.
   */
  public static async generateFromPrompt(
    params: ExamAIGenerateParams
  ): Promise<ExamAIGenerateResult> {
    const rawPrompt = (params.prompt || '').trim();
    if (!rawPrompt) {
      throw new Error('Prompt instruksi jadwal ujian tidak boleh kosong.');
    }

    let parsedConfig: ExamScheduleFormConfig | null = null;
    let usedFallback = false;
    let aiExplanation = '';

    // 1. Attempt Zero-Trust AI parsing via Serverless Proxy (/api/ai)
    try {
      const aiResponse = await this.callAIProxy(rawPrompt, params);
      if (aiResponse) {
        parsedConfig = this.sanitizeAIConfig(aiResponse.config, params);
        aiExplanation = aiResponse.explanation || 'Jadwal disusun otomatis menggunakan analisis AI.';
      }
    } catch (aiErr) {
      logger.warn('ExamScheduleAIGeneratorService', 'AI API proxy failed, using heuristic fallback:', aiErr);
    }

    // 2. Fallback to Smart Local Indonesian NLP Heuristic Engine if AI is unavailable or failed
    if (!parsedConfig) {
      usedFallback = true;
      parsedConfig = this.parsePromptLocally(rawPrompt, params);
      aiExplanation = 'Jadwal disusun menggunakan mesin heuristik cerdas kurikulum sekolah.';
    }

    // 3. Generate conflict-free subject schedules & fair proctor roster
    const schedule = ExamSchedulerService.generateSchedule(
      parsedConfig,
      params.teachers,
      params.committeeMembers || []
    );

    // Attach AI optimization note
    schedule.summary.aiOptimizationNote = `${aiExplanation} (${
      usedFallback ? 'Mode Heuristik Cepat' : 'Mode Groq AI'
    })`;

    // 4. Save schedule to repository (cloud + local storage)
    await ExamScheduleRepository.saveSchedule(schedule);

    return {
      schedule,
      config: parsedConfig,
      usedFallback,
      aiExplanation,
    };
  }

  /**
   * Calls the Serverless /api/ai proxy with structured JSON instructions
   */
  private static async callAIProxy(
    userPrompt: string,
    params: ExamAIGenerateParams
  ): Promise<{ config: any; explanation?: string } | null> {
    if (typeof window === 'undefined') return null;

    const systemInstruction = `Anda adalah "AI Master Scheduler" untuk sekolah dan madrasah di Indonesia.
Tugas Anda adalah membaca instruksi jadwal ujian (ASTS/ASAS) dan mengubahnya menjadi objek JSON konfigurasi terstruktur.

Data Sekolah Tersedia:
- Tahun Ajaran: ${params.academicYear}
- Semester: ${params.semester}
- Rombel/Kelas yang ada di sekolah: ${JSON.stringify(params.availableClasses)}
- Daftar Mata Pelajaran yang tersedia: ${JSON.stringify(params.availableSubjects)}
- Jumlah Guru Aktif: ${params.teachers.length} guru

Aturan:
1. Kembalikan HANYA format JSON valid tanpa codeblock markdown, tanpa teks pengantar, persis dengan skema berikut:
{
  "explanation": "Penjelasan singkat 1 kalimat apa yang telah disusun",
  "config": {
    "examType": "ASTS atau ASAS",
    "examTitle": "Judul lengkap ujian (misal: Asesmen Sumatif Tengah Semester (ASTS))",
    "academicYear": "${params.academicYear}",
    "semester": "${params.semester}",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "includeSaturday": false,
    "sessionsPerDay": 2,
    "sessionSlots": [
      { "sessionNumber": 1, "sessionName": "Sesi 1 (Pagi)", "startTime": "07:30", "endTime": "09:00" },
      { "sessionNumber": 2, "sessionName": "Sesi 2 (Siang)", "startTime": "09:30", "endTime": "11:00" }
    ],
    "dayOverrides": [
      { "date": "YYYY-MM-DD", "dayName": "Jumat", "sessionsCount": 1 }
    ],
    "selectedClasses": ["7A", "7B", "8A", "8B", "9A", "9B"],
    "selectedSubjects": ["PAI", "Matematika", "IPA", "IPS", "Bahasa Indonesia", "Bahasa Inggris"],
    "proctorsPerRoom": 1,
    "excludeOwnSubject": true,
    "excludeCommitteeProctor": true,
    "assignBackupProctor": true
  }
}`;

    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    if (!data.success || !data.content) return null;

    try {
      const cleanContent = String(data.content)
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleanContent);
      if (parsed?.config) {
        return {
          config: parsed.config,
          explanation: parsed.explanation,
        };
      }
    } catch (parseErr) {
      logger.warn('ExamScheduleAIGeneratorService', 'Failed to parse AI JSON response:', parseErr);
    }
    return null;
  }

  /**
   * Smart Local Indonesian NLP Heuristic Engine
   * Parses free-form Indonesian text deterministically without network dependency.
   */
  public static parsePromptLocally(
    prompt: string,
    params: ExamAIGenerateParams
  ): ExamScheduleFormConfig {
    const text = prompt.toLowerCase();

    // 1. Detect Exam Type
    const isASAS = text.includes('asas') || text.includes('akhir semester') || text.includes('semester akhir');
    const isASAJ = text.includes('asaj') || text.includes('akhir jenjang');
    const examType: ExamType = isASAS ? 'ASAS' : isASAJ ? 'ASAJ' : 'ASTS';
    const examTitle = isASAS
      ? 'Asesmen Sumatif Akhir Semester (ASAS)'
      : isASAJ
      ? 'Asesmen Sumatif Akhir Jenjang (ASAJ)'
      : 'Asesmen Sumatif Tengah Semester (ASTS)';

    // 2. Detect Saturday inclusion
    const includeSaturday =
      text.includes('sabtu') ||
      text.includes('6 hari') ||
      text.includes('enam hari') ||
      text.includes('senin sampai sabtu') ||
      text.includes('senin s/d sabtu');

    // 3. Extract Dates
    const { startDate, endDate } = this.extractDatesFromPrompt(prompt, includeSaturday);

    // 4. Extract Sessions per Day (ignoring Friday-specific clause)
    const textWithoutFriday = text.replace(/jumat[^\.\,]*?\d+\s*sesi/gi, '');

    let sessionsPerDay = 2; // Default 2 sessions
    if (textWithoutFriday.includes('4 sesi') || textWithoutFriday.includes('empat sesi')) {
      sessionsPerDay = 4;
    } else if (textWithoutFriday.includes('3 sesi') || textWithoutFriday.includes('tiga sesi')) {
      sessionsPerDay = 3;
    } else if (textWithoutFriday.includes('2 sesi') || textWithoutFriday.includes('dua sesi')) {
      sessionsPerDay = 2;
    } else if (textWithoutFriday.includes('1 sesi') || textWithoutFriday.includes('satu sesi')) {
      sessionsPerDay = 1;
    }

    // 5. Default session time slots
    const sessionSlots: SessionTimeSlot[] = [
      { sessionNumber: 1, sessionName: 'Sesi 1 (Pagi)', startTime: '07:30', endTime: '09:00' },
      { sessionNumber: 2, sessionName: 'Sesi 2 (Menjelang Siang)', startTime: '09:30', endTime: '11:00' },
      { sessionNumber: 3, sessionName: 'Sesi 3 (Siang)', startTime: '11:15', endTime: '12:45' },
      { sessionNumber: 4, sessionName: 'Sesi 4 (Tambahan)', startTime: '13:15', endTime: '14:45' },
    ].slice(0, Math.max(sessionsPerDay, 2));

    // 6. Day Overrides (e.g. Friday special sessions)
    const validDates = ExamSchedulerService.getValidExamDates(startDate, endDate, includeSaturday);
    const dayOverrides: DaySessionOverride[] = [];

    // Check if Friday override is requested (e.g. "jumat 1 sesi" or "jumat 2 sesi")
    let fridaySessions = sessionsPerDay >= 3 ? 2 : 1; // standard Friday is 1 or 2
    if (text.includes('jumat 1 sesi') || text.includes('jumat satu sesi') || text.includes('jumat cukup 1')) {
      fridaySessions = 1;
    } else if (text.includes('jumat 2 sesi') || text.includes('jumat dua sesi')) {
      fridaySessions = 2;
    } else if (text.includes('jumat 3 sesi')) {
      fridaySessions = 3;
    }

    validDates.forEach((d) => {
      const isFriday = d.dayName.toLowerCase() === 'jumat';
      dayOverrides.push({
        date: d.date,
        dayName: d.dayName,
        sessionsCount: isFriday ? fridaySessions : sessionsPerDay,
      });
    });

    // 7. Extract Classes
    let selectedClasses = [...params.availableClasses];
    if (selectedClasses.length === 0) {
      selectedClasses = ['7A', '7B', '8A', '8B', '9A', '9B'];
    }

    // If prompt mentions specific grades (e.g. "hanya kelas 7 dan 8" or "kelas 9 saja")
    if (text.includes('kelas 7') && !text.includes('kelas 8') && !text.includes('kelas 9')) {
      const filtered = selectedClasses.filter((c) => c.startsWith('7'));
      if (filtered.length > 0) selectedClasses = filtered;
    } else if (text.includes('kelas 8') && !text.includes('kelas 7') && !text.includes('kelas 9')) {
      const filtered = selectedClasses.filter((c) => c.startsWith('8'));
      if (filtered.length > 0) selectedClasses = filtered;
    } else if (text.includes('kelas 9') && !text.includes('kelas 7') && !text.includes('kelas 8')) {
      const filtered = selectedClasses.filter((c) => c.startsWith('9'));
      if (filtered.length > 0) selectedClasses = filtered;
    }

    // 8. Extract Subjects
    let selectedSubjects = [...params.availableSubjects];
    if (selectedSubjects.length === 0) {
      selectedSubjects = [
        'PAI',
        'PKn',
        'Bahasa Indonesia',
        'Matematika',
        'IPA',
        'IPS',
        'Bahasa Inggris',
        'Informatika',
        'Seni Budaya',
        'PJOK',
        'Bahasa Arab',
      ];
    }

    // If prompt explicitly lists subjects
    const mentionedSubjects = params.availableSubjects.filter((subj) =>
      text.includes(subj.toLowerCase())
    );
    if (mentionedSubjects.length >= 3) {
      selectedSubjects = mentionedSubjects;
    }

    // 9. Proctor settings
    const proctorsPerRoom: 1 | 2 =
      text.includes('2 guru per ruang') ||
      text.includes('2 pengawas') ||
      text.includes('dua pengawas')
        ? 2
        : 1;

    const excludeOwnSubject = !text.includes('boleh mengawas mapel sendiri');
    const excludeCommitteeProctor = !text.includes('panitia ikut mengawas');
    const assignBackupProctor = !text.includes('tanpa pengawas cadangan');

    return {
      examType,
      examTitle,
      academicYear: params.academicYear,
      semester: params.semester,
      startDate,
      endDate,
      includeSaturday,
      sessionsPerDay,
      sessionSlots,
      dayOverrides,
      selectedClasses,
      totalRooms: selectedClasses.length,
      roomFormat: 'NUMERIC',
      selectedSubjects,
      selectedTeacherIds: params.teachers.map((t) => t.id),
      proctorsPerRoom,
      excludeOwnSubject,
      excludeCommitteeProctor,
      assignBackupProctor,
      aiCustomPrompt: prompt.trim(),
    };
  }

  /**
   * Sanitizes and validates AI returned configuration object to ensure strict runtime safety.
   */
  private static sanitizeAIConfig(
    raw: any,
    params: ExamAIGenerateParams
  ): ExamScheduleFormConfig {
    const fallback = this.parsePromptLocally(params.prompt, params);

    const examType: ExamType =
      raw?.examType === 'ASAS' || raw?.examType === 'ASAJ' || raw?.examType === 'ASTS'
        ? raw.examType
        : fallback.examType;

    const startDate =
      typeof raw?.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.startDate)
        ? raw.startDate
        : fallback.startDate;

    const endDate =
      typeof raw?.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.endDate)
        ? raw.endDate
        : fallback.endDate;

    const sessionsPerDay =
      typeof raw?.sessionsPerDay === 'number' && raw.sessionsPerDay >= 1 && raw.sessionsPerDay <= 4
        ? raw.sessionsPerDay
        : fallback.sessionsPerDay;

    const selectedClasses =
      Array.isArray(raw?.selectedClasses) && raw.selectedClasses.length > 0
        ? raw.selectedClasses.filter((c: any) => typeof c === 'string' && c.trim().length > 0)
        : fallback.selectedClasses;

    const selectedSubjects =
      Array.isArray(raw?.selectedSubjects) && raw.selectedSubjects.length > 0
        ? raw.selectedSubjects.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
        : fallback.selectedSubjects;

    const proctorsPerRoom: 1 | 2 = raw?.proctorsPerRoom === 2 ? 2 : 1;

    return {
      ...fallback,
      examType,
      examTitle: typeof raw?.examTitle === 'string' && raw.examTitle.trim() ? raw.examTitle.trim() : fallback.examTitle,
      startDate,
      endDate,
      includeSaturday: Boolean(raw?.includeSaturday ?? fallback.includeSaturday),
      sessionsPerDay,
      selectedClasses,
      selectedSubjects,
      proctorsPerRoom,
      excludeOwnSubject: raw?.excludeOwnSubject !== false,
      excludeCommitteeProctor: raw?.excludeCommitteeProctor !== false,
      assignBackupProctor: raw?.assignBackupProctor !== false,
      aiCustomPrompt: params.prompt.trim(),
    };
  }

  /**
   * Helper to extract ISO dates (YYYY-MM-DD) from Indonesian text.
   * Recognizes patterns like:
   * - "29 September sampai 3 Oktober 2026"
   * - "29 Sep s/d 3 Okt 2026"
   * - "2026-09-29 s/d 2026-10-03"
   */
  public static extractDatesFromPrompt(
    prompt: string,
    includeSaturday = false
  ): { startDate: string; endDate: string } {
    const indonesianMonths: Record<string, number> = {
      jan: 1, januari: 1,
      feb: 2, februari: 2,
      mar: 3, maret: 3,
      apr: 4, april: 4,
      mei: 5,
      jun: 6, juni: 6,
      jul: 7, juli: 7,
      agu: 8, ags: 8, agustus: 8,
      sep: 9, september: 9,
      okt: 10, oktober: 10,
      nov: 11, november: 11,
      des: 12, desember: 12,
    };

    // Regex 1: ISO dates (e.g. 2026-09-29 s/d 2026-10-03)
    const isoMatches = prompt.match(/\b(\d{4}-\d{2}-\d{2})\b/g);
    if (isoMatches && isoMatches.length >= 2) {
      return { startDate: isoMatches[0], endDate: isoMatches[1] };
    }

    // Regex 2: Indonesian format (e.g. "29 September sampai 3 Oktober 2026" or "23 - 27 September 2026")
    const monthRegexPart = Object.keys(indonesianMonths).join('|');
    const regexMultiMonth = new RegExp(
      `(\\d{1,2})\\s+(${monthRegexPart})\\s*(?:sampai|s\\/?d|hingga|-)\\s*(\\d{1,2})\\s+(${monthRegexPart})\\s+(\\d{4})`,
      'i'
    );
    const matchMulti = prompt.match(regexMultiMonth);
    if (matchMulti) {
      const d1 = parseInt(matchMulti[1], 10);
      const m1 = indonesianMonths[matchMulti[2].toLowerCase()];
      const d2 = parseInt(matchMulti[3], 10);
      const m2 = indonesianMonths[matchMulti[4].toLowerCase()];
      const y = parseInt(matchMulti[5], 10);
      if (m1 && m2 && y) {
        return {
          startDate: `${y}-${String(m1).padStart(2, '0')}-${String(d1).padStart(2, '0')}`,
          endDate: `${y}-${String(m2).padStart(2, '0')}-${String(d2).padStart(2, '0')}`,
        };
      }
    }

    // Regex 3: Same month (e.g. "23 sampai 27 September 2026" or "23 - 27 September 2026")
    const regexSameMonth = new RegExp(
      `(\\d{1,2})\\s*(?:sampai|s\\/?d|hingga|-)\\s*(\\d{1,2})\\s+(${monthRegexPart})\\s+(\\d{4})`,
      'i'
    );
    const matchSame = prompt.match(regexSameMonth);
    if (matchSame) {
      const d1 = parseInt(matchSame[1], 10);
      const d2 = parseInt(matchSame[2], 10);
      const m = indonesianMonths[matchSame[3].toLowerCase()];
      const y = parseInt(matchSame[4], 10);
      if (m && y) {
        return {
          startDate: `${y}-${String(m).padStart(2, '0')}-${String(d1).padStart(2, '0')}`,
          endDate: `${y}-${String(m).padStart(2, '0')}-${String(d2).padStart(2, '0')}`,
        };
      }
    }

    // Default: Next Monday to Friday (or Saturday if includeSaturday is true)
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 1 ? 0 : (8 - day) % 7;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + diffToMonday);

    const endDay = new Date(nextMonday);
    endDay.setDate(nextMonday.getDate() + (includeSaturday ? 5 : 4)); // 5 days = Fri, 6 days = Sat

    return {
      startDate: nextMonday.toISOString().split('T')[0],
      endDate: endDay.toISOString().split('T')[0],
    };
  }
}
