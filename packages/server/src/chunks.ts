import path from 'node:path';
import {
  buildImportGraph,
  type Chunk,
  chunkFile,
  classifyGenerated,
  type FileContents,
  type FileDiff,
  type FileImports,
  type ImportGraph,
} from '@code-story/core';
import { fileAt, type ResolvedRange } from './git.js';
import { extractImports } from './imports.js';
import { extractSymbols } from './treesitter.js';

const CONFIG_EXTENSIONS = new Set(['json', 'yaml', 'yml', 'lock', 'toml', 'xml', 'csproj', 'props', 'targets', 'config', 'resx']);

export interface ComputedChunks {
  chunks: Chunk[];
  /** Fetched file contents, keyed like Chunk.file — the export/render input. */
  contents: Map<string, FileContents>;
  /** Import graph over the changed files (spec 01 ordering input). */
  graph: ImportGraph;
}

export async function computeChunks(repo: string, range: ResolvedRange, files: FileDiff[]): Promise<ComputedChunks> {
  const chunks: Chunk[] = [];
  const contents = new Map<string, FileContents>();
  const imports: FileImports[] = [];
  for (const file of files) {
    const deleted = file.status === 'deleted';
    const noContent = file.binary || file.submodule === true;
    const primary = noContent
      ? ''
      : deleted
        ? await fileAt(repo, range.base, file.path)
        : await fileAt(repo, range.head, file.path);
    const base =
      noContent || deleted || file.status === 'added'
        ? ''
        : await fileAt(repo, range.base, file.basePath ?? file.path);

    const lines = primary.split('\n');
    const baseLines = base.split('\n');
    if (!noContent) {
      contents.set(
        file.path,
        deleted ? { base: lines } : file.status === 'added' ? { head: lines } : { head: lines, base: baseLines },
      );
    }

    const symbols = noContent ? undefined : await extractSymbols(file.path, primary);
    const ext = path.extname(file.path).slice(1).toLowerCase();
    const generatedReason = classifyGenerated(file.path, noContent ? [] : lines);

    if (!noContent) {
      const extracted = extractImports(file.path, primary);
      if (extracted) imports.push({ path: file.path, ...extracted });
    }

    chunks.push(
      ...chunkFile({
        diff: file,
        lines,
        baseLines,
        symbols,
        configLike: CONFIG_EXTENSIONS.has(ext),
        ...(generatedReason !== undefined ? { generatedReason } : {}),
      }),
    );
  }
  return { chunks, contents, graph: buildImportGraph(imports) };
}
