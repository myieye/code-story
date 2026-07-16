import path from 'node:path';
import { type Chunk, chunkFile, type FileDiff } from '@code-story/core';
import { fileAt, type ResolvedRange } from './git.js';
import { extractSymbols } from './treesitter.js';

const CONFIG_EXTENSIONS = new Set(['json', 'yaml', 'yml', 'lock', 'toml', 'xml', 'csproj', 'props', 'targets', 'config', 'resx']);

export async function computeChunks(repo: string, range: ResolvedRange, files: FileDiff[]): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
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

    const symbols = noContent ? undefined : await extractSymbols(file.path, primary);
    const ext = path.extname(file.path).slice(1).toLowerCase();

    chunks.push(
      ...chunkFile({
        diff: file,
        lines: primary.split('\n'),
        baseLines: base.split('\n'),
        symbols,
        configLike: CONFIG_EXTENSIONS.has(ext),
      }),
    );
  }
  return chunks;
}
