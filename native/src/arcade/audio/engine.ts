/**
 * Som do NEON STEP DX (camada opt-in, desligada por padrão): efeitos e uma trilha por parte do jogo.
 * Tudo em try/catch: falha de áudio nunca pode derrubar nem travar o jogo. Toca MISTURADO com o resto do aparelho
 * (sem pedir foco de áudio), então a música do usuário no Media3 não é interrompida pelos efeitos.
 */
import {createAudioPlayer, setAudioModeAsync, type AudioPlayer} from 'expo-audio';
import {MUSIC, SFX, SFX_META} from './assets';
import {GAPS, Limiter, type Cue} from './plan.ts';

const SFX_MASTER = 0.9;
const MUSIC_MASTER = 0.5;
const FADE_MS = 1100;
const MAX_SFX_PLAYERS = 28;
/** Efeitos frequentes: o player já nasce pronto, para o primeiro toque não atrasar. */
const HOT = ['land_normal', 'land_spring', 'land_moving', 'tape1', 'tape2', 'tape3', 'shoot', 'enemy_shoot', 'hit', 'kill', 'shield_block', 'star', 'ui_click'];

type Mus = {id: string; p: AudioPlayer; vol: number};

export class ArcadeAudio {
  private sfxOn = false;
  private musicOn = false;
  private sfxPool = new Map<string, AudioPlayer>();
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
    if (sfx && !this.sfxOn) { void this.mode(); this.warm(); }
    if (!sfx) this.releaseSfx();
    this.sfxOn = sfx;
    if (music && !this.musicOn) void this.mode();
    this.musicOn = music;
    if (!music) this.stopMusic(true);
    else this.applyMusic();
  }

  private warm() {
    for (const id of HOT) this.sfxPlayer(id);
  }

  private sfxPlayer(id: string): AudioPlayer | null {
    const have = this.sfxPool.get(id);
    if (have) return have;
    const src = (SFX as Record<string, number>)[id];
    if (src === undefined) return null;
    try {
      if (this.sfxPool.size >= MAX_SFX_PLAYERS) {
        const old = [...this.sfxPool.keys()].find((k) => !HOT.includes(k));
        if (old) { try { this.sfxPool.get(old)?.remove(); } catch { /* já solto */ } this.sfxPool.delete(old); }
      }
      const p = createAudioPlayer(src);
      this.sfxPool.set(id, p);
      return p;
    } catch { return null; }
  }

  /** Toca os sons de um grupo de eventos (já filtrados por taxa). */
  play(cues: Cue[]) {
    if (!this.sfxOn || this.paused || !cues.length) return;
    const now = Date.now();
    for (const c of this.limiter.filter(cues, now)) {
      const p = this.sfxPlayer(c.id);
      if (!p) continue;
      try {
        const lvl = (SFX_META as Record<string, {level: number}>)[c.id]?.level ?? 0.85;
        p.volume = Math.max(0, Math.min(1, SFX_MASTER * this.vol * c.gain * Math.min(1, lvl + 0.15)));
        void p.seekTo(0).catch(() => {});
        p.play();
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

  private resumeOne(m: Mus) { try { m.p.play(); } catch { /* ok */ } }

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
    for (const p of this.sfxPool.values()) { try { p.pause(); } catch { /* ok */ } }
  }

  resume() {
    this.paused = false;
    this.limiter.reset();
    if (this.cur) this.resumeOne(this.cur); else this.applyMusic();
  }

  private releaseSfx() {
    for (const p of this.sfxPool.values()) { try { p.pause(); p.remove(); } catch { /* ok */ } }
    this.sfxPool.clear();
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
