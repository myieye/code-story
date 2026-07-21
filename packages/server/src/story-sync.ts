import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Best-effort auto-commit + push of the story snapshots directory (R-064), so stories sync across
 * environments through the repo. Deliberately non-fatal: any git failure (no repo, no upstream,
 * detached HEAD, offline) is logged and swallowed — syncing must never break a compile or a review.
 *
 * Scoped to `.code-story/stories` only, committed onto the current branch. Ambitious paths deferred
 * (spec 08): a dedicated sync branch / separate remote, and conflict-free review-state sync.
 */
export interface SyncResult {
  synced: boolean;
  reason?: string;
}

async function git(repo: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', repo, ...args], { maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

const STORIES_PATH = '.code-story/stories';

export async function syncStories(repo: string, opts: { enabled: boolean; push?: boolean }): Promise<SyncResult> {
  if (!opts.enabled) return { synced: false, reason: 'disabled' };
  try {
    // Inside a work tree? (avoids acting on a non-repo directory)
    const inside = (await git(repo, ['rev-parse', '--is-inside-work-tree'])).trim();
    if (inside !== 'true') return { synced: false, reason: 'not a git work tree' };

    await git(repo, ['add', '--', STORIES_PATH]);

    // Anything actually staged under the stories path? If not, nothing to do.
    const staged = (await git(repo, ['diff', '--cached', '--name-only', '--', STORIES_PATH])).trim();
    if (!staged) return { synced: false, reason: 'no changes' };

    await git(repo, ['commit', '-m', 'code-story: sync stories', '--', STORIES_PATH]);

    if (opts.push !== false) {
      try {
        await git(repo, ['push']);
      } catch (e) {
        console.warn('code-story: story committed but push failed (will retry on next sync):', errMsg(e));
        return { synced: true, reason: 'committed, push failed' };
      }
    }
    return { synced: true };
  } catch (e) {
    console.warn('code-story: story sync skipped:', errMsg(e));
    return { synced: false, reason: errMsg(e) };
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
