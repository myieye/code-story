#!/usr/bin/env node
import { chromium } from 'playwright-core';

function parseArgs(argv) {
  const opts = { port: 7357, walk: 50, marks: 2, headless: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port') opts.port = Number(argv[++i]);
    else if (arg === '--walk') opts.walk = Number(argv[++i]);
    else if (arg === '--marks') opts.marks = Number(argv[++i]);
    else if (arg === '--headless') opts.headless = true;
    else throw new Error(`unknown arg: ${arg}`);
  }
  return opts;
}

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

function press(page, key) {
  return page.evaluate(
    (k) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })),
    key,
  );
}

function cursorIndex(page) {
  return page.evaluate(() => {
    const cur = document.querySelector('.chunk.cursor');
    const row = cur?.closest('[data-index]');
    return row ? row.getAttribute('data-index') : null;
  });
}

function progressText(page) {
  return page.locator('.progress-text').innerText();
}

async function measureStep(page, key) {
  const before = await cursorIndex(page);
  const start = Date.now();
  await press(page, key);
  await page.waitForFunction(
    (prev) => {
      const cur = document.querySelector('.chunk.cursor');
      const row = cur?.closest('[data-index]');
      const idx = row ? row.getAttribute('data-index') : null;
      return idx !== null && idx !== prev;
    },
    before,
    { polling: 5, timeout: 5000 },
  );
  return Date.now() - start;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const browser = await chromium.launch({ channel: 'chrome', headless: opts.headless });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });

  await page.goto(`http://127.0.0.1:${opts.port}`);
  await page.waitForSelector('.chunk', { timeout: 15000 });
  console.log(`initial progress: ${await progressText(page)}`);

  const latencies = [];
  let walked = 0;
  for (; walked < opts.walk; walked++) {
    try {
      latencies.push(await measureStep(page, 'j'));
    } catch {
      console.log(`walk stopped early at step ${walked} (no cursor movement — likely end of book)`);
      break;
    }
  }
  if (latencies.length > 0) {
    const sorted = [...latencies].sort((a, b) => a - b);
    console.log(
      `j-walk latency (ms) over ${latencies.length} steps: ` +
        `min=${sorted[0]} median=${percentile(sorted, 0.5)} p90=${percentile(sorted, 0.9)} max=${sorted[sorted.length - 1]}`,
    );
  }

  for (let i = 0; i < opts.marks; i++) {
    await press(page, 'Enter');
    await page.waitForTimeout(150);
  }
  console.log(`progress after ${opts.marks} marks: ${await progressText(page)}`);

  // markCurrent() advances the cursor to the next unreviewed chunk, so the marked chunks
  // are now behind it — step back onto each one with 'k' before 'u' unmarks it in place.
  for (let i = 0; i < opts.marks; i++) {
    await press(page, 'k');
    await page.waitForTimeout(150);
    await press(page, 'u');
    await page.waitForTimeout(150);
  }
  const finalProgress = await progressText(page);
  console.log(`progress after restore: ${finalProgress}`);

  const medianLatency = latencies.length > 0 ? percentile([...latencies].sort((a, b) => a - b), 0.5) : 'n/a';
  console.log(
    `summary: walked=${walked} latencyMedianMs=${medianLatency} marksRoundTripped=${opts.marks} finalProgress="${finalProgress}"`,
  );

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
