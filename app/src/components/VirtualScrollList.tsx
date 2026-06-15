// Copyright (c) 2026 zouyc zouyccq@gmail.com.
// All rights reserved.
//
// Licensed under the Business Source License 1.1 (BSL 1.1).
// You may not use this file except in compliance with the License.
//
// Change Date: 2031-01-01
// On the Change Date, or the fourth anniversary of the first publicly available
// distribution of the code under the BSL, whichever comes first, the code
// automatically becomes available under the Apache License 2.0.

"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";

export type VirtualScrollListHandle = {
  scrollToIndex: (index: number, align?: "start" | "center") => void;
  scrollToKey: (key: string) => void;
};

type Props<T> = {
  items: T[];
  itemKey: (item: T) => string;
  itemHeight: number;
  height?: number;
  overscan?: number;
  onNearEnd?: () => void;
  nearEndThreshold?: number;
  renderItem: (item: T, index: number, meta: { active: boolean }) => ReactNode;
  empty?: ReactNode;
  className?: string;
  role?: string;
  "aria-label"?: string;
  /** Scroll selected row into view when key changes. */
  scrollToKey?: string | null;
  /** Enable ↑↓ Home End Enter keyboard navigation. */
  keyboardNav?: boolean;
  selectedKey?: string | null;
  onSelectKey?: (key: string) => void;
};

function VirtualScrollListInner<T>(
  {
    items,
    itemKey,
    itemHeight,
    height = 360,
    overscan = 4,
    onNearEnd,
    nearEndThreshold = 160,
    renderItem,
    empty,
    className,
    role = "listbox",
    "aria-label": ariaLabel,
    scrollToKey,
    keyboardNav = false,
    selectedKey,
    onSelectKey,
  }: Props<T>,
  ref: Ref<VirtualScrollListHandle>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [focusIndex, setFocusIndex] = useState(0);
  const nearEndRef = useRef(onNearEnd);
  nearEndRef.current = onNearEnd;

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(height / itemHeight) + overscan * 2;
  const endIndex = Math.min(items.length, startIndex + visibleCount);

  const scrollToIndex = useCallback(
    (index: number, align: "start" | "center" = "start") => {
      const el = containerRef.current;
      if (!el || index < 0 || index >= items.length) return;
      const rowTop = index * itemHeight;
      const rowBottom = rowTop + itemHeight;
      const viewTop = el.scrollTop;
      const viewBottom = viewTop + height;
      if (rowTop >= viewTop && rowBottom <= viewBottom) return;

      if (align === "center") {
        el.scrollTop = Math.max(0, rowTop - (height - itemHeight) / 2);
      } else {
        el.scrollTop = Math.max(0, rowTop);
      }
      setScrollTop(el.scrollTop);
    },
    [itemHeight, height, items.length],
  );

  const scrollToKeyFn = useCallback(
    (key: string) => {
      const index = items.findIndex((item) => itemKey(item) === key);
      if (index >= 0) scrollToIndex(index, "center");
    },
    [items, itemKey, scrollToIndex],
  );

  useImperativeHandle(ref, () => ({
    scrollToIndex,
    scrollToKey: scrollToKeyFn,
  }));

  useEffect(() => {
    if (!scrollToKey) return;
    scrollToKeyFn(scrollToKey);
  }, [scrollToKey, scrollToKeyFn]);

  useEffect(() => {
    if (!selectedKey) return;
    const index = items.findIndex((item) => itemKey(item) === selectedKey);
    if (index >= 0) setFocusIndex(index);
  }, [selectedKey, items, itemKey]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    const nearBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - nearEndThreshold;
    if (nearBottom) nearEndRef.current?.();
  }, [nearEndThreshold]);

  useEffect(() => {
    handleScroll();
  }, [items.length, handleScroll]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!keyboardNav || items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(items.length - 1, focusIndex + 1);
      setFocusIndex(next);
      scrollToIndex(next);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(0, focusIndex - 1);
      setFocusIndex(next);
      scrollToIndex(next);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setFocusIndex(0);
      scrollToIndex(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      const last = items.length - 1;
      setFocusIndex(last);
      scrollToIndex(last);
      return;
    }
    if (e.key === "Enter" && onSelectKey) {
      e.preventDefault();
      const item = items[focusIndex];
      if (item) onSelectKey(itemKey(item));
    }
  };

  if (items.length === 0) {
    return (
      <div
        className={className}
        style={{ height, overflow: "auto" }}
        role={role}
        aria-label={ariaLabel}
      >
        {empty}
      </div>
    );
  }

  const innerStyle: CSSProperties = {
    height: totalHeight,
    position: "relative",
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, overflow: "auto" }}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      role={role}
      aria-label={ariaLabel}
      tabIndex={keyboardNav ? 0 : undefined}
    >
      <div style={innerStyle}>
        {items.slice(startIndex, endIndex).map((item, localIndex) => {
          const index = startIndex + localIndex;
          const key = itemKey(item);
          const rowStyle: CSSProperties = {
            position: "absolute",
            top: index * itemHeight,
            left: 0,
            right: 0,
            height: itemHeight,
            boxSizing: "border-box",
          };
          const active = selectedKey === key;
          const focused = keyboardNav && focusIndex === index;
          return (
            <div
              key={key}
              style={rowStyle}
              role="presentation"
              data-virtual-index={index}
            >
              <div
                className={focused ? "virtual-scroll-row-focus" : undefined}
                style={{ height: "100%" }}
              >
                {renderItem(item, index, { active: active || focused })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const VirtualScrollList = forwardRef(VirtualScrollListInner) as <T>(
  props: Props<T> & { ref?: Ref<VirtualScrollListHandle> },
) => ReturnType<typeof VirtualScrollListInner>;
