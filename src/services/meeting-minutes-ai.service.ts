// src/services/meeting-minutes-ai.service.ts
import type { MeetingFormattedContent, MeetingActionItem } from '../types/meeting-minutes.types';

export interface AIRestructureInput {
  title: string;
  roughNotes: string;
  meetingType?: string;
  leaderName?: string;
  secretaryName?: string;
  date?: string;
  attendeesSummary?: string;
}

export class MeetingMinutesAIService {
  /**
   * Main entry point to format rough notes into professional Indonesian school meeting minutes.
   * Leverages Groq AI via serverless proxy /api/ai with automatic deterministic rule-based fallback.
   */
  public static async restructureNotes(input: AIRestructureInput): Promise<{
    formattedContent: MeetingFormattedContent;
    source: 'AI_GROQ' | 'LOCAL_RULE_PARSER';
  }> {
    const cleanRough = (input.roughNotes || '').trim();
    if (!cleanRough) {
      return {
        formattedContent: {
          executiveSummary: 'Belum ada catatan rapat yang diinputkan.',
          agendaPoints: ['Pencatatan rapat belum dimulai.'],
          keyDecisions: ['Belum ada keputusan resmi yang disepakati.'],
          actionItems: [],
          additionalNotes: 'Silakan ketikkan poin-poin jalannya rapat pada kolom catatan.',
        },
        source: 'LOCAL_RULE_PARSER',
      };
    }

    try {
      const aiResult = await this.callAIProxy(input);
      if (aiResult) {
        return {
          formattedContent: aiResult,
          source: 'AI_GROQ',
        };
      }
    } catch (err) {
      console.warn('MeetingMinutesAIService: /api/ai proxy failed, falling back to local rule-based parser:', err);
    }

    // Deterministic fallback parser
    const fallbackResult = this.parseRoughNotesDeterministic(input);
    return {
      formattedContent: fallbackResult,
      source: 'LOCAL_RULE_PARSER',
    };
  }

  /**
   * Calls /api/ai serverless proxy with a strict JSON format prompt
   */
  private static async callAIProxy(input: AIRestructureInput): Promise<MeetingFormattedContent | null> {
    const prompt = `Anda adalah Sekretaris Notulis Profesional Sekolah dan Asisten AI Resmi Administrasi Pendidikan.
Tugas Anda adalah merapikan catatan rapat sekolah yang berantakan, singkatan, coretan acak, atau teks mentah menjadi RISALAH RAPAT RESMI berbahasa Indonesia baku dan formal.

DATA RAPAT:
- Topik / Judul: ${input.title}
- Jenis Rapat: ${input.meetingType || 'Rapat Dinas'}
- Pimpinan Rapat: ${input.leaderName || 'Pimpinan Sekolah'}
- Tanggal: ${input.date || 'Hari ini'}

CATATAN MENTAH (TEKS BERANTAKAN DARI NOTULIS):
"""
${input.roughNotes}
"""

ATURAN RESTRUKTURISASI:
1. Perbaiki ejaan, tata bahasa, dan istilah singkatan (misal: PTS/PAS/ASTS/ASAS/KBM/BK/WKS/Kepsek/Ortu/dsb).
2. Susun menjadi format JSON murni TANPA markdown (\`\`\`json) dengan struktur persis berikut:
{
  "executiveSummary": "Ringkasan eksekutif 2-3 kalimat yang padat, formal, dan komprehensif mengenai latar belakang dan hasil inti rapat.",
  "agendaPoints": [
    "Poin pembahasan 1",
    "Poin pembahasan 2"
  ],
  "keyDecisions": [
    "Keputusan resmi rapat 1 yang telah disepakati",
    "Keputusan resmi rapat 2"
  ],
  "actionItems": [
    {
      "task": "Rincian tugas / tindak lanjut yang harus dilakukan",
      "pic": "Nama orang atau jabatan penanggung jawab (misal: Wakasek Kurikulum, Wali Kelas 9, Pak Budi, dsb)",
      "deadline": "Batas waktu atau 'Segera'"
    }
  ],
  "additionalNotes": "Catatan penutup, jadwal rapat lanjutan, atau pengingat penting bagi dewan guru."
}
HANYA kembalikan JSON valid, jangan tambahkan teks sambutan apa pun.`;

    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are an expert Indonesian educational meeting minute restructuring engine. You strictly output valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const resJson = await response.json();
    if (!resJson.success || !resJson.content) {
      return null;
    }

    const rawText = String(resJson.content).trim();
    // Strip markdown code block if present
    const cleanedJsonStr = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleanedJsonStr);
    if (!parsed.executiveSummary || !Array.isArray(parsed.agendaPoints)) {
      return null;
    }

    const actionItems: MeetingActionItem[] = (parsed.actionItems || []).map((item: any, idx: number) => ({
      id: `act_${Date.now()}_${idx}`,
      task: String(item.task || item.deskripsi || item.tugas || '').trim(),
      pic: String(item.pic || item.penanggung_jawab || 'Seluruh Guru').trim(),
      deadline: item.deadline ? String(item.deadline).trim() : undefined,
      status: 'PENDING' as const,
    })).filter((item: MeetingActionItem) => item.task.length > 0);

    return {
      executiveSummary: String(parsed.executiveSummary).trim(),
      agendaPoints: (parsed.agendaPoints || []).map((p: any) => String(p).trim()).filter(Boolean),
      keyDecisions: (parsed.keyDecisions || []).map((k: any) => String(k).trim()).filter(Boolean),
      actionItems,
      additionalNotes: parsed.additionalNotes ? String(parsed.additionalNotes).trim() : undefined,
    };
  }

  /**
   * Deterministic local rule-based restructuring engine.
   * Analyzes bullet points, keywords (PIC, deadline, keputusan, sepakat, dll) and groups into sections.
   */
  public static parseRoughNotesDeterministic(input: AIRestructureInput): MeetingFormattedContent {
    const rawLines = (input.roughNotes || '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const agendaPoints: string[] = [];
    const keyDecisions: string[] = [];
    const actionItems: MeetingActionItem[] = [];
    const otherNotes: string[] = [];

    const decisionKeywords = ['putusan', 'keputusan', 'sepakat', 'disepakati', 'memutuskan', 'hasil', 'disetujui', 'ditetapkan', 'final'];
    const actionKeywords = ['pic:', 'pic ', 'tugas:', 'pj:', 'penanggung jawab', 'deadline:', 'target:', 'oleh:', 'segera', 'tindak lanjut'];

    let actionCounter = 1;

    for (const rawLine of rawLines) {
      // Strip leading bullet marks: -, *, •, 1., 2)
      const cleanLine = rawLine.replace(/^[-*•–—]\s*/, '').replace(/^\d+[\.\)]\s*/, '').trim();
      if (!cleanLine) continue;

      const lower = cleanLine.toLowerCase();

      // Check if line represents an Action Item
      const hasActionKeyword = actionKeywords.some((kw) => lower.includes(kw));
      if (hasActionKeyword || lower.startsWith('tugas') || lower.startsWith('tindak')) {
        let pic = 'Pendidik / Panitia Terkait';
        let deadline: string | undefined = undefined;
        let task = cleanLine;

        // Try extracting PIC
        const picMatch = cleanLine.match(/(?:pic|pj|penanggung\s*jawab|oleh)[\s*:]+([^\,\;\.]+)/i);
        if (picMatch && picMatch[1]) {
          pic = picMatch[1].trim();
        }

        // Try extracting Deadline
        const deadlineMatch = cleanLine.match(/(?:deadline|target|batas\s*waktu|maksimal|s\/d|tanggal)[\s*:]+([^\,\;\.]+)/i);
        if (deadlineMatch && deadlineMatch[1]) {
          deadline = deadlineMatch[1].trim();
        }

        // Clean task description from tags
        task = task.replace(/(?:pic|pj|penanggung\s*jawab|oleh)[\s*:]+([^\,\;\.]+)/gi, '')
          .replace(/(?:deadline|target|batas\s*waktu|maksimal)[\s*:]+([^\,\;\.]+)/gi, '')
          .trim()
          .replace(/^[-–—:,]\s*/, '')
          .trim();

        if (!task) task = cleanLine;

        actionItems.push({
          id: `act_det_${Date.now()}_${actionCounter++}`,
          task: task,
          pic: pic,
          deadline: deadline || 'Sesuai Jadwal KBM',
          status: 'PENDING',
        });
        continue;
      }

      // Check if line represents a Decision
      const hasDecisionKeyword = decisionKeywords.some((kw) => lower.includes(kw));
      if (hasDecisionKeyword) {
        keyDecisions.push(cleanLine);
        continue;
      }

      // Agenda point or discussion point
      if (cleanLine.length > 15) {
        agendaPoints.push(cleanLine);
      } else {
        otherNotes.push(cleanLine);
      }
    }

    // If no agenda points found, fallback to all lines
    if (agendaPoints.length === 0 && rawLines.length > 0) {
      agendaPoints.push(...rawLines.slice(0, 5));
    }

    // If no decisions explicitly matched, use the first strong line or generate appropriate summary
    if (keyDecisions.length === 0) {
      if (agendaPoints.length > 0) {
        keyDecisions.push(`Seluruh peserta rapat menyepakati agenda pembahasan terkait ${input.title}.`);
      } else {
        keyDecisions.push('Kesepakatan teknis mengacu pada arahan dan koordinasi pimpinan rapat.');
      }
    }

    const executiveSummary = `Rapat koordinasi "${input.title}" telah diselenggarakan dengan pimpinan rapat ${input.leaderName || 'Kepala Sekolah/Wakasek'}. Pertemuan ini membahas ${agendaPoints.length} pokok agenda utama dan menghasilkan ${keyDecisions.length} poin keputusan bersama yang wajib ditindaklanjuti demi kelancaran kegiatan sekolah.`;

    return {
      executiveSummary,
      agendaPoints: agendaPoints.length > 0 ? agendaPoints : ['Pembahasan koordinasi dan penyelarasan program kerja sekolah.'],
      keyDecisions,
      actionItems,
      additionalNotes: otherNotes.length > 0 ? otherNotes.join('. ') : 'Risalah ini dicatat secara resmi dan berlaku bagi seluruh dewan guru serta staf sekolah.',
    };
  }
}
