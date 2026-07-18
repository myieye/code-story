export const ORDER_PROMPT_VERSION = 'order-1';

/**
 * The tier-1 ordering prompt (spec 02). The model only picks among orders the validator and
 * `checkOrder` pre-gate will accept — its real freedom is which thread leads, what sits
 * together, and the rationale lines. Bump ORDER_PROMPT_VERSION on any edit; overlays record it.
 */
export function orderPrompt(renderedManifest: string): string {
  return `You are ordering the chapters of a code-review "book": one section per changed file.
A reviewer will read the sections top to bottom, once. Your job is to pick the order that
reads best as a story, and to give each section a one-line orientation.

Below is the manifest: every section with its role (impl/test/periphery), the chunks it
contains, and which other sections it imports.

Ordering rules, in priority order:
1. Hard rule: never place a section before another section it imports. A validator rejects
   any violation outright.
2. Keep each test section right after the implementation it exercises.
3. Group sections that tell one story; never interleave unrelated concerns between them.
4. Open with the section that best anchors understanding of the whole change, and let the
   order build toward the point of the change instead of burying it.

Rationale rules:
- One line per section, at most 12 words, plain everyday English.
- Orient the reviewer: say what this chapter is or what to look for next.
- Never evaluate or reassure ("looks good", "simple change") — orient, don't judge.

Reply with STRICT JSON only, no other text:
{"order": [every section key exactly once, in your proposed order], "rationales": {"<section key>": "<line>"}}

Manifest:

${renderedManifest}`;
}

export const CHAPTER_ORDER_PROMPT_VERSION = 'order-chapter-1';

/**
 * The chapter-mode ordering prompt (spec 05, #77). The model regroups and reorders the story chunks
 * into chapters — one concern per chapter — within the configured reading direction. It sees short
 * aliases (`c1`, `c2`, …), never raw chunk ids, so long ids can't be truncated in the reply (the #44
 * lesson). Bump CHAPTER_ORDER_PROMPT_VERSION on any edit; overlays record it.
 */
export function chapterOrderPrompt(renderedManifest: string, direction: 'consumer-first' | 'dependency-first'): string {
  const directionRule =
    direction === 'consumer-first'
      ? 'Consumer-first: a caller must read before every chunk it calls. A validator rejects any violation.'
      : 'Dependency-first: a callee must read before every chunk that calls it. A validator rejects any violation.';
  return `You are grouping the changes of a code-review "book" into chapters. A reviewer reads the
chapters top to bottom, once. Each chunk below is one changed piece of code, labelled c1, c2, and
so on. Your job is to sort the chunks into chapters that read best as a story.

Below is the manifest: every chunk with its title, kind, and file; the calls between them; and a
starting grouping you may keep or change.

Rules, in priority order:
1. Hard rule: ${directionRule}
2. One concern per chapter — group chunks that tell one story, and never mix unrelated concerns
   into the same chapter.
3. The first chunk of a chapter is its anchor: pick the chunk that best orients the reader to that
   chapter.
4. Open the book with the chapter that anchors the whole change, and build toward its point.

Rationale rules (one per chapter, keyed by the chapter's FIRST alias):
- One line, at most 12 words, plain everyday English.
- Orient the reviewer: say what this chapter is or what to look for next.
- Never evaluate or reassure ("looks good", "simple change") — orient, don't judge.

Reply with STRICT JSON only, no other text:
{"chapters": [["c3","c1"], ["c2"]], "rationales": {"c3": "<line>"}}
Every alias above must appear exactly once across all chapters.

Manifest:

${renderedManifest}`;
}
