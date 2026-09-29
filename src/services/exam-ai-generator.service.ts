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
    title: 'ASTS SMP Standar (5 Ruang, 5 Hari, 12 Mapel)',
    badge: 'SMP Al-Ittihadiyah',
    description: 'Senin s/d Jumat, Ruang 1-5, sesi 1 (08.00-09.30), sesi 2 (10.00-11.00), sesi 3 (11.00-12.00).',
    prompt:
      'Tolong buatkan jadwal pengawasan ujian ASTS SMP Terpadu Al-Ittihadiyah tanggal 28 September sampai 2 Oktober 2026 untuk Ruang 1, Ruang 2, Ruang 3, Ruang 4, Ruang 5.\n\n' +
      'Waktu sesi:\n' +
      '* Sesi 1: 08.00 - 09.30\n' +
      '* Sesi 2: 10.00 - 11.00\n' +
      '* Sesi 3: 11.00 - 12.00\n\n' +
      'Pembagian sesi per hari:\n' +
      '* Senin, 28 September 2026: 2 sesi (1. PAI, 2. IPA)\n' +
      '* Selasa, 29 September 2026: 2 sesi (1. MTK, 2. PP)\n' +
      '* Rabu, 30 September 2026: 3 sesi (1. B. Indonesia, 2. IPS, 3. B. Arab)\n' +
      '* Kamis, 1 Oktober 2026: 3 sesi (1. B. Inggris, 2. SBPK, 3. Informatika)\n' +
      '* Jum\'at, 2 Oktober 2026: 2 sesi (1. Hadits, 2. BTQ)\n\n' +
      'Alokasi guru pengawas per mata pelajaran (P1 = Ruang 1, P2 = Ruang 2, P3 = Ruang 3, P4 = Ruang 4, P5 = Ruang 5):\n' +
      'PAI: P1 = Fitri Ani Rahayu, S.Mat, P2 = Qodiatul Asrof Ramadhoni, S.E., G.r, P3 = Widianingsih, S.I., G.r, P4 = Adi Prasetyo, S.Pd., G.r, P5 = M. Iqbal Gustiawan, S.Pd., G.r\n' +
      'IPA: P1 = Widianingsih, S.I., G.r, P2 = Nurul Farhiya, S.Pd., G.r, P3 = Ridho Maulana Al Farizi, P4 = Fitri Ani Rahayu, S.Mat, P5 = Adi Prasetyo, S.Pd., G.r\n' +
      'MTK: P1 = Septi Nur Aeni, S.E, P2 = Fitri Ani Rahayu, S.Mat, P3 = M. Iqbal Gustiawan, S.Pd., G.r, P4 = Mira Nurdianti, S.Pd, P5 = Adi Prasetyo, S.Pd., G.r\n' +
      'PP: P1 = Widianingsih, S.I., G.r, P2 = Ridho Maulana Al Farizi, P3 = Septi Nur Aeni, S.E, P4 = Qodiatul Asrof Ramadhoni, S.E., G.r, P5 = Nurul Farhiya, S.Pd., G.r\n' +
      'B. Indonesia: P1 = Nurul Farhiya, S.Pd., G.r, P2 = Dafa Maulana, S.Pd, P3 = Fitri Ani Rahayu, S.Mat, P4 = Mawar Andinia, S.Pd., G.r, P5 = Adi Prasetyo, S.Pd., G.r\n' +
      'IPS: P1 = Ridho Maulana Al Farizi, P2 = Septi Nur Aeni, S.E, P3 = Widianingsih, S.I., G.r, P4 = Adi Prasetyo, S.Pd., G.r, P5 = Fitri Ani Rahayu, S.Mat\n' +
      'B. Arab: P1 = Qodiatul Asrof Ramadhoni, S.E., G.r, P2 = Widianingsih, S.I., G.r, P3 = Nurul Farhiya, S.Pd., G.r, P4 = M. Iqbal Gustiawan, S.Pd., G.r, P5 = Adi Prasetyo, S.Pd., G.r\n' +
      'B. Inggris: P1 = Nurul Farhiya, S.Pd., G.r, P2 = Widianingsih, S.I., G.r, P3 = Fitri Ani Rahayu, S.Mat, P4 = Mira Nurdianti, S.Pd, P5 = Adi Prasetyo, S.Pd., G.r\n' +
      'SBPK: P1 = Fitri Ani Rahayu, S.Mat, P2 = Mawar Andinia, S.Pd., G.r, P3 = Qodiatul Asrof Ramadhoni, S.E., G.r, P4 = Adi Prasetyo, S.Pd., G.r, P5 = Widianingsih, S.I., G.r\n' +
      'Informatika: P1 = Qodiatul Asrof Ramadhoni, S.E., G.r, P2 = Septi Nur Aeni, S.E, P3 = Dafa Maulana, S.Pd, P4 = Fitri Ani Rahayu, S.Mat, P5 = M. Iqbal Gustiawan, S.Pd., G.r\n' +
      'Hadits: P1 = Widianingsih, S.I., G.r, P2 = Mawar Andinia, S.Pd., G.r, P3 = Ridho Maulana Al Farizi, P4 = Nurul Farhiya, S.Pd., G.r, P5 = Mira Nurdianti, S.Pd\n' +
      'BTQ: P1 = M. Iqbal Gustiawan, S.Pd., G.r, P2 = Mira Nurdianti, S.Pd, P3 = Qodiatul Asrof Ramadhoni, S.E., G.r, P4 = Dafa Maulana, S.Pd, P5 = Mawar Andinia, S.Pd., G.r\n\n' +
      'Mohon terapkan penugasan pengawas di atas secara tepat tanpa mengubah urutan ruang, nama guru, gelar, maupun posisi P1 sampai P5 untuk masing-masing mata pelajaran. Pastikan setiap ruang mendapatkan satu pengawas pada setiap sesi dan tidak ada satu guru yang ditugaskan pada dua ruang dalam waktu yang sama.',
  },
  {
    id: 'asts_smp_quick_all',
    title: 'ASTS Kilat SMP (Semua Rombel SMP)',
    badge: 'Instan SMP',
    description: 'Jadwal otomatis 5 hari kerja untuk seluruh rombel SMP yang aktif.',
    prompt:
      'Buatkan jadwal ASTS kilat untuk semua rombel SMP yang ada, sesi 1: 08.00 - 09.30, sesi 2: 10.00 - 11.00, sesi 3: 11.00 - 12.00, semua guru aktif ditugaskan mengawas secara adil dan merata, 1 pengawas per ruang, jangan mengawas mapel sendiri.',
  },
  {
    id: 'asas_smp_6days_saturday',
    title: 'ASAS Lengkap 6 Hari SMP (Termasuk Sabtu)',
    badge: 'Semester SMP',
    description: 'Senin s/d Sabtu, 2 sesi per hari, seluruh mata pelajaran pokok SMP dan muatan lokal.',
    prompt:
      'Buatkan jadwal ASAS (Asesmen Sumatif Akhir Semester) SMP selama 6 hari dari Senin sampai Sabtu, sertakan hari Sabtu, sesi 1: 08.00 - 09.30, sesi 2: 10.00 - 11.00, 1 pengawas per ruang, seluruh mata pelajaran lengkap, tetapkan pengawas cadangan.',
  },
  {
    id: 'asts_smp_morning_3sessions',
    title: 'ASTS Intensif 3 Sesi SMP (Pagi s/d Siang)',
    badge: '3 Sesi SMP',
    description: '3 sesi per hari (Jumat 2 sesi), alokasi ruang dan pengawas SMP proporsional.',
    prompt:
      'Buatkan jadwal ASTS intensif SMP 3 sesi per hari (sesi 1: 08.00 - 09.30, sesi 2: 10.00 - 11.00, sesi 3: 11.00 - 12.00), khusus hari Jumat 2 sesi sebelum sholat Jumat. Rombel SMP lengkap, 1 pengawas per ruang, bagi rata jadwal mengawas antar guru.',
  },
];

export const EXAM_AI_PROMPT_PRESETS_SMA: AIPromptPreset[] = [
  {
    id: 'asts_sma_standard_5days',
    title: 'ASTS SMA Standar (Ruang 6, 5 Hari, 12 Mapel)',
    badge: 'SMA As Salaam',
    description: 'Senin s/d Jumat, Ruang 6, sesi 1 (08.00-09.30), sesi 2 (10.00-11.00), sesi 3 (11.00-12.00).',
    prompt:
      'Tolong buatkan jadwal pengawasan ujian ASTS SMA Terpadu As Salaam tanggal 28 September sampai 2 Oktober 2026 untuk kelas 10, 11, 12 (Ruang 6).\n\n' +
      'Waktu sesi:\n' +
      '- Sesi 1: 08.00 - 09.30\n' +
      '- Sesi 2: 10.00 - 11.00\n' +
      '- Sesi 3: 11.00 - 12.00\n\n' +
      'Pembagian sesi per hari:\n' +
      '- Senin, 28 September 2026: 2 sesi (1. PAI, 2. Biologi)\n' +
      '- Selasa, 29 September 2026: 2 sesi (1. Matematika, 2. Pendidikan Pancasila)\n' +
      '- Rabu, 30 September 2026: 3 sesi (1. B. Indonesia, 2. Akuntansi, 3. B. Arab)\n' +
      '- Kamis, 1 Oktober 2026: 3 sesi (1. B. Inggris, 2. Ekonomi, 3. Informatika)\n' +
      '- Jum\'at, 2 Oktober 2026: 2 sesi (1. Hadits, 2. BTQ)\n\n' +
      'Alokasi guru pengawas per mata pelajaran P6:\n' +
      'PAI: P6 = Nurul Farhiya\n' +
      'Biologi: P6 = Qodiatul Asrof Ramadhoni\n' +
      'Matematika: P6 = Qodiatul Asrof Ramadhoni\n' +
      'Pendidikan Pancasila: P6 = Dafa Maulana\n' +
      'B. Indonesia: P6 = Qodiatul Asrof Ramadhoni\n' +
      'Akuntansi: P6 = Mawar Andinia\n' +
      'B. Arab: P6 = Ridho Maulana Al Farizi\n' +
      'B. Inggris: P6 = Ridho Maulana Al Farizi\n' +
      'Ekonomi: P6 = Muhammad Iqbal Gustiawan\n' +
      'Informatika: P6 = Nurul Farhiya\n' +
      'Hadits: P6 = Muhammad Iqbal Gustiawan\n' +
      'BTQ: P6 = Ridho Maulana Al Farizi\n\n' +
      'Mohon terapkan penugasan pengawas di atas secara tepat tanpa mengubah urutan guru pengawas untuk masing-masing mata pelajaran.',
  },
  {
    id: 'asts_sma_quick_all',
    title: 'ASTS Kilat SMA (Semua Rombel SMA)',
    badge: 'Instan SMA',
    description: 'Jadwal otomatis 5 hari kerja untuk seluruh rombel SMA (10, 11, 12) dan guru aktif.',
    prompt:
      'Buatkan jadwal ASTS kilat untuk semua rombel SMA yang ada, sesi 1: 08.00 - 09.30, sesi 2: 10.00 - 11.00, sesi 3: 11.00 - 12.00, semua guru aktif ditugaskan mengawas secara adil dan merata, 1 pengawas per ruang, jangan mengawas mapel sendiri.',
  },
  {
    id: 'asas_sma_6days_saturday',
    title: 'ASAS Lengkap 6 Hari SMA (Termasuk Sabtu)',
    badge: 'Semester SMA',
    description: 'Senin s/d Sabtu, 2 sesi per hari, seluruh mata pelajaran SMA lengkap dan tetapkan pengawas cadangan.',
    prompt:
      'Buatkan jadwal ASAS (Asesmen Sumatif Akhir Semester) SMA selama 6 hari dari Senin sampai Sabtu, sertakan hari Sabtu, sesi 1: 08.00 - 09.30, sesi 2: 10.00 - 11.00, 1 pengawas per ruang, seluruh mata pelajaran SMA lengkap, tetapkan pengawas cadangan.',
  },
  {
    id: 'asts_sma_morning_3sessions',
    title: 'ASTS Intensif 3 Sesi SMA (Pagi s/d Siang)',
    badge: '3 Sesi SMA',
    description: '3 sesi per hari (Jumat 2 sesi), alokasi ruang dan pengawas SMA proporsional.',
    prompt:
      'Buatkan jadwal ASTS intensif SMA 3 sesi per hari (sesi 1: 08.00 - 09.30, sesi 2: 10.00 - 11.00, sesi 3: 11.00 - 12.00), khusus hari Jumat 2 sesi sebelum sholat Jumat. Rombel SMA lengkap, 1 pengawas per ruang, bagi rata jadwal mengawas antar guru.',
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
   * Parses custom session time slots from Indonesian prompt.
   * e.g. "Sesi 1: 08.00 - 09.30", "Sesi 2: 10:00 - 11:00", etc.
   */
  public static parseSessionTimesFromPrompt(prompt: string): SessionTimeSlot[] {
    const sessionRegex = /(?:sesi|session)\s*(\d+)\s*[:=\-]\s*(\d{1,2}[:.]\d{2})\s*(?:-|s\/?d|sampai)\s*(\d{1,2}[:.]\d{2})/gi;
    const slots: SessionTimeSlot[] = [];
    let m: RegExpExecArray | null;
    while ((m = sessionRegex.exec(prompt || '')) !== null) {
      const sNum = parseInt(m[1], 10);
      const start = m[2].replace('.', ':').padStart(5, '0');
      const end = m[3].replace('.', ':').padStart(5, '0');
      if (sNum >= 1 && sNum <= 6) {
        slots.push({
          sessionNumber: sNum,
          sessionName: `Sesi ${sNum}`,
          startTime: start,
          endTime: end,
        });
      }
    }
    slots.sort((a, b) => a.sessionNumber - b.sessionNumber);
    return slots;
  }

  /**
   * Parses per-day session allocations and subject sequences from Indonesian prompt.
   * Supports:
   * "* Senin, 28 September 2026: 2 sesi (1. PAI, 2. IPA)"
   * "* Jum'at, 2 Oktober 2026: 2 sesi (1. Hadits, 2. BTQ)"
   */
  public static parseDailySessionPlanFromPrompt(prompt: string): {
    perDaySessions: Map<string, number>;
    perDaySubjects: Map<string, string[]>;
  } {
    const dayNameMap: Record<string, string> = {
      senin: 'senin',
      selasa: 'selasa',
      rabu: 'rabu',
      kamis: 'kamis',
      jumat: 'jumat',
      "jum'at": 'jumat',
      "jum’at": 'jumat',
      sabtu: 'sabtu',
    };

    const perDaySessions = new Map<string, number>();
    const perDaySubjects = new Map<string, string[]>();

    const lines = (prompt || '').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const dayMatch = line.match(
        /^[*\-•\s]*(senin|selasa|rabu|kamis|jum['’]?at|sabtu)\b(?:[^:\n]*?)[:=\-]\s*(\d+)\s*(?:sesi|mata\s*pelajaran|mapel)?(?:\s*\((.*?)\))?/i
      );

      if (dayMatch) {
        const dayRaw = dayMatch[1].toLowerCase();
        const dayKey = dayNameMap[dayRaw] || dayRaw;
        const count = parseInt(dayMatch[2], 10);
        const parenContent = dayMatch[3];

        if (count >= 1 && count <= 6) {
          perDaySessions.set(dayKey, count);
        }

        if (parenContent) {
          const rawItems = parenContent.split(/[,;]/);
          const subjs: string[] = [];
          for (const item of rawItems) {
            const cleanItem = item.replace(/^\s*\d+[\.\)]\s*/, '').trim();
            if (cleanItem) subjs.push(cleanItem);
          }
          if (subjs.length > 0) {
            perDaySubjects.set(dayKey, subjs);
            if (!perDaySessions.has(dayKey)) {
              perDaySessions.set(dayKey, subjs.length);
            }
          }
        }
      }
    }

    return { perDaySessions, perDaySubjects };
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

    // Pre-load complementary level proctors to guarantee zero clash between SMP and SMA
    if (params.educationLevel && !parsedConfig.existingCrossLevelProctors) {
      try {
        const compLevel = params.educationLevel === 'SMP' ? 'SMA' : 'SMP';
        const existingComp = await ExamScheduleRepository.getSchedule(
          parsedConfig.academicYear,
          parsedConfig.examType,
          compLevel
        );
        if (existingComp && existingComp.proctorSchedules?.length > 0) {
          parsedConfig.existingCrossLevelProctors = existingComp.proctorSchedules;
        }
      } catch {}
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

    if (parsedConfig.isCustomSchedule) {
      schedule.isCustomSchedule = true;
      schedule.config.isCustomSchedule = true;
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
      { "sessionNumber": 1, "sessionName": "Sesi 1 (Pagi)", "startTime": "08:00", "endTime": "09:30" },
      { "sessionNumber": 2, "sessionName": "Sesi 2 (Siang)", "startTime": "10:00", "endTime": "11:00" },
      { "sessionNumber": 3, "sessionName": "Sesi 3 (Siang)", "startTime": "11:00", "endTime": "12:00" }
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

    // 2. Parse daily session plan and custom session times from prompt
    const dailyPlan = this.parseDailySessionPlanFromPrompt(prompt);
    const parsedSessionSlots = this.parseSessionTimesFromPrompt(prompt);

    // 2b. Detect Saturday inclusion
    const mentionsSaturday =
      /\b(sabtu|enam\s*hari|6\s*hari|senin\s*(?:sampai|s\/?d|-)\s*sabtu)\b/i.test(prompt);
    const preliminaryDates = this.extractDatesFromPrompt(prompt, false);
    const isEndDateSaturday = new Date(preliminaryDates.endDate).getDay() === 6;

    const includeSaturday = mentionsSaturday || isEndDateSaturday;

    // 3. Extract Dates
    const { startDate, endDate } = this.extractDatesFromPrompt(prompt, includeSaturday);

    // 4. Detect per-day session/subject count overrides from Indonesian prompt
    // Supports: "Rabu 3 sesi", "Kamis 3 mata pelajaran", "Senin 2 mapel",
    //           "Rabu dan Kamis terdiri dari 3 mata pelajaran", etc.
    const dayNameMap: Record<string, string> = {
      senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu',
      kamis: 'Kamis', jumat: 'Jumat', "jum'at": 'Jumat', "jum’at": 'Jumat', sabtu: 'Sabtu',
    };
    const perDaySessionOverrides = new Map<string, number>();

    // First populate from structured daily session plan if detected
    dailyPlan.perDaySessions.forEach((count, dk) => {
      perDaySessionOverrides.set(dk, count);
    });

    // Pattern 1: Multi-day lists or conjunctions
    const multiDayPattern = /(?:(?:senin|selasa|rabu|kamis|jum['’]?at|sabtu)(?:,\s*|\s+dan\s+|\s+))+\s*[:=\-]?\s*(?:masing-masing\s+|terdiri\s+dari\s+|memiliki\s+|sebanyak\s+|ada\s+)?(\d+)\s*(?:sesi|mata\s*pelajaran|mapel|mata\s*pel)/gi;
    let mm: RegExpExecArray | null;
    while ((mm = multiDayPattern.exec(text)) !== null) {
      const fullMatch = mm[0];
      const count = parseInt(mm[1], 10);
      if (count >= 1 && count <= 4) {
        const daysFound: string[] = (fullMatch.match(/\b(senin|selasa|rabu|kamis|jum['’]?at|sabtu)\b/gi) || []) as string[];
        daysFound.forEach((d: string) => {
          const dk = d.toLowerCase().replace(/['’]/g, '');
          if (!perDaySessionOverrides.has(dk) && dayNameMap[dk]) perDaySessionOverrides.set(dk, count);
        });
      }
    }

    // Pattern 2: Single day with count (supports bullet points, colons, and dates in between)
    // e.g. "* Senin, 28 September 2026: 2 sesi", "Rabu 3 mata pelajaran", "Kamis: 3 sesi", "Senin 2 mapel"
    const singleDayPattern = /\b(senin|selasa|rabu|kamis|jum['’]?at|sabtu)\b(?:[^:\n]*?)[:=\-]?\s*(?:terdiri\s+dari\s+|memiliki\s+|hanya\s+|cukup\s+|sebanyak\s+)?(\d+)\s*(?:sesi|mata\s*pelajaran|mapel|mata\s*pel)/gi;
    let sm: RegExpExecArray | null;
    while ((sm = singleDayPattern.exec(text)) !== null) {
      const dayKey = sm[1].toLowerCase().replace(/['’]/g, '');
      const count = parseInt(sm[2], 10);
      if (count >= 1 && count <= 4 && dayNameMap[dayKey] && !perDaySessionOverrides.has(dayKey)) {
        perDaySessionOverrides.set(dayKey, count);
      }
    }

    // Pattern 3: Inverted count then day:
    // e.g. "3 mata pelajaran pada hari rabu dan kamis", "2 sesi untuk hari jumat"
    const invertedPattern = /(\d+)\s*(?:sesi|mata\s*pelajaran|mapel|mata\s*pel)\s*(?:per\s+hari\s+)?(?:pada\s+hari\s+|untuk\s+hari\s+|khusus\s+hari\s+|hari\s+)(senin|selasa|rabu|kamis|jum['’]?at|sabtu)/gi;
    let im: RegExpExecArray | null;
    while ((im = invertedPattern.exec(text)) !== null) {
      const count = parseInt(im[1], 10);
      const dayKey = im[2].toLowerCase().replace(/['’]/g, '');
      if (count >= 1 && count <= 4 && dayNameMap[dayKey] && !perDaySessionOverrides.has(dayKey)) {
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

    // 5. Default or prompt-parsed session time slots
    const defaultSlots: SessionTimeSlot[] = [
      { sessionNumber: 1, sessionName: 'Sesi 1 (Pagi)', startTime: '08:00', endTime: '09:30' },
      { sessionNumber: 2, sessionName: 'Sesi 2 (Menjelang Siang)', startTime: '10:00', endTime: '11:00' },
      { sessionNumber: 3, sessionName: 'Sesi 3 (Siang)', startTime: '11:00', endTime: '12:00' },
      { sessionNumber: 4, sessionName: 'Sesi 4 (Tambahan)', startTime: '13:00', endTime: '14:30' },
    ];
    let sessionSlots: SessionTimeSlot[] = parsedSessionSlots.length > 0
      ? [...parsedSessionSlots]
      : defaultSlots.slice(0, Math.max(effectiveMaxSessions, 2));

    if (sessionSlots.length < effectiveMaxSessions) {
      for (let s = sessionSlots.length + 1; s <= effectiveMaxSessions; s++) {
        const def = defaultSlots[s - 1] || { sessionNumber: s, sessionName: `Sesi ${s}`, startTime: '13:00', endTime: '14:30' };
        sessionSlots.push(def);
      }
    }

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
      const dayKey = d.dayName.toLowerCase().replace(/['’]/g, '');
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
        sessionSlots: sessionSlots.slice(0, sessionsForDay),
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
    const orderedSubjectsFromPlan: string[] = [];
    if (dailyPlan.perDaySubjects.size > 0) {
      validDates.forEach((d) => {
        const dayKey = d.dayName.toLowerCase().replace(/['’]/g, '');
        const daySubjs = dailyPlan.perDaySubjects.get(dayKey);
        if (daySubjs && daySubjs.length > 0) {
          orderedSubjectsFromPlan.push(...daySubjs);
        }
      });
    }

    let selectedSubjects = [...params.availableSubjects];
    if (orderedSubjectsFromPlan.length > 0) {
      // Prioritize explicit day-by-day plan subject sequence
      selectedSubjects = orderedSubjectsFromPlan;
    } else if (hasCustomMatrix) {
      // Strictly maintain the subjects and their exact sequence from user matrix
      selectedSubjects = [...customMatrix.detectedSubjects];
    } else {
      if (selectedSubjects.length === 0) {
        selectedSubjects =
          effectiveLevel === 'SMA'
            ? [
                'PAI',
                'Biologi',
                'Matematika',
                'Pendidikan Pancasila',
                'B. Indonesia',
                'Akuntansi',
                'B. Arab',
                'B. Inggris',
                'Ekonomi',
                'Informatika',
                'Hadits',
                'BTQ',
              ]
            : [
                'PAI',
                'IPA',
                'MTK',
                'PP',
                'B. Indonesia',
                'IPS',
                'B. Arab',
                'B. Inggris',
                'SBPK',
                'Informatika',
                'Hadits',
                'BTQ',
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
      isCustomSchedule: hasCustomMatrix || (dailyPlan.perDaySessions.size > 0),
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
      isCustomSchedule: fallback.isCustomSchedule ?? false,
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
