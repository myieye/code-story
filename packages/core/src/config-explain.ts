import type { StoryConfig } from './story-config.js';

/**
 * Authoritative, plain-language explanation of every generation option — the single source of truth
 * for R-062 ("make it obvious what each option means and what it triggers"). The web renders these;
 * nothing else should hand-write option copy, so the meaning never drifts across the library chips
 * and the per-story panel.
 *
 * `cost` answers Tim's question directly: `regenerates` = changing this drops the AI order overlay,
 * so restoring AI order needs a paid re-run; `free` = change it without spending tokens (the saved
 * AI work keeps serving until you deliberately re-run). Grounded in spec 08 §0.
 */
export type OptionCost = 'regenerates' | 'free';

export interface ExplainedOption {
  key: string;
  label: string;
  value: string;
  /** What this specific value does, in light register (R-036). */
  meaning: string;
  cost: OptionCost;
  /** Extra nuance about the cost, shown on hover/expand. */
  costNote?: string;
}

function directionOption(direction: StoryConfig['direction']): ExplainedOption {
  return {
    key: 'direction',
    label: 'Reading order',
    value: direction === 'consumer-first' ? 'Consumer-first' : 'Dependency-first',
    meaning:
      direction === 'consumer-first'
        ? 'You read the code that uses something before the thing it uses, so the story flows down each call path.'
        : 'You read the things code depends on before the code that uses them.',
    cost: 'regenerates',
    costNote: 'The AI reads the change with this rule baked in, so switching it needs a fresh AI ordering run.',
  };
}

function testPlacementOption(placement: StoryConfig['testPlacement']): ExplainedOption {
  const value = placement === 'before' ? 'Tests before' : placement === 'after' ? 'Tests after' : 'Tests at the end';
  const meaning =
    placement === 'before'
      ? 'Each test comes just before the code it checks.'
      : placement === 'after'
        ? 'Each test comes just after the code it checks.'
        : 'All the tests are grouped at the end of the story.';
  return {
    key: 'testPlacement',
    label: 'Tests',
    value,
    meaning,
    cost: 'regenerates',
    costNote: "Today this drops the saved AI order even though the AI never sees test placement — a known inefficiency we plan to fix.",
  };
}

function modeOption(mode: 'file' | 'chapter'): ExplainedOption {
  return {
    key: 'mode',
    label: 'Grouping',
    value: mode === 'chapter' ? 'Chapters (by call path)' : 'By file',
    meaning:
      mode === 'chapter'
        ? 'Related changes across files are woven into chapters that follow the call path.'
        : "Each file's changes are kept together, in the order they appear in the diff.",
    cost: 'regenerates',
  };
}

function aiOrderOption(aiOrder: boolean): ExplainedOption {
  return {
    key: 'aiOrder',
    label: 'AI ordering',
    value: aiOrder ? 'On' : 'Off',
    meaning: aiOrder
      ? 'An AI read the whole change and chose the chapter order, on top of the deterministic rules.'
      : 'The order is purely deterministic — no AI ordering was applied.',
    cost: 'free',
    costNote: 'Turning this on or off never invalidates saved work; existing order keeps serving.',
  };
}

function modelOption(key: string, label: string, model: string | undefined): ExplainedOption | null {
  if (!model) return null;
  return {
    key,
    label,
    value: model,
    meaning: `The ${label.toLowerCase()} used the ${model} model.`,
    cost: 'free',
    costNote: 'Picking a different model is free until you deliberately re-run that job.',
  };
}

export interface StoryOptionsInput {
  config: StoryConfig;
  mode: 'file' | 'chapter';
  aiOrder: boolean;
  models?: { order?: string; narration?: string };
}

/** The compact set for library cards: the ordering axes plus grouping. */
export function explainConfig(config: StoryConfig, mode: 'file' | 'chapter'): ExplainedOption[] {
  return [directionOption(config.direction), testPlacementOption(config.testPlacement), modeOption(mode)];
}

/** The full set for the per-story "How this story was generated" panel. */
export function explainStoryOptions(input: StoryOptionsInput): ExplainedOption[] {
  return [
    ...explainConfig(input.config, input.mode),
    aiOrderOption(input.aiOrder),
    modelOption('orderModel', 'Ordering', input.models?.order),
    modelOption('narrationModel', 'Narration', input.models?.narration),
  ].filter((o): o is ExplainedOption => o !== null);
}
