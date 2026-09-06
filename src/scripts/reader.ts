/**
 * The reading edition's apparatus: running head, rail, ribbon, resume,
 * reading settings, and the contents dialog. One scroll listener on rAF,
 * offsets recomputed on resize; no polling.
 */

interface ChapterData { slug: string; text: string; index: number }
interface SavedPosition { y: number; id?: string; pct: number; at: number }

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

function init() {
  const edition = document.getElementById('edition');
  if (!edition) return;

  const slug = edition.dataset.slug!;
  const readingMinutes = Number(edition.dataset.readingMinutes || 0);
  const text = document.getElementById('edition-text')!;
  const runningHead = document.getElementById('running-head')!;
  const rhChapter = document.getElementById('rh-chapter')!;
  const rhPct = document.getElementById('rh-pct')!;
  const rail = document.getElementById('rail');
  const railProgress = document.getElementById('rail-progress');
  const railRibbon = document.getElementById('rail-ribbon');
  const chapters: ChapterData[] = JSON.parse(document.getElementById('chapters-data')?.textContent || '[]');

  /* ---------- Chapter elements and numbering ---------- */
  const headings = chapters
    .map((c) => ({ ...c, el: document.getElementById(c.slug) }))
    .filter((c): c is ChapterData & { el: HTMLElement } => !!c.el);
  headings.forEach((c) => { c.el.dataset.chapter = String(c.index); });

  // The opening heading that repeats the work's title becomes a half-title.
  const first = text.querySelector('h2');
  const title = (edition.dataset.title || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (first && !first.dataset.chapter && (first.textContent || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === title) {
    first.setAttribute('data-half-title', '');
  }

  /* ---------- Mobile edge rail (built here so the layout stays static) ---------- */
  const edge = document.createElement('div');
  edge.className = 'edge-rail';
  edge.setAttribute('aria-hidden', 'true');
  const edgeProgress = document.createElement('div');
  edgeProgress.className = 'edge-rail-progress';
  const edgeRibbon = document.createElement('div');
  edgeRibbon.className = 'edge-rail-ribbon';
  edgeRibbon.hidden = true;
  edge.append(edgeProgress, edgeRibbon);
  edition.append(edge);

  /* ---------- Geometry ---------- */
  let textTop = 0;
  let textHeight = 1;
  let offsets: number[] = [];
  const ticks = rail ? Array.from(rail.querySelectorAll<HTMLAnchorElement>('.tick')) : [];

  function measure() {
    const rect = text.getBoundingClientRect();
    textTop = rect.top + window.scrollY;
    textHeight = Math.max(1, text.offsetHeight);
    offsets = headings.map((c) => c.el.getBoundingClientRect().top + window.scrollY);
    ticks.forEach((tick, i) => {
      const y = Math.min(99.5, Math.max(0.5, ((offsets[i] - textTop) / textHeight) * 100));
      tick.style.setProperty('--y', `${y.toFixed(2)}%`);
    });
    placeRibbon();
  }

  /* ---------- Position, progress, running head ---------- */
  const readLineOffset = () => runningHead.offsetHeight + Math.min(160, window.innerHeight * 0.25);
  let currentIndex = -1;
  let lastPct = -1;

  function chapterAt(readLine: number): number {
    let lo = 0, hi = offsets.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid] <= readLine) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return found;
  }

  function update() {
    const readLine = window.scrollY + readLineOffset();
    const pct = Math.min(100, Math.max(0, ((readLine - textTop) / textHeight) * 100));
    const rounded = Math.round(pct);
    if (rounded !== lastPct) {
      lastPct = rounded;
      rhPct.textContent = `${rounded}%`;
      const remaining = Math.max(0, Math.round(readingMinutes * (1 - pct / 100)));
      rhPct.title = remaining > 0 ? `${remaining} min left` : 'Finished';
      if (railProgress) railProgress.style.transform = `scaleY(${(pct / 100).toFixed(4)})`;
      edgeProgress.style.transform = `scaleY(${(pct / 100).toFixed(4)})`;
    }
    const idx = chapterAt(readLine);
    if (idx !== currentIndex) {
      currentIndex = idx;
      rhChapter.textContent = idx >= 0 ? headings[idx].text : '';
      ticks.forEach((tick, i) => {
        tick.classList.toggle('is-past', i < idx);
        tick.classList.toggle('is-current', i === idx);
      });
      document.querySelectorAll<HTMLAnchorElement>('.dialog-list a').forEach((a, i) => {
        a.classList.toggle('is-current', i === idx);
      });
    }
    scheduleSave(pct, idx);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }

  /* ---------- Saved position and the ribbon ---------- */
  const key = `mc-pos-${slug}`;
  let saved: SavedPosition | null = null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) saved = JSON.parse(raw);
    else {
      // Migrate the previous site's key (a bare scroll offset).
      const legacy = localStorage.getItem(`reading-position-${slug}`);
      if (legacy) saved = { y: parseInt(legacy, 10), pct: 0, at: Date.now() };
    }
  } catch { saved = null; }

  let saveTimer: number | undefined;
  function scheduleSave(pct: number, idx: number) {
    if (saveTimer) return;
    saveTimer = window.setTimeout(() => {
      saveTimer = undefined;
      try {
        localStorage.setItem(key, JSON.stringify({
          y: Math.round(window.scrollY),
          id: idx >= 0 ? headings[idx].slug : undefined,
          pct: Math.round(pct * 10) / 10,
          at: Date.now(),
        } satisfies SavedPosition));
      } catch { /* storage unavailable */ }
    }, 1200);
  }

  function placeRibbon() {
    if (!saved || saved.y < 240) return;
    const pct = saved.pct > 0 ? saved.pct : Math.min(100, Math.max(0, ((saved.y + readLineOffset() - textTop) / textHeight) * 100));
    if (railRibbon) { railRibbon.style.setProperty('--y', `${pct.toFixed(2)}%`); railRibbon.hidden = false; }
    edgeRibbon.style.top = `${pct.toFixed(2)}%`;
    edgeRibbon.hidden = false;
  }

  function offerResume() {
    if (!saved || saved.y < 240 || location.hash) return;
    const start = document.getElementById('start-reading') as HTMLAnchorElement | null;
    const resume = document.getElementById('resume-reading') as HTMLAnchorElement | null;
    const where = document.getElementById('resume-where');
    if (!start || !resume) return;
    const chapter = saved.id ? headings.find((h) => h.slug === saved!.id) : undefined;
    if (where) where.textContent = chapter ? chapter.text : `${Math.round(saved.pct)}%`;
    resume.hidden = false;
    start.classList.remove('action-primary');
    start.textContent = 'Start from the beginning';
    resume.addEventListener('click', (event) => {
      event.preventDefault();
      const target = saved!.y;
      window.scrollTo({ top: target, behavior: REDUCED.matches ? 'auto' : 'smooth' });
      if (railRibbon && !REDUCED.matches) {
        railRibbon.classList.remove('is-settling');
        void railRibbon.offsetWidth;
        railRibbon.classList.add('is-settling');
      }
    });
  }

  /* ---------- Reading settings ---------- */
  const root = document.documentElement;
  const menu = document.getElementById('reader-menu')!;
  const menuButton = document.getElementById('menu-button')!;

  function syncPressed() {
    const size = root.getAttribute('data-reader-size') || 'medium';
    const leading = root.getAttribute('data-reader-leading') || 'normal';
    const theme = root.getAttribute('data-theme') || 'light';
    menu.querySelectorAll<HTMLButtonElement>('[data-size]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === size)));
    menu.querySelectorAll<HTMLButtonElement>('[data-leading]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.leading === leading)));
    menu.querySelectorAll<HTMLButtonElement>('[data-set-theme]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === theme)));
    const focus = menu.querySelector<HTMLInputElement>('#focus-toggle');
    if (focus) focus.checked = root.getAttribute('data-focus') === 'true';
  }

  function setPref(attr: string, storageKey: string, value: string) {
    root.setAttribute(attr, value);
    try { localStorage.setItem(storageKey, value); } catch { /* ignore */ }
    syncPressed();
    requestAnimationFrame(() => { measure(); update(); });
  }

  menu.querySelectorAll<HTMLButtonElement>('[data-size]').forEach((b) => b.addEventListener('click', () => setPref('data-reader-size', 'mc-size', b.dataset.size!)));
  menu.querySelectorAll<HTMLButtonElement>('[data-leading]').forEach((b) => b.addEventListener('click', () => setPref('data-reader-leading', 'mc-leading', b.dataset.leading!)));
  menu.querySelectorAll<HTMLButtonElement>('[data-set-theme]').forEach((b) => b.addEventListener('click', () => {
    setPref('data-theme', 'mc-theme', b.dataset.setTheme!);
    document.dispatchEvent(new CustomEvent('mc:theme', { detail: b.dataset.setTheme }));
  }));
  document.addEventListener('mc:theme', syncPressed);
  menu.querySelector<HTMLInputElement>('#focus-toggle')?.addEventListener('change', (event) => {
    const on = (event.target as HTMLInputElement).checked;
    if (on) root.setAttribute('data-focus', 'true'); else root.removeAttribute('data-focus');
    try { localStorage.setItem('mc-focus', String(on)); } catch { /* ignore */ }
    requestAnimationFrame(() => { measure(); update(); });
  });

  function openMenu(open: boolean) {
    menu.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    if (open) syncPressed();
  }
  menuButton.addEventListener('click', () => openMenu(menu.hidden));
  document.addEventListener('click', (event) => {
    if (menu.hidden) return;
    const target = event.target as Node;
    if (!menu.contains(target) && !menuButton.contains(target)) openMenu(false);
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !menu.hidden) openMenu(false); });
  syncPressed();

  /* ---------- Contents dialog ---------- */
  const dialog = document.getElementById('contents-dialog') as HTMLDialogElement | null;
  if (dialog) {
    const open = () => {
      dialog.showModal();
      dialog.querySelector<HTMLAnchorElement>('.dialog-list a.is-current')?.scrollIntoView({ block: 'center' });
    };
    document.getElementById('rh-title')?.addEventListener('click', open);
    document.getElementById('contents-button')?.addEventListener('click', open);
    document.getElementById('contents-close')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialog.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => dialog.close()));
  }

  /* ---------- Wire up ---------- */
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measure(); update(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); update(); }).observe(text);
  document.fonts?.ready.then(() => { measure(); update(); });
  measure();
  update();
  offerResume();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
