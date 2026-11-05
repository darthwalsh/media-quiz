import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize,
  score,
  pickQuestions,
  seededRandom,
  shareText,
  debugTsv,
} from '../scoring.js';

// Synthetic fixtures: nothing here depends on the real data.
function makeConfig(categoryIds, items, extra = {}) {
  return {
    title: 'Test quiz',
    firstItemId: items[0].id,
    quizLength: 3,
    closeThreshold: 0.5,
    categories: categoryIds.map((id) => ({ id, label: id.toUpperCase() })),
    items,
    ...extra,
  };
}

const abc = makeConfig(
  ['a', 'b', 'c'],
  [
    { id: 'one', label: 'one', weights: { a: 60, b: 30, c: 10 } },
    { id: 'two', label: 'two', weights: { a: 10, b: 10, c: 80 } },
    { id: 'three', label: 'three', weights: { a: 50, b: 50, c: 0 } },
    { id: 'four', label: 'four', weights: { a: 0, b: 0, c: 100 } },
    { id: 'five', label: 'five', weights: { a: 1, b: 98, c: 1 } },
  ],
);

test('S1 normalize returns shares that sum to 1', () => {
  const shares = normalize({ a: 2, b: 2 }, ['a', 'b']);
  assert.deepEqual(shares, { a: 0.5, b: 0.5 });
  const odd = normalize({ a: 1, b: 2, c: 4 }, ['a', 'b', 'c']);
  assert.ok(Math.abs(odd.a + odd.b + odd.c - 1) < 1e-9);
});

test('S2 normalize throws on unusable weights', () => {
  assert.throws(() => normalize({ a: 0, b: 0 }, ['a', 'b']));
  assert.throws(() => normalize({ a: -1, b: 5 }, ['a', 'b']));
  assert.throws(() => normalize({ a: Infinity, b: 5 }, ['a', 'b']));
  assert.throws(() => normalize({ a: NaN, b: 5 }, ['a', 'b']));
  assert.throws(() => normalize({ a: 1 }, ['a', 'b']));
});

test('S3 choosing the top category gives 1 point and "correct"', () => {
  const result = score(abc.items[0], 'a', abc);
  assert.equal(result.points, 1);
  assert.equal(result.verdict, 'correct');
  assert.equal(result.top, 'a');
  assert.equal(result.tie, false);
});

test('S4 partial credit is the ratio to the top share', () => {
  const close = score(abc.items[0], 'b', abc);
  assert.equal(close.points, 0.5);
  assert.equal(close.verdict, 'close');
  const wrong = score(abc.items[0], 'c', abc);
  assert.equal(wrong.points, 0.17);
  assert.equal(wrong.verdict, 'wrong');
  assert.equal(wrong.formula, '0.10 / 0.60 = 0.17');
});

test('S5 a tie at the top gives both tied categories 1 point', () => {
  const x = score(abc.items[2], 'a', abc);
  const y = score(abc.items[2], 'b', abc);
  assert.equal(x.points, 1);
  assert.equal(y.points, 1);
  assert.equal(x.tie, true);
  assert.deepEqual(x.topIds, ['a', 'b']);
});

test('S6 pickQuestions: first item, length, no duplicates, seeded determinism', () => {
  const ids = pickQuestions(abc, seededRandom(7), undefined);
  assert.equal(ids[0], abc.firstItemId);
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, ids.length);

  assert.equal(pickQuestions(abc, seededRandom(1), 'all').length, abc.items.length);
  assert.equal(pickQuestions(abc, seededRandom(1), 99).length, abc.items.length);
  assert.equal(pickQuestions(abc, seededRandom(1), 2).length, 2);

  assert.deepEqual(pickQuestions(abc, seededRandom(42), 'all'), pickQuestions(abc, seededRandom(42), 'all'));

  const orders = new Set();
  for (let seed = 1; seed <= 20; seed++) orders.add(pickQuestions(abc, seededRandom(seed), 'all').join(','));
  assert.ok(orders.size >= 5, `expected at least 5 distinct orders, got ${orders.size}`);
});

test('S7 shareText has score, percent, one mark per answer, and the url', () => {
  const results = [
    score(abc.items[0], 'a', abc),
    score(abc.items[0], 'b', abc),
    score(abc.items[0], 'c', abc),
  ];
  const text = shareText(results, abc, 'https://example.test/');
  assert.match(text, /1\.7\/3/);
  assert.match(text, /\(56%\)/);
  const marks = text.split('\n')[1];
  assert.equal([...marks].length, 3);
  assert.equal(marks, '\u2713~\u2717');
  assert.ok(text.endsWith('https://example.test/'));
});

test('S8 debugTsv has the expected header and one row per answer', () => {
  const results = [score(abc.items[0], 'b', abc), score(abc.items[1], 'c', abc)];
  const lines = debugTsv(results, abc).split('\n');
  assert.equal(lines.length, 3);
  assert.deepEqual(lines[0].split('\t'), ['item', 'choice', 'top', 'share_a', 'share_b', 'share_c', 'points', 'verdict']);
  assert.deepEqual(lines[1].split('\t'), ['one', 'b', 'a', '0.60', '0.30', '0.10', '0.50', 'close']);
});

test('S9 works with 3 categories and with 5 categories', () => {
  const five = makeConfig(
    ['p', 'q', 'r', 's', 't'],
    [{ id: 'x', label: 'x', weights: { p: 5, q: 5, r: 10, s: 70, t: 10 } }],
  );
  assert.equal(score(five.items[0], 's', five).points, 1);
  assert.equal(score(five.items[0], 'r', five).points, 0.14);
  assert.equal(score(abc.items[4], 'b', abc).points, 1);
});

test('score rejects unknown categories', () => {
  assert.throws(() => score(abc.items[0], 'nope', abc));
});
