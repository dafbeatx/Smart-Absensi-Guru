/**
 * Smart Absensi Guru — Indonesian Voice Announcement Service
 * Memutar pesan suara Bahasa Indonesia (Text-to-Speech) untuk greeting login & konfirmasi presensi guru.
 */

class VoiceAnnouncementService {
  private isEnabled: boolean = true;
  private indonesianVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.initVoice();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.initVoice();
      }

      // Load preference from LocalStorage
      try {
        const saved = localStorage.getItem('smart_absensi_voice_enabled');
        if (saved !== null) {
          this.isEnabled = JSON.parse(saved);
        }
      } catch (e) {
        console.warn('Failed to parse voice preference:', e);
      }
    }
  }

  private initVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    // Prioritize Indonesian voice (id-ID or id_ID)
    const idVoice = voices.find(
      (v) => v.lang.includes('id') || v.lang.includes('ID') || v.name.toLowerCase().includes('indonesia')
    );
    this.indonesianVoice = idVoice || null;
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('smart_absensi_voice_enabled', JSON.stringify(enabled));
      } catch (e) {
        console.warn('Failed to save voice preference:', e);
      }
    }
    if (!enabled) {
      this.cancel();
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public cancel() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Memutar kalimat ucapan dalam Bahasa Indonesia
   */
  public speak(text: string) {
    if (!this.isEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      this.cancel(); // Cancel any ongoing speech

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 0.95; // Slightly relaxed natural pace
      utterance.pitch = 1.0;

      if (this.indonesianVoice) {
        utterance.voice = this.indonesianVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
    }
  }

  /**
   * Ucapan Selamat Datang untuk Guru saat masuk Dashboard
   */
  public speakWelcomeGreeting(teacherName: string, institutionName?: string) {
    const hour = new Date().getHours();
    let timeGreeting = 'Selamat pagi';
    if (hour >= 11 && hour < 15) timeGreeting = 'Selamat siang';
    else if (hour >= 15 && hour < 18) timeGreeting = 'Selamat sore';
    else if (hour >= 18) timeGreeting = 'Selamat malam';

    const cleanName = teacherName.replace(/S\.Pd\.|M\.Pd\.|Drs\.|Dra\.|H\.|Hj\./g, '').trim();
    const instText = institutionName ? ` di ${institutionName}` : '';
    const text = `Assalamu'alaikum. ${timeGreeting} ${cleanName}. Selamat bertugas${instText}.`;

    this.speak(text);
  }

  /**
   * Ucapan Konfirmasi saat Presensi Berhasil Disimpan
   */
  public speakAttendanceSuccess(teacherName: string, actionType: 'CHECK_IN' | 'CHECK_OUT' = 'CHECK_IN') {
    const cleanName = teacherName.replace(/S\.Pd\.|M\.Pd\.|Drs\.|Dra\.|H\.|Hj\./g, '').trim();

    if (actionType === 'CHECK_OUT') {
      this.speak(`Presensi pulang berhasil tersimpan. Terima kasih atas pengabdian Anda hari ini ${cleanName}. Hati-hati di jalan.`);
    } else {
      this.speak(`Presensi masuk berhasil tersimpan. Selamat mengajar ${cleanName}. Semoga kegiatan pembelajaran berjalan lancar.`);
    }
  }
}

export const SpeechService = new VoiceAnnouncementService();
