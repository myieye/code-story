export interface Hunk {
  /** For a count of 0, start is the line before the insertion/deletion point (unified diff semantics). */
  baseStart: number;
  baseCount: number;
  headStart: number;
  headCount: number;
}

export type FileStatus = 'added' | 'deleted' | 'modified' | 'renamed';

export interface FileDiff {
  /** Head-side path (base-side for deletions) */
  path: string;
  /** Base-side path when renamed */
  basePath?: string;
  status: FileStatus;
  binary: boolean;
  hunks: Hunk[];
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
// Ambiguous for paths containing " b/", which later ---/+++/rename lines correct
const DIFF_HEADER = /^diff --git a\/(.*) b\/(.*)$/;

/**
 * Parses `git diff -U0 --no-color` output. Line contents are not captured — chunking works from
 * full base/head file contents plus these ranges.
 */
export function parseGitDiff(diffText: string): FileDiff[] {
  const files: FileDiff[] = [];
  let current: FileDiff | undefined;

  for (const line of diffText.split('\n')) {
    const header = DIFF_HEADER.exec(line);
    if (header) {
      current = { path: header[2]!, status: 'modified', binary: false, hunks: [] };
      files.push(current);
      continue;
    }
    if (!current) continue;

    if (line.startsWith('new file mode')) {
      current.status = 'added';
    } else if (line.startsWith('deleted file mode')) {
      current.status = 'deleted';
    } else if (line.startsWith('rename from ')) {
      current.status = 'renamed';
      current.basePath = line.slice('rename from '.length);
    } else if (line.startsWith('rename to ')) {
      current.path = line.slice('rename to '.length);
    } else if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      current.binary = true;
    } else if (line.startsWith('--- a/') && current.status !== 'renamed') {
      if (current.status === 'deleted') current.path = line.slice('--- a/'.length);
    } else if (line.startsWith('+++ b/')) {
      current.path = line.slice('+++ b/'.length);
    } else {
      const m = HUNK_HEADER.exec(line);
      if (m) {
        current.hunks.push({
          baseStart: Number(m[1]),
          baseCount: m[2] === undefined ? 1 : Number(m[2]),
          headStart: Number(m[3]),
          headCount: m[4] === undefined ? 1 : Number(m[4]),
        });
      }
    }
  }

  return files.filter((f) => f.path !== '');
}
