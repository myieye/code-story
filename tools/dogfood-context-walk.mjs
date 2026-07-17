#!/usr/bin/env node
// Walk the book (j) against a running daemon and, at each chunk, record whether the definition
// affordance appeared; when it did, press `d`, capture what the panel rendered, then Escape back.
// Emits JSON: { total, withAffordance, records: [{ index, affordance, defs }] }. The M4 companion
// to tools/dogfood-walk.mjs — used for Dogfood 5. Point it at a daemon whose review cursor is fresh
// (a resumed cursor at the last chunk leaves `j` nowhere to go).
//
//   node tools/dogfood-context-walk.mjs [port=7481] [maxWalk=200]
//
// CODE_STORY_PW_CHROME overrides the browser path; falls back to the channel:'chrome' install.
import { chromium } from 'playwright-core';

const EXE = process.env.CODE_STORY_PW_CHROME;
const port = Number(process.argv[2] ?? 7481);
const maxWalk = Number(process.argv[3] ?? 200);

function press(page, key) {
  return page.evaluate(
    (k) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })),
    key,
  );
}
const idx = (page) =>
  page.evaluate(() => {
    const cur = document.querySelector('.chunk.cursor');
    const row = cur?.closest('[data-index]');
    return row ? row.getAttribute('data-index') : null;
  });

async function chunkInfo(page) {
  return page.evaluate(() => {
    const cur = document.querySelector('.chunk.cursor');
    if (!cur) return null;
    const header = cur.querySelector('.chunk-header, .chunk-title, header');
    const aff = cur.querySelector('.definitions-affordance');
    const panel = cur.querySelector('.definition-panel');
    const defs = panel
      ? [...panel.querySelectorAll('.definition')].map((d) => ({
          symbol: d.querySelector('.definition-symbol')?.textContent ?? '',
          source: d.querySelector('.definition-source')?.textContent ?? '',
          changed: !!d.querySelector('.definition-changed'),
          firstBodyLine: (d.querySelector('.definition-body code')?.textContent ?? '').split('\n')[0],
        }))
      : [];
    return {
      title: (header?.textContent ?? cur.getAttribute('aria-label') ?? '').trim().slice(0, 140),
      affordance: aff ? aff.textContent.trim() : null,
      panelOpen: !!panel,
      defs,
    };
  });
}

async function main() {
  const browser = await chromium.launch(
    EXE ? { executablePath: EXE, headless: true } : { channel: 'chrome', headless: true },
  );
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.goto(`http://127.0.0.1:${port}`);
  await page.waitForSelector('.chunk', { timeout: 15000 });

  const seen = new Set();
  const records = [];
  for (let i = 0; i < maxWalk; i++) {
    const at = await idx(page);
    if (at === null) break;
    if (!seen.has(at)) {
      seen.add(at);
      // affordance auto-fetches on focus; give the GET a beat to land
      await page.waitForTimeout(120);
      let info = await chunkInfo(page);
      if (info && info.affordance) {
        await press(page, 'd');
        await page.waitForTimeout(120);
        info = await chunkInfo(page);
        // return focus to the chunk before advancing
        await press(page, 'Escape');
        await page.waitForTimeout(30);
      }
      if (info) records.push({ index: at, ...info });
    }
    const before = at;
    await press(page, 'j');
    try {
      await page.waitForFunction(
        (p) => {
          const cur = document.querySelector('.chunk.cursor');
          const row = cur?.closest('[data-index]');
          const id = row ? row.getAttribute('data-index') : null;
          return id !== null && id !== p;
        },
        before,
        { polling: 5, timeout: 3000 },
      );
    } catch {
      break;
    }
  }

  const withAff = records.filter((r) => r.affordance);
  console.log(JSON.stringify({ total: records.length, withAffordance: withAff.length, records }, null, 2));
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
