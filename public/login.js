import { $, state, persist, addRage, toast, logEvent, fakeProgress, notify } from './common.js';
import { RULES } from './rules.js';

// ---------- tabs ----------
function selectTab(signin) {
  $('tabSignin').setAttribute('aria-selected', signin);
  $('tabSignup').setAttribute('aria-selected', !signin);
  $('panelSignin').hidden = !signin;
  $('panelSignup').hidden = signin;
  $('authTitle').textContent = signin ? 'Welcome back' : 'Create your workspace';
  $('authSub').textContent = signin ? 'Sign in to your workspace to continue.' : 'Free forever. Withdrawals sold separately.';
  (signin ? $('siEmail') : $('suUser')).focus();
}
$('tabSignin').addEventListener('click', () => selectTab(true));
$('tabSignup').addEventListener('click', () => selectTab(false));

// ---------- cookie consent ----------
let flees = 0;
function flee(e) {
  if (flees >= 6) return; // fine, you can have it
  e.preventDefault();
  flees++;
  const x = -40 - Math.random() * 160;
  const y = (Math.random() - 0.5) * 30;
  $('rejectCookies').style.transform = `translate(${x}px, ${y}px)`;
  addRage(1, flees === 6 ? 'Okay okay. You can click it.' : null);
}
$('rejectCookies').addEventListener('pointerenter', flee);
$('rejectCookies').addEventListener('pointerdown', flee);
$('rejectCookies').addEventListener('click', () => {
  $('consent').hidden = true;
  addRage(3, 'Rejection noted. All 9,437 cookies accepted anyway.');
  logEvent('Cookie consent: rejected (accepted 9,437 cookies)');
});
$('acceptCookies').addEventListener('click', () => {
  $('consent').hidden = true;
  logEvent('Cookie consent: accepted 9,437 cookies');
});

// ---------- sign in: the button dodges, and no credentials ever work ----------
let dodges = 0;
$('signinBtn').addEventListener('pointerenter', () => {
  const btn = $('signinBtn');
  if (dodges >= 4) { btn.style.transform = ''; return; }
  dodges++;
  const range = (btn.parentElement.clientWidth - btn.offsetWidth) / 2;
  const current = new DOMMatrix(getComputedStyle(btn).transform).m41;
  const x = (current > 0 ? -1 : 1) * range * (0.6 + Math.random() * 0.4);
  btn.style.transform = `translateX(${x}px)`;
  addRage(1, dodges === 4 ? 'Fine. The button will hold still. For now.' : null);
});

let signinAttempts = 0;
$('panelSignin').addEventListener('submit', e => {
  e.preventDefault();
  const email = $('siEmail').value.trim();
  if (!email || !$('siPassword').value) { $('siError').textContent = 'Please enter your email and password.'; return; }
  signinAttempts++;
  addRage(2);
  if (signinAttempts === 1) {
    $('siError').textContent = "Incorrect password. Hint: it's the one you're thinking of.";
    return;
  }
  const create = Object.assign(document.createElement('button'), { type: 'button', className: 'link', textContent: 'Create one instead' });
  create.addEventListener('click', () => selectTab(false));
  $('siError').replaceChildren(`No workspace found for ${email}. `, create);
});

$('forgotBtn').addEventListener('click', () => {
  const open = $('forgotPop').hidden;
  $('forgotPop').hidden = !open;
  $('forgotBtn').setAttribute('aria-expanded', open);
  if (open) { addRage(1); logEvent('Password reset emailed to an unknown address'); }
});
$('forgotClose').addEventListener('click', () => { $('forgotPop').hidden = true; $('forgotBtn').setAttribute('aria-expanded', false); });

$('ssoBtn').addEventListener('click', () => {
  $('siError').textContent = 'SSO is configured by your administrator. Your administrator is the Titan. The Titan says no.';
  addRage(2);
});

// ---------- create account: escalating password rules ----------
let revealed = 1;
function renderRules() {
  const p = $('suPassword').value;
  const firstFail = RULES.findIndex(r => !r.test(p));
  const target = firstFail === -1 ? RULES.length : firstFail + 1;
  const fresh = target > revealed;
  if (fresh) { revealed = target; addRage(1); }
  $('rules').replaceChildren(...(p ? RULES.slice(0, revealed) : []).map((r, i) => {
    const li = document.createElement('li');
    li.textContent = r.text(p);
    if (r.test(p)) li.className = 'ok';
    if (fresh && i === revealed - 1) li.classList.add('new'); // only the just-revealed rule animates
    return li;
  }).reverse()); // newest rule on top
  // Misleading strength meter: the better the password, the weaker it claims to be.
  const passed = RULES.filter(r => r.test(p)).length;
  const pct = p ? Math.max(8, 100 - passed * 12) : 0;
  $('strengthBar').style.transform = `scaleX(${pct / 100})`;
  $('strengthBar').dataset.level = pct > 70 ? 'high' : pct > 40 ? 'mid' : 'low';
  $('strengthText').textContent = `Strength: ${!p ? 'n/a' : pct > 70 ? 'Excellent' : pct > 40 ? 'Good' : 'Weak'}`;
}
$('suPassword').addEventListener('input', renderRules);

let shown = false;
$('suShow').addEventListener('click', () => {
  $('suPassword').type = 'text';
  $('suShow').textContent = 'Shown';
  if (!shown) { shown = true; toast('For your security, passwords are visible for 1.5 seconds.'); }
  setTimeout(() => { $('suPassword').type = 'password'; $('suShow').textContent = 'Show'; }, 1500);
});

let termsTricked = false;
$('terms').addEventListener('change', () => {
  if (!$('terms').checked || termsTricked) return;
  termsTricked = true;
  setTimeout(() => {
    $('terms').checked = false;
    $('termsPanel').hidden = false;
    $('termsBtn').setAttribute('aria-expanded', true);
    addRage(2, 'Please review the Terms of Service before agreeing.');
  }, 400);
});
$('termsBtn').addEventListener('click', () => {
  $('termsPanel').hidden = !$('termsPanel').hidden;
  $('termsBtn').setAttribute('aria-expanded', !$('termsPanel').hidden);
});

let usernameRejected = false;
$('panelSignup').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('suUser').value.trim();
  const err = msg => { $('suError').textContent = msg; addRage(1); };
  if (!name) return err('Please choose a username.');
  if (!RULES.every(r => r.test($('suPassword').value))) return err('Your password does not meet the requirements.');
  if (!$('terms').checked) return err('You must accept the Terms of Service.');
  if (!usernameRejected) {
    usernameRejected = true;
    return err(`"${name}" is already taken. By you, apparently. Try again.`);
  }
  $('suError').textContent = '';
  $('provision').showModal();
  await fakeProgress($('provBar'), $('provText'), [
    ['Allocating tokens…', 12, 700], ['Almost there!', 87, 900], ['Recalculating…', 34, 900],
    ['Finalizing (this may take a while)…', 99, 1400], ['Done.', 100, 400],
  ]);
  state.username = name;
  logEvent(`Workspace provisioned for ${name}`);
  persist();
  location.href = '/dashboard';
});
$('provision').addEventListener('cancel', e => e.preventDefault()); // no escaping provisioning

// ---------- the help bubble that keeps coming back ----------
let helpVisits = 0;
function helpBubble() {
  if ($('provision').open) return;
  helpVisits++;
  notify({
    title: helpVisits === 1 ? '👋 Hi! I\'m Tia from Titan Cloud' : helpVisits === 2 ? 'Tia is back 👀' : `Tia (visit #${helpVisits})`,
    body: helpVisits === 1 ? 'Having trouble signing in? I can help!' : "Just checking you still don't need help. You might!",
    actions: [
      { label: 'Yes, help', primary: true, run: () => { toast('Have you tried creating an account? Tia has done all she can.'); selectTab(false); setTimeout(helpBubble, 45000); } },
      { label: 'No thanks', run: () => { addRage(1); setTimeout(helpBubble, 25000); } },
    ],
    onDismiss: () => { addRage(1); setTimeout(helpBubble, 20000); },
  });
}
setTimeout(helpBubble, 5000);
