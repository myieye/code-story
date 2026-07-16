import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { type SymbolKind, type SymbolSpan } from '@code-story/core';

// The vscode package bundles grammars WITH their matching runtime — loading its runtime (not a
// separately-versioned web-tree-sitter) is what guarantees wasm ABI compatibility.
const wasmDir = path.dirname(fileURLToPath(import.meta.resolve('@vscode/tree-sitter-wasm')));

type Parser = {
  setLanguage(lang: unknown): void;
  parse(text: string): { rootNode: TSNode } | null;
};

interface TSNode {
  type: string;
  startPosition: { row: number };
  endPosition: { row: number };
  namedChildren: (TSNode | null)[];
  childForFieldName(name: string): TSNode | null;
  text: string;
}

interface LanguageConfig {
  wasm: string;
  /** node type → symbol kind */
  containers: Record<string, SymbolKind>;
}

const TS_CONTAINERS: Record<string, SymbolKind> = {
  class_declaration: 'type',
  abstract_class_declaration: 'type',
  interface_declaration: 'type',
  enum_declaration: 'type',
  function_declaration: 'function',
  generator_function_declaration: 'function',
  method_definition: 'function',
};

const LANGUAGES: Record<string, LanguageConfig> = {
  cs: {
    wasm: 'tree-sitter-c-sharp.wasm',
    containers: {
      namespace_declaration: 'type',
      file_scoped_namespace_declaration: 'type',
      class_declaration: 'type',
      struct_declaration: 'type',
      interface_declaration: 'type',
      record_declaration: 'type',
      enum_declaration: 'type',
      method_declaration: 'function',
      constructor_declaration: 'function',
      property_declaration: 'function',
      local_function_statement: 'function',
    },
  },
  ts: { wasm: 'tree-sitter-typescript.wasm', containers: TS_CONTAINERS },
  mts: { wasm: 'tree-sitter-typescript.wasm', containers: TS_CONTAINERS },
  cts: { wasm: 'tree-sitter-typescript.wasm', containers: TS_CONTAINERS },
  tsx: { wasm: 'tree-sitter-tsx.wasm', containers: TS_CONTAINERS },
  js: { wasm: 'tree-sitter-javascript.wasm', containers: TS_CONTAINERS },
  mjs: { wasm: 'tree-sitter-javascript.wasm', containers: TS_CONTAINERS },
  jsx: { wasm: 'tree-sitter-javascript.wasm', containers: TS_CONTAINERS },
};

let runtime: Promise<{ Parser: new () => Parser; Language: { load(p: string): Promise<unknown> } }> | undefined;
const languages = new Map<string, Promise<unknown>>();

async function getRuntime() {
  runtime ??= (async () => {
    const mod = (await import(pathToFileURL(path.join(wasmDir, 'tree-sitter.js')).href)) as {
      default: { Parser: (new () => Parser) & { init(): Promise<void> }; Language: { load(p: string): Promise<unknown> } };
    };
    await mod.default.Parser.init();
    return mod.default;
  })();
  return runtime;
}

async function parseWith(wasm: string, content: string): Promise<TSNode | undefined> {
  const { Parser, Language } = await getRuntime();
  let lang = languages.get(wasm);
  if (!lang) {
    lang = Language.load(path.join(wasmDir, wasm));
    languages.set(wasm, lang);
  }
  const parser = new Parser();
  parser.setLanguage(await lang);
  return parser.parse(content)?.rootNode;
}

function collectSymbols(node: TSNode, containers: Record<string, SymbolKind>, out: SymbolSpan[], lineOffset: number): void {
  for (const child of node.namedChildren) {
    if (!child) continue;
    const kind = containers[child.type];
    if (kind) {
      const span: SymbolSpan = {
        name: symbolName(child),
        kind,
        startLine: child.startPosition.row + 1 + lineOffset,
        endLine: child.endPosition.row + 1 + lineOffset,
        children: [],
      };
      out.push(span);
      collectSymbols(child, containers, span.children, lineOffset);
    } else if (child.type === 'variable_declarator' || child.type === 'public_field_definition') {
      const value = child.childForFieldName('value');
      if (value && (value.type === 'arrow_function' || value.type === 'function_expression')) {
        const span: SymbolSpan = {
          name: symbolName(child),
          kind: 'function',
          startLine: child.startPosition.row + 1 + lineOffset,
          endLine: child.endPosition.row + 1 + lineOffset,
          children: [],
        };
        out.push(span);
        collectSymbols(value, containers, span.children, lineOffset);
        continue;
      }
      collectSymbols(child, containers, out, lineOffset);
    } else {
      collectSymbols(child, containers, out, lineOffset);
    }
  }
}

function symbolName(node: TSNode): string {
  return node.childForFieldName('name')?.text ?? '(anon)';
}

/**
 * Declaration outline of a file, or undefined for unsupported languages (the chunker then
 * falls back to whole-hunk chunks — the leftovers guarantee, spec 00a §States).
 */
export async function extractSymbols(filePath: string, content: string): Promise<SymbolSpan[] | undefined> {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (ext === 'svelte') return extractSvelteSymbols(content);
  const config = LANGUAGES[ext];
  if (!config) return undefined;
  const root = await parseWith(config.wasm, content);
  if (!root) return undefined;
  const symbols: SymbolSpan[] = [];
  collectSymbols(root, config.containers, symbols, 0);
  return symbols;
}

const SVELTE_BLOCK = /<(script|style)([^>]*)>([\s\S]*?)<\/\1>/g;

/**
 * No Svelte grammar ships in @vscode/tree-sitter-wasm, so M0 splits the file itself: script
 * blocks parse with the TS grammar (that's where the symbols live), everything else becomes
 * markup regions.
 */
async function extractSvelteSymbols(content: string): Promise<SymbolSpan[]> {
  const lineOf = (index: number) => content.slice(0, index).split('\n').length;
  const totalLines = content.split('\n').length;
  const symbols: SymbolSpan[] = [];
  const blocks: { start: number; end: number }[] = [];

  for (const m of content.matchAll(SVELTE_BLOCK)) {
    const [full, tag, attrs, body] = m as unknown as [string, string, string, string];
    const startLine = lineOf(m.index);
    const endLine = startLine + full.split('\n').length - 1;
    blocks.push({ start: startLine, end: endLine });

    if (tag === 'script') {
      const bodyStartLine = lineOf(m.index + full.indexOf(body));
      const children: SymbolSpan[] = [];
      const root = await parseWith('tree-sitter-typescript.wasm', body);
      if (root) collectSymbols(root, TS_CONTAINERS, children, bodyStartLine - 1);
      const name = /context\s*=\s*["']module["']|(^|\s)module(\s|$|=)/.test(attrs) ? 'module script' : 'script';
      symbols.push({ name, kind: 'type', startLine, endLine, children });
    } else {
      symbols.push({ name: 'style', kind: 'markup', startLine, endLine, children: [] });
    }
  }

  blocks.sort((a, b) => a.start - b.start);
  let cursor = 1;
  for (const b of [...blocks, { start: totalLines + 1, end: totalLines + 1 }]) {
    if (b.start > cursor) {
      symbols.push({ name: 'template', kind: 'markup', startLine: cursor, endLine: b.start - 1, children: [] });
    }
    cursor = Math.max(cursor, b.end + 1);
  }
  return symbols.sort((a, b) => a.startLine - b.startLine);
}
