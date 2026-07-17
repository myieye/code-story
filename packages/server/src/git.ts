import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { type FileDiff, parseGitDiff } from '@code-story/core';

const execFileAsync = promisify(execFile);

async function git(repo: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', repo, ...args], {
    maxBuffer: 256 * 1024 * 1024,
  });
  return stdout;
}

export interface ResolvedRange {
  base: string;
  head: string;
}

/** Accepts `<base>..<head>` or `<base>` (head defaults to HEAD); resolves both to SHAs. */
export async function resolveRange(repo: string, range: string): Promise<ResolvedRange> {
  const [baseRef, headRef = 'HEAD'] = range.split('..').filter(Boolean) as [string, string?];
  if (!baseRef) throw new Error(`Invalid range: "${range}"`);
  const base = (await git(repo, ['rev-parse', '--verify', `${baseRef}^{commit}`])).trim();
  const head = (await git(repo, ['rev-parse', '--verify', `${headRef}^{commit}`])).trim();
  return { base, head };
}

export async function diffRange(repo: string, { base, head }: ResolvedRange): Promise<FileDiff[]> {
  const out = await git(repo, ['diff', '-U0', '--no-color', '--find-renames', base, head]);
  return parseGitDiff(out);
}

export async function fileAt(repo: string, sha: string, path: string): Promise<string> {
  return git(repo, ['show', `${sha}:${path}`]);
}

/** Every file path present at a commit — the head path index the context resolver matches against. */
export async function listTree(repo: string, sha: string): Promise<string[]> {
  const out = await git(repo, ['ls-tree', '-r', '--name-only', sha]);
  return out.split('\n').filter((p) => p.length > 0);
}

/** First root commit — a repo identity stable across clones, branches, and directory moves. */
export async function rootCommit(repo: string): Promise<string> {
  const out = await git(repo, ['rev-list', '--max-parents=0', '--first-parent', 'HEAD']);
  const sha = out.trim().split('\n').at(-1);
  if (!sha) throw new Error('Could not determine root commit');
  return sha;
}

export async function originUrl(repo: string): Promise<string | undefined> {
  try {
    return (await git(repo, ['config', '--get', 'remote.origin.url'])).trim() || undefined;
  } catch {
    return undefined;
  }
}
