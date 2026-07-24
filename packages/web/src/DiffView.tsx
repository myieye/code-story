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

// With `editable: false` a mouse drag is a NATIVE browser selection — CM6's state selection never
// changes, so an updateListener on `selectionSet` never fires. Watch document selectionchange and
// map the native range back through posAtDOM instead.
function watchNativeSelection(view: EditorView, onSelectionChange: SelectionHandler): () => void {
  const handler = () => {
    const sel = document.getSelection();
    if (
      !sel ||
      sel.rangeCount === 0 ||
      sel.isCollapsed ||
      !sel.anchorNode ||
      !sel.focusNode ||
      !view.dom.contains(sel.anchorNode) ||
      !view.dom.contains(sel.focusNode)
    ) {
      onSelectionChange(undefined);
      return;
    }
    const a = view.posAtDOM(sel.anchorNode, sel.anchorOffset);
    const f = view.posAtDOM(sel.focusNode, sel.focusOffset);
    const from = Math.min(a, f);
    const to = Math.max(a, f);
    if (from === to) {
      onSelectionChange(undefined);
      return;
    }
    onSelectionChange({ from: view.state.doc.lineAt(from).number, to: view.state.doc.lineAt(to).number });
  };
  document.addEventListener('selectionchange', handler);
  return () => document.removeEventListener('selectionchange', handler);
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
    const view = new EditorView({ state: buildState(file, lines), parent: host.current });
    onViewReady?.(view);
    const unwatch = onSelectionChange ? watchNativeSelection(view, onSelectionChange) : undefined;
    return () => {
      unwatch?.();
      onViewReady?.(null);
      view.destroy();
    };
  }, [file, lines, onViewReady, onSelectionChange]);

  if (lines.length === 0) {
    return <div className="diff-empty">content not available (binary or submodule)</div>;
  }
  return <div className="diff-view" ref={host} />;
});
