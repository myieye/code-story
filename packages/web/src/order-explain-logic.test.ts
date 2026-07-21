import type { StoryConfig } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import { whyThisOrderCopy } from './order-explain-logic.js';

const config = (direction: StoryConfig['direction'], testPlacement: StoryConfig['testPlacement']): StoryConfig => ({
  direction,
  testPlacement,
});

describe('whyThisOrderCopy', () => {
  it('AI-badges the text only when an AI order is applied', () => {
    expect(whyThisOrderCopy(config('consumer-first', 'before'), true, false).aiBadged).toBe(true);
    expect(whyThisOrderCopy(config('consumer-first', 'before'), false, false).aiBadged).toBe(false);
  });

  it('tracks the direction axis in the AI copy', () => {
    expect(whyThisOrderCopy(config('consumer-first', 'before'), true, false).text).toContain('the code that uses things before the things it uses');
    expect(whyThisOrderCopy(config('dependency-first', 'before'), true, false).text).toContain('the things code depends on before the code that uses them');
  });

  it('tracks the test-placement axis in the AI copy', () => {
    expect(whyThisOrderCopy(config('consumer-first', 'before'), true, false).text).toContain('just before the code it checks');
    expect(whyThisOrderCopy(config('consumer-first', 'after'), true, false).text).toContain('just after the code it checks');
    expect(whyThisOrderCopy(config('consumer-first', 'end'), true, false).text).toContain('the tests together at the end');
  });

  it('states the deterministic rule as fact when tier-0 (no AI badge, no narrative)', () => {
    const dep = whyThisOrderCopy(config('dependency-first', 'after'), false, false);
    expect(dep.aiBadged).toBe(false);
    expect(dep.text).toContain('Ordered without AI.');
    expect(dep.text).toContain('The things code depends on come before the code that uses them.');
    expect(dep.text).toContain('Each test comes just after the code it checks.');

    const cons = whyThisOrderCopy(config('consumer-first', 'end'), false, false);
    expect(cons.text).toContain('The code that uses something comes before the thing it uses.');
    expect(cons.text).toContain('The tests are grouped at the end.');
  });

  it('describes the file-order rule in Files view, never AI-badged', () => {
    const files = whyThisOrderCopy(config('dependency-first', 'after'), true, true);
    expect(files.aiBadged).toBe(false);
    expect(files.text).toContain('Grouped by file');
  });
});
