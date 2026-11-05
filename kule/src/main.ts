// Step 1 debug harness: keys 1-5 pick a tower, click a pad to build, click a tower to upgrade (3 → first branch), Space = next wave, S = speed.
import { Sim } from './sim/sim';
import { TOWER_KINDS, DT, TOWERS } from './sim/config';
import { TEST } from './sim/levels/test';
import { drawDebug } from './render/debug';
const cv = document.getElementById('c') as HTMLCanvasElement, c = cv.getContext('2d')!;
let sim = new Sim(TEST, { seed: 1 }), kind = 0, speed = 1, acc = 0, last = performance.now();
(window as any).__kule = { get sim() { return sim; }, reset: (seed = 1) => { sim = new Sim(TEST, { seed }); } };
addEventListener('keydown', e => { const n = +e.key; if (n >= 1 && n <= 5) kind = n - 1; if (e.code === 'Space') sim.callWave(); if (e.code === 'KeyS') speed = speed === 1 ? 2 : 1; });
cv.addEventListener('pointerdown', e => {
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 16, y = (e.clientY - r.top) / r.height * 9;
  const i = sim.L.map.pads.findIndex(([px, py]) => Math.hypot(px - x, py - y) < 0.5); if (i < 0) return;
  const t = sim.pads[i]; if (!t) sim.build(i, TOWER_KINDS[kind]); else if (t.level < 3) sim.upgrade(t); else if (t.level === 3) sim.branch(t, TOWERS[t.kind].branches[0]);
});
function frame(now: number) {
  requestAnimationFrame(frame); acc += Math.min(0.25, (now - last) / 1000) * speed; last = now;
  while (acc >= DT) { sim.step(); acc -= DT; } sim.drainEvents();
  drawDebug(c, sim, -1);
}
requestAnimationFrame(frame);
