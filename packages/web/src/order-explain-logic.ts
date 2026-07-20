import type { StoryConfig } from '@code-story/core';

/**
 * "Why this order?" copy (spec 06 slice 4c), templated from the live StoryConfig so it stays true
 * after a runtime axis flip (#114). AI-badged only when an AI order is actually applied; tier-0 and
 * file view state the deterministic rule as fact, never a faked narrative (R-026). Register is light
 * and the sentences short (R-036).
 */
export interface OrderExplanation {
  text: string;
  aiBadged: boolean;
}

function directionClause(direction: StoryConfig['direction']): string {
  return direction === 'consumer-first'
    ? 'the code that uses things before the things it uses'
    : 'the things code depends on before the code that uses them';
}

function testClause(placement: StoryConfig['testPlacement']): string {
  if (placement === 'before') return 'each test just before the code it checks';
  if (placement === 'after') return 'each test just after the code it checks';
  return 'the tests together at the end';
}

function directionSentence(direction: StoryConfig['direction']): string {
  return direction === 'consumer-first'
    ? 'The code that uses something comes before the thing it uses.'
    : 'The things code depends on come before the code that uses them.';
}

function testSentence(placement: StoryConfig['testPlacement']): string {
  if (placement === 'before') return 'Each test comes just before the code it checks.';
  if (placement === 'after') return 'Each test comes just after the code it checks.';
  return 'The tests are grouped at the end.';
}

export function whyThisOrderCopy(config: StoryConfig, aiApplied: boolean, fileView: boolean): OrderExplanation {
  if (fileView) {
    return { text: "Grouped by file — each file's changes together, in the order they appear in the diff.", aiBadged: false };
  }
  if (aiApplied) {
    return {
      text: `An AI read the whole change and grouped it into chapters. It put ${directionClause(config.direction)}, and ${testClause(config.testPlacement)}, so the story builds toward the point of the change.`,
      aiBadged: true,
    };
  }
  return { text: `Ordered without AI. ${directionSentence(config.direction)} ${testSentence(config.testPlacement)}`, aiBadged: false };
}
