/**
 * Debounce helpers for optimizing real-time listeners
 * Prevents excessive Firestore reads from rapid updates
 */

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit how often a function can be called
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Debounced callback for real-time listeners
 * Use this to wrap onSnapshot callbacks
 */
export function createDebouncedListener<T>(
  callback: (data: T) => void,
  delay: number = 500
): (data: T) => void {
  return debounce(callback, delay);
}

/**
 * Throttled callback for real-time listeners
 * Use this for high-frequency updates
 */
export function createThrottledListener<T>(
  callback: (data: T) => void,
  limit: number = 1000
): (data: T) => void {
  return throttle(callback, limit);
}

