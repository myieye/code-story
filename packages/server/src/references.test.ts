import { type LineRange } from '@code-story/core';
import { describe, expect, it } from 'vitest';
import { extractReferences } from './references.js';

const wholeFile: LineRange[] = [{ start: 1, end: 1000 }];

function names(hits: { name: string }[]): string[] {
  return hits.map((h) => h.name).sort();
}

describe('extractReferences', () => {
  it('captures TS bare calls, member-call tails, and new targets', async () => {
    const ts = `import { fetchUser } from './api';
function run() {
  const u = fetchUser();
  repo.saveUser(u);
  return new UserRecord(u);
}
`;
    expect(names(await extractReferences('a.ts', ts, wholeFile))).toEqual(['UserRecord', 'fetchUser', 'saveUser']);
  });

  it('keeps capitalized JSX components and drops lowercase html tags', async () => {
    const tsx = `export function View() {
  return (
    <div>
      <UserCard name="x" />
      <span>hi</span>
    </div>
  );
}
`;
    const found = names(await extractReferences('a.tsx', tsx, wholeFile));
    expect(found).toContain('UserCard');
    expect(found).not.toContain('div');
    expect(found).not.toContain('span');
  });

  it('captures C# invocations (bare + member) and object creations', async () => {
    const cs = `namespace Lex;
public class Svc
{
    public void Run(Repo repo)
    {
        Configure();
        repo.Save();
        var x = new UserRecord();
    }
}
`;
    const found = names(await extractReferences('a.cs', cs, wholeFile));
    expect(found).toContain('Configure');
    expect(found).toContain('Save');
    expect(found).toContain('UserRecord');
  });

  it('extracts references from Svelte script blocks but not template markup', async () => {
    const svelte = `<script lang="ts">
  import { loadData } from './data';
  function refresh() {
    loadData();
  }
</script>

<Widget on:click={refresh} />
`;
    const found = names(await extractReferences('a.svelte', svelte, wholeFile));
    expect(found).toContain('loadData');
    // Widget lives in the template — no grammar, so it is never extracted (spec 04 non-goal).
    expect(found).not.toContain('Widget');
  });

  it('excludes references whose line is outside the given ranges', async () => {
    const ts = `inside();
outside();
`;
    const hits = await extractReferences('a.ts', ts, [{ start: 1, end: 1 }]);
    expect(names(hits)).toEqual(['inside']);
  });

  it('dedupes repeated names to a single hit', async () => {
    const ts = `log();
log();
log();
`;
    const hits = await extractReferences('a.ts', ts, wholeFile);
    expect(hits.filter((h) => h.name === 'log')).toHaveLength(1);
  });

  it('drops single-character names and universal builtins', async () => {
    const ts = `f();
new Map();
structuredClone(v);
keep();
`;
    const found = names(await extractReferences('a.ts', ts, wholeFile));
    expect(found).toContain('keep');
    expect(found).not.toContain('f');
    expect(found).not.toContain('Map');
    expect(found).not.toContain('structuredClone');
  });
});
