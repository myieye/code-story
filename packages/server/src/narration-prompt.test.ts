import { describe, expect, it } from 'vitest';
import {
  CHUNK_NARRATION_PROMPT_VERSION,
  chunkNarrationPrompt,
  NARRATION_PROMPT_VERSION,
  openerNarrationPrompt,
  sectionNarrationPrompt,
} from './narration-prompt.js';

describe('narration prompts', () => {
  it('carries a version constant', () => {
    expect(NARRATION_PROMPT_VERSION).toBe('narration-4');
  });

  it('renders the section prompt with the rendered input and strict-JSON contract', () => {
    const prompt = sectionNarrationPrompt('a.ts [impl]\n\nchunk a.ts::x::1\n  foo (method, ~3 lines)\n+added');
    expect(prompt).toContain('STRICT JSON');
    expect(prompt).toContain('"intro"');
    expect(prompt).toContain('"chunks"');
    expect(prompt).toContain('chunk a.ts::x::1');
    expect(prompt).toMatchSnapshot();
  });

  it('renders the opener prompt with the rendered manifest and strict-JSON contract', () => {
    const prompt = openerNarrationPrompt('a.ts [impl]\n\n1 pinned tail section (not reorderable)');
    expect(prompt).toContain('STRICT JSON');
    expect(prompt).toContain('"opener"');
    expect(prompt).toContain('1 pinned tail section');
    expect(prompt).toMatchSnapshot();
  });

  it('carries a distinct chunk-narration version constant', () => {
    expect(CHUNK_NARRATION_PROMPT_VERSION).toBe('narration-chunk-2');
    expect(CHUNK_NARRATION_PROMPT_VERSION).not.toBe(NARRATION_PROMPT_VERSION);
  });

  it('renders the chunk prompt with the batch, badge + point-don\'t-assert rules, and strict-JSON contract', () => {
    const prompt = chunkNarrationPrompt('File: a.ts\n\nc1 — foo (method, ~3 lines)\n+added');
    expect(prompt).toContain('STRICT JSON');
    expect(prompt).toContain('"badge"');
    expect(prompt).toContain('"line"');
    expect(prompt).toContain('File: a.ts');
    expect(prompt).toContain('c1 — foo');
    // Point-don't-assert (#58) and the badge caps must be stated to the model.
    expect(prompt).toContain('POINT the reviewer at what to check');
    expect(prompt).toContain('never more than 4');
    expect(prompt).toMatchSnapshot();
  });

  it('asks for a rare, complex-chunks-only review note (R-068)', () => {
    const prompt = chunkNarrationPrompt('File: a.ts\n\nc1 — foo (method, ~3 lines)\n+added');
    expect(prompt).toContain('"note"');
    expect(prompt).toContain('RARE');
    // The note must POINT like the line, not reassure — and be sparse by construction.
    expect(prompt).toContain('A note on a simple chunk is a defect');
  });
});
