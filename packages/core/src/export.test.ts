import { describe, expect, it } from 'vitest';
import { compileBook } from './book.js';
import { chunkFile } from './chunker.js';
import { exportBookMarkdown, type FileContents } from './export.js';
import { type FileDiff } from './diff.js';

describe('exportBookMarkdown', () => {
  it('renders headings, metadata, and fenced diffs from file contents', () => {
    const diff: FileDiff = {
      path: 'src/app.ts',
      status: 'modified',
      binary: false,
      hunks: [{ baseStart: 2, baseCount: 1, headStart: 2, headCount: 2 }],
    };
    const head = ['const a = 1;', 'const b = 2;', 'const c = 3;'];
    const base = ['const a = 1;', 'const old = 0;'];
    const chunks = chunkFile({ diff, lines: head, baseLines: base });
    const compiled = compileBook({ files: [diff], chunks, graph: { edges: [], unresolved: 0 }, headSha: 'deadbeef123' });

    const md = exportBookMarkdown({
      ...compiled,
      contents: new Map<string, FileContents>([['src/app.ts', { head, base }]]),
      title: 'main..HEAD',
    });

    expect(md).toContain('# Code story — main..HEAD');
    expect(md).toContain('1 chunks · 1 sections · head deadbeef');
    expect(md).toContain('## src/app.ts');
    expect(md).toContain('other · +2 -1');
    expect(md).toContain('```diff\n@@ -2,1 +2,2 @@\n-const old = 0;\n+const b = 2;\n+const c = 3;\n```');
  });

  it('grows the fence past backtick runs in content and notes missing content', () => {
    const diff: FileDiff = {
      path: 'README.md',
      status: 'modified',
      binary: false,
      hunks: [{ baseStart: 1, baseCount: 0, headStart: 1, headCount: 1 }],
    };
    const head = ['```diff embedded fence```'];
    const chunks = chunkFile({ diff, lines: head, baseLines: [] });
    const compiled = compileBook({ files: [diff], chunks, graph: { edges: [], unresolved: 0 }, headSha: 'abc' });

    const withContent = exportBookMarkdown({
      ...compiled,
      contents: new Map([['README.md', { head }]]),
      title: 't',
    });
    expect(withContent).toContain('````diff\n@@ -1,0 +1,1 @@\n+```diff embedded fence```\n````');

    const withoutContent = exportBookMarkdown({ ...compiled, contents: new Map(), title: 't' });
    expect(withoutContent).toContain('_content not available (binary or submodule)_');
  });

  it('embeds narration as > AI blockquotes and a partial-state header', () => {
    const one: FileDiff = { path: 'a.ts', status: 'modified', binary: false, hunks: [{ baseStart: 1, baseCount: 0, headStart: 1, headCount: 1 }] };
    const two: FileDiff = { path: 'b.ts', status: 'modified', binary: false, hunks: [{ baseStart: 1, baseCount: 0, headStart: 1, headCount: 1 }] };
    const aChunks = chunkFile({ diff: one, lines: ['const a = 1;'], baseLines: [] });
    const bChunks = chunkFile({ diff: two, lines: ['const b = 2;'], baseLines: [] });
    const chunks = [...aChunks, ...bChunks];
    const compiled = compileBook({ files: [one, two], chunks, graph: { edges: [], unresolved: 0 }, headSha: 'abc' });
    const contents = new Map<string, FileContents>([
      ['a.ts', { head: ['const a = 1;'] }],
      ['b.ts', { head: ['const b = 2;'] }],
    ]);

    const md = exportBookMarkdown({
      ...compiled,
      contents,
      title: 't',
      // Only a.ts narrated → 1 of 2, so the partial header must appear.
      narration: {
        version: 1,
        model: 'opus',
        promptVersion: 'narration-1',
        opener: { text: 'Read the a change first.', key: 'k' },
        sections: {
          'a.ts': { fingerprint: 'f', intro: 'This sets up the value.', chunks: { [aChunks[0]!.id]: 'Watch the initial value.' }, generatedAt: 't' },
        },
      },
    });

    expect(md).toContain('> AI narration: 1 of 2 sections');
    expect(md).toContain('> AI: Read the a change first.');
    expect(md).toContain('> AI: This sets up the value.');
    expect(md).toContain('> AI: Watch the initial value.');
    // A fully narrated book omits the header.
    expect(md).not.toContain('2 of 2 sections');
  });
});
