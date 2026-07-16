import { describe, expect, it } from 'vitest';
import { extractImports } from './imports.js';

describe('extractImports', () => {
  it('extracts TS import/export from-specifiers and side-effect imports', () => {
    const source = `import { a } from './a';
import type { B } from '../b';
import 'side-effect.css';
export { c } from './c';
import {
  x,
  y,
} from './multiline';`;
    expect(extractImports('src/x.ts', source)?.specifiers).toEqual([
      './a',
      '../b',
      './c',
      './multiline',
      'side-effect.css',
    ]);
  });

  it('extracts specifiers only from the Svelte script block', () => {
    const source = `<script lang="ts">
  import { util } from './utils';
  import Comp from '$lib/Comp.svelte';
</script>

<div>from should not match here: {@html 'from "x"'}</div>

<style>.a { color: red; }</style>`;
    expect(extractImports('a.svelte', source)?.specifiers).toEqual(['./utils', '$lib/Comp.svelte']);
  });

  it('extracts C# usings and declared namespace (file-scoped)', () => {
    const source = `using LcmCrdt;
using static System.Math;
global using Xunit;
using Alias = System.Text.Json;

namespace App.Tests;

public class Foo {}`;
    expect(extractImports('Foo.cs', source)).toEqual({
      specifiers: ['LcmCrdt', 'System.Math', 'Xunit'],
      declaredNamespaces: ['App.Tests'],
    });
  });

  it('extracts a block-scoped C# namespace and ignores using-statements', () => {
    const source = `using System;

namespace App {
  public class Bar {
    void M() {
      using (var x = Open()) { }
    }
  }
}`;
    expect(extractImports('Bar.cs', source)).toEqual({ specifiers: ['System'], declaredNamespaces: ['App'] });
  });

  it('returns undefined for unsupported file types', () => {
    expect(extractImports('a.py', 'import os')).toBeUndefined();
  });
});
