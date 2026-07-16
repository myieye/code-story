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
