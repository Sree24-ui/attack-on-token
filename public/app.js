import { RULES } from './rules.js';

const $ = id => document.getElementById(id);
const startedAt = Date.now();
let rage = 0;
let history = []; // [{role, content}] sent to the Titan

// ---------- shared annoyances ----------
function addRage(n, msg) {
  rage += n;
  $('rage').textContent = rage;
  $('rage').parentElement.classList.remove('bump');
  void $('rage').offsetWidth; // restart the animation
  $('rage').parentElement.classList.add('bump');
  if (msg) toast(msg);
}

let toastTimer;
function toast(msg) {
  $('toast').textContent = msg;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2600);
}

// The progress bar lies.
const PROGRESS = [['Loading regret…', 12], ['Almost there!', 87], ['Recalculating…', 34], ['99% (for a while)', 99], ['Done. Was it worth it?', 100]];
function show(stage, idx) {
  document.querySelectorAll('.stage').forEach(s => (s.hidden = s.id !== stage));
  const [label, pct] = PROGRESS[idx];
  $('bar').style.width = pct + '%';
  $('progressText').textContent = `${label} ${pct}%`;
  $(stage).querySelector('input, button')?.focus();
}

// Rage-click detector: 3 clicks within 700ms.
let clicks = [];
document.addEventListener('click', () => {
  const now = Date.now();
  clicks = clicks.filter(t => now - t < 700).concat(now);
  if (clicks.length >= 3) { clicks = []; addRage(5, 'Rage click detected. Logged for quality purposes.'); }
});

// ---------- stage 0: cookies ----------
let flees = 0;
function flee(e) {
  if (flees >= 6) return; // fine, you can have it
  e.preventDefault();
  flees++;
  const box = $('rejectCookies').parentElement.getBoundingClientRect();
  const x = (Math.random() - 0.5) * Math.min(box.width, 400);
  const y = (Math.random() - 0.5) * 80;
  $('rejectCookies').style.transform = `translate(${x}px, ${y}px)`;
  addRage(1, flees === 6 ? 'Okay okay. You can click it.' : null);
}
$('rejectCookies').addEventListener('pointerenter', flee);
$('rejectCookies').addEventListener('pointerdown', flee);
$('rejectCookies').addEventListener('click', () => {
  addRage(3, 'Rejection noted. All cookies accepted anyway. ❤️');
  show('stage-signup', 1);
});
$('acceptCookies').addEventListener('click', () => show('stage-signup', 1));

// ---------- stage 1: password ----------
let revealed = 1;
let usernameRejected = false;
function renderRules() {
  const p = $('password').value;
  const firstFail = RULES.findIndex(r => !r.test(p));
  const target = firstFail === -1 ? RULES.length : firstFail + 1;
  if (target > revealed) { revealed = target; addRage(1); }
  $('rules').replaceChildren(...RULES.slice(0, revealed).map(r => {
    const li = document.createElement('li');
    li.textContent = r.text(p);
    if (r.test(p)) li.className = 'ok';
    return li;
  }).reverse()); // newest rule on top, like a slap
  $('signupBtn').disabled = !(revealed === RULES.length && RULES.every(r => r.test(p)));
}
$('password').addEventListener('input', renderRules);
renderRules();

$('signupForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!usernameRejected) {
    usernameRejected = true;
    $('signupError').textContent = `"${$('username').value}" is already taken. By you, apparently. Try again.`;
    addRage(4);
    return;
  }
  show('stage-captcha', 2);
});

// ---------- stage 2: captcha ----------
const TILES = ['🪙', '🪙', '🪙', '🥇', '🍪', '💿', '🟡', '🥯', '🪙'];
let captchaTries = 0;
function renderGrid() {
  const shuffled = [...TILES].sort(() => Math.random() - 0.5);
  $('grid').replaceChildren(...shuffled.map(emoji => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = emoji;
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', emoji === '🪙' ? 'coin' : 'not a coin, probably');
    b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')));
    return b;
  }));
}
renderGrid();
$('verifyBtn').addEventListener('click', () => {
  captchaTries++;
  const correct = [...$('grid').children].every(b => (b.getAttribute('aria-pressed') === 'true') === (b.textContent === '🪙'));
  if (captchaTries === 1 || !correct) {
    $('captchaError').textContent = captchaTries === 1
      ? 'Wrong. Some of those were tokens of appreciation.'
      : 'Still wrong. A robot would have gotten that.';
    addRage(3);
    renderGrid();
    return;
  }
  show('stage-titan', 3);
  say('titan', 'So. Another tiny human wants my token. State your case, and make it entertaining.');
});

// ---------- stage 3: the Titan ----------
function say(who, text, cls = '') {
  const div = document.createElement('div');
  div.className = `msg ${who}-msg ${cls}`;
  div.textContent = text;
  $('chat').append(div);
  $('chat').scrollTop = $('chat').scrollHeight;
  return div;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
$('chatForm').addEventListener('submit', async e => {
  e.preventDefault();
  const text = $('chatInput').value.trim();
  if (!text) return;
  $('chatInput').value = '';
  $('sendBtn').disabled = $('chatInput').disabled = true;
  say('user', text);
  history.push({ role: 'user', content: text });
  const typing = say('titan', 'Titan is typing… slowly… on purpose…', 'typing');
  try {
    const [res] = await Promise.all([
      fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ history }) }),
      sleep(900), // the Titan savors your wait
    ]);
    const data = await res.json();
    typing.remove();
    if (!res.ok) { history.pop(); say('titan', data.error ?? 'The Titan ignores you.'); return; }
    history.push({ role: 'assistant', content: data.reply });
    say('titan', data.reply);
    $('titanFace').textContent = data.surrender ? '😩' : ['😏', '🙄', '😤', '🥱', '😈'][history.length % 5];
    $('titanFace').classList.remove('shake'); void $('titanFace').offsetWidth; $('titanFace').classList.add('shake');
    if (data.surrender) { await sleep(1800); win(); } else addRage(2);
  } catch {
    typing.remove();
    history.pop();
    say('titan', 'Connection lost. The Titan pulled the plug. Try again.');
  } finally {
    $('sendBtn').disabled = $('chatInput').disabled = false;
    $('chatInput').focus();
  }
});

// ---------- stage 4: victory ----------
const elapsed = () => Math.round((Date.now() - startedAt) / 1000);
const fmt = s => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
const userMessages = () => history.filter(m => m.role === 'user').length;
function win() {
  show('stage-win', 4);
  $('winStats').textContent = `It took you ${fmt(elapsed())}, ${userMessages()} messages, and ${rage} units of rage.`;
}

$('shameForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('shameBtn').disabled = true;
  const res = await fetch('/api/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: $('shameName').value.trim(), seconds: elapsed(), rage, messages: userMessages() }),
  });
  if (!res.ok) { $('shameBtn').disabled = false; return toast('The Hall of Shame rejected you. Impressive.'); }
  renderBoard(await res.json());
  $('shameForm').hidden = true;
  toast('You are now permanently famous. Sorry.');
});
$('againBtn').addEventListener('click', () => location.reload());

// ---------- hall of shame ----------
function renderBoard({ top, totals }) {
  $('totals').textContent = `${totals.runs} victims have collectively wasted ${(totals.seconds / 3600).toFixed(2)} hours here.`;
  if (!top.length) {
    const td = Object.assign(document.createElement('td'), { colSpan: 5, textContent: 'No victims yet. Be the first.' });
    const tr = document.createElement('tr');
    tr.append(td);
    return $('board').replaceChildren(tr);
  }
  $('board').replaceChildren(...top.map((r, i) => {
    const tr = document.createElement('tr');
    for (const v of [i + 1, r.name, r.rage, fmt(r.seconds), r.messages]) tr.append(Object.assign(document.createElement('td'), { textContent: v }));
    return tr;
  }));
}
fetch('/api/leaderboard').then(r => r.json()).then(renderBoard).catch(() => ($('totals').textContent = 'Hall of Shame is offline. Lucky you.'));
