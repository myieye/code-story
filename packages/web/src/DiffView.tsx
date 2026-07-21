import { javascript } from '@codemirror/lang-javascript';
import { StreamLanguage } from '@codemirror/language';
import { csharp } from '@codemirror/legacy-modes/mode/clike';
import { type Extension, EditorState, RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, lineNumbers } from '@codemirror/view';
import type { UnifiedLine } from '@code-story/core';
import { memo, useEffect, useRef } from 'react';

function languageFor(file: string): Extension {
  if (/\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|svelte)$/i.test(file)) {
    return javascript({ typescript: true, jsx: true });
  }
  if (/\.cs$/i.test(file)) return StreamLanguage.define(csharp);
  return [];
}

const theme = EditorView.theme({
  '&': { fontSize: '12.5px', backgroundColor: 'transparent' },
  '.cm-content': { padding: '4px 0', fontFamily: "'Cascadia Code', Consolas, monospace" },
  '.cm-gutters': { backgroundColor: 'transparent', borderRight: '1px solid #e5e2dc', color: '#a39e94' },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '3.5em', padding: '0 8px 0 4px' },
  '.cm-line-add': { backgroundColor: '#e6f4e6' },
  '.cm-line-del': { backgroundColor: '#fbe9e9' },
  '.cm-line-gap': { backgroundColor: '#f4f2ee', color: '#a39e94', textAlign: 'center' },
});

function buildState(file: string, lines: UnifiedLine[]): EditorState {
  const doc = lines.map((l) => (l.type === 'gap' ? '⋯' : l.text)).join('\n');
  const state = EditorState.create({ doc });

  const builder = new RangeSetBuilder<Decoration>();
  lines.forEach((l, i) => {
    if (l.type === 'context') return;
    const from = state.doc.line(i + 1).from;
    builder.add(from, from, Decoration.line({ class: `cm-line-${l.type}` }));
  });

  return EditorState.create({
    doc,
    extensions: [
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      lineNumbers({
        formatNumber: (n) => {
          const line = lines[n - 1];
          return line ? String(line.head ?? line.base ?? '') : '';
        },
      }),
      EditorView.decorations.of(builder.finish()),
      languageFor(file),
      theme,
    ],
  });
}

export const DiffView = memo(function DiffView({
  file,
  lines,
  onViewReady,
}: {
  file: string;
  lines: UnifiedLine[];
  /** Hands the live EditorView to the parent so a Defer popover can read the current selection (spec 06 slice 6). */
  onViewReady?: (view: EditorView | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({ state: buildState(file, lines), parent: host.current });
    onViewReady?.(view);
    return () => {
      onViewReady?.(null);
      view.destroy();
    };
  }, [file, lines, onViewReady]);

  if (lines.length === 0) {
    return <div className="diff-empty">content not available (binary or submodule)</div>;
  }
  return <div className="diff-view" ref={host} />;
});
