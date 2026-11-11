// Number formatting: 999, 1.23K, 45.6M, 7.89B, 1.2T, then aa, ab, ac ... zz.
const BASE = ['', 'K', 'M', 'B', 'T'];

function suffix(group: number): string {
  if (group < BASE.length) return BASE[group];
  const i = group - BASE.length; // 0 -> aa
  const a = 'abcdefghijklmnopqrstuvwxyz';
  return a[Math.floor(i / 26) % 26] + a[i % 26];
}

function trim(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + formatNumber(-n);
  if (n < 10) {
    const v = Math.floor(n * 10) / 10;
    return trim(v.toFixed(1));
  }
  if (n < 1000) return String(Math.floor(n));
  let group = Math.floor(Math.log10(n) / 3);
  let m = n / Math.pow(1000, group);
  if (m >= 1000) {
    // float edge case (e.g. 999999.9999)
    m /= 1000;
    group += 1;
  } else if (m < 1) {
    m *= 1000;
    group -= 1;
  }
  const d = m < 10 ? 2 : m < 100 ? 1 : 0;
  const p = Math.pow(10, d);
  const v = Math.floor(m * p + 1e-9) / p;
  return trim(v.toFixed(d)) + suffix(group);
}

/** mm:ss or h:mm:ss for timers. */
export function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return (h > 0 ? h + ':' : '') + mm + ':' + String(r).padStart(2, '0');
}
