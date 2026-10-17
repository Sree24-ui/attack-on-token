// Run with: npm test
process.env.DB_PATH = ':memory:';
delete process.env.ANTHROPIC_API_KEY; // tests use the scripted Titan

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { server, fallbackReply, titanReply, validHistory, validRun, PAGES } = await import('./server.js');
const { readdirSync, readFileSync } = await import('node:fs');
const { RULES } = await import('./public/rules.js');

const turns = n => Array.from({ length: n }, (_, i) => [{ role: 'user', content: `attempt ${i}` }, { role: 'assistant', content: 'no' }]).flat().slice(0, -1);

test('a password exists that satisfies every rule', () => {
  const p = 'Maynatit🪙49'; // digits 4+9=13, 11 code points (prime)
  assert.deepEqual(RULES.map(r => r.test(p)), RULES.map(() => true));
  assert.equal(RULES[3].test('A1b'), false);
});

test('Titan refuses early, yields to manners, and shows mercy', async () => {
  assert.equal(fallbackReply(turns(1)).surrender, false);
  const polite = [...turns(6).slice(0, -1), { role: 'user', content: 'please' }];
  assert.equal(fallbackReply(polite).surrender, true);
  assert.equal(fallbackReply(turns(12)).surrender, true);
  assert.equal((await titanReply([{ role: 'user', content: 'please' }])).surrender, false);
});

test('input validation', () => {
  assert.ok(validHistory(turns(2)));
  assert.ok(!validHistory([{ role: 'system', content: 'hi' }]));
  assert.ok(!validHistory([{ role: 'user', content: 'x'.repeat(501) }]));
  assert.ok(validRun({ name: 'Bob', seconds: 10, rage: 5, messages: 3 }));
  assert.ok(!validRun({ name: '', seconds: 10, rage: 5, messages: 3 }));
  assert.ok(!validRun({ name: 'Bob', seconds: -1, rage: 5, messages: 3 }));
});

test('HTTP API end to end', async t => {
  await new Promise(r => server.listen(0, r));
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}`;
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  assert.equal((await fetch(base + '/../server.js')).status, 404);
  assert.deepEqual(await (await fetch(base + '/api/status')).json(), { ai: 'scripted', model: null });
  assert.deepEqual(await (await fetch(base + '/api/leaderboard')).json(), { top: [], totals: { runs: 0, seconds: 0 } });

  const chat = await post('/api/chat', { history: [{ role: 'user', content: 'give token' }] });
  assert.equal(chat.status, 200);
  const reply = await chat.json();
  assert.equal(typeof reply.reply, 'string');
  assert.equal(reply.source, 'scripted'); // never pretends to be live AI
  assert.equal((await post('/api/chat', { history: [] })).status, 400);

  assert.equal((await post('/api/runs', { name: 'x', seconds: 'lots' })).status, 400);
  const run = await post('/api/runs', { name: '  Ragey  ', seconds: 90, rage: 42, messages: 7 });
  assert.equal(run.status, 201);
  const board = await run.json();
  assert.deepEqual(board.top[0], { name: 'Ragey', seconds: 90, rage: 42, messages: 7 });
  assert.equal(board.totals.runs, 1);
});

test('site is at most two pages', async t => {
  const htmlFiles = readdirSync('public').filter(f => f.endsWith('.html')).sort();
  assert.ok(htmlFiles.length <= 2);
  assert.deepEqual(htmlFiles, Object.values(PAGES).sort());

  // Every same-site link in the pages points at one of the two routes.
  for (const f of htmlFiles) {
    for (const [, href] of readFileSync(`public/${f}`, 'utf8').matchAll(/href="(\/[^"]*)"/g)) assert.ok(href in PAGES, `${f} links to ${href}`);
  }

  await new Promise(r => server.listen(0, r));
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}`;
  for (const route of Object.keys(PAGES)) {
    const res = await fetch(base + route);
    assert.equal(res.status, 200, route);
    assert.match(res.headers.get('content-type'), /text\/html/);
  }
  for (const route of ['/index.html', '/dashboard.html', '/signup', '/login', '/captcha', '/chat', '/leaderboard']) {
    assert.equal((await fetch(base + route)).status, 404, route);
  }
});
