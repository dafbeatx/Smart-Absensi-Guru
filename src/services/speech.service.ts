/**
 * Smart Absensi Guru — Pengumuman Suara (Text-to-Speech) Service
 * Memutar dan mengonfigurasi pesan suara Bahasa Indonesia (Text-to-Speech)
 * dengan prioritas pesan berjenjang (CRITICAL > ATTENDANCE_SUCCESS > GREETING > INFO),
 * pembatasan laju ucapan (rate limiting), isolasi konfigurasi per-user,
 * serta dukungan jam hening (quiet hours).
 */

export type SpeechPriority = 'CRITICAL' | 'ATTENDANCE_SUCCESS' | 'GREETING' | 'INFO';

export const PRIORITY_LEVELS: Record<SpeechPriority, number> = {
  CRITICAL: 1,
  ATTENDANCE_SUCCESS: 2,
  GREETING: 3,
  INFO: 4,
};

export interface VoiceConfig {
  isEnabled: boolean;
  selectedVoiceURI: string; // SpeechSynthesisVoice.voiceURI or 'DEFAULT_ID'
  pitch: number; // 0.5 to 1.5 (default 1.0)
  rate: number; // 0.7 to 1.3 (default 0.95)
  welcomeTemplate: string;
  checkInTemplate: string;
  checkOutTemplate: string;
}

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  isEnabled: true,
  selectedVoiceURI: 'DEFAULT_ID',
  pitch: 1.0,
  rate: 0.95,
  welcomeTemplate: "Assalamu'alaikum. {sapaan} {nama}. Selamat bertugas{sekolah}.",
  checkInTemplate: 'Presensi masuk berhasil tersimpan. Selamat mengajar {nama}. Semoga pembelajaran berjalan lancar.',
  checkOutTemplate: 'Presensi pulang berhasil tersimpan. Terima kasih atas pengabdian Anda hari ini {nama}. Hati-hati di jalan.',
};

class VoiceAnnouncementService {
  private config: VoiceConfig = { ...DEFAULT_VOICE_CONFIG };
  private voicesList: SpeechSynthesisVoice[] = [];
  private currentUserId?: string;
  private currentPriority: SpeechPriority | null = null;
  private isSpeaking: boolean = false;
  private lastSpokenTime: number = 0;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadConfig();
      this.initVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  /**
   * Mengatur identitas pengguna aktif dan memuat preferensi suara terisolasi
   */
  public setUser(userId?: string) {
    this.currentUserId = userId;
    this.loadConfig();
  }

  /**
   * Helper penentuan jam hening (quiet hours)
   */
  public isWithinQuietHours(start = '21:00', end = '05:00', date: Date = new Date()): boolean {
    try {
      const [startHour, startMin] = start.split(':').map(Number);
      const [endHour, endMin] = end.split(':').map(Number);

      const currentMinutes = date.getHours() * 60 + date.getMinutes();
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    } catch {
      return false;
    }
  }

  private loadConfig() {
    if (typeof window === 'undefined') return;
    try {
      const userKey = this.currentUserId
        ? `smart_absensi_voice_config_${this.currentUserId}`
        : null;

      let saved = userKey ? localStorage.getItem(userKey) : null;
      if (!saved) {
        saved = localStorage.getItem('smart_absensi_voice_config');
      }

      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = { ...DEFAULT_VOICE_CONFIG, ...parsed };
      } else {
        const savedEnabled = localStorage.getItem('smart_absensi_voice_enabled');
        if (savedEnabled !== null) {
          this.config.isEnabled = JSON.parse(savedEnabled);
        }
      }
    } catch (e) {
      console.warn('Failed to load voice config from localStorage:', e);
    }
  }

  private initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.voicesList = window.speechSynthesis.getVoices();
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    if (this.voicesList.length === 0) {
      this.voicesList = window.speechSynthesis.getVoices();
    }
    // Sort so Indonesian voices appear at top
    return [...this.voicesList].sort((a, b) => {
      const aIsId = a.lang.includes('id') || a.lang.includes('ID') || a.name.toLowerCase().includes('indonesia');
      const bIsId = b.lang.includes('id') || b.lang.includes('ID') || b.name.toLowerCase().includes('indonesia');
      if (aIsId && !bIsId) return -1;
      if (!aIsId && bIsId) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  public getConfig(): VoiceConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<VoiceConfig>): VoiceConfig {
    this.config = { ...this.config, ...newConfig };
    if (typeof window !== 'undefined') {
      try {
        const serialized = JSON.stringify(this.config);
        localStorage.setItem('smart_absensi_voice_config', serialized);
        if (this.currentUserId) {
          localStorage.setItem(`smart_absensi_voice_config_${this.currentUserId}`, serialized);
        }
        localStorage.setItem('smart_absensi_voice_enabled', JSON.stringify(this.config.isEnabled));
      } catch (e) {
        console.warn('Failed to save voice config to localStorage:', e);
      }
    }
    if (!this.config.isEnabled) {
      this.cancel();
    }
    return { ...this.config };
  }

  public resetToDefault(): VoiceConfig {
    return this.updateConfig(DEFAULT_VOICE_CONFIG);
  }

  public setEnabled(enabled: boolean) {
    this.updateConfig({ isEnabled: enabled });
  }

  public getIsEnabled(): boolean {
    return this.config.isEnabled;
  }

  public cancel() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.currentPriority = null;
  }

  /**
   * Memutar kalimat ucapan dengan antrean prioritas dan kontrol jam hening
   */
  public speak(
    text: string,
    customVoiceURI?: string,
    customPitch?: number,
    customRate?: number,
    priority: SpeechPriority = 'INFO'
  ) {
    if (!this.config.isEnabled && !customVoiceURI) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // 1. Cek Jam Hening (Quiet Hours) - hanya CRITICAL yang dapat berbunyi saat jam hening
    if (this.isWithinQuietHours() && priority !== 'CRITICAL') {
      return;
    }

    const now = Date.now();

    // 2. Anti-spam Debounce untuk ucapan non-kritis (GREETING & INFO)
    if (priority === 'GREETING' || priority === 'INFO') {
      if (now - this.lastSpokenTime < 2500) {
        return;
      }
    }

    // 3. Evaluasi Prioritas Antrean Suara
    if (this.isSpeaking && this.currentPriority) {
      const incomingLevel = PRIORITY_LEVELS[priority];
      const activeLevel = PRIORITY_LEVELS[this.currentPriority];

      if (incomingLevel < activeLevel) {
        // Prioritas lebih tinggi (misal CRITICAL > ATTENDANCE_SUCCESS > GREETING): Batalkan ucapan saat ini
        this.cancel();
      } else {
        // Ucapan aktif memiliki prioritas lebih tinggi atau sama: abaikan ucapan berprioritas lebih rendah
        return;
      }
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.pitch = customPitch !== undefined ? customPitch : this.config.pitch;
      utterance.rate = customRate !== undefined ? customRate : this.config.rate;

      const targetURI = customVoiceURI || this.config.selectedVoiceURI;
      const voices = this.getAvailableVoices();

      let voiceToUse: SpeechSynthesisVoice | undefined;

      if (targetURI && targetURI !== 'DEFAULT_ID') {
        voiceToUse = voices.find((v) => v.voiceURI === targetURI);
      }

      // Fallback if target voice not found on current device
      if (!voiceToUse) {
        voiceToUse = voices.find(
          (v) => v.lang.includes('id') || v.lang.includes('ID') || v.name.toLowerCase().includes('indonesia')
        );
      }

      if (voiceToUse) {
        utterance.voice = voiceToUse;
        if (voiceToUse.lang) {
          utterance.lang = voiceToUse.lang;
        }
      }

      this.isSpeaking = true;
      this.currentPriority = priority;
      this.lastSpokenTime = now;

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentPriority = null;
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        this.currentPriority = null;
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
      this.isSpeaking = false;
      this.currentPriority = null;
    }
  }

  /**
   * Ucapan Darurat / Peringatan Kritis (Priority: CRITICAL)
   */
  public speakCritical(text: string) {
    this.speak(text, undefined, undefined, undefined, 'CRITICAL');
  }

  /**
   * Ucapan Selamat Datang untuk Guru saat masuk Dashboard (Priority: GREETING)
   */
  public speakWelcomeGreeting(teacherName: string, institutionName?: string) {
    const hour = new Date().getHours();
    let timeGreeting = 'Selamat pagi';
    if (hour >= 11 && hour < 15) timeGreeting = 'Selamat siang';
    else if (hour >= 15 && hour < 18) timeGreeting = 'Selamat sore';
    else if (hour >= 18) timeGreeting = 'Selamat malam';

    const cleanName = teacherName.replace(/S\.Pd\.|M\.Pd\.|Drs\.|Dra\.|H\.|Hj\./g, '').trim();
    const instText = institutionName ? ` di ${institutionName}` : '';

    const text = (this.config.welcomeTemplate || DEFAULT_VOICE_CONFIG.welcomeTemplate)
      .replace('{sapaan}', timeGreeting)
      .replace('{nama}', cleanName)
      .replace('{sekolah}', instText);

    this.speak(text, undefined, undefined, undefined, 'GREETING');
  }

  /**
   * Ucapan Konfirmasi saat Presensi Berhasil Disimpan (Priority: ATTENDANCE_SUCCESS)
   */
  public speakAttendanceSuccess(teacherName: string, actionType: 'CHECK_IN' | 'CHECK_OUT' = 'CHECK_IN') {
    const cleanName = teacherName.replace(/S\.Pd\.|M\.Pd\.|Drs\.|Dra\.|H\.|Hj\./g, '').trim();

    if (actionType === 'CHECK_OUT') {
      const text = (this.config.checkOutTemplate || DEFAULT_VOICE_CONFIG.checkOutTemplate)
        .replace('{nama}', cleanName);
      this.speak(text, undefined, undefined, undefined, 'ATTENDANCE_SUCCESS');
    } else {
      const text = (this.config.checkInTemplate || DEFAULT_VOICE_CONFIG.checkInTemplate)
        .replace('{nama}', cleanName);
      this.speak(text, undefined, undefined, undefined, 'ATTENDANCE_SUCCESS');
    }
  }

  /**
   * Ucapan Konfirmasi Sukses Spesial khusus Presensi Guru Piket Hari Ini (Priority: ATTENDANCE_SUCCESS)
   */
  public speakDutyTeacherSuccess(teacherName: string) {
    const cleanName = teacherName.replace(/S\.Pd\.|M\.Pd\.|Drs\.|Dra\.|H\.|Hj\./g, '').trim();
    const text = `Selamat bertugas menjadi Guru Piket hari ini, ${cleanName}! Semoga amanah dan diberikan kelancaran serta keberkahan dalam bertugas.`;
    this.speak(text, undefined, undefined, undefined, 'ATTENDANCE_SUCCESS');
  }

  /**
   * Ucapan Apresiasi Perolehan Poin Kedisiplinan Guru (Priority: ATTENDANCE_SUCCESS)
   */
  public speakPointReward(points: number, teacherName: string, reasonText?: string, isDutyToday?: boolean) {
    const cleanName = teacherName.replace(/S\.Pd\.|M\.Pd\.|Drs\.|Dra\.|H\.|Hj\.|S\.E\.|G\.r/g, '').trim();

    let pointsSpoken = `${points}`;
    if (points === 15) pointsSpoken = 'lima belas';
    else if (points === 25) pointsSpoken = 'dua puluh lima';
    else if (points === 5) pointsSpoken = 'lima';
    else if (points === 10) pointsSpoken = 'sepuluh';

    let text = `Selamat ${cleanName}! Anda memperoleh ${pointsSpoken} poin disiplin hari ini.`;

    if (isDutyToday && reasonText?.includes('Tepat Waktu')) {
      text = `Luar biasa ${cleanName}! Anda berhasil memperoleh ${pointsSpoken} poin disiplin, atas kehadiran tepat waktu dan tugas piket sekolah hari ini.`;
    } else if (reasonText?.includes('Pulang')) {
      text = `Terima kasih atas dedikasi dan pengabdian Anda hari ini, ${cleanName}. Anda memperoleh ${pointsSpoken} poin disiplin atas presensi pulang sekolah.`;
    } else if (reasonText?.includes('Tepat Waktu')) {
      text = `Selamat ${cleanName}! Anda berhasil memperoleh ${pointsSpoken} poin kedisiplinan, atas kehadiran tepat waktu hari ini. Pertahankan keteladanan Anda!`;
    } else if (reasonText?.includes('Terlambat') || reasonText?.includes('Masuk')) {
      text = `Terima kasih atas kehadiran Anda, ${cleanName}. Anda memperoleh ${pointsSpoken} poin disiplin hari ini.`;
    }

    this.speak(text, undefined, undefined, undefined, 'ATTENDANCE_SUCCESS');
  }
}

export const SpeechService = new VoiceAnnouncementService();
