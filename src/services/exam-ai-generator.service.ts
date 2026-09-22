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
  EducationLevel,
} from '../types/exam-schedule.types';
import type { UserProfile } from '../types/database.types';
import { ExamSchedulerService } from './exam-scheduler.service';
import { ExamScheduleRepository } from '../repositories/ExamScheduleRepository';
import { resolveSchoolLevel } from '../utils/class.utils';
import { logger } from '../utils/logger.utils';

export interface AIPromptPreset {
  id: string;
  title: string;
  badge: string;
  description: string;
  prompt: string;
}

export const EXAM_AI_PROMPT_PRESETS_SMP: AIPromptPreset[] = [
  {
    id: 'asts_smp_standard_5days',
    title: 'ASTS SMP Standar (Kelas 7-9, 5 Hari)',
    badge: 'SMP Al-Ittihadiyah',
    description: 'Senin s/d Jumat, 2 sesi/hari (Jumat 1 sesi), kelas 7A-9B, pembagian pengawas merata & adil.',
    prompt:
      'Buatkan jadwal ASTS (Asesmen Sumatif Tengah Semester) ganjil SMP Terpadu Al-Ittihadiyah untuk kelas 7A, 7B, 8A, 8B, 9A, 9B dari tanggal 29 September sampai 3 Oktober 2026. 2 sesi per hari (sesi 1 jam 07:30 - 09:00, sesi 2 jam 09:30 - 11:00), khusus hari Jumat 1 sesi saja (07:15 - 08:45). Mapel: PAI, Matematika, Bahasa Indonesia, IPA, IPS, Bahasa Inggris, PJOK, Seni Budaya, Informatika, PKn, Bahasa Arab. Bagi rata seluruh guru sebagai pengawas, 1 guru per ruang, jangan tugaskan guru mengawas mata pelajarannya sendiri.',
  },
  {
    id: 'asts_smp_quick_all',
    title: 'ASTS Kilat SMP (Semua Rombel SMP)',
    badge: 'Instan SMP',
    description: 'Jadwal otomatis 5 hari kerja untuk seluruh rombel SMP yang aktif.',
    prompt:
      'Buatkan jadwal ASTS kilat untuk semua rombel SMP yang ada, 2 sesi per hari, hari Jumat 1 sesi, semua guru aktif ditugaskan mengawas secara adil dan merata, 1 pengawas per ruang, jangan mengawas mapel sendiri.',
  },
  {
    id: 'asas_smp_6days_saturday',
    title: 'ASAS Lengkap 6 Hari SMP (Termasuk Sabtu)',
    badge: 'Semester SMP',
    description: 'Senin s/d Sabtu, 2 sesi per hari, seluruh mata pelajaran pokok SMP dan muatan lokal.',
    prompt:
      'Buatkan jadwal ASAS (Asesmen Sumatif Akhir Semester) SMP selama 6 hari dari Senin sampai Sabtu, sertakan hari Sabtu, 2 sesi per hari, 1 pengawas per ruang, seluruh mata pelajaran lengkap, tetapkan pengawas cadangan.',
  },
  {
    id: 'asts_smp_morning_3sessions',
    title: 'ASTS Intensif 3 Sesi SMP (Pagi s/d Siang)',
    badge: '3 Sesi SMP',
    description: '3 sesi per hari (Jumat 2 sesi), alokasi ruang dan pengawas SMP proporsional.',
    prompt:
      'Buatkan jadwal ASTS intensif SMP 3 sesi per hari mulai jam 07:30 WIB, khusus hari Jumat 2 sesi sebelum sholat Jumat. Rombel SMP lengkap, 1 pengawas per ruang, bagi rata jadwal mengawas antar guru.',
  },
];

export const EXAM_AI_PROMPT_PRESETS_SMA: AIPromptPreset[] = [
  {
    id: 'asts_sma_standard_5days',
    title: 'ASTS SMA Standar (Kelas 10-12, 5 Hari)',
    badge: 'SMA As Salaam',
    description: 'Senin s/d Jumat, 2 sesi/hari (Jumat 1 sesi), kelas 10, 11, 12 SMA, pengawas merata.',
    prompt:
      'Buatkan jadwal ASTS (Asesmen Sumatif Tengah Semester) ganjil SMA Terpadu As Salaam untuk rombel SMA dari tanggal 29 September sampai 3 Oktober 2026. 2 sesi per hari (sesi 1 jam 07:30 - 09:00, sesi 2 jam 09:30 - 11:00), khusus hari Jumat 1 sesi saja (07:15 - 08:45). Mapel: PAI, Matematika, Bahasa Indonesia, Bahasa Inggris, Fisika, Kimia, Biologi, Ekonomi, Sosiologi, Geografi, PKn, PJOK. Bagi rata seluruh guru sebagai pengawas, 1 guru per ruang, jangan tugaskan guru mengawas mata pelajarannya sendiri.',
  },
  {
    id: 'asts_sma_quick_all',
    title: 'ASTS Kilat SMA (Semua Rombel SMA)',
    badge: 'Instan SMA',
    description: 'Jadwal otomatis 5 hari kerja untuk seluruh rombel SMA (10, 11, 12) dan guru aktif.',
    prompt:
      'Buatkan jadwal ASTS kilat untuk semua rombel SMA yang ada, 2 sesi per hari, hari Jumat 1 sesi, semua guru aktif ditugaskan mengawas secara adil dan merata, 1 pengawas per ruang, jangan mengawas mapel sendiri.',
  },
  {
    id: 'asas_sma_6days_saturday',
    title: 'ASAS Lengkap 6 Hari SMA (Termasuk Sabtu)',
    badge: 'Semester SMA',
    description: 'Senin s/d Sabtu, 2 sesi per hari, seluruh mata pelajaran SMA lengkap dan tetapkan pengawas cadangan.',
    prompt:
      'Buatkan jadwal ASAS (Asesmen Sumatif Akhir Semester) SMA selama 6 hari dari Senin sampai Sabtu, sertakan hari Sabtu, 2 sesi per hari, 1 pengawas per ruang, seluruh mata pelajaran SMA lengkap, tetapkan pengawas cadangan.',
  },
  {
    id: 'asts_sma_morning_3sessions',
    title: 'ASTS Intensif 3 Sesi SMA (Pagi s/d Siang)',
    badge: '3 Sesi SMA',
    description: '3 sesi per hari (Jumat 2 sesi), alokasi ruang dan pengawas SMA proporsional.',
    prompt:
      'Buatkan jadwal ASTS intensif SMA 3 sesi per hari mulai jam 07:30 WIB, khusus hari Jumat 2 sesi sebelum sholat Jumat. Rombel SMA lengkap, 1 pengawas per ruang, bagi rata jadwal mengawas antar guru.',
  },
];

export function getExamAIPromptPresets(level?: EducationLevel): AIPromptPreset[] {
  return level === 'SMA' ? EXAM_AI_PROMPT_PRESETS_SMA : EXAM_AI_PROMPT_PRESETS_SMP;
}

// Fallback legacy export
export const EXAM_AI_PROMPT_PRESETS: AIPromptPreset[] = EXAM_AI_PROMPT_PRESETS_SMP;

export interface ExamAIGenerateParams {
  prompt: string;
  academicYear: string;
  semester: string;
  educationLevel?: EducationLevel;
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
   * Parses explicit subject-to-proctor allocation matrix from Indonesian prompt.
   * Pattern: "<Subject>: P1 = <Name>, P2 = <Name>, P3 = <Name>, P4 = <Name>, P5 = <Name>"
   */
  public static parseCustomSubjectProctors(prompt: string): {
    customSubjectProctors: Record<string, string[]>;
    detectedSubjects: string[];
    maxProctorsPerSubject: number;
    detectedTeacherNames: string[];
    detectedRoomNumbers: number[];
  } {
    const customSubjectProctors: Record<string, string[]> = {};
    const detectedTeacherNamesSet = new Set<string>();
    const allDetectedRoomNums = new Set<number>();
    let maxProctorsPerSubject = 0;

    const lines = (prompt || '').split(/\r?\n/);
    const subjectList: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Match "<Subject>: P1 = ..." or "<Subject>: P6 = ..." or "<Subject> - Ruang 6 = ..." or "<Subject>: R6: ..."
      const match = line.match(/^([^:\-\n]+)[:\-]\s*((?:(?:P|R|Ruang\s*)\d+)\s*[:=].+)$/i);
      if (!match) continue;

      const subjectName = match[1].trim();
      const proctorsPart = match[2].trim();

      // Extract all P<num> = <TeacherName> or Ruang <num> = <TeacherName> or R<num> = <TeacherName>
      // Lookahead ensures commas inside Indonesian academic titles (e.g. "S.E., G.r") are preserved
      const pRegex = /(?:P|R|Ruang\s*)(\d+)\s*[:=]\s*(.*?)(?=(?:,\s*|;\s*|\s+)(?:P|R|Ruang\s*)\d+\s*[:=]|$)/gi;
      let pMatch: RegExpExecArray | null;
      const proctorsMap = new Map<number, string>();

      while ((pMatch = pRegex.exec(proctorsPart)) !== null) {
        const pNum = parseInt(pMatch[1], 10);
        const tName = pMatch[2].trim();
        if (pNum > 0 && tName) {
          proctorsMap.set(pNum, tName);
          detectedTeacherNamesSet.add(tName);
          allDetectedRoomNums.add(pNum);
        }
      }

      if (proctorsMap.size > 0) {
        const sortedPNums = Array.from(proctorsMap.keys()).sort((a, b) => a - b);
        const maxP = sortedPNums[sortedPNums.length - 1];
        const proctorArray: string[] = [];
        for (let i = 1; i <= maxP; i++) {
          proctorArray.push(proctorsMap.get(i) || '-');
        }

        customSubjectProctors[subjectName] = proctorArray;
        subjectList.push(subjectName);
        if (proctorArray.length > maxProctorsPerSubject) {
          maxProctorsPerSubject = proctorArray.length;
        }
      }
    }

    const detectedRoomNumbers = Array.from(allDetectedRoomNums).sort((a, b) => a - b);

    return {
      customSubjectProctors,
      detectedSubjects: subjectList,
      maxProctorsPerSubject,
      detectedTeacherNames: Array.from(detectedTeacherNamesSet),
      detectedRoomNumbers,
    };
  }

  /**
   * Evaluates if prompt explicitly mentions teachers, proctors, or invigilator assignments.
   * If false, the AI scheduler will NOT generate proctor assignments (roster pengawas dikosongkan).
   */
  public static detectTeacherIntent(
    prompt: string,
    teachers: UserProfile[] = [],
    hasCustomMatrix = false
  ): boolean {
    if (hasCustomMatrix) return true;
    const text = (prompt || '').toLowerCase();

    // 1. Generic teacher / invigilator keywords in Indonesian
    const teacherKeywords = /\b(guru|pengawas|mengawas|piket|proctor|invigilator|penugasan|alokasi|p\d+|r\d+|ruang\s*\d+)\b/i;
    if (teacherKeywords.test(text)) {
      return true;
    }

    // 2. Check if any specific teacher's name appears in the prompt
    for (const t of teachers) {
      if (!t.full_name) continue;
      // Strip common Indonesian academic titles to match conversational mentions
      const cleanName = t.full_name
        .replace(/(drs\.|dra\.|dr\.|ir\.|h\.|hj\.|m\.pd|s\.pd|s\.si|s\.kom|s\.ag|s\.mat|s\.e|g\.r)/gi, '')
        .replace(/[,\.]/g, ' ')
        .trim()
        .toLowerCase();

      if (cleanName.length >= 3 && text.includes(cleanName)) {
        return true;
      }
    }

    return false;
  }

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

    const customMatrix = this.parseCustomSubjectProctors(rawPrompt);
    const hasCustomMatrix = customMatrix.detectedSubjects.length > 0;

    let parsedConfig: ExamScheduleFormConfig | null = null;
    let usedFallback = false;
    let aiExplanation = '';

    // If explicit custom proctor matrix (P1..P10) is detected, prioritize zero-hallucination local parser
    // to strictly preserve exact subject ordering and room proctor allocation.
    if (hasCustomMatrix) {
      usedFallback = false;
      parsedConfig = this.parsePromptLocally(rawPrompt, params);
      const roomDesc = customMatrix.detectedRoomNumbers.length > 0
        ? `ruangan ${customMatrix.detectedRoomNumbers.join(', ')}`
        : `${customMatrix.maxProctorsPerSubject} ruangan`;
      aiExplanation = `Jadwal ujian dan alokasi pengawas (${customMatrix.detectedSubjects.length} mata pelajaran, ${roomDesc}) berhasil disusun 100% presisi sesuai matrik alokasi guru pengawas.`;
    } else {
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
    }

    // If prompt did not mention teachers, note that proctors were omitted
    if (parsedConfig.skipProctorAssignment) {
      aiExplanation = 'Jadwal ujian mata pelajaran siswa berhasil disusun tanpa alokasi guru pengawas (sesuai instruksi prompt).';
    }

    // Explicitly lock education level
    if (params.educationLevel) {
      parsedConfig.educationLevel = params.educationLevel;
    }

    // 3. Generate conflict-free subject schedules & fair proctor roster
    const schedule = ExamSchedulerService.generateSchedule(
      parsedConfig,
      params.teachers,
      params.committeeMembers || []
    );

    if (params.educationLevel) {
      schedule.config.educationLevel = params.educationLevel;
      schedule.educationLevel = params.educationLevel;
    }

    // Attach AI optimization note
    schedule.summary.aiOptimizationNote = `${aiExplanation} (${
      usedFallback ? 'Mode Heuristik Cepat' : 'Mode Groq AI'
    })`;

    // 4. Save schedule to repository (cloud + local storage) with level segregation
    await ExamScheduleRepository.saveSchedule(schedule, params.educationLevel);

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

    const schoolName = params.educationLevel === 'SMA' ? 'SMA Terpadu As Salaam' : 'SMP Terpadu Al-Ittihadiyah';
    const systemInstruction = `Anda adalah "AI Master Scheduler" untuk sekolah dan madrasah di Indonesia.
Tugas Anda adalah membaca instruksi jadwal ujian (ASTS/ASAS) dan mengubahnya menjadi objek JSON konfigurasi terstruktur.

Data Sekolah Tersedia:
- Unit Sekolah: ${schoolName} (${params.educationLevel || 'SMP'})
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
    "selectedClasses": ${JSON.stringify(params.availableClasses.length > 0 ? params.availableClasses : ['7A', '7B', '8A', '8B', '9A', '9B'])},
    "selectedSubjects": ["PAI", "Matematika", "IPA", "IPS", "Bahasa Indonesia", "Bahasa Inggris"],
    "skipProctorAssignment": false,
    "proctorsPerRoom": 1,
    "excludeOwnSubject": true,
    "excludeCommitteeProctor": true,
    "assignBackupProctor": true
  }
}
Catatan Penting: Jika userPrompt TIDAK menyebutkan guru, pengawas, mengawas, piket, atau nama guru, maka "skipProctorAssignment" WAJIB diset true.`;

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
    const customMatrix = this.parseCustomSubjectProctors(prompt);
    const hasCustomMatrix = customMatrix.detectedSubjects.length > 0;
    const hasTeacherIntent = this.detectTeacherIntent(prompt, params.teachers, hasCustomMatrix);

    const effectiveLevel: EducationLevel =
      params.educationLevel ||
      (text.includes('sma') || text.includes('as salaam') || text.includes('assalaam')
        ? 'SMA'
        : 'SMP');

    // 1. Detect Exam Type
    const isASAS = text.includes('asas') || text.includes('akhir semester') || text.includes('semester akhir');
    const isASAJ = text.includes('asaj') || text.includes('akhir jenjang');
    const examType: ExamType = isASAS ? 'ASAS' : isASAJ ? 'ASAJ' : 'ASTS';
    const examTitle = isASAS
      ? `Asesmen Sumatif Akhir Semester (ASAS) ${effectiveLevel}`
      : isASAJ
      ? `Asesmen Sumatif Akhir Jenjang (ASAJ) ${effectiveLevel}`
      : `Asesmen Sumatif Tengah Semester (ASTS) ${effectiveLevel}`;

    // 2. Detect Saturday inclusion (automatically included if custom matrix has > 10 subjects)
    const includeSaturday =
      (hasCustomMatrix && customMatrix.detectedSubjects.length > 10) ||
      text.includes('sabtu') ||
      text.includes('6 hari') ||
      text.includes('enam hari') ||
      text.includes('senin sampai sabtu') ||
      text.includes('senin s/d sabtu');

    // 3. Extract Dates
    const { startDate, endDate } = this.extractDatesFromPrompt(prompt, includeSaturday);

    // 4. Detect per-day session/subject count overrides from Indonesian prompt
    // Supports: "Rabu 3 sesi", "Kamis 3 mata pelajaran", "Senin 2 mapel",
    //           "Rabu dan Kamis terdiri dari 3 mata pelajaran", etc.
    const dayNameMap: Record<string, string> = {
      senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu',
      kamis: 'Kamis', jumat: 'Jumat', sabtu: 'Sabtu',
    };
    const perDaySessionOverrides = new Map<string, number>();

    // Pattern 1: Multi-day lists or conjunctions, e.g.:
    // "Rabu dan Kamis terdiri dari 3 mata pelajaran", "Rabu dan Kamis memiliki 3 mata pelajaran",
    // "Senin, Selasa, dan Jumat masing-masing 2 mata pelajaran", "Rabu dan Kamis: 3 sesi"
    const multiDayPattern = /(?:(?:senin|selasa|rabu|kamis|jumat|sabtu)(?:,\s*|\s+dan\s+|\s+))+\s*[:=\-]?\s*(?:masing-masing\s+|terdiri\s+dari\s+|memiliki\s+|sebanyak\s+|ada\s+)?(\d+)\s*(?:sesi|mata\s*pelajaran|mapel|mata\s*pel)/gi;
    let mm: RegExpExecArray | null;
    while ((mm = multiDayPattern.exec(text)) !== null) {
      const fullMatch = mm[0];
      const count = parseInt(mm[1], 10);
      if (count >= 1 && count <= 4) {
        const daysFound = fullMatch.match(/\b(senin|selasa|rabu|kamis|jumat|sabtu)\b/gi) || [];
        daysFound.forEach((d) => {
          const dk = d.toLowerCase();
          if (dayNameMap[dk]) perDaySessionOverrides.set(dk, count);
        });
      }
    }

    // Pattern 2: Single day with count (supports bullet points and colons):
    // e.g. "- Senin: 2 sesi (2 mata pelajaran)", "Rabu 3 mata pelajaran", "Kamis: 3 sesi", "Senin 2 mapel"
    const singleDayPattern = /\b(senin|selasa|rabu|kamis|jumat|sabtu)\s*[:=\-]?\s*(?:terdiri\s+dari\s+|memiliki\s+|hanya\s+|cukup\s+|sebanyak\s+)?(\d+)\s*(?:sesi|mata\s*pelajaran|mapel|mata\s*pel)/gi;
    let sm: RegExpExecArray | null;
    while ((sm = singleDayPattern.exec(text)) !== null) {
      const dayKey = sm[1].toLowerCase();
      const count = parseInt(sm[2], 10);
      if (count >= 1 && count <= 4 && dayNameMap[dayKey]) {
        perDaySessionOverrides.set(dayKey, count);
      }
    }

    // Pattern 3: Inverted count then day:
    // e.g. "3 mata pelajaran pada hari rabu dan kamis", "2 sesi untuk hari jumat"
    const invertedPattern = /(\d+)\s*(?:sesi|mata\s*pelajaran|mapel|mata\s*pel)\s*(?:per\s+hari\s+)?(?:pada\s+hari\s+|untuk\s+hari\s+|khusus\s+hari\s+|hari\s+)(senin|selasa|rabu|kamis|jumat|sabtu)/gi;
    let im: RegExpExecArray | null;
    while ((im = invertedPattern.exec(text)) !== null) {
      const count = parseInt(im[1], 10);
      const dayKey = im[2].toLowerCase();
      if (count >= 1 && count <= 4 && dayNameMap[dayKey]) {
        perDaySessionOverrides.set(dayKey, count);
      }
    }

    // 4b. Extract global sessionsPerDay (strip all day-specific clauses first)
    let textWithoutDayOverrides = text;
    for (const dayKey of Object.keys(dayNameMap)) {
      textWithoutDayOverrides = textWithoutDayOverrides.replace(
        new RegExp(`${dayKey}[^.;,\\n]*?\\d+\\s*(?:sesi|mata\\s*pelajaran|mapel)`, 'gi'), ''
      );
    }

    let sessionsPerDay = 2;
    if (textWithoutDayOverrides.includes('4 sesi') || textWithoutDayOverrides.includes('empat sesi')) {
      sessionsPerDay = 4;
    } else if (textWithoutDayOverrides.includes('3 sesi') || textWithoutDayOverrides.includes('tiga sesi')) {
      sessionsPerDay = 3;
    } else if (textWithoutDayOverrides.includes('2 sesi') || textWithoutDayOverrides.includes('dua sesi')) {
      sessionsPerDay = 2;
    } else if (textWithoutDayOverrides.includes('1 sesi') || textWithoutDayOverrides.includes('satu sesi')) {
      sessionsPerDay = 1;
    }

    // Raise sessionsPerDay to cover the maximum per-day override (for sessionSlots generation)
    const maxPerDayOverride = perDaySessionOverrides.size > 0
      ? Math.max(...Array.from(perDaySessionOverrides.values()))
      : sessionsPerDay;
    const effectiveMaxSessions = Math.max(sessionsPerDay, maxPerDayOverride);

    // 5. Default session time slots (sized to cover the max sessions needed)
    const sessionSlots: SessionTimeSlot[] = [
      { sessionNumber: 1, sessionName: 'Sesi 1 (Pagi)', startTime: '07:30', endTime: '09:00' },
      { sessionNumber: 2, sessionName: 'Sesi 2 (Menjelang Siang)', startTime: '09:30', endTime: '11:00' },
      { sessionNumber: 3, sessionName: 'Sesi 3 (Siang)', startTime: '11:15', endTime: '12:45' },
      { sessionNumber: 4, sessionName: 'Sesi 4 (Tambahan)', startTime: '13:15', endTime: '14:45' },
    ].slice(0, Math.max(effectiveMaxSessions, 2));

    // 6. Day Overrides — apply per-day overrides detected from prompt
    const validDates = ExamSchedulerService.getValidExamDates(startDate, endDate, includeSaturday);
    const dayOverrides: DaySessionOverride[] = [];

    // Determine Friday sessions (default or from per-day override)
    let fridaySessions = perDaySessionOverrides.get('jumat') ??
      (sessionsPerDay >= 3 ? 2 : 1);
    if (!perDaySessionOverrides.has('jumat')) {
      if (text.includes('jumat 1 sesi') || text.includes('jumat satu sesi') || text.includes('jumat cukup 1')) {
        fridaySessions = 1;
      } else if (text.includes('jumat 2 sesi') || text.includes('jumat dua sesi')) {
        fridaySessions = 2;
      } else if (text.includes('jumat 3 sesi')) {
        fridaySessions = 3;
      } else if (hasCustomMatrix && customMatrix.detectedSubjects.length > 10) {
        fridaySessions = 2;
      }
    }

    validDates.forEach((d) => {
      const dayKey = d.dayName.toLowerCase();
      const isFriday = dayKey === 'jumat';
      // Priority: per-day override from prompt → Friday default → global sessionsPerDay
      const overrideCount = perDaySessionOverrides.get(dayKey);
      const sessionsForDay = overrideCount !== undefined
        ? overrideCount
        : (isFriday ? fridaySessions : sessionsPerDay);
      dayOverrides.push({
        date: d.date,
        dayName: d.dayName,
        sessionsCount: sessionsForDay,
      });
    });

    // 7. Extract Classes with Education Level Segregation
    let levelClasses = params.availableClasses.filter(
      (c) => resolveSchoolLevel(c) === effectiveLevel
    );
    if (levelClasses.length === 0) {
      levelClasses =
        effectiveLevel === 'SMA'
          ? ['10', '11', '12']
          : ['7A', '7B', '8A', '8B', '9A', '9B'];
    }

    let selectedClasses = [...levelClasses];
    let totalRooms = selectedClasses.length;

    // If explicit proctor matrix exists, configure rooms and classes to match matrix rooms (e.g. Ruang 6 for SMA)
    if (hasCustomMatrix && customMatrix.detectedRoomNumbers && customMatrix.detectedRoomNumbers.length > 0) {
      selectedClasses = customMatrix.detectedRoomNumbers.map((num) => `Ruang ${num}`);
      totalRooms = selectedClasses.length;
    } else if (hasCustomMatrix && customMatrix.maxProctorsPerSubject > 0) {
      totalRooms = customMatrix.maxProctorsPerSubject;
      selectedClasses = Array.from({ length: totalRooms }, (_, i) => `Ruang ${i + 1}`);
    } else if (effectiveLevel === 'SMP') {
      // If prompt mentions specific grades
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
      totalRooms = selectedClasses.length;
    } else {
      if (text.includes('kelas 10') && !text.includes('kelas 11') && !text.includes('kelas 12')) {
        const filtered = selectedClasses.filter((c) => c.startsWith('10') || c.startsWith('X'));
        if (filtered.length > 0) selectedClasses = filtered;
      } else if (text.includes('kelas 11') && !text.includes('kelas 10') && !text.includes('kelas 12')) {
        const filtered = selectedClasses.filter((c) => c.startsWith('11') || c.startsWith('XI'));
        if (filtered.length > 0) selectedClasses = filtered;
      } else if (text.includes('kelas 12') && !text.includes('kelas 10') && !text.includes('kelas 11')) {
        const filtered = selectedClasses.filter((c) => c.startsWith('12') || c.startsWith('XII'));
        if (filtered.length > 0) selectedClasses = filtered;
      }
      totalRooms = selectedClasses.length;
    }

    // 8. Extract Subjects
    let selectedSubjects = [...params.availableSubjects];
    if (hasCustomMatrix) {
      // Strictly maintain the subjects and their exact sequence from user matrix
      selectedSubjects = [...customMatrix.detectedSubjects];
    } else {
      if (selectedSubjects.length === 0) {
        selectedSubjects =
          effectiveLevel === 'SMA'
            ? [
                'PAI',
                'PKn',
                'Bahasa Indonesia',
                'Bahasa Inggris',
                'Matematika',
                'Fisika',
                'Kimia',
                'Biologi',
                'Ekonomi',
                'Sosiologi',
                'Geografi',
                'PJOK',
              ]
            : [
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
      educationLevel: effectiveLevel,
      academicYear: params.academicYear,
      semester: params.semester,
      startDate,
      endDate,
      includeSaturday,
      sessionsPerDay: effectiveMaxSessions,
      sessionSlots,
      dayOverrides,
      selectedClasses,
      totalRooms,
      roomFormat: 'NUMERIC',
      selectedSubjects,
      selectedTeacherIds: (() => {
        if (!hasTeacherIntent) return [];
        if (hasCustomMatrix && customMatrix.detectedTeacherNames.length > 0) {
          const matrixTeacherIds = new Set<string>();
          customMatrix.detectedTeacherNames.forEach((name) => {
            const matched = ExamSchedulerService.findMatchingTeacher(name, params.teachers);
            if (matched && matched.userId) {
              matrixTeacherIds.add(matched.userId);
            }
          });
          return Array.from(matrixTeacherIds);
        }
        const mentionedTeacherIds = new Set<string>();
        params.teachers.forEach((t) => {
          if (!t.full_name) return;
          const cleanName = t.full_name
            .replace(/(drs\.|dra\.|dr\.|ir\.|h\.|hj\.|m\.pd|s\.pd|s\.si|s\.kom|s\.ag|s\.mat|s\.e|g\.r)/gi, '')
            .replace(/[,\.]/g, ' ')
            .trim()
            .toLowerCase();
          if (cleanName.length >= 4 && text.includes(cleanName)) {
            mentionedTeacherIds.add(t.id);
          }
        });
        if (mentionedTeacherIds.size >= 1) {
          return Array.from(mentionedTeacherIds);
        }
        return params.teachers.map((t) => t.id);
      })(),
      proctorsPerRoom,
      excludeOwnSubject: hasCustomMatrix ? false : excludeOwnSubject,
      excludeCommitteeProctor,
      assignBackupProctor: hasCustomMatrix ? false : assignBackupProctor,
      aiCustomPrompt: prompt.trim(),
      customSubjectProctors: hasCustomMatrix ? customMatrix.customSubjectProctors : undefined,
      customRoomNumbers: hasCustomMatrix ? customMatrix.detectedRoomNumbers : undefined,
      skipProctorAssignment: !hasTeacherIntent,
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
    const effectiveLevel = params.educationLevel || fallback.educationLevel;

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

    let selectedClasses =
      Array.isArray(raw?.selectedClasses) && raw.selectedClasses.length > 0
        ? raw.selectedClasses.filter((c: any) => typeof c === 'string' && c.trim().length > 0)
        : fallback.selectedClasses;

    if (effectiveLevel) {
      const filteredByLevel = selectedClasses.filter(
        (c: string) => resolveSchoolLevel(c) === effectiveLevel
      );
      if (filteredByLevel.length > 0) {
        selectedClasses = filteredByLevel;
      } else {
        selectedClasses = fallback.selectedClasses;
      }
    }

    const selectedSubjects =
      Array.isArray(raw?.selectedSubjects) && raw.selectedSubjects.length > 0
        ? raw.selectedSubjects.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
        : fallback.selectedSubjects;

    const proctorsPerRoom: 1 | 2 = raw?.proctorsPerRoom === 2 ? 2 : 1;
    const hasTeacherIntent = this.detectTeacherIntent(params.prompt, params.teachers, false);
    const skipProctorAssignment =
      raw?.skipProctorAssignment !== undefined
        ? Boolean(raw.skipProctorAssignment)
        : !hasTeacherIntent;

    return {
      ...fallback,
      examType,
      educationLevel: effectiveLevel,
      examTitle: typeof raw?.examTitle === 'string' && raw.examTitle.trim() ? raw.examTitle.trim() : fallback.examTitle,
      startDate,
      endDate,
      includeSaturday: Boolean(raw?.includeSaturday ?? fallback.includeSaturday),
      sessionsPerDay,
      selectedClasses,
      selectedSubjects,
      selectedTeacherIds: skipProctorAssignment ? [] : fallback.selectedTeacherIds,
      skipProctorAssignment,
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
