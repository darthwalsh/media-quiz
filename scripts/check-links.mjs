// Optional: checks every source URL in data.js. Needs network access.
// Usage: npm run check-links
// Exit code 1 if any link returns an error status or fails to connect.
// 403 and 429 are reported as warnings because some sites block scripted requests.

import { QUIZ_CONFIG } from '../data.js';

const urls = new Map();
for (const item of QUIZ_CONFIG.items) {
  for (const url of item.sources) {
    if (!urls.has(url)) urls.set(url, []);
    urls.get(url).push(item.id);
  }
}

async function check(url) {
  const options = { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'media-quiz-link-check' } };
  let response = await fetch(url, { ...options, method: 'HEAD' });
  if (response.status === 405 || response.status === 403 || response.status === 404) {
    response = await fetch(url, { ...options, method: 'GET' });
  }
  return response.status;
}

const queue = [...urls.entries()];
let failures = 0;
let warnings = 0;

async function worker() {
  while (queue.length) {
    const [url, ids] = queue.shift();
    try {
      const status = await check(url);
      if (status >= 200 && status < 400) console.log(`ok    ${status} ${url}`);
      else if (status === 403 || status === 429) {
        warnings++;
        console.log(`warn  ${status} ${url}  (${ids.join(', ')})`);
      } else {
        failures++;
        console.log(`FAIL  ${status} ${url}  (${ids.join(', ')})`);
      }
    } catch (error) {
      failures++;
      console.log(`FAIL  ${error.cause?.code ?? error.name} ${url}  (${ids.join(', ')})`);
    }
  }
}

await Promise.all(Array.from({ length: 16 }, worker));
console.log(`\n${urls.size} links checked, ${failures} failed, ${warnings} warnings.`);
process.exit(failures > 0 ? 1 : 0);
