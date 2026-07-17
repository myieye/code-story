import { type ImportGraph } from './import-graph.js';
import { type Chunk, isLowSignal } from './model.js';

export type FileRole = 'impl' | 'test' | 'low-signal' | 'periphery';

const TEST_DIR_SEGMENTS = new Set(['test', 'tests', '__tests__']);

export function isTestPath(path: string): boolean {
  const segments = path.split('/');
  if (segments.slice(0, -1).some((s) => TEST_DIR_SEGMENTS.has(s.toLowerCase()))) return true;
  const name = segments.at(-1) ?? '';
  return /\.(test|spec)\./i.test(name) || /Tests?\.cs$/.test(name);
}

/**
 * End-to-end / journey test heuristic (spec 05 tests-by-kind): a spec that drives the whole app
 * rather than one unit. Path-only — an `e2e`/`playwright` directory, or an `.e2e.` filename. Used
 * to close the book with journey specs; the impl-relative test axiom still wins over it when a
 * test carries a real `exercises` edge, so a mislabel only affects trailing ordering.
 */
export function isE2ePath(path: string): boolean {
  const segments = path.split('/').map((s) => s.toLowerCase());
  if (segments.slice(0, -1).some((s) => s === 'e2e' || s === 'playwright')) return true;
  return /\.e2e\./i.test(segments.at(-1) ?? '');
}

/**
 * Entry-point / route file heuristic (spec 05 anchor ordering: "pages/routes first"): a SvelteKit
 * route or layout, a file under a `routes`/`pages` directory, or a C# controller. Anchors from
 * these read before other anchors so a chapter opens at the surface the change is reached from.
 */
export function isRouteFile(path: string): boolean {
  const segments = path.split('/');
  if (segments.slice(0, -1).some((s) => s.toLowerCase() === 'routes' || s.toLowerCase() === 'pages')) return true;
  const name = segments.at(-1) ?? '';
  return name.startsWith('+page') || name.startsWith('+layout') || /Controller\.cs$/.test(name);
}

/**
 * One role per changed file (spec 01 tier 0, input 1). Precedence is deliberate:
 * low-signal wins over test (an all-stub test file is still a stub), test wins over
 * periphery (an unconnected test file is still a test), impl is the default.
 */
export function fileRoles(files: string[], chunks: Chunk[], graph: ImportGraph): Map<string, FileRole> {
  const chunksByFile = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = chunksByFile.get(chunk.file) ?? [];
    list.push(chunk);
    chunksByFile.set(chunk.file, list);
  }
  const connected = new Set<string>();
  for (const edge of graph.edges) {
    connected.add(edge.from);
    connected.add(edge.to);
  }

  const roles = new Map<string, FileRole>();
  for (const file of files) {
    const fileChunks = chunksByFile.get(file) ?? [];
    const role: FileRole =
      fileChunks.length > 0 && fileChunks.every(isLowSignal)
        ? 'low-signal'
        : isTestPath(file)
          ? 'test'
          : !connected.has(file)
            ? 'periphery'
            : 'impl';
    roles.set(file, role);
  }
  return roles;
}
