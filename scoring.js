// Pure functions only. No DOM access, no topic-specific strings.

const TIE_EPSILON = 1e-12;

/** Turn raw weights into shares that sum to 1. Throws on unusable input. */
export function normalize(weights, categoryIds) {
  let sum = 0;
  for (const id of categoryIds) {
    const value = weights[id];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid weight for "${id}": ${value}`);
    }
    sum += value;
  }
  if (sum <= 0) throw new Error('Weights must sum to more than 0');
  const shares = {};
  for (const id of categoryIds) shares[id] = weights[id] / sum;
  return shares;
}

/** Small deterministic random source (mulberry32). Same seed gives the same sequence. */
export function seededRandom(seed) {
  let a = Number(seed) >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle that returns a new array. */
export function shuffle(list, random) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Choose the question order: the configured first item, then a random draw of the rest.
 * n may be a positive integer, the string "all", or undefined (use config.quizLength).
 */
export function pickQuestions(config, random, n) {
  const total = config.items.length;
  let length;
  if (n === 'all') length = total;
  else if (Number.isInteger(n) && n > 0) length = n;
  else length = config.quizLength;
  length = Math.min(length, total);

  const first = config.items.find((item) => item.id === config.firstItemId);
  const rest = config.items.filter((item) => item !== first).map((item) => item.id);
  const ids = first ? [first.id, ...shuffle(rest, random)] : shuffle(rest, random);
  return ids.slice(0, length);
}

function fixed2(value) {
  return value.toFixed(2);
}

/** Score one answer. See SPEC.md section 7. */
export function score(item, choiceId, config) {
  const categoryIds = config.categories.map((c) => c.id);
  if (!categoryIds.includes(choiceId)) throw new Error(`Unknown category "${choiceId}"`);

  const shares = normalize(item.weights, categoryIds);
  const topShare = Math.max(...categoryIds.map((id) => shares[id]));
  const topIds = categoryIds.filter((id) => topShare - shares[id] < TIE_EPSILON);
  const ratio = shares[choiceId] / topShare;
  const points = Math.round(ratio * 100) / 100;
  const threshold = config.closeThreshold ?? 0.5;

  let verdict = 'wrong';
  if (points === 1) verdict = 'correct';
  else if (points >= threshold) verdict = 'close';

  return {
    itemId: item.id,
    choice: choiceId,
    top: topIds[0],
    topIds,
    tie: topIds.length > 1,
    shares,
    topShare,
    ratio,
    points,
    verdict,
    formula: `${fixed2(shares[choiceId])} / ${fixed2(topShare)} = ${fixed2(points)}`,
  };
}

export function totalPoints(results) {
  return results.reduce((sum, r) => sum + r.points, 0);
}

export function markFor(verdict) {
  if (verdict === 'correct') return '\u2713';
  if (verdict === 'close') return '~';
  return '\u2717';
}

/** Plain-text summary suitable for pasting into chat. */
export function shareText(results, config, url) {
  const total = totalPoints(results);
  const count = results.length;
  const percent = count === 0 ? 0 : Math.round((total / count) * 100);
  const marks = results.map((r) => markFor(r.verdict)).join('');
  return [`${config.title} ${total.toFixed(1)}/${count} (${percent}%)`, marks, url].join('\n');
}

/** Tab-separated debug table: header plus one row per answer. */
export function debugTsv(results, config) {
  const ids = config.categories.map((c) => c.id);
  const header = ['item', 'choice', 'top', ...ids.map((id) => `share_${id}`), 'points', 'verdict'];
  const rows = results.map((r) => [
    r.itemId,
    r.choice,
    r.top,
    ...ids.map((id) => fixed2(r.shares[id])),
    fixed2(r.points),
    r.verdict,
  ]);
  return [header, ...rows].map((cols) => cols.join('\t')).join('\n');
}
