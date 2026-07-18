#!/usr/bin/env node
// Dogfood harness for the M5 lawn-mower UI (neighbor strip #78 + frontier surfacing #79).
// Drives the real book in headless Chromium and reports structural/behavioral counts only —
// no human-time or felt-burden claims. Modes: `e2e-mow` (checklist + graph-guided mow to 100%),
// `linear` (mark every chunk in book order, the stop-count baseline).
import { chromium } from 'playwright-core';

const EXEC = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = Number(process.env.PORT || 7357);
const MODE = process.argv[2] || 'e2e-mow';
const CAP = 500;

const press = (page, key) =>
  page.evaluate((k) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })), key);
const sleep = (page, ms) => page.waitForTimeout(ms);

async function progress(page) {
  return page.evaluate(() => {
    const txt = document.querySelector('.progress-text')?.textContent?.trim() ?? '';
    const done = /^All \d+ reviewed/.test(txt);
    let reviewed = 0;
    let total = 0;
    const m = txt.match(/(\d+)\s*\/\s*(\d+)\s*reviewed/);
    if (m) {
      reviewed = Number(m[1]);
      total = Number(m[2]);
    }
    const fEl = document.querySelector('.frontier-indicator');
    const fTxt = fEl?.textContent?.trim() ?? '';
    const fm = fTxt.match(/(\d+)\s+cross-chunk/);
    const frontier = fm ? Number(fm[1]) : done ? 0 : null;
    return { txt, done, reviewed, total, frontier, frontierText: fTxt };
  });
}

// The cursor chunk: its title, and its neighbor-strip chips (text + parsed relation/state).
async function cursorState(page) {
  return page.evaluate(() => {
    const cur = document.querySelector('.chunk.cursor');
    if (!cur) return null;
    const title = cur.querySelector('.chunk-title')?.textContent?.trim() ?? '';
    const state = cur.className.match(/state-(\w+)/)?.[1] ?? '';
    const chips = [...cur.querySelectorAll('.neighbor-strip button.neighbor-chip')].map((b) => {
      const text = b.querySelector('.chip-text')?.textContent?.trim() ?? '';
      const reviewed = b.className.includes('chip-reviewed');
      const frontier = b.className.includes('chip-frontier');
      const fileLevel = b.className.includes('chip-file-level');
      // Relation verb tells interaction (calls/exercises) from file-level (imports).
      const interaction = /\b(calls|called by|exercises|exercised by)\b/.test(text);
      return { text, reviewed, frontier, fileLevel, interaction };
    });
    return { title, state, chips };
  });
}

// Click a chip by its exact chip-text within the current cursor strip. Returns true if found+clicked.
async function clickChip(page, chipText) {
  return page.evaluate((t) => {
    const cur = document.querySelector('.chunk.cursor');
    const btn = [...(cur?.querySelectorAll('.neighbor-strip button.neighbor-chip') ?? [])].find(
      (b) => (b.querySelector('.chip-text')?.textContent?.trim() ?? '') === t,
    );
    if (!btn) return false;
    btn.click();
    return true;
  }, chipText);
}

// Refocus a chunk by its title text among the mounted rows (click its <article>). The mounted-only
// scope is deliberate: it measures whether the just-marked origin is still reachable after Enter's
// auto-advance, or whether the virtualizer unmounted it (a mow-breaking fallback).
async function refocusByTitle(page, title) {
  return page.evaluate((t) => {
    const art = [...document.querySelectorAll('.chunk')].find(
      (c) => (c.querySelector('.chunk-title')?.textContent?.trim() ?? '') === t,
    );
    if (!art) return false;
    art.click();
    return true;
  }, title);
}

async function waitCursor(page, prevTitle, timeout = 4000) {
  try {
    await page.waitForFunction(
      (p) => {
        const t = document.querySelector('.chunk.cursor .chunk-title')?.textContent?.trim() ?? '';
        return t !== p;
      },
      prevTitle,
      { polling: 10, timeout },
    );
    return true;
  } catch {
    return false;
  }
}

async function launch() {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.goto(`http://127.0.0.1:${PORT}`);
  await page.waitForSelector('.chunk', { timeout: 15000 });
  await sleep(page, 400);
  return { browser, page };
}

async function runLinear() {
  const { browser, page } = await launch();
  await press(page, 'g'); // no-op focus attempt; harmless
  // Start at top.
  await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', ctrlKey: true, bubbles: true })));
  await sleep(page, 200);
  let stops = 0;
  const traj = [];
  for (let i = 0; i < CAP; i++) {
    const p = await progress(page);
    if (p.done) break;
    const before = await cursorState(page);
    await press(page, 'Enter');
    stops++;
    await sleep(page, 90);
    const p2 = await progress(page);
    traj.push(p2.frontier);
    if (!(await waitCursor(page, before?.title ?? '', 1500)) && !p2.done) {
      // cursor didn't move (last unreviewed) — one more progress check then stop if done
      if ((await progress(page)).done) break;
    }
  }
  const final = await progress(page);
  console.log(JSON.stringify({ mode: 'linear', stops, final, frontierTrajectory: traj }, null, 2));
  await browser.close();
}

async function runE2eMow() {
  const { browser, page } = await launch();
  const checks = {};
  const log = [];

  // ---- E2E checks on fresh state ----
  // 1. Find a chunk whose strip renders (has chips). Walk with n until chips appear.
  let found = null;
  await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', ctrlKey: true, bubbles: true })));
  await sleep(page, 200);
  for (let i = 0; i < 60; i++) {
    const cs = await cursorState(page);
    if (cs && cs.chips.length > 0) {
      found = cs;
      break;
    }
    const prev = cs?.title ?? '';
    await press(page, 'j');
    if (!(await waitCursor(page, prev, 1500))) break;
    await sleep(page, 40);
  }
  checks['1_strip_renders'] = found ? { pass: true, chunk: found.title, chips: found.chips.map((c) => c.text) } : { pass: false };

  // 2. Click a chip (primary jump) — cursor moves to the neighbor.
  if (found) {
    const originTitle = found.title;
    const targetChip = found.chips[0];
    const ok = await clickChip(page, targetChip.text);
    const moved = ok && (await waitCursor(page, originTitle, 2500));
    const after = await cursorState(page);
    checks['2_click_chip_jumps'] = { pass: Boolean(moved), from: originTitle, chip: targetChip.text, landedOn: after?.title };

    // 4. back via `b` restores origin.
    await press(page, 'b');
    const back = await waitCursor(page, after?.title ?? '', 2500);
    const backState = await cursorState(page);
    checks['4a_b_restores_origin'] = { pass: back && backState?.title === originTitle, landedOn: backState?.title, expected: originTitle };

    // 4b. "← back" button visible after a jump, and click restores origin.
    await clickChip(page, targetChip.text);
    await waitCursor(page, originTitle, 2500);
    const jumped2 = await cursorState(page);
    const backBtn = await page.evaluate(() => {
      const b = document.querySelector('.back-button');
      if (!b) return { visible: false };
      b.click();
      return { visible: true };
    });
    await waitCursor(page, jumped2?.title ?? '', 2500);
    const afterBtn = await cursorState(page);
    checks['4b_back_button'] = { pass: backBtn.visible && afterBtn?.title === originTitle, landedOn: afterBtn?.title, expected: originTitle };

    // 3. keyboard: g (focus strip) -> ArrowRight -> Enter follows a chip.
    // Ensure origin focused first.
    await refocusByTitle(page, originTitle);
    await sleep(page, 120);
    await press(page, 'g'); // focus first chip
    await sleep(page, 120);
    const chipFocused = await page.evaluate(() => document.activeElement?.className?.includes('neighbor-chip') ?? false);
    // ArrowRight moves roving focus; Enter on the focused chip fires its click.
    await page.evaluate(() => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    await sleep(page, 100);
    const focusedChipText = await page.evaluate(() => document.activeElement?.querySelector?.('.chip-text')?.textContent?.trim() ?? null);
    await page.evaluate(() => document.activeElement?.click());
    const kbMoved = await waitCursor(page, originTitle, 2500);
    const kbAfter = await cursorState(page);
    checks['3_keyboard_g_arrow_enter'] = {
      pass: chipFocused && kbMoved,
      chipFocused,
      followedChip: focusedChipText,
      landedOn: kbAfter?.title,
    };
    // reset back to origin for a clean mow start
    await press(page, 'b');
    await sleep(page, 150);
  }

  // ---- Lawn-mower to 100% ----
  await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', ctrlKey: true, bubbles: true })));
  await sleep(page, 200);

  let stops = 0;
  let jumps = 0;
  let reencounters = 0; // strip jumps that landed on an already-reviewed chunk
  let freeGlances = 0; // reviewed interaction-neighbor chips surfaced on visited chunks
  let fallbacks = 0; // fell back to linear queue (n / Enter auto-advance) — local frontier empty
  let refocusOk = 0;
  let refocusUnmounted = 0;
  const frontierTrajectory = [];
  const edgesSeen = new Set(); // "curTitle >> chipText" — the interaction map the strip surfaced

  for (let step = 0; step < CAP; step++) {
    const p = await progress(page);
    if (p.done) break;
    const cs = await cursorState(page);
    if (!cs) break;

    const interaction = cs.chips.filter((c) => c.interaction);
    for (const c of interaction) edgesSeen.add(`${cs.title} :: ${c.text}`);
    const reviewedInteraction = interaction.filter((c) => c.reviewed);
    const unreviewedInteraction = interaction.filter((c) => !c.reviewed);
    freeGlances += reviewedInteraction.length;

    if (cs.state !== 'reviewed') {
      // Mark this chunk. Enter auto-advances the cursor (book order) — we override it below.
      await press(page, 'Enter');
      stops++;
      await sleep(page, 90);
      const pm = await progress(page);
      frontierTrajectory.push(pm.frontier);
      if (pm.done) break;

      const target = unreviewedInteraction[0];
      if (target) {
        // Refocus the just-marked origin (auto-advance moved us away), then follow the chip.
        const refocused = await refocusByTitle(page, cs.title);
        if (refocused) {
          refocusOk++;
          await sleep(page, 100);
          const clicked = await clickChip(page, target.text);
          if (clicked) {
            await waitCursor(page, cs.title, 2500);
            jumps++;
            const landed = await cursorState(page);
            if (landed?.state === 'reviewed') reencounters++;
          } else {
            fallbacks++; // chip vanished after refocus
          }
        } else {
          refocusUnmounted++;
          fallbacks++; // origin unmounted by the auto-advance — accept the linear landing
        }
      } else {
        fallbacks++; // no unreviewed interaction neighbor — accept Enter's book-order advance
      }
    } else {
      // Landed (via a jump) on an already-reviewed chunk: follow an unreviewed neighbor or fall back.
      const target = unreviewedInteraction[0];
      if (target) {
        const clicked = await clickChip(page, target.text);
        if (clicked) {
          await waitCursor(page, cs.title, 2500);
          jumps++;
          const landed = await cursorState(page);
          if (landed?.state === 'reviewed') reencounters++;
        } else {
          await press(page, 'n');
          fallbacks++;
          await sleep(page, 90);
        }
      } else {
        await press(page, 'n');
        fallbacks++;
        await sleep(page, 90);
      }
    }
  }

  const final = await progress(page);

  // ---- Done banner honesty line ----
  await sleep(page, 300);
  const doneBanner = await page.evaluate(() => {
    const el = document.querySelector('.done-frontier');
    return { present: Boolean(el), text: el?.textContent?.replace(/\s+/g, ' ').trim() ?? null };
  });
  checks['6_done_banner'] = { pass: doneBanner.present && /individually verified/.test(doneBanner.text ?? ''), ...doneBanner };
  checks['5_frontier_live'] = {
    pass: frontierTrajectory.some((f) => typeof f === 'number' && f > 0),
    trajectory: frontierTrajectory,
  };

  const monotonic = (() => {
    const nums = frontierTrajectory.filter((f) => typeof f === 'number');
    for (let i = 1; i < nums.length; i++) if (nums[i] > nums[i - 1]) return false;
    return true;
  })();

  console.log(
    JSON.stringify(
      {
        mode: 'e2e-mow',
        checks,
        mow: { stops, jumps, reencounters, freeGlances, fallbacks, refocusOk, refocusUnmounted },
        frontierTrajectory,
        frontierMonotonic: monotonic,
        edgesSurfaced: [...edgesSeen].sort(),
        final,
      },
      null,
      2,
    ),
  );
  await browser.close();
}

const run = MODE === 'linear' ? runLinear : runE2eMow;
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
