import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  type Book,
  type Chunk,
  type ImportGraph,
  type NarrationOverlay,
  narrationOpenerKey,
  sectionFingerprint,
} from '@code-story/core';
import { afterAll, describe, expect, test } from 'vitest';
import { runNarrationJob } from './narration-job.js';
import { NARRATION_PROMPT_VERSION } from './narration-prompt.js';
import { saveJson } from './narration-store.js';

function chunk(file: string, stub = false): Chunk {
  return {
    id: `${file}::x::${file.length}`,
    file,
    symbolPath: ['x'],
    displayPath: ['x'],
    kind: 'other',
    changeTypes: stub ? ['generated'] : [],
    hunks: [{ baseStart: 0, baseCount: 0, headStart: 1, headCount: 3 }],
    headRange: { start: 1, end: 3 },
  };
}

// a.ts ← b.ts ← b.test.ts, p.ts free-floating, gen.ts all-stub (not narratable → 4 narratable sections).
const files = ['a.ts', 'b.ts', 'b.test.ts', 'p.ts', 'gen.ts'];
const chunks: Chunk[] = [chunk('a.ts'), chunk('b.ts'), chunk('b.test.ts'), chunk('p.ts'), chunk('gen.ts', true)];
const graph: ImportGraph = {
  edges: [
    { from: 'b.ts', to: 'a.ts' },
    { from: 'b.test.ts', to: 'b.ts' },
  ],
  unresolved: 0,
};
const HEAD = 'deadbeef';
const book: Book = {
  headSha: HEAD,
  sections: files.map((f) => ({
    id: f,
    title: f,
    occurrences: [{ chunkId: `${f}::x::${f.length}`, ordinal: 0, role: 'primary' }],
  })),
};

const dir = await mkdtemp(path.join(tmpdir(), 'cs-narr-'));
afterAll(() => rm(dir, { recursive: true, force: true }));

let seq = 0;
const freshOverlayFile = () => path.join(dir, `run-${seq++}.narration.json`);

const envSection = (intro: string, chunkLines: Record<string, string> = {}) =>
  JSON.stringify({ result: JSON.stringify({ intro, chunks: chunkLines }) });
const envOpener = (opener: string) => JSON.stringify({ result: JSON.stringify({ opener }) });

/** One stub for both call kinds; distinguishes the opener prompt from a section prompt by its lede. */
const isOpener = (prompt: string) => prompt.includes('opening note');

function base(overlayFile: string) {
  return { book, graph, chunks, contents: new Map(), headSha: HEAD, model: 'test-model', cwd: dir, overlayFile };
}

async function readOverlay(file: string): Promise<NarrationOverlay> {
  return JSON.parse(await readFile(file, 'utf8')) as NarrationOverlay;
}

function seedEntry(file: string): NarrationOverlay['sections'][string] {
  const section = book.sections.find((s) => s.id === file)!;
  return { fingerprint: sectionFingerprint(HEAD, section), intro: `seeded ${file}`, chunks: {}, generatedAt: 'seed' };
}

describe('runNarrationJob', () => {
  test('narrates every non-low-signal section and writes the opener, persisting the overlay', async () => {
    const file = freshOverlayFile();
    const result = await runNarrationJob({
      ...base(file),
      invoke: async (p) => (isOpener(p) ? envOpener('An overview thread.') : envSection('Intro.')),
    });
    expect(result.sectionsTotal).toBe(4);
    expect(result.sectionsDone).toBe(4);
    expect(Object.keys(result.overlay.sections).sort()).toEqual(['a.ts', 'b.test.ts', 'b.ts', 'p.ts']);
    expect(result.overlay.opener.text).toBe('An overview thread.');
    expect(await readOverlay(file)).toEqual(result.overlay);
  });

  test('resume generates only sections without a fresh entry', async () => {
    const file = freshOverlayFile();
    const seeded: NarrationOverlay = {
      version: 1,
      model: 'test-model',
      promptVersion: NARRATION_PROMPT_VERSION,
      opener: { text: 'kept opener', key: narrationOpenerKey(book, HEAD) },
      sections: { 'a.ts': seedEntry('a.ts') },
    };
    await saveJson(file, seeded);

    const asked: string[] = [];
    const result = await runNarrationJob({
      ...base(file),
      invoke: async (p) => {
        asked.push(p);
        return isOpener(p) ? envOpener('should not be asked') : envSection('New intro.');
      },
    });
    expect(asked.some(isOpener)).toBe(false); // opener key matched → skipped
    expect(asked.some((p) => p.includes('a.ts ['))).toBe(false); // a.ts was fresh → skipped
    expect(asked.filter((p) => !isOpener(p))).toHaveLength(3);
    expect(result.overlay.sections['a.ts']!.intro).toBe('seeded a.ts');
    expect(result.overlay.opener.text).toBe('kept opener');
    expect(result.sectionsDone).toBe(4);
  });

  test('a gateFailures-only entry counts as done and is not re-asked', async () => {
    const file = freshOverlayFile();
    const failedEntry = { ...seedEntry('a.ts'), intro: '', gateFailures: ['intro: too long'] };
    await saveJson(file, {
      version: 1,
      model: 'test-model',
      promptVersion: NARRATION_PROMPT_VERSION,
      opener: { text: 'op', key: narrationOpenerKey(book, HEAD) },
      sections: { 'a.ts': failedEntry },
    } satisfies NarrationOverlay);

    const asked: string[] = [];
    const result = await runNarrationJob({
      ...base(file),
      invoke: async (p) => {
        asked.push(p);
        return envSection('Intro.');
      },
    });
    expect(asked.some((p) => p.includes('a.ts ['))).toBe(false);
    expect(result.overlay.sections['a.ts']).toEqual(failedEntry);
  });

  test('a stored overlay from another model/prompt is discarded, not blended', async () => {
    const file = freshOverlayFile();
    await saveJson(file, {
      version: 1,
      model: 'old-model',
      promptVersion: NARRATION_PROMPT_VERSION,
      opener: { text: 'stale', key: narrationOpenerKey(book, HEAD) },
      sections: { 'a.ts': seedEntry('a.ts') },
    } satisfies NarrationOverlay);

    const asked: string[] = [];
    const result = await runNarrationJob({
      ...base(file),
      invoke: async (p) => {
        asked.push(p);
        return isOpener(p) ? envOpener('Fresh opener.') : envSection('Fresh intro.');
      },
    });
    expect(asked.some((p) => p.includes('a.ts ['))).toBe(true); // regenerated
    expect(result.overlay.model).toBe('test-model');
    expect(result.overlay.sections['a.ts']!.intro).toBe('Fresh intro.');
    expect(result.overlay.opener.text).toBe('Fresh opener.');
  });

  test('a hard-gate failure re-asks once with the failures named, then records gateFailures', async () => {
    const file = freshOverlayFile();
    const asked: string[] = [];
    const result = await runNarrationJob({
      ...base(file),
      invoke: async (p) => {
        if (isOpener(p)) return envOpener('Overview.');
        asked.push(p);
        return envSection('This looks good to me.'); // banned phrase → gate fails both times
      },
    });
    const bAsks = asked.filter((p) => p.includes('b.ts ['));
    expect(bAsks).toHaveLength(2);
    expect(bAsks[1]).toContain('rejected by the register check');
    const entry = result.overlay.sections['b.ts']!;
    expect(entry.intro).toBe('');
    expect(entry.gateFailures?.some((f) => f.includes('looks good'))).toBe(true);
  });

  test('one section that keeps failing does not kill the run', async () => {
    const file = freshOverlayFile();
    const result = await runNarrationJob({
      ...base(file),
      invoke: async (p) => {
        if (isOpener(p)) return envOpener('Overview.');
        if (p.includes('b.ts [')) return envSection('This is simply perfect.'); // always fails gate
        return envSection('Fine intro.');
      },
    });
    expect(result.sectionsDone).toBe(4);
    expect(result.overlay.sections['b.ts']!.gateFailures?.length).toBeGreaterThan(0);
    expect(result.overlay.sections['a.ts']!.intro).toBe('Fine intro.');
  });

  test('invalid output is re-asked once, then succeeds', async () => {
    const file = freshOverlayFile();
    const attempts = new Map<string, number>();
    const result = await runNarrationJob({
      ...base(file),
      invoke: async (p) => {
        if (isOpener(p)) return envOpener('Overview.');
        const key = p.includes('a.ts [') ? 'a' : 'other';
        const n = (attempts.get(key) ?? 0) + 1;
        attempts.set(key, n);
        if (key === 'a' && n === 1) return JSON.stringify({ result: 'not json at all' });
        return envSection('Intro.');
      },
    });
    expect(attempts.get('a')).toBe(2);
    expect(result.overlay.sections['a.ts']!.intro).toBe('Intro.');
  });
});
