/**
 * Som do NEON STEP DX (camada opt-in, desligada por padrão): efeitos e uma trilha por parte do jogo.
 * Tudo em try/catch: falha de áudio nunca pode derrubar nem travar o jogo. Toca MISTURADO com o resto do aparelho
 * (sem pedir foco de áudio), então a música do usuário no Media3 não é interrompida pelos efeitos.
 */
import {createAudioPlayer, setAudioModeAsync, type AudioPlayer} from 'expo-audio';
import {MUSIC, SFX_ATLAS, SFX_CLIPS} from './assets';
import {GAPS, Limiter, type Cue} from './plan.ts';

const SFX_MASTER = 0.9;
const MUSIC_MASTER = 0.5;
const FADE_MS = 1100;
/** Efeitos: UM arquivo (atlas) tocado por poucas "vozes" (players), cada uma pulando para o começo do trecho. Dezenas de players travavam o aparelho. */
const MAX_VOICES = 3;
const LOW = /^(land_|tape\d|shoot|enemy_shoot|enemy_warn|ui_)/;

type Mus = {id: string; p: AudioPlayer; vol: number};
type Voice = {p: AudioPlayer; until: number; pri: number; timer: ReturnType<typeof setTimeout> | null};

export class ArcadeAudio {
  private sfxOn = false;
  private musicOn = false;
  private voices: Voice[] = [];
  private cur: Mus | null = null;
  private fading: Mus[] = [];
  private wanted: string | null = null;
  private paused = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private limiter = new Limiter(GAPS);
  private modeSet = false;
  private vol = 1;

  private async mode() {
    if (this.modeSet) return;
    this.modeSet = true;
    try { await setAudioModeAsync({playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers'}); } catch { /* sem modo: toca como der */ }
  }

  /** 1 baixo · 2 médio · 3 alto. */
  setVolume(level: number) {
    this.vol = level <= 1 ? 0.5 : level >= 3 ? 1 : 0.75;
    for (const m of [this.cur, ...this.fading]) { if (m) { try { m.p.volume = m.vol * MUSIC_MASTER * this.vol; } catch { /* ok */ } } }
  }

  configure(sfx: boolean, music: boolean) {
    if (sfx && !this.sfxOn) void this.mode();
    if (!sfx) this.releaseSfx();
    this.sfxOn = sfx;
    if (music && !this.musicOn) void this.mode();
    this.musicOn = music;
    if (!music) this.stopMusic(true);
    else this.applyMusic();
  }

  /** Voz livre (ou nova, até o limite); se todas estão ocupadas, só um efeito importante rouba a mais antiga. */
  private pickVoice(pri: number, now: number): Voice | null {
    const idle = this.voices.find((v) => v.until <= now);
    if (idle) return idle;
    if (this.voices.length < MAX_VOICES) {
      try {
        const v: Voice = {p: createAudioPlayer(SFX_ATLAS), until: 0, pri: 0, timer: null};
        this.voices.push(v);
        return v;
      } catch { return null; }
    }
    if (pri < 2) return null;
    return this.voices.filter((v) => v.pri < 2).sort((x, y) => x.until - y.until)[0] ?? null;
  }

  /** Toca os sons de um grupo de eventos (já filtrados por taxa). */
  play(cues: Cue[]) {
    if (!this.sfxOn || this.paused || !cues.length) return;
    const now = Date.now();
    for (const c of this.limiter.filter(cues, now)) {
      const clip = SFX_CLIPS[c.id];
      if (!clip) continue;
      const pri = LOW.test(c.id) ? 1 : 2;
      const v = this.pickVoice(pri, now);
      if (!v) continue;
      try {
        if (v.timer) clearTimeout(v.timer);
        v.pri = pri;
        v.until = now + clip.dur * 1000 + 30;
        v.p.volume = Math.max(0, Math.min(1, SFX_MASTER * this.vol * c.gain * Math.min(1, clip.level + 0.15)));
        void v.p.seekTo(clip.start).catch(() => {});
        v.p.play();
        const p = v.p;
        v.timer = setTimeout(() => { try { p.pause(); } catch { /* ok */ } }, clip.dur * 1000 + 20);
      } catch { /* som perdido: sem problema */ }
    }
  }

  /** Efeito avulso da interface (clique, pausa...). */
  ui(id: string) { this.play([{id, gain: 0.8}]); }

  /** Pede a trilha de uma parte do jogo (`null` = silêncio). Troca com fade cruzado. */
  setMusic(id: string | null) {
    this.wanted = id;
    this.applyMusic();
  }

  private applyMusic() {
    if (!this.musicOn || this.paused) return;
    const id = this.wanted;
    if (this.cur?.id === id) { this.cur && this.resumeOne(this.cur); return; }
    if (this.cur) { this.fading.push(this.cur); this.cur = null; }
    if (id) {
      const src = (MUSIC as Record<string, number>)[id];
      if (src !== undefined) {
        try {
          const p = createAudioPlayer(src);
          p.loop = true;
          p.volume = 0;
          p.play();
          this.cur = {id, p, vol: 0};
        } catch { this.cur = null; }
      }
    }
    this.tick();
  }

  private resumeOne(m: Mus) { try { if (!m.p.playing) m.p.play(); } catch { /* ok */ } }

  private tick() {
    if (this.timer) return;
    const dt = 50;
    this.timer = setInterval(() => {
      const step = dt / FADE_MS;
      if (this.cur && this.cur.vol < 1) {
        this.cur.vol = Math.min(1, this.cur.vol + step);
        try { this.cur.p.volume = this.cur.vol * MUSIC_MASTER * this.vol; } catch { /* ok */ }
      }
      this.fading = this.fading.filter((m) => {
        m.vol = Math.max(0, m.vol - step * 1.4);
        try { m.p.volume = m.vol * MUSIC_MASTER * this.vol; } catch { /* ok */ }
        if (m.vol <= 0) { try { m.p.pause(); m.p.remove(); } catch { /* ok */ } return false; }
        return true;
      });
      if ((!this.cur || this.cur.vol >= 1) && !this.fading.length) { clearInterval(this.timer!); this.timer = null; }
    }, dt);
  }

  private stopMusic(now: boolean) {
    if (this.cur) { this.fading.push(this.cur); this.cur = null; }
    if (now) {
      for (const m of this.fading) { try { m.p.pause(); m.p.remove(); } catch { /* ok */ } }
      this.fading = [];
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    } else this.tick();
  }

  /** Pausa do jogo / app em segundo plano: tudo cala. */
  pause() {
    this.paused = true;
    for (const m of [this.cur, ...this.fading]) { try { m?.p.pause(); } catch { /* ok */ } }
    for (const v of this.voices) { if (v.timer) clearTimeout(v.timer); v.until = 0; try { v.p.pause(); } catch { /* ok */ } }
  }

  resume() {
    this.paused = false;
    this.limiter.reset();
    if (this.cur) this.resumeOne(this.cur); else this.applyMusic();
  }

  private releaseSfx() {
    for (const v of this.voices) { if (v.timer) clearTimeout(v.timer); try { v.p.pause(); v.p.remove(); } catch { /* ok */ } }
    this.voices = [];
  }

  dispose() {
    this.stopMusic(true);
    this.releaseSfx();
    this.sfxOn = false;
    this.musicOn = false;
    // devolve o modo que o player de músicas do app usa
    if (this.modeSet) setAudioModeAsync({playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix'}).catch(() => {});
    this.modeSet = false;
  }
}
