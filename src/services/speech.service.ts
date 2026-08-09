/**
 * Smart Absensi Guru — AI Voice Announcement & Customization Service
 * Memutar dan mengonfigurasi pesan suara Bahasa Indonesia (Text-to-Speech)
 * dengan dukungan berbagai model suara (Pria/Wanita/Indonesian Voices),
 * nada suara (pitch), kecepatan (rate), dan kustomisasi teks sapaan guru.
 */

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

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadConfig();
      this.initVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  private loadConfig() {
    try {
      const saved = localStorage.getItem('smart_absensi_voice_config');
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
        localStorage.setItem('smart_absensi_voice_config', JSON.stringify(this.config));
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
  }

  /**
   * Memutar kalimat ucapan dengan model suara, pitch, dan rate terpilih
   */
  public speak(text: string, customVoiceURI?: string, customPitch?: number, customRate?: number) {
    if (!this.config.isEnabled && !customVoiceURI) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      this.cancel(); // Cancel any ongoing speech

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

      // Fallback if target voice not found on current device (e.g. switching between HP and Laptop)
      if (!voiceToUse) {
        voiceToUse = voices.find(
          (v) => v.lang.includes('id') || v.lang.includes('ID') || v.name.toLowerCase().includes('indonesia')
        );
      }

      if (voiceToUse) {
        utterance.voice = voiceToUse;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
    }
  }

  /**
   * Ucapan Selamat Datang untuk Guru saat masuk Dashboard (menggunakan template kustom)
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

    this.speak(text);
  }

  /**
   * Ucapan Konfirmasi saat Presensi Berhasil Disimpan (menggunakan template kustom)
   */
  public speakAttendanceSuccess(teacherName: string, actionType: 'CHECK_IN' | 'CHECK_OUT' = 'CHECK_IN') {
    const cleanName = teacherName.replace(/S\.Pd\.|M\.Pd\.|Drs\.|Dra\.|H\.|Hj\./g, '').trim();

    if (actionType === 'CHECK_OUT') {
      const text = (this.config.checkOutTemplate || DEFAULT_VOICE_CONFIG.checkOutTemplate)
        .replace('{nama}', cleanName);
      this.speak(text);
    } else {
      const text = (this.config.checkInTemplate || DEFAULT_VOICE_CONFIG.checkInTemplate)
        .replace('{nama}', cleanName);
      this.speak(text);
    }
  }

  /**
   * Ucapan Konfirmasi Sukses Spesial khusus Presensi Guru Piket Hari Ini
   */
  public speakDutyTeacherSuccess(teacherName: string) {
    const cleanName = teacherName.replace(/S\.Pd\.|M\.Pd\.|Drs\.|Dra\.|H\.|Hj\./g, '').trim();
    const text = `Selamat bertugas menjadi Guru Piket hari ini, ${cleanName}! Semoga amanah dan diberikan kelancaran serta keberkahan dalam bertugas.`;
    this.speak(text);
  }
}

export const SpeechService = new VoiceAnnouncementService();

