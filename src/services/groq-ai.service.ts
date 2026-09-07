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

export interface ScanRejectionDiagnosisParams {
  rawQrData?: string;
  distanceMeters?: number;
  allowedRadius?: number;
  gpsAccuracy?: number;
  userRole?: string;
  errorType: 'INVALID_QR' | 'OUT_OF_GEOFENCE' | 'MISSING_GPS' | 'CAMERA_ERROR' | 'UNKNOWN';
}

export interface ScanRejectionDiagnosisResult {
  diagnosisTitle: string;
  diagnosisDetail: string;
  actionSuggestion: string;
  suggestedFixMethod: 'MANUAL_CODE' | 'GPS_BYPASS' | 'RETRY' | 'AUTO_CORRECTION';
  prefilledCorrectionReason: string;
}

export class GroqAIService {
  private static API_URL = 'https://api.groq.com/openai/v1/chat/completions';

  /**
   * Diagnoses barcode/QR code scan rejection and generates AI solution & auto-correction draft
   */
  public static async diagnoseScanRejection(
    params: ScanRejectionDiagnosisParams
  ): Promise<ScanRejectionDiagnosisResult> {
    const role = params.userRole || 'GURU';

    const prompt = `Anda adalah "AI Barcode Diagnostic Engine" untuk aplikasi Smart Absensi Guru.
Pengguna (${role}) mengalami penolakan (REJECTED) saat mencoba scan barcode/QR presensi.

Data Diagnosa:
- Tipe Failure: ${params.errorType}
- Scanned Text: "${params.rawQrData || 'N/A'}"
- Jarak terdeteksi: ${params.distanceMeters ?? 'N/A'} meter (Radius Maksimum: ${params.allowedRadius ?? 100} meter)
- Akurasi GPS HP: ±${params.gpsAccuracy ?? 'N/A'} meter

Berikan analisis diagnosa mendalam dan berikan HANYA format JSON berikut (tanpa markdown codeblock):
{
  "diagnosisTitle": "judul singkat diagnosa AI",
  "diagnosisDetail": "penjelasan detail 1-2 kalimat mengapa scan direject",
  "actionSuggestion": "langkah praktis perbaikan untuk user",
  "suggestedFixMethod": "MANUAL_CODE",
  "prefilledCorrectionReason": "kalimat alasan koreksi otomatis yang siap dikirim"
}
*Note for suggestedFixMethod: pilihlah salah satu dari ["MANUAL_CODE", "GPS_BYPASS", "RETRY", "AUTO_CORRECTION"]*`;

    const apiOutput = await this.callGroqAPI([
      { role: 'system', content: 'Anda adalah AI Barcode Diagnostic Engine yang membalas HANYA dalam JSON valid.' },
      { role: 'user', content: prompt },
    ]);

    if (apiOutput) {
      try {
        const cleaned = apiOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          diagnosisTitle: parsed.diagnosisTitle || 'Analisis Diagnosa AI',
          diagnosisDetail: parsed.diagnosisDetail || 'Terjadi kendala verifikasi barcode/lokasi presensi.',
          actionSuggestion: parsed.actionSuggestion || 'Gunakan metode input kode manual atau koordinat GPS.',
          suggestedFixMethod: parsed.suggestedFixMethod || (params.errorType === 'INVALID_QR' ? 'MANUAL_CODE' : 'GPS_BYPASS'),
          prefilledCorrectionReason: parsed.prefilledCorrectionReason || `Pengajuan koreksi presensi ${role} karena kendala pemindaian barcode (${params.errorType}).`,
        };
      } catch (err) {
        logger.warn('GroqAIService', 'Failed to parse Groq AI diagnosis JSON, using smart fallback', err);
      }
    }

    // Smart Local Fallback Diagnosis Engine (if offline or API key missing)
    if (params.errorType === 'OUT_OF_GEOFENCE') {
      const dist = params.distanceMeters || 120;
      const radius = params.allowedRadius || 100;
      return {
        diagnosisTitle: '📍 Lokasi Terdeteksi Di Luar Radius Sekolah',
        diagnosisDetail: `HP Anda terdeteksi berada ${dist} meter dari pusat sekolah (batas maksimum ${radius}m). Hal ini biasanya terjadi karena pembacaan GPS meleset di dalam ruangan.`,
        actionSuggestion: 'Dekati area terbuka/pintu kantor atau gunakan tombol "Absen via GPS Sekolah".',
        suggestedFixMethod: 'GPS_BYPASS',
        prefilledCorrectionReason: `Pengajuan koreksi presensi ${role} akibat GPS meleset (${dist}m di luar radius ${radius}m saat di sekolah).`,
      };
    }

    if (params.errorType === 'INVALID_QR') {
      return {
        diagnosisTitle: '📷 Format Barcode / QR Tidak Dikenali',
        diagnosisDetail: `String barcode "${params.rawQrData || 'N/A'}" tidak sesuai dengan seed resmi sekolah. Kemungkinan poster terkena pantulan cahaya, buram, atau menggunakan format fisik lama.`,
        actionSuggestion: 'Gunakan tombol "Input Kode Barcode Manual" untuk mengetik kode poster langsung.',
        suggestedFixMethod: 'MANUAL_CODE',
        prefilledCorrectionReason: `Pengajuan koreksi presensi ${role} dikarenakan fisik barcode/QR poster di sekolah tidak terbaca sempurna.`,
      };
    }

    return {
      diagnosisTitle: '⚠️ Verifikasi Presensi Belum Berhasil',
      diagnosisDetail: 'Terjadi kendala sinyal atau pemindaian kamera saat memproses data presensi Anda.',
      actionSuggestion: 'Coba pindai ulang atau ajukan koreksi presensi otomatis ke Admin/Kepsek.',
      suggestedFixMethod: 'AUTO_CORRECTION',
      prefilledCorrectionReason: `Pengajuan koreksi presensi ${role} dikarenakan kendala sistem pemindaian barcode.`,
    };
  }

  /**
   * Helper method to call Groq API directly with fallback handling
   */
  private static async callGroqAPI(messages: Array<{ role: string; content: string }>): Promise<string | null> {
    if (!isFeatureEnabled('ENABLE_AI_ASSISTANT')) {
      logger.warn('GroqAIService', 'AI Assistant feature flag is disabled');
      return null;
    }

    const apiKey = APP_CONFIG.GROQ_API_KEY;
    const configuredModel = APP_CONFIG.GROQ_MODEL || 'qwen/qwen3.8-27b';

    if (!apiKey || apiKey.includes('YOUR_') || apiKey.trim() === '') {
      logger.warn('GroqAIService', 'GROQ API key is missing or default');
      return null;
    }

    const candidateModels = Array.from(new Set([configuredModel, 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']));

    for (const currentModel of candidateModels) {
      try {
        const response = await fetch(this.API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: currentModel,
            messages,
            temperature: 0.6,
            max_tokens: 1200,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          logger.warn('GroqAIService', `Model ${currentModel} returned ${response.status}:`, errData);
          if (response.status === 404 || errData?.error?.code === 'model_not_found') {
            continue; // try next candidate model
          }
          return null;
        }

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text && text.trim()) {
          return text.trim();
        }
      } catch (error) {
        logger.error('GroqAIService', `Failed to communicate with Groq API on model ${currentModel}:`, error);
      }
    }

    return null;
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

  /**
   * Telegram Admin AI Technical Assistant
   * Understands all bugs, errors, geofencing, QR codes, biometric, RFID, schedules, and Supabase architecture.
   */
  public static async answerTelegramAdminQuery(query: string, senderName?: string): Promise<string> {
    if (!query || !query.trim()) {
      return 'Halo! Silakan ketik pertanyaan atau kendala teknis/error yang ingin Anda tanyakan.';
    }

    const systemPrompt = `Kamu adalah asisten teknis Smart Absensi Guru (SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam).
Lawan bicaramu adalah Admin / Pengelola sekolah${senderName ? ` bernama ${senderName}` : ''}.

PEDOMAN GAYA BICARA (SANGAT PENTING):
1. Jawablah seperti MANUSIA ASLI yang ramah, santai tapi profesional, seperti rekan tim IT sekolah yang sigap dan asyik diajak diskusi di Telegram.
2. JANGAN seperti robot kaku. HINDARI kalimat pembuka formal yang kaku seperti "Berdasarkan arsitektur sistem...", "Sebagai mesin teknis...", dsb.
3. LANGSUNG ke inti jawaban secara padat, ringkas, dan jelas (cukup 2-3 paragraf pendek atau poin-poin ringkas). Sangat nyaman dibaca di layar HP.
4. Gunakan bahasa Indonesia natural sehari-hari yang sopan dan hangat (pakai emoji secukupnya agar bersahabat 😊).
5. WAJIB selalu menyelesaikan jawaban sampai tuntas dan ada titik/penutup, jangan sampai terpotong di tengah kalimat.

INFORMASI PENTING SISTEM:
- Jam Kerja & Pulang: Masuk sebelum 07:00 WIB. Pulang Senin-Kamis pukul 13:00 WIB, Jumat pukul 11:00 WIB.
- Masalah Scan QR: Sering kali karena QR Code di layar admin sudah expired/berganti. Cukup refresh QR di layar admin, atau minta guru ketik kode manual di bawah barcode. Pastikan izin kamera di browser HP aktif.
- Masalah GPS / Geofence: Radius normal 100m. Khusus scan QR poster pintu gerbang sekolah ada toleransi buffer 500m sehingga guru tetap bisa absen lancar. Kalau GPS mati/ditolak, cukup aktifkan izin lokasi di HP. Fake GPS otomatis ditolak.
- Jadwal Piket: Hari piket Senin sampai Jumat. Jika ada kendala simpan jadwal di admin, periksa RLS policy tabel gm_schedule di Supabase.
- Fitur Offline: Kalau internet mati, presensi aman tersimpan di HP guru dan otomatis terkirim saat online kembali.`;

    const apiOutput = await this.callGroqAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ]);

    if (apiOutput) return apiOutput;

    return this.getLocalTelegramFallbackAnswer(query);
  }

  /**
   * Smart local fallback answers for common queries if Groq API is offline
   */
  private static getLocalTelegramFallbackAnswer(query: string): string {
    const q = query.toLowerCase();

    if (q.includes('gps_002') || q.includes('luar radius') || q.includes('geofence')) {
      return (
        '📍 *Kendala Lokasi GPS di Luar Radius:*\n\n' +
        'Biasanya ini terjadi karena guru berdiri agak jauh dari titik tengah sekolah. Solusinya gampang:\n\n' +
        '1. Pastikan izin lokasi/GPS di HP aktif dalam mode akurasi tinggi.\n' +
        '2. Minta guru scan di **poster QR pintu gerbang sekolah**, karena ada toleransi buffer sampai **500 meter** sehingga pasti diterima.\n' +
        '3. Coba refresh monitor admin dan minta guru scan ulang ya! 😊'
      );
    }

    if (q.includes('gps_001') || q.includes('izin lokasi') || q.includes('permission')) {
      return (
        '📍 *Izin Lokasi GPS Belum Aktif:*\n\n' +
        'Browser di HP guru memblokir akses lokasi. Tinggal buka:\n' +
        'Pengaturan Chrome di HP ➡️ Pengaturan Situs ➡️ Lokasi ➡️ Pilih **Izinkan** untuk web absensi, lalu muat ulang halaman. 😊'
      );
    }

    if (q.includes('gps_003') || q.includes('fake gps') || q.includes('mock')) {
      return (
        '🛡️ *Terdeteksi Fake GPS:*\n\n' +
        'Sistem mendeteksi aplikasi lokasi palsu aktif di HP guru. Mohon matikan aplikasi Fake GPS atau nonaktifkan *mock location* di pengaturan HP agar bisa absen normal.'
      );
    }

    if (q.includes('qr') || q.includes('scan') || q.includes('barcode')) {
      return (
        '📷 *Kendala Scan QR Code:*\n\n' +
        'Biasanya karena QR code di monitor sudah berganti atau kedaluwarsa. Solusinya:\n' +
        '1. Refresh tampilan QR code di monitor admin.\n' +
        '2. Kalau masih sulit dibaca kamera, guru bisa langsung ketik **kode manual** yang ada di bawah barcode.\n' +
        '3. Pastikan izin kamera browser di HP guru sudah aktif. 👍'
      );
    }

    if (q.includes('piket') || q.includes('jadwal piket')) {
      return (
        '📅 *Jadwal Piket Guru:*\n\n' +
        'Jadwal piket berlaku untuk hari **Senin sampai Jumat**.\n' +
        'Kalau ada perubahan jadwal yang tidak tersimpan setelah refresh, mohon cek pengaturan RLS (Row Level Security) tabel `gm_schedule` di Supabase untuk memastikan izin simpan sudah terbuka. 😊'
      );
    }

    if (q.includes('jam pulang') || q.includes('jadwal') || q.includes('waktu')) {
      return (
        '⏰ *Jadwal Jam Pulang Sekolah:*\n\n' +
        '• **Senin s.d. Kamis:** Pulang pukul **13:00 WIB**\n' +
        '• **Jumat:** Pulang lebih awal pukul **11:00 WIB**\n' +
        '• Jam masuk standar sebelum pukul 07:00 WIB. Semangat bertugas! ✨'
      );
    }

    return (
      `Halo! Pesan Anda: "${query}" sudah kami terima.\n\n` +
      'Sistem absensi berjalan normal. Jika ada kendala spesifik seperti scan QR, sinyal GPS, jam kerja, atau jadwal piket, silakan tanyakan langsung di sini ya! 😊'
    );
  }
}


