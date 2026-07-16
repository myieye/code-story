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
