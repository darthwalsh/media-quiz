// Media-specific known answers. Delete or rewrite this file when changing the topic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUIZ_CONFIG as config } from '../data.js';
import { score } from '../scoring.js';

const byId = new Map(config.items.map((i) => [i.id, i]));
const topOf = (id) => score(byId.get(id), config.categories[0].id, config).top;

test('K1 item count and groups', () => {
  assert.ok(config.items.length >= 20 && config.items.length <= 30);
  assert.deepEqual([...new Set(config.items.map((i) => i.group))].sort(), ['Audio', 'Image', 'Video']);
});

test('K2 the quiz opens with .jpg', () => {
  assert.equal(config.firstItemId, 'jpg');
});

test('K3 known top categories', () => {
  const expected = {
    jpg: 'lossy',
    png: 'lossless',
    flac: 'lossless',
    wav: 'uncompressed',
    mp3: 'lossy',
    bmp: 'uncompressed',
    mkv: 'depends',
    mp4: 'depends',
    tiff: 'depends',
    ico: 'depends',
  };
  for (const [id, top] of Object.entries(expected)) assert.equal(topOf(id), top, id);
});

test('K4 fact-check decisions are guarded', () => {
  assert.ok(!byId.has('raw'));
  assert.ok(!byId.has('svg'));
  assert.ok(byId.has('dng'));
  assert.ok(byId.has('ico'));
});
