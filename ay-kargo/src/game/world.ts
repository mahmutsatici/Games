import * as planck from 'planck';
import { LevelDef, WORLDS, Terrain, rng } from './levels';
import { save } from './save';
import { sfx } from './audio';

const Vec2 = planck.Vec2;
export interface Input { gas: boolean; brake: boolean; turbo: boolean; }
export interface Ud { k: string; px: number; py: number; pa: number; }
export interface Crate { body: planck.Body; idx: number; glass: boolean; lost: boolean; gone: boolean; lostT: number; warned: number; }
export interface Slime { body: planck.Body; phase: number; dead: boolean; stuck: boolean; }
export type PType = 'dust' | 'spark' | 'goo' | 'coin' | 'debris' | 'glass' | 'smoke' | 'energy' | 'flash';
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; type: PType; size: number; g: number; }
export interface Meteor { x: number; t: number; }
export interface Ufo { x: number; y: number; beam: number; target: Crate | null; life: number; leaving: boolean; }
export interface Crater { x: number; r: number; d: number; }
export interface Popup { x: number; y: number; n: number; life: number; color: string; }

const CHUNK = 16, STEP = 0.5, DT = 1 / 60, MAX_P = 200;
export const CRATE_HALF = 0.22;

/** Prototype-tuned rover + hazards. Upgrade curves are the prototype's 0..5 range spread over our 0..8 levels. */
export class Sim {
  world: planck.World; terrain: Terrain; W = WORLDS[0];
  chassis!: planck.Body; wheels: planck.Body[] = []; joints: planck.WheelJoint[] = [];
  crates: Crate[] = []; slimes: Slime[] = []; rocks: planck.Body[] = [];
  meteors: Meteor[] = []; ufo: Ufo | null = null; craters: Crater[] = [];
  particles: Particle[] = []; popups: Popup[] = []; chunks = new Map<number, planck.Body>();
  state: 'run' | 'win' | 'fail' = 'run'; failReason: '' | 'flip' | 'battery' | 'crates' = '';
  t = 0; acc = 0; shake = 0; slowmo = 0; punch = 0; hitFlash = 0; shieldFlash = 0;
  coinsRun = 0; squashed = 0; perfect = 0; pickedCoins = 0;
  battery = 0; batteryMax = 0; rechargeUsed = false; flipT = 0; stillT = 0;
  shields = 0; turbo = 1; turboOn = false; stickT = 0; storm = 0;
  airT = 0; airMaxH = 0; grounded = 2; scraping = false; wallH = 0.4;
  lastLostT = -9; winT = 0; crateHalf = CRATE_HALF;
  private r: () => number; private meteorT = 3.5; private ufoT = 7; private hitQueue: Slime[] = [];
  private knockT = 0; private breakQ: Crate[] = []; private pickIdx = 0;
  private maxSpd = 13; private torque = 7;

  constructor(public L: LevelDef, shieldBonus = false) {
    this.W = WORLDS[L.world]; this.terrain = new Terrain(L); this.r = rng(L.seed + 5);
    this.world = new planck.World({ gravity: new Vec2(0, -this.W.gravity) });
    const u = save.up;
    this.maxSpd = 13 + 1.6 * u.engine; this.torque = 7 + 1.4 * u.engine;
    this.batteryMax = 140 + 28 * u.battery; this.battery = this.batteryMax;
    this.shields = u.shield + (shieldBonus ? 1 : 0);
    this.buildRover();
    this.updateChunks();
    this.world.on('begin-contact', c => this.begin(c));
    this.world.on('post-solve', (c, imp) => this.post(c, imp));
  }

  get speed() { return this.chassis.getLinearVelocity().x; }
  get distance() { return Math.max(0, this.chassis.getPosition().x - 4); }
  get progress() { return this.L.endless ? 0 : Math.min(1, this.distance / (this.L.length - 4)); }
  get cratesLeft() { let n = 0; for (const c of this.crates) if (!c.lost) n++; return n; }
  get energy() { return this.battery / this.batteryMax; }
  get turboDur() { return 1.4 + 0.35 * save.up.turbo; }

  private ud(b: planck.Body, k: string) { const p = b.getPosition(); b.setUserData({ k, px: p.x, py: p.y, pa: b.getAngle() } as Ud); }

  private buildRover() {
    const u = save.up, x0 = 4, y0 = this.terrain.h(x0) + 1.4;
    const ch = this.chassis = this.world.createBody({ type: 'dynamic', position: new Vec2(x0, y0), allowSleep: false });
    this.ud(ch, 'car');
    ch.createFixture({ shape: new planck.Box(1.35, 0.18), density: 1.4, friction: 0.6, userData: 'floor', filterCategoryBits: 8 });
    ch.createFixture({ shape: new planck.Box(0.42, 0.38, new Vec2(0.95, 0.52), 0), density: 0.6, friction: 0.5, userData: 'cab', filterCategoryBits: 8 });
    const wallH = this.wallH = 0.4 + 0.0625 * u.bed;
    ch.createFixture({ shape: new planck.Box(0.06, wallH / 2, new Vec2(-1.33, 0.18 + wallH / 2), 0), density: 0.3, friction: 0.4, filterCategoryBits: 8 });
    ch.createFixture({ shape: new planck.Box(0.06, wallH / 2, new Vec2(0.48, 0.18 + wallH / 2), 0), density: 0.3, friction: 0.4, filterCategoryBits: 8 });
    const tireFr = 0.75 + 0.0875 * u.tires, freq = 3.2 + 0.28 * u.suspension, damp = 0.55 + 0.0375 * u.suspension;
    for (const wx of [-0.95, 0.95]) {
      const w = this.world.createBody({ type: 'dynamic', position: new Vec2(x0 + wx, y0 - 0.42), allowSleep: false });
      this.ud(w, 'wheel'); w.createFixture({ shape: new planck.Circle(0.42), density: 1.1, friction: tireFr, restitution: 0.05, filterCategoryBits: 8 });
      this.wheels.push(w);
      this.joints.push(this.world.createJoint(new planck.WheelJoint({ motorSpeed: 0, maxMotorTorque: this.torque, enableMotor: true, frequencyHz: freq, dampingRatio: damp }, ch, w, w.getPosition(), new Vec2(0, 1)))! as planck.WheelJoint);
    }
    // bed interior is x -1.27..0.42 (1.69 m): 3 prototype crates, or 4 slightly smaller ones per row
    const n = this.L.crates, perRow = n >= 4 ? 4 : 3, h = this.crateHalf = perRow === 4 ? 0.2 : CRATE_HALF, gap = (1.69 - perRow * 2 * h) / (perRow + 1);
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow), col = row ? i % perRow + 1 : i % perRow, glass = i >= n - this.L.glass;
      const cx = -1.27 + gap + h + col * (2 * h + gap) - (row ? h + gap / 2 : 0);
      const b = this.world.createBody({ type: 'dynamic', position: new Vec2(x0 + cx, y0 + 0.18 + h + 0.01 + row * (2 * h + 0.01)), allowSleep: false });
      this.ud(b, 'crate'); b.createFixture({ shape: new planck.Box(h, h), density: glass ? 0.3 : 0.35, friction: 0.55, restitution: 0.05, filterCategoryBits: 2 });
      this.crates.push({ body: b, idx: i, glass, lost: false, gone: false, lostT: 0, warned: -9 });
    }
  }

  // ---------- terrain chunks (ice patches get their own low-friction fixtures) ----------
  private hAt(x: number) {
    let y = this.terrain.h(x);
    for (const c of this.craters) { const d = Math.abs(x - c.x); if (d < c.r) y -= c.d * 0.5 * (1 + Math.cos(Math.PI * d / c.r)); }
    return y;
  }
  groundY(x: number) { return this.hAt(x); }
  private buildChunk(i: number) {
    const old = this.chunks.get(i); if (old) this.world.destroyBody(old);
    const b = this.world.createBody({ type: 'static' }); this.ud(b, 'ground');
    let run: planck.Vec2[] = [], runIce = false;
    const flush = () => { if (run.length > 1) b.createFixture({ shape: new planck.Chain(run, false), friction: runIce ? 0.04 : this.W.friction, userData: runIce ? 'ice' : '' }); };
    for (let k = 0; k <= CHUNK / STEP; k++) {
      const x = i * CHUNK + k * STEP, p = new Vec2(x, this.hAt(x)), ice = this.L.ice && this.terrain.isIce(x + STEP / 2);
      if (k === 0) { run = [p]; runIce = ice; continue; }
      run.push(p);
      if (ice !== runIce && k < CHUNK / STEP) { flush(); run = [p]; runIce = ice; }
    }
    flush();
    this.chunks.set(i, b);
  }
  private updateChunks() {
    const cx = Math.floor(this.chassis.getPosition().x / CHUNK);
    for (let i = cx - 2; i <= cx + 4; i++) if (!this.chunks.has(i)) this.buildChunk(i);
    for (const [i, b] of this.chunks) if (i < cx - 3) { this.world.destroyBody(b); this.chunks.delete(i); }
  }
  private addCrater(x: number, r: number, d: number) {
    this.craters.push({ x, r, d });
    for (let i = Math.floor((x - r) / CHUNK); i <= Math.floor((x + r) / CHUNK); i++) if (this.chunks.has(i)) this.buildChunk(i);
  }

  // ---------- contacts ----------
  private begin(c: planck.Contact) {
    const a = c.getFixtureA().getBody(), b = c.getFixtureB().getBody();
    const ua = a.getUserData() as Ud, ub = b.getUserData() as Ud;
    if (!ua || !ub) return;
  }
  private post(c: planck.Contact, imp: { normalImpulses: number[] }) {
    const a = c.getFixtureA().getBody(), b = c.getFixtureB().getBody();
    const ua = a.getUserData() as Ud, ub = b.getUserData() as Ud; if (!ua || !ub) return;
    const j = imp.normalImpulses[0] || 0;
    for (const [u, body] of [[ua, a], [ub, b]] as const) {
      if (u.k !== 'crate') continue;
      const cr = this.crates.find(q => q.body === body); if (!cr || cr.lost) continue;
      const dv = j / body.getMass();
      if (dv > 1.6 && this.knockT <= 0) { sfx.knock(Math.min(1, dv / 5)); this.knockT = 0.07; }
      if (cr.glass && dv > 5.2) this.breakQ.push(cr);
    }
  }

  // ---------- particles / popups ----------
  emit(x: number, y: number, type: PType, n: number, sp: number, up = 1, g = 9) {
    for (let i = 0; i < n && this.particles.length < MAX_P; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * sp, life = 0.35 + Math.random() * 0.5;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.abs(Math.sin(a)) * s * up + (up ? 0.5 : 0), life, max: life, type, size: 0.06 + Math.random() * 0.1, g });
    }
  }
  pop(x: number, y: number, n: number, color = '#ffd23a') { this.popups.push({ x, y, n, life: 1, color }); }

  // ---------- main loop ----------
  update(dtReal: number, inp: Input) {
    if (this.slowmo > 0) this.slowmo -= dtReal;
    const dt = Math.min(dtReal, 0.1) * (this.slowmo > 0 ? 0.3 : 1);
    if (this.state !== 'fail') {
      this.acc += dt;
      while (this.acc >= DT) { this.snap(); this.step(DT, inp); this.acc -= DT; }
    }
    this.shake = Math.max(0, this.shake - dtReal * 2.6); this.punch = Math.max(0, this.punch - dtReal * 2.5);
    this.hitFlash = Math.max(0, this.hitFlash - dtReal * 2.5); this.shieldFlash = Math.max(0, this.shieldFlash - dtReal * 2);
    for (let i = this.particles.length - 1; i >= 0; i--) { const p = this.particles[i]; p.life -= dt; if (p.life <= 0) { this.particles.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= p.g * dt; if (p.type === 'dust' || p.type === 'smoke') { p.vx *= 1 - dt * 1.5; } }
    for (let i = this.popups.length - 1; i >= 0; i--) { const p = this.popups[i]; p.life -= dtReal * 0.9; p.y += dtReal * 1.3; if (p.life <= 0) this.popups.splice(i, 1); }
  }
  get alpha() { return this.acc / DT; }
  private snap() {
    const all = [this.chassis, ...this.wheels, ...this.slimes.map(s => s.body), ...this.rocks];
    for (const c of this.crates) if (!c.gone) all.push(c.body);
    for (const b of all) { const u = b.getUserData() as Ud, p = b.getPosition(); u.px = p.x; u.py = p.y; u.pa = b.getAngle(); }
  }
  private groundedCount() {
    let n = 0;
    for (const w of this.wheels) for (let ce = w.getContactList(); ce; ce = ce.next) { const k = (ce.other!.getUserData() as Ud)?.k; if (ce.contact.isTouching() && (k === 'ground' || k === 'rock')) { n++; break; } }
    return n;
  }

  private step(dt: number, inp: Input) {
    this.t += dt; this.knockT -= dt;
    const win = this.state === 'win';
    this.drive(dt, win ? { gas: false, brake: true, turbo: false } : inp);
    this.world.step(dt, 8, 3);
    if (win) { this.winT += dt; return; }
    this.afterStep(dt, inp);
  }

  private drive(dt: number, inp: Input) {
    const ch = this.chassis, u = save.up, hasE = this.battery > 0, win = this.state === 'win';
    let ms = 0, tq = 0.6;
    if (inp.gas && hasE) { ms = -this.maxSpd; tq = this.torque; }
    else if (inp.brake && (hasE || win)) { ms = win ? 0 : this.maxSpd * 0.55; tq = win ? 30 : this.torque; }
    // mild anti-flip assist: only beyond 0.6 rad pitch, so normal climbing feels like the prototype
    const pitch = Math.atan2(Math.sin(ch.getAngle()), Math.cos(ch.getAngle()));
    this.grounded = this.groundedCount();
    if (this.grounded > 0 && inp.gas && pitch > 0.5) { tq *= Math.max(0.1, 1 - (pitch - 0.5) * 3); if (pitch > 0.7) ch.applyTorque(-5 * (pitch - 0.7), true); }
    for (const j of this.joints) { j.setMotorSpeed(ms); j.setMaxMotorTorque(tq); }
    const air = this.grounded === 0;
    if (air && !win) { if (inp.gas) ch.applyTorque(2.2, true); if (inp.brake) ch.applyTorque(-2.2, true); }
    if (!win && (inp.gas || inp.brake) && hasE) this.battery = Math.max(0, this.battery - dt * (inp.gas ? 3.5 : 2));
    // turbo (prototype values)
    this.turboOn = !win && inp.turbo && this.turbo > 0;
    if (this.turboOn) {
      if (this.turbo >= 0.999) sfx.turbo();
      this.turbo = Math.max(0, this.turbo - dt / this.turboDur);
      ch.applyForceToCenter(ch.getWorldVector(new Vec2(26 + 4 * u.turbo, 0)), true);
      if (Math.random() < 0.8) { const bp = ch.getWorldPoint(new Vec2(-1.45, 0.05)); this.particles.length < MAX_P && this.particles.push({ x: bp.x, y: bp.y, vx: -4 - Math.random() * 3, vy: Math.random() - 0.5, life: 0.5, max: 0.5, type: 'smoke', size: 0.12, g: -0.5 }); }
    } else this.turbo = Math.min(1, this.turbo + dt * 0.12);
    if (this.stickT > 0) { this.stickT -= dt; const v = ch.getLinearVelocity(); ch.setLinearVelocity(new Vec2(v.x * (1 - dt * 2.2), v.y)); }
  }

  private afterStep(dt: number, inp: Input) {
    const ch = this.chassis, p = ch.getPosition(), u = save.up, v = this.speed;
    // slime hits (prototype rule: fast or turbo crushes, slow sticks). Slimes don't block the rover physically.
    const w0 = this.wheels[0].getPosition(), w1 = this.wheels[1].getPosition();
    for (const s of this.slimes) { const q = s.body.getPosition(); if (Math.hypot(q.x - w0.x, q.y - w0.y) < 0.68 || Math.hypot(q.x - w1.x, q.y - w1.y) < 0.68 || Math.abs(ch.getLocalPoint(q).x) < 1.3 && Math.abs(ch.getLocalPoint(q).y) < 0.45) this.hitQueue.push(s); }
    for (const s of this.hitQueue) {
      if (s.dead) continue;
      const q = s.body.getPosition();
      if (v > 6.5 - 0.8 * u.bumper || this.turboOn) { s.dead = true; this.world.destroyBody(s.body); this.coinsRun += 3; this.squashed++; this.pop(q.x, q.y + 0.6, 3, '#a3e635'); this.emit(q.x, q.y, 'goo', 12, 4); sfx.squash(); this.shake = Math.max(this.shake, 0.15); }
      else { s.dead = true; this.world.destroyBody(s.body); this.stickT = 1.2; this.emit(q.x, q.y + 0.2, 'goo', 10, 2.5); sfx.splat(); }
    }
    this.hitQueue.length = 0;
    this.slimes = this.slimes.filter(s => !s.dead);
    for (const s of this.slimes) { s.phase += dt * 3; const sp = s.body.getPosition(); if (Math.abs(sp.x - p.x) < 14 && Math.random() < 0.006) s.body.applyLinearImpulse(new Vec2(p.x < sp.x ? -0.12 : 0.12, 0.36), sp, true); }
    this.spawnAhead();
    this.hazards(dt);
    this.pickups();
    this.cratesCheck(dt);
    for (const c of this.breakQ) if (!c.lost) { const cp = c.body.getPosition(); this.loseCrate(c, true); this.emit(cp.x, cp.y, 'glass', 16, 4); sfx.glass(); }
    this.breakQ.length = 0;
    this.landing(dt);
    this.fxDrive(inp);
    this.updateChunks();
    if (this.L.storm > 0) { const cyc = (this.t + 4) % 22, on = cyc > 12 ? 1 : 0; this.storm += (on * this.L.storm * 1.6 - this.storm) * Math.min(1, dt * 0.8); }
    // fail / win
    const a = ch.getAngle();
    this.flipT = Math.cos(a) < -0.2 ? this.flipT + dt : 0;
    if (!this.L.endless && p.x >= this.L.length && this.cratesLeft > 0) { this.state = 'win'; sfx.win(); for (const c of this.crates) if (!c.lost) { const cp = c.body.getPosition(); this.emit(cp.x, cp.y + 0.3, 'coin', 6, 4); } return; }
    if (this.flipT > 1.4) return this.fail('flip');
    if (this.cratesLeft === 0) return this.fail('crates');
    if (this.battery <= 0 && ch.getLinearVelocity().length() < 0.3) { this.stillT += dt; if (this.stillT > 0.4) this.fail('battery'); } else this.stillT = 0;
  }
  private fail(r: 'flip' | 'battery' | 'crates') { this.state = 'fail'; this.failReason = r; sfx.fail(); }
  recharge() { this.rechargeUsed = true; this.battery = this.batteryMax * 0.5; this.state = 'run'; this.failReason = ''; this.stillT = 0; }

  private spawnAhead() {
    const rx = this.chassis.getPosition().x, T = this.terrain;
    for (const g of T.slimes) {
      if (g.done || g.x > rx + 26) continue; g.done = true;
      for (let i = 0; i < g.n; i++) {
        const sx = g.x + i * 0.9, b = this.world.createBody({ type: 'dynamic', position: new Vec2(sx, this.hAt(sx) + 0.3) });
        this.ud(b, 'slime'); b.createFixture({ shape: new planck.Box(0.3, 0.24), density: 0.5, friction: 0.9, filterCategoryBits: 4, filterMaskBits: 0xffff & ~2 & ~8 });
        this.slimes.push({ body: b, phase: this.r() * 6, dead: false, stuck: false });
      }
    }
    for (const g of T.rocks) {
      if (g.done || g.x > rx + 26) continue; g.done = true;
      for (let i = 0; i < g.n; i++) { const s = 0.18 + this.r() * 0.16, x = g.x + i * 0.55, b = this.world.createBody({ type: 'dynamic', position: new Vec2(x, this.hAt(x) + s + 0.05), angle: this.r() * 0.6 });
        this.ud(b, 'rock'); b.createFixture({ shape: new planck.Polygon([new Vec2(-s, -s * 0.7), new Vec2(s, -s * 0.8), new Vec2(s * 0.8, s * 0.5), new Vec2(0, s * 0.9), new Vec2(-s * 0.9, s * 0.4)]), density: 1.0, friction: 0.8 }); this.rocks.push(b); }
    }
    for (const arr of [this.rocks]) for (let i = arr.length - 1; i >= 0; i--) if (arr[i].getPosition().x < rx - 30) { this.world.destroyBody(arr[i]); arr.splice(i, 1); }
    for (let i = this.slimes.length - 1; i >= 0; i--) if (this.slimes[i].body.getPosition().x < rx - 30) { this.world.destroyBody(this.slimes[i].body); this.slimes.splice(i, 1); }
  }

  private hazards(dt: number) {
    const L = this.L, ch = this.chassis, p = ch.getPosition(), u = save.up;
    if (L.meteor > 0) {
      this.meteorT -= dt;
      if (this.meteorT <= 0 && p.x < L.length - 15) {
        this.meteorT = Math.max(2.2, 5.5 - 3 * L.meteor) * (0.7 + this.r() * 0.6);
        const tx = p.x + Math.max(4, this.speed * 1.6) + (this.r() * 8 - 3);
        this.meteors.push({ x: tx, t: 1.6 }); sfx.whistle();
      }
    }
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i]; m.t -= dt;
      if (m.t > 0) continue;
      this.meteors.splice(i, 1);
      const gy = this.hAt(m.x), d = Math.abs(ch.getPosition().x - m.x);
      this.addCrater(m.x, 1.8, 0.45); sfx.boom();
      this.emit(m.x, gy + 0.2, 'debris', 18, 7); this.emit(m.x, gy + 0.3, 'spark', 12, 9); this.emit(m.x, gy + 0.2, 'dust', 10, 3); this.emit(m.x, gy + 0.5, 'flash', 1, 0, 0, 0);
      this.shake = Math.max(this.shake, d < 12 ? 0.55 : 0.2);
      if (d < 4.5) { this.slowmo = 0.3; this.punch = 1; }
      if (d < 2.4) {
        this.hitFlash = 1;
        if (this.shields > 0) { this.shields--; this.shieldFlash = 1; sfx.shield(); this.emit(p.x, p.y + 0.5, 'spark', 14, 6); }
        else {
          ch.applyLinearImpulse(new Vec2((p.x - m.x) * 0.6, 3.2), ch.getWorldPoint(new Vec2(-0.15, 0)), true);
          for (const c of this.crates) if (!c.lost) c.body.applyLinearImpulse(new Vec2((this.r() - 0.5) * 0.25, 0.32 + this.r() * 0.12), c.body.getPosition(), true);
        }
      }
      for (const s of this.slimes) if (!s.dead && Math.abs(s.body.getPosition().x - m.x) < 2) { s.dead = true; this.world.destroyBody(s.body); }
    }
    if (L.ufo > 0) this.ufoStep(dt, u.turbo);
  }

  private ufoStep(dt: number, _t: number) {
    const ch = this.chassis, p = ch.getPosition(), L = this.L, g = this.W.gravity;
    if (!this.ufo) { this.ufoT -= dt; if (this.ufoT <= 0 && p.x < L.length - 25 && this.cratesLeft > 0) this.ufo = { x: p.x - 14, y: p.y + 6, beam: 0, target: null, life: 12, leaving: false }; return; }
    const U = this.ufo, spd = 5.2 + 3 * Math.max(0, L.ufo - 0.4);
    U.life -= dt;
    if (U.life <= 0 || p.x > L.length - 8) U.leaving = true;
    if (U.leaving) { U.beam = Math.max(0, U.beam - dt * 3); U.y += dt * 6; U.x += dt * 4; if (U.y > p.y + 20) { this.ufo = null; this.ufoT = 10 + this.r() * 6; } return; }
    const dx = p.x - 0.4 - U.x; U.x += Math.sign(dx) * Math.min(Math.abs(dx), spd * dt); U.y += (this.hAt(U.x) + 5.2 - U.y) * dt * 2;
    if (Math.abs(dx) < 1.0) {
      U.beam = Math.min(1, U.beam + dt * 1.5);
      if (!U.target || U.target.lost) { let best: Crate | null = null; for (const c of this.crates) if (!c.lost && (!best || c.body.getPosition().x > best.body.getPosition().x)) best = c; U.target = best; }
      const c = U.target;
      if (c && U.beam > 0.6) {
        const cp = c.body.getPosition();
        if (Math.abs(cp.x - U.x) < 1.3) {
          const m = c.body.getMass();
          c.body.applyForceToCenter(new Vec2((U.x - cp.x) * 0.6 * m / 0.068, m * (g + 10.8)), true);
          if (cp.y > U.y - 0.8) { this.loseCrate(c, true); this.emit(cp.x, cp.y, 'spark', 12, 4); sfx.shield(); U.leaving = true; }
        }
      }
    } else U.beam = Math.max(0, U.beam - dt * 2.5);
  }

  private pickups() {
    const ch = this.chassis, p = ch.getPosition(), P = this.terrain.pickups, w0 = this.wheels[0].getPosition(), w1 = this.wheels[1].getPosition();
    while (this.pickIdx < P.length && P[this.pickIdx].x < p.x - 6) this.pickIdx++;
    for (let i = this.pickIdx; i < P.length && P[i].x < p.x + 3; i++) {
      const k = P[i]; if (k.taken) continue;
      const near = Math.hypot(k.x - p.x, k.y - (p.y + 0.4)) < 1.35 || Math.hypot(k.x - w0.x, k.y - w0.y) < 0.75 || Math.hypot(k.x - w1.x, k.y - w1.y) < 0.75;
      if (!near) continue;
      k.taken = true;
      if (k.k === 'coin') { this.coinsRun += 1; this.pickedCoins++; this.emit(k.x, k.y, 'coin', 5, 2.5); sfx.coin(); }
      else { this.battery = Math.min(this.batteryMax, this.battery + this.batteryMax * 0.25); this.emit(k.x, k.y, 'energy', 12, 3); this.pop(k.x, k.y + 0.4, 25, '#7dff9a'); sfx.energy(); }
    }
  }

  private loseCrate(c: Crate, gone: boolean) {
    c.lost = true; c.lostT = this.t; this.lastLostT = this.t; sfx.drop();
    if (gone && !c.gone) { c.gone = true; this.world.destroyBody(c.body); }
  }
  private cratesCheck(dt: number) {
    const ch = this.chassis, p = ch.getPosition();
    for (const c of this.crates) {
      if (c.gone) continue;
      if (c.lost) { if (this.t - c.lostT > 3) { c.gone = true; this.world.destroyBody(c.body); } continue; }
      const cp = c.body.getPosition(), lp = ch.getLocalPoint(cp);
      if (this.ufo && this.ufo.target === c && this.ufo.beam > 0.6) continue;
      // about to fall: above the wall and outside the bed -> short slow-mo + camera punch
      if (lp.y > 0.18 + this.wallH * 0.7 && (lp.x < -1.3 || lp.x > 0.45) && this.t - c.warned > 2.5) { c.warned = this.t; this.slowmo = 0.3; this.punch = 1; }
      if ((lp.x < -2.2 || lp.x > 1.6 || lp.y < -1.2 || lp.y > 3.2) && Math.hypot(cp.x - p.x, cp.y - p.y) > 3.2) { this.loseCrate(c, false); this.shake = Math.max(this.shake, 0.3); }
    }
    void dt;
  }

  private landing(dt: number) {
    const ch = this.chassis, p = ch.getPosition();
    if (this.grounded === 0) { this.airT += dt; this.airMaxH = Math.max(this.airMaxH, p.y - this.hAt(p.x)); return; }
    if (this.airT > 0.45) {
      const vy = -ch.getLinearVelocity().y, a = Math.atan2(Math.sin(ch.getAngle()), Math.cos(ch.getAngle()));
      for (const w of this.wheels) { const wp = w.getPosition(); this.emit(wp.x, wp.y - 0.35, 'dust', 6 + Math.min(10, vy * 2) | 0, 2.5 + vy * 0.3, 0.6, 1.5); }
      sfx.land(Math.min(1, vy / 8));
      if (vy > 5) this.shake = Math.max(this.shake, Math.min(0.5, vy / 18));
      if (this.airT > 0.8 && Math.abs(a) < 0.35) { this.perfect++; this.coinsRun += 2; this.pop(p.x, p.y + 1.4, 2); sfx.coin(); }
    }
    this.airT = 0; this.airMaxH = 0;
  }

  private fxDrive(inp: Input) {
    const ch = this.chassis, v = this.speed;
    if (this.grounded > 0 && (inp.gas || Math.abs(v) > 2) && Math.random() < 0.12 + Math.min(0.35, Math.abs(v) * 0.04)) {
      for (const w of this.wheels) { const wp = w.getPosition(); if (this.hAt(wp.x) + 0.6 < wp.y) continue; if (this.particles.length < MAX_P) this.particles.push({ x: wp.x - Math.sign(v || 1) * 0.3, y: wp.y - 0.36, vx: -v * 0.15 + (Math.random() - 0.5), vy: 0.4 + Math.random() * (0.6 + Math.abs(v) * 0.08), life: 0.5, max: 0.5, type: 'dust', size: 0.05 + Math.abs(v) * 0.008 + Math.random() * 0.05, g: 1.2 }); }
    }
    // chassis scraping the ground -> sparks
    this.scraping = false;
    for (let ce = ch.getContactList(); ce; ce = ce.next) {
      const k = (ce.other!.getUserData() as Ud)?.k;
      if (!ce.contact.isTouching() || (k !== 'ground' && k !== 'rock')) continue;
      if (Math.abs(v) < 1.5) continue;
      const wm = ce.contact.getWorldManifold(null); const pt = wm?.points[0]; if (!pt) continue;
      this.scraping = true;
      if (Math.random() < 0.7) for (let i = 0; i < 2; i++) this.particles.length < MAX_P && this.particles.push({ x: pt.x, y: pt.y + 0.05, vx: -v * 0.4 + (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 3, life: 0.35, max: 0.35, type: 'spark', size: 0.05, g: 9 });
    }
  }

  // ---------- result ----------
  get delivered() { return this.state === 'win' ? this.cratesLeft : 0; }
  get stars() { if (this.state !== 'win') return 0; const r = this.delivered / this.L.crates; return r >= 1 ? 3 : r >= 2 / 3 ? 2 : 1; }
  get coinsEarned(): number {
    const L = this.L;
    if (L.endless) return Math.floor(this.distance / 12 + this.coinsRun);
    return Math.floor(this.delivered * L.crateValue * this.W.coinMult + this.distance * 0.04 + this.coinsRun);
  }
}
