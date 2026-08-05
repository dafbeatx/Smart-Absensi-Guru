import { APP_CONFIG } from '../config/app.config';
import { isFeatureEnabled } from '../config/feature-flags.config';
import { logger } from '../utils/logger.utils';

export interface LeaveAnalysisResult {
  polishedReason: string;
  recommendation: 'RECOMMENDED_APPROVE' | 'NEEDS_CLARIFICATION' | 'STANDARD_REVIEW';
  confidence: number;
  summary: string;
}

export interface AttendanceMetricsPayload {
  totalTeachers: number;
  presentCount: number;
  lateCount: number;
  leaveCount: number;
  absentCount: number;
  dateStr?: string;
}

export class GroqAIService {
  private static API_URL = 'https://api.groq.com/openai/v1/chat/completions';

  /**
   * Helper method to call Groq API directly with fallback handling
   */
  private static async callGroqAPI(messages: Array<{ role: string; content: string }>): Promise<string | null> {
    if (!isFeatureEnabled('ENABLE_AI_ASSISTANT')) {
      logger.warn('GroqAIService', 'AI Assistant feature flag is disabled');
      return null;
    }

    const apiKey = APP_CONFIG.GROQ_API_KEY;
    const model = APP_CONFIG.GROQ_MODEL || 'llama-3.3-70b-versatile';

    if (!apiKey || apiKey.includes('YOUR_') || apiKey.trim() === '') {
      logger.warn('GroqAIService', 'GROQ API key is missing or default');
      return null;
    }

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          max_tokens: 600,
        }),
      });

      if (!response.ok) {
        logger.error('GroqAIService', `Groq API responded with status ${response.status}`);
        return null;
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      return text ? text.trim() : null;
    } catch (error) {
      logger.error('GroqAIService', 'Failed to communicate with Groq API:', error);
      return null;
    }
  }

  /**
   * Refines raw teacher leave / correction reason into formal Indonesian text & gives approval recommendation
   */
  public static async analyzeLeaveReason(
    rawReason: string,
    leaveType: string = 'IZIN'
  ): Promise<LeaveAnalysisResult> {
    if (!rawReason || !rawReason.trim()) {
      return {
        polishedReason: 'Mohon maaf, alasan pengajuan belum diisi.',
        recommendation: 'NEEDS_CLARIFICATION',
        confidence: 0,
        summary: 'Alasan tidak diisi.',
      };
    }

    const prompt = `Anda adalah Asisten Administrasi Sekolah di SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam.
Tugas Anda: Rapikan alasan permohonan ${leaveType} dari seorang guru agar menggunakan bahasa Indonesia yang formal, santun, dan jelas.

Alasan Mentah Guru: "${rawReason}"

Berikan respon HANYA dalam format JSON persis seperti berikut (tanpa markdown backtick):
{
  "polishedReason": "alasan formal yang disempurnakan",
  "recommendation": "RECOMMENDED_APPROVE",
  "confidence": 0.95,
  "summary": "ringkasan 1 kalimat"
}`;

    const apiOutput = await this.callGroqAPI([
      { role: 'system', content: 'Anda adalah asisten AI sekolah yang merespon dalam format JSON valid.' },
      { role: 'user', content: prompt },
    ]);

    if (apiOutput) {
      try {
        const cleaned = apiOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          polishedReason: parsed.polishedReason || rawReason,
          recommendation: parsed.recommendation || 'RECOMMENDED_APPROVE',
          confidence: parsed.confidence || 0.9,
          summary: parsed.summary || 'Pengajuan diproses secara otomatis oleh AI.',
        };
      } catch (err) {
        logger.warn('GroqAIService', 'Failed to parse Groq JSON response, using text fallback', err);
      }
    }

    // Smart Local Fallback Response (if offline / missing API key)
    const trimmed = rawReason.trim();
    const formalPrefix = leaveType === 'CUTI' ? 'Mengajukan permohonan cuti resmi dikarenakan ' : 'Mengajukan permohonan izin tidak masuk dikarenakan ';
    const polished = trimmed.length < 15 ? `${formalPrefix}${trimmed.toLowerCase()}. Keterangan lebih lanjut telah dikonfirmasi ke pihak sekolah.` : trimmed;

    return {
      polishedReason: polished,
      recommendation: trimmed.length > 10 ? 'RECOMMENDED_APPROVE' : 'NEEDS_CLARIFICATION',
      confidence: 0.85,
      summary: 'Teks disempurnakan dengan Smart Local AI Engine.',
    };
  }

  /**
   * Generates a narrative executive summary of daily attendance metrics for Kepsek
   */
  public static async generateExecutiveSummary(metrics: AttendanceMetricsPayload): Promise<string> {
    const prompt = `Anda adalah Asisten Eksekutif Kepala Sekolah.
Buatkan 1 paragraf ringkasan eksekutif yang profesional dan singkat mengenai kehadiran guru hari ini berdasarkan data berikut:
- Total Guru: ${metrics.totalTeachers}
- Hadir Tepat Waktu: ${metrics.presentCount}
- Terlambat: ${metrics.lateCount}
- Izin / Cuti: ${metrics.leaveCount}
- Alpa / Belum Absen: ${metrics.absentCount}

Berikan respon dalam bahasa Indonesia yang ringkas, menyemangati, dan menyoroti persentase kehadiran.`;

    const apiOutput = await this.callGroqAPI([
      { role: 'system', content: 'Anda adalah Asisten Eksekutif Kepala Sekolah yang profesional.' },
      { role: 'user', content: prompt },
    ]);

    if (apiOutput) return apiOutput;

    // Smart Local Fallback Summary
    const pct = metrics.totalTeachers > 0 ? Math.round(((metrics.presentCount + metrics.lateCount) / metrics.totalTeachers) * 100) : 0;
    return `Laporan Kehadiran Guru: Sebanyak ${metrics.presentCount} dari ${metrics.totalTeachers} guru hadir tepat waktu (Tingkat kehadiran: ${pct}%). Terdapat ${metrics.lateCount} guru terlambat dan ${metrics.leaveCount} guru mengajukan izin/cuti.`;
  }

  /**
   * Smart Assistant Chatbot Endpoint for user Q&A
   */
  public static async askSmartAssistant(question: string, userRole: string = 'GURU'): Promise<string> {
    if (!question || !question.trim()) {
      return 'Halo! Ada yang bisa saya bantu terkait absensi atau jadwal sekolah hari ini?';
    }

    const prompt = `Anda adalah "Smart AI Assistant" untuk aplikasi Smart Absensi Guru (SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam).
Pengguna adalah seorang ${userRole}.
Pertanyaan Pengguna: "${question}"

Berikan jawaban yang ramah, singkat, akurat, dan membantu dalam bahasa Indonesia.`;

    const apiOutput = await this.callGroqAPI([
      { role: 'system', content: 'Anda adalah Smart AI Assistant yang sopan, ramah, dan berpengetahuan luas tentang absensi sekolah.' },
      { role: 'user', content: prompt },
    ]);

    if (apiOutput) return apiOutput;

    // Smart Local Fallback Q&A
    const q = question.toLowerCase();
    if (q.includes('absen') || q.includes('scan') || q.includes('qr') || q.includes('barcode')) {
      return 'Untuk melakukan presensi, buka menu "Pindai QR Code" di dashboard, lalu arahkan kamera ke QR Code/Barcode di pintu kantor sekolah. Jika terjadi kendala scan, Anda dapat menggunakan tombol "Input Kode Manual" atau "Absen via GPS".';
    }
    if (q.includes('cuti') || q.includes('izin') || q.includes('sakit')) {
      return 'Permohonan izin atau cuti dapat diajukan melalui menu "Pengajuan Izin / Cuti". Sertakan alasan yang jelas dan upload foto surat pendukung (jika ada) untuk disetujui Kepala Sekolah.';
    }
    if (q.includes('jam') || q.includes('jadwal') || q.includes('terlambat')) {
      return 'Batas jam masuk presensi tepat waktu adalah pukul 07:00 WIB. Presensi yang dilakukan setelah pukul 07:00 WIB akan dicatat sebagai "Terlambat".';
    }

    return `Terima kasih atas pertanyaan Anda mengenai "${question}". Poin utama presensi sekolah berjalan sesuai aturan geofence GPS dan QR Code resmi.`;
  }
}
