/** debug: play one level with one bot and print what happens per wave. Usage: npm run trace -- <level> <bot> */
import { Sim } from '../src/sim/sim';
import { LEVELS } from '../src/sim/levels/data';
import { NO_PERKS, TowerKind } from '../src/sim/config';
import { naiveBot, greedyBot, smartBot, lookaheadBot } from './bots';
const lvl = +(process.argv[2] ?? 1), name = process.argv[3] ?? 'smart';
const bot = name === 'naive' ? naiveBot(1) : name === 'greedy' ? greedyBot(1) : name === 'smart' ? lookaheadBot() : smartBot(name.slice(5) as TowerKind);
const L = LEVELS[lvl - 1], s = new Sim(L, { seed: 1, perks: NO_PERKS, events: true });
let w = 0, lives = s.lives;
while (s.state === 'run' && s.tick < 30 * 2400) {
  if (s.tick % 15 === 0) bot.decide(s);
  s.step();
  for (const e of s.drainEvents()) if (e.t === 'build' || e.t === 'upgrade') console.log(`  t=${s.time.toFixed(0)} ${e.t} ${e.tower.kind} L${e.tower.level}${e.tower.branch ? ' ' + e.tower.branch : ''} pad ${e.tower.pad} gold left ${Math.floor(s.gold)}`);
  if (s.wave !== w) { console.log(`wave ${s.wave}: ${L.waves[s.wave - 1].groups.map(g => `${g.n}x${g.e}`).join(' ')}  (lives before ${s.lives}, lost last wave ${lives - s.lives})`); lives = s.lives; w = s.wave; }
}
console.log(`end: ${s.state} lives ${s.lives} gold ${Math.floor(s.gold)} kills ${s.stats.kills}`);
