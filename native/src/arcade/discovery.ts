/**
 * Diário de descobertas do NEON STEP DX: o jogo tem muita coisa escondida e o jogador a encontra aos poucos, em várias
 * partidas. O que já foi visto fica salvo (`found` no `arcade.v1`) e aparece no Diário; o resto é "???". Puro: sem React.
 * Os ids batem com os tipos do motor (mundo, portal, inimigo, poder, chão) mais alguns feitos.
 */
import type {Sim, SimEvent} from './core/types.ts';

export type DiscoveryGroup = 'mundo' | 'portal' | 'inimigo' | 'poder' | 'chao' | 'feito';

export type Discovery = {id: string; group: DiscoveryGroup; name: string; hint: string};

export const GROUPS: {id: DiscoveryGroup; title: string}[] = [
  {id: 'mundo', title: 'MUNDOS'},
  {id: 'portal', title: 'PORTAIS'},
  {id: 'inimigo', title: 'INIMIGOS'},
  {id: 'poder', title: 'PODERES'},
  {id: 'chao', title: 'CHÃO'},
  {id: 'feito', title: 'FEITOS'},
];

const d = (id: string, group: DiscoveryGroup, name: string, hint: string): Discovery => ({id, group, name, hint});

export const CATALOG: readonly Discovery[] = [
  d('world:neon', 'mundo', 'Cidade Neon', 'Onde tudo começa.'),
  d('world:crystal', 'mundo', 'Cristal', 'Existe um lugar de vidro lá no alto.'),
  d('world:clock', 'mundo', 'Relógio', 'Engrenagens giram atrás das nuvens.'),
  d('world:cosmos', 'mundo', 'Cosmos', 'Mais alto que as luzes da cidade.'),
  d('world:ocean', 'mundo', 'Oceano', 'Uma correnteza leva quem sobe.'),
  d('world:volcano', 'mundo', 'Vulcão', 'Algo quente sobe atrás de você.'),
  d('world:paper', 'mundo', 'Papel', 'Um mundo dobrado ao meio.'),
  d('world:sketch', 'mundo', 'Rascunho', 'Traços de giz, de cabeça para baixo.'),
  d('world:inverse', 'mundo', 'Queda livre', 'Dá para descer em vez de subir.'),

  d('portal:world', 'portal', 'Portal de mundo', 'Atravesse um portal brilhante.'),
  d('portal:paper', 'portal', 'Portal do Papel', 'Um portal que dobra tudo.'),
  d('portal:bonus', 'portal', 'Portal bônus', 'Chove fita para quem entra.'),
  d('portal:warp', 'portal', 'Atalho', 'Alguns portais sobem voando.'),
  d('portal:back', 'portal', 'Volta', 'Todo desvio tem uma saída.'),
  d('portal:time', 'portal', 'Portal do tempo', 'O tempo anda devagar lá dentro.'),
  d('portal:leap', 'portal', 'Salto de mundo', 'Pule um mundo inteiro.'),
  d('portal:flip', 'portal', 'Portal da queda', 'Um portal que vira o mundo.'),
  d('portal:sketch', 'portal', 'Portal do rascunho', 'Um portal desenhado a giz.'),
  d('portal:tele', 'portal', 'Sala do portal', 'Um botão, uma porta, um segredo.'),

  d('enemy:drone', 'inimigo', 'Drone', 'Zumbe de um lado para o outro.'),
  d('enemy:zigzag', 'inimigo', 'Zigue-zague', 'Nunca anda reto.'),
  d('enemy:turret', 'inimigo', 'Torre', 'Fica parada e atira.'),
  d('enemy:orb', 'inimigo', 'Orbe', 'Gira em volta de si.'),
  d('enemy:guardian', 'inimigo', 'Guardião', 'Aguenta mais de um tiro.'),
  d('enemy:ufo', 'inimigo', 'Disco voador', 'Aparece lá no espaço.'),
  d('enemy:meteor', 'inimigo', 'Meteoro', 'Cai e volta.'),
  d('enemy:blackhole', 'inimigo', 'Buraco negro', 'Puxa quem chega perto.'),
  d('enemy:clip', 'inimigo', 'Clipe', 'Mora no papel.'),
  d('enemy:jelly', 'inimigo', 'Água-viva', 'Flutua no fundo.'),
  d('enemy:ember', 'inimigo', 'Brasa', 'Salta da lava.'),

  d('power:shield', 'poder', 'Escudo', 'Algo que protege.'),
  d('power:boost', 'poder', 'Sapatos de mola', 'Pulos mais altos por um tempo.'),
  d('power:jet', 'poder', 'Hélice', 'Dá para voar.'),
  d('power:heart', 'poder', 'Coração', 'Mais uma chance.'),
  d('power:flag', 'poder', 'Bandeira', 'Um ponto para recomeçar.'),
  d('power:magnet', 'poder', 'Ímã', 'As fitas vêm até você.'),
  d('power:star', 'poder', 'Estrela', 'Vale pontos de verdade.'),

  d('floor:moving', 'chao', 'Plataforma móvel', 'Nem todo chão fica parado.'),
  d('floor:fragile', 'chao', 'Plataforma frágil', 'Algumas somem depois do pouso.'),
  d('floor:spring', 'chao', 'Mola', 'Lança bem alto.'),
  d('floor:conveyor', 'chao', 'Esteira', 'Empurra para um lado.'),
  d('floor:ghost', 'chao', 'Plataforma fantasma', 'Aparece e some.'),
  d('floor:switch', 'chao', 'Botão', 'Pise para abrir.'),

  d('feat:combo5', 'feito', 'Combo x5', 'Pegue fitas sem parar.'),
  d('feat:stomp', 'feito', 'Pisão', 'Dá para vencer por cima.'),
  d('feat:shot', 'feito', 'Primeiro abate', 'Atire em algo.'),
  d('feat:revive', 'feito', 'Segunda chance', 'Volte de uma queda.'),
  d('feat:m500', 'feito', '500 m', 'Suba bem alto.'),
  d('feat:m1000', 'feito', '1000 m', 'Mais alto ainda.'),
  d('feat:m2500', 'feito', '2500 m', 'Quase no limite.'),
  d('feat:both', 'feito', 'A dupla', 'Jogue com os dois personagens.'),
];

export const TOTAL = CATALOG.length;
const IDS = new Set(CATALOG.map((c) => c.id));
export const isDiscovery = (id: string) => IDS.has(id);

const MILESTONES: [number, string][] = [[500, 'feat:m500'], [1000, 'feat:m1000'], [2500, 'feat:m2500']];

/** Descobertas que um evento da simulação revela. */
export function fromEvent(e: SimEvent): string[] {
  switch (e.t) {
    case 'land': return e.plat === 'normal' || e.plat === 'start' ? [] : [`floor:${e.plat}`];
    case 'collect': return e.combo >= 5 ? ['feat:combo5'] : [];
    case 'pickup': return e.kind === 'tape' || e.kind === 'portal' || e.kind === 'gate' ? [] : [`power:${e.kind}`];
    case 'kill': return [`enemy:${e.kind}`, e.by === 'stomp' ? 'feat:stomp' : 'feat:shot'];
    case 'portal': return [`portal:${e.variant === 'exit' ? 'tele' : e.variant}`];
    case 'revive': return ['feat:revive'];
    default: return [];
  }
}

/** Descobertas pelo estado: mundo atual, inimigos à vista e marcos de altitude (chamar de vez em quando, não todo quadro). */
export function fromState(sim: Sim, meters: number): string[] {
  const out = [`world:${sim.world}`];
  const lo = sim.player.y - sim.viewH, hi = sim.player.y + sim.viewH;
  for (const en of sim.enemies) if (en.alive && en.y > lo && en.y < hi) out.push(`enemy:${en.kind}`);
  for (const [m, id] of MILESTONES) if (meters >= m) out.push(id);
  return out;
}

/** Só o que é novo para o jogador, sem repetir e só ids do catálogo. */
export function fresh(found: Record<string, number>, ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) if (IDS.has(id) && found[id] === undefined && !out.includes(id)) out.push(id);
  return out;
}

export const countFound = (found: Record<string, number>) => CATALOG.reduce((n, c) => n + (found[c.id] !== undefined ? 1 : 0), 0);

export const nameOf = (id: string) => CATALOG.find((c) => c.id === id)?.name ?? id;
