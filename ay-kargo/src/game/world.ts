import * as planck from 'planck';
import { LevelDef, WORLDS, makeTerrain, Terrain, rng, FLAT_START } from './levels';
import { save } from './save';
import { sfx } from './audio';

const Vec2 = planck.Vec2;
export interface Input { gas: boolean; brake: boolean; turbo: boolean; }
export interface Ud { k: string; px: number; py: number; pa: number; id?: number; }
export interface Crate { body: planck.Body; idx: number; dropped: boolean; stolen: boolean; dieT: number; }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; type: 'dust' | 'spark' | 'goo' | 'coin' | 'debris'; size: number; }
export interface Meteor { tx: number; ty: number; t: number; }
export interface Ufo { x: number; y: number; state: 'in' | 'arm' | 'beam' | 'leave'; t: number; target: Crate | null; }
export interface Crater { x: number; r: number; d: number; }

const CHUNK = 16, STEP = 0.5;
export const CRATE_HALF = 0.26;
const FIXED = 1 / 60;

export class Sim {
  world: planck.World; terrain: Terrain; W = WORLDS[0];
  chassis!: planck.Body; wheels: planck.Body[] = []; joints: planck.WheelJoint[] = [];
  crates: Crate[] = []; slimes: planck.Body[] = []; rocks: planck.Body[] = [];
  meteors: Meteor[] = []; ufo: Ufo | null = null; craters: Crater[] = [];
  particles: Particle[] = []; chunks = new Map<number, planck.Body>();
  state: 'run' | 'win' | 'fail' = 'run'; failReason: '' | 'flip' | 'battery' | 'crates' = '';
  t = 0; acc = 0; shake = 0; coinsBonus = 0; squashed = 0; perfect = 0;
  energy = 1; energyMax = 1; noEnergy = false; stillT = 0; rechargeUsed = false;
  shields = 0; turboCharge = 1; turboOn = false; throttle = 0; goo = 0;
  airT = 0; wheelGround = [0, 0]; topContact = 0; topT = 0;
  maxX = 0; hitFlash = 0; hitNote = 0;
  private r: () => number;
  private nextSlime = 48; private nextRock = 62; private nextMeteor = 9; private nextUfo = 14; private nid = 1;
  private kill: planck.Body[] = [];
  // upgrade-derived
  private torque = 0; private maxSpd = 0; private crushV = 0; private gooPow = 0; private turboLvl = 0;

  constructor(public L: LevelDef, shieldBonus = false) {
    this.W = WORLDS[L.world]; this.terrain = makeTerrain(L); this.r = rng(L.seed + 5);
    this.world = new planck.World({ gravity: new Vec2(0, -this.W.gravity) });
    const u = save.up;
    this.torque = 8 + 1.5 * u.engine; this.maxSpd = 17 + 2.6 * u.engine;
    this.energyMax = 1; this.crushV = 7.5 - 1.2 * u.bumper; this.gooPow = u.bumper; this.turboLvl = u.turbo;
    this.shields = u.shield + (shieldBonus ? 1 : 0);
    this.buildRover();
    this.updateChunks(true);
    this.world.on('begin-contact', c => this.contact(c, 1));
    this.world.on('end-contact', c => this.contact(c, -1));
  }

  /** battery capacity in "energy seconds" */
  get capacity() { return 70 + 18 * save.up.battery + (this.L.endless ? 20 : 0); }
  energySec = this.capacity;
  get speed() { return this.chassis.getLinearVelocity().x; }
  get distance() { return Math.max(0, this.chassis.getPosition().x - 4); }
  get progress() { return this.L.endless ? 0 : Math.min(1, this.distance / (this.L.length - 4)); }
  get cratesLeft() { return this.crates.filter(c => !c.dropped && !c.stolen).length; }

  private ud(b: planck.Body, k: string): Ud { const p = b.getPosition(); const u: Ud = { k, px: p.x, py: p.y, pa: b.getAngle(), id: this.nid++ }; b.setUserData(u); return u; }

  private buildRover() {
    const x0 = 4, y0 = this.terrain.h(x0) + 1.25, u = save.up;
    const ch = this.chassis = this.world.createBody({ type: 'dynamic', position: new Vec2(x0, y0), allowSleep: false, angularDamping: 1.2 });
    this.ud(ch, 'chassis');
    ch.createFixture({ shape: new planck.Box(1.5, 0.25), density: 2.0, friction: 0.4 });
    const wallH = 0.55 + 0.1 * u.bed;
    ch.createFixture({ shape: new planck.Box(0.05, wallH / 2, new Vec2(-1.45, 0.25 + wallH / 2), 0), density: 0.2, friction: 0.3, userData: 'top' });
    ch.createFixture({ shape: new planck.Box(0.32, 0.5, new Vec2(1.15, 0.75), 0), density: 0.2, friction: 0.3, userData: 'top' });
    ch.createFixture({ shape: new planck.Box(0.05, wallH / 2 * 0.9, new Vec2(0.78, 0.25 + wallH / 2 * 0.9), 0), density: 0.2, friction: 0.3 });
    const fr = 1.0 + 0.2 * u.tires, hz = 3.2 + 0.35 * u.suspension, damp = 0.55 + 0.05 * u.suspension;
    for (const dx of [-1.05, 1.05]) {
      const w = this.world.createBody({ type: 'dynamic', position: new Vec2(x0 + dx, y0 - 0.45), allowSleep: false, bullet: true });
      this.ud(w, 'wheel'); w.createFixture({ shape: new planck.Circle(0.42), density: 1.1, friction: fr, restitution: 0.05 });
      this.wheels.push(w);
      this.joints.push(this.world.createJoint(new planck.WheelJoint({ motorSpeed: 0, maxMotorTorque: this.torque, enableMotor: true, frequencyHz: hz, dampingRatio: damp }, ch, w, w.getPosition(), new Vec2(0, 1)))! as planck.WheelJoint);
    }
    // crates
    const n = this.L.crates, perRow = 4;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow), col = i % perRow;
      const b = this.world.createBody({ type: 'dynamic', position: new Vec2(x0 - 1.15 + col * 0.54 + (row % 2) * 0.06, y0 + 0.25 + CRATE_HALF + 0.02 + row * 0.54), allowSleep: false });
      this.ud(b, 'crate'); b.createFixture({ shape: new planck.Box(CRATE_HALF, CRATE_HALF), density: 1.0, friction: 0.7, restitution: 0.05, filterCategoryBits: 2 });
      this.crates.push({ body: b, idx: i, dropped: false, stolen: false, dieT: 0 });
    }
  }

  // ---------- terrain ----------
  private hAt(x: number): number {
    let y = this.terrain.h(x);
    for (const c of this.craters) { const d = Math.abs(x - c.x); if (d < c.r) y -= c.d * 0.5 * (1 + Math.cos(Math.PI * d / c.r)); }
    return y;
  }
  groundY(x: number) { return this.hAt(x); }
  private buildChunk(i: number) {
    const old = this.chunks.get(i); if (old) this.world.destroyBody(old);
    const pts: planck.Vec2[] = [];
    for (let k = 0; k <= CHUNK / STEP; k++) { const x = i * CHUNK + k * STEP; pts.push(new Vec2(x, this.hAt(x))); }
    const b = this.world.createBody({ type: 'static' }); this.ud(b, 'ground');
    b.createFixture({ shape: new planck.Chain(pts, false), friction: this.W.friction });
    this.chunks.set(i, b);
  }
  private updateChunks(all = false) {
    const cx = Math.floor(this.chassis.getPosition().x / CHUNK);
    for (let i = cx - 2; i <= cx + 6; i++) if (!this.chunks.has(i)) this.buildChunk(i);
    for (const [i, b] of this.chunks) if (i < cx - 4) { this.world.destroyBody(b); this.chunks.delete(i); }
    void all;
  }
  private addCrater(x: number, r: number, d: number) {
    this.craters.push({ x, r, d });
    for (let i = Math.floor((x - r) / CHUNK); i <= Math.floor((x + r) / CHUNK); i++) if (this.chunks.has(i)) this.buildChunk(i);
  }

  // ---------- contacts ----------
  private contact(c: planck.Contact, d: number) {
    const fa = c.getFixtureA(), fb = c.getFixtureB(), ba = fa.getBody(), bb = fb.getBody();
    const ua = ba.getUserData() as Ud, ub = bb.getUserData() as Ud;
    this.pair(ua, ba, fa, ub, bb, fb, d); this.pair(ub, bb, fb, ua, ba, fa, d);
  }
  private pair(ua: Ud, ba: planck.Body, fa: planck.Fixture, ub: Ud, bb: planck.Body, _fb: planck.Fixture, d: number) {
    if (!ua || !ub) return;
    const solid = ub.k === 'ground' || ub.k === 'rock';
    if (ua.k === 'wheel' && solid) { const i = this.wheels.indexOf(ba); if (i >= 0) this.wheelGround[i] += d; }
    if (ua.k === 'chassis' && solid && fa.getUserData() === 'top') this.topContact += d;
    if (ua.k === 'crate' && d > 0 && (ub.k === 'ground' || ub.k === 'rock')) { sfx.thump(Math.min(1, ba.getLinearVelocity().length() / 8)); }
    if (d > 0 && ub.k === 'slime' && (ua.k === 'wheel' || ua.k === 'chassis')) {
      if (this.kill.includes(bb)) return;
      const v = Math.abs(this.speed);
      this.kill.push(bb); const p = bb.getPosition();
      if (v >= this.crushV) { this.squashed++; this.coinsBonus += 3 * this.W.coinMult; sfx.squash(); this.burst(p.x, p.y, 'goo', 8, 4); this.burst(p.x, p.y + .3, 'coin', 2, 3); }
      else { this.goo = Math.min(5, this.goo + 2.5); sfx.splat(); this.burst(p.x, p.y, 'goo', 10, 3); }
    }
  }

  burst(x: number, y: number, type: Particle['type'], n: number, sp: number) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = Math.random() * sp; const life = 0.4 + Math.random() * 0.5;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.abs(Math.sin(a)) * s + 1, life, max: life, type, size: 0.08 + Math.random() * 0.14 }); }
  }

  // ---------- spawning ----------
  private onRamp(x: number) { return this.terrain.ramps.some(r => x > r.x - 8 && x < r.x + r.len + 12); }
  private spawnAhead() {
    const rx = this.chassis.getPosition().x, L = this.L, lim = L.endless ? 1e9 : L.length - 14;
    while (rx + 70 > this.nextSlime) {
      let x = this.nextSlime; this.nextSlime += (62 - 42 * Math.min(1, L.slime)) * (0.7 + 0.6 * this.r());
      if (x > lim || this.onRamp(x) || L.slime <= 0) continue;
      const n = 3 + Math.floor(this.r() * (2 + L.slime * 3));
      for (let i = 0; i < n; i++) { const sx = x + i * 0.75, b = this.world.createBody({ type: 'dynamic', position: new Vec2(sx, this.hAt(sx) + 0.4), linearDamping: 2, fixedRotation: false });
        this.ud(b, 'slime'); b.createFixture({ shape: new planck.Circle(0.32), density: 0.2, friction: 1.0, restitution: 0.1, filterCategoryBits: 4, filterMaskBits: 0xFFFF & ~2 }); this.slimes.push(b); }
    }
    while (rx + 70 > this.nextRock) {
      let x = this.nextRock; this.nextRock += (75 - 40 * L.rocks) * (0.7 + 0.6 * this.r());
      if (x > lim || this.onRamp(x)) continue;
      const n = 1 + Math.floor(this.r() * (1 + L.rough * 3));
      for (let i = 0; i < n; i++) { const s = 0.2 + this.r() * 0.18 + 0.12 * L.rough, b = this.world.createBody({ type: 'dynamic', position: new Vec2(x + (i % 2) * 0.6, this.hAt(x) + s + Math.floor(i / 2) * s * 2 + 0.1), angle: this.r() * 0.5 });
        this.ud(b, 'rock'); b.createFixture({ shape: new planck.Box(s, s * 0.8), density: 0.7, friction: 0.7, restitution: 0.05 }); this.rocks.push(b); }
    }
    for (const arr of [this.slimes, this.rocks]) for (let i = arr.length - 1; i >= 0; i--) { if (arr[i].getPosition().x < rx - 40) { this.world.destroyBody(arr[i]); arr.splice(i, 1); } }
  }

  // ---------- step ----------
  update(dtReal: number, inp: Input) {
    if (this.state !== 'run' && this.state !== 'win') { this.shakeDecay(dtReal); this.fxStep(dtReal); return; }
    this.acc += Math.min(dtReal, 0.1);
    while (this.acc >= FIXED) { this.snap(); this.step(FIXED, inp); this.acc -= FIXED; }
    this.shakeDecay(dtReal); this.fxStep(dtReal);
  }
  get alpha() { return this.acc / FIXED; }
  private shakeDecay(dt: number) { this.shake = Math.max(0, this.shake - dt * 3); this.hitFlash = Math.max(0, this.hitFlash - dt * 2); }
  private snap() {
    const all = [this.chassis, ...this.wheels, ...this.crates.map(c => c.body), ...this.slimes, ...this.rocks];
    for (const b of all) { const u = b.getUserData() as Ud, p = b.getPosition(); u.px = p.x; u.py = p.y; u.pa = b.getAngle(); }
  }
  private fxStep(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) { const p = this.particles[i]; p.life -= dt; if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; if (p.type !== 'dust') p.vy -= 9 * dt; }
  }

  private step(dt: number, inp: Input) {
    this.t += dt; const ch = this.chassis, pos = ch.getPosition();
    const win = this.state === 'win';
    if (this.state === 'run' || win) {
      this.driveStep(dt, win ? { gas: false, brake: true, turbo: false } : inp);
    }
    if (!win) { this.hazards(dt); this.spawnAhead(); this.crateCheck(dt); this.failCheck(dt); }
    this.world.step(dt, 8, 3);
    for (const k of this.kill) { const i = this.slimes.indexOf(k); if (i >= 0) this.slimes.splice(i, 1); this.world.destroyBody(k); }
    this.kill.length = 0;
    this.updateChunks();
    this.maxX = Math.max(this.maxX, pos.x);
    if (!win && !this.L.endless && pos.x >= this.L.length && this.state === 'run') {
      if (this.cratesLeft > 0) { this.state = 'win'; sfx.win(); } 
    }
  }

  private driveStep(dt: number, inp: Input) {
    const ch = this.chassis, v = this.speed;
    this.goo = Math.max(0, this.goo - dt);
    const gooF = this.goo > 0 ? 0.5 + 0.1 * this.gooPow : 1;
    const hasE = this.energySec > 0;
    // turbo
    this.turboOn = this.turboLvl > 0 && inp.turbo && this.turboCharge > 0.03 && hasE;
    if (this.turboOn) { if (this.turboCharge >= 0.99) sfx.turbo(); this.turboCharge -= dt / (1.0 + 0.35 * this.turboLvl); } else this.turboCharge = Math.min(1, this.turboCharge + dt / 9);
    const boost = this.turboOn ? 1.6 : 1;
    let target = 0;
    if (hasE) {
      if (inp.gas) target = -this.maxSpd * gooF * boost;
      else if (inp.brake) target = v > 1.5 ? 0 : this.maxSpd * 0.45;
    }
    if (inp.brake && !inp.gas && v > 1.5) target = 0;
    this.throttle += (target - this.throttle) * Math.min(1, dt * 3);
    const pitch = Math.atan2(Math.sin(ch.getAngle()), Math.cos(ch.getAngle())), grounded = this.wheelGround[0] > 0 || this.wheelGround[1] > 0;
    const tc = grounded ? Math.max(0.1, 1 - Math.max(0, pitch - 0.22) * 2.6) : 1;
    if (grounded && pitch > 0.3) ch.applyTorque(-16 * (pitch - 0.3), true);
    const brakingTq = inp.brake && !inp.gas && v > 1.5 ? 40 : 0;
    for (const j of this.joints) {
      j.setMotorSpeed(this.throttle);
      j.setMaxMotorTorque((target === 0 && !inp.brake ? 0.6 : brakingTq || this.torque * tc * gooF * (this.turboOn ? 1.5 : 1)));
    }
    if (this.turboOn) ch.applyForceToCenter(new Vec2(Math.cos(ch.getAngle()) * 14, Math.sin(ch.getAngle()) * 14), true);
    if (this.goo > 0) ch.applyForceToCenter(new Vec2(-v * 2.2, 0), true);
    // battery
    if (hasE) { this.energySec -= dt * (inp.gas || this.turboOn ? (this.turboOn ? 2.2 : 1) : 0.3); if (this.energySec <= 0) { this.energySec = 0; this.noEnergy = true; } }
    this.energy = this.energySec / this.capacity;
    // air control + ground detect
    const airborne = this.wheelGround[0] <= 0 && this.wheelGround[1] <= 0;
    if (airborne) { this.airT += dt; const tq = (inp.gas ? 1 : 0) - (inp.brake ? 1 : 0); if (tq && hasE || tq && inp.brake) ch.applyTorque(tq * 9, true); }
    else {
      if (this.airT > 0.7) {
        const a = Math.atan2(Math.sin(ch.getAngle()), Math.cos(ch.getAngle()));
        const vy = ch.getLinearVelocity().y;
        if (Math.abs(a) < 0.4) { this.perfect++; this.coinsBonus += 4 * this.W.coinMult; sfx.land(); sfx.coin(); const p = ch.getPosition(); this.burst(p.x, p.y + 1, 'coin', 6, 4); }
        if (vy < -7) this.shake = Math.max(this.shake, Math.min(1, -vy / 16));
      }
      this.airT = 0;
    }
    // dust
    const p = ch.getPosition();
    if (!airborne && Math.abs(v) > 2.5 && Math.random() < 0.5) { const w = this.wheels[v > 0 ? 0 : 1].getPosition(); const gx = w.x - Math.sign(v) * 0.2; this.particles.push({ x: gx, y: w.y - 0.35, vx: -v * 0.12 + (Math.random() - .5), vy: 0.6 + Math.random(), life: 0.5, max: 0.5, type: 'dust', size: 0.12 + Math.random() * 0.12 }); }
    void p;
  }

  private hazards(dt: number) {
    const L = this.L, ch = this.chassis, p = ch.getPosition(), rx = p.x;
    // meteors
    if (L.meteor > 0 && this.t > this.nextMeteor && rx > 25) {
      const lead = Math.max(0, Math.min(16, this.speed)) * 1.5 + (this.r() - 0.3) * 6;
      const tx = rx + lead; this.meteors.push({ tx, ty: this.hAt(tx), t: 0 }); sfx.whoosh();
      this.nextMeteor = this.t + (6.5 - 3.5 * Math.min(1, L.meteor)) * (0.7 + 0.6 * this.r());
    }
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i]; m.t += dt;
      if (m.t >= 1.5) {
        this.meteors.splice(i, 1); m.ty = this.hAt(m.tx);
        const dx = p.x - m.tx, dy = p.y - m.ty, d = Math.hypot(dx, dy);
        this.addCrater(m.tx, 2.4, 0.55); sfx.boom(); this.shake = Math.max(this.shake, d < 12 ? 0.6 : 0.2);
        this.burst(m.tx, m.ty + .3, 'debris', 16, 7); this.burst(m.tx, m.ty + .3, 'spark', 10, 9);
        if (d < 2.6) {
          this.hitFlash = 1;
          if (this.shields > 0) { this.shields--; sfx.shield(); this.hitNote = 1; this.burst(p.x, p.y, 'spark', 14, 6); }
          else { ch.applyLinearImpulse(new Vec2(Math.sign(dx || 1) * 1.5, 5), ch.getWorldCenter(), true);
            for (const c of this.crates) if (!c.dropped) c.body.applyLinearImpulse(new Vec2((this.r() - .5) * 1.2, 0.9 + this.r() * 0.6), c.body.getWorldCenter(), true); }
        } else if (d < 5) ch.applyLinearImpulse(new Vec2(Math.sign(dx || 1) * 0.6, 1.2), ch.getWorldCenter(), true);
      }
    }
    // UFO
    if (L.ufo > 0) this.ufoStep(dt);
  }

  private ufoStep(dt: number) {
    const ch = this.chassis, p = ch.getPosition(), g = this.W.gravity;
    if (!this.ufo) { if (this.t > this.nextUfo && p.x > 40 && this.cratesLeft > 0) { this.ufo = { x: p.x + 24, y: p.y + 9, state: 'in', t: 0, target: null }; } return; }
    const u = this.ufo; u.t += dt;
    const spd = 7 + 2.5 * this.L.ufo, targetY = Math.max(p.y, this.hAt(u.x)) + 8;
    u.y += (targetY - u.y) * Math.min(1, dt * 2);
    const dx = p.x - u.x;
    if (u.state === 'in') { u.x += Math.sign(dx) * Math.min(Math.abs(dx), spd * 1.3 * dt); if (Math.abs(dx) < 2.2) { u.state = 'arm'; u.t = 0; } }
    else if (u.state === 'arm') { u.x += Math.sign(dx) * Math.min(Math.abs(dx), spd * dt); if (u.t > 1.0) { u.state = 'beam'; u.t = 0; u.target = null; } }
    else if (u.state === 'beam') {
      u.x += Math.sign(dx) * Math.min(Math.abs(dx), spd * dt);
      if (!u.target) { const alive = this.crates.filter(c => !c.dropped && !c.stolen); if (alive.length) u.target = alive.reduce((a, b) => (b.body.getPosition().y > a.body.getPosition().y ? b : a)); }
      const c = u.target;
      if (c && !c.dropped && !c.stolen) {
        const cp = c.body.getPosition(), off = u.x - cp.x;
        if (Math.abs(off) < 1.7) {
          const m = c.body.getMass();
          c.body.applyForceToCenter(new Vec2(off * 10 * m - c.body.getLinearVelocity().x * 2 * m, m * (g + 7)), true);
          if (cp.y > u.y - 1.6) { c.stolen = true; c.dieT = 0.01; sfx.shield(); this.burst(cp.x, cp.y, 'spark', 12, 5); this.world.destroyBody(c.body); u.t = 3; }
        }
      }
      if (u.t >= 3) { u.state = 'leave'; u.t = 0; }
    } else { u.x += 10 * dt; u.y += 5 * dt; if (u.t > 2.5) { this.ufo = null; this.nextUfo = this.t + 22 - 12 * Math.min(1, this.L.ufo); } }
  }
  /** 0..1 beam strength for audio/render; beam half-width on ground is 1.7 */
  get beamActive() { return !!this.ufo && this.ufo.state === 'beam'; }

  private crateCheck(dt: number) {
    const ch = this.chassis;
    for (const c of this.crates) {
      if (c.stolen) continue;
      if (c.dropped) { c.dieT -= dt; if (c.dieT <= 0 && c.dieT > -50) { this.world.destroyBody(c.body); c.dieT = -99; } continue; }
      if (this.ufo?.state === 'beam' && this.ufo.target === c) continue;
      const l = ch.getLocalPoint(c.body.getPosition());
      if (Math.abs(l.x) > 2.6 || l.y < -1.3) { c.dropped = true; c.dieT = 2.5; sfx.drop(); }
    }
    for (const c of this.crates) if (c.dieT === -99 && !c.dropped) c.dieT = 0;
  }

  private failCheck(dt: number) {
    if (this.state !== 'run') return;
    const a = Math.atan2(Math.sin(this.chassis.getAngle()), Math.cos(this.chassis.getAngle()));
    if (this.topContact > 0 && Math.abs(a) > 1.5) this.topT += dt; else this.topT = 0;
    if (this.topT > 0.45) return this.fail('flip');
    if (this.cratesLeft === 0 && !this.L.endless) return this.fail('crates');
    if (this.L.endless && this.cratesLeft === 0) return this.fail('crates');
    if (this.noEnergy) { if (Math.abs(this.speed) < 0.6) this.stillT += dt; else this.stillT = 0; if (this.stillT > 1.0) this.fail('battery'); }
  }
  private fail(r: 'flip' | 'battery' | 'crates') { this.state = 'fail'; this.failReason = r; sfx.fail(); }
  recharge() { this.rechargeUsed = true; this.noEnergy = false; this.energySec = this.capacity * 0.5; this.state = 'run'; this.failReason = ''; this.stillT = 0; }

  // ---------- result ----------
  get delivered() { return this.state === 'win' ? this.cratesLeft : 0; }
  get stars() { if (this.state !== 'win') return 0; const r = this.delivered / this.L.crates; return r >= 1 ? 3 : r >= 2 / 3 ? 2 : 1; }
  get coinsEarned(): number {
    const L = this.L;
    if (L.endless) return Math.floor(this.distance / 14 + this.coinsBonus + this.cratesLeft * L.crateValue * 0.5);
    const base = this.delivered * L.crateValue * this.W.coinMult;
    return Math.floor(base + this.distance / 20 + this.coinsBonus);
  }
  get startFlat() { return FLAT_START; }
}
