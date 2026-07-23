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

// Values read from the app.css design tokens so code surfaces stay in step with the theme.
const theme = EditorView.theme({
  '&': { fontSize: '12.5px', backgroundColor: 'transparent' },
  '.cm-content': { padding: '4px 0', fontFamily: 'var(--font-mono)' },
  '.cm-gutters': { backgroundColor: 'transparent', borderRight: '1px solid var(--line)', color: 'var(--ink-dim)' },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '3.5em', padding: '0 8px 0 4px' },
  '.cm-line-add': { backgroundColor: 'var(--diff-add-bg)' },
  '.cm-line-del': { backgroundColor: 'var(--diff-del-bg)' },
  '.cm-line-gap': { backgroundColor: 'var(--surface-2)', color: 'var(--ink-dim)', textAlign: 'center' },
});

type SelectionHandler = (docLines: { from: number; to: number } | undefined) => void;

function buildState(file: string, lines: UnifiedLine[], onSelectionChange?: SelectionHandler): EditorState {
  const doc = lines.map((l) => (l.type === 'gap' ? '⋯' : l.text)).join('\n');
  const state = EditorState.create({ doc });

  const builder = new RangeSetBuilder<Decoration>();
  lines.forEach((l, i) => {
    if (l.type === 'context') return;
    const from = state.doc.line(i + 1).from;
    builder.add(from, from, Decoration.line({ class: `cm-line-${l.type}` }));
  });

  const selectionListener = onSelectionChange
    ? [
        EditorView.updateListener.of((update) => {
          if (!update.selectionSet) return;
          const sel = update.state.selection.main;
          if (sel.empty) {
            onSelectionChange(undefined);
            return;
          }
          onSelectionChange({ from: update.state.doc.lineAt(sel.from).number, to: update.state.doc.lineAt(sel.to).number });
        }),
      ]
    : [];

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
      ...selectionListener,
      languageFor(file),
      theme,
    ],
  });
}

export const DiffView = memo(function DiffView({
  file,
  lines,
  onViewReady,
  onSelectionChange,
}: {
  file: string;
  lines: UnifiedLine[];
  /** Hands the live EditorView to the parent so the slice pill can position against the selection (spec 06 slice 6). */
  onViewReady?: (view: EditorView | null) => void;
  /** Fires on every selection change — the mapped doc-line range, or undefined when the selection empties. */
  onSelectionChange?: SelectionHandler;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({ state: buildState(file, lines, onSelectionChange), parent: host.current });
    onViewReady?.(view);
    return () => {
      onViewReady?.(null);
      view.destroy();
    };
  }, [file, lines, onViewReady, onSelectionChange]);

  if (lines.length === 0) {
    return <div className="diff-empty">content not available (binary or submodule)</div>;
  }
  return <div className="diff-view" ref={host} />;
});
