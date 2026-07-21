import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A small non-modal popover anchored to a trigger, rendered in a document-level portal with fixed
 * positioning so the virtualized feed and top bar can never clip it (the FilePiecesMenu approach,
 * spec 06 slice 4). Esc / click-out dismiss; Esc returns focus to the trigger. Mouse-first — the
 * content is arbitrary; keyboard is additive.
 */
export function AnchoredPopover({
  anchorEl,
  ariaLabel,
  className,
  onClose,
  children,
}: {
  anchorEl: HTMLElement;
  ariaLabel: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
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
  }, [anchorEl, children]);

  useEffect(() => {
    // Focus the popover so Esc reaches it and screen readers land inside; harmless for mouse users.
    ref.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    // The virtualized feed emits scroll events during async row re-measure, so closing on any
    // scroll makes the popover vanish as it opens. Follow the anchor instead; close only when
    // it actually leaves the viewport.
    const onScrollOrResize = () => {
      const a = anchorEl.getBoundingClientRect();
      if (a.bottom < 0 || a.top > window.innerHeight) {
        close(false);
        return;
      }
      const menu = ref.current;
      const width = menu?.offsetWidth ?? 280;
      const height = menu?.offsetHeight ?? 0;
      const left = Math.max(8, Math.min(a.left, window.innerWidth - width - 8));
      const below = a.bottom + 4;
      const top = height > 0 && below + height > window.innerHeight ? Math.max(8, a.top - height - 4) : below;
      setPos({ top, left });
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchorEl.contains(t)) close(false);
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

  return createPortal(
    <div
      className={className ? `anchored-popover ${className}` : 'anchored-popover'}
      role="dialog"
      aria-label={ariaLabel}
      tabIndex={-1}
      ref={ref}
      style={{ top: pos.top, left: pos.left }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close(true);
        }
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
