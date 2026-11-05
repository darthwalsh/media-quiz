import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { QUIZ_CONFIG as config } from '../data.js';
import { mount } from '../main.js';
import { score } from '../scoring.js';

// jsdom does not run <script type="module">, so these tests parse the real index.html markup
// and call mount() directly. U12 checks the boot script separately.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cats = config.categories;
const itemById = new Map(config.items.map((i) => [i.id, i]));
const firstItem = itemById.get(config.firstItemId);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function boot({ search = '', hash = '' } = {}) {
  const dom = new JSDOM(html, { url: `http://localhost/${search}${hash}`, pretendToBeVisual: true });
  const { window } = dom;
  const clip = {
    text: null,
    async writeText(text) {
      this.text = text;
    },
  };
  mount(window.document, config, { location: window.location, clipboard: clip });
  return { window, doc: window.document, clip };
}

const button = (doc, text) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const pressKey = (window, key) =>
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }));

function topCategoryOf(item) {
  return score(item, cats[0].id, config).top;
}

test('U1 intro renders title, category blurbs, Start, and Answers/reference', () => {
  const { window, doc } = boot();
  assert.equal(doc.querySelector('h1').textContent, config.title);
  const legend = doc.querySelector('.legend').textContent;
  for (const c of cats) {
    assert.ok(legend.includes(c.label), c.label);
    assert.ok(legend.includes(c.blurb), `${c.label} blurb`);
  }
  assert.ok(button(doc, 'Start'));
  assert.ok(button(doc, 'Answers/reference'));
  window.close();
});

test('U2 Start shows question 1 with one button per category in config order', () => {
  const { window, doc } = boot();
  button(doc, 'Start').click();
  assert.equal(doc.querySelector('.ext').textContent, firstItem.label);
  const labels = [...doc.querySelectorAll('.choice .label')].map((n) => n.textContent);
  assert.deepEqual(labels, cats.map((c) => c.label));
  window.close();
});

test('U3 answering correctly shows a correct verdict, debug panel, and score', () => {
  const { window, doc } = boot();
  button(doc, 'Start').click();
  doc.querySelector(`.choice[data-cat="${topCategoryOf(firstItem)}"]`).click();
  const feedback = doc.querySelector('.feedback');
  assert.equal(feedback.dataset.verdict, 'correct');
  const debug = doc.querySelector('.debug').textContent;
  assert.ok(debug.includes(firstItem.id));
  assert.ok(debug.includes('points'));
  for (const c of cats) assert.ok(debug.includes(c.label), c.label);
  assert.ok(doc.querySelector('.next'));
  assert.match(doc.querySelector('.score').textContent, /1\.0\/1/);
  window.close();
});

test('U4 an incorrect answer matches scoring.score and prints the formula', () => {
  const { window, doc } = boot();
  button(doc, 'Start').click();
  const lowest = cats.reduce((a, b) => (firstItem.weights[b.id] < firstItem.weights[a.id] ? b : a));
  const expected = score(firstItem, lowest.id, config);
  doc.querySelector(`.choice[data-cat="${lowest.id}"]`).click();
  assert.equal(doc.querySelector('.feedback').dataset.verdict, expected.verdict);
  assert.ok(doc.querySelector('.debug').textContent.includes(`points = ${expected.formula}`));
  window.close();
});

test('U5 buttons lock after answering and a second click changes nothing', () => {
  const { window, doc } = boot();
  button(doc, 'Start').click();
  doc.querySelector('.choice').click();
  const before = doc.querySelector('.score').textContent;
  const choices = [...doc.querySelectorAll('.choice')];
  assert.ok(choices.every((b) => b.disabled));
  choices[1].click();
  assert.equal(doc.querySelector('.score').textContent, before);
  window.close();
});

test('U6 a short run ends with results, a debug table, and working copy buttons', async () => {
  const { window, doc, clip } = boot({ search: '?n=3&seed=1' });
  button(doc, 'Start').click();
  for (let i = 0; i < 3; i++) {
    doc.querySelector('.choice').click();
    doc.querySelector('.next').click();
  }
  assert.match(doc.querySelector('.total').textContent, /^\d+\.\d\/3$/);
  assert.equal(doc.querySelectorAll('.marks .mark').length, 3);
  assert.equal(doc.querySelectorAll('.debug-table tbody tr').length, 3);

  doc.querySelector('#copy-debug').click();
  await tick();
  const lines = clip.text.split('\n');
  assert.equal(lines.length, 4);
  assert.ok(lines[0].startsWith('item\tchoice\ttop'));

  doc.querySelector('#copy-result').click();
  await tick();
  assert.match(clip.text, /\/3/);
  assert.ok(clip.text.includes('http://localhost/?n=3&seed=1'));
  window.close();
});

test('U7 reference mode renders every item with one highlighted top category', () => {
  const { window, doc } = boot();
  button(doc, 'Answers/reference').click();
  assert.equal(doc.querySelectorAll('.row').length, config.items.length);
  for (const item of config.items) {
    const row = doc.getElementById(`ref-${item.id}`);
    assert.ok(row, item.id);
    assert.equal(row.querySelectorAll('.share.is-top').length, 1, item.id);
  }
  window.close();

  const direct = boot({ hash: '#ref' });
  assert.equal(direct.doc.querySelectorAll('.row').length, config.items.length);
  direct.window.close();
});

test('U7b quiz feedback uses the same row component as reference mode', () => {
  const { window, doc } = boot();
  button(doc, 'Start').click();
  doc.querySelector('.choice').click();
  const row = doc.querySelector('.feedback .row');
  assert.ok(row);
  assert.equal(row.querySelectorAll('.share').length, cats.length);
  assert.ok(row.querySelector('.contents'));
  window.close();
});

test('U8 a #ref/<id> deep link highlights that row', () => {
  const target = config.items[1].id;
  const { window, doc } = boot({ hash: `#ref/${target}` });
  const marked = doc.querySelectorAll('.row.is-target');
  assert.equal(marked.length, 1);
  assert.equal(marked[0].id, `ref-${target}`);
  window.close();
});

test('U8b Back returns to the screen you left', () => {
  const { window, doc } = boot();
  button(doc, 'Start').click();
  doc.querySelector('.choice').click();
  button(doc, 'Answers/reference').click();
  assert.ok(doc.querySelector('.reference'));
  button(doc, 'Back').click();
  assert.ok(doc.querySelector('.feedback'));
  window.close();
});

test('U9 number keys answer and Enter advances', () => {
  const { window, doc } = boot();
  button(doc, 'Start').click();
  pressKey(window, '3');
  const chosen = doc.querySelector('.choice.is-chosen');
  assert.equal(chosen.dataset.cat, cats[2].id);
  pressKey(window, 'Enter');
  assert.match(doc.querySelector('.progress').textContent, /Question 2 of/);
  window.close();
});

test('U10 accessibility smoke checks across screens', () => {
  const { window, doc } = boot();
  const check = () => {
    assert.ok(doc.documentElement.lang);
    assert.ok(doc.querySelector('meta[name="viewport"]'));
    assert.equal(doc.querySelectorAll('h1').length, 1);
    assert.ok(doc.querySelector('#live[aria-live]'));
    for (const a of doc.querySelectorAll('a')) {
      assert.ok(a.getAttribute('href'), 'link without href');
      assert.ok(a.textContent.trim(), 'link without text');
    }
    for (const b of doc.querySelectorAll('button')) assert.ok(b.textContent.trim(), 'button without text');
  };
  check();
  button(doc, 'Start').click();
  check();
  doc.querySelector('.choice').click();
  check();
  button(doc, 'Answers/reference').click();
  check();
  window.close();
});

test('U11 the correction link targets the repo issue form with the item id', () => {
  const { window, doc } = boot();
  button(doc, 'Start').click();
  doc.querySelector('.choice').click();
  const href = doc.querySelector('.feedback a.fix').getAttribute('href');
  assert.ok(href.startsWith(`${config.repoUrl}/issues/new`));
  assert.ok(href.includes(firstItem.id));
  window.close();
});

test('U12 index.html boots with exactly one module script', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1);
  assert.match(scripts[0][0], /<script\s+type="module"/);
  assert.match(scripts[0][1], /import\s*\{\s*mount\s*\}\s*from\s*'\.\/main\.js'/);
  assert.match(scripts[0][1], /import\s*\{\s*QUIZ_CONFIG\s*\}\s*from\s*'\.\/data\.js'/);
  assert.match(scripts[0][1], /mount\(document,\s*QUIZ_CONFIG\)/);
});

test('seeded runs are reproducible and respect ?n=', () => {
  const run = () => {
    const { window, doc } = boot({ search: '?n=4&seed=9' });
    button(doc, 'Start').click();
    const seen = [];
    for (let i = 0; i < 4; i++) {
      seen.push(doc.querySelector('.ext').textContent);
      doc.querySelector('.choice').click();
      doc.querySelector('.next').click();
    }
    window.close();
    return seen;
  };
  const a = run();
  assert.equal(a.length, 4);
  assert.equal(a[0], firstItem.label);
  assert.deepEqual(a, run());
});
