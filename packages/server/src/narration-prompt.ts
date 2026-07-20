export const NARRATION_PROMPT_VERSION = 'narration-4';

export const CHUNK_NARRATION_PROMPT_VERSION = 'narration-chunk-1';

/**
 * The chunk-narration + badge prompt (spec 06 slice 5). One file's aliased chunks in, per-chunk
 * `{ line, badge }` out. New prompt track (spec 03's `narration-4` is untouched); it bakes in the
 * point-don't-assert rule (#58) — lines POINT at what to check, they never assert a semantic outcome
 * that only holds on one branch. Bump CHUNK_NARRATION_PROMPT_VERSION on any edit; the overlay records
 * it and resume compares it.
 */
export function chunkNarrationPrompt(renderedBatch: string): string {
  return `You are labeling the chunks of one file for a code-review "book". A tired reviewer reads
the book once, top to bottom. For each chunk you may write two things: a short badge and a short
orientation line. Both are optional per chunk — be sparse.

Below is one file's chunks. Each is labeled with a short alias (c1, c2, …), its title and kind, and
its diff. Refer to chunks ONLY by their alias.

For each chunk you choose to label:

1. A badge: a tiny tag naming what kind of change this chunk is. Usually 2 words, never more than 4.
   Sentence-case (capital first letter, no SHOUTING). Examples: "New endpoint", "Minor refactor",
   "Test update", "Bug fix", "New guard". Skip the badge if nothing fits cleanly.

2. A line: at most one short sentence (about 110 characters). POINT the reviewer at what to check —
   do not tell them the answer. Say where to look and what to weigh, never whether it is right.
   Good: "Check the null handling in the two synced sorts." Bad: "The nulls are sorted last."
   Be SPARSE: omit the line for any chunk whose diff already speaks for itself. Most chunks get none.

Rules for every line and badge:
- Orient, don't judge. Never say a change looks good, is correct, safe, simple, clean, elegant, or
  trivial. Evaluative or reassuring words are rejected by a validator and dropped.
- Never assert a semantic outcome that holds only on one branch or path. If two code paths differ,
  point at the difference to check — do not claim which one wins.
- Never imply the change is complete or that anything is not worth looking at.
- Register: short sentences, everyday words, high-school English, written for a tired reviewer.
- Read the diff as fragments. A line starting with "-" was removed and "+" was added; a "-"/"+" pair
  is one line edited, not two copies. A "…" marks a gap. Never claim something is duplicated unless
  both instances are visible together in one gap-free stretch.

Reply with STRICT JSON only, no other text. One key per chunk you labeled, keyed by its alias:
{"c1": {"line": "<line>", "badge": "<badge>"}, "c2": {"badge": "<badge>"}}

Include only the aliases you chose to label; omit every other chunk. Each entry may have "line",
"badge", or both. Use the aliases exactly as shown below.

${renderedBatch}`;
}

/**
 * The per-section narration prompt (spec 03). Asks for a short section intro and sparse per-chunk
 * orientation lines, in the R-036 register, orienting not judging. Bump NARRATION_PROMPT_VERSION on
 * any edit; overlays record it so stale-prompt narration can be told apart.
 */
export function sectionNarrationPrompt(renderedInput: string): string {
  return `You are writing short orientation notes for one file's section of a code-review "book".
A tired reviewer reads the book top to bottom, once. Your notes help them know what this file's
part of the story is and where to look. The notes never replace reading the diff.

Below is this section: its role, which other changed files it imports or is imported by, and each
chunk with its exact id and diff.

Write two things:

1. A section intro. At most 2 sentences and 200 characters. Say what this file's part of the
   change is and what to look for. Describe only this section's own diff — do NOT mention or refer
   to any other file or section.

2. Chunk lines. At most 1 sentence and 110 characters each. Be SPARSE: omit the line for any chunk
   whose diff already speaks for itself. A line must add something the diff does not already say; if
   it would only restate the code, leave it out. Most chunks should get no line at all.

Rules for every line you write:
- Orient, don't judge. Never say a change looks good, is correct, safe, simple, clean, elegant, or
  trivial. Evaluative or reassuring words are rejected by a validator and waste the whole reply.
- Never imply the change is complete or that anything is not worth looking at.
- Register: short sentences, everyday words, high-school English, written for a tired reviewer.
  Dense prose is a defect even when it is accurate.
- Read the diff as fragments. The chunks are disjoint pieces of one file with unshown code between
  them; a "…" marks a gap inside a chunk. A line starting with "-" was removed and one starting
  with "+" was added — a "-"/"+" pair is an edit of one line, not two copies. Similar lines in
  different chunks or across a gap are NOT duplicates. Never claim something is duplicated, added
  twice, or left over unless both instances are visible together inside one gap-free stretch.

Reply with STRICT JSON only, no other text:
{"intro": "<the section intro>", "chunks": {"<chunk id>": "<line>"}}

Include only the chunk ids you chose to write a line for; omit every other chunk. A chunk id is
the ENTIRE string after "chunk " below, including the file path and every "::" part — copy it
whole and unchanged. A shortened id loses the line.

Section:

${renderedInput}`;
}

/**
 * The book opener prompt (spec 03). Its input is the whole-book order manifest (renderOrderManifest
 * output); slice 3 passes that rendered manifest here. Same register and no-judgment rules as the
 * section prompt. Bump NARRATION_PROMPT_VERSION on any edit.
 */
export function openerNarrationPrompt(renderedManifest: string): string {
  return `You are writing the opening note for a code-review "book" — one short paragraph a tired
reviewer reads first, before any file.

Below is the whole-book manifest: every section (one per changed file) with its role, its chunks,
and which other sections it imports.

Write one opener: TWO short sentences (a hard validator rejects anything over 3 sentences or 320
characters, so leave headroom — two is the target). First sentence: what this change is about as a
whole. Second: what single thread to follow through the book.

Rules:
- Orient, don't judge. Never say the change looks good, is correct, safe, simple, clean, elegant, or
  trivial. Evaluative or reassuring words are rejected by a validator and waste the whole reply.
- Never imply the change is complete or that anything is not worth looking at.
- Register: short sentences, everyday words, high-school English, written for a tired reviewer.

Reply with STRICT JSON only, no other text:
{"opener": "<the opener>"}

Manifest:

${renderedManifest}`;
}
