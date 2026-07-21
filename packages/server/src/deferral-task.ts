import {
  type Chunk,
  chunkTitle,
  type Deferral,
  type FileContents,
  type LineRange,
  unifiedChunkLines,
} from '@code-story/core';
import { extractJsonBlock } from './claude-cli.js';
import { deferralPrompt } from './deferral-prompt.js';
import type { GlueInvoke, GlueOutcome, GlueTask, ModelTier } from './glue/types.js';

export const DEFERRAL_KIND = 'deferral';

/** The answer fields the task fills — the only part of a Deferral a worker ever writes. */
export type DeferralAnswerPatch = Partial<Pick<Deferral, 'answer' | 'answerStatus' | 'answerError' | 'answeredAt'>>;

export interface DeferralChunkInput {
  chunk: Chunk;
  contents: FileContents | undefined;
}

export interface DeferralTaskDeps {
  tier: ModelTier;
  /** The current deferral list, read each plan()/run() so a POST or DELETE is picked up. */
  loadDeferrals: () => Promise<Deferral[]>;
  /** The chunk + its file contents for a deferral's chunk id (undefined if the chunk left the book). */
  getChunk: (chunkId: string) => Promise<DeferralChunkInput | undefined>;
  /** Persist ONLY the answer fields for one deferral, through the server's single save-chain. */
  saveAnswer: (id: string, patch: DeferralAnswerPatch) => Promise<void>;
}

const isTerminal = (d: Deferral): boolean => d.answerStatus === 'done' || d.answerStatus === 'failed';

/**
 * The deferral-answer glue task (spec 06 slice 6 / spec 07 G3). It runs on the interactive lane so a
 * waiting reviewer's answer never queues behind a bulk narration fill. One unit per unanswered
 * ai-deferral; the fingerprint IS the deferral id — a deferral never regenerates, so a re-plan after
 * a POST only ever adds new ids. Inline (`inline:true`) deferrals use this same task/queue; only the
 * web render differs. Every answer write funnels through `saveAnswer` (the single deferral save-chain
 * on the server), so a concurrent DELETE and an answer arrival can't clobber each other. The task is
 * fail-open per deferral: one re-ask, then a recorded `failed` — never a scheduler failure, so the
 * queue always drains and one bad answer never parks the whole kind in the failed set.
 */
export function createDeferralTask(deps: DeferralTaskDeps): GlueTask<void> {
  const pendingAi = async (): Promise<Deferral[]> => (await deps.loadDeferrals()).filter((d) => d.kind === 'ai' && !isTerminal(d));

  return {
    kind: DEFERRAL_KIND,
    tier: deps.tier,
    priority: 'interactive',

    plan: async () => (await pendingAi()).map((d) => ({ key: d.id, fingerprint: d.id })),

    isFresh: async (unit) => {
      const deferral = (await deps.loadDeferrals()).find((d) => d.id === unit.key);
      // Missing (deleted) or already terminal ⇒ nothing left to do for this unit.
      return !deferral || isTerminal(deferral);
    },

    run: async (unit, invoke): Promise<GlueOutcome<void>> => {
      const deferral = (await deps.loadDeferrals()).find((d) => d.id === unit.key);
      if (!deferral || isTerminal(deferral)) return { status: 'done', out: undefined };

      await deps.saveAnswer(unit.key, { answerStatus: 'running' });

      const input = await deps.getChunk(deferral.chunkId);
      if (!input) {
        await deps.saveAnswer(unit.key, {
          answerStatus: 'failed',
          answerError: 'the chunk this deferral points at is no longer in the book',
          answeredAt: new Date().toISOString(),
        });
        return { status: 'done', out: undefined };
      }

      const prompt = deferralPrompt(
        deferral.text,
        chunkTitle(input.chunk),
        input.chunk.file,
        diffText(input.chunk, input.contents),
        deferral.lineRange && highlightedText(input.chunk, input.contents, deferral.lineRange),
      );

      // One re-ask (empty reply or spawn throw), then fail-open. The scheduler's retry taxonomy is
      // deliberately not used here — an interactive answer should fail fast and offer Retry, not sit
      // through backoffs behind other reviewers' questions.
      let answer = await ask(invoke, deps.tier, prompt, unit.key);
      if (answer === undefined) answer = await ask(invoke, deps.tier, prompt, unit.key);

      if (answer !== undefined) {
        await deps.saveAnswer(unit.key, { answer, answerStatus: 'done', answeredAt: new Date().toISOString() });
      } else {
        await deps.saveAnswer(unit.key, {
          answerStatus: 'failed',
          answerError: 'the model did not return an answer',
          answeredAt: new Date().toISOString(),
        });
      }
      return { status: 'done', out: undefined };
    },
  };
}

/** One invoke → extract → the `answer` string. Any throw, bad JSON, or blank answer yields undefined (a re-ask signal). */
async function ask(invoke: GlueInvoke, tier: ModelTier, prompt: string, unitKey: string): Promise<string | undefined> {
  let text: string;
  try {
    ({ text } = await invoke({ prompt, tier: tier as Exclude<ModelTier, 'none'>, kind: DEFERRAL_KIND, unitKey }));
  } catch {
    return undefined;
  }
  try {
    const json = extractJsonBlock(text) as { answer?: unknown };
    const answer = typeof json.answer === 'string' ? json.answer.trim() : '';
    return answer.length > 0 ? answer : undefined;
  } catch {
    return undefined;
  }
}

const MARKS = { add: '+', del: '-', context: ' ' } as const;

/** Unified-diff text for a chunk, built from its hunks (never re-diffed); '' when no content is fetchable. */
function diffText(chunk: Chunk, contents: FileContents | undefined): string {
  return unifiedChunkLines(chunk, contents)
    .map((line) => (line.type === 'gap' ? '…' : `${MARKS[line.type]}${line.text}`))
    .join('\n');
}

/** Just the rows the reviewer highlighted (1-based head/base lines within the range). */
function highlightedText(chunk: Chunk, contents: FileContents | undefined, range: LineRange): string {
  return unifiedChunkLines(chunk, contents)
    .filter((line): line is typeof line & { type: 'add' | 'del' | 'context' } => {
      if (line.type === 'gap') return false;
      const n = line.head ?? line.base;
      return n !== undefined && n >= range.start && n <= range.end;
    })
    .map((line) => `${MARKS[line.type]}${line.text}`)
    .join('\n');
}
