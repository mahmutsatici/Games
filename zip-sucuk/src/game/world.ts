import * as planck from 'planck';
import { CFG } from '../config';
import { LevelDef, Plat, Kind } from './levels';
import { sfx, charge as chargeTone } from './audio';

const Vec2 = planck.Vec2;
const STICKY: Kind[] = ['counter', 'board', 'shelf', 'cabinet'];
const HAZARD: Kind[] = ['grill', 'knife'];

export interface Ud { k: 'seg' | 'plat' | 'goal' | 'flag'; i?: number; kind?: Kind; px: number; py: number; pa: number; }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; type: 'dust' | 'spark' | 'coin' | 'steam' | 'star'; size: number; }
interface Stuck { body: planck.Body; joint: planck.RevoluteJoint; base: number; normalAng: number; phase: number; blend: number; startLean: number; }
interface PendingStick { body: planck.Body; seg: number; point: planck.Vec2; normal: planck.Vec2; }

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** One run of one level. Pure simulation: no DOM, so it can be driven headless in tests. */
export class Sim {
  world: planck.World;
  segs: planck.Body[] = [];
  plats: { body: planck.Body; def: Plat; base: planck.Vec2 }[] = [];
  flags: { x: number; y: number; taken: boolean }[] = [];
  coins: { x: number; y: number; taken: boolean }[] = [];
  stuck: Stuck | null = null;
  state: 'play' | 'win' = 'play';
  t = 0; acc = 0; jumps = 0; falls = 0; coinsRun = 0;
  charging = false; charge = 0; swayLean = 0;
  checkpoint: [number, number];
  particles: Particle[] = [];
  shake = 0; burnT = 0; winT = 0; landSquash = 0;
  private launchT = -9; private restT = 0; private pending: PendingStick | null = null;
  private wantCharge = false; private respawnQ = false; private winQ = false;
  private touching = new Map<planck.Body, number>(); // segment -> number of sticky/neutral contacts

  constructor(public L: LevelDef) {
    this.world = new planck.World({ gravity: new Vec2(0, -CFG.physics.gravity) });
    this.checkpoint = L.spawn;
    for (const p of L.plats) this.addPlat(p);
    // goal bun (sensor) and flags (sensors)
    const g = this.world.createBody({ type: 'static', position: new Vec2(L.finish[0], L.finish[1] + 0.6) });
    g.setUserData({ k: 'goal', px: 0, py: 0, pa: 0 } as Ud); g.createFixture({ shape: new planck.Box(0.95, 0.6), isSensor: true });
    for (const f of L.flags) {
      this.flags.push({ x: f[0], y: f[1], taken: false });
      const b = this.world.createBody({ type: 'static', position: new Vec2(f[0], f[1] + 0.8) });
      b.setUserData({ k: 'flag', i: this.flags.length - 1, px: 0, py: 0, pa: 0 } as Ud); b.createFixture({ shape: new planck.Box(0.35, 0.8), isSensor: true });
    }
    this.coins = L.coins.map(([x, y]) => ({ x, y, taken: false }));
    this.spawn(L.spawn[0], L.spawn[1]);
    this.world.on('begin-contact', c => this.contact(c, 1));
    this.world.on('end-contact', c => this.contact(c, -1));
  }

  // ---------- building ----------
  private addPlat(p: Plat) {
    const moving = !!p.move || !!p.spin;
    const b = this.world.createBody({ type: moving ? 'kinematic' : 'static', position: new Vec2(p.x, p.y), angle: p.a || 0 });
    b.setUserData({ k: 'plat', kind: p.kind, px: p.x, py: p.y, pa: p.a || 0 } as Ud);
    const s = p.kind === 'butter' ? CFG.surfaces.butter : p.kind === 'jelly' ? CFG.surfaces.jelly : HAZARD.includes(p.kind) ? CFG.surfaces.steel : CFG.surfaces.wood;
    b.createFixture({ shape: new planck.Box(p.w / 2, p.h / 2), friction: s.friction, restitution: s.restitution });
    if (p.spin) b.setAngularVelocity(p.spin);
    this.plats.push({ body: b, def: p, base: new Vec2(p.x, p.y) });
  }

  /** create the sausage standing upright on the surface below (x, y) */
  private spawn(x: number, y: number) {
    for (const s of this.segs) this.world.destroyBody(s);
    this.segs = []; this.stuck = null; this.touching.clear();
    const C = CFG.sausage;
    let ground: planck.Body | null = null, gy = y;
    this.world.rayCast(new Vec2(x, y + 0.6), new Vec2(x, y - 1.5), (f, pt, _n, frac) => { const u = f.getBody().getUserData() as Ud; if (u?.k !== 'plat' || f.isSensor()) return -1; ground = f.getBody(); gy = pt.y; return frac; });
    for (let i = 0; i < C.segments; i++) {
      const b = this.world.createBody({ type: 'dynamic', position: new Vec2(x, gy + C.radius + i * C.spacing), allowSleep: false, angularDamping: 0.6, linearDamping: 0.05 });
      b.setUserData({ k: 'seg', i, px: x, py: gy + C.radius + i * C.spacing, pa: 0 } as Ud);
      b.createFixture({ shape: new planck.Circle(C.radius), density: C.density, friction: C.friction, restitution: C.restitution, filterGroupIndex: -1 });
      this.segs.push(b);
      if (i > 0) this.world.createJoint(new planck.WeldJoint({ frequencyHz: C.bendHz, dampingRatio: C.bendDamping }, this.segs[i - 1], b, new Vec2(x, gy + C.radius + (i - 0.5) * C.spacing)));
    }
    if (ground) this.stickTo(ground, 0, new Vec2(x, gy), new Vec2(0, 1));
  }

  // ---------- contacts ----------
  private contact(c: planck.Contact, d: number) {
    const fa = c.getFixtureA(), fb = c.getFixtureB(), ua = fa.getBody().getUserData() as Ud, ub = fb.getBody().getUserData() as Ud;
    if (!ua || !ub) return;
    const segFirst = ua.k === 'seg', seg = segFirst ? fa.getBody() : fb.getBody(), other = segFirst ? ub : ua, otherBody = segFirst ? fb.getBody() : fa.getBody();
    if ((segFirst ? ua : ub).k !== 'seg' || other.k === 'seg') return;
    if (d < 0) { if (other.k === 'plat') this.touching.set(seg, Math.max(0, (this.touching.get(seg) || 0) - 1)); return; }
    if (other.k === 'goal') { this.winQ = true; return; }
    if (other.k === 'flag') { const f = this.flags[other.i!]; if (!f.taken) { f.taken = true; this.checkpoint = [f.x, f.y]; sfx.checkpoint(); this.burst(f.x, f.y + 1.4, 'star', 12, 3); } return; }
    if (other.k !== 'plat') return;
    this.touching.set(seg, (this.touching.get(seg) || 0) + 1);
    const kind = other.kind!, si = (seg.getUserData() as Ud).i!;
    const v = seg.getLinearVelocity().length();
    if (HAZARD.includes(kind)) { if (!this.respawnQ) { this.respawnQ = true; this.burnT = 0.35; sfx.sizzle(); const p = seg.getPosition(); this.burst(p.x, p.y, 'steam', 14, 2); } return; }
    if (kind === 'jelly') { if (v > 2) sfx.bounce(); return; }
    if (kind === 'butter') { if (v > 2) sfx.slip(); return; }
    if (v > 3) { sfx.land(Math.min(1, v / 14)); const p = seg.getPosition(); this.burst(p.x, p.y - 0.1, 'dust', 5, 1.5); }
    // an END of the sausage landing on a sticky surface sticks there
    if (this.stuck || this.pending || this.t - this.launchT < CFG.stand.reStickGrace) return;
    if (si !== 0 && si !== this.segs.length - 1) return;
    const wm = c.getWorldManifold(null); if (!wm) return;
    const n = segFirst ? new Vec2(-wm.normal.x, -wm.normal.y) : new Vec2(wm.normal.x, wm.normal.y); // from surface to sausage
    const pt = wm.points[0] ? new Vec2(wm.points[0].x, wm.points[0].y) : seg.getPosition().clone().sub(n.clone().mul(CFG.sausage.radius));
    this.pending = { body: otherBody, seg: si, point: pt, normal: n };
  }

  private stickTo(body: planck.Body, seg: number, point: planck.Vec2, normal: planck.Vec2) {
    const joint = this.world.createJoint(new planck.RevoluteJoint({}, body, this.segs[seg], point)) as planck.RevoluteJoint;
    const normalAng = Math.atan2(normal.y, normal.x), lean = wrap(this.axisAngle(seg) - normalAng), A = CFG.stand.swayAmp;
    const inRange = Math.abs(lean) <= A;
    this.stuck = { body, joint, base: seg, normalAng, phase: inRange ? Math.asin(lean / A) : 0, blend: inRange ? 1 : 0, startLean: lean };
    // keep only a little of the impact speed so it plants instead of bouncing off
    for (const s of this.segs) { const v = s.getLinearVelocity(); s.setLinearVelocity(new Vec2(v.x * 0.35, v.y * 0.35)); }
    this.restT = 0;
  }

  // ---------- helpers ----------
  private axisAngle(base: number) {
    const n = this.segs.length, mid = base === 0 ? Math.min(n - 1, 3) : Math.max(0, n - 4), a = this.segs[base].getPosition(), b = this.segs[mid].getPosition();
    return Math.atan2(b.y - a.y, b.x - a.x);
  }
  get center() { let x = 0, y = 0; for (const s of this.segs) { const p = s.getPosition(); x += p.x; y += p.y; } return { x: x / this.segs.length, y: y / this.segs.length }; }
  get velocity() { let x = 0, y = 0; for (const s of this.segs) { const v = s.getLinearVelocity(); x += v.x; y += v.y; } return { x: x / this.segs.length, y: y / this.segs.length }; }
  get alpha() { return this.acc / CFG.physics.step; }
  get power() { return CFG.jump.minPower + (1 - CFG.jump.minPower) * this.charge; }
  /** launch velocity the sausage would get if released now */
  launchVector() {
    if (!this.stuck) return null;
    const a = this.axisAngle(this.stuck.base), sp = this.power * CFG.jump.maxSpeed, bv = this.stuck.body.getLinearVelocity();
    return { x: Math.cos(a) * sp + bv.x, y: Math.sin(a) * sp + bv.y, from: this.segs[this.stuck.base === 0 ? this.segs.length - 1 : 0].getPosition() };
  }
  burst(x: number, y: number, type: Particle['type'], n: number, sp: number) {
    for (let i = 0; i < n && this.particles.length < 160; i++) { const a = Math.random() * Math.PI * 2, s = sp * (0.3 + Math.random() * 0.7), life = 0.4 + Math.random() * 0.5;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + (type === 'steam' ? 1.5 : 0.5), life, max: life, type, size: 0.06 + Math.random() * 0.08 }); }
  }

  // ---------- update ----------
  /** down = the one button is held this frame */
  update(dtReal: number, down: boolean) {
    const dt = Math.min(dtReal, 0.1);
    this.acc += dt;
    let n = 0;
    while (this.acc >= CFG.physics.step && n < CFG.physics.maxStepsPerFrame) { this.snap(); this.step(CFG.physics.step, down); this.acc -= CFG.physics.step; n++; }
    if (this.acc >= CFG.physics.step) this.acc = CFG.physics.step * 0.99;
    this.shake = Math.max(0, this.shake - dt * 3); this.landSquash = Math.max(0, this.landSquash - dt * 4);
    for (let i = this.particles.length - 1; i >= 0; i--) { const p = this.particles[i]; p.life -= dt; if (p.life <= 0) { this.particles[i] = this.particles[this.particles.length - 1]; this.particles.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; if (p.type !== 'steam') p.vy -= 9 * dt; else p.vx *= 1 - dt; }
  }
  private snap() {
    for (const s of this.segs) { const u = s.getUserData() as Ud, p = s.getPosition(); u.px = p.x; u.py = p.y; u.pa = s.getAngle(); }
    for (const p of this.plats) { const u = p.body.getUserData() as Ud, q = p.body.getPosition(); u.px = q.x; u.py = q.y; u.pa = p.body.getAngle(); }
  }

  private step(dt: number, down: boolean) {
    this.t += dt;
    // moving platforms (kinematic: drive by velocity so contacts carry the sausage)
    for (const p of this.plats) if (p.def.move) { const m = p.def.move, w = Math.PI * 2 / m.period, ph = m.phase || 0, c = Math.cos(this.t * w + ph) * w; p.body.setLinearVelocity(new Vec2(m.dx * c, m.dy * c)); }
    if (this.state === 'win') { this.winT += dt; this.world.step(dt, 8, 3); return; }
    this.input(dt, down);
    this.stand(dt);
    this.world.step(dt, 8, 3);
    if (this.pending && !this.stuck) { const p = this.pending; this.stickTo(p.body, p.seg, p.point, p.normal); sfx.stick(); this.landSquash = 1; this.burst(p.point.x, p.point.y, 'dust', 6, 1.2); }
    this.pending = null;
    this.rest(dt);
    this.collect();
    if (this.burnT > 0) { this.burnT -= dt; if (this.burnT <= 0 && this.respawnQ) this.respawn(); }
    const c = this.center;
    if (c.y < this.L.killY) { sfx.splash(); this.respawn(); }
    if (this.winQ) { this.winQ = false; this.state = 'win'; chargeTone(0, false); sfx.win(); this.burst(this.L.finish[0], this.L.finish[1] + 1, 'star', 24, 5); }
  }

  private input(dt: number, down: boolean) {
    if (down && !this.charging) { if (this.stuck) { this.charging = true; this.charge = 0; } else this.wantCharge = true; }
    if (!down) this.wantCharge = false;
    if (this.charging) {
      if (!this.stuck) { this.charging = false; chargeTone(0, false); return; }
      this.charge = Math.min(1, this.charge + dt / CFG.jump.chargeTime);
      chargeTone(this.charge, true);
      if (!down) this.launch();
    } else if (this.wantCharge && this.stuck) { this.charging = true; this.charge = 0; this.wantCharge = false; }
  }

  private launch() {
    const st = this.stuck!, lv = this.launchVector()!, c = this.center, lean = wrap(this.axisAngle(st.base) - st.normalAng);
    this.world.destroyJoint(st.joint); this.stuck = null; this.charging = false; chargeTone(0, false);
    const spin = -Math.sign(lean || 1) * CFG.jump.spin * this.power;
    for (const s of this.segs) { const p = s.getPosition(); s.setLinearVelocity(new Vec2(lv.x - spin * (p.y - c.y), lv.y + spin * (p.x - c.x))); }
    this.launchT = this.t; this.jumps++; sfx.jump(this.power); this.charge = 0;
    this.burst(this.segs[st.base].getPosition().x, this.segs[st.base].getPosition().y, 'dust', 6, 2);
  }

  /** hold the standing sausage at its swaying target angle (PD control on the pinned base) */
  private stand(dt: number) {
    const st = this.stuck; if (!st) return;
    const S = CFG.stand;
    st.phase += dt * (Math.PI * 2 / S.swayPeriod) * (this.charging ? S.chargeSlow : 1);
    if (st.blend < 1) st.blend = Math.min(1, st.blend + dt / S.standUpTime);
    const sway = S.swayAmp * Math.sin(st.phase);
    const targetLean = st.startLean + (sway - st.startLean) * (st.blend * st.blend * (3 - 2 * st.blend));
    this.swayLean = targetLean;
    // every segment is pulled toward its place on the target line (stiff near the base, looser at the tip):
    // stable upright stance that still jiggles like jelly
    const n = this.segs.length, dir = st.normalAng + targetLean, ux = Math.cos(dir), uy = Math.sin(dir);
    const base = this.segs[st.base], a = base.getPosition(), bv = base.getLinearVelocity();
    for (let i = 0; i < n; i++) {
      const k = Math.abs(i - st.base); if (k === 0) continue;
      const s = this.segs[i], p = s.getPosition(), v = s.getLinearVelocity(), m = s.getMass();
      const tx = a.x + ux * k * CFG.sausage.spacing, ty = a.y + uy * k * CFG.sausage.spacing;
      const K = S.springK * (1 - S.tipSoft * k / (n - 1)), D = S.springD;
      s.applyForceToCenter(new Vec2(m * (K * (tx - p.x) - D * (v.x - bv.x)), m * (K * (ty - p.y) - D * (v.y - bv.y) + CFG.physics.gravity * S.gravityComp)), true);
    }
  }

  /** a sausage lying still on something stands up by itself (never a softlock) */
  private rest(dt: number) {
    if (this.stuck) { this.restT = 0; return; }
    let slow = true, touchingSeg = -1;
    for (let i = 0; i < this.segs.length; i++) { const s = this.segs[i]; if (s.getLinearVelocity().length() > CFG.stand.restSpeed) slow = false; if ((this.touching.get(s) || 0) > 0) touchingSeg = i; }
    if (!slow || touchingSeg < 0) { this.restT = 0; return; }
    this.restT += dt; if (this.restT < CFG.stand.restTime) return;
    // stand on the end segment that is lowest, pinned to the body it rests on
    const n = this.segs.length, end = this.segs[0].getPosition().y <= this.segs[n - 1].getPosition().y ? 0 : n - 1, ep = this.segs[end].getPosition();
    let body: planck.Body | null = null, pt = new Vec2(ep.x, ep.y - CFG.sausage.radius), normal = new Vec2(0, 1);
    for (let e: planck.ContactEdge | null = this.segs[touchingSeg].getContactList(); e; e = e!.next) {
      const ce = e as planck.ContactEdge; const u = ce.other!.getUserData() as Ud; if (!ce.contact.isTouching() || u?.k !== 'plat' || HAZARD.includes(u.kind!)) continue;
      body = ce.other!; const wm = ce.contact.getWorldManifold(null); if (wm) { const segIsA = ce.contact.getFixtureA().getBody() === this.segs[touchingSeg]; normal = segIsA ? new Vec2(-wm.normal.x, -wm.normal.y) : new Vec2(wm.normal.x, wm.normal.y); } break;
    }
    if (!body) return;
    pt = new Vec2(ep.x - normal.x * CFG.sausage.radius, ep.y - normal.y * CFG.sausage.radius);
    this.stickTo(body, end, pt, normal); sfx.stick();
  }

  private collect() {
    const r = CFG.sausage.radius + 0.32;
    for (const c of this.coins) { if (c.taken) continue; for (const s of this.segs) { const p = s.getPosition(); if (Math.abs(p.x - c.x) < r && Math.abs(p.y - c.y) < r) { c.taken = true; this.coinsRun += CFG.scoring.coinValue; sfx.coin(); this.burst(c.x, c.y, 'coin', 8, 2.5); break; } } }
  }

  private respawn() {
    this.respawnQ = false; this.burnT = 0; this.falls++; this.charging = false; this.wantCharge = false; chargeTone(0, false);
    const c = this.center; this.burst(c.x, c.y, 'dust', 10, 3);
    this.spawn(this.checkpoint[0], this.checkpoint[1]);
    sfx.respawn(); this.shake = 0.4;
  }

  // ---------- results ----------
  get stars() { if (this.state !== 'win') return 0; const [a, b] = CFG.scoring.starJumps; const j = this.jumps; return j <= this.L.par * a ? 3 : j <= this.L.par * b ? 2 : 1; }
  get coinsEarned() { return this.coinsRun + (this.state === 'win' ? CFG.scoring.levelCoins + this.stars * CFG.scoring.perStar : 0); }
}
