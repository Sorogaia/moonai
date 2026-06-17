// Skip intro for returning visitors unless they hit Replay
if (localStorage.getItem('moonai_intro_seen') && !sessionStorage.getItem('moonai_intro_replay')) {
  window.location.replace('./app.html');
}
sessionStorage.removeItem('moonai_intro_replay');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const term = document.getElementById('terminal');
const ui = document.getElementById('ui');
let booted = false, timeouts = [];
const T = (fn, ms) => { const id = setTimeout(fn, ms); timeouts.push(id); return id; };
const clearAll = () => { timeouts.forEach(clearTimeout); timeouts = []; };

/* ═══════════════════════════════════════════
   AUDIO ENGINE (Web Audio API — synthesized)
   ═══════════════════════════════════════════ */
let soundOn = false, actx = null;
let musicBus = null, reverbNode = null, musicNodes = [], musicTimers = [];

/* ═══════════════════════════════════════════
   TONE.JS PRO RACK — studio effects + real synths.
   If Tone loaded from CDN we use it for everything;
   otherwise we fall back to the raw Web Audio engine.
   ═══════════════════════════════════════════ */
const HAS_TONE = (typeof Tone !== 'undefined');
let TONE = { ready:false };
function initTone() {
  if (!HAS_TONE || TONE.ready) return;
  // master chain: bus -> EQ3 -> chorus -> compressor -> limiter -> reverb(send) -> out
  const limiter = new Tone.Limiter(-1).toDestination();
  const comp = new Tone.Compressor({ threshold:-18, ratio:3.2, attack:0.004, release:0.18 }).connect(limiter);
  const eq = new Tone.EQ3({ low:2, mid:-1, high:2.5 }).connect(comp);
  // big lush convolution-style reverb on a send
  const reverb = new Tone.Reverb({ decay:4.5, preDelay:0.02, wet:0.32 });
  reverb.connect(comp);
  const chorus = new Tone.Chorus({ frequency:0.6, delayTime:3.5, depth:0.5, wet:0.25 }).connect(eq);
  chorus.start();
  const busIn = new Tone.Gain(1).connect(chorus);
  busIn.connect(reverb); // parallel send to reverb

  // a dedicated sub channel (clean, no chorus) for weight
  const subComp = new Tone.Compressor({ threshold:-12, ratio:4, attack:0.002, release:0.1 }).connect(limiter);
  const subIn = new Tone.Gain(1).connect(subComp);

  TONE = {
    ready:true, limiter, comp, eq, reverb, chorus, busIn, subIn,
    // master volume control used for stopdown ducking
    master: new Tone.Gain(1)
  };
  // route a master gain in front of busIn for ducking
  TONE.master.connect(chorus); TONE.master.connect(reverb);
  TONE.busIn = TONE.master;

  // ── instrument: bright bell/pluck for the sonic signature & rewards ──
  TONE.bell = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.0, modulationIndex: 6,
    oscillator: { type:'sine' }, envelope:{ attack:0.002, decay:0.9, sustain:0.0, release:1.2 },
    modulation:{ type:'triangle' }, modulationEnvelope:{ attack:0.01, decay:0.4, sustain:0, release:0.3 }
  }).connect(TONE.busIn);
  TONE.bell.volume.value = -6;

  // ── pad/strings for the music journey (warm, detuned saws) ──
  TONE.pad = new Tone.PolySynth(Tone.Synth, {
    oscillator:{ type:'fatsawtooth', count:3, spread:28 },
    envelope:{ attack:0.6, decay:0.3, sustain:0.8, release:2.4 }
  }).connect(TONE.busIn);
  TONE.pad.volume.value = -16;
  // filter sweep on the pad
  TONE.padFilter = new Tone.Filter(700, 'lowpass');
  TONE.pad.disconnect(); TONE.pad.chain(TONE.padFilter, TONE.busIn);

  // ── pluck arp for the build ──
  TONE.arp = new Tone.PolySynth(Tone.Synth, {
    oscillator:{ type:'square' }, envelope:{ attack:0.002, decay:0.18, sustain:0, release:0.2 }
  }).connect(TONE.busIn);
  TONE.arp.volume.value = -18;

  // ── sub-bass mono synth (drop weight) ──
  TONE.sub = new Tone.MonoSynth({
    oscillator:{ type:'sine' },
    envelope:{ attack:0.002, decay:0.5, sustain:0.2, release:1.2 },
    filterEnvelope:{ attack:0.001, decay:0.3, sustain:0, baseFrequency:60, octaves:2 }
  }).connect(TONE.subIn);
  TONE.sub.volume.value = -3;

  // ── noise synth for risers/whooshes/cracks ──
  TONE.noise = new Tone.NoiseSynth({
    noise:{ type:'white' }, envelope:{ attack:0.4, decay:0.1, sustain:1, release:0.3 }
  });
  TONE.noiseFilter = new Tone.Filter(800, 'bandpass');
  TONE.noise.chain(TONE.noiseFilter, TONE.busIn);
  TONE.noise.volume.value = -10;

  // ── distorted brass for the drop "braaam" ──
  TONE.brass = new Tone.PolySynth(Tone.Synth, {
    oscillator:{ type:'fatsawtooth', count:2, spread:18 },
    envelope:{ attack:0.02, decay:0.4, sustain:0.3, release:0.8 }
  });
  TONE.brassDist = new Tone.Distortion(0.35);
  TONE.brassFilter = new Tone.Filter(500, 'lowpass');
  TONE.brass.chain(TONE.brassFilter, TONE.brassDist, TONE.busIn);
  TONE.brass.volume.value = -14;

  // keystroke blip
  TONE.blip = new Tone.Synth({ oscillator:{type:'square'}, envelope:{attack:0.001,decay:0.02,sustain:0,release:0.02} }).connect(TONE.busIn);
  TONE.blip.volume.value = -26;
}

function initAudio() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  // master music bus -> reverb + dry, into destination
  musicBus = actx.createGain(); musicBus.gain.value = 0.0;
  const wet = actx.createGain(); wet.gain.value = 0.28;
  const dry = actx.createGain(); dry.gain.value = 0.85;
  reverbNode = actx.createConvolver();
  reverbNode.buffer = makeReverbIR(2.6, 2.2);
  musicBus.connect(dry); dry.connect(actx.destination);
  musicBus.connect(reverbNode); reverbNode.connect(wet); wet.connect(actx.destination);
  // boot the Tone rack too (shares the same resumed context via Tone.start elsewhere)
  if (HAS_TONE) { try { initTone(); } catch(e){ console.warn('Tone init failed', e); } }
}
// generate a soft reverb impulse response (no external file)
function makeReverbIR(seconds, decay) {
  const rate = actx.sampleRate, len = rate * seconds;
  const buf = actx.createBuffer(2, len, rate);
  for (let ch=0; ch<2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i=0;i<len;i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/len, decay);
  }
  return buf;
}
function toggleSound() {
  initAudio();
  if (actx.state === 'suspended') actx.resume();
  if (HAS_TONE) { try { Tone.start(); Tone.getContext().resume(); } catch(e){} }
  soundOn = !soundOn;
  const btn = document.getElementById('sound');
  btn.innerHTML = `<span class="ico">${soundOn ? '♫' : '♪'}</span> SOUND: ${soundOn ? 'ON' : 'OFF'}`;
  if (soundOn) {
    musicBus.gain.cancelScheduledValues(actx.currentTime);
    musicBus.gain.setValueAtTime(0.0001, actx.currentTime);
    musicBus.gain.linearRampToValueAtTime(1, actx.currentTime + 0.6);
    // kick off the music phase matching where we are in the animation
    if (!musicPhase) {
      if (!booted) musicPhaseA();
      else musicPhaseE();
    }
  }
  else { musicBus.gain.linearRampToValueAtTime(0, actx.currentTime + 0.4); }
}

/* ───────────────────────────────────────────
   MUSIC: a scored journey, not a drone.
   Phases are triggered by the animation:
   - phase A  (boot)      : sparse pulse + low pad, A minor, tense/clean
   - phase B  (threat)    : add dissonant tension, filter rises
   - phase C  (decrypt)   : arp accelerates, builds
   - phase D  (compile)   : RESOLVE — major lift + bass drop + shimmer
   - phase E  (final)     : warm sustained pad, gentle, no percussion
   Everything routes through musicBus so the toggle controls it.
   ─────────────────────────────────────────── */
const NOTE = { // freqs (Hz)
  A1:55, E2:82.41, A2:110, C3:130.81, E3:164.81, G3:196, A3:220, B3:246.94,
  C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392, A4:440, B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, G5:783.99, A5:880,
  F3:174.61, Csharp4:277.18, Fsharp4:369.99
};
function mNote(freq, start, dur, type, vol, target) {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type || 'triangle'; o.frequency.value = freq;
  const t = actx.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(target || musicBus);
  o.start(t); o.stop(t + dur + 0.05);
  musicNodes.push(o);
}
// a sustained pad chord
function mPad(freqs, start, dur, vol) {
  if (!actx) return;
  const t = actx.currentTime + start;
  const filt = actx.createBiquadFilter(); filt.type='lowpass';
  filt.frequency.setValueAtTime(500, t); filt.frequency.linearRampToValueAtTime(1400, t + dur*0.5);
  filt.connect(musicBus);
  const g = actx.createGain(); g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.6);
  g.gain.setValueAtTime(vol, t + dur - 0.8);
  g.gain.linearRampToValueAtTime(0, t + dur);
  g.connect(filt);
  freqs.forEach(f => { const o=actx.createOscillator(); o.type='sawtooth'; o.frequency.value=f;
    const dt=actx.createOscillator(); dt.type='sawtooth'; dt.frequency.value=f*1.005;
    o.connect(g); dt.connect(g); o.start(t); dt.start(t); o.stop(t+dur+0.1); dt.stop(t+dur+0.1);
    musicNodes.push(o,dt); });
}
let musicPhase = null;
function stopMusicLoops(){ musicTimers.forEach(clearInterval); musicTimers = []; }

// PHASE A — boot: minimal tense pulse, Am
function musicPhaseA() {
  if (!actx || musicPhase==='A') return; musicPhase='A'; stopMusicLoops();
  mPad([NOTE.A2, NOTE.E3, NOTE.A3], 0, 10, 0.05); // drone pad, evolves with filter
  // sparse heartbeat pulse on A
  let step=0;
  const id=setInterval(()=>{
    if(!soundOn) return;
    const seq=[NOTE.A3,0,NOTE.E3,0, NOTE.A3,0,NOTE.C4,0];
    const n=seq[step%seq.length];
    if(n) mNote(n, 0, 0.5, 'triangle', 0.05);
    if(step%8===0) mNote(NOTE.A1, 0, 0.7, 'sine', 0.10); // low pulse
    step++;
  }, 340);
  musicTimers.push(id);
}
// PHASE B — threat: add tension (minor 2nd dissonance + rising)
function musicPhaseB() {
  if (!actx || musicPhase==='B') return; musicPhase='B'; stopMusicLoops();
  mPad([NOTE.A2, NOTE.C3, NOTE.E3, NOTE.B3], 0, 6, 0.06); // add 9th for unease
  let step=0;
  const id=setInterval(()=>{
    if(!soundOn) return;
    // faster, add dissonant Bb-ish via F#
    const seq=[NOTE.A3,NOTE.B3,NOTE.E3,NOTE.Fsharp4, NOTE.A3,NOTE.C4,NOTE.E4,NOTE.B3];
    mNote(seq[step%seq.length], 0, 0.35, 'sawtooth', 0.035);
    if(step%4===0) mNote(NOTE.A1, 0, 0.5, 'sine', 0.11);
    step++;
  }, 200);
  musicTimers.push(id);
}
// PHASE C — decrypt: accelerating arp build
function musicPhaseC() {
  if (!actx || musicPhase==='C') return; musicPhase='C'; stopMusicLoops();
  // rising arpeggio that speeds up — tension before release
  const arp=[NOTE.A3,NOTE.C4,NOTE.E4,NOTE.A4,NOTE.C5,NOTE.E5,NOTE.A5];
  let i=0, delay=110;
  function nextArp(){
    if(!soundOn){ const id=setTimeout(nextArp,delay); musicTimers.push({id, _t:true}); return; }
    mNote(arp[i%arp.length], 0, 0.3, 'square', 0.03);
    mNote(arp[i%arp.length]/2, 0, 0.3, 'triangle', 0.025);
    i++;
    delay = Math.max(45, delay-4); // accelerate
    const id=setTimeout(nextArp, delay);
    musicTimers.push({id, _t:true, clear(){clearTimeout(id);}});
  }
  // low rising swell
  mNote(NOTE.A1, 0, 2.0, 'sawtooth', 0.06);
  nextArp();
}
// override stopMusicLoops to also clear timeout-based arps
const _stopLoops = stopMusicLoops;
stopMusicLoops = function(){
  musicTimers.forEach(t=>{ if(t && t._t){ clearTimeout(t.id); } else { clearInterval(t); } });
  musicTimers=[];
};
// PHASE D — compile: THE RESOLVE. Major lift + bass drop + shimmer
function musicPhaseD() {
  if (!actx) return; musicPhase='D'; stopMusicLoops();
  // big resolving chord: A major (the lift out of A minor) -> warm
  const t=0;
  // sub bass drop
  const o=actx.createOscillator(), g=actx.createGain();
  o.type='sine'; o.frequency.setValueAtTime(110, actx.currentTime); o.frequency.exponentialRampToValueAtTime(36.7, actx.currentTime+0.5);
  g.gain.setValueAtTime(0.22, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime+1.4);
  o.connect(musicBus); o.start(); o.stop(actx.currentTime+1.5); musicNodes.push(o);
  // triumphant chord stack (A major add9): A C# E A C#5
  mPad([NOTE.A2, NOTE.Csharp4, NOTE.E4, NOTE.A4, NOTE.Csharp4*2], 0.02, 4.5, 0.07);
  // shimmer arpeggio sparkle descending
  const spark=[NOTE.A5,NOTE.E5,NOTE.Csharp4*2,NOTE.A4,NOTE.E4];
  spark.forEach((f,i)=> mNote(f, 0.15+i*0.08, 1.2, 'triangle', 0.04));
  // bell hit
  mNote(NOTE.A4, 0, 1.6, 'sine', 0.06);
  mNote(NOTE.E5, 0.02, 1.4, 'sine', 0.04);
}
// PHASE E — final: warm sustained pad loop, calm
function musicPhaseE() {
  if (!actx || musicPhase==='E') return; musicPhase='E'; stopMusicLoops();
  function cycle(){
    if(!soundOn){ const id=setTimeout(cycle, 8000); musicTimers.push({id,_t:true}); return; }
    // slow warm progression: Amaj7 -> F#m7 -> Dmaj7 -> Emaj
    mPad([NOTE.A2, NOTE.Csharp4, NOTE.E4, NOTE.G4], 0, 4, 0.045);
    mPad([NOTE.Fsharp4/2, NOTE.A3, NOTE.Csharp4, NOTE.E4], 4, 4, 0.04);
    mPad([NOTE.D4/2, NOTE.Fsharp4, NOTE.A4, NOTE.Csharp4*2], 8, 4, 0.04);
    mPad([NOTE.E3, NOTE.G4, NOTE.B4, NOTE.E4], 12, 4, 0.04);
    const id=setTimeout(cycle, 16000); musicTimers.push({id,_t:true});
  }
  cycle();
}
function key() {
  if (!soundOn || !actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = 'square'; o.frequency.value = 1400 + Math.random()*900;
  g.gain.value = 0.025;
  o.connect(g); g.connect(actx.destination);
  const t = actx.currentTime;
  g.gain.setValueAtTime(0.025, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t + 0.02);
  o.start(t); o.stop(t + 0.025);
}
function beep(freq, dur, vol) {
  if (!soundOn || !actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = 'sine'; o.frequency.value = freq; g.gain.value = vol||0.06;
  o.connect(g); g.connect(actx.destination);
  const t = actx.currentTime;
  g.gain.setValueAtTime(vol||0.06, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t + (dur||0.1));
  o.start(t); o.stop(t + (dur||0.1));
}
function bootHit() {
  // route to the Tone rack when available
  if (TONE.ready && soundOn) { return toneDrop(); }
  // ── DEEP BASS-DRIVEN DROP (Web Audio fallback) — clean, no harsh layers ──
  if (!soundOn || !actx) return;
  const t = actx.currentTime;

  // 1) primary SUB slam — deep to ~28Hz, louder, long weighty tail
  const sub = actx.createOscillator(), subG = actx.createGain();
  sub.type='sine';
  sub.frequency.setValueAtTime(85, t);
  sub.frequency.exponentialRampToValueAtTime(28, t+0.62);   // slow drop = lands with weight
  subG.gain.setValueAtTime(0.0001, t);
  subG.gain.exponentialRampToValueAtTime(0.42, t+0.025);    // strong slam
  subG.gain.exponentialRampToValueAtTime(0.001, t+1.6);     // long tail
  sub.connect(subG); subG.connect(actx.destination);
  sub.start(t); sub.stop(t+1.7);

  // 2) clean low BOOM for body (sine thump, decays fast)
  const boom = actx.createOscillator(), boomG = actx.createGain();
  boom.type='sine'; boom.frequency.setValueAtTime(120, t); boom.frequency.exponentialRampToValueAtTime(45, t+0.18);
  boomG.gain.setValueAtTime(0.30, t); boomG.gain.exponentialRampToValueAtTime(0.001, t+0.9);
  boom.connect(boomG); boomG.connect(actx.destination); boom.start(t); boom.stop(t+0.95);

  // 3) one soft warm low note for tone (no bright chord, no distortion, no noise)
  [110, 164.8].forEach((f) => {                 // A2 + E3, gentle
    const o = actx.createOscillator(), g = actx.createGain();
    o.type='triangle'; o.frequency.value=f;
    const lp = actx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t+0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t+1.3);
    o.connect(lp); lp.connect(g); g.connect(actx.destination); o.start(t); o.stop(t+1.35);
  });
}

/* ── NOISE BUFFER (for white-noise risers, cracks, sweeps) ── */
let _noiseBuf = null;
function noiseBuffer(seconds) {
  const len = Math.floor(actx.sampleRate * seconds);
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i=0;i<len;i++) d[i] = Math.random()*2-1;
  return buf;
}

/* ── THREE-BAND RISER (research: low weight + mid body + high sparkle) ──
   Call with a duration; it climbs and is meant to resolve onto a hit. */
function riser(dur) {
  if (!soundOn || !actx) return;
  const t = actx.currentTime;
  // HIGH: white-noise sweep climbing in cutoff -> "sparkle/excitement"
  const noise = actx.createBufferSource(); noise.buffer = noiseBuffer(dur+0.1); noise.loop=false;
  const bp = actx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=0.8;
  bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(8000, t+dur);
  const nG = actx.createGain();
  nG.gain.setValueAtTime(0.0001, t); nG.gain.exponentialRampToValueAtTime(0.09, t+dur*0.85);
  nG.gain.exponentialRampToValueAtTime(0.001, t+dur+0.05);
  noise.connect(bp); bp.connect(nG); nG.connect(actx.destination);
  noise.start(t); noise.stop(t+dur+0.1);
  // MID: a tone rising in pitch -> "body", with accelerating tremolo (tension)
  const o = actx.createOscillator(), g = actx.createGain();
  o.type='sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(880, t+dur);
  const trem = actx.createOscillator(), tremG = actx.createGain();
  trem.type='square'; trem.frequency.setValueAtTime(6, t); trem.frequency.exponentialRampToValueAtTime(28, t+dur);
  tremG.gain.value = 0.5; trem.connect(tremG);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t+dur*0.9);
  g.gain.exponentialRampToValueAtTime(0.001, t+dur+0.05);
  tremG.connect(g.gain);
  o.connect(g); g.connect(actx.destination);
  o.start(t); o.stop(t+dur+0.1); trem.start(t); trem.stop(t+dur+0.1);
  // LOW: sub swell rising -> "weight" anticipation
  const sub = actx.createOscillator(), subG = actx.createGain();
  sub.type='sine'; sub.frequency.setValueAtTime(40, t); sub.frequency.exponentialRampToValueAtTime(70, t+dur);
  subG.gain.setValueAtTime(0.0001, t); subG.gain.exponentialRampToValueAtTime(0.10, t+dur*0.95);
  subG.gain.exponentialRampToValueAtTime(0.001, t+dur+0.05);
  sub.connect(subG); subG.connect(actx.destination);
  sub.start(t); sub.stop(t+dur+0.1);
}

/* ── REVERSE SWELL — a reversed-noise build that resolves ON the hit ──
   (research: position reversed audio so it ends exactly at the impact) */
function reverseSwell(dur) {
  if (!soundOn || !actx) return;
  const t = actx.currentTime;
  const len = Math.floor(actx.sampleRate*dur);
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const d = buf.getChannelData(0);
  // reversed envelope: quiet -> loud toward the end
  for (let i=0;i<len;i++){ const env = i/len; d[i] = (Math.random()*2-1) * env*env; }
  const src = actx.createBufferSource(); src.buffer = buf;
  const hp = actx.createBiquadFilter(); hp.type='highpass';
  hp.frequency.setValueAtTime(300, t); hp.frequency.exponentialRampToValueAtTime(6000, t+dur);
  const g = actx.createGain(); g.gain.value = 0.10;
  src.connect(hp); hp.connect(g); g.connect(actx.destination);
  src.start(t); src.stop(t+dur);
}

/* ── SOFT SWELL — clean, gentle rise into the drop (no noise, no harsh sweep) ──
   A warm low pad that crescendos smoothly, building anticipation softly. */
function softSwell(dur) {
  if (TONE.ready && soundOn) { return toneSoftSwell(dur); }
  if (!soundOn || !actx) return;
  const t = actx.currentTime;
  // a low, warm chord that simply rises in volume — rounded sines, gentle filter
  const lp = actx.createBiquadFilter(); lp.type='lowpass';
  lp.frequency.setValueAtTime(300, t);
  lp.frequency.linearRampToValueAtTime(900, t+dur);   // opens gently, not a screech
  const bus = actx.createGain(); bus.gain.value = 1; bus.connect(actx.destination);
  lp.connect(bus);
  [82.4, 110, 164.8].forEach((f,i) => {               // E2 A2 E3 — warm low cluster
    const o = actx.createOscillator(), g = actx.createGain();
    o.type='sine'; o.frequency.value=f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t+dur*0.9);  // smooth crescendo
    g.gain.exponentialRampToValueAtTime(0.001, t+dur+0.1); // tucks out as the drop hits
    o.connect(g); g.connect(lp); o.start(t); o.stop(t+dur+0.15);
  });
  // a soft sub underneath rising — felt, not heard
  const sub = actx.createOscillator(), sg = actx.createGain();
  sub.type='sine'; sub.frequency.value=55;
  sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(0.09, t+dur*0.95);
  sg.gain.exponentialRampToValueAtTime(0.001, t+dur+0.1);
  sub.connect(sg); sg.connect(actx.destination); sub.start(t); sub.stop(t+dur+0.15);
}

/* ── THE MOONAI SONIC SIGNATURE — a 3-note motif, "the MoonAI sound" ──
   In A major (resolve key). Bright bell-like. Plays as the wordmark lands. */
function sonicSignature(delay) {
  if (TONE.ready && soundOn) { return toneSignature(delay); }
  if (!soundOn || !actx) return;
  const t0 = actx.currentTime + (delay||0);
  // motif: E5 -> A5 -> C#6 (rising major arpeggio, hopeful/premium)
  const notes = [
    {f: 659.3, at: 0.00, dur: 0.5},
    {f: 880.0, at: 0.12, dur: 0.5},
    {f: 1108.7, at: 0.24, dur: 0.9}
  ];
  notes.forEach(n => {
    const t = t0 + n.at;
    // bell = sine + a touch of the octave, with a soft attack and long decay
    [1, 2, 3].forEach((mult, mi) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = mi===0 ? 'sine' : 'triangle';
      o.frequency.value = n.f*mult;
      const vol = mi===0 ? 0.13 : (mi===1 ? 0.05 : 0.02);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t+0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, t + n.dur);
      o.connect(g); g.connect(musicBus || actx.destination);
      o.start(t); o.stop(t + n.dur + 0.05);
    });
  });
  // a soft shimmer tail under the motif
  const sh = actx.createOscillator(), shG = actx.createGain();
  sh.type='sine'; sh.frequency.value=1760;
  shG.gain.setValueAtTime(0, t0+0.24); shG.gain.linearRampToValueAtTime(0.025, t0+0.3);
  shG.gain.exponentialRampToValueAtTime(0.0008, t0+1.4);
  sh.connect(shG); shG.connect(musicBus || actx.destination);
  sh.start(t0+0.24); sh.stop(t0+1.5);
}

/* ── REWARD PING — satisfying tuned confirm (dopamine on [OK]/capture) ──
   Two-tone bright chime, Apple-Pay-ish: clean, positive. */
function reward(base, big) {
  if (!soundOn || !actx) return;
  const t = actx.currentTime;
  const pair = big ? [880, 1318.5] : [1046.5, 1568];  // perfect-fifth-ish, bright
  pair.forEach((f, i) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type='sine'; o.frequency.value=f;
    const v = big ? 0.06 : 0.035;
    g.gain.setValueAtTime(0, t+i*0.05); g.gain.linearRampToValueAtTime(v, t+i*0.05+0.01);
    g.gain.exponentialRampToValueAtTime(0.0006, t+i*0.05+ (big?0.4:0.22));
    o.connect(g); g.connect(actx.destination);
    o.start(t+i*0.05); o.stop(t+i*0.05+ (big?0.45:0.25));
  });
}

/* ── WHOOSH — the satisfying "zip" as something animates into place ── */
function whoosh(up) {
  if (!soundOn || !actx) return;
  const t = actx.currentTime, dur = 0.42;
  const src = actx.createBufferSource(); src.buffer = noiseBuffer(dur+0.05);
  const bp = actx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.2;
  if (up) { bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(5000, t+dur); }
  else    { bp.frequency.setValueAtTime(5000, t); bp.frequency.exponentialRampToValueAtTime(500, t+dur); }
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.10, t+dur*0.4);
  g.gain.exponentialRampToValueAtTime(0.001, t+dur);
  src.connect(bp); bp.connect(g); g.connect(actx.destination);
  src.start(t); src.stop(t+dur+0.05);
}

/* ── STOPDOWN — momentarily duck the music bus to near-silence, then it
   returns/the drop hits. (research: silence before the hit = bigger impact) */
function stopdown(ms, thenFn) {
  if (!actx) { if(thenFn) T(thenFn, ms); return; }
  const t = actx.currentTime;
  if (musicBus) {
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t);
    musicBus.gain.linearRampToValueAtTime(0.0001, t+0.04);  // quick duck to silence
  }
  if (thenFn) T(thenFn, ms);
}
function stopdownRelease() {
  if (!actx || !musicBus) return;
  const t = actx.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(0.0001, t);
  musicBus.gain.linearRampToValueAtTime(1, t+0.3);
}
function glitchSound() {
  if (TONE.ready && soundOn) { return toneGlitch(); }
  if (!soundOn || !actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type='sawtooth'; o.frequency.setValueAtTime(2000, actx.currentTime);
  o.frequency.linearRampToValueAtTime(400, actx.currentTime+0.08);
  g.gain.setValueAtTime(0.03, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime+0.08);
  o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime+0.08);
}

/* ════════════════════════════════════════════════
   TONE.JS SOUND IMPLEMENTATIONS
   These are called by the wrappers below when the
   Tone rack is live. Richer, compressed, reverbed.
   ════════════════════════════════════════════════ */
const N = (n)=>Tone.Frequency(n).toFrequency();
function tnow(){ return Tone.now(); }

function toneKey() {
  if (!TONE.ready || !soundOn) return;
  try { TONE.blip.triggerAttackRelease(1400 + Math.random()*700, 0.015, tnow(), 0.5); } catch(e){}
}
function toneReward(big) {
  if (!TONE.ready || !soundOn) return;
  const t = tnow();
  try {
    if (big) TONE.bell.triggerAttackRelease(['A4','E5'], 0.5, t, 0.9);
    else     TONE.bell.triggerAttackRelease(['C6','G6'], 0.22, t, 0.5);
  } catch(e){}
}
function toneGlitch() {
  if (!TONE.ready || !soundOn) return;
  const t = tnow();
  try {
    TONE.noiseFilter.frequency.cancelScheduledValues(t);
    TONE.noiseFilter.frequency.setValueAtTime(3000, t);
    TONE.noiseFilter.frequency.exponentialRampToValueAtTime(400, t+0.09);
    TONE.noise.triggerAttackRelease(0.09, t);
  } catch(e){}
}
function toneWhoosh(up) {
  if (!TONE.ready || !soundOn) return;
  const t = tnow(), dur = 0.42;
  try {
    TONE.noiseFilter.frequency.cancelScheduledValues(t);
    if (up) { TONE.noiseFilter.frequency.setValueAtTime(500, t); TONE.noiseFilter.frequency.exponentialRampToValueAtTime(6000, t+dur); }
    else    { TONE.noiseFilter.frequency.setValueAtTime(6000, t); TONE.noiseFilter.frequency.exponentialRampToValueAtTime(500, t+dur); }
    TONE.noise.envelope.attack = dur*0.7; TONE.noise.envelope.release = 0.15;
    TONE.noise.triggerAttackRelease(dur, t);
  } catch(e){}
}
// THREE-BAND RISER through Tone
function toneRiser(dur) {
  if (!TONE.ready || !soundOn) return;
  const t = tnow();
  try {
    // HIGH: noise sweep up
    TONE.noiseFilter.frequency.cancelScheduledValues(t);
    TONE.noiseFilter.frequency.setValueAtTime(400, t);
    TONE.noiseFilter.frequency.exponentialRampToValueAtTime(9000, t+dur);
    TONE.noise.envelope.attack = dur*0.85; TONE.noise.envelope.release = 0.1;
    TONE.noise.triggerAttackRelease(dur, t);
    // MID: pitch-rising pluck cluster, accelerating
    let d = 0.14;
    const climb = (i, time)=>{
      if (time > dur) return;
      const f = 220 * Math.pow(2, time/dur*2); // up two octaves over the riser
      TONE.arp.triggerAttackRelease(f, 0.12, t+time, 0.5);
      d = Math.max(0.04, d*0.9);
      climb(i+1, time+d);
    };
    climb(0, 0);
    // LOW: sub swell rising
    TONE.sub.triggerAttack('A1', t, 0.4);
    TONE.sub.frequency.cancelScheduledValues(t);
    TONE.sub.frequency.setValueAtTime(N('A1'), t);
    TONE.sub.frequency.exponentialRampToValueAtTime(N('A2'), t+dur);
    TONE.sub.triggerRelease(t+dur);
  } catch(e){}
}
function toneReverseSwell(dur) {
  if (!TONE.ready || !soundOn) return;
  const t = tnow();
  try {
    // reversed-feel: filter opens and volume grows toward the end
    TONE.noiseFilter.frequency.cancelScheduledValues(t);
    TONE.noiseFilter.frequency.setValueAtTime(300, t);
    TONE.noiseFilter.frequency.exponentialRampToValueAtTime(7000, t+dur);
    TONE.noise.envelope.attack = dur*0.92; TONE.noise.envelope.release = 0.05;
    TONE.noise.triggerAttackRelease(dur, t);
  } catch(e){}
}
// SOFT SWELL through Tone — clean warm pad crescendo into the drop (no noise)
function toneSoftSwell(dur) {
  if (!TONE.ready || !soundOn) return;
  const t = tnow();
  try {
    // warm low pad rising in via filter + a gentle volume swell on the pad synth
    TONE.padFilter.frequency.cancelScheduledValues(t);
    TONE.padFilter.frequency.setValueAtTime(250, t);
    TONE.padFilter.frequency.linearRampToValueAtTime(1000, t+dur);  // opens gently
    // low warm cluster, soft attack, swells over the build
    TONE.pad.triggerAttackRelease(['E2','A2','E3'], dur+0.2, t, 0.55);
    // soft sub rising underneath — felt
    TONE.sub.volume.value = -4;
    TONE.sub.triggerAttack('A1', t, 0.25);
    TONE.sub.frequency.cancelScheduledValues(t);
    TONE.sub.frequency.setValueAtTime(N('E1'), t);
    TONE.sub.frequency.linearRampToValueAtTime(N('A1'), t+dur);
    TONE.sub.triggerRelease(t+dur);
  } catch(e){}
}
// THE DROP through Tone — DEEP, BASS-DRIVEN, clean (no harsh noise/brass)
function toneDrop() {
  if (!TONE.ready || !soundOn) return;
  const t = tnow();
  try {
    // ── primary SUB slam: deep to ~28Hz, louder, long weighty tail ──
    TONE.sub.volume.value = 1;                 // push the sub up front
    TONE.sub.triggerAttack('A1', t, 1.0);
    TONE.sub.frequency.cancelScheduledValues(t);
    TONE.sub.frequency.setValueAtTime(N('A2'), t);
    TONE.sub.frequency.exponentialRampToValueAtTime(28, t+0.6);   // slow drop = lands with weight
    TONE.sub.triggerRelease(t+1.5);

    // ── clean low BOOM under it for body (sine, not noise) ──
    const boomFreq = N('A1');
    const boom = new Tone.MembraneSynth({
      pitchDecay:0.08, octaves:3,
      oscillator:{ type:'sine' },
      envelope:{ attack:0.001, decay:1.1, sustain:0, release:0.6 }
    }).connect(TONE.subIn);
    boom.volume.value = 2;
    boom.triggerAttackRelease('A1', 1.2, t);
    setTimeout(()=>{ try{boom.dispose();}catch(e){} }, 2200);

    // ── one soft warm low-mid note for tone (no bright chord, no distortion) ──
    TONE.pad.triggerAttackRelease(['A2','E3'], 1.6, t, 0.5);
  } catch(e){}
}
// THE SONIC SIGNATURE through Tone — bell motif E5 -> A5 -> C#6
function toneSignature(delay) {
  if (!TONE.ready || !soundOn) return;
  const t = tnow() + (delay||0);
  try {
    TONE.bell.triggerAttackRelease('E5', 0.5, t+0.00, 0.8);
    TONE.bell.triggerAttackRelease('A5', 0.5, t+0.12, 0.85);
    TONE.bell.triggerAttackRelease('C#6', 0.9, t+0.24, 0.9);
    // shimmer high octave
    TONE.bell.triggerAttackRelease('A6', 1.2, t+0.26, 0.4);
  } catch(e){}
}
function toneBootHitWrap(){ toneDrop(); }

// ── MUSIC JOURNEY through Tone (tempo-aware pads/arps) ──
let toneMusicPhase = null, toneLoops = [];
function clearToneLoops(){ toneLoops.forEach(l=>{ try{l.dispose&&l.dispose();}catch(e){} clearInterval(l);}); toneLoops=[]; }
function tonePhaseA() {
  if (!TONE.ready) return; toneMusicPhase='A'; clearToneLoops();
  try {
    TONE.padFilter.frequency.rampTo(700, 4);
    TONE.pad.triggerAttackRelease(['A2','E3','A3'], 8, tnow(), 0.6);
    // heartbeat pulse
    let step=0;
    const id=setInterval(()=>{ if(!soundOn) return;
      const seq=['A3',null,'E3',null,'A3',null,'C4',null];
      const n=seq[step%seq.length];
      if(n) TONE.arp.triggerAttackRelease(n,0.4,tnow(),0.4);
      if(step%8===0) TONE.sub.triggerAttackRelease('A1',0.6,tnow(),0.5);
      step++;
    }, 360);
    toneLoops.push(id);
  } catch(e){}
}
function tonePhaseB() {
  if (!TONE.ready) return; if(toneMusicPhase==='B')return; toneMusicPhase='B'; clearToneLoops();
  try {
    TONE.padFilter.frequency.rampTo(1300, 3);
    TONE.pad.triggerAttackRelease(['A2','C3','E3','B3'], 6, tnow(), 0.6); // add tension 9th
    let step=0;
    const id=setInterval(()=>{ if(!soundOn) return;
      const seq=['A3','B3','E3','F#4','A3','C4','E4','B3'];
      TONE.arp.triggerAttackRelease(seq[step%seq.length],0.32,tnow(),0.35);
      if(step%4===0) TONE.sub.triggerAttackRelease('A1',0.5,tnow(),0.5);
      step++;
    }, 200);
    toneLoops.push(id);
  } catch(e){}
}
function tonePhaseC() {
  if (!TONE.ready) return; if(toneMusicPhase==='C')return; toneMusicPhase='C'; clearToneLoops();
  try {
    TONE.padFilter.frequency.rampTo(2200, 1.5);
    const arp=['A3','C4','E4','A4','C5','E5','A5'];
    let i=0, delay=110;
    function nextArp(){ if(!soundOn){ const id=setTimeout(nextArp,delay); toneLoops.push(id); return; }
      TONE.arp.triggerAttackRelease(arp[i%arp.length],0.3,tnow(),0.45);
      i++; delay=Math.max(45,delay-4);
      const id=setTimeout(nextArp,delay); toneLoops.push(id);
    }
    TONE.sub.triggerAttackRelease('A1',2.0,tnow(),0.5);
    nextArp();
  } catch(e){}
}
function tonePhaseD() {
  if (!TONE.ready) return; toneMusicPhase='D'; clearToneLoops();
  try {
    TONE.padFilter.frequency.rampTo(3000, 0.5);
    // big A major resolve
    TONE.pad.triggerAttackRelease(['A2','C#4','E4','A4','C#5'], 4.5, tnow(), 0.8);
  } catch(e){}
}
function tonePhaseE() {
  if (!TONE.ready) return; if(toneMusicPhase==='E')return; toneMusicPhase='E'; clearToneLoops();
  try {
    TONE.padFilter.frequency.rampTo(1600, 3);
    function cycle(){ if(!soundOn){ const id=setTimeout(cycle,8000); toneLoops.push(id); return; }
      TONE.pad.triggerAttackRelease(['A2','C#4','E4','G4'], 4, tnow(), 0.5);
      TONE.pad.triggerAttackRelease(['F#3','A3','C#4','E4'], 4, tnow()+4, 0.5);
      TONE.pad.triggerAttackRelease(['D3','F#4','A4','C#5'], 4, tnow()+8, 0.5);
      TONE.pad.triggerAttackRelease(['E3','G4','B4','E4'], 4, tnow()+12, 0.5);
      const id=setTimeout(cycle,16000); toneLoops.push(id);
    }
    cycle();
  } catch(e){}
}
function toneStopdown(ms, thenFn){
  if (!TONE.ready) { if(thenFn) T(thenFn, ms); return; }
  try {
    TONE.master.gain.cancelScheduledValues(tnow());
    TONE.master.gain.setValueAtTime(TONE.master.gain.value, tnow());
    TONE.master.gain.linearRampToValueAtTime(0.0001, tnow()+0.04);
  } catch(e){}
  if (thenFn) T(thenFn, ms);
}
function toneStopdownRelease(){
  if (!TONE.ready) return;
  try { TONE.master.gain.cancelScheduledValues(tnow()); TONE.master.gain.setValueAtTime(0.0001, tnow()); TONE.master.gain.linearRampToValueAtTime(1, tnow()+0.3); } catch(e){}
}

/* ═══════════════ REACTIVE GRID ═══════════════ */
const gridbg = document.getElementById('gridbg');
let curMx = 50, curMy = 50, tgtMx = 50, tgtMy = 50;
window.addEventListener('mousemove', e => {
  tgtMx = (e.clientX / window.innerWidth) * 100;
  tgtMy = (e.clientY / window.innerHeight) * 100;
});
function gridFollow() {
  curMx += (tgtMx - curMx) * 0.06;
  curMy += (tgtMy - curMy) * 0.06;
  gridbg.style.setProperty('--mx', curMx + '%');
  gridbg.style.setProperty('--my', curMy + '%');
  requestAnimationFrame(gridFollow);
}
gridFollow();

/* ═══════════════ LIVE TICKER DATA ═══════════════ */
const TOKENS = ['$SOLBONK','$MOONPMP','$LUNAFI','$DEGEN','$PEPESOL','$WIFHAT','$BODEN','$SLERF','$POPCAT','$GHOSTX','$MYRO','$SAMO'];
let tickerRows = [];
function initTicker() {
  const wrap = document.getElementById('ticker-rows');
  wrap.innerHTML = '';
  tickerRows = [];
  for (let i=0;i<14;i++) {
    const sym = TOKENS[Math.floor(Math.random()*TOKENS.length)];
    const row = document.createElement('div');
    row.className = 'trow';
    row.innerHTML = `<span class="tsym">${sym}</span><span class="tpct"></span><span class="tflag"></span>`;
    wrap.appendChild(row);
    tickerRows.push(row);
  }
}
function tickTicker() {
  tickerRows.forEach(row => {
    if (Math.random() > 0.6) {
      const up = Math.random() > 0.32;
      const pct = (Math.random()*(up?500:99)).toFixed(0);
      const rug = !up && Math.random() > 0.7;
      const p = row.querySelector('.tpct'); const f = row.querySelector('.tflag');
      p.className = 'tpct ' + (up?'up':'down');
      p.textContent = (up?'+':'-') + pct + '%';
      f.className = 'tflag ' + (rug?'rug':'safe');
      f.textContent = rug ? '⚠ RUG' : '✓';
      if (Math.random() > 0.7) row.querySelector('.tsym').textContent = TOKENS[Math.floor(Math.random()*TOKENS.length)];
    }
  });
}
let tickerInterval = null;

/* ═══════════════ BOOT SCRIPT ═══════════════ */
const SCRIPT = [
  { type:'type', html:`<span class="prompt">moonai@solana</span><span class="dim">:~$</span> <span class="white">./boot --mainnet</span>`, speed:22, after:240 },
  { type:'blank' },
  { type:'instant', html:`<span class="dim">MoonAI Engine</span> <span class="cyanc">v1.0.0</span> <span class="dim">— Solana token intelligence</span>`, after:160 },
  { type:'instant', html:`<span class="dim">────────────────────────────────────────────</span>`, after:120 },
  { type:'type', html:`<span class="ok">[ OK ]</span> connecting to Solana mainnet`, speed:9, after:120, trail:'CONNECTED', sfx:'ok' },
  { type:'type', html:`<span class="ok">[ OK ]</span> loading pump.fun feed`, speed:9, after:110, trail:'LIVE', sfx:'ok', showTicker:true },
  { type:'bar',  label:`<span class="ok">[ .. ]</span> indexing token registry`, after:120, barTrail:'24,817 tokens' },
  { type:'type', html:`<span class="ok">[ OK ]</span> calibrating rug-detection model`, speed:8, after:140, trail:'ONLINE', sfx:'ok' },
  { type:'type', html:`<span class="warnc">[WARN]</span> <span class="dim">4 active threats detected in last block</span>`, speed:7, after:120, sfx:'warn' },
  { type:'instant', html:`       <span class="errc">⚠ $GHOSTX</span>  <span class="dim">liquidity pulled · flagged · holders warned</span>`, after:200, sfx:'err' },
  { type:'type', html:`<span class="ok">[ OK ]</span> securing community channel`, speed:9, after:120, trail:'SAFE', sfx:'ok' },
  { type:'blank' },
  { type:'type', html:`<span class="prompt">moonai@solana</span><span class="dim">:~$</span> <span class="white">decrypt --identity</span>`, speed:24, after:300 },
  { type:'decrypt' }
];

function makeBar(pct) {
  const total = 22, filled = Math.round(total*pct); let s='';
  for (let i=0;i<total;i++) s += i<filled ? '█' : '<span class="empty">░</span>';
  return `[${s}] ${String(Math.round(pct*100)).padStart(3,' ')}%`;
}
function addLine() { const el = document.createElement('div'); el.className='ln'; term.appendChild(el); el.style.opacity='1'; return el; }

function typeLine(el, html, speed, done) {
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  const ops = []; const stack = [];
  (function walk(node){ node.childNodes.forEach(c=>{
    if(c.nodeType===3){ for(const ch of c.textContent) ops.push({t:'c',ch}); }
    else if(c.nodeType===1){ ops.push({t:'o',tag:c.tagName.toLowerCase(),cls:c.className,style:c.getAttribute('style')||''}); walk(c); ops.push({t:'x'}); }
  });})(tmp);
  let i=0, built='';
  function closeOpen(st){ return st.map(t=>`</${t}>`).reverse().join(''); }
  function tick(){
    while(i<ops.length){
      const op=ops[i++];
      if(op.t==='o'){ const c=op.cls?` class="${op.cls}"`:''; const s=op.style?` style="${op.style}"`:''; built+=`<${op.tag}${c}${s}>`; stack.push(op.tag); }
      else if(op.t==='x'){ built+=`</${stack.pop()}>`; }
      else if(op.t==='c'){ built+= op.ch===' '?'&nbsp;':op.ch; el.innerHTML=built+closeOpen(stack)+'<span class="cursor"></span>'; if(op.ch!==' ') key(); T(tick,speed); return; }
    }
    el.innerHTML=built; done&&done();
  }
  tick();
}

function runScript(idx){
  if (booted) return;
  if (idx>=SCRIPT.length) return;
  const step = SCRIPT[idx];
  if (step.type==='decrypt'){ T(startDecrypt, 200); return; }
  if (step.showTicker){ document.getElementById('ticker-col').style.opacity='1'; if(!tickerInterval) tickerInterval=setInterval(tickTicker,140); }

  if (step.type==='blank'){ const el=addLine(); el.innerHTML='&nbsp;'; runScript(idx+1); return; }
  if (step.type==='instant'){ const el=addLine(); el.innerHTML=step.html; if(step.sfx==='err')beep(180,0.15,0.07); T(()=>runScript(idx+1), step.after||100); return; }
  if (step.type==='type'){
    const el=addLine();
    typeLine(el, step.html, step.speed||14, ()=>{
      if(step.trail) el.innerHTML+=` <span class="dim">…</span> <span class="ok">${step.trail}</span>`;
      if(step.sfx==='ok') reward(false);
      if(step.sfx==='warn') { beep(440,0.12,0.06); musicPhaseB(); }
      T(()=>runScript(idx+1), step.after||120);
    });
    return;
  }
  if (step.type==='bar'){
    const el=addLine(); el.innerHTML=step.label+'  <span class="pbar"></span>';
    const barEl=el.querySelector('.pbar'); let pct=0;
    (function grow(){
      pct += 0.04+Math.random()*0.06;
      if(Math.random()>0.5) key();
      if(pct>=1){ pct=1; barEl.innerHTML=makeBar(1);
        el.innerHTML=el.innerHTML.replace('[ .. ]','<span class="ok">[ OK ]</span>');
        if(step.barTrail) el.innerHTML+=` <span class="dim">…</span> <span class="ok">${step.barTrail}</span>`;
        reward(false);
        T(()=>runScript(idx+1), step.after||120); return; }
      barEl.innerHTML=makeBar(pct); T(grow, 60+Math.random()*50);
    })();
    return;
  }
}

/* ═══════════════════════════════════════════
   THE DECRYPTION RESOLVE — the new hero moment
   Boot text scrambles, cascades, and the screen
   reorganizes into an ASCII MOONAI which then
   "compiles" into the clean logo.
   ═══════════════════════════════════════════ */
const ASCII_ART = String.raw`
 __  __  ___   ___  _   _    _    ___
|  \/  |/ _ \ / _ \| \ | |  / \  |_ _|
| |\/| | | | | | | |  \| | / _ \  | |
| |  | | |_| | |_| | |\  |/ ___ \ | |
|_|  |_|\___/ \___/|_| \_/_/   \_\___|
`;
const GLYPHS = '!<>-_\\/[]{}—=+*^?#________01';

function startDecrypt() {
  if (booted) return;
  booted = true;
  glitchSound();
  musicPhaseC();

  // 1) Scramble all existing terminal lines into noise, then collapse
  const lines = [...term.querySelectorAll('.ln')];
  lines.forEach((ln, i) => {
    T(() => {
      const len = Math.min(ln.textContent.length || 20, 60);
      let scr = '';
      for (let k=0;k<len;k++) scr += GLYPHS[Math.floor(Math.random()*GLYPHS.length)];
      ln.innerHTML = `<span class="dim">${scr}</span>`;
      key();
    }, i * 22);
  });

  // 2) Fade terminal, show resolve stage with cascading ASCII decrypt
  T(() => {
    term.style.transition = 'opacity 300ms ease';
    term.style.opacity = '0';
    document.getElementById('ticker-col').style.opacity = '0';
    document.getElementById('resolve').style.display = 'flex';
    decryptAscii();
  }, lines.length * 22 + 250);
}

function decryptAscii() {
  const asciiEl = document.getElementById('ascii');
  asciiEl.style.opacity = '1';
  const target = ASCII_ART;
  const chars = target.split('');
  // each non-space, non-newline char resolves from random glyphs over time
  const resolved = new Array(chars.length).fill(false);
  const settleOrder = [];
  chars.forEach((c, i) => { if (c !== ' ' && c !== '\n') settleOrder.push(i); });
  // shuffle settle order for organic decrypt
  for (let i=settleOrder.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [settleOrder[i],settleOrder[j]]=[settleOrder[j],settleOrder[i]]; }

  let settledCount = 0;
  const totalToSettle = settleOrder.length;
  const settleInterval = setInterval(() => {
    // settle a batch
    for (let b=0;b<4 && settledCount<totalToSettle;b++) {
      resolved[settleOrder[settledCount++]] = true;
    }
    if (Math.random()>0.7) key();
  }, 26);

  let frames = 0;
  const render = setInterval(() => {
    let out = '';
    for (let i=0;i<chars.length;i++) {
      const c = chars[i];
      if (c === '\n' || c === ' ') { out += c; continue; }
      out += resolved[i] ? c : GLYPHS[Math.floor(Math.random()*GLYPHS.length)];
    }
    asciiEl.textContent = out;
    frames++;
    if (settledCount >= totalToSettle) {
      clearInterval(render); clearInterval(settleInterval);
      asciiEl.textContent = target;
      // ── BUILD: a clean, soft swell rising gently into the compile hit ──
      softSwell(0.85);
      // ── STOPDOWN: kill the music to silence ~150ms before the drop ──
      //    (research: silence before the hit makes it hit exponentially harder)
      T(()=>stopdown(150, compileToLogo), 800);
    }
  }, 30);
}

function compileToLogo() {
  const asciiEl = document.getElementById('ascii');
  const resolve = document.getElementById('resolve');

  // green flash + THE DROP (after the stopdown silence — maximum impact)
  const flash = document.getElementById('flash');
  flash.style.transition = 'opacity 90ms ease'; flash.style.opacity = '0.9';
  bootHit();                    // deep bass-driven drop
  stopdownRelease();            // music swells back in
  musicPhaseD();                // resolve chord journey
  sonicSignature(0.35);         // ♪ signature shimmers in AFTER the bass lands
  T(()=>{ flash.style.transition='opacity 450ms ease'; flash.style.opacity='0'; }, 90);

  // ascii "implodes" into center
  asciiEl.style.transition = 'transform 500ms cubic-bezier(0.7,0,0.2,1), opacity 450ms ease, filter 450ms ease';
  asciiEl.style.transform = 'scale(0.3)';
  asciiEl.style.opacity = '0';
  asciiEl.style.filter = 'blur(8px) brightness(2.5)';

  // grid blooms, sweep on
  gridbg.style.opacity = '1';
  document.getElementById('sweep').style.opacity = '1';

  T(() => {
    resolve.style.display = 'none';
    showUI();
  }, 360);
}

/* ═══════════════ FINAL UI ═══════════════ */
function buildLogo() {
  const base = document.querySelector('#logo .base'); base.innerHTML='';
  [...'MoonAI'].forEach((c,i)=>{ const s=document.createElement('span'); s.className='lch'+(i<4?' moon':''); s.textContent=c; base.appendChild(s); });
  return [...base.querySelectorAll('.lch')];
}

function showUI() {
  ui.style.transition = 'opacity 450ms ease';
  ui.style.opacity = '1';
  const letters = buildLogo();
  // letters "snap" in from scale (compiled feel) rather than slide
  letters.forEach((ch,i)=>{
    ch.style.opacity='0'; ch.style.transform='scale(1.6)'; ch.style.filter='blur(6px)';
    T(()=>{
      ch.style.transition='opacity 260ms ease, transform 360ms cubic-bezier(0.34,1.56,0.64,1), filter 260ms ease';
      ch.style.opacity='1'; ch.style.transform='scale(1)'; ch.style.filter='blur(0)';
      beep(700+i*60, 0.05, 0.03);
    }, i*60);
  });

  const settleAt = letters.length*60 + 200;
  T(()=>{ glitchPulse(2); glitchSound(); }, settleAt);
  T(()=>glitchPulse(1), settleAt+1500);

  T(()=>reveal(document.getElementById('tag'),'translateY(0)'), settleAt+250);
  T(()=>{
    const sl=document.getElementById('statline'); sl.style.transition='opacity 600ms ease'; sl.style.opacity='1';
    countUp(document.getElementById('s1'), 24817, 1200);
    countUp(document.getElementById('s2'), 3042, 1200);
  }, settleAt+600);
  T(()=>{ ui.style.pointerEvents='auto'; reveal(document.getElementById('enter'),'translateY(0)'); }, settleAt+950);

  T(()=>{ document.getElementById('skip').style.display='none'; document.getElementById('replay').style.opacity='1'; }, settleAt+1150);

  // keep ticker alive in background subtly
  T(()=>{ const tc=document.getElementById('ticker-col'); tc.style.opacity='0.25'; }, settleAt+1400);

  // music settles into warm final pad after the resolve rings out
  T(()=>musicPhaseE(), settleAt+1800);

  startAmbientGlitch(settleAt+2800);
}

function countUp(el, target, dur) {
  let start=0, t0=performance.now();
  function step(now){ let p=Math.min(1,(now-t0)/dur); const e=1-Math.pow(1-p,3);
    el.textContent=Math.floor(target*e).toLocaleString(); if(p<1)requestAnimationFrame(step); else el.textContent=target.toLocaleString(); }
  requestAnimationFrame(step);
}
function reveal(el, tf){ el.style.transition='opacity 600ms ease, transform 600ms cubic-bezier(0.22,1,0.36,1)'; el.style.opacity='1'; el.style.transform=tf; }

function glitchPulse(intensity){
  const r=document.getElementById('gl-r'), c=document.getElementById('gl-c');
  let n=0; const max=6*intensity;
  (function frame(){
    if(n>=max){ r.style.opacity='0'; c.style.opacity='0'; r.style.transform='none'; c.style.transform='none'; return; }
    const dx=(Math.random()-0.5)*10*intensity, dy=(Math.random()-0.5)*5;
    r.style.opacity='0.55'; c.style.opacity='0.55';
    r.style.transform=`translate(${dx}px,${dy}px)`; c.style.transform=`translate(${-dx}px,${-dy}px)`;
    n++; T(frame,45);
  })();
}
function startAmbientGlitch(delay){ T(function loop(){ if(Math.random()>0.55){glitchPulse(1); if(Math.random()>0.6)glitchSound();} T(loop, 2800+Math.random()*2600); }, delay); }

/* ═══════════════ CONTROLS ═══════════════ */
function skipBoot(){ if(booted)return; clearAll(); if(tickerInterval)clearInterval(tickerInterval); startDecrypt(); }
function enterClick(){
  const flash=document.getElementById('flash');
  flash.style.transition='opacity 80ms ease'; flash.style.opacity='0.7';
  glitchPulse(2); bootHit();
  localStorage.setItem('moonai_intro_seen','1');
  T(()=>{ window.location.href='./app.html'; }, 420);
}

function startInstant(){
  booted=true; term.style.display='none';
  gridbg.style.opacity='1'; document.getElementById('sweep').style.opacity='1';
  document.getElementById('skip').style.display='none';
  ui.style.opacity='1';
  const letters=buildLogo(); letters.forEach(ch=>{ch.style.opacity='1';ch.style.transform='none';ch.style.filter='none';});
  document.getElementById('tag').style.opacity='1'; document.getElementById('tag').style.transform='none';
  document.getElementById('statline').style.opacity='1';
  document.getElementById('s1').textContent='24,817'; document.getElementById('s2').textContent='3,042';
  document.getElementById('enter').style.opacity='1'; document.getElementById('enter').style.transform='none';
  document.getElementById('replay').style.opacity='1';
}

/* ═══════════════ GO ═══════════════ */
initTicker();

let woke = false;
let swarmCanvas, sctx2, swarmRAF, swarmStart=null, swarmFlare=0, particles=[];
let flowParticles = [];
const NOISE_SCALE = 0.0016, FIELD_SPEED = 0.05, P_SPEED = 1.5;
let audioArmed = false, audioStarted = false;
let greetingDone = false;
let greetingTimer = null;

/* ── PHASE TIMELINE (seconds) ── */
/* ── PHASE TIMELINE (seconds) — gravity well ── */
const STAR_START = 0.3, STAR_SPREAD = 0.8;   // stars wake fast, tight stagger
const WELL_AT    = 1.1;                        // the gravity well "ignites" — pull begins
const MOON_START = 1.1, MOON_SPREAD = 0.0;    // (kept for line-reveal timing compat)
const FORM_DONE  = 1.5;                        // greeting rolls in once the field is established

if (reduceMotion) {
  // skip the ceremony for reduced motion — go straight to app
  localStorage.setItem('moonai_intro_seen','1');
  window.location.replace('./app.html');
} else {
  startSwarm();
  // greeting + prompt now fire AFTER the moon has formed (driven from swarmLoop timing)
  // wake on ENTER, click, or tap — but only after greeting finishes
  function onWakeKey(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tryWake(); } }
  window.addEventListener('keydown', onWakeKey);
  document.getElementById('wake-gate').addEventListener('click', tryWake);
  document.getElementById('wake-gate').addEventListener('touchstart', (e)=>{ e.preventDefault(); tryWake(); }, {passive:false});
}

let greetingStarted = false;
function tryWake() {
  if (!greetingStarted) return;            // ignore input until the sequence is ready
  if (!greetingDone) { skipGreeting(); return; } // first press finishes the greeting
  wake();
}

/* ─── THE AI GREETS YOU FIRST ─── */
function greetingForTime() {
  const h = new Date().getHours();
  let part = 'Hello';
  if (h < 5)       part = 'You\u2019re up late';
  else if (h < 12) part = 'Good morning';
  else if (h < 18) part = 'Good afternoon';
  else             part = 'Good evening';
  // returns array of segments (text + optional accent flag)
  return [
    {t: part + '. '},
    {t: 'MoonAI', accent: true},
    {t: ' is ready when you are.'}
  ];
}
function typeGreeting() {
  const segs = greetingForTime();
  const el = document.getElementById('greeting-text');
  // flatten to char list with accent spans
  const chars = [];
  segs.forEach(s => { for (const c of s.t) chars.push({c, accent: !!s.accent}); });
  let i = 0;
  function tick() {
    if (i >= chars.length) { finishGreeting(); return; }
    // rebuild html up to i
    let html = '', inAccent = false;
    for (let k=0;k<=i;k++) {
      const ch = chars[k];
      if (ch.accent && !inAccent) { html += '<span class="accent">'; inAccent = true; }
      if (!ch.accent && inAccent) { html += '</span>'; inAccent = false; }
      html += ch.c === ' ' ? '&nbsp;' : ch.c;
    }
    if (inAccent) html += '</span>';
    el.innerHTML = html;
    i++;
    // human-ish cadence: slight pause on punctuation
    const last = chars[i-1].c;
    let d = 24 + Math.random()*20;
    if (last === '.' ) d = 240;
    if (last === ',') d = 140;
    greetingTimer = setTimeout(tick, d);
  }
  // small delay before it "speaks"
  greetingTimer = setTimeout(tick, 450);
}
function skipGreeting() {
  if (greetingDone) return;
  clearTimeout(greetingTimer);
  const segs = greetingForTime();
  const el = document.getElementById('greeting-text');
  el.innerHTML = segs.map(s => s.accent ? `<span class="accent">${s.t.replace(/ /g,'&nbsp;')}</span>` : s.t.replace(/ /g,'&nbsp;')).join('');
  finishGreeting();
}
function finishGreeting() {
  if (greetingDone) return;
  greetingDone = true;
  // reveal the prompt + sub
  document.getElementById('wake-prompt').style.opacity = '1';
  document.getElementById('wake-sub').style.opacity = '1';
}

/* ════════════════════════════════════════════════
   THE PARTICLE SWARM — a constellation of dots that
   drifts in, forms a crescent moon, breathes, and
   connects nearby dots with faint lines (network feel).
   On wake, the swarm bursts outward.
   ════════════════════════════════════════════════ */
function startSwarm() {
  swarmCanvas = document.getElementById('swarm-canvas');
  sctx2 = swarmCanvas.getContext('2d');
  sizeSwarm();
  window.addEventListener('resize', ()=>{ sizeSwarm(); buildParticles(); });
  buildParticles();
  // fade canvas up from black (cinematic)
  requestAnimationFrame(()=> requestAnimationFrame(()=> { swarmCanvas.style.opacity = '1'; }));
  swarmRAF = requestAnimationFrame(swarmLoop);
}
function sizeSwarm() {
  if (!swarmCanvas) return;
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  swarmCanvas.width = window.innerWidth * dpr;
  swarmCanvas.height = window.innerHeight * dpr;
  swarmCanvas.style.width = window.innerWidth+'px';
  swarmCanvas.style.height = window.innerHeight+'px';
  sctx2.setTransform(dpr,0,0,dpr,0,0);
}

/* ════════════════════════════════════════════════
   FLOW FIELD — full-bleed curl-noise currents.
   Hundreds of particles flow along an invisible
   vector field (derived from animated Perlin noise),
   leaving fading trails. The motion IS the environment;
   there is no centerpiece object.
   ════════════════════════════════════════════════ */

// ── compact Perlin noise (seeded) ──
const FPerlin = (() => {
  const perm = new Uint8Array(512);
  const p = []; for (let i=0;i<256;i++) p[i]=i;
  let s=2206; const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647;};
  for (let i=255;i>0;i--){const j=Math.floor(rnd()*(i+1));[p[i],p[j]]=[p[j],p[i]];}
  for (let i=0;i<512;i++) perm[i]=p[i&255];
  const fade=t=>t*t*t*(t*(t*6-15)+10), lerp=(a,b,t)=>a+t*(b-a);
  const grad=(h,x,y)=>{const u=(h&1)?x:-x,v=(h&2)?y:-y;return u+v;};
  return (x,y)=>{
    const X=Math.floor(x)&255,Y=Math.floor(y)&255;
    x-=Math.floor(x);y-=Math.floor(y);
    const u=fade(x),v=fade(y);
    const a=perm[X]+Y,b=perm[X+1]+Y;
    return lerp(lerp(grad(perm[a],x,y),grad(perm[b],x-1,y),u),
                lerp(grad(perm[a+1],x,y-1),grad(perm[b+1],x-1,y-1),u),v);
  };
})();

// flow particle pool
const FIELD_SPEED_UNUSED = 0; // (constants hoisted to GO block)

function startSwarm() {              // (kept name for the rest of the wiring)
  swarmCanvas = document.getElementById('swarm-canvas');
  sctx2 = swarmCanvas.getContext('2d');
  sizeSwarm();
  window.addEventListener('resize', ()=>{ sizeSwarm(); buildParticles(); });
  buildParticles();
  // paint solid black once so trails fade against it
  sctx2.fillStyle = '#000'; sctx2.fillRect(0,0,window.innerWidth,window.innerHeight);
  requestAnimationFrame(()=> requestAnimationFrame(()=> { swarmCanvas.style.opacity = '1'; }));
  swarmRAF = requestAnimationFrame(swarmLoop);
}
function sizeSwarm() {
  if (!swarmCanvas) return;
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  swarmCanvas.width = window.innerWidth * dpr;
  swarmCanvas.height = window.innerHeight * dpr;
  swarmCanvas.style.width = window.innerWidth+'px';
  swarmCanvas.style.height = window.innerHeight+'px';
  sctx2.setTransform(dpr,0,0,dpr,0,0);
}

function buildParticles() {
  const w = window.innerWidth, h = window.innerHeight;
  const COUNT = Math.min(900, Math.floor(w*h/2200)); // dense, scales with screen
  flowParticles = [];
  for (let i=0;i<COUNT;i++) {
    flowParticles.push(spawnFlow(w, h, true));
  }
}
function spawnFlow(w, h, initial) {
  return {
    x: Math.random()*w,
    y: Math.random()*h,
    px: 0, py: 0,
    life: initial ? Math.random()*200 : 0,
    maxLife: 120 + Math.random()*220,
    speed: P_SPEED*(0.6+Math.random()*0.8),
    // brighter "lead" particles vs faint majority
    lead: Math.random() < 0.12,
    bornAt: 0
  };
}

// curl of the noise field -> divergence-free (fluid) flow, no sinks
function flowAngle(x, y, t) {
  // sample noise; curl = perpendicular to gradient
  const e = 1.0;
  const n1 = FPerlin(x*NOISE_SCALE, (y+e)*NOISE_SCALE + t);
  const n2 = FPerlin(x*NOISE_SCALE, (y-e)*NOISE_SCALE + t);
  const n3 = FPerlin((x+e)*NOISE_SCALE, y*NOISE_SCALE + t);
  const n4 = FPerlin((x-e)*NOISE_SCALE, y*NOISE_SCALE + t);
  const curlX = (n1 - n2);
  const curlY = (n4 - n3);
  return Math.atan2(curlY, curlX);
}

function swarmLoop(ts) {
  if (!swarmStart) swarmStart = ts;
  const t = (ts - swarmStart) / 1000;
  const w = window.innerWidth, h = window.innerHeight;
  sctx2.setTransform(Math.min(window.devicePixelRatio||1,2),0,0,Math.min(window.devicePixelRatio||1,2),0,0);

  // kick off greeting after the field has filled in
  if (t >= FORM_DONE && !greetingStarted) {
    greetingStarted = true;
    typeGreeting();
  }

  // overall fade-in of the field, plus reveal "wave" so currents build over ~3s
  const fieldReveal = Math.min(1, t/2.6);

  // trail fade: draw a translucent black rect each frame so old positions decay
  sctx2.globalCompositeOperation = 'source-over';
  sctx2.fillStyle = `rgba(2,5,4,${0.10 + swarmFlare*0.25})`;
  sctx2.fillRect(0,0,w,h);

  // field time evolution
  const ft = t * FIELD_SPEED;

  sctx2.globalCompositeOperation = 'lighter';
  for (const p of flowParticles) {
    p.life++;
    // respawn dead/out-of-bounds particles
    if (p.life > p.maxLife || p.x < -20 || p.x > w+20 || p.y < -20 || p.y > h+20) {
      Object.assign(p, spawnFlow(w, h, false));
    }
    const ang = flowAngle(p.x, p.y, ft);
    p.px = p.x; p.py = p.y;
    let sp = p.speed * (1 + swarmFlare*3);   // flow speeds up on wake/burst
    p.x += Math.cos(ang)*sp;
    p.y += Math.sin(ang)*sp;

    // fade in/out over the particle's life (soft ends)
    const lifeFade = Math.sin(Math.min(1, p.life/p.maxLife) * Math.PI);
    // only draw particles within the revealed region (radial wipe from center-ish)
    const revealHere = fieldReveal; // simple global reveal reads cleaner full-bleed
    const baseA = (p.lead ? 0.55 : 0.16) * lifeFade * revealHere;
    if (baseA <= 0.004) continue;

    sctx2.beginPath();
    sctx2.moveTo(p.px, p.py);
    sctx2.lineTo(p.x, p.y);
    sctx2.strokeStyle = p.lead
      ? `rgba(180,255,220,${baseA})`
      : `rgba(0,255,156,${baseA})`;
    sctx2.lineWidth = p.lead ? 1.5 : 1;
    sctx2.stroke();

    // lead particles get a tiny glow head
    if (p.lead) {
      sctx2.beginPath();
      sctx2.arc(p.x, p.y, 1.6, 0, Math.PI*2);
      sctx2.fillStyle = `rgba(220,255,240,${baseA})`;
      sctx2.fill();
    }
  }
  sctx2.globalCompositeOperation = 'source-over';

  swarmRAF = requestAnimationFrame(swarmLoop);
}

/* ─── WAKE: flare the core, swell sound, hand off to boot ─── */
function wake() {
  if (woke) return;
  woke = true;

  // start audio (this IS the user gesture)
  initAudio();
  if (actx.state === 'suspended') actx.resume();
  if (HAS_TONE) { try { Tone.start(); Tone.getContext().resume(); } catch(e){} }
  soundOn = true; audioStarted = true;

  // ENTER feedback: a whoosh (the flow surges) + a bright confirm ping
  whoosh(true);
  reward(false);

  // AI RESPONDS — replace greeting with a short reply, orb starts brightening
  const gt = document.getElementById('greeting-text');
  const gc = document.getElementById('gcursor');
  const prompt = document.getElementById('wake-prompt');
  const sub = document.getElementById('wake-sub');
  if (prompt) prompt.style.opacity = '0';
  if (sub) sub.style.opacity = '0';
  const replies = ['Welcome.', 'Let\u2019s begin.', 'Initializing.'];
  const reply = replies[Math.floor(Math.random()*replies.length)];
  if (gt) {
    gt.innerHTML = '';
    if (gc) gc.style.display = 'inline';
    let i=0;
    (function typeReply(){
      if (i<=reply.length){ gt.innerHTML = reply.slice(0,i).replace(/ /g,'&nbsp;'); i++; T(typeReply, 55); }
    })();
  }
  const status = document.getElementById('wake-status');
  if (status) { status.textContent = '\u25CF WAKING'; status.style.color = 'var(--term-green)'; status.style.animation='none'; }

  // gentle pre-stir of the swarm (it tightens/brightens)
  const preStart = performance.now();
  (function preGlow(now){
    const p = Math.min(1,(now-preStart)/650);
    swarmFlare = p*0.06; // subtle tighten
    if(p<1) requestAnimationFrame(preGlow);
  })(preStart);

  // after the reply lands, do the full burst
  T(proceedWake, 1050);
}

function proceedWake() {
  // power-up swell sound (rising)
  wakeSwell();

  // burst the swarm outward
  const flareStart = performance.now();
  function flareStep(now){
    const p = Math.min(1, (now-flareStart)/700);
    swarmFlare = 0.06 + Math.pow(p,1.4);  // accelerating burst
    if (p<1) requestAnimationFrame(flareStep);
  }
  requestAnimationFrame(flareStep);

  // fade out gate text quickly
  const wt = document.getElementById('wake-text');
  if (wt) { wt.style.transition='opacity 0.3s ease'; wt.style.opacity='0'; }

  // bright flash + dissolve gate, then boot
  T(()=>{
    const flash = document.getElementById('flash');
    flash.style.transition='opacity 120ms ease'; flash.style.opacity='0.85';
    bootHit();
    T(()=>{ flash.style.transition='opacity 500ms ease'; flash.style.opacity='0'; }, 120);

    // dissolve gate
    const gate = document.getElementById('wake-gate');
    gate.style.opacity = '0';
    T(()=>{ gate.style.display='none'; cancelAnimationFrame(swarmRAF); }, 700);

    // music: start the journey
    musicBus.gain.cancelScheduledValues(actx.currentTime);
    musicBus.gain.setValueAtTime(0.0001, actx.currentTime);
    musicBus.gain.linearRampToValueAtTime(1, actx.currentTime + 0.5);

    // BOOT
    T(()=>{ runScript(0); musicPhaseA(); }, 350);
  }, 650);
}

// rising power-up swell (the "coming online" sound)
function wakeSwell() {
  if (!actx) return;
  const t = actx.currentTime;
  // sweeping filter up
  const o = actx.createOscillator(), o2 = actx.createOscillator(), g = actx.createGain();
  const filt = actx.createBiquadFilter(); filt.type='lowpass';
  filt.frequency.setValueAtTime(120, t); filt.frequency.exponentialRampToValueAtTime(4000, t+0.9);
  o.type='sawtooth'; o.frequency.setValueAtTime(55, t); o.frequency.exponentialRampToValueAtTime(220, t+0.9);
  o2.type='sine'; o2.frequency.setValueAtTime(110, t); o2.frequency.exponentialRampToValueAtTime(440, t+0.9);
  g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.12, t+0.6); g.gain.exponentialRampToValueAtTime(0.001, t+1.1);
  o.connect(filt); o2.connect(filt); filt.connect(g); g.connect(actx.destination);
  o.start(t); o2.start(t); o.stop(t+1.2); o2.stop(t+1.2);
  // shimmer ping at the top
  T(()=>beep(880,0.3,0.05), 600);
  T(()=>beep(1320,0.4,0.04), 720);
}

/* ─── toggle compatibility ─── */
const _origToggle = toggleSound;
toggleSound = function() {
  audioStarted = true;
  _origToggle();
};

/* ─── event listener wiring (replaces inline onclick attrs) ─── */
document.getElementById('sound').addEventListener('click', toggleSound);
document.getElementById('enter').addEventListener('click', enterClick);
document.getElementById('skip').addEventListener('click', skipBoot);
document.getElementById('replay').addEventListener('click', () => {
  sessionStorage.setItem('moonai_intro_replay', '1');
  location.reload();
});
