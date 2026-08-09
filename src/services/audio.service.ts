/**
 * Smart Absensi Guru - Audio & Sound Effects Service
 * Terintegrasi dengan HTML5 Audio API & Web Audio Synthesizer Fallback
 */

export type SoundType = 'SUCCESS' | 'ERROR' | 'BEEP' | 'WARNING';

class SoundEffectsService {
  private isMuted: boolean = false;
  private audioCache: Map<string, HTMLAudioElement> = new Map();

  constructor() {
    // Preload audio files
    if (typeof window !== 'undefined') {
      this.preloadAudio('/audio/success.mp3');
      this.preloadAudio('/audio/terimakasih.mp3');
      this.preloadAudio('/audio/error.mp3');
      this.preloadAudio('/audio/beep.mp3');
    }
  }

  /**
   * Preload file audio ke dalam cache memori browser
   */
  private preloadAudio(url: string) {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    try {
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.audioCache.set(url, audio);
    } catch {
      // Ignore preload errors on unsupported environments
    }
  }

  /**
   * Memutar efek suara berdasarkan tipe ('SUCCESS' | 'ERROR' | 'BEEP')
   */
  public play(type: SoundType) {
    if (this.isMuted) return;
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;

    let soundUrl = '/audio/success.mp3';
    if (type === 'ERROR' || type === 'WARNING') {
      soundUrl = '/audio/error.mp3';
    } else if (type === 'BEEP') {
      soundUrl = '/audio/beep.mp3';
    }

    const cachedAudio = this.audioCache.get(soundUrl);

    if (cachedAudio) {
      cachedAudio.currentTime = 0;
      cachedAudio
        .play()
        .catch(() => {
          // Jika file mp3 belum dimasukkan oleh user, gunakan Synthesizer fallback
          this.playSynthesizedTone(type);
        });
    } else {
      const audio = new Audio(soundUrl);
      audio
        .play()
        .catch(() => {
          this.playSynthesizedTone(type);
        });
    }
  }

  /**
   * Shortcut untuk suara BERHASIL / SUKSES
   */
  public playSuccess() {
    this.play('SUCCESS');
  }

  /**
   * Khusus Absen Berhasil Tersimpan (Guru & Staf):
   * Memutar /audio/success.mp3 terlebih dahulu, lalu disusul /audio/terimakasih.mp3!
   */
  public playAttendanceSuccess() {
    if (this.isMuted) return;
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;

    try {
      const successAudio = new Audio('/audio/success.mp3');
      const thankYouAudio = new Audio('/audio/terimakasih.mp3');

      let hasPlayedThankYou = false;
      const playThankYou = () => {
        if (hasPlayedThankYou) return;
        hasPlayedThankYou = true;
        thankYouAudio.currentTime = 0;
        thankYouAudio.play().catch((err) => {
          console.warn('Playback terimakasih.mp3:', err);
        });
      };

      // Event ketika success.mp3 selesai berbunyi
      successAudio.onended = playThankYou;

      // Fallback timer setelah 700ms jika event onended terlambat
      setTimeout(() => {
        playThankYou();
      }, 750);

      successAudio.currentTime = 0;
      successAudio.play().catch(() => {
        this.playSynthesizedTone('SUCCESS');
        setTimeout(playThankYou, 400);
      });
    } catch {
      this.playSuccess();
    }
  }

  /**
   * Khusus Absen Berhasil Tersimpan untuk Guru Piket:
   * Memutar efek nada audio khas piket guru (dengan nada fanfare sukacita C5->E5->G5->C6)
   */
  public playPiketGuruSuccess() {
    if (this.isMuted) return;
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;

    try {
      const piketAudio = new Audio('/audio/piket_guru.mp3');
      const thankYouAudio = new Audio('/audio/terimakasih.mp3');

      piketAudio.currentTime = 0;
      piketAudio
        .play()
        .then(() => {
          setTimeout(() => {
            thankYouAudio.currentTime = 0;
            thankYouAudio.play().catch(() => {});
          }, 800);
        })
        .catch(() => {
          this.playPiketFanfareTone();
        });
    } catch {
      this.playPiketFanfareTone();
    }
  }

  /**
   * Synthesizer Fanfare Sukacita Khusus Guru Piket (C5 -> E5 -> G5 -> C6)
   */
  private playPiketFanfareTone() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Uplifting 4-tone melody fanfare: C5, E5, G5, C6
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';

        const startTime = ctx.currentTime + idx * 0.11;
        const duration = idx === freqs.length - 1 ? 0.45 : 0.22;

        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.35, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    } catch {
      // Audio context fallback
    }
  }


  /**
   * Shortcut untuk suara GAGAL / ERROR
   */
  public playError() {
    this.play('ERROR');
  }

  /**
   * Shortcut untuk suara BEEP Scanner QR
   */
  public playBeep() {
    this.play('BEEP');
  }

  /**
   * Suara Dering Notifikasi Masuk (Chime Ding-Dong Dual Tone)
   */
  public playNotificationChime() {
    if (this.isMuted) return;
    if (typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        // First chime tone (E5 - 659Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
        gain1.gain.setValueAtTime(0.25, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.3);

        // Second chime tone (B5 - 987Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(987.77, ctx.currentTime + 0.15);
        gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc2.start(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.5);
      }
    } catch {
      // Audio context fallback or blocked
    }
  }

  /**
   * Synthesizer fallback menggunakan Web Audio API (Otomatis berbunyi nada jika file MP3 belum di-copy)
   */
  private playSynthesizedTone(type: SoundType) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'SUCCESS') {
        // High dual pitch chime (C5 -> G5)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15); // G5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'ERROR') {
        // Low double buzz (F3 -> C3)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(174.61, ctx.currentTime); // F3
        osc.frequency.setValueAtTime(130.81, ctx.currentTime + 0.15); // C3
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } else {
        // Short beep tone (880Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      }
    } catch {
      // Audio context blocked or not allowed
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export const SoundService = new SoundEffectsService();
