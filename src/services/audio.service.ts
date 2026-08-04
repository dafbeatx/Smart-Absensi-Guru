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
      this.preloadAudio('/audio/error.mp3');
      this.preloadAudio('/audio/beep.mp3');
    }
  }

  /**
   * Preload file audio ke dalam cache memori browser
   */
  private preloadAudio(url: string) {
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
