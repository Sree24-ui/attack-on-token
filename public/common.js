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
