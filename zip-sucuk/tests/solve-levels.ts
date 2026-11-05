// Headless solvability check: a beam-search bot replays jump sequences (deterministic physics) and must reach the bun on every level.
// Run: npm run test:levels   (only some ids: LV=7,8 npm run test:levels)
import { Sim } from '../src/game/world';
import { LEVELS } from '../src/game/levels';
type Act = { lean: number; hold: number };
const LEANS = [-0.6, -0.25, 0.25, 0.6], HOLDS = [0.08, 0.22, 0.38, 0.55, 0.75];
// run a sequence of actions; returns the sim after it settled
function play(li: number, acts: Act[]) {
  const s = new Sim(LEVELS[li]);
  const wait = (n: number) => { for (let i = 0; i < n && !s.stuck && s.state === 'play'; i++) s.update(1 / 60, false); };
  wait(60);
  for (const a of acts) {
    if (!s.stuck || s.state !== 'play') break;
    let g = 0; while (g++ < 300 && !(s.stuck && Math.abs(s.swayLean - a.lean) < 0.08)) s.update(1 / 60, false);
    for (let t = 0; t < a.hold; t += 1 / 60) s.update(1 / 60, true);
    s.update(1 / 60, false);
    let air = 0; while (!s.stuck && s.state === 'play' && air < 5) { s.update(1 / 60, false); air += 1 / 60; }
    for (let i = 0; i < 20; i++) s.update(1 / 60, false);
  }
  return s;
}
const score = (s: Sim, falls0: number) => { const f = s.L.finish, c = s.center; return s.state === 'win' ? 1e6 : -Math.hypot(f[0] - c.x, (f[1] - c.y) * 1.6) - (s.falls - falls0) * 50; };
const only = (process.env.LV || '').split(',').filter(Boolean).map(Number);
for (let li = 0; li < LEVELS.length; li++) {
  if (only.length && !only.includes(LEVELS[li].id)) continue;
  // beam search: keep the 4 best action sequences each step
  let beam: { acts: Act[]; s: Sim; sc: number }[] = [{ acts: [], s: play(li, []), sc: -1e9 }];
  for (let step = 0; step < 16 && !beam.some(b => b.s.state === 'win'); step++) {
    const next: typeof beam = [];
    for (const b of beam) for (const lean of LEANS) for (const hold of HOLDS) { const acts = [...b.acts, { lean, hold }], t = play(li, acts); next.push({ acts, s: t, sc: score(t, 0) - acts.length * 0.3 }); }
    next.sort((x, y) => y.sc - x.sc); beam = next.slice(0, 4);
  }
  const s = beam[0].s;
  const c = s.center;
  console.log(`level ${li + 1} (id ${LEVELS[li].id}): ${s.state === 'win' ? 'SOLVED' : 'not solved'} in ${s.jumps} jumps (par ${s.L.par}), falls ${s.falls}, coins ${s.coinsRun}/${s.L.coins.length}, end at (${c.x.toFixed(1)}, ${c.y.toFixed(1)}) finish (${s.L.finish})`);
}
