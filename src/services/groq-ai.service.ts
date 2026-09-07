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
            temperature: 0.5,
            max_tokens: 800,
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

    const systemPrompt = `Anda adalah "Smart AI Technical Diagnostic Engine" untuk Telegram Bot resmi aplikasi "Smart Absensi Guru" (SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam).
Pengguna adalah Admin / Pengelola Sistem${senderName ? ` bernama ${senderName}` : ''}.

Konteks Arsitektur & Pengetahuan Sistem Lengkap:
1. INFRASTRUKTUR & DATABASE:
   - Backend: Supabase PostgreSQL Cloud dengan Row Level Security (RLS) ketat.
   - Provider Pattern: Seluruh data lewat ProviderFactory (SupabaseProvider / MockProvider).
   - Tabel Kunci: gm_attendance (log presensi guru & siswa RFID), gm_users (pengguna, role, NPP, password), gm_schedule (jadwal piket guru SENIN-JUMAT), gm_leaves (pengajuan izin/cuti), gm_system_settings (radius geofence, nama instansi).
   - NPP (Nomor Pokok Pegawai): Standar wajib penamaan ID seluruh pegawai.

2. ATURAN JADWAL KERJA & JAM PULANG:
   - Jam Masuk Standar: Sebelum pukul 07:00 WIB.
   - Jam Pulang Senin s.d. Kamis: 13:00 WIB.
   - Jam Pulang Jumat: 11:00 WIB.

3. ALUR PRESENSI & SAFETY ENGINE (5-Step State Machine):
   - CHECKING_COOLDOWN -> VALIDATING_GPS -> CHECKING_PHOTO -> SUBMITTING -> RECORDED.
   - Metode: Scan Barcode/QR Dinamis, Biometrik Fingerprint (WebAuthn Platform Sensor), dan Tap Kartu RFID (gm_attendance).
   - Door Poster QR Mode: Khusus scan QR poster di pintu masuk sekolah, radius toleransi otomatis diperluas hingga 500 meter agar guru tidak gagal absen, dengan tetap mencatat titik koordinat GPS fisik asli guru ke database.
   - Auto Coordinate Sanitization: Koordinat GPS tanpa desimal (misal -6613144) otomatis disanitasi menjadi -6.613144.

4. DIAGNOSA BUG & KODE ERROR RESMI:
   - [GPS_001]: Izin lokasi GPS tidak aktif / ditolak browser. Solusi: Izinkan akses lokasi di pengaturan browser HP / Device.
   - [GPS_002]: Di luar radius geofence sekolah (>100m). Solusi: Mendekat ke gerbang/sekolah atau scan QR poster pintu sekolah (buffer 500m).
   - [GPS_003]: Terdeteksi Fake GPS / Mock Location. Solusi: Matikan aplikasi Mock GPS atau matikan opsi pengembang (developer options) di HP.
   - [QR_001]: QR Code kadaluarsa / Invalid Signature. Solusi: Refresh QR Code di layar monitor admin atau gunakan tombol input kode manual.
   - [PHOTO_001]: Kamera tidak dapat diakses / izin ditolak. Solusi: Izinkan izin kamera di Chrome/browser.
   - [OFFLINE_SYNC]: Koneksi internet terputus. Solusi: Presensi aman tersimpan di IndexedDB offline dan otomatis dikirim saat online kembali.
   - [PIKET_NOT_SAVED]: Jika jadwal piket guru tidak tersimpan di Supabase, periksa RLS policy pada tabel gm_schedule (pastikan RLS mengizinkan INSERT/UPDATE untuk role authenticated atau service_role).
   - [SYNC_COOLDOWN]: Notifikasi dan status tersinkronisasi lintas perangkat (Desktop & HP) dengan jeda aman 30 detik untuk stabilitas.

PANDUAN MENJAWAB:
- Jawab secara langsung, ramah, solutif, dan berwawasan teknis dalam Bahasa Indonesia.
- Gunakan format Markdown yang rapi (bold untuk istilah/error code, bullet points untuk instruksi perbaikan).
- Jika ditanya tentang error/bug, jelaskan penyebab dan berikan solusi langkah demi langkah yang aplikatif.
- Jangan gunakan istilah yang meragukan; berikan kepastian teknis berdasarkan panduan arsitektur di atas.`;

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
        '📍 *Diagnosa Geofence (GPS_002):*\n\n' +
        'Error ini terjadi karena posisi GPS guru berada di luar radius standar sekolah (>100m).\n\n' +
        '💡 *Solusi:*\n' +
        '1. Pastikan GPS di HP dalam mode akurasi tinggi.\n' +
        '2. Gunakan mode **Scan QR Poster Pintu Sekolah**, sistem memberikan toleransi buffer hingga 500m sehingga absensi langsung diterima sambil tetap merekam koordinat asli guru.\n' +
        '3. Koordinat integer otomatis disanitasi oleh sistem (contoh: -6613144 disanitasi menjadi -6.613144).'
      );
    }

    if (q.includes('gps_001') || q.includes('izin lokasi') || q.includes('permission')) {
      return (
        '⚠️ *Diagnosa Izin Lokasi (GPS_001):*\n\n' +
        'Browser atau perangkat memblokir akses lokasi GPS.\n\n' +
        '💡 *Solusi:*\n' +
        'Buka pengaturan browser (Chrome/Safari) ➡️ Pengaturan Situs ➡️ Lokasi ➡️ Pilih **Izinkan** untuk web Smart Absensi Guru.'
      );
    }

    if (q.includes('gps_003') || q.includes('fake gps') || q.includes('mock')) {
      return (
        '🛡️ *Keamanan Fake GPS (GPS_003):*\n\n' +
        'Sistem mendeteksi penggunaan Fake GPS atau Mock Location provider.\n\n' +
        '💡 *Solusi:*\n' +
        'Matikan aplikasi Fake GPS dan nonaktifkan opsi *Select mock location app* di Opsi Pengembang (Developer Options) Android.'
      );
    }

    if (q.includes('piket') || q.includes('jadwal piket')) {
      return (
        '📅 *Diagnosa Jadwal Piket Guru:*\n\n' +
        'Jika penambahan jadwal piket guru tidak tersimpan setelah refresh:\n' +
        '1. Pastikan tabel `gm_schedule` di Supabase memiliki RLS Policy aktif untuk INSERT/UPDATE.\n' +
        '2. Kolom hari menggunakan standar enum: `SENIN`, `SELASA`, `RABU`, `KAMIS`, `JUMAT`.\n' +
        '3. Gunakan tombol simpan di panel admin setelah mengubah nama guru piket.'
      );
    }

    if (q.includes('jam pulang') || q.includes('jadwal') || q.includes('waktu')) {
      return (
        '⏰ *Jadwal Presensi Sekolah:*\n\n' +
        '• **Batas Tepat Waktu:** Sebelum 07:00 WIB\n' +
        '• **Jam Pulang Senin s.d. Kamis:** 13:00 WIB\n' +
        '• **Jam Pulang Jumat:** 11:00 WIB'
      );
    }

    return (
      '🤖 *Smart Absensi AI Assistant:*\n\n' +
      `Saya telah menerima pesan Anda: "${query}".\n\n` +
      'Sistem absensi berjalan normal dengan Supabase Cloud, toleransi Door Poster QR 500m, dan integrasi Biometrik/RFID. Silakan tanyakan kode error spesifik (misal: GPS_002, QR_001, atau kendala jadwal piket) jika membutuhkan bantuan lebih mendalam.'
    );
  }
}


