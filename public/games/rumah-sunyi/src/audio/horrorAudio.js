export class HorrorAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.reverbNode = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.tensionGain = null;

    this.bgmEnabled = true;
    this.sfxEnabled = true;
    this.started = false;
    this.stepToggle = false;
  }

  init() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    // Master Compressor + Gain
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.25;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = this.bgmEnabled ? 0.34 : 0;

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxEnabled ? 0.8 : 0;

    // Impulse Response Reverb Ruangan Mansion
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this._createImpulseResponse(2.4, 2.8);

    const reverbWet = this.ctx.createGain();
    reverbWet.gain.value = 0.32;

    this.bgmGain.connect(compressor);
    this.sfxGain.connect(compressor);
    this.sfxGain.connect(this.reverbNode);
    this.reverbNode.connect(reverbWet);
    reverbWet.connect(compressor);

    compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this._startAmbientBacksound();
    this.started = true;
  }

  _createImpulseResponse(duration, decay) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const env = Math.pow(1 - i / length, decay);
        data[i] = (Math.random() * 2 - 1) * env;
      }
    }
    return impulse;
  }

  _startAmbientBacksound() {
    const now = this.ctx.currentTime;

    // Lapisan 1: Drone Kontrabas Gelap (Sub-bass + LFO)
    const bassOsc1 = this.ctx.createOscillator();
    const bassOsc2 = this.ctx.createOscillator();
    const bassFilter = this.ctx.createBiquadFilter();
    const droneGain = this.ctx.createGain();

    bassOsc1.type = 'sawtooth';
    bassOsc1.frequency.setValueAtTime(41.2, now); // E1
    bassOsc2.type = 'triangle';
    bassOsc2.frequency.setValueAtTime(61.74, now); // B1

    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(135, now);

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(0.14, now);
    lfoGain.gain.setValueAtTime(45, now);
    lfo.connect(lfoFilterTarget(bassFilter));

    function lfoFilterTarget(filter) {
      lfoGain.connect(filter.frequency);
      return lfoGain;
    }

    droneGain.gain.setValueAtTime(0.35, now);
    bassOsc1.connect(bassFilter);
    bassOsc2.connect(bassFilter);
    bassFilter.connect(droneGain);
    droneGain.connect(this.bgmGain);

    bassOsc1.start(now);
    bassOsc2.start(now);
    lfo.start(now);

    // Lapisan 2: Angin Lorong Tua (Filtered Pink/Brown Noise)
    const bufferSize = this.ctx.sampleRate * 4;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 2.6;
    }

    const windNoise = this.ctx.createBufferSource();
    windNoise.buffer = noiseBuffer;
    windNoise.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(280, now);
    windFilter.Q.setValueAtTime(3.2, now);

    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0.24, now);

    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.bgmGain);
    windNoise.start(now);

    // Lapisan 3: Harmoni Gesek Ketegangan (Dissonant String Pad)
    const padOscA = this.ctx.createOscillator();
    const padOscB = this.ctx.createOscillator();
    const padFilter = this.ctx.createBiquadFilter();
    this.tensionGain = this.ctx.createGain();

    padOscA.type = 'sawtooth';
    padOscA.frequency.setValueAtTime(164.81, now); // E3
    padOscB.type = 'sawtooth';
    padOscB.frequency.setValueAtTime(174.61, now); // F3 (minor second tension)

    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(520, now);

    this.tensionGain.gain.setValueAtTime(0.03, now);

    padOscA.connect(padFilter);
    padOscB.connect(padFilter);
    padFilter.connect(this.tensionGain);
    this.tensionGain.connect(this.bgmGain);

    padOscA.start(now);
    padOscB.start(now);
  }

  setTensionLevel(level01) {
    if (!this.started || !this.tensionGain) return;
    const clamped = Math.max(0, Math.min(1, level01));
    const target = 0.025 + clamped * 0.28;
    this.tensionGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.25);
  }

  toggleBgm() {
    this.bgmEnabled = !this.bgmEnabled;
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(this.bgmEnabled ? 0.34 : 0, this.ctx.currentTime, 0.1);
    }
    return this.bgmEnabled;
  }

  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxEnabled ? 0.8 : 0, this.ctx.currentTime, 0.1);
    }
    return this.sfxEnabled;
  }

  playFootstep(isGhost = false) {
    if (!this.started || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    this.stepToggle = !this.stepToggle;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = isGhost ? 'sawtooth' : 'triangle';
    const baseFreq = isGhost ? (this.stepToggle ? 56 : 48) : (this.stepToggle ? 115 : 98);
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.11);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isGhost ? 210 : 340, now);

    gain.gain.setValueAtTime(isGhost ? 0.42 : 0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  playDrawerCreak(stage = 1) {
    if (!this.started || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    const dur = stage === 1 ? 0.36 : 0.52;

    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(stage === 1 ? 155 : 195, now);
    osc.frequency.linearRampToValueAtTime(stage === 1 ? 110 : 250, now + dur);

    mod.frequency.setValueAtTime(28, now);
    modGain.gain.setValueAtTime(24, now);
    mod.connect(modGain);
    modGain.connect(osc.frequency);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(480, now);
    filter.Q.setValueAtTime(4.5, now);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    mod.start(now);
    osc.stop(now + dur + 0.02);
    mod.stop(now + dur + 0.02);
  }

  playKeyFound() {
    if (!this.started || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    const notes = [880, 1174.66, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.085;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.46);
    });
  }

  playWrongAnswerLock() {
    if (!this.started || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.35);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  playClosetDoor(closing = true) {
    if (!this.started || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(closing ? 130 : 95, now);
    osc.frequency.exponentialRampToValueAtTime(closing ? 58 : 145, now + 0.22);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playEyeSpotSting() {
    if (!this.started || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    // Waterphone / Metallic Terror Sting
    [554.37, 587.33, 830.61].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i === 0 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 0.94, now + 0.95);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.98);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 1.0);
    });
  }

  playJumpscare() {
    if (!this.started || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    [92.5, 98.0, 277.18, 554.37, 1108.73].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 1.18, now + 0.65);

      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.75);
    });
  }
}
