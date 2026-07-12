import { useCallback, useLayoutEffect, useRef, useState } from "react";

const MIN_THUMB_HEIGHT = 24;
// Sub-pixel rounding (e.g. a padding box that doesn't divide evenly at
// certain zoom levels) can leave scrollHeight a hair taller than
// clientHeight even with nothing to actually scroll — this tolerance
// absorbs that instead of showing a phantom thumb/fade.
const OVERFLOW_TOLERANCE = 3;

/**
 * Drives a custom-drawn scrollbar thumb (position/height, drag-to-scroll,
 * hover-to-reveal) for any internally-scrolling container — the native
 * scrollbar stays hidden (pair with the `scroll-hidden` CSS class) and this
 * renders a thin floating thumb instead, tracking `scrollRef`'s element.
 *
 * `contentRef` is optional: pass the unconstrained inner content wrapper
 * when the scroll container's own box is height-locked by its layout (e.g.
 * a flex-1 pane), so a ResizeObserver on it catches content growth/shrink
 * that wouldn't otherwise resize the scroll container itself. Omit it (and
 * call the returned `update` function manually, e.g. from an onChange
 * handler) for elements like a `<textarea>` whose own box is capped by a
 * max-height and won't resize once content overflows internally.
 */
export function useScrollThumb(scrollRef, contentRef) {
  const [thumb, setThumb] = useState({ top: 0, height: 0 });
  const [active, setActive] = useState(false);
  const [scrolledFromTop, setScrolledFromTop] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(true);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const hasOverflow = scrollHeight > clientHeight + OVERFLOW_TOLERANCE;
    setScrolledFromTop(hasOverflow && scrollTop > 0);
    setScrolledToBottom(!hasOverflow || scrollTop + clientHeight >= scrollHeight - OVERFLOW_TOLERANCE);
    if (!hasOverflow) {
      setThumb({ top: 0, height: 0 });
      return;
    }
    const height = Math.max((clientHeight / scrollHeight) * clientHeight, MIN_THUMB_HEIGHT);
    const maxTop = clientHeight - height;
    const top = (scrollTop / (scrollHeight - clientHeight)) * maxTop;
    setThumb({ top, height });
  }, [scrollRef]);

  useLayoutEffect(() => {
    update();
    const content = contentRef?.current;
    if (!content) return;
    const ro = new ResizeObserver(update);
    ro.observe(content);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update]);

  const handlePointerDown = useCallback((e) => {
    const el = scrollRef.current;
    if (!el) return;
    e.preventDefault();

    const startY = e.clientY;
    const startScrollTop = el.scrollTop;
    const { scrollHeight, clientHeight } = el;
    const maxScrollTop = scrollHeight - clientHeight;
    const thumbHeight = Math.max((clientHeight / scrollHeight) * clientHeight, MIN_THUMB_HEIGHT);
    const maxThumbTop = clientHeight - thumbHeight;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    const handleMove = (moveEvent) => {
      if (maxThumbTop <= 0) return;
      const deltaY = moveEvent.clientY - startY;
      const scrollDelta = (deltaY / maxThumbTop) * maxScrollTop;
      el.scrollTop = Math.min(Math.max(startScrollTop + scrollDelta, 0), maxScrollTop);
    };
    const handleUp = () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [scrollRef]);

  return { thumb, active, setActive, scrolledFromTop, scrolledToBottom, update, handlePointerDown };
}
