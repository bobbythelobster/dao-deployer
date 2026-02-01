import {
  createSignal,
  createEffect,
  createMemo,
  For,
  onMount,
  onCleanup,
  type Component,
  type JSX,
} from "solid-js";

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  overscan?: number;
  containerHeight: number | string;
  renderItem: (item: T, index: number) => JSX.Element;
  keyExtractor: (item: T, index: number) => string;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  class?: string;
  style?: JSX.CSSProperties;
}

interface VirtualItem<T> {
  item: T;
  index: number;
  key: string;
  style: JSX.CSSProperties;
}

export function VirtualList<T>(props: VirtualListProps<T>): JSX.Element {
  const overscan = () => props.overscan || 3;
  const onEndReachedThreshold = () => props.onEndReachedThreshold || 200;
  
  const [scrollTop, setScrollTop] = createSignal(0);
  const [containerRef, setContainerRef] = createSignal<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = createSignal(0);

  // Calculate total height
  const totalHeight = createMemo(() => props.items.length * props.itemHeight);

  // Calculate visible range
  const visibleRange = createMemo(() => {
    const start = Math.floor(scrollTop() / props.itemHeight);
    const visibleCount = Math.ceil(containerHeight() / props.itemHeight);
    
    const startIndex = Math.max(0, start - overscan());
    const endIndex = Math.min(
      props.items.length,
      start + visibleCount + overscan()
    );

    return { startIndex, endIndex };
  });

  // Generate virtual items
  const virtualItems = createMemo<VirtualItem<T>[]>(() => {
    const { startIndex, endIndex } = visibleRange();
    const items: VirtualItem<T>[] = [];

    for (let i = startIndex; i < endIndex; i++) {
      const item = props.items[i];
      if (!item) continue;

      items.push({
        item,
        index: i,
        key: props.keyExtractor(item, i),
        style: {
          position: "absolute",
          top: `${i * props.itemHeight}px`,
          left: 0,
          right: 0,
          height: `${props.itemHeight}px`,
        },
      });
    }

    return items;
  });

  // Handle scroll
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    const newScrollTop = target.scrollTop;
    setScrollTop(newScrollTop);

    // Check if end reached
    if (props.onEndReached) {
      const scrollHeight = target.scrollHeight;
      const clientHeight = target.clientHeight;
      const distanceFromEnd = scrollHeight - newScrollTop - clientHeight;

      if (distanceFromEnd < onEndReachedThreshold()) {
        props.onEndReached();
      }
    }
  };

  // Update container height on mount and resize
  onMount(() => {
    const container = containerRef();
    if (!container) return;

    const updateHeight = () => {
      const height = typeof props.containerHeight === "number" 
        ? props.containerHeight 
        : container.clientHeight;
      setContainerHeight(height);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(container);

    onCleanup(() => {
      resizeObserver.disconnect();
    });
  });

  // Handle dynamic container height
  createEffect(() => {
    if (typeof props.containerHeight === "number") {
      setContainerHeight(props.containerHeight);
    }
  });

  return (
    <div
      ref={setContainerRef}
      class={`overflow-auto ${props.class || ""}`}
      style={{
        height: typeof props.containerHeight === "string" 
          ? props.containerHeight 
          : `${props.containerHeight}px`,
        ...props.style,
      }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: `${totalHeight()}px`,
          position: "relative",
        }}
      >
        <For each={virtualItems()}>
          {(virtualItem) => (
            <div style={virtualItem.style} data-index={virtualItem.index}>
              {props.renderItem(virtualItem.item, virtualItem.index)}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

// Variable height virtual list for items with different heights
interface VariableVirtualListProps<T> {
  items: T[];
  estimateItemHeight: (item: T, index: number) => number;
  overscan?: number;
  containerHeight: number | string;
  renderItem: (item: T, index: number, ref: (el: HTMLElement) => void) => JSX.Element;
  keyExtractor: (item: T, index: number) => string;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  class?: string;
  style?: JSX.CSSProperties;
}

export function VariableVirtualList<T>(props: VariableVirtualListProps<T>): JSX.Element {
  const overscan = () => props.overscan || 3;
  const onEndReachedThreshold = () => props.onEndReachedThreshold || 200;

  const [scrollTop, setScrollTop] = createSignal(0);
  const [containerRef, setContainerRef] = createSignal<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = createSignal(0);
  const [measuredHeights, setMeasuredHeights] = createSignal<Map<number, number>>(new Map());

  // Calculate item positions
  const itemPositions = createMemo(() => {
    const positions: { top: number; height: number }[] = [];
    let currentTop = 0;

    props.items.forEach((item, index) => {
      const measured = measuredHeights().get(index);
      const height = measured || props.estimateItemHeight(item, index);
      
      positions.push({
        top: currentTop,
        height,
      });
      
      currentTop += height;
    });

    return positions;
  });

  // Total height
  const totalHeight = createMemo(() => {
    const positions = itemPositions();
    if (positions.length === 0) return 0;
    const last = positions[positions.length - 1];
    return last.top + last.height;
  });

  // Visible range
  const visibleRange = createMemo(() => {
    const positions = itemPositions();
    const st = scrollTop();
    const ch = containerHeight();

    let startIndex = 0;
    let endIndex = 0;

    // Binary search for start index
    let low = 0;
    let high = positions.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (positions[mid].top < st) {
        startIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // Find end index
    endIndex = startIndex;
    while (endIndex < positions.length && positions[endIndex].top < st + ch) {
      endIndex++;
    }

    // Apply overscan
    startIndex = Math.max(0, startIndex - overscan());
    endIndex = Math.min(positions.length, endIndex + overscan());

    return { startIndex, endIndex };
  });

  // Virtual items
  const virtualItems = createMemo(() => {
    const { startIndex, endIndex } = visibleRange();
    const positions = itemPositions();
    const items: { item: T; index: number; key: string; style: JSX.CSSProperties }[] = [];

    for (let i = startIndex; i < endIndex; i++) {
      const item = props.items[i];
      if (!item) continue;

      const pos = positions[i];
      
      items.push({
        item,
        index: i,
        key: props.keyExtractor(item, i),
        style: {
          position: "absolute",
          top: `${pos.top}px`,
          left: 0,
          right: 0,
        },
      });
    }

    return items;
  });

  // Measure item height
  const measureItem = (index: number, element: HTMLElement) => {
    if (!element) return;
    
    const height = element.getBoundingClientRect().height;
    const current = measuredHeights().get(index);
    
    if (current !== height) {
      setMeasuredHeights((prev) => {
        const next = new Map(prev);
        next.set(index, height);
        return next;
      });
    }
  };

  // Handle scroll
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    const newScrollTop = target.scrollTop;
    setScrollTop(newScrollTop);

    if (props.onEndReached) {
      const scrollHeight = target.scrollHeight;
      const clientHeight = target.clientHeight;
      const distanceFromEnd = scrollHeight - newScrollTop - clientHeight;

      if (distanceFromEnd < onEndReachedThreshold()) {
        props.onEndReached();
      }
    }
  };

  onMount(() => {
    const container = containerRef();
    if (!container) return;

    const updateHeight = () => {
      const height = typeof props.containerHeight === "number"
        ? props.containerHeight
        : container.clientHeight;
      setContainerHeight(height);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(container);

    onCleanup(() => {
      resizeObserver.disconnect();
    });
  });

  createEffect(() => {
    if (typeof props.containerHeight === "number") {
      setContainerHeight(props.containerHeight);
    }
  });

  return (
    <div
      ref={setContainerRef}
      class={`overflow-auto ${props.class || ""}`}
      style={{
        height: typeof props.containerHeight === "string"
          ? props.containerHeight
          : `${props.containerHeight}px`,
        ...props.style,
      }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: `${totalHeight()}px`,
          position: "relative",
        }}
      >
        <For each={virtualItems()}>
          {(virtualItem) => (
            <div
              style={virtualItem.style}
              data-index={virtualItem.index}
              ref={(el) => measureItem(virtualItem.index, el)}
            >
              {props.renderItem(
                virtualItem.item,
                virtualItem.index,
                (el) => measureItem(virtualItem.index, el)
              )}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

// Window scroller for virtual lists that scroll with the page
interface WindowScrollerProps<T> {
  items: T[];
  itemHeight: number;
  overscan?: number;
  renderItem: (item: T, index: number) => JSX.Element;
  keyExtractor: (item: T, index: number) => string;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  class?: string;
  style?: JSX.CSSProperties;
}

export function WindowVirtualList<T>(props: WindowScrollerProps<T>): JSX.Element {
  const overscan = () => props.overscan || 3;
  const onEndReachedThreshold = () => props.onEndReachedThreshold || 200;

  const [listRef, setListRef] = createSignal<HTMLDivElement | null>(null);
  const [listTop, setListTop] = createSignal(0);
  const [windowHeight, setWindowHeight] = createSignal(window.innerHeight);

  const scrollTop = createMemo(() => window.scrollY);

  // Calculate visible range based on window scroll
  const visibleRange = createMemo(() => {
    const relativeScroll = scrollTop() - listTop();
    const start = Math.floor(relativeScroll / props.itemHeight);
    const visibleCount = Math.ceil(windowHeight() / props.itemHeight);

    const startIndex = Math.max(0, start - overscan());
    const endIndex = Math.min(
      props.items.length,
      start + visibleCount + overscan()
    );

    return { startIndex, endIndex };
  });

  // Total height
  const totalHeight = createMemo(() => props.items.length * props.itemHeight);

  // Virtual items
  const virtualItems = createMemo(() => {
    const { startIndex, endIndex } = visibleRange();
    const items: { item: T; index: number; key: string; style: JSX.CSSProperties }[] = [];

    for (let i = startIndex; i < endIndex; i++) {
      const item = props.items[i];
      if (!item) continue;

      items.push({
        item,
        index: i,
        key: props.keyExtractor(item, i),
        style: {
          position: "absolute",
          top: `${i * props.itemHeight}px`,
          left: 0,
          right: 0,
          height: `${props.itemHeight}px`,
        },
      });
    }

    return items;
  });

  // Handle window scroll
  const handleScroll = () => {
    const list = listRef();
    if (!list) return;

    const rect = list.getBoundingClientRect();
    setListTop(window.scrollY + rect.top);

    // Check end reached
    if (props.onEndReached) {
      const scrollBottom = window.scrollY + windowHeight();
      const listBottom = listTop() + totalHeight();
      const distanceFromEnd = listBottom - scrollBottom;

      if (distanceFromEnd < onEndReachedThreshold()) {
        props.onEndReached();
      }
    }
  };

  // Handle window resize
  const handleResize = () => {
    setWindowHeight(window.innerHeight);
    handleScroll();
  };

  onMount(() => {
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    onCleanup(() => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    });
  });

  return (
    <div
      ref={setListRef}
      class={props.class}
      style={{
        position: "relative",
        height: `${totalHeight()}px`,
        ...props.style,
      }}
    >
      <For each={virtualItems()}>
        {(virtualItem) => (
          <div style={virtualItem.style} data-index={virtualItem.index}>
            {props.renderItem(virtualItem.item, virtualItem.index)}
          </div>
        )}
      </For>
    </div>
  );
}

export default VirtualList;
