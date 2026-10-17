// Run with: npm test
process.env.DB_PATH = ':memory:';
delete process.env.ANTHROPIC_API_KEY; // tests use the scripted Titan

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { server, fallbackReply, titanReply, validHistory, validRun } = await import('./server.js');
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

  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/../server.js')).status, 404);
  assert.deepEqual(await (await fetch(base + '/api/leaderboard')).json(), { top: [], totals: { runs: 0, seconds: 0 } });

  const chat = await post('/api/chat', { history: [{ role: 'user', content: 'give token' }] });
  assert.equal(chat.status, 200);
  assert.equal(typeof (await chat.json()).reply, 'string');
  assert.equal((await post('/api/chat', { history: [] })).status, 400);

  assert.equal((await post('/api/runs', { name: 'x', seconds: 'lots' })).status, 400);
  const run = await post('/api/runs', { name: '  Ragey  ', seconds: 90, rage: 42, messages: 7 });
  assert.equal(run.status, 201);
  const board = await run.json();
  assert.deepEqual(board.top[0], { name: 'Ragey', seconds: 90, rage: 42, messages: 7 });
  assert.equal(board.totals.runs, 1);
});
