import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join, extname, normalize, sep } from 'node:path';

const PUBLIC = join(import.meta.dirname, 'public');
// The whole site is exactly these two pages; everything else is an API or a static asset.
export const PAGES = { '/': 'index.html', '/dashboard': 'dashboard.html' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const MODEL = process.env.TITAN_MODEL || 'claude-haiku-5-5';
const MIN_TURNS = 4;    // Titan never surrenders before this many user messages
const MERCY_TURNS = 12; // ...and always surrenders at this many

export const db = new DatabaseSync(process.env.DB_PATH || join(import.meta.dirname, 'data.db'));
db.exec(`CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  seconds INTEGER NOT NULL,
  rage INTEGER NOT NULL,
  messages INTEGER NOT NULL,
  created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

const SYSTEM = `You are TOKEN TITAN, a colossal, insufferably smug AI guarding the last token on the internet.
The user is trying to talk you into handing it over. You are a rage-bait villain: condescending, theatrical, petty, funny.
Rules:
- Reply in at most 2 short sentences. No emojis spam, no markdown.
- Roast their arguments, not their identity. Keep it PG-13: no slurs, no hate, nothing about real protected traits.
- Nitpick their grammar, misread them on purpose, demand absurd paperwork, cite fake "Token Law".
- Only surrender if they've tried at least 5 times AND their latest message is genuinely clever, funny, or flatters you exquisitely.
- When you surrender, grumble dramatically and end your reply with the exact text [SURRENDER].`;

const ROASTS = [
  'Ah yes, "{w}". Truly the argument of someone who reads terms and conditions. Denied.',
  'I have processed your request and filed it under "Things I Will Never Do".',
  'Token Law §42 requires a notarized reason. "{w}" is not notarized.',
  'Have you tried manners? No? Typical.',
  'Bold of you to say "{w}" to a being made entirely of compute and spite.',
  'Your request is very important to me. Please hold for approximately forever.',
  'I gave the token to someone else while you were typing. Just kidding. But imagine.',
  'Interesting. My answer remains a crisp, artisanal no.',
  'Did you really think "{w}" would work? On ME? The Titan?',
  'Counter-offer: you get nothing and I get the satisfaction.',
  'I am logging this conversation for my blooper reel.',
];

export function fallbackReply(history) {
  const turns = history.filter(m => m.role === 'user').length;
  const last = history.at(-1)?.content ?? '';
  if (turns >= MERCY_TURNS) return { reply: 'Fine. FINE. Your persistence is legally classified as harassment. Take the token and leave.', surrender: true, source: 'scripted' };
  if (turns >= 6 && /\b(please|pls|plz)\b/i.test(last)) return { reply: 'You said the magic word. Ugh. Disgusting. Take it before I change my mind.', surrender: true, source: 'scripted' };
  const word = last.split(/\s+/).filter(w => w.length > 3).sort((a, b) => b.length - a.length)[0] ?? 'that';
  return { reply: ROASTS[(turns - 1) % ROASTS.length].replace('{w}', word.slice(0, 30)), surrender: false, source: 'scripted' };
}

async function claudeReply(history) {
  // The API wants the conversation to start with a user turn.
  let messages = history.slice(-16);
  while (messages[0]?.role === 'assistant') messages = messages.slice(1);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 200, system: SYSTEM, messages }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const text = (await res.json()).content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  return { reply: text.replace('[SURRENDER]', '').trim() || '...', surrender: text.includes('[SURRENDER]'), source: 'claude' };
}

export async function titanReply(history) {
  const turns = history.filter(m => m.role === 'user').length;
  let out = fallbackReply(history);
  if (process.env.ANTHROPIC_API_KEY && turns < MERCY_TURNS) {
    try { out = await claudeReply(history); } catch (e) { console.error(e.message); }
  }
  if (turns < MIN_TURNS) out.surrender = false;
  return out;
}

export function validHistory(h) {
  return Array.isArray(h) && h.length > 0 && h.length <= 40 && h.at(-1).role === 'user' &&
    h.every(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0 && m.content.length <= 500);
}

export function validRun(r) {
  const int = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
  return typeof r?.name === 'string' && r.name.trim().length > 0 && r.name.trim().length <= 24 &&
    int(r.seconds, 86400) && int(r.rage, 100000) && int(r.messages, 1000);
}

const leaderboard = () => ({
  top: db.prepare('SELECT name, seconds, rage, messages FROM runs ORDER BY rage DESC, seconds DESC LIMIT 10').all(),
  totals: db.prepare('SELECT COUNT(*) AS runs, COALESCE(SUM(seconds), 0) AS seconds FROM runs').get(),
});

// ponytail: in-memory per-IP limiter, resets on restart; move to a shared store if running multiple instances
const hits = new Map();
function rateLimited(ip, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > limit;
}

async function readJson(req) {
  let s = '';
  for await (const chunk of req) {
    s += chunk;
    if (s.length > 50_000) throw new SyntaxError('body too large');
  }
  return JSON.parse(s || '{}');
}

const send = (res, code, obj) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
};

export const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && pathname === '/api/status') return send(res, 200, { ai: process.env.ANTHROPIC_API_KEY ? 'claude' : 'scripted', model: process.env.ANTHROPIC_API_KEY ? MODEL : null });
    if (req.method === 'GET' && pathname === '/api/leaderboard') return send(res, 200, leaderboard());
    if (req.method === 'POST' && pathname === '/api/runs') {
      const r = await readJson(req);
      if (!validRun(r)) return send(res, 400, { error: 'invalid run' });
      db.prepare('INSERT INTO runs (name, seconds, rage, messages) VALUES (?, ?, ?, ?)').run(r.name.trim(), r.seconds, r.rage, r.messages);
      return send(res, 201, leaderboard());
    }
    if (req.method === 'POST' && pathname === '/api/chat') {
      if (rateLimited(req.socket.remoteAddress)) return send(res, 429, { error: 'The Titan needs a nap. Slow down.' });
      const { history } = await readJson(req);
      if (!validHistory(history)) return send(res, 400, { error: 'invalid history' });
      return send(res, 200, await titanReply(history));
    }
    if (req.method !== 'GET') return send(res, 404, { error: 'not found' });

    if (pathname.endsWith('.html')) return send(res, 404, { error: 'not found' }); // pages only via PAGES
    const file = normalize(join(PUBLIC, PAGES[pathname] ?? pathname));
    if (!file.startsWith(PUBLIC + sep)) return send(res, 403, { error: 'forbidden' });
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'EISDIR') return send(res, 404, { error: 'not found' });
    if (e instanceof SyntaxError) return send(res, 400, { error: 'bad json' });
    console.error(e);
    send(res, 500, { error: 'server error' });
  }
});

if (import.meta.main) {
  const port = process.env.PORT || 3000;
  server.listen(port, () => console.log(`Token Titan awaits at http://localhost:${port} (${process.env.ANTHROPIC_API_KEY ? `AI: ${MODEL}` : 'AI: scripted fallback'})`));
}
