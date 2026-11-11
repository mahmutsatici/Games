// Fits the 1280x720 logical stage into the window and keeps the canvas backing store crisp.
export const W = 1280;
export const H = 720;

export class View {
  scale = 1;
  pixelRatio = 1;
  portrait = false;
  private stage: HTMLElement;
  private canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  onResize: () => void = () => {};

  constructor(stage: HTMLElement, canvas: HTMLCanvasElement) {
    this.stage = stage;
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    const resize = () => this.resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 150));
    this.resize();
  }

  resize(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.portrait = coarse && vh > vw;
    document.body.classList.toggle('portrait', this.portrait);

    this.scale = Math.min(vw / W, vh / H);
    const ox = (vw - W * this.scale) / 2;
    const oy = (vh - H * this.scale) / 2;
    this.stage.style.transform = `translate(${ox}px, ${oy}px) scale(${this.scale})`;

    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.max(1, Math.round(W * this.scale * this.pixelRatio));
    const bh = Math.max(1, Math.round(H * this.scale * this.pixelRatio));
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    this.onResize();
  }

  /** Call at the start of each frame: maps logical units to backing pixels. */
  begin(): CanvasRenderingContext2D {
    const k = this.canvas.width / W;
    this.ctx.setTransform(k, 0, 0, k, 0, 0);
    return this.ctx;
  }

  /** Converts a client (page) coordinate to logical stage coordinates. */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.stage.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * W,
      y: ((clientY - r.top) / r.height) * H,
    };
  }
}
