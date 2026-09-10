"use client";

import { useRef } from "react";

// Click-and-drag horizontal scrolling for mouse users — touch already gets
// native momentum scrolling, but a mouse has no equivalent, so PC visitors
// had no way to swipe these strips besides a trackpad/shift-wheel.
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const state = useRef({ startX: 0, startScrollLeft: 0, moved: false });

  const onMouseDown = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;
    state.current = { startX: e.clientX, startScrollLeft: el.scrollLeft, moved: false };

    // Listen on window, not just the element, so a fast drag that exits the
    // strip's bounds mid-gesture keeps scrolling instead of getting stuck.
    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - state.current.startX;
      if (Math.abs(delta) > 3) state.current.moved = true;
      el.scrollLeft = state.current.startScrollLeft - delta;
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Dragging shouldn't also fire the click it started on (e.g. selecting a
  // day/time slot mid-drag) — swallow the click only when the pointer
  // actually moved past the drag threshold.
  const onClickCapture = (e: React.MouseEvent) => {
    if (state.current.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return {
    ref,
    dragHandlers: { onMouseDown, onClickCapture },
  };
}
