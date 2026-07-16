import { describe, expect, it } from 'vitest';
import { extractSymbols } from './treesitter.js';

const csharp = `namespace LexBox;

public class UserService
{
    private int _count;

    public string Name { get; set; }

    public void Merge(User other)
    {
        _count++;
    }
}
`;

const typescript = `export class Store {
  load(): void {}
}

export function helper(a: string) {
  return a;
}

export const arrowHelper = (b: number) => b * 2;
`;

const svelte = `<script lang="ts">
  let count = 0;
  function increment() {
    count += 1;
  }
</script>

<button onclick={increment}>
  {count}
</button>

<style>
  button { color: red; }
</style>
`;

function flatten(spans: Awaited<ReturnType<typeof extractSymbols>>): string[] {
  if (!spans) return [];
  return spans.flatMap((s) => [`${s.kind}:${s.name}`, ...flatten(s.children)]);
}

describe('extractSymbols', () => {
  it('extracts C# namespace/class/members with nesting', async () => {
    const symbols = await extractSymbols('a.cs', csharp);
    const flat = flatten(symbols);
    expect(flat).toContain('type:LexBox');
    expect(flat).toContain('type:UserService');
    expect(flat).toContain('function:Merge');
    expect(flat).toContain('function:Name');
  });

  it('extracts TS classes, functions, and arrow consts', async () => {
    const flat = flatten(await extractSymbols('a.ts', typescript));
    expect(flat).toEqual(
      expect.arrayContaining(['type:Store', 'function:load', 'function:helper', 'function:arrowHelper']),
    );
  });

  it('splits Svelte into script (TS-parsed), template, and style regions', async () => {
    const symbols = (await extractSymbols('a.svelte', svelte))!;
    const flat = flatten(symbols);
    expect(flat).toContain('type:script');
    expect(flat).toContain('function:increment');
    expect(flat).toContain('markup:template');
    expect(flat).toContain('markup:style');
    // regions must not overlap and must cover the script/template boundary correctly
    const script = symbols.find((s) => s.name === 'script')!;
    const template = symbols.find((s) => s.name === 'template')!;
    expect(script.startLine).toBe(1);
    expect(template.startLine).toBeGreaterThan(script.endLine);
  });

  it('returns undefined for unsupported languages', async () => {
    expect(await extractSymbols('a.py', 'def f():\n  pass\n')).toBeUndefined();
  });
});
