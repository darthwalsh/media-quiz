import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUIZ_CONFIG as config } from '../data.js';
import { score } from '../scoring.js';

const CONFIDENCE = ['high', 'medium', 'low'];
const CHECKED = ['primary', 'secondary', 'no'];

test('C1 required top-level keys exist', () => {
  for (const key of ['id', 'title', 'prompt', 'intro', 'repoUrl', 'firstItemId', 'quizLength', 'closeThreshold', 'categories', 'items']) {
    assert.ok(key in config, `missing ${key}`);
  }
  assert.ok(Array.isArray(config.intro) && config.intro.length > 0);
  assert.match(config.repoUrl, /^https:\/\//);
});

test('C2 categories: 2 to 6, unique ids, non-empty labels', () => {
  const ids = config.categories.map((c) => c.id);
  assert.ok(ids.length >= 2 && ids.length <= 6);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of config.categories) {
    assert.ok(c.label && c.label.trim().length > 0);
    assert.ok(c.blurb && c.blurb.trim().length > 0);
  }
});

test('C3 items: unique ids, id format, label, group, note', () => {
  const ids = config.items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of config.items) {
    assert.match(item.id, /^[a-z0-9-]+$/);
    assert.ok(item.label && item.group && item.note, `${item.id} is missing a field`);
    assert.ok(item.note.length <= 160, `${item.id} note is ${item.note.length} characters`);
  }
});

test('C4 weights cover every category, nothing extra, finite and non-negative', () => {
  const catIds = config.categories.map((c) => c.id).sort();
  for (const item of config.items) {
    assert.deepEqual(Object.keys(item.weights).sort(), catIds, `${item.id} weight keys`);
    let sum = 0;
    for (const value of Object.values(item.weights)) {
      assert.ok(Number.isFinite(value) && value >= 0, `${item.id} has a bad weight`);
      sum += value;
    }
    assert.ok(sum > 0, `${item.id} weights sum to 0`);
  }
});

test('C5 warns when a weight sum is not 100', (t) => {
  for (const item of config.items) {
    const sum = Object.values(item.weights).reduce((a, b) => a + b, 0);
    if (sum !== 100) t.diagnostic(`warning: ${item.id} weights sum to ${sum}`);
  }
});

test('C6 every item has a unique top category', () => {
  for (const item of config.items) {
    const result = score(item, config.categories[0].id, config);
    assert.equal(result.tie, false, `${item.id} has a tie at the top`);
  }
});

test('C7 confidence, checked, and sources are consistent', () => {
  for (const item of config.items) {
    assert.ok(CONFIDENCE.includes(item.confidence), `${item.id} confidence`);
    assert.ok(CHECKED.includes(item.checked), `${item.id} checked`);
    assert.ok(Array.isArray(item.sources), `${item.id} sources`);
    for (const url of item.sources) assert.match(url, /^https:\/\//, `${item.id} source ${url}`);
    if (item.checked !== 'no') assert.ok(item.sources.length > 0, `${item.id} is checked but has no sources`);
  }
});

test('C8 firstItemId, quizLength, and closeThreshold are sane', () => {
  assert.ok(config.items.some((i) => i.id === config.firstItemId));
  assert.ok(config.quizLength <= config.items.length);
  assert.ok(config.closeThreshold > 0 && config.closeThreshold <= 1);
});

test('C9 aliases are unique and never collide with ids or labels', () => {
  const taken = new Set();
  for (const item of config.items) {
    for (const name of [item.id, item.label]) {
      assert.ok(!taken.has(name.toLowerCase()), `duplicate name ${name}`);
      taken.add(name.toLowerCase());
    }
  }
  for (const item of config.items) {
    for (const alias of item.aliases ?? []) {
      assert.ok(!taken.has(alias.toLowerCase()), `alias ${alias} collides`);
      taken.add(alias.toLowerCase());
    }
  }
});
