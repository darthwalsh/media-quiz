# What's in the box? Spec v0.1

Status: v0.2, implemented. Reference implementation: https://github.com/darthwalsh/media-quiz. Last updated October 30, 2026.

A single-page, static quiz and reference for media file formats. Someone sends you a file with a given extension. Is it uncompressed, lossless, lossy, or "it depends"?

This document is the source of truth. A model or a person should be able to regenerate the whole site from it, including for a different topic (see section 12).

---

## 1. Summary and goals

- **Quiz mode:** one extension at a time, four choices, instant feedback with the scoring math printed.
- **Answers/reference mode:** the same screen layout with every answer already filled in. This doubles as a lookup table.
- **Audience:** a hobbyist, Hacker News–style reader. Fast, plain, correct, and worth bookmarking.
- **Primary insight the site teaches:** for some extensions the codec is fixed (`.mp3`, `.flac`); for others the extension is only a wrapper (`.mkv`, `.mp4`) or hides a per-file switch (`.tiff`, `.webp`). Knowing which is which tells you whether you need to probe the file (for example with `ffprobe`) before you can handle it.

## 2. Non-goals for V1

- No backend, accounts, analytics, cookies, or `localStorage`.
- No draggable ternary triangle (V2).
- No non-media formats such as PDF, CSV, JSON, ZIP, or 3D meshes (V2).
- No user-submitted data or leaderboards.
- No framework, bundler, or build step.

## 3. Concepts and terminology

The quiz asks one question per extension: *"Someone sends you a file with this extension. What's most likely inside?"*

| id | Label | Meaning |
| --- | --- | --- |
| `uncompressed` | Uncompressed | Pixels or samples stored literally, one value after another, with no compression applied. File size follows directly from resolution (or sample rate) and bit depth. A BMP screenshot and a typical WAV recording are examples. |
| `lossless` | Lossless compressed | Compressed, but decodes to exactly the same pixels or samples as the uncompressed version, bit for bit. Usually smaller on disk than that uncompressed version. PNG and FLAC are examples. |
| `lossy` | Lossy compressed | Smaller, and permanently discards data judged unimportant. |
| `depends` | It depends | The extension does not tell you. Either it is a container whose codec is a separate per-file choice, or it is a single format with a per-file compression switch. |

### Authoring rubric for the `depends` weight

Every item carries a weight for all four categories. The `depends` weight expresses how often the extension alone fails to predict the answer.

- 60 or more: pure containers with no strong default.
- 30–60: containers or formats with a per-file compression switch where real-world files genuinely split.
- 20 or less: formats with a strong default and rare exceptions.
- 0: the format is a single fixed codec.

**Not the same as camera raw.** A camera raw file (`.dng`, `.nef`, `.cr3`) holds sensor readings before demosaicing, typically 12 to 14 bits per photosite in a Bayer pattern, not 3 bytes of RGB per pixel. "Camera raw" describes *what the data is*; "uncompressed" describes *how it is stored*. A camera raw file can itself be stored uncompressed, lossless, or lossy. The quiz uses the word "uncompressed" for the storage question and treats camera raw as just another image format (`.dng`). The intro screen (R1) must make this distinction in one sentence.

These weights are **editorial estimates**, not measured data. No public dataset of within-format splits was found (see Appendix B). They are expected to be tuned after friends try V1.

## 4. Functional requirements

Each requirement has an ID that the tests reference.

**Intro and flow**

- **R1.** The intro screen shows the title, a short explanation of the four categories with examples of each (including one sentence saying that camera raw is a different thing from uncompressed), a one-paragraph explanation of what a container format is, a **Start** button, and an **Answers/reference** button.
- **R2.** Start goes straight to question 1. No extra screens.
- **R3.** Question 1 is always the item named by `firstItemId` (V1: `.jpg`). Remaining questions are drawn at random without replacement. Total length is `quizLength` (default 12), overridable with `?n=<number>` or `?n=all`. `?seed=<integer>` makes the order reproducible.

**Question and feedback**

- **R4.** A question shows the item label (for example `.mkv`), its group tag (Image, Audio, Video), the prompt, and one button per category in config order.
- **R5.** After an answer, the buttons lock and the screen shows: the verdict (text plus symbol: `✓ correct`, `~ close`, `✗ wrong`), the normalized weights as labeled bars with percentages, the item note, the sources, and the debug panel (R7). A **Next** button appears. The final question's Next reads **See results**.
- **R6.** Points follow section 7 exactly.
- **R7.** The debug panel is a `<details open>` block under every answer. It prints: item id, chosen category, normalized shares for every category, the top category and its share, the formula with numbers substituted (for example `0.25 / 0.45 = 0.56`), the verdict, and the running total.
- **R8.** A "Report a correction" link sits next to the note. It opens a new GitHub issue on `repoUrl` with the item id in the title.

**Results and sharing**

- **R9.** The result screen shows the total (for example `8.5/12`), the percentage, one mark per question (`✓`, `~`, `✗`), and these buttons: **Copy result**, **Copy debug table**, **Play again**, **Answers/reference**.
- **R10.** **Copy result** puts plain text on the clipboard: title line with score and percent, one line of marks, and the page URL.
- **R11.** **Copy debug table** puts tab-separated text on the clipboard with a header row and one row per answer, ready to paste into a spreadsheet. A visible HTML table with the same data is also shown on the result screen.

**Reference mode**

- **R12.** The **Answers/reference** button is reachable from every screen. It renders every item, grouped, using the same row component and CSS classes as the quiz feedback. Each row shows the label, the highlighted top category, the weight bars, the note, the sources, and the correction link.
- **R13.** Each reference row has `id="ref-<itemId>"`. The hash `#ref` opens reference mode on load. The hash `#ref/<itemId>` opens it and highlights that row.

**Input**

- **R14.** Keyboard: number keys `1` to `n` pick a category; Enter, Space, or the right arrow advances after feedback.

**Configuration**

- **R15.** All domain content lives in `data.js` (section 6). The engine files contain no topic-specific strings.

## 5. Non-functional requirements

- **N1.** Works as static files. No runtime network requests except same-origin loads of the site's own files (HTML, CSS, JS modules). No third-party hosts.
- **N2.** Plain ES modules (`<script type="module">`, `import`/`export`), no bundler or transpiler. Opening `index.html` from `file://` is **not** supported; use any static HTTP server during development (section 9). GitHub Pages serves modules correctly as-is.
- **N3.** Budgets: `index.html` + `style.css` + `main.js` + `scoring.js` ≤ 60 KB combined; `data.js` ≤ 60 KB.
- **N4.** Accessibility: real `<button>` elements, visible focus, an `aria-live="polite"` region for feedback, verdicts never conveyed by color alone, `<html lang="en">`, one `<h1>`.
- **N5.** Light and dark themes via `prefers-color-scheme`. System fonts only (monospace for the extension itself, nothing else). No web fonts, images, or icon fonts.
- **N6.** Usable at 320 px width and up. Latest Chrome, Firefox, and Safari. ES2020 syntax with modules; no top-level await.
- **N7.** No cookies, `localStorage`, `sessionStorage`, or analytics.
- **N8.** Engine is topic-agnostic and supports 2 to 6 categories, not exactly four.

## 6. Architecture and file layout

Decision: separate small files, no build step. Data is separate from logic so it can be edited without touching code, and the scoring logic can be unit-tested in Node.

```
whats-in-the-box/
  index.html     markup shell, static <title> and meta description, and one inline module boot script (see below)
  style.css
  data.js        exports QUIZ_CONFIG, the only domain-specific file
  scoring.js     named exports, pure functions, no DOM
  main.js        exports mount(); DOM, screens, events; no topic strings
  CNAME          contains exactly: media.carlwa.com
  .nojekyll      empty file
  README.md      what it is, how to run tests, how to fix a data row
  SPEC.md        this document
  package.json   "type": "module"; scripts: dev, test, check-links; devDependency: jsdom
  tests/
    scoring.test.js
    config.test.js
    engine-agnostic.test.js
    ui.test.js
    canaries.media.test.js   domain-specific; replace when changing topic
  scripts/
    check-links.mjs          optional, needs network
```

**Module pattern.** Node tests and the browser import the same files. Nothing in `scoring.js` or `data.js` touches `window` or `document`.

```js
// data.js
export const QUIZ_CONFIG = { /* ... */ };

// scoring.js
export function normalize(weights, categoryIds) { /* ... */ }
export function score(item, choiceId, config) { /* ... */ }
export function seededRandom(seed) { /* returns a () => [0,1) function; same seed, same sequence */ }
export function pickQuestions(config, random, n) { /* ... */ }
export function shareText(results, config, url) { /* ... */ }
export function debugTsv(results, config) { /* ... */ }

// main.js: no work at import time, so tests can import it safely
import { score, pickQuestions, shareText, debugTsv } from './scoring.js';
export function mount(doc, config, env = {}) {
  // env.location, env.clipboard, env.random are injectable for tests;
  // they default to window.location, navigator.clipboard, Math.random
}
```

```html
<!-- index.html, the only boot code -->
<script type="module">
  import { mount } from './main.js';
  import { QUIZ_CONFIG } from './data.js';
  mount(document, QUIZ_CONFIG);
</script>
```

Why `mount()` instead of a self-starting `main.js`: jsdom does not execute `<script type="module">`. Exporting `mount(doc, config, env)` lets the UI tests parse the real `index.html` markup, then call `mount` directly with a jsdom document and stubbed clipboard, location, and random source.

### Config schema (`QUIZ_CONFIG`)

```js
{
  id: "media-formats",
  title: "What's in the box?",
  prompt: "Someone sends you a file with this extension. What's most likely inside?",
  intro: ["Paragraph on containers.", "One sentence distinguishing camera raw from uncompressed."],
  repoUrl: "https://github.com/darthwalsh/media-quiz",
  firstItemId: "jpg",
  quizLength: 12,
  closeThreshold: 0.5,
  categories: [
    { id: "uncompressed", label: "Uncompressed", blurb: "...", examples: [".bmp", ".wav"] }
    // lossless, lossy, depends
  ],
  items: [
    {
      id: "jpg",                    // [a-z0-9-], unique
      label: ".jpg",
      aliases: [".jpeg"],           // optional
      group: "Image",
      weights: { uncompressed: 0, lossless: 1, lossy: 99, depends: 0 },
      confidence: "high",           // high | medium | low: confidence in the weights
      checked: "primary",           // primary | secondary | no: how the structural facts were verified
      note: "One sentence, 160 characters or fewer.",
      sources: ["https://..."]      // https URLs; may be empty only when checked is "no"
    }
  ]
}
```

## 7. Scoring specification

Prototype scoring. Simple on purpose, fully printed in the debug panel so friends can argue with it.

1. **Normalize:** `share[c] = weight[c] / sum(weights)` for every category. Throw if the sum is 0 or any weight is negative or not finite.
2. **Top:** `topShare = max(share)`. The top category is the first category in config order that attains it. Ties are flagged `tie: true` and both tied categories score 1.
3. **Points:** `points = round(share[choice] / topShare, 2)`, so the range is 0 to 1.
4. **Verdict:** `correct` if `points === 1`; `close` if `points >= closeThreshold`; otherwise `wrong`.
5. **Total:** sum of the rounded per-question points, displayed with one decimal.

Worked examples (seed data):

| Item | Choice | Shares | Points | Verdict |
| --- | --- | --- | --- | --- |
| `.jpg` | lossy | lossy 0.99 | 0.99 / 0.99 = 1.00 | correct |
| `.tiff` | depends | depends 0.45 | 0.45 / 0.45 = 1.00 | correct |
| `.tiff` | uncompressed | uncompressed 0.25 | 0.25 / 0.45 = 0.56 | close |
| `.tiff` | lossy | lossy 0.05 | 0.05 / 0.45 = 0.11 | wrong |
| `.bmp` | lossless | lossless 0.04 | 0.04 / 0.95 = 0.04 | wrong |

## 8. Content scope for V1

Media only: 25 items. Image 13, Audio 6, Video 6. Seed weights, notes, and sources are in Appendix A. The fact-check log is in Appendix B.

Changes from the Gemini draft, all explained in Appendix B:

- `.raw` removed. There is no single `.raw` format. Replaced by `.dng`.
- `.svg` removed. It is vector XML text and does not fit the three data categories.
- `.ico` kept (it was briefly dropped, then restored). Fact-checked as a container of BMP-style bitmaps or PNG images, so its answer is "it depends".
- `.avif` and `.tga` kept; `.tiff`, `.wmv`, `.webp`, and `.flac` reclassified or re-described.

## 9. Executable verification

Requires Node 20 or newer. Zero-config test runner (`node:test`), one dev dependency (`jsdom`), and any static HTTP server for manual runs.

```
npm install
npm run dev         # python3 -m http.server 8000, then open http://localhost:8000 (or: npx serve)
npm test            # runs every tests/*.test.js with node --test
npm run check-links # optional: HEAD-requests every source URL; needs network
```

### Test cases

**`tests/scoring.test.js`** (engine, uses synthetic fixtures, not seed data)

- **S1.** `normalize({a:2,b:2})` gives `{a:0.5,b:0.5}`; shares sum to 1 within 1e-9.
- **S2.** `normalize` throws on all-zero, negative, or non-finite weights.
- **S3.** Choosing the top category yields points 1 and verdict `correct`.
- **S4.** Weights `{a:60,b:30,c:10}`: choosing `b` gives 0.5 and `close` at threshold 0.5; choosing `c` gives 0.17 and `wrong`.
- **S5.** A tie at the top gives both tied categories points 1 and sets `tie: true`.
- **S6.** `pickQuestions` with `seededRandom(seed)`: first id equals `firstItemId`; length equals `min(n, items.length)`; no duplicates; same seed gives the same order; across 20 different seeds at least 5 distinct orders occur.
- **S7.** `shareText` contains `x/y`, the percentage, exactly one mark per answer, and the URL.
- **S8.** `debugTsv` has the header `item, choice, top`, then one `share_<categoryId>` column per category, then `points, verdict`, and one row per answer; numbers use two decimals.
- **S9.** Everything works with 3 categories and with 5 categories.

**`tests/config.test.js`** (schema checks on `data.js`; domain-agnostic)

- **C1.** All required top-level keys exist.
- **C2.** 2–6 categories; ids unique; labels non-empty.
- **C3.** Item ids unique and match `^[a-z0-9-]+$`; label, group, note non-empty; note ≤ 160 characters.
- **C4.** Each item has a weight for every category id and no extra keys; weights finite and ≥ 0; sum > 0.
- **C5.** Warn (do not fail) when a weight sum is not 100.
- **C6.** Each item has a unique top category (no tie at the top).
- **C7.** `confidence` is one of `high|medium|low`; `checked` is one of `primary|secondary|no`; `sources` is an array of `https://` URLs and is empty only when `checked` is `no`.
- **C8.** `firstItemId` exists; `quizLength ≤ items.length`; `0 < closeThreshold ≤ 1`.
- **C9.** Aliases are unique across items and never collide with an id or label.

**`tests/engine-agnostic.test.js`**

- **A1.** `main.js`, `scoring.js`, and `style.css` contain none of the item labels, item ids (3 or more characters), or category labels from `data.js`, matched as whole words, case-insensitive.
- **A2.** The JS files contain none of: `fetch(`, `XMLHttpRequest`, `localStorage`, `sessionStorage`, `document.cookie`, `eval(`, `new Function`, dynamic `import(`. `scoring.js` never mentions `window` or `document`; `data.js` must import cleanly in Node (which the config tests prove).
- **A3.** `index.html` has no `<script src>` or `<link href>` pointing at `http://` or `https://`, and every `import` specifier is a relative path; `style.css` has no `@import` and no `url(http`.
- **A4.** Size budgets from N3 hold.

**`tests/ui.test.js`** (jsdom parses the real `index.html` markup; the test then calls `mount(document, QUIZ_CONFIG, { location, clipboard, random })`)

- **U1.** Intro renders the title, a blurb for every category, **Start**, and **Answers/reference**.
- **U2.** Start shows question 1 with the `firstItemId` label and one answer button per category, in config order with config labels.
- **U3.** Answering correctly: feedback has `data-verdict="correct"`; the debug panel contains the item id, the word "points", and a share for every category; **Next** appears; the running score reads `1.0/1`.
- **U4.** Answering incorrectly: the verdict matches what `scoring.score` returns for the same inputs, and the debug points equal that value.
- **U5.** After answering, the buttons are disabled and a second click does not change the score.
- **U6.** With `?n=3&seed=1`, three answers lead to a result screen showing `x/3`, one mark per question, a debug table with 3 rows, and **Copy debug table** (clipboard stubbed) producing a header plus 3 rows.
- **U7.** Reference mode (button and `#ref`) renders exactly `items.length` rows; each has `id="ref-<id>"`, exactly one highlighted top category, and the same row class as quiz feedback.
- **U8.** `#ref/<id>` marks that row with `.is-target`.
- **U9.** Pressing `3` on a question answers with the third category; Enter advances.
- **U10.** Accessibility smoke: `<html lang>`, viewport meta, exactly one `<h1>`, an `aria-live` region, and every interactive element is a `<button>` or an `<a href>` with text.
- **U11.** The correction link points to `repoUrl + "/issues/new"` and includes the item id.
- **U12.** Boot check (static, because tests bypass the inline script): `index.html` contains exactly one `<script type="module">` that imports `mount` from `./main.js` and `QUIZ_CONFIG` from `./data.js` and calls `mount(document, QUIZ_CONFIG)`.

**`tests/canaries.media.test.js`** (media-specific; delete or rewrite when changing topic)

- **K1.** Between 20 and 30 items. Groups are exactly Image, Audio, Video.
- **K2.** `firstItemId === "jpg"`.
- **K3.** Top categories: `jpg` lossy; `png` lossless; `flac` lossless; `wav` uncompressed; `mp3` lossy; `bmp` uncompressed; `mkv` depends; `mp4` depends; `tiff` depends; `ico` depends.
- **K4.** Ids `raw` and `svg` are absent; `dng` and `ico` are present (guards the fact-check decisions).

The reference implementation also has U7b (quiz feedback reuses the reference row), U8b (Back restores the previous screen), and a seeded-run reproducibility test.

Link checking: `npm run check-links` fails in sandboxes without outbound network (every URL reports `ENOTFOUND`). Run it on a normal machine.

### Manual acceptance (about 10 minutes)

- `npm run dev`, open http://localhost:8000: the whole flow works, and the browser console shows no errors.
- Run the quiz twice with different seeds; verify the debug numbers by hand for one answer.
- Resize to 320 px; toggle OS dark mode; tab through the page using only the keyboard.
- Open http://localhost:8000/#ref/tiff: the TIFF row is highlighted.

## 10. Deployment: GitHub Pages and the subdomain

The repository is `darthwalsh/media-quiz`. GitHub user: `darthwalsh`.

1. **Create the repo** and push the files. Pages for free accounts has historically required a public repo; check **Settings → Pages** if unsure.
2. **Settings → Pages:** deploy from branch `main`, folder `/ (root)`.
3. **Add the custom domain in repo settings first:** type `media.carlwa.com` and save. GitHub commits a `CNAME` file containing that domain. GitHub's docs warn that configuring DNS before adding the domain to GitHub can let someone else claim the subdomain.
4. **Add the DNS record** at your DNS provider: type `CNAME`, name `media`, value `darthwalsh.github.io`. The value is your user or organization domain, never including the repo name. Propagation can take up to 24 hours.
5. **Enforce HTTPS** in Settings → Pages once the certificate is issued.
6. **Optional hardening:** verify `carlwa.com` in your GitHub account's Pages settings, which GitHub recommends to prevent takeover.

Post-deploy checks:

- **D1.** `dig +short media.carlwa.com` returns `darthwalsh.github.io.` among its answers.
- **D2.** `curl -sI https://media.carlwa.com | head -n 1` shows a 200 status.
- **D3.** `curl -s https://media.carlwa.com | grep -c "<title>"` prints at least 1.

Naming note: `media.carlwa.com` fits V1. If V2 adds documents, archives, and 3D meshes, a name like `formats.carlwa.com` will age better. Changing it later means editing `CNAME` and one DNS record, so this is a low-stakes choice.

## 11. Style and copy

- Sentence case for all headings, buttons, labels, and display text; capitalize only the first word and proper nouns. Examples: "Answers/reference", "Copy result", "See results".
- No spaces around slashes, hyphens, en dashes, or em dashes.
- Tone: terse and accurate; dry humor welcome in the intro only. Notes state facts; they never moralize about formats.

## 12. Regenerating for a different domain

The engine (`scoring.js`, `main.js`, `style.css`, `index.html` structure) is topic-agnostic. To build a sibling quiz, for example 3D mesh formats:

1. Copy the repo.
2. Rewrite `data.js` following the schema in section 6: new categories (2–6), new items, new weights, a new `firstItemId`, new `intro`.
3. Update the static `<title>` and meta description in `index.html`, and the `CNAME` file.
4. Delete `tests/canaries.media.test.js` and write a new canaries file with 5–10 known-answer checks for the new topic.
5. Run `npm test`. Everything except the canaries is topic-agnostic and must pass unchanged.

Prompt contract for a model: *"Read SPEC.md. Generate index.html, style.css, scoring.js, main.js, data.js, package.json, and all tests exactly as specified. Run `npm install && npm test` and iterate until it exits 0. Do not add dependencies other than jsdom."*

## 13. V2 backlog

- Draggable pin on a ternary plot of uncompressed, lossless, and lossy, scored by distance to a target coordinate.
- Non-media formats: PDF, CSV, JSON, ZIP, TXT.
- 3D mesh formats: `.obj`, `.gltf`, `.glb`, `.stl`, `.fbx`.
- A "who sent it" lens for ambiguous formats (photographer vs. office scanner vs. medical system).
- Show web prevalence from W3Techs next to image formats (display only, not used in scoring).
- Candidates to verify first: `.opus`, `.aiff`, `.jxl`, `.ts`, `.flv`, `.3gp`.

---

## Appendix A: seed data

Weights are in the order uncompressed, lossless, lossy, depends. Each row sums to 100. This table mirrors `data.js`; if they diverge, `data.js` wins. **Checked** values: `primary` = spec or vendor documentation; `secondary` = reputable reference or tooling documentation; `no` = training knowledge only, not independently sourced in this pass.

| id | group | uncompressed | lossless | lossy | depends | confidence | checked | note |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| jpg | Image | 0 | 1 | 99 | 0 | high | secondary | DCT-based lossy. A lossless JPEG mode exists but is rarely implemented. |
| png | Image | 0 | 100 | 0 | 0 | high | no | Filter plus DEFLATE. Lossless even if the palette was quantized beforehand. |
| gif | Image | 0 | 100 | 0 | 0 | high | no | LZW compression, 256 colors per frame. Frames make it look like a container, but there is one codec. |
| webp | Image | 0 | 10 | 35 | 55 | medium | primary | RIFF container holding VP8 (lossy) or VP8L (lossless), chosen per file. |
| heic | Image | 0 | 3 | 85 | 12 | medium | secondary | HEIF container with HEVC. Lossy by default; lossless is allowed but rare. |
| avif | Image | 0 | 5 | 80 | 15 | medium | secondary | HEIF container with AV1. Lossy is typical; lossless is supported. |
| bmp | Image | 95 | 4 | 1 | 0 | high | primary | Usually uncompressed. RLE4 and RLE8 exist for indexed images; embedded JPEG and PNG modes exist but are rare. |
| tiff | Image | 25 | 25 | 5 | 45 | medium | primary | One tag selects none, PackBits, LZW, Deflate, JPEG, or CCITT, so the extension cannot tell you. |
| psd | Image | 10 | 75 | 0 | 15 | medium | secondary | Layered document. Pixel data is stored uncompressed, RLE, or ZIP, all lossless. |
| exr | Image | 5 | 40 | 10 | 45 | low | secondary | Per-file choice among none, lossless (RLE, ZIP, PIZ), and lossy (B44, DWA) compression. |
| tga | Image | 55 | 40 | 0 | 5 | low | no | RLE is optional. The real-world split is a guess. |
| dng | Image | 12 | 45 | 8 | 35 | low | secondary | TIFF-based camera raw container. Data may be uncompressed, lossless, or lossy. |
| ico | Image | 30 | 30 | 0 | 40 | medium | secondary | Container of one or more images, each an uncompressed BMP-style bitmap or a PNG. |
| mp3 | Audio | 0 | 0 | 100 | 0 | high | no | MPEG audio frames with optional ID3 tags. Always lossy. |
| wav | Audio | 92 | 0 | 3 | 5 | high | primary | RIFF container, nearly always PCM. ADPCM and MP3 payloads exist. |
| flac | Audio | 0 | 100 | 0 | 0 | high | primary | One lossless codec. It can also be wrapped in Ogg, Matroska, or MP4. |
| m4a | Audio | 0 | 5 | 60 | 35 | medium | secondary | MP4 audio container holding AAC (lossy) or ALAC (lossless). |
| aac | Audio | 0 | 0 | 100 | 0 | high | secondary | Usually a bare ADTS stream with no container. |
| ogg | Audio | 0 | 5 | 60 | 35 | medium | secondary | Ogg container: Vorbis or Opus (lossy), or FLAC (lossless). |
| mp4 | Video | 0 | 0 | 30 | 70 | high | secondary | ISO base media container. The codec is a separate per-file choice. |
| mkv | Video | 0 | 2 | 13 | 85 | high | secondary | Matroska accepts nearly any video and audio codec. |
| mov | Video | 2 | 1 | 17 | 80 | medium | no | QuickTime container. ProRes, H.264, and uncompressed video all occur. |
| avi | Video | 0 | 0 | 20 | 80 | medium | secondary | Legacy RIFF-based container that holds many codecs. |
| webm | Video | 0 | 0 | 45 | 55 | medium | secondary | Matroska subset limited to VP8, VP9, or AV1 video and Vorbis or Opus audio. |
| wmv | Video | 0 | 0 | 60 | 40 | medium | secondary | ASF container. By convention it holds Windows Media codecs; other payloads should use `.asf`. |

Sources by row (store these in each item's `sources` array):

- **jpg:** https://testing.developer.gimp.org/core/standards/images
- **webp:** https://developers.google.com/speed/webp/docs/riff_container
- **heic, avif:** https://en.wikipedia.org/wiki/AVIF and https://loc.gov/preservation/digital/formats/fdd/fdd000525.shtml
- **bmp:** https://msdn.microsoft.com/en-us/library/dd183376
- **tiff:** https://www.itu.int/itudoc/itu-t/com16/tiff-fx/docs/tiff6.pdf
- **psd:** https://docs.fileformat.com/image/psd
- **exr:** https://en.wikipedia.org/wiki/OpenEXR
- **dng:** https://en.wikipedia.org/wiki/Raw_image_format and https://www.loc.gov/preservation/digital/formats/fdd/fdd000241.shtml
- **wav:** https://help.ableton.com/hc/en-us/articles/211427589 and https://learn.microsoft.com/en-us/windows/win32/xaudio2/resource-interchange-file-format--riff-
- **flac:** https://datatracker.ietf.org/doc/rfc9639 and https://xiph.org/flac/ogg_mapping.html
- **m4a, aac:** https://hydrogenaudio.org/index.php?msg=450245
- **ogg:** https://xiph.org/flac/ogg_mapping.html
- **webm:** https://en.wikipedia.org/wiki/WebM
- **wmv:** https://en.wikipedia.org/wiki/Windows_Media_Video
- **mkv:** https://en.wikipedia.org/wiki/Video_file_format
- **mp4:** https://en.wikipedia.org/wiki/MP4_file_format and https://en.wikipedia.org/wiki/Video_file_format
- **avi:** https://www.cincopa.com/learn/demystifying-video-containers-mp4-mov-mkv-avi-webm and https://en.wikipedia.org/wiki/Video_file_format
- **ico:** https://docs.fileformat.com/image/ico and https://searchfox.org/firefox-main/source/image/ICOFileHeaders.h

Source URLs should be link-checked (`npm run check-links`) before launch. Several are encyclopedic or tooling references rather than formal specifications; upgrade them to specs where a stable URL exists.

## Appendix B: fact-check log

Claims from the Gemini conversation, checked on October 28, 2026.

| Claim | Verdict | Detail |
| --- | --- | --- |
| `.wav` is a RIFF container, usually PCM, can hold compressed audio | **Confirmed** | Ableton's help page says WAV can also contain compressed formats such as MP3. WAVE format tags include PCM, ADPCM, A-law, µ-law, and IEEE float. |
| `.wav` is about 10 MB per minute at CD quality | **Confirmed** | 44,100 Hz × 2 bytes × 2 channels × 60 s is about 10.6 MB. |
| `.flac` is "not a container" (first table) and "its own container" (later) | **Gemini contradicted itself** | RFC 9639 defines a thin native transport and mappings into Ogg, Matroska, and MP4. V1 treats FLAC as one lossless codec format. |
| `.raw` is a camera sensor format (the extension, not the concept) | **Dropped** | There is no single `.raw` standard. Camera raw is a family of vendor formats (CR2/CR3, NEF, ARW, RAF, ORF, DNG and others). NEF, ARW, and DNG each allow uncompressed, lossless, or lossy storage per file. Replaced with `.dng`. |
| `.svg` is "Compressed" | **Dropped** | SVG is vector XML text (gzip only as `.svgz`). It does not fit uncompressed, lossless, or lossy. Not independently sourced in this pass. |
| `.wmv` is a "proprietary codec/container" | **Corrected** | It is an ASF container with Windows Media Video codecs by convention. Microsoft's guidance is to use `.asf` when the payload is not Windows Media. |
| `.bmp` is typically uncompressed but can use RLE | **Confirmed** | Microsoft's header documentation lists BI_RGB (none), BI_RLE8, BI_RLE4, BI_JPEG, and BI_PNG. RLE applies to 8 and 4 bits per pixel. Your college RLE memory was correct. |
| `.png` uses filtering plus DEFLATE, not RLE | **Not re-checked** | Standard knowledge; consistent with the PNG specification. |
| `.webp` is a compressed container | **Refined** | RIFF container with a VP8 (lossy) or VP8L (lossless) chunk, chosen per file. So the honest answer is "it depends". |
| `.heic` and `.avif` are HEIF containers | **Confirmed** | HEIC uses HEVC; AVIF uses AV1. Lossless is allowed in both but uncommon. The "rare in practice" detail for HEIC comes from a secondary source. |
| `.exr` supports both lossless and lossy | **Confirmed** | Options include none, RLE, ZIP, PIZ (lossless), PXR24 (lossless for half floats), B44 and DWA (lossy). |
| `.psd` is compressed with RLE | **Refined** | Image data is stored uncompressed, RLE (PackBits), ZIP, or ZIP with prediction. None are lossy. |
| `.tiff` is uncompressed (first table) | **Corrected** | A compression tag picks none, PackBits, LZW, Deflate, JPEG, or CCITT. Gemini's later table acknowledged this. |
| `.m4a` holds AAC or ALAC in an MP4 container | **Confirmed** | |
| `.aac` is a raw stream | **Confirmed** | Usually bare ADTS, with no container metadata. |
| `.webm` is a Matroska subset | **Confirmed** | Limited to VP8, VP9, or AV1 video and Vorbis or Opus audio. |
| `.mkv` holds almost any codec | **Confirmed** | |
| `.jpg` is "hard-coded to DCT compression" | **Nuance** | A lossless JPEG mode exists but is so rarely implemented that the format is widely treated as lossy. |
| `.ogg` is a container | **Partly checked** | FLAC-in-Ogg is documented by Xiph. Vorbis and Opus payloads are standard knowledge; no separate source retrieved. |
| `.ico` is a container for BMP or PNG | **Confirmed** | An ICONDIR header lists one or more images, each BMP/DIB data or, since Windows Vista, PNG. Kept in V1. Sources: Mozilla's ICO header source and docs.fileformat.com. |
| `.avi` is RIFF-based | **Confirmed (secondary)** | Vendor explainer; upgraded from unsourced. |
| `.mp4` is derived from QuickTime | **Confirmed** | Wikipedia's MP4 article says the format is directly based on the QuickTime File Format. |
| `.mov` holds ProRes, H.264, and uncompressed; `.mp3` is a bare stream; `.gif` is LZW | **Not re-checked** | Standard knowledge, marked `checked: "no"` in the data. |

### On popularity data

W3Techs publishes the share of websites using each image format. Snapshot figures: on April 25, 2025, PNG 79.5%, JPEG 74.5%, SVG 61.0%, GIF 17.5%, WebP 16.1%, AVIF 0.6%, ICO 0.2%, BMP 0.1%. Later snapshots: WebP 20.5% overall on June 11, 2026; BMP 0.1% on August 17, 2026; TIFF 0.0% overall on June 1, 2026. Source: https://w3techs.com/technologies/overview/image_format

This measures **websites that use a format**, not files in the wild, and says nothing about **within-format splits** (for example, what share of WAV files hold PCM). That second number is what the quiz scoring needs. No public dataset was found, so the Appendix A weights are editorial estimates, flagged by `confidence`, and meant to be calibrated through friends' answers and the debug tables.
