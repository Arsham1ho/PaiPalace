// Lightweight synthesized poker sound effects via the Web Audio API.
// No audio assets — everything is generated. Respects a persisted mute toggle.

let ctx: AudioContext | null = null;
let muted = typeof localStorage !== "undefined" && localStorage.getItem("pp_muted") === "1";

function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem("pp_muted", m ? "1" : "0"); } catch {}
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.2, when = 0) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g); g.connect(c.destination);
  const t = c.currentTime + when;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
}

// short noisy "chip" click
function chip(when = 0) {
  const c = ac();
  const buf = c.createBuffer(1, c.sampleRate * 0.06, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = c.createBufferSource(); src.buffer = buf;
  const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2500;
  const g = c.createGain(); g.gain.value = 0.18;
  src.connect(hp); hp.connect(g); g.connect(c.destination);
  src.start(c.currentTime + when);
}

export type Sfx = "deal" | "check" | "call" | "bet" | "raise" | "allin" | "fold" | "win" | "click";

export function play(kind: Sfx) {
  if (muted) return;
  try {
    switch (kind) {
      case "deal": tone(620, 0.05, "triangle", 0.1); tone(520, 0.05, "triangle", 0.09, 0.06); break;
      case "check": tone(160, 0.09, "sine", 0.22); break;        // table knock
      case "call": chip(); break;
      case "bet": case "raise": chip(); chip(0.07); break;        // chips in
      case "allin": tone(880, 0.14, "square", 0.12); tone(1175, 0.22, "square", 0.12, 0.13); chip(0.02); break;
      case "fold": tone(300, 0.14, "sawtooth", 0.07); break;
      case "win": [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, "triangle", 0.16, i * 0.09)); break;
      case "click": tone(440, 0.04, "sine", 0.12); break;
    }
  } catch {}
}
