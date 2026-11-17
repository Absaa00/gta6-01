// audio.js — fully procedural WebAudio sound for Palmera Bay: Street Heat.
// No audio files, no network: every sound is synthesized (oscillators and
// filtered noise). A tiny step-sequenced bassline loop is the music.

function makeNoiseBuffer(ctx, seconds = 1) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.muted = false;
    this.musicOn = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
  }

  /** Must be called from a user gesture (click / keypress). Safe to call often. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.noiseBuf = makeNoiseBuffer(this.ctx, 1);

    // Continuous engine hum: sawtooth through a lowpass, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();

    // Police siren: triangle osc wobbling between two tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 720;
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.type = 'square';
    this.sirenLfo.frequency.value = 0.7;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180;
    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  /** speed01: 0..1 of the player's car speed. Call every frame. */
  engine(speed01, inCar) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const target = inCar ? 0.045 + speed01 * 0.075 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(280 + speed01 * 900, t, 0.1);
  }

  /** on: siren audible while police are actively chasing. */
  siren(on) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, this.ctx.currentTime, 0.15);
  }

  _blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  shoot() { this._noise(0.12, 0.5, 2400, 'highpass'); this._blip(160, 0.08, 'square', 0.18, 60); }
  enemyShoot() { this._noise(0.1, 0.25, 1800, 'highpass'); }
  punch() { this._noise(0.08, 0.35, 500); }
  pickup() { this._blip(660, 0.09, 'sine', 0.3); this._blip(990, 0.14, 'sine', 0.25); }
  cash() { this._blip(880, 0.08, 'sine', 0.3); setTimeout(() => this._blip(1174, 0.08, 'sine', 0.3), 70); setTimeout(() => this._blip(1568, 0.16, 'sine', 0.3), 140); }
  crash() { this._noise(0.25, 0.5, 300); this._blip(90, 0.2, 'sine', 0.3, 40); }
  explosion() { this._noise(0.7, 0.7, 220); this._blip(70, 0.6, 'sine', 0.5, 28); }
  reload() { this._blip(420, 0.05, 'square', 0.15); setTimeout(() => this._blip(300, 0.05, 'square', 0.15), 90); }
  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._blip(f, 0.18, 'triangle', 0.3), i * 110));
  }
  wantedUp() { this._blip(220, 0.15, 'sawtooth', 0.25, 440); }
  doorSlam() { this._noise(0.07, 0.3, 400); }

  /** Simple sun-soaked bassline loop: A-minor groove, 8 steps, ~112 BPM. */
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    // A2 C3 E3 G2 pattern with a little walk; frequencies in Hz.
    const bass = [110, 0, 130.8, 0, 164.8, 0, 98, 0, 110, 0, 130.8, 164.8, 196, 0, 164.8, 130.8];
    const stepMs = 60000 / 112 / 2; // 8th notes at 112 BPM
    const tick = () => {
      if (!this.musicOn || !this.ctx) return;
      const f = bass[this.musicStep % bass.length];
      if (f) this._blip(f, 0.22, 'triangle', 0.16);
      if (this.musicStep % 4 === 2) this._noise(0.03, 0.05, 6000, 'highpass'); // hat tick
      this.musicStep++;
    };
    tick();
    this.musicTimer = setInterval(tick, stepMs);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
