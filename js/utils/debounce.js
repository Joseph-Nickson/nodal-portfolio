/**
 * Debounce - Limits function execution rate
 * Returns a function that delays invoking func until after delay milliseconds
 *
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle - Ensures function is called at most once per interval
 *
 * @param {Function} fn - Function to throttle
 * @param {number} interval - Minimum time between calls in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(fn, interval) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= interval) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}
