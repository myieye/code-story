import { describe, expect, it } from 'vitest';
import { parseGitDiff } from './diff.js';

const modified = `diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,2 +10,3 @@ export function main() {
-old line
-old line 2
+new line
+new line 2
+new line 3
@@ -20 +21,0 @@ helper
-removed single line
`;

const added = `diff --git a/newfile.ts b/newfile.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/newfile.ts
@@ -0,0 +1,2 @@
+a
+b
`;

const deleted = `diff --git a/gone.ts b/gone.ts
deleted file mode 100644
index 4444444..0000000
--- a/gone.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-a
-b
`;

const renamed = `diff --git a/old/name.ts b/new/name.ts
similarity index 95%
rename from old/name.ts
rename to new/name.ts
index 5555555..6666666 100644
--- a/old/name.ts
+++ b/new/name.ts
@@ -5 +5 @@
-x
+y
`;

const binary = `diff --git a/logo.png b/logo.png
index 7777777..8888888 100644
Binary files a/logo.png and b/logo.png differ
`;

describe('parseGitDiff', () => {
  it('parses hunk ranges including zero-count anchors', () => {
    const [f] = parseGitDiff(modified);
    expect(f).toMatchObject({ path: 'src/app.ts', status: 'modified', binary: false });
    expect(f!.hunks).toEqual([
      { baseStart: 10, baseCount: 2, headStart: 10, headCount: 3 },
      { baseStart: 20, baseCount: 1, headStart: 21, headCount: 0 },
    ]);
  });

  it('detects added and deleted files', () => {
    expect(parseGitDiff(added)[0]).toMatchObject({ path: 'newfile.ts', status: 'added' });
    expect(parseGitDiff(deleted)[0]).toMatchObject({ path: 'gone.ts', status: 'deleted' });
  });

  it('captures both sides of a rename', () => {
    expect(parseGitDiff(renamed)[0]).toMatchObject({
      path: 'new/name.ts',
      basePath: 'old/name.ts',
      status: 'renamed',
    });
  });

  it('flags binary files with no hunks', () => {
    expect(parseGitDiff(binary)[0]).toMatchObject({ path: 'logo.png', binary: true, hunks: [] });
  });

  it('flags submodule (gitlink) entries', () => {
    const submodule = `diff --git a/backend/harmony b/backend/harmony
index 1111111..2222222 160000
--- a/backend/harmony
+++ b/backend/harmony
@@ -1 +1 @@
-Subproject commit 1111111
+Subproject commit 2222222
`;
    expect(parseGitDiff(submodule)[0]).toMatchObject({ path: 'backend/harmony', submodule: true });
  });

  it('parses multi-file diffs', () => {
    expect(parseGitDiff(modified + added + binary)).toHaveLength(3);
  });
});
