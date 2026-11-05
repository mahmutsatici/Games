import { bench } from './balance';
for (const b of bench()) console.log(b.kind.padEnd(9), b.target.padEnd(42), b.perGold.map(v => v.toFixed(3)).join('  '));
