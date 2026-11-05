// DOM and events. No work happens at import time, so tests can import this module safely.
// No topic-specific strings: all content comes from the config passed to mount().

import {
  score,
  normalize,
  pickQuestions,
  seededRandom,
  totalPoints,
  markFor,
  shareText,
  debugTsv,
} from './scoring.js';

const CHECKED_TEXT = {
  primary: 'Checked against specs or vendor docs.',
  secondary: 'Checked against reference docs.',
  no: 'Not independently sourced.',
};

function h(doc, tag, attrs = {}, ...kids) {
  const el = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(typeof kid === 'object' ? kid : doc.createTextNode(String(kid)));
  }
  return el;
}

function percent(share) {
  return `${Math.round(share * 100)}%`;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function mount(doc, config, env = {}) {
  const win = doc.defaultView;
  const loc = env.location ?? win.location;
  const clipboard = env.clipboard ?? win.navigator.clipboard;

  const params = new URLSearchParams(loc.search || '');
  const seedParam = params.get('seed');
  const nRaw = params.get('n');
  const nParam = nRaw === 'all' ? 'all' : nRaw !== null && /^\d+$/.test(nRaw) ? Number(nRaw) : undefined;
  const random =
    env.random ?? (seedParam !== null && seedParam !== '' ? seededRandom(Number(seedParam)) : Math.random);

  const app = doc.getElementById('app');
  const live = doc.getElementById('live');
  const refButton = doc.getElementById('ref-button');
  const heading = doc.querySelector('h1');
  if (heading) heading.textContent = config.title;

  const cats = config.categories;
  const itemsById = new Map(config.items.map((item) => [item.id, item]));
  const state = { screen: 'intro', prev: 'intro', order: [], index: 0, results: [], refTarget: null };

  // ---------- helpers ----------

  const el = (tag, attrs, ...kids) => h(doc, tag, attrs, ...kids);

  function announce(text) {
    if (live) live.textContent = text;
  }

  function focusEl(node) {
    if (!node) return;
    if (!node.hasAttribute('tabindex') && !/^(BUTTON|A|INPUT|SUMMARY)$/.test(node.tagName)) {
      node.setAttribute('tabindex', '-1');
    }
    node.focus();
  }

  function setHash(hash) {
    try {
      win.history.replaceState(null, '', hash || win.location.pathname + win.location.search);
    } catch {
      // Some embedding contexts disallow history changes. The page still works.
    }
  }

  function pageUrl() {
    return String(loc.href ?? win.location.href).split('#')[0];
  }

  function answered() {
    return state.results.filter(Boolean);
  }

  function swatch(index) {
    return el('span', { class: `swatch cat-${index}`, 'aria-hidden': 'true' });
  }

  function issueUrl(item) {
    const title = encodeURIComponent(`Correction: ${item.label}`);
    const body = encodeURIComponent(`Item id: ${item.id}\n\nWhat should change, and a source if you have one:\n`);
    return `${config.repoUrl}/issues/new?title=${title}&body=${body}`;
  }

  // ---------- shared row (quiz feedback and reference mode) ----------

  function legend(withExamples) {
    return el(
      'dl',
      { class: 'legend' },
      cats.flatMap((c, i) => [
        el('dt', {}, swatch(i), c.label),
        el(
          'dd',
          {},
          c.blurb,
          withExamples && c.examples?.length ? ' Examples: ' : null,
          withExamples && c.examples
            ? c.examples.flatMap((example, k) => [k ? ', ' : null, el('code', {}, example)])
            : null,
        ),
      ]),
    );
  }

  function renderRow(item, { result = null, head = false, id = null } = {}) {
    const base = result ?? score(item, cats[0].id, config);
    const summary = cats.map((c) => `${c.label} ${percent(base.shares[c.id])}`).join(', ');

    const bar = el('div', { class: 'contents', role: 'img', 'aria-label': `Likely contents: ${summary}` });
    cats.forEach((c, i) => {
      const share = base.shares[c.id];
      if (share <= 0) return;
      const seg = el('span', { class: `seg cat-${i}`, title: `${c.label} ${percent(share)}` });
      seg.style.flexGrow = String(share * 100);
      seg.style.flexBasis = '0';
      bar.append(seg);
    });

    const shareList = el(
      'ul',
      { class: 'shares' },
      cats.map((c, i) => {
        const isTop = c.id === base.top;
        const isChosen = result !== null && result.choice === c.id;
        const flags = [isTop ? 'most likely' : null, isChosen ? 'your answer' : null].filter(Boolean).join(', ');
        return el(
          'li',
          { class: `share${isTop ? ' is-top' : ''}${isChosen ? ' is-chosen' : ''}`, 'data-cat': c.id },
          swatch(i),
          el('span', { class: 'name' }, c.label),
          el('span', { class: 'pct' }, percent(base.shares[c.id])),
          el('span', { class: 'flag' }, flags),
        );
      }),
    );

    const sourceLinks = item.sources.flatMap((url, k) => [
      k ? ', ' : null,
      el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, hostOf(url)),
    ]);

    return el(
      'article',
      { class: 'row', id },
      head
        ? el('div', { class: 'row-head' }, el('h4', { class: 'ext' }, item.label), el('span', { class: 'group' }, item.group))
        : null,
      bar,
      shareList,
      el('p', { class: 'note' }, item.note),
      el(
        'p',
        { class: 'meta' },
        `Weights are an estimate (confidence: ${item.confidence}). ${CHECKED_TEXT[item.checked] ?? ''}`,
      ),
      el(
        'p',
        { class: 'meta' },
        item.sources.length ? ['Sources: ', sourceLinks, '. '] : null,
        el('a', { class: 'fix', href: issueUrl(item), target: '_blank', rel: 'noopener noreferrer' }, 'Suggest a correction'),
      ),
    );
  }

  // ---------- screens ----------

  function renderIntro() {
    app.replaceChildren(
      el(
        'section',
        { class: 'intro' },
        el('p', { class: 'lede' }, config.prompt),
        (config.intro ?? []).map((text) => el('p', {}, text)),
        legend(true),
        el('div', { class: 'actions' }, el('button', { type: 'button', class: 'btn btn-primary', id: 'start', onclick: start }, 'Start')),
        el('p', { class: 'hint' }, `Keys 1 to ${cats.length} pick an answer. Enter moves on.`),
      ),
    );
  }

  function verdictText(result) {
    const word = { correct: 'Correct', close: 'Close', wrong: 'Not quite' }[result.verdict];
    return `${markFor(result.verdict)} ${word} (${result.points.toFixed(2)} points)`;
  }

  function debugPanel(item, result) {
    const labelWidth = Math.max(...cats.map((c) => c.label.length));
    const done = answered();
    const lines = [
      `item: ${item.id}`,
      `you chose: ${cats.find((c) => c.id === result.choice).label}`,
      'shares:',
      ...cats.map((c) => `  ${c.label.padEnd(labelWidth)}  ${result.shares[c.id].toFixed(2)}`),
      `top: ${cats.find((c) => c.id === result.top).label} (${result.topShare.toFixed(2)})${result.tie ? ', tied' : ''}`,
      `points = ${result.formula}`,
      `verdict: ${result.verdict}`,
      `running total: ${totalPoints(done).toFixed(2)}/${done.length}`,
    ];
    return el('details', { class: 'debug', open: true }, el('summary', {}, 'Scoring details'), el('pre', {}, lines.join('\n')));
  }

  function renderQuestion() {
    const item = itemsById.get(state.order[state.index]);
    const result = state.results[state.index] ?? null;
    const done = answered();
    const isLast = state.index === state.order.length - 1;

    const choices = el(
      'ol',
      { class: 'choices' },
      cats.map((c, i) => {
        const isTop = result !== null && c.id === result.top;
        const isChosen = result !== null && c.id === result.choice;
        const tags = [isTop ? 'most likely' : null, isChosen ? 'your answer' : null].filter(Boolean).join(', ');
        return el(
          'li',
          {},
          el(
            'button',
            {
              type: 'button',
              class: `choice${isTop ? ' is-top' : ''}${isChosen ? ' is-chosen' : ''}`,
              'data-cat': c.id,
              disabled: result !== null,
              onclick: () => answer(c.id),
            },
            el('kbd', { 'aria-hidden': 'true' }, String(i + 1)),
            swatch(i),
            el('span', { class: 'label' }, c.label),
            el('span', { class: 'tags' }, tags),
          ),
        );
      }),
    );

    const children = [
      el(
        'p',
        { class: 'progress' },
        el('span', {}, `Question ${state.index + 1} of ${state.order.length}`),
        el('span', { class: 'score' }, `Score ${totalPoints(done).toFixed(1)}/${done.length}`),
      ),
      el('div', { class: 'ext-line' }, el('h2', { class: 'ext' }, item.label), el('span', { class: 'group' }, item.group)),
      el('p', { class: 'question-prompt' }, config.prompt),
      choices,
    ];

    if (result) {
      children.push(
        el(
          'section',
          { class: 'feedback', 'data-verdict': result.verdict },
          el('p', { class: 'verdict' }, verdictText(result)),
          renderRow(item, { result }),
          debugPanel(item, result),
          el('button', { type: 'button', class: 'btn btn-primary next', onclick: next }, isLast ? 'See results' : 'Next question'),
        ),
      );
    }

    app.replaceChildren(el('section', { class: 'question' }, children));
    if (result) focusEl(app.querySelector('.next'));
    else focusEl(app.querySelector('.ext'));
  }

  async function copyText(text, message, statusNode) {
    try {
      if (!clipboard) throw new Error('Clipboard unavailable');
      await clipboard.writeText(text);
      statusNode.textContent = message;
      announce(message);
    } catch {
      const failure = 'Copy failed. Your browser blocked clipboard access.';
      statusNode.textContent = failure;
      announce(failure);
    }
  }

  function renderResult() {
    const results = state.results;
    const total = totalPoints(results);
    const count = results.length;
    const pct = count === 0 ? 0 : Math.round((total / count) * 100);
    const status = el('span', { class: 'status', role: 'status' });

    const headRow = el(
      'tr',
      {},
      ['Item', 'Your answer', 'Most likely', ...cats.map((c) => c.label), 'Points', 'Verdict'].map((t) => el('th', { scope: 'col' }, t)),
    );
    const bodyRows = results.map((r) => {
      const item = itemsById.get(r.itemId);
      return el(
        'tr',
        {},
        el('td', {}, item.label),
        el('td', {}, cats.find((c) => c.id === r.choice).label),
        el('td', {}, cats.find((c) => c.id === r.top).label),
        cats.map((c) => el('td', {}, r.shares[c.id].toFixed(2))),
        el('td', {}, r.points.toFixed(2)),
        el('td', {}, r.verdict),
      );
    });

    app.replaceChildren(
      el(
        'section',
        { class: 'result' },
        el('h2', { class: 'screen-title' }, 'Results'),
        el('p', { class: 'total' }, `${total.toFixed(1)}/${count}`),
        el('p', { class: 'percent' }, `${pct}%`),
        el(
          'p',
          { class: 'marks', 'aria-label': 'Answers in order' },
          results.map((r) => el('span', { class: 'mark', 'data-verdict': r.verdict, title: itemsById.get(r.itemId).label }, markFor(r.verdict))),
        ),
        el(
          'div',
          { class: 'actions' },
          el('button', { type: 'button', class: 'btn btn-primary', id: 'copy-result', onclick: () => copyText(shareText(results, config, pageUrl()), 'Result copied.', status) }, 'Copy result'),
          el('button', { type: 'button', class: 'btn', id: 'copy-debug', onclick: () => copyText(debugTsv(results, config), 'Debug table copied.', status) }, 'Copy debug table'),
          el('button', { type: 'button', class: 'btn', id: 'again', onclick: start }, 'Play again'),
          el('button', { type: 'button', class: 'btn', id: 'result-ref', onclick: () => openReference(null, true) }, 'Answers/reference'),
          status,
        ),
        el('div', { class: 'table-wrap' }, el('table', { class: 'debug-table' }, el('thead', {}, headRow), el('tbody', {}, bodyRows))),
      ),
    );
    focusEl(app.querySelector('.screen-title'));
  }

  function renderReference() {
    const groups = [...new Set(config.items.map((item) => item.group))];
    const sections = groups.flatMap((group) => [
      el('h3', { class: 'group-title' }, group),
      config.items.filter((item) => item.group === group).map((item) => renderRow(item, { head: true, id: `ref-${item.id}` })),
    ]);

    app.replaceChildren(
      el(
        'section',
        { class: 'reference' },
        el('div', { class: 'actions' }, el('button', { type: 'button', class: 'btn', id: 'back', onclick: back }, 'Back')),
        el('h2', { class: 'screen-title' }, 'Answers/reference'),
        el('p', { class: 'ref-intro' }, 'Every format with the estimated split of what you are likely to find inside, plus sources and a way to suggest a fix.'),
        legend(false),
        sections,
      ),
    );

    const target = state.refTarget ? doc.getElementById(`ref-${state.refTarget}`) : null;
    if (target) {
      target.classList.add('is-target');
      focusEl(target);
      if (target.scrollIntoView) target.scrollIntoView();
    } else {
      focusEl(app.querySelector('.screen-title'));
    }
  }

  function render() {
    if (state.screen === 'intro') renderIntro();
    else if (state.screen === 'question' || state.screen === 'feedback') renderQuestion();
    else if (state.screen === 'result') renderResult();
    else if (state.screen === 'reference') renderReference();
  }

  // ---------- actions ----------

  function start() {
    state.order = pickQuestions(config, random, nParam);
    state.results = [];
    state.index = 0;
    state.screen = 'question';
    state.refTarget = null;
    setHash('');
    render();
    announce(`Question 1 of ${state.order.length}: ${itemsById.get(state.order[0]).label}`);
  }

  function answer(choiceId) {
    if (state.screen !== 'question') return;
    const item = itemsById.get(state.order[state.index]);
    const result = score(item, choiceId, config);
    state.results[state.index] = result;
    state.screen = 'feedback';
    render();
    announce(verdictText(result));
  }

  function next() {
    if (state.screen !== 'feedback') return;
    state.index += 1;
    if (state.index >= state.order.length) {
      state.screen = 'result';
      render();
      announce(`Finished. Score ${totalPoints(state.results).toFixed(1)} of ${state.results.length}.`);
    } else {
      state.screen = 'question';
      render();
      announce(`Question ${state.index + 1} of ${state.order.length}: ${itemsById.get(state.order[state.index]).label}`);
    }
  }

  function openReference(targetId, updateHash) {
    if (state.screen !== 'reference') state.prev = state.screen;
    state.screen = 'reference';
    state.refTarget = targetId && itemsById.has(targetId) ? targetId : null;
    if (updateHash) setHash(state.refTarget ? `#ref/${state.refTarget}` : '#ref');
    render();
  }

  function back() {
    state.screen = state.prev || 'intro';
    state.refTarget = null;
    setHash('');
    render();
  }

  function fromHash(hash) {
    if (hash === '#ref') return { open: true, target: null };
    if (hash.startsWith('#ref/')) {
      let target = hash.slice(5);
      try {
        target = decodeURIComponent(target);
      } catch {
        target = '';
      }
      return { open: true, target };
    }
    return { open: false, target: null };
  }

  // ---------- wiring ----------

  if (refButton) refButton.addEventListener('click', () => openReference(null, true));

  doc.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (state.screen === 'question' && /^[1-9]$/.test(event.key)) {
      const category = cats[Number(event.key) - 1];
      if (category) {
        event.preventDefault();
        answer(category.id);
      }
      return;
    }

    if (state.screen === 'feedback') {
      const interactive = tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY';
      const advance = event.key === 'ArrowRight' || ((event.key === 'Enter' || event.key === ' ') && !interactive);
      if (advance) {
        event.preventDefault();
        next();
      }
    }
  });

  win.addEventListener('hashchange', () => {
    const parsed = fromHash(win.location.hash || '');
    if (parsed.open) openReference(parsed.target, false);
    else if (state.screen === 'reference') back();
  });

  const initial = fromHash(loc.hash || '');
  if (initial.open) {
    state.screen = 'reference';
    state.refTarget = initial.target && itemsById.has(initial.target) ? initial.target : null;
  }
  render();

  return { state };
}
