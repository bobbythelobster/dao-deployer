import { createContext, useContext, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import type { Component, JSX } from "solid-js";

// Performance monitoring types
interface PerformanceMetrics {
  fcp: number | null; // First Contentful Paint
  lcp: number | null; // Largest Contentful Paint
  fid: number | null; // First Input Delay
  cls: number | null; // Cumulative Layout Shift
  ttfb: number | null; // Time to First Byte
  tti: number | null; // Time to Interactive
  navigationTiming: PerformanceNavigationTiming | null;
  resourceLoads: PerformanceResourceTiming[];
}

interface PerformanceContextValue {
  metrics: () => PerformanceMetrics;
  trackRender: (componentName: string, duration: number) => void;
  trackInteraction: (interactionName: string, duration: number) => void;
  trackCustomMetric: (name: string, value: number) => void;
  getReport: () => PerformanceReport;
}

interface PerformanceReport {
  metrics: PerformanceMetrics;
  slowRenders: Array<{ component: string; duration: number; timestamp: number }>;
  slowInteractions: Array<{ interaction: string; duration: number; timestamp: number }>;
  customMetrics: Record<string, number[]>;
  timestamp: number;
}

const PerformanceContext = createContext<PerformanceContextValue>();

// Web Vitals observers
const createWebVitalsObserver = (setMetrics: (metrics: Partial<PerformanceMetrics>) => void) => {
  // Largest Contentful Paint
  if ("PerformanceObserver" in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        setMetrics({ lcp: lastEntry.startTime });
      });
      lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === "first-input") {
            const fidEntry = entry as PerformanceEventTiming;
            setMetrics({ fid: fidEntry.processingStart - fidEntry.startTime });
          }
        });
      });
      fidObserver.observe({ entryTypes: ["first-input"] });

      // Cumulative Layout Shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        });
        setMetrics({ cls: clsValue });
      });
      clsObserver.observe({ entryTypes: ["layout-shift"] });

      // First Contentful Paint
      const paintObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === "first-contentful-paint") {
            setMetrics({ fcp: entry.startTime });
          }
        });
      });
      paintObserver.observe({ entryTypes: ["paint"] });

      // Navigation Timing
      const navObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === "navigation") {
            setMetrics({ navigationTiming: entry as PerformanceNavigationTiming });
            setMetrics({ ttfb: (entry as PerformanceNavigationTiming).responseStart });
          }
        });
      });
      navObserver.observe({ entryTypes: ["navigation"] });

      // Resource Timing
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceResourceTiming[];
        setMetrics({ resourceLoads: entries });
      });
      resourceObserver.observe({ entryTypes: ["resource"] });

      return () => {
        lcpObserver.disconnect();
        fidObserver.disconnect();
        clsObserver.disconnect();
        paintObserver.disconnect();
        navObserver.disconnect();
        resourceObserver.disconnect();
      };
    } catch (e) {
      console.warn("PerformanceObserver not supported", e);
    }
  }

  return () => {};
};

// Performance Provider Component
export const PerformanceProvider: Component<{ children: JSX.Element }> = (props) => {
  const [metrics, setMetrics] = createSignal<PerformanceMetrics>({
    fcp: null,
    lcp: null,
    fid: null,
    cls: null,
    ttfb: null,
    tti: null,
    navigationTiming: null,
    resourceLoads: [],
  });

  const [slowRenders, setSlowRenders] = createSignal<Array<{ component: string; duration: number; timestamp: number }>>([]);
  const [slowInteractions, setSlowInteractions] = createSignal<Array<{ interaction: string; duration: number; timestamp: number }>>([]);
  const [customMetrics, setCustomMetrics] = createSignal<Record<string, number[]>>({});

  onMount(() => {
    const cleanup = createWebVitalsObserver((newMetrics) => {
      setMetrics((prev) => ({ ...prev, ...newMetrics }));
    });

    // Calculate TTI (Time to Interactive)
    if ("performance" in window) {
      const checkTTI = () => {
        const timing = performance.timing;
        if (timing.domInteractive > 0) {
          const tti = timing.domInteractive - timing.navigationStart;
          setMetrics((prev) => ({ ...prev, tti }));
        }
      };
      
      if (document.readyState === "complete") {
        checkTTI();
      } else {
        window.addEventListener("load", checkTTI);
      }
    }

    onCleanup(() => {
      cleanup();
    });
  });

  const trackRender = (componentName: string, duration: number) => {
    if (duration > 16) { // More than 1 frame (60fps)
      setSlowRenders((prev) => [
        ...prev.slice(-50), // Keep last 50
        { component: componentName, duration, timestamp: Date.now() },
      ]);
    }
  };

  const trackInteraction = (interactionName: string, duration: number) => {
    if (duration > 100) { // More than 100ms
      setSlowInteractions((prev) => [
        ...prev.slice(-50),
        { interaction: interactionName, duration, timestamp: Date.now() },
      ]);
    }
  };

  const trackCustomMetric = (name: string, value: number) => {
    setCustomMetrics((prev) => ({
      ...prev,
      [name]: [...(prev[name] || []), value].slice(-100),
    }));
  };

  const getReport = (): PerformanceReport => ({
    metrics: metrics(),
    slowRenders: slowRenders(),
    slowInteractions: slowInteractions(),
    customMetrics: customMetrics(),
    timestamp: Date.now(),
  });

  const value: PerformanceContextValue = {
    metrics,
    trackRender,
    trackInteraction,
    trackCustomMetric,
    getReport,
  };

  return (
    <PerformanceContext.Provider value={value}>
      {props.children}
    </PerformanceContext.Provider>
  );
};

// Hook to use performance context
export const usePerformance = () => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error("usePerformance must be used within a PerformanceProvider");
  }
  return context;
};

// Component performance tracker
export const withPerformanceTracking = <P extends object>(
  Component: Component<P>,
  componentName: string
): Component<P> => {
  return (props: P) => {
    const performance = usePerformance();
    const startTime = performance.now();

    createEffect(() => {
      const duration = performance.now() - startTime;
      performance.trackRender(componentName, duration);
    });

    return <Component {...props} />;
  };
};

// Interaction tracker hook
export const useInteractionTracker = () => {
  const performance = usePerformance();

  const trackAsync = async <T,>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> => {
    const start = performance.now();
    try {
      const result = await fn();
      return result;
    } finally {
      const duration = performance.now() - start;
      performance.trackInteraction(name, duration);
    }
  };

  const trackSync = <T,>(name: string, fn: () => T): T => {
    const start = performance.now();
    try {
      const result = fn();
      return result;
    } finally {
      const duration = performance.now() - start;
      performance.trackInteraction(name, duration);
    }
  };

  return { trackAsync, trackSync };
};

// Lazy image loading with intersection observer
export const useLazyImage = (src: string, placeholder?: string) => {
  const [imageSrc, setImageSrc] = createSignal(placeholder || "");
  const [isLoaded, setIsLoaded] = createSignal(false);
  let imageRef: HTMLImageElement | undefined;

  onMount(() => {
    if (!imageRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = new Image();
            img.src = src;
            img.onload = () => {
              setImageSrc(src);
              setIsLoaded(true);
            };
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "50px",
        threshold: 0.01,
      }
    );

    observer.observe(imageRef);

    onCleanup(() => {
      observer.disconnect();
    });
  });

  return { src: imageSrc, isLoaded, ref: (el: HTMLImageElement) => { imageRef = el; } };
};

// Performance budget checker
export const checkPerformanceBudget = () => {
  if ("performance" in window) {
    const resources = performance.getEntriesByType("resource");
    const totalSize = resources.reduce((acc, r) => acc + (r as PerformanceResourceTiming).transferSize, 0);
    
    const budgets = {
      js: 500 * 1024, // 500KB
      css: 100 * 1024, // 100KB
      images: 1000 * 1024, // 1MB
      total: 2000 * 1024, // 2MB
    };

    const jsSize = resources
      .filter((r) => r.name.endsWith(".js"))
      .reduce((acc, r) => acc + (r as PerformanceResourceTiming).transferSize, 0);
    
    const cssSize = resources
      .filter((r) => r.name.endsWith(".css"))
      .reduce((acc, r) => acc + (r as PerformanceResourceTiming).transferSize, 0);
    
    const imgSize = resources
      .filter((r) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(r.name))
      .reduce((acc, r) => acc + (r as PerformanceResourceTiming).transferSize, 0);

    return {
      js: { size: jsSize, budget: budgets.js, exceeded: jsSize > budgets.js },
      css: { size: cssSize, budget: budgets.css, exceeded: cssSize > budgets.css },
      images: { size: imgSize, budget: budgets.images, exceeded: imgSize > budgets.images },
      total: { size: totalSize, budget: budgets.total, exceeded: totalSize > budgets.total },
    };
  }
  return null;
};

// Export Web Vitals reporting function
export const reportWebVitals = (callback: (metric: any) => void) => {
  if ("PerformanceObserver" in window) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        callback({
          name: entry.name,
          value: (entry as any).value || entry.startTime,
          id: entry.entryType,
        });
      });
    });
    observer.observe({ entryTypes: ["web-vitals"] });
  }
};
