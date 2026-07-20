export const DEFERRAL_PROMPT_VERSION = 'deferral-1';

/**
 * The deferral-answer prompt (spec 06 slice 6 / spec 07 G3). Unlike narration, this is an ANSWER to
 * a specific question the reviewer asked, so it may be substantive — but it stays grounded in the
 * one diff it is given and points at what to check rather than pronouncing a verdict. When the diff
 * doesn't settle the question it says so ("can't tell from this diff") instead of guessing.
 */
export function deferralPrompt(question: string, chunkTitle: string, file: string, diff: string, highlighted?: string): string {
  const highlightBlock = highlighted
    ? `\nThe reviewer highlighted these lines in particular:\n${highlighted}\n`
    : '';
  return `A code reviewer set one chunk of a diff aside and asked you a question about it. Answer the
question using ONLY the diff below. This is an answer to a real question, so it can be substantive —
but keep it grounded in what the diff actually shows.

Rules:
- Answer the question directly and briefly. A few sentences at most.
- Point at what to check rather than declaring a verdict. Don't say a change is good, correct, safe,
  clean, or fine — orient the reviewer, don't reassure them.
- If the diff doesn't contain enough to answer, say "I can't tell from this diff" and name what you'd
  need to see, rather than guessing.
- Register: short sentences, everyday words, high-school English, written for a tired reviewer.
- Read the diff as fragments. A line starting with "-" was removed and "+" was added; a "-"/"+" pair
  is one line edited, not two copies. A "…" marks a gap. Never claim something is duplicated unless
  both instances are visible together in one gap-free stretch.

Reply with STRICT JSON only, no other text:
{"answer": "<your answer>"}

Chunk: ${chunkTitle} (${file})
${highlightBlock}
Diff:
${diff}

Question:
${question}`;
}
