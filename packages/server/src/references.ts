import path from 'node:path';
import { type LineRange, type SymbolSpan } from '@code-story/core';
import { parseWith, svelteScriptBlocks, type TSNode, wasmForExtension } from './treesitter.js';

/** A candidate symbol reference found in a chunk's changed lines (spec 04 resolution pipeline step 1). */
export interface ReferenceHit {
  name: string;
  /** 1-based line of the reference within the file. */
  line: number;
}

/**
 * Universal builtins the resolver would never place, dropped up front. This is the whole scope
 * filter: v1 does no scope analysis (locals/params are left in — the downstream resolver drops
 * unresolvable names, so mild over-collection is fine; precision-over-recall, spec 04).
 */
const STOPLIST = new Set([
  'console',
  'JSON',
  'Math',
  'Object',
  'Array',
  'String',
  'Number',
  'Promise',
  'Set',
  'Map',
  'parseInt',
  'structuredClone',
  'nameof',
  'var',
  'ToString',
  'Equals',
  'GetHashCode',
]);

function isNoise(name: string): boolean {
  return name.length <= 1 || STOPLIST.has(name);
}

/**
 * A second parse pass over `ranges` (a chunk's changed-line ranges), collecting the callees and
 * constructed types referenced there. Reuses treesitter.ts grammar routing; Svelte parses script
 * blocks only. Names are deduped and filtered to those whose reference line falls inside a range.
 */
export async function extractReferences(filePath: string, content: string, ranges: LineRange[]): Promise<ReferenceHit[]> {
  if (ranges.length === 0) return [];
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const hits: ReferenceHit[] = [];

  if (ext === 'svelte') {
    for (const { body, lineOffset } of svelteScriptBlocks(content)) {
      const root = await parseWith('tree-sitter-typescript.wasm', body);
      if (root) collectTsHits(root, lineOffset, hits);
    }
  } else {
    const wasm = wasmForExtension(ext);
    if (!wasm) return [];
    const root = await parseWith(wasm, content);
    if (!root) return [];
    (ext === 'cs' ? collectCsHits : collectTsHits)(root, 0, hits);
  }

  const seen = new Set<string>();
  const out: ReferenceHit[] = [];
  for (const hit of hits) {
    if (!ranges.some((r) => hit.line >= r.start && hit.line <= r.end)) continue;
    if (seen.has(hit.name)) continue;
    seen.add(hit.name);
    out.push(hit);
  }
  return out;
}

/** TS/TSX/JS: call callees (bare + member tail), `new` targets, and capitalized JSX components. */
function collectTsHits(node: TSNode, offset: number, out: ReferenceHit[]): void {
  if (node.type === 'call_expression') {
    push(tailIdentifier(node.childForFieldName('function')), offset, out);
  } else if (node.type === 'new_expression') {
    push(tailIdentifier(node.childForFieldName('constructor')), offset, out);
  } else if (node.type === 'jsx_opening_element' || node.type === 'jsx_self_closing_element') {
    const name = tailIdentifier(node.childForFieldName('name'));
    // Lowercase names are intrinsic HTML tags (<div>), not component references.
    if (name && /^[A-Z]/.test(name.text)) push(name, offset, out);
  }
  for (const child of node.namedChildren) if (child) collectTsHits(child, offset, out);
}

/** C#: invocation callees (bare + member tail) and object-creation type names. */
function collectCsHits(node: TSNode, offset: number, out: ReferenceHit[]): void {
  if (node.type === 'invocation_expression') {
    push(tailIdentifier(node.childForFieldName('function')), offset, out);
  } else if (node.type === 'object_creation_expression') {
    push(tailIdentifier(node.childForFieldName('type')), offset, out);
  }
  for (const child of node.namedChildren) if (child) collectCsHits(child, offset, out);
}

/** The rightmost plain identifier of a callee/type expression (the tail of `a.b.foo` is `foo`). */
function tailIdentifier(node: TSNode | null): TSNode | undefined {
  if (!node) return undefined;
  switch (node.type) {
    case 'identifier':
    case 'property_identifier':
    case 'type_identifier':
      return node;
    case 'member_expression':
      return tailIdentifier(node.childForFieldName('property'));
    case 'member_access_expression':
    case 'qualified_name':
      return tailIdentifier(node.childForFieldName('name'));
    case 'generic_name':
      return tailIdentifier(node.namedChildren.find((c) => c?.type === 'identifier') ?? null);
    case 'nested_identifier':
      return tailIdentifier(node.namedChildren.at(-1) ?? null);
    default:
      return undefined;
  }
}

function push(node: TSNode | undefined, offset: number, out: ReferenceHit[]): void {
  if (!node || isNoise(node.text)) return;
  out.push({ name: node.text, line: node.startPosition.row + 1 + offset });
}

/** A referenced name resolved to the single file + span that defines it. */
export interface DefiningSpan {
  file: string;
  span: SymbolSpan;
}

/**
 * Resolve a referenced name to its one justified defining span across a set of candidate files,
 * shared by the context and chunk-graph resolvers. Uniqueness is two-layered, and either failure
 * yields nothing — a wrong definition/edge is worse than a missing one (spec 05):
 *   - within a file, more than one same-name span at any nesting is an unresolvable overload set
 *     (#86: the second overload could otherwise never be the target); that file contributes no
 *     candidate.
 *   - across files, the defining file must be justified by an import edge from the consumer (its own
 *     file always qualifies) and be the only one left (#91: a lone in-diff match for a repo-wide
 *     name otherwise resolves confidently to the wrong class).
 * `skip` drops a per-file candidate before justification (context-resolve uses it to ignore a symbol
 * the chunk declares itself).
 */
export function resolveDefiningSpan(
  name: string,
  consumerFile: string,
  imported: ReadonlySet<string>,
  symbolsByFile: Iterable<readonly [string, SymbolSpan[] | undefined]>,
  skip?: (file: string, span: SymbolSpan) => boolean,
): DefiningSpan | undefined {
  const perFile = new Map<string, SymbolSpan>();
  for (const [file, symbols] of symbolsByFile) {
    const span = uniqueSpanInFile(symbols, name);
    if (span && !skip?.(file, span)) perFile.set(file, span);
  }
  const justified = [...perFile.keys()].filter((f) => f === consumerFile || imported.has(f));
  if (justified.length !== 1) return undefined;
  const file = justified[0]!;
  return { file, span: perFile.get(file)! };
}

/** The one span named `name` at any nesting depth, or undefined when there are zero or several. */
function uniqueSpanInFile(symbols: SymbolSpan[] | undefined, name: string): SymbolSpan | undefined {
  let found: SymbolSpan | undefined;
  for (const span of walkSpans(symbols)) {
    if (span.name !== name) continue;
    if (found) return undefined;
    found = span;
  }
  return found;
}

function* walkSpans(symbols: SymbolSpan[] | undefined): Generator<SymbolSpan> {
  for (const s of symbols ?? []) {
    yield s;
    yield* walkSpans(s.children);
  }
}
