# What's in the box?

A quiz and reference for media file formats. Someone sends you a file. Is it uncompressed, lossless, lossy, or a container where it depends?

Live at https://media.carlwa.com (once DNS is set up).

- **Quiz:** one extension at a time, four choices, scoring math printed under every answer.
- **Answers/reference:** the same layout with every answer filled in. Deep links work: `/#ref/tiff`.
- **Static:** plain HTML, CSS, and ES modules. No build step, no tracking, no network requests beyond its own files.

[SPEC.md](SPEC.md) is the source of truth for requirements, scoring, data, and tests.

## Run it

ES modules need an HTTP server (opening `index.html` from disk won't work):

```sh
npm install
npm run dev      # python3 -m http.server 8000, then open http://localhost:8000
npm test         # 42 tests, Node 20 or newer
```

Useful URL options: `?n=5` (quiz length), `?n=all`, `?seed=7` (reproducible order).

## Fix or add a format

Everything topic-specific lives in [`data.js`](data.js). Each item has weights for the four categories (they get normalized, but keep each row at 100), a one-sentence note, a confidence level, and sources. Then run `npm test`; the config tests check the schema, and `npm run check-links` checks the source URLs.

The weights are editorial estimates, not measured data. If you think one is off, open an issue with a source.

## Layout

| File | Role |
| --- | --- |
| `index.html` | Markup shell and the one boot script |
| `style.css` | Styles, including the textured "contents bar" |
| `data.js` | `QUIZ_CONFIG`: the only topic-specific file |
| `scoring.js` | Pure functions: normalize, score, pick questions, share text, debug table |
| `main.js` | `mount()`: screens and events |
| `tests/` | `node --test` suites; `canaries.media.test.js` is the only media-specific one |

To build a sibling quiz on another topic, replace `data.js`, the `<title>` and description in `index.html`, and the canaries test. See SPEC.md section 12.

## Deploy (GitHub Pages)

1. Push to `main`. In **Settings → Pages**, deploy from branch `main`, folder `/ (root)`.
2. Set the custom domain to `media.carlwa.com` (the `CNAME` file in this repo matches).
3. At your DNS provider, add `CNAME media → darthwalsh.github.io`.
4. When the certificate is issued, tick **Enforce HTTPS**.
