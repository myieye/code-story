export type SymbolKind = 'type' | 'function' | 'markup';

/** One node of a file's declaration outline. Lines are 1-based, inclusive. */
export interface SymbolSpan {
  name: string;
  kind: SymbolKind;
  startLine: number;
  endLine: number;
  children: SymbolSpan[];
}

/** Innermost-first path of spans containing the line, or [] if none. */
export function symbolPathAt(symbols: SymbolSpan[], line: number): SymbolSpan[] {
  for (const s of symbols) {
    if (line >= s.startLine && line <= s.endLine) {
      return [...symbolPathAt(s.children, line), s];
    }
  }
  return [];
}
