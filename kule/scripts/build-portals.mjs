#!/usr/bin/env node
// Usage: node scripts/build-portals.mjs [crazygames poki gd none]
import { execSync, spawnSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// itch.io uses the plain 'none' build (no SDK)
const ALL = ['crazygames', 'poki', 'gd', 'playgama', 'none'];
const args = process.argv.slice(2);
const portals = args.length ? args : ALL;
for (const p of portals) if (!ALL.includes(p)) { console.error(`Unknown portal: ${p}`); process.exit(1); }

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipNode(dir, out) {
  const files = walk(dir).sort();
  const chunks = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(relative(dir, f).split('\\').join('/'));
    const data = readFileSync(f);
    const comp = deflateRawSync(data);
    const crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6);
    h.writeUInt16LE(8, 8); h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18);
    h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
    chunks.push(h, name, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20);
    c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + comp.length;
  }
  const cdSize = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(offset, 16);
  writeFileSync(out, Buffer.concat([...chunks, ...central, end]));
}

function zip(dir, out) {
  rmSync(out, { force: true });
  const r = spawnSync('zip', ['-r', '-q', '-X', out, '.'], { cwd: dir });
  if (r.status !== 0) zipNode(dir, out);
}

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
mkdirSync(join(root, 'dist'), { recursive: true });
const summary = [];
for (const p of portals) {
  console.log(`\n== Building ${p} ==`);
  execSync(`npx vite build --outDir dist/${p} --emptyOutDir`, {
    cwd: root, stdio: 'inherit', env: { ...process.env, VITE_PORTAL: p },
  });
  const dir = join(root, 'dist', p);
  const out = join(root, 'dist', `kule-${p}.zip`);
  zip(dir, out);
  const raw = walk(dir).reduce((s, f) => s + statSync(f).size, 0);
  summary.push(`${p.padEnd(11)} folder ${kb(raw).padStart(11)}  zip ${kb(statSync(out).size).padStart(11)}  ${relative(root, out)}`);
}
console.log('\n' + summary.join('\n'));
