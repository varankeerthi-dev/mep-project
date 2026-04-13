import { useEffect, useRef } from 'react';

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

const PERFORMANCE_LOG_KEY = 'mep_perf_metrics';

export function usePerformanceMonitor(label: string) {
  const startTimeRef = useRef<number>(0);
  const metricNameRef = useRef<string>('');

  useEffect(() => {
    const metricName = `${label}-${Date.now()}`;
    metricNameRef.current = metricName;
    
    if (performance.mark) {
      startTimeRef.current = performance.now();
      performance.mark(`${metricName}-start`);
    }

    return () => {
      if (performance.mark && performance.measure) {
        const endTime = performance.now();
        const duration = endTime - startTimeRef.current;
        
        performance.mark(`${metricName}-end`);
        performance.measure(metricName, `${metricName}-start`, `${metricName}-end`);
        
        const measure = performance.getEntriesByName(metricName)[0] as PerformanceMeasure;
        if (measure && measure.duration > 0) {
          const metric: PerformanceMetric = {
            name: label,
            duration: measure.duration,
            timestamp: Date.now(),
          };
          
          logPerformanceMetric(metric);
          
          if (import.meta.env.DEV) {
            console.log(`[Performance] ${label}: ${measure.duration.toFixed(2)}ms`);
          }
        }
      }
    };
  }, [label]);

  const measurePoint = (pointName: string) => {
    if (performance.mark) {
      performance.mark(`${metricNameRef.current}-${pointName}`);
    }
  };

  return { measurePoint };
}

function logPerformanceMetric(metric: PerformanceMetric) {
  try {
    const existing = localStorage.getItem(PERFORMANCE_LOG_KEY);
    const metrics: PerformanceMetric[] = existing ? JSON.parse(existing) : [];
    metrics.push(metric);
    
    const recentMetrics = metrics.slice(-100);
    localStorage.setItem(PERFORMANCE_LOG_KEY, JSON.stringify(recentMetrics));
  } catch {
    // Ignore localStorage errors
  }
}

export function clearPerformanceMetrics() {
  try {
    localStorage.removeItem(PERFORMANCE_LOG_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

export function getPerformanceMetrics(): PerformanceMetric[] {
  try {
    const existing = localStorage.getItem(PERFORMANCE_LOG_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch {
    return [];
  }
}

export function getAverageDuration(metricName: string): number {
  const metrics = getPerformanceMetrics();
  const filtered = metrics.filter(m => m.name === metricName);
  
  if (filtered.length === 0) return 0;
  
  const sum = filtered.reduce((acc, m) => acc + m.duration, 0);
  return sum / filtered.length;
}

export function getSlowQueries(thresholdMs: number = 500): PerformanceMetric[] {
  const metrics = getPerformanceMetrics();
  return metrics.filter(m => m.duration > thresholdMs);
}

export function usePageLoadTiming() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      const paintEntries = performance.getEntriesByType('paint');
      paintEntries.forEach(entry => {
        if (entry.name === 'first-contentful-paint') {
          console.log(`[Performance] FCP: ${entry.startTime.toFixed(2)}ms`);
        }
      });
    }
  }, []);
}

export function useQueryTiming(queryKey: string[]) {
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log(`[Query] ${queryKey.join(':')} - mounted`);
    }
  }, [queryKey.join(':')]);
}
