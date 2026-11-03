import { W, H, rr } from './render';
export interface Btn { x: number; y: number; w: number; h: number; cb: () => void; }
export let buttons: Btn[] = [];
export const resetButtons = () => { buttons = []; };
export const FONT = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';

export function text(c: CanvasRenderingContext2D, s: string | number, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center', stroke = true) {
  c.font = `800 ${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle';
  if (stroke) { c.lineWidth = Math.max(3, size / 6); c.strokeStyle = 'rgba(10,12,24,.85)'; c.lineJoin = 'round'; c.strokeText(String(s), x, y); }
  c.fillStyle = color; c.fillText(String(s), x, y);
}
/** One panel style for every overlay (pause, result, garage, daily, briefing). */
export function panel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  rr(c, x, y + 8, w, h, 28); c.fillStyle = 'rgba(0,0,0,.35)'; c.fill();
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(30,38,64,.96)'); g.addColorStop(1, 'rgba(14,18,34,.96)');
  rr(c, x, y, w, h, 28); c.fillStyle = g; c.fill(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.16)'; c.stroke();
  c.strokeStyle = 'rgba(255,138,61,.85)'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 40, y + 2); c.lineTo(x + w - 40, y + 2); c.stroke();
}
export type Tone = 'green' | 'amber' | 'blue' | 'gray' | 'red';
const TONES: Record<Tone, [string, string]> = { green: ['#5ee06a', '#1f9a3a'], amber: ['#ffc247', '#d4780a'], blue: ['#5ab4ff', '#2260c4'], gray: ['#7b8499', '#454c60'], red: ['#ff6b5e', '#b42318'] };
export function button(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tone: Tone, cb: () => void, draw: (cx: number, cy: number) => void, pulse = false) {
  const k = pulse ? 1 + 0.04 * Math.sin(performance.now() / 180) : 1, cx = x + w / 2, cy = y + h / 2;
  c.save(); c.translate(cx, cy); c.scale(k, k); c.translate(-cx, -cy);
  rr(c, x, y + 6, w, h, 22); c.fillStyle = 'rgba(0,0,0,.35)'; c.fill();
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, TONES[tone][0]); g.addColorStop(1, TONES[tone][1]);
  rr(c, x, y, w, h, 22); c.fillStyle = g; c.fill(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
  draw(cx, cy); c.restore();
  buttons.push({ x, y, w, h, cb });
}
export function hit(px: number, py: number): boolean {
  for (let i = buttons.length - 1; i >= 0; i--) { const b = buttons[i]; if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) { b.cb(); return true; } }
  return false;
}
export function overButton(px: number, py: number) { return buttons.some(b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h); }

export type Icon = 'play' | 'retry' | 'next' | 'garage' | 'map' | 'clapper' | 'coin' | 'star' | 'starOff' | 'battery' | 'crate' | 'shield' | 'bolt' | 'slime' | 'meteor' | 'ufo' | 'sound' | 'soundOff' | 'gift' | 'lock' | 'pause' | 'check' | 'left' | 'right' | 'back' | 'engine' | 'suspension' | 'tires' | 'bed' | 'bumper' | 'flip' | 'inf' | 'plus' | 'x2' | 'home' | 'flag' | 'glassCrate' | 'brakeIc' | 'gasIc' | 'turboIc';
export function icon(c: CanvasRenderingContext2D, n: Icon, x: number, y: number, s: number, col = '#fff') {
  c.save(); c.translate(x, y); c.scale(s / 40, s / 40); c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round';
  const P = (d: string, fill = true) => { const p = new Path2D(d); fill ? c.fill(p) : c.stroke(p); };
  switch (n) {
    case 'play': P('M-12 -18 L18 0 L-12 18 Z'); break;
    case 'next': P('M-16 -16 L6 0 L-16 16 Z'); P('M8 -16 L16 -16 L16 16 L8 16 Z'); break;
    case 'retry': c.beginPath(); c.arc(0, 0, 14, -2.6, 2.6 + 0.4); c.stroke(); P('M-18 -16 L-6 -22 L-6 -6 Z'); break;
    case 'back': P('M-6 -2 L12 -2 M-6 -2 L2 -12 M-6 -2 L2 8', false); P('M-14 0 L2 -16 L2 16 Z'); break;
    case 'left': P('M12 -18 L-12 0 L12 18 Z'); break;
    case 'right': P('M-12 -18 L12 0 L-12 18 Z'); break;
    case 'home': P('M-18 2 L0 -16 L18 2 L12 2 L12 16 L-12 16 L-12 2 Z'); break;
    case 'garage': c.beginPath(); c.arc(0, 0, 11, 0, 7); c.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); c.lineTo(Math.cos(a) * 19, Math.sin(a) * 19); c.stroke(); } c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill(); break;
    case 'map': P('M0 -18 C-12 -18 -14 -4 0 16 C14 -4 12 -18 0 -18 Z'); c.fillStyle = '#222'; c.beginPath(); c.arc(0, -8, 5, 0, 7); c.fill(); break;
    case 'clapper': rr(c, -18, -6, 36, 22, 4); c.fill(); c.fillStyle = '#222'; for (let i = 0; i < 4; i++) c.fillRect(-16 + i * 9, -16, 5, 9); c.fillStyle = col; c.fillRect(-18, -16, 36, 8); c.fillStyle = '#222'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-16 + i * 9, -16); c.lineTo(-10 + i * 9, -16); c.lineTo(-14 + i * 9, -8); c.lineTo(-20 + i * 9, -8); c.fill(); } break;
    case 'coin': c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(0, 0, 16, 0, 7); c.fill(); c.strokeStyle = '#b8860b'; c.lineWidth = 4; c.stroke(); c.fillStyle = '#b8860b'; c.fillRect(-3, -9, 6, 18); break;
    case 'star': case 'starOff': { c.fillStyle = n === 'star' ? '#ffd23a' : 'rgba(255,255,255,.2)'; c.strokeStyle = n === 'star' ? '#b8860b' : 'rgba(255,255,255,.35)'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 8 : 19, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke(); break; }
    case 'battery': rr(c, -18, -10, 32, 20, 4); c.stroke(); c.fillRect(14, -5, 5, 10); c.fillRect(-14, -6, 22, 12); break;
    case 'crate': c.fillStyle = '#d9964b'; c.fillRect(-14, -14, 28, 28); c.strokeStyle = '#6b3d17'; c.lineWidth = 3; c.strokeRect(-14, -14, 28, 28); c.beginPath(); c.moveTo(-14, -14); c.lineTo(14, 14); c.moveTo(14, -14); c.lineTo(-14, 14); c.stroke(); break;
    case 'shield': P('M0 -18 L16 -11 L14 6 C12 12 6 16 0 19 C-6 16 -12 12 -14 6 L-16 -11 Z'); break;
    case 'bolt': P('M4 -20 L-12 4 L-1 4 L-5 20 L13 -6 L2 -6 Z'); break;
    case 'slime': c.fillStyle = '#5be35b'; c.beginPath(); c.ellipse(0, 4, 17, 13, 0, Math.PI, 0); c.lineTo(17, 4); c.lineTo(-17, 4); c.fill(); c.fillStyle = '#10300f'; c.beginPath(); c.arc(-6, 0, 3, 0, 7); c.arc(6, 0, 3, 0, 7); c.fill(); break;
    case 'meteor': c.fillStyle = '#ff9a2e'; c.beginPath(); c.moveTo(-18, -18); c.lineTo(4, -2); c.lineTo(-2, 4); c.fill(); c.fillStyle = '#7a665a'; c.beginPath(); c.arc(7, 7, 11, 0, 7); c.fill(); break;
    case 'ufo': c.fillStyle = '#9aa6bd'; c.beginPath(); c.ellipse(0, 4, 19, 7, 0, 0, 7); c.fill(); c.fillStyle = '#82e6ff'; c.beginPath(); c.ellipse(0, 0, 9, 9, 0, Math.PI, 0); c.fill(); break;
    case 'sound': P('M-16 -6 L-8 -6 L2 -14 L2 14 L-8 6 L-16 6 Z'); c.beginPath(); c.arc(4, 0, 8, -1, 1); c.stroke(); c.beginPath(); c.arc(4, 0, 15, -0.9, 0.9); c.stroke(); break;
    case 'soundOff': P('M-16 -6 L-8 -6 L2 -14 L2 14 L-8 6 L-16 6 Z'); c.beginPath(); c.moveTo(8, -8); c.lineTo(20, 8); c.moveTo(20, -8); c.lineTo(8, 8); c.stroke(); break;
    case 'gift': c.fillStyle = '#ff5a7a'; c.fillRect(-16, -4, 32, 20); c.fillStyle = '#ffd23a'; c.fillRect(-3, -4, 6, 20); c.fillRect(-18, -10, 36, 7); c.beginPath(); c.arc(-6, -14, 6, 0, 7); c.arc(6, -14, 6, 0, 7); c.stroke(); break;
    case 'lock': rr(c, -12, -2, 24, 18, 3); c.fill(); c.beginPath(); c.arc(0, -4, 8, Math.PI, 0); c.stroke(); break;
    case 'pause': c.fillRect(-12, -15, 8, 30); c.fillRect(4, -15, 8, 30); break;
    case 'check': P('M-14 0 L-4 11 L15 -11', false); break;
    case 'plus': P('M-14 0 L14 0 M0 -14 L0 14', false); break;
    case 'x2': c.font = `900 30px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('x2', 0, 2); break;
    case 'flip': c.beginPath(); c.arc(0, 0, 13, -0.6, 4.2); c.stroke(); P('M12 -14 L22 -2 L6 -4 Z'); break;
    case 'inf': c.font = `900 44px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('∞', 0, 2); break;
    case 'engine': rr(c, -14, -8, 24, 20, 3); c.fill(); c.fillRect(-8, -16, 12, 7); c.fillRect(10, -2, 8, 8); c.fillRect(-18, -2, 4, 8); break;
    case 'suspension': c.beginPath(); c.moveTo(0, -18); for (let i = 0; i < 6; i++) c.lineTo(i % 2 ? -10 : 10, -14 + i * 6); c.lineTo(0, 18); c.stroke(); break;
    case 'tires': c.beginPath(); c.arc(0, 0, 15, 0, 7); c.lineWidth = 9; c.stroke(); c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.stroke(); break;
    case 'bed': c.fillRect(-18, 10, 36, 6); c.fillRect(-18, -14, 5, 24); c.fillRect(13, -4, 5, 14); c.fillStyle = '#d9964b'; c.fillRect(-8, -2, 14, 12); break;
    case 'flag': c.fillStyle = '#e9edf5'; c.fillRect(-14, -18, 4, 36); for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) { c.fillStyle = (r + k) % 2 ? '#1f2430' : '#fff'; c.fillRect(-10 + k * 7, -18 + r * 7, 7, 7); } break;
    case 'glassCrate': c.fillStyle = 'rgba(160,232,255,.55)'; c.fillRect(-14, -14, 28, 28); c.strokeStyle = '#5ab4e0'; c.lineWidth = 3; c.strokeRect(-14, -14, 28, 28); c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(-8, 6); c.lineTo(2, -8); c.stroke(); break;
    case 'brakeIc': P('M2 -14 L-12 0 L2 14 Z'); P('M16 -14 L2 0 L16 14 Z'); break;
    case 'gasIc': P('M-2 -14 L12 0 L-2 14 Z'); P('M-16 -14 L-2 0 L-16 14 Z'); break;
    case 'turboIc': c.fillStyle = '#ff9a2e'; P('M-18 0 C-6 -16 10 -10 18 0 C10 10 -6 16 -18 0 Z'); c.fillStyle = '#fff3b0'; P('M-6 0 C0 -6 8 -4 12 0 C8 4 0 6 -6 0 Z'); break;
    case 'bumper': P('M-18 -10 L18 -4 L18 8 L-18 14 Z'); c.fillStyle = '#222'; c.fillRect(-4, -6, 4, 14); break;
  }
  c.restore();
}
