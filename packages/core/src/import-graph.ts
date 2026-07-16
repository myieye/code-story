// Import graph over changed files only (spec 01 tier 0, input 2): resolve import/using
// specifiers against the OTHER changed files, no full-project index. Unresolved edges are
// silently dropped — a miss just means no ordering constraint. Precision over recall: never
// fabricate an edge.

export interface ImportEdge {
  /** Changed-file path that depends on... */
  from: string;
  /** ...this changed-file path. */
  to: string;
}

export interface ImportGraph {
  edges: ImportEdge[];
  /** Specifiers that matched no changed file (dropped). Diagnostic only. */
  unresolved: number;
}

export interface FileImports {
  path: string;
  /** Raw specifiers: TS/Svelte `import`/`export ... from` targets; C# `using` namespaces. */
  specifiers: string[];
  /** C# only: namespaces this file declares (file-scoped or block). */
  declaredNamespaces?: string[];
}

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.svelte'];

export function buildImportGraph(files: FileImports[]): ImportGraph {
  const changed = new Set(files.map((f) => f.path));
  const byNamespace = new Map<string, string[]>();
  for (const f of files) {
    for (const ns of f.declaredNamespaces ?? []) {
      const list = byNamespace.get(ns) ?? [];
      list.push(f.path);
      byNamespace.set(ns, list);
    }
  }

  const edges: ImportEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (from: string, to: string) => {
    if (to === from) return;
    const key = `${from}\0${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to });
  };

  let unresolved = 0;
  for (const f of files) {
    unresolved += isCSharp(f.path)
      ? resolveCSharp(f, byNamespace, addEdge)
      : resolveTs(f, changed, addEdge);
  }
  return { edges, unresolved };
}

function isCSharp(path: string): boolean {
  return path.toLowerCase().endsWith('.cs');
}

function resolveTs(file: FileImports, changed: Set<string>, addEdge: (from: string, to: string) => void): number {
  const dir = dirname(file.path);
  let unresolved = 0;
  for (const spec of file.specifiers) {
    const target = spec.startsWith('.')
      ? resolveRelative(joinNormalize(dir, spec), changed)
      : resolveAlias(spec, changed);
    if (target === undefined) unresolved++;
    else if (target !== file.path) addEdge(file.path, target);
  }
  return unresolved;
}

function resolveRelative(base: string, changed: Set<string>): string | undefined {
  if (changed.has(base)) return base;
  for (const ext of RESOLVE_EXTENSIONS) if (changed.has(base + ext)) return base + ext;
  for (const ext of RESOLVE_EXTENSIONS) if (changed.has(`${base}/index${ext}`)) return `${base}/index${ext}`;
  return undefined;
}

/**
 * Alias specifiers (SvelteKit `$lib/...`): we can't know the alias root without project config,
 * so match the post-sigil path as a segment-suffix of a changed file. Requiring ≥2 trailing
 * segments and a unique hit keeps a bare `$lib/utils` from latching onto `foo/bar/utils.ts`.
 */
function resolveAlias(spec: string, changed: Set<string>): string | undefined {
  if (!spec.startsWith('$')) return undefined;
  const afterSigil = spec.split('/').filter(Boolean).slice(1).map(stripCodeExt);
  if (afterSigil.length < 2) return undefined;

  let match: string | undefined;
  for (const path of changed) {
    const segs = path.split('/').map(stripCodeExt);
    if (endsWithSegments(segs, afterSigil)) {
      if (match !== undefined) return undefined;
      match = path;
    }
  }
  return match;
}

/**
 * C#: A → B when A `using N` (or A's namespace descends from N) and B declares namespace N.
 * Same-namespace files get no edge. The ancestor-namespace rule is deliberate: a file in
 * `X.Tests` can reference `X` types with no explicit using — that's a real dependency the
 * usings alone miss (the HistoryServiceActivityTests → HistoryService case).
 */
function resolveCSharp(
  file: FileImports,
  byNamespace: Map<string, string[]>,
  addEdge: (from: string, to: string) => void,
): number {
  const own = new Set(file.declaredNamespaces ?? []);
  let unresolved = 0;
  for (const using of file.specifiers) {
    if (own.has(using)) continue;
    const targets = byNamespace.get(using);
    if (targets === undefined) unresolved++;
    else for (const t of targets) addEdge(file.path, t);
  }
  for (const ns of own) {
    for (const ancestor of ancestorNamespaces(ns)) {
      if (own.has(ancestor)) continue;
      for (const t of byNamespace.get(ancestor) ?? []) addEdge(file.path, t);
    }
  }
  return unresolved;
}

function ancestorNamespaces(ns: string): string[] {
  const parts = ns.split('.');
  const result: string[] = [];
  for (let i = parts.length - 1; i > 0; i--) result.push(parts.slice(0, i).join('.'));
  return result;
}

function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

function joinNormalize(dir: string, rel: string): string {
  const out: string[] = [];
  for (const seg of [...dir.split('/'), ...rel.split('/')]) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

function stripCodeExt(segment: string): string {
  for (const ext of RESOLVE_EXTENSIONS) if (segment.endsWith(ext)) return segment.slice(0, -ext.length);
  return segment;
}

function endsWithSegments(segs: string[], suffix: string[]): boolean {
  if (suffix.length > segs.length) return false;
  const offset = segs.length - suffix.length;
  return suffix.every((s, i) => s === segs[offset + i]);
}
