// DOM overlays (popups / menus). Tracks whether any overlay is open.
export class Overlays {
  private openCount = 0;
  onChange: (anyOpen: boolean) => void = () => {};

  constructor(private root: HTMLElement) {}

  get anyOpen(): boolean {
    return this.openCount > 0;
  }

  /** Shows a modal card. Returns a close function (idempotent). */
  open(build: (card: HTMLElement, close: () => void) => void, cls = ''): () => void {
    const backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    const card = document.createElement('div');
    card.className = 'card ' + cls;
    backdrop.appendChild(card);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      backdrop.classList.add('out');
      setTimeout(() => backdrop.remove(), 160);
      this.openCount--;
      this.onChange(this.anyOpen);
    };
    build(card, close);
    this.root.appendChild(backdrop);
    this.openCount++;
    this.onChange(this.anyOpen);
    return close;
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  html = '',
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

/** Button that fires once on pointerup/click, works for mouse and touch. */
export function button(cls: string, html: string, parent: HTMLElement, onClick: () => void): HTMLButtonElement {
  const b = el('button', 'btn ' + cls, html, parent);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (b.disabled) return;
    onClick();
  });
  return b;
}
