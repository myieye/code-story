import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { reviewGlyph, reviewGlyphClass } from './OutlineSidebar.js';
import type { PieceMenuModel } from './piece-nav-logic.js';

/**
 * The file-pieces menu (spec 06 slice 2): every piece of one file, in file order, as a jump target.
 * Rendered in a document-level portal with fixed positioning so the virtualized feed can never clip
 * it. Roving-tabindex keyboard model mirrors NeighborStrip; mouse click is the primary path.
 */
export function FilePiecesMenu({
  model,
  anchorEl,
  onJump,
  onOpenFiles,
  onMarkAll,
  onClose,
}: {
  model: PieceMenuModel;
  anchorEl: HTMLElement;
  onJump: (chunkId: string) => void;
  onOpenFiles: () => void;
  onMarkAll: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const close = (returnFocus: boolean) => {
    if (returnFocus) anchorEl.focus();
    onClose();
  };

  useLayoutEffect(() => {
    const a = anchorEl.getBoundingClientRect();
    const menu = ref.current;
    const width = menu?.offsetWidth ?? 280;
    const height = menu?.offsetHeight ?? 0;
    const left = Math.max(8, Math.min(a.left, window.innerWidth - width - 8));
    const below = a.bottom + 4;
    const top = height > 0 && below + height > window.innerHeight ? Math.max(8, a.top - height - 4) : below;
    setPos({ top, left });
  }, [anchorEl, model]);

  useEffect(() => {
    // Focus the current piece on open (roving tabindex takes over from there).
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('button.piece-menu-item');
    const idx = model.items.findIndex((it) => it.current);
    buttons?.[idx >= 0 ? idx : 0]?.focus();
  }, [model]);

  useEffect(() => {
    // A fixed-position menu detaches from its anchor on scroll/resize, and any click outside it is a
    // dismissal — close (no focus return, the pointer moved elsewhere) in all three cases.
    const onScrollOrResize = () => close(false);
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && e.target !== anchorEl) close(false);
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  });

  const onKeyDown = (e: React.KeyboardEvent) => {
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button.piece-menu-focusable') ?? [])];
    const active = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') buttons[Math.min(active + 1, buttons.length - 1)]?.focus();
    else if (e.key === 'ArrowUp') buttons[Math.max(active - 1, 0)]?.focus();
    else if (e.key === 'Home') buttons[0]?.focus();
    else if (e.key === 'End') buttons[buttons.length - 1]?.focus();
    else if (e.key === 'Escape') close(true);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return createPortal(
    <div
      className="piece-menu"
      role="menu"
      aria-label={`Pieces of ${model.file}`}
      ref={ref}
      style={{ top: pos.top, left: pos.left }}
      onKeyDown={onKeyDown}
    >
      <div className="piece-menu-header">
        {basename(model.file)} — {model.total} piece{model.total === 1 ? '' : 's'}, {model.reviewed} reviewed
      </div>
      {model.items.map((item) => (
        <button
          key={item.chunkId}
          type="button"
          className="piece-menu-item piece-menu-focusable"
          role="menuitem"
          {...(item.current ? { 'aria-current': 'true' as const } : {})}
          onClick={() => onJump(item.chunkId)}
        >
          <span className={`state-dot ${reviewGlyphClass(item)}`} aria-hidden="true">
            {reviewGlyph(item)}
          </span>
          <span className="piece-menu-label">
            piece {item.n} · {item.title}
          </span>
          <span className="piece-menu-size">
            +{item.added} −{item.removed}
          </span>
        </button>
      ))}
      <div className="piece-menu-footer">
        <button type="button" className="piece-menu-focusable link-button" role="menuitem" onClick={onOpenFiles}>
          Open in Files view
        </button>
        <button type="button" className="piece-menu-focusable link-button" role="menuitem" onClick={onMarkAll}>
          Mark all {model.total} piece{model.total === 1 ? '' : 's'} reviewed
        </button>
      </div>
    </div>,
    document.body,
  );
}

function basename(file: string): string {
  return file.split('/').pop() ?? file;
}
