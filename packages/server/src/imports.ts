import path from 'node:path';

export interface ExtractedImports {
  specifiers: string[];
  declaredNamespaces?: string[];
}

const TS_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts']);
const FROM_SPECIFIER = /\bfrom\s*['"]([^'"]+)['"]/g;
const SIDE_EFFECT_IMPORT = /(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g;
const SVELTE_SCRIPT = /<script[^>]*>([\s\S]*?)<\/script>/g;
const CS_USING = /^\s*(?:global\s+)?using\s+(?:static\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*;/gm;
const CS_NAMESPACE = /^\s*namespace\s+([A-Za-z_][A-Za-z0-9_.]*)\s*[;{]/gm;

/** Raw import specifiers (and, for C#, declared namespaces) of a changed file, or undefined. */
export function extractImports(filePath: string, source: string): ExtractedImports | undefined {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (ext === 'cs') return { specifiers: matchAll(source, CS_USING), declaredNamespaces: matchAll(source, CS_NAMESPACE) };
  if (ext === 'svelte') {
    const scripts = [...source.matchAll(SVELTE_SCRIPT)].map((m) => m[1] ?? '').join('\n');
    return { specifiers: tsSpecifiers(scripts) };
  }
  if (TS_EXTENSIONS.has(ext)) return { specifiers: tsSpecifiers(source) };
  return undefined;
}

function tsSpecifiers(source: string): string[] {
  return [...matchAll(source, FROM_SPECIFIER), ...matchAll(source, SIDE_EFFECT_IMPORT)];
}

function matchAll(source: string, re: RegExp): string[] {
  return [...source.matchAll(re)].map((m) => m[1]!).filter((s) => s.length > 0);
}
