import { $, state, persist, addRage, toast, logEvent, clearSession, sleep, fmt, elapsed, notify, systemAlert, whenIdle } from './common.js';

if (!state.username) location.replace('/'); // no session: back to the login portal

const userMessages = () => state.chat.filter(m => m.role === 'user').length;

// ---------- shell: tabs, drawer, popovers ----------
function showTab(tab) {
  document.querySelectorAll('.panel').forEach(p => (p.hidden = p.dataset.panel !== tab));
  document.querySelectorAll('.nav-item').forEach(b => b.toggleAttribute('aria-current', b.dataset.tab === tab));
  closeDrawer();
  closePopovers();
  if (tab === 'shame') loadBoard();
  if (tab === 'titan' && !$('chatForm').hidden) $('chatInput').focus();
}
// Every 4th sidebar click warns about unsaved changes that don't exist.
let navClicks = 0;
document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', async () => {
  if (++navClicks % 4 === 0) {
    const leave = await systemAlert({
      title: 'Unsaved changes',
      body: 'You have unsaved changes on this page. If you leave, they will be lost. (There are no changes.)',
      buttons: [{ label: 'Stay on page', value: false, primary: true }, { label: 'Leave anyway', value: true, escape: true }],
    });
    if (!leave) return addRage(2);
  }
  showTab(b.dataset.tab);
}));
document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.goto)));

function closeDrawer() {
  $('sidebar').classList.remove('open');
  $('backdrop').hidden = true;
  $('menuBtn').setAttribute('aria-expanded', false);
}
$('menuBtn').addEventListener('click', () => {
  $('sidebar').classList.add('open');
  $('backdrop').hidden = false;
  $('menuBtn').setAttribute('aria-expanded', true);
});
$('backdrop').addEventListener('click', closeDrawer);

const POPS = [['bellBtn', 'bellPop'], ['avatarBtn', 'avatarPop']];
function closePopovers(except) {
  for (const [btn, pop] of POPS) if (pop !== except) { $(pop).hidden = true; $(btn).setAttribute('aria-expanded', false); }
  if (except !== 'searchPop') $('searchPop').hidden = true;
}
for (const [btn, pop] of POPS) {
  $(btn).addEventListener('click', e => {
    e.stopPropagation();
    const open = $(pop).hidden;
    closePopovers(pop);
    $(pop).hidden = !open;
    $(btn).setAttribute('aria-expanded', open);
  });
}
document.addEventListener('click', e => { if (!e.target.closest('.popover')) closePopovers(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePopovers(); closeDrawer(); } });

// ---------- top bar ----------
document.querySelectorAll('.js-name').forEach(el => (el.textContent = state.username));
$('menuName').textContent = state.username;
$('avatarBtn').textContent = (state.username ?? '?').slice(0, 2).toUpperCase();
const h = new Date().getHours();
$('daypart').textContent = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';

$('searchForm').addEventListener('submit', e => {
  e.preventDefault();
  e.stopPropagation();
  const q = $('searchInput').value.trim();
  if (!q) return;
  const ask = Object.assign(document.createElement('button'), { type: 'button', className: 'btn sm', textContent: 'Ask the Titan' });
  ask.addEventListener('click', () => { showTab('titan'); $('chatInput').value = q; });
  const p = document.createElement('p');
  p.textContent = `No results for "${q}". Results are a premium feature.`;
  $('searchPop').replaceChildren(p, ask);
  $('searchPop').hidden = false;
  addRage(1);
});

$('markRead').addEventListener('click', e => {
  e.stopPropagation();
  $('bellDot').hidden = true;
  setTimeout(() => {
    $('bellDot').textContent = '1';
    $('bellDot').hidden = false;
    addRage(1, 'New notification: you have unread notifications.');
  }, 5000);
});

let leaving = false;
function signOut() {
  leaving = true;
  clearSession();
  location.href = '/';
}
addEventListener('beforeunload', e => { if (!leaving && !state.won) e.preventDefault(); }); // "Leave site?"

// Roach-motel sign-out: a double-negative, a mandatory survey, then a retention offer.
async function signOutFlow() {
  closePopovers();
  const first = await systemAlert({
    title: 'Cancel signing out?',
    body: 'Do you want to cancel signing out? Signing out cancels your place in the withdrawal queue (#48,213).',
    buttons: [{ label: 'Yes, cancel', value: 'stay', primary: true }, { label: "No, don't cancel", value: 'go', escape: true }],
  });
  if (first === 'stay') return addRage(2, 'Sign-out cancelled. You are still signed in. Probably.');
  const reason = await systemAlert({
    title: "We're sad to see you go 😢",
    body: 'Before you leave, please tell us why. This survey is mandatory.',
    buttons: [{ label: 'Too much rage', value: 'too much rage', escape: true }, { label: 'The Titan was mean', value: 'the Titan was mean' }, { label: 'I just want to leave', value: 'wanting to leave' }],
  });
  logEvent(`Exit survey submitted: ${reason}`);
  const offer = await systemAlert({
    title: 'Wait! A special offer just for you',
    body: 'Stay and get Titan Cloud Pro at 100% off: $0/month → $0/month. Includes all the same features.',
    buttons: [{ label: 'Claim offer and stay', value: 'stay', primary: true }, { label: 'Continue signing out', value: 'go', faded: true, escape: true }],
  });
  if (offer === 'stay') return toast('Offer claimed! Nothing has changed.');
  signOut();
}
$('signOutBtn').addEventListener('click', signOutFlow);
$('resetBtn').addEventListener('click', () => { if (confirm('Reset this session? Your progress and frustration will be lost. (The Titan will remember.)')) signOut(); });

$('upgradeBtn').addEventListener('click', () => addRage(2, 'Upgrading costs one token. You have 0 tokens.'));

document.querySelectorAll('[data-revert]').forEach(sw => sw.addEventListener('click', () => {
  sw.setAttribute('aria-checked', 'true');
  setTimeout(() => { sw.setAttribute('aria-checked', 'false'); addRage(1, sw.dataset.revert); }, 700);
}));

// ---------- overview ----------
const CHART = [1840, 2210, 1975, 2630, 2400, 3120, 2890];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
$('chart').replaceChildren(...CHART.map((v, i) => {
  const col = document.createElement('div');
  col.className = 'bar-col';
  col.title = `${DAYS[i]}: ${v.toLocaleString()} requested, 0 approved`;
  col.innerHTML = `<div class="bars"><i class="req" style="height:${(v / 3200) * 100}%"></i><i class="ok"></i></div><span>${DAYS[i]}</span>`;
  return col;
}));

function renderOverview() {
  const tokens = state.won ? 1 : 0;
  $('kpiTokens').textContent = `${tokens} / 1`;
  $('kpiTokensDelta').textContent = state.won ? 'Approved, somehow' : 'Pending Titan approval';
  $('kpiTokensDelta').classList.toggle('neg', !state.won);
  $('kpiRate').textContent = state.won ? `${(100 / Math.max(1, userMessages())).toFixed(1)}%` : '0.0%';
  $('planUsage').textContent = `${tokens} of 1`;
  $('planBar').style.transform = `scaleX(${tokens})`;
  $('vaultStatus').textContent = state.won ? 'Withdrawn' : 'Guarded by Titan';
  $('vaultStatus').classList.toggle('ok', state.won);
  $('activity').replaceChildren(...state.events.map(ev => {
    const li = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = new Date(ev.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    li.append(document.createTextNode(ev.text), time);
    return li;
  }));
  if (!state.events.length) $('activity').innerHTML = '<li class="fine">No activity. Suspiciously quiet.</li>';
}
document.addEventListener('aot:change', renderOverview);
$('clearActivity').addEventListener('click', () => {
  state.events = [];
  logEvent('Activity log cleared (this entry cannot be cleared)');
});
setInterval(() => ($('kpiTime').textContent = fmt(elapsed())), 1000);
$('kpiTime').textContent = fmt(elapsed());

// ---------- withdraw: CAPTCHA modal, then the Titan ----------
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

function withdraw() {
  if (state.won) return addRage(1, "You already withdrew the token. It's right there. Look at it.");
  if (state.captchaPassed) return showTab('titan');
  renderGrid();
  $('captchaError').textContent = '';
  $('captchaModal').showModal();
}
document.querySelectorAll('[data-action="withdraw"]').forEach(b => b.addEventListener('click', withdraw));
$('captchaCancel').addEventListener('click', () => $('captchaModal').close());

$('verifyBtn').addEventListener('click', () => {
  captchaTries++;
  const correct = [...$('grid').children].every(b => (b.getAttribute('aria-pressed') === 'true') === (b.textContent === '🪙'));
  if (captchaTries === 1 || !correct) {
    $('captchaError').textContent = captchaTries === 1 ? 'Wrong. Some of those were tokens of appreciation.' : 'Still wrong. A robot would have gotten that.';
    addRage(3);
    renderGrid();
    return;
  }
  $('captchaModal').close();
  state.captchaPassed = true;
  logEvent(`Identity verified after ${captchaTries} attempts`);
  renderChatLock();
  showTab('titan');
  if (!state.chat.length) say('titan', 'So. Another tiny human wants my token. State your case, and make it entertaining.');
});

// ---------- Titan chat ----------
function say(who, text, cls = '') {
  const div = document.createElement('div');
  div.className = `msg ${who}-msg ${cls}`;
  div.textContent = text;
  $('chat').append(div);
  $('chat').scrollTop = $('chat').scrollHeight;
  return div;
}
function renderChatLock() {
  $('chatLocked').hidden = state.captchaPassed;
  $('chatForm').hidden = !state.captchaPassed;
}
renderChatLock();
if (state.captchaPassed) say('titan', 'So. Another tiny human wants my token. State your case, and make it entertaining.');
for (const m of state.chat) say(m.role === 'user' ? 'user' : 'titan', m.content);

function setMode(source, model) {
  const live = source === 'claude';
  $('aiBadge').textContent = live ? 'AI: Live' : 'AI: Scripted';
  $('aiBadge').classList.toggle('live', live);
  $('titanMode').textContent = live ? `Live AI · ${model ?? 'Claude'}` : 'Scripted fallback · no live AI response (set ANTHROPIC_API_KEY)';
}
let model = null;
fetch('/api/status').then(r => r.json()).then(s => { model = s.model; setMode(s.ai, s.model); }).catch(() => setMode('scripted'));

$('chatForm').addEventListener('submit', async e => {
  e.preventDefault();
  const text = $('chatInput').value.trim();
  if (!text || state.won) return;
  $('chatInput').value = '';
  $('sendBtn').disabled = $('chatInput').disabled = true;
  say('user', text);
  state.chat.push({ role: 'user', content: text });
  const typing = say('titan', 'Titan is typing… slowly… on purpose…', 'typing');
  try {
    const [res] = await Promise.all([
      fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ history: state.chat }) }),
      sleep(900), // the Titan savors your wait
    ]);
    const data = await res.json();
    typing.remove();
    if (!res.ok) { state.chat.pop(); say('titan', data.error ?? 'The Titan ignores you.'); return; }
    state.chat.push({ role: 'assistant', content: data.reply });
    persist();
    setMode(data.source, model); // honest per-reply: a failed API call shows as scripted
    say('titan', data.reply);
    $('titanFace').textContent = data.surrender ? '😩' : ['😏', '🙄', '😤', '🥱', '😈'][state.chat.length % 5];
    $('titanFace').classList.remove('shake'); void $('titanFace').offsetWidth; $('titanFace').classList.add('shake');
    if (data.surrender) { await sleep(1500); win(); } else addRage(2);
  } catch {
    typing.remove();
    state.chat.pop();
    say('titan', 'Connection lost. The Titan pulled the plug. Try again.');
  } finally {
    $('sendBtn').disabled = $('chatInput').disabled = false;
    $('chatInput').focus();
  }
});

// ---------- victory + Hall of Shame ----------
function win() {
  state.won = true;
  logEvent(`TOKEN-0001 withdrawn after ${userMessages()} messages`);
  $('winStats').textContent = `It took you ${fmt(elapsed())}, ${userMessages()} messages and ${state.rage} units of rage.`;
  $('shameName').value = state.username;
  $('shameForm').hidden = state.submitted;
  $('winModal').showModal();
}
$('winClose').addEventListener('click', () => $('winModal').close());

$('shameForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('shameBtn').disabled = true;
  try {
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: $('shameName').value.trim(), seconds: elapsed(), rage: state.rage, messages: userMessages() }),
    });
    if (!res.ok) throw new Error();
    state.submitted = true;
    persist();
    renderBoard(await res.json());
    $('winModal').close();
    showTab('shame');
    toast('You are now permanently famous. Sorry.');
  } catch {
    toast('The Hall of Shame rejected you. Try again.');
  } finally {
    $('shameBtn').disabled = false;
  }
});

function renderBoard({ top, totals }) {
  $('totals').textContent = `${totals.runs} victims have collectively wasted ${(totals.seconds / 3600).toFixed(2)} hours here.`;
  if (!top.length) {
    $('board').innerHTML = '<tr><td colspan="5">No victims yet. Be the first.</td></tr>';
    return;
  }
  $('board').replaceChildren(...top.map((r, i) => {
    const tr = document.createElement('tr');
    [i + 1, r.name, r.rage, fmt(r.seconds), r.messages].forEach((v, j) => {
      const td = Object.assign(document.createElement('td'), { textContent: v });
      if (j === 2) td.className = 'rage-num';
      if (j === 4) td.className = 'hide-sm';
      tr.append(td);
    });
    return tr;
  }));
}
function loadBoard() {
  fetch('/api/leaderboard').then(r => r.json()).then(renderBoard).catch(() => ($('totals').textContent = 'Hall of Shame is offline. Lucky you.'));
}
$('refreshBoard').addEventListener('click', loadBoard);

// ---------- continuous popup notifications ----------
const STREAM = [
  { title: 'Security alert', body: 'Unusual activity detected: you, using the dashboard.', actions: [{ label: 'Review', run: () => showTab('settings') }] },
  { title: 'Titan', body: 'Your withdrawal request has been received and pre-denied.', actions: [{ label: 'Appeal', primary: true, run: () => withdraw() }] },
  { title: 'Quick survey', body: 'How likely are you to recommend Titan Cloud? (0 = extremely likely)', actions: [{ label: '0', run: () => toast('Thanks! Recorded as 10.') }, { label: '10', run: () => toast('Thanks! Recorded as 0.') }] },
  { title: 'Storage almost full', body: 'Your vault is 100% full (1 of 1 tokens).', actions: [{ label: 'Upgrade', primary: true, run: () => $('upgradeBtn').click() }] },
  { title: 'Reminder', body: "You haven't withdrawn your token yet. Everyone else has.*", actions: [{ label: 'Withdraw', primary: true, run: () => withdraw() }] },
  { title: 'Enable desktop notifications?', body: 'Get popups like this one even when the tab is closed!', actions: [{ label: 'Allow', primary: true, run: () => toast('Enabled. (They already were.)') }, { label: 'Block', run: () => addRage(1, 'Blocking failed. Please try again later.') }] },
  { title: 'New message', body: 'The Titan sent you a message: "lol"', actions: [{ label: 'Reply', run: () => showTab('titan') }] },
  { title: 'Policy update', body: 'We updated our Cookie Policy. You have already agreed to it.', actions: [{ label: 'OK' }] },
];
let streamIdx = 0, dismissals = 0;
function pushNotification() {
  const n = STREAM[streamIdx++ % STREAM.length];
  notify({
    ...n,
    onDismiss: () => {
      addRage(1);
      if (++dismissals % 3 === 0) notify({
        title: 'Notification dismissed',
        body: 'Would you like to be notified when you dismiss notifications?',
        actions: [{ label: 'Yes', primary: true, run: () => toast('Done. You will be notified.') }, { label: 'No', run: () => toast('Noted. We will notify you about that.') }],
      });
    },
  });
  $('bellDot').textContent = $('bellDot').hidden ? 1 : Number($('bellDot').textContent) + 1;
  $('bellDot').hidden = false;
}
setTimeout(() => { pushNotification(); setInterval(pushNotification, 18000); }, 6000);

// ---------- blocking alerts: session timeout + newsletter nag ----------
function sessionTimeout() {
  whenIdle(async () => {
    const v = await systemAlert({
      title: 'Session expiring',
      body: '',
      buttons: [{ label: 'Stay signed in', value: 'stay', primary: true, escape: true }, { label: 'Sign out', value: 'out' }],
      onOpen: ({ setBody, finish }) => {
        let s = 10;
        const tick = () => {
          setBody(`For your security, you will be signed out in ${s} seconds due to inactivity. You are not inactive.`);
          if (s-- <= 0) { clearInterval(t); finish('timeout'); }
        };
        const t = setInterval(tick, 1000);
        tick();
      },
    });
    if (v === 'out') return signOutFlow();
    if (v === 'timeout') toast("Session extended automatically. You're welcome.");
    else addRage(1);
    setTimeout(sessionTimeout, 120000);
  });
}
setTimeout(sessionTimeout, 45000);

const DECLINES = ["No thanks, I don't like free tokens", 'No, I enjoy missing out', 'No. I am a bad person.'];
let nags = 0;
function newsletter() {
  whenIdle(async () => {
    const yes = await systemAlert({
      title: nags === 0 ? 'Join 2 million token holders' : 'Still not subscribed? 🥺',
      body: 'Get Titan Weekly: 14 emails a day about tokens you cannot withdraw.',
      buttons: [{ label: 'Subscribe', value: true, primary: true }, { label: DECLINES[nags], value: false, faded: true, escape: true }],
    });
    nags++;
    if (yes) { logEvent('Subscribed to Titan Weekly (14 emails/day)'); return toast('Subscribed! Your first 14 emails are on their way.'); }
    addRage(2);
    if (nags < DECLINES.length) setTimeout(newsletter, 60000);
  });
}
setTimeout(newsletter, 25000);

// ---------- fake urgency ----------
let urgencyLeft = 299;
$('urgency').hidden = state.won;
setInterval(() => {
  if (state.won) return ($('urgency').hidden = true);
  if (--urgencyLeft < 0) { urgencyLeft = 299; toast('Good news! We extended your withdrawal window. Again.'); }
  $('urgencyTime').textContent = `${Math.floor(urgencyLeft / 60)}:${String(urgencyLeft % 60).padStart(2, '0')}`;
}, 1000);
$('urgencyClose').addEventListener('click', () => {
  $('urgency').hidden = true;
  addRage(1);
  setTimeout(() => { if (!state.won) { $('urgency').hidden = false; toast('The offer is back. Did you miss it?'); } }, 30000);
});

// ---------- settings: the worst controls ----------
$('volume').addEventListener('input', () => ($('volOut').textContent = `${$('volume').value}%`));
$('volume').addEventListener('change', () => {
  const v = Math.floor(Math.random() * 101);
  $('volume').value = v;
  $('volOut').textContent = `${v}%`;
  addRage(1, `Volume set to ${v}%. Close enough.`);
});
const phoneFmt = n => { const s = String(n).padStart(10, '0'); return `(${s.slice(0, 3)}) ${s.slice(3, 6)}-${s.slice(6)}`; };
const showPhone = () => ($('phoneOut').textContent = phoneFmt($('phone').value));
$('phone').addEventListener('input', showPhone);
$('phoneMinus').addEventListener('click', () => { $('phone').stepDown(); showPhone(); });
$('phonePlus').addEventListener('click', () => { $('phone').stepUp(); showPhone(); });
$('phoneSave').addEventListener('click', () => {
  logEvent(`Phone number saved: ${phoneFmt($('phone').value)}`);
  toast(`Saved ${phoneFmt($('phone').value)}. We'll call at 3 a.m.`);
});

renderOverview();
