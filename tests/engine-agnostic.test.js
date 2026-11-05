import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { QUIZ_CONFIG as config } from '../data.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeWord = (word) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}([^a-z0-9]|$)`, 'i');

const ENGINE_FILES = ['main.js', 'scoring.js', 'style.css'];
const JS_FILES = ['main.js', 'scoring.js', 'data.js'];

function topicWords() {
  const words = new Set();
  for (const item of config.items) {
    for (const name of [item.id, item.label, ...(item.aliases ?? [])]) {
      const bare = name.replace(/^\./, '').toLowerCase();
      if (bare.length >= 3) words.add(bare);
    }
  }
  for (const c of config.categories) {
    words.add(c.id.toLowerCase());
    words.add(c.label.toLowerCase());
  }
  return [...words];
}

test('A1 engine files contain no topic words from the config', () => {
  const words = topicWords();
  assert.ok(words.length > 10);
  for (const file of ENGINE_FILES) {
    const text = read(file);
    for (const word of words) {
      assert.ok(!wholeWord(word).test(text), `${file} mentions "${word}"`);
    }
  }
});

test('A2 JS files avoid network, storage, and dynamic code', () => {
  const banned = ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'document.cookie', 'eval(', 'new Function', 'import('];
  for (const file of JS_FILES) {
    const text = read(file);
    for (const token of banned) assert.ok(!text.includes(token), `${file} contains ${token}`);
  }
  const scoring = read('scoring.js');
  assert.ok(!/\b(window|document)\b/.test(scoring), 'scoring.js must not touch window or document');
});

test('A3 no external scripts, stylesheets, fonts, or non-relative imports', () => {
  const html = read('index.html');
  assert.ok(!/<script[^>]+src=["']https?:/i.test(html));
  assert.ok(!/<link[^>]+href=["']https?:/i.test(html));
  const css = read('style.css');
  assert.ok(!css.includes('@import'));
  assert.ok(!/url\(\s*["']?https?:/i.test(css));

  const specifiers = [];
  for (const text of [html, ...JS_FILES.map(read)]) {
    for (const match of text.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) specifiers.push(match[1]);
    for (const match of text.matchAll(/\bimport\s+['"]([^'"]+)['"]/g)) specifiers.push(match[1]);
  }
  assert.ok(specifiers.length >= 3);
  for (const spec of specifiers) assert.match(spec, /^\.\.?\//, `non-relative import ${spec}`);
});

test('A4 size budgets hold', () => {
  const size = (f) => statSync(new URL(`../${f}`, import.meta.url)).size;
  const shell = size('index.html') + size('style.css') + size('main.js') + size('scoring.js');
  assert.ok(shell <= 60 * 1024, `shell is ${shell} bytes`);
  assert.ok(size('data.js') <= 60 * 1024, `data.js is ${size('data.js')} bytes`);
});
