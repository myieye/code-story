import { describe, expect, it } from 'vitest';
import { NARRATION_PROMPT_VERSION, openerNarrationPrompt, sectionNarrationPrompt } from './narration-prompt.js';

describe('narration prompts', () => {
  it('carries a version constant', () => {
    expect(NARRATION_PROMPT_VERSION).toBe('narration-1');
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
});
