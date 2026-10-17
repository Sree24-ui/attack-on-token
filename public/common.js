// Shared by both pages: session state, rage meter, toasts, rage-click detector.
export const $ = id => document.getElementById(id);
export const sleep = ms => new Promise(r => setTimeout(r, ms));

const KEY = 'aot-session';
function load() {
  try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; }
}
export const state = load() ?? { rage: 0, startedAt: Date.now(), username: null, events: [], chat: [], captchaPassed: false, won: false, submitted: false };
export function persist() {
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: state lives for this page only */ }
}
export function clearSession() {
  try { sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

const changed = () => document.dispatchEvent(new Event('aot:change'));

export function logEvent(text) {
  state.events = [{ text, at: Date.now() }, ...state.events].slice(0, 30);
  persist();
  changed();
}

function paintRage(bump) {
  document.querySelectorAll('[data-rage]').forEach(el => {
    el.textContent = state.rage;
    if (!bump) return;
    el.classList.remove('bump');
    void el.offsetWidth; // restart the animation
    el.classList.add('bump');
  });
}

export function addRage(n, msg) {
  state.rage += n;
  persist();
  paintRage(true);
  if (msg) toast(msg);
  changed();
}

let toastTimer;
export function toast(msg) {
  $('toast').textContent = msg;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2800);
}

// A progress bar that lies: steps are [label, percent, ms].
export async function fakeProgress(bar, label, steps) {
  for (const [text, pct, ms] of steps) {
    label.textContent = `${text} ${pct}%`;
    bar.style.transform = `scaleX(${pct / 100})`;
    await sleep(ms);
  }
}

export const fmt = s => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
export const elapsed = () => Math.round((Date.now() - state.startedAt) / 1000);

// Rage-click detector: 3 clicks within 700ms.
let clicks = [];
document.addEventListener('click', () => {
  const now = Date.now();
  clicks = clicks.filter(t => now - t < 700).concat(now);
  if (clicks.length >= 3) { clicks = []; addRage(5, 'Rage click detected. Logged for quality purposes.'); }
});

paintRage(false);

// ---------- popup notifications (non-blocking, stack top-right; max 3, or 1 on phones) ----------
export function notify({ title, body, actions = [], onDismiss }) {
  let stack = document.querySelector('.notif-stack');
  if (!stack) {
    stack = Object.assign(document.createElement('div'), { className: 'notif-stack' });
    stack.setAttribute('aria-live', 'polite');
    document.body.append(stack);
  }
  const max = matchMedia('(max-width: 560px)').matches ? 1 : 3; // one at a time on phones
  while (stack.children.length >= max) stack.firstElementChild.remove();
  const card = document.createElement('div');
  card.className = 'notif';
  const text = document.createElement('div');
  text.className = 'notif-body';
  text.append(Object.assign(document.createElement('b'), { textContent: title }), Object.assign(document.createElement('p'), { textContent: body }));
  const row = document.createElement('div');
  row.className = 'notif-actions';
  for (const a of actions) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: `btn sm${a.primary ? ' primary' : ''}`, textContent: a.label });
    b.addEventListener('click', () => { card.remove(); a.run?.(); });
    row.append(b);
  }
  const x = Object.assign(document.createElement('button'), { type: 'button', className: 'notif-x', textContent: '×' });
  x.setAttribute('aria-label', `Dismiss: ${title}`);
  x.addEventListener('click', () => { card.remove(); onDismiss?.(); });
  card.append(text, x);
  if (actions.length) card.append(row);
  stack.append(card);
  return card;
}

// ---------- blocking "system" alerts: resolves with the chosen button's value ----------
// Buttons: {label, value, primary, faded, escape}. `escape` marks the option that moves the user along.
export const dialogOpen = () => !!document.querySelector('dialog[open]');
export function systemAlert({ title, body, buttons, onOpen }) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'modal sys-alert';
    const p = Object.assign(document.createElement('p'), { className: 'muted', textContent: body });
    const row = Object.assign(document.createElement('div'), { className: 'modal-actions' });
    const finish = value => { if (!d.open) return; d.close(); d.remove(); resolve(value); };
    for (const b of buttons) {
      const btn = Object.assign(document.createElement('button'), { type: 'button', className: `btn${b.primary ? ' primary' : ''}${b.faded ? ' faded' : ''}`, textContent: b.label });
      if (b.escape) btn.dataset.escape = '';
      btn.addEventListener('click', () => finish(b.value));
      row.append(btn);
    }
    d.append(Object.assign(document.createElement('h2'), { textContent: title }), p, row);
    d.addEventListener('cancel', e => e.preventDefault()); // Esc won't save you
    document.body.append(d);
    d.showModal();
    onOpen?.({ setBody: t => (p.textContent = t), finish });
  });
}

// Run fn when no other dialog is open, retrying every few seconds.
export function whenIdle(fn) {
  if (dialogOpen()) return setTimeout(() => whenIdle(fn), 4000);
  fn();
}

// ---------- shaking buttons: a random primary button jitters "for attention" ----------
setInterval(() => {
  const btns = [...document.querySelectorAll('.btn.primary')].filter(b => b.offsetParent && !b.closest('dialog:not([open])'));
  const b = btns[Math.floor(Math.random() * btns.length)];
  if (!b) return;
  b.classList.remove('jitter');
  void b.offsetWidth;
  b.classList.add('jitter');
}, 7000);
