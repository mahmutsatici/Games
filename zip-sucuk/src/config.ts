/** Every tunable number of Zip Sucuk lives here (CLAUDE.md convention). Units: metres, seconds, radians. */
export const CFG = {
  physics: {
    gravity: 20,          // cartoon-strong gravity: snappy hops
    step: 1 / 60,         // fixed physics step
    maxStepsPerFrame: 4,
  },
  sausage: {
    segments: 7,
    radius: 0.19,         // segment radius (body thickness = 2r)
    spacing: 0.25,        // distance between segment centres (length ≈ spacing*(n-1)+2r)
    density: 1.0,
    friction: 0.9,
    restitution: 0.08,
    bendHz: 6.5,          // weld joint stiffness: lower = floppier sausage
    bendDamping: 0.4,
  },
  stand: {
    swayAmp: 0.95,        // max lean from the surface normal while standing (rad)
    swayPeriod: 1.8,      // seconds for one full left-right sway
    chargeSlow: 0.25,     // sway speed multiplier while charging (easier aiming)
    springK: 900,         // standing stiffness (per unit mass): pulls segments onto the lean line
    springD: 34,          // standing damping
    tipSoft: 0.45,        // tip is this much softer than the base -> jelly wobble
    gravityComp: 1.0,     // share of gravity cancelled while standing (1 = fully supported)
    standUpTime: 0.45,    // seconds to rise from lying to standing
    restSpeed: 0.35,      // below this speed (m/s) a lying sausage counts as resting
    restTime: 0.45,       // resting this long -> it stands up
    reStickGrace: 0.15,   // no sticking right after a jump (s)
  },
  jump: {
    chargeTime: 0.75,     // hold this long for full power
    minPower: 0.3,        // power of a quick tap (0..1)
    maxSpeed: 15,         // launch speed at full power (m/s)
    spin: 2.2,            // tumble given on launch (rad/s)
    aimDots: 9,           // trajectory preview dots while charging (0 = off)
    aimTime: 0.55,        // seconds of trajectory shown
  },
  surfaces: {
    wood: { friction: 0.9, restitution: 0.05 },
    butter: { friction: 0.02, restitution: 0.0 },
    jelly: { friction: 0.6, restitution: 0.95 },
    steel: { friction: 0.4, restitution: 0.1 },
  },
  camera: { ppm: 80, lookAhead: 0.6, smooth: 5, minPpm: 48 },
  scoring: {
    starJumps: [1.0, 1.5],  // 3 stars at <= par jumps, 2 stars at <= par*1.5, else 1
    coinValue: 1,
    levelCoins: 10,         // finishing reward
    perStar: 5,
  },
  skins: [
    { id: 'sucuk', cost: 0, body: '#9e2f1c', light: '#cf5a3e', dark: '#561409', fat: '#f2d9c4' },
    { id: 'sosis', cost: 60, body: '#e0866a', light: '#f3b29c', dark: '#8f3f2a', fat: '' },
    { id: 'salam', cost: 120, body: '#b8344a', light: '#e2708a', dark: '#5e1222', fat: '#ffe3ea' },
    { id: 'kangal', cost: 200, body: '#7a3b1e', light: '#b86b45', dark: '#3a160a', fat: '#e8c9a8' },
    { id: 'vegan', cost: 300, body: '#6f9a3a', light: '#a6d062', dark: '#2f4a12', fat: '#e4f2c8' },
  ],
  daily: [20, 30, 45, 60, 80, 100, 150],
} as const;
