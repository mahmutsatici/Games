import { Sim } from '../src/sim/sim';
import { LEVELS } from '../src/sim/levels/data';
import { ALL_PERKS } from '../src/sim/config';
import { greedyBot } from './bots';
const s = new Sim(LEVELS[0], { seed: 1, perks: ALL_PERKS(), events: true }), bot = greedyBot(1);
while (s.state === 'run' && s.tick < 30 * 600) { if (s.tick % 15 === 0) bot.decide(s); s.step(); for (const e of s.drainEvents()) if (e.t === 'build' || e.t === 'upgrade' || e.t === 'leak') console.log(s.time.toFixed(0), e.t, 'tower' in e ? e.tower.kind + e.tower.level : e.e.kind, Math.floor(s.gold)); if (s.tick > 30 * 60) break; }
console.log(s.state, s.lives, s.towers.length, Math.floor(s.gold));
