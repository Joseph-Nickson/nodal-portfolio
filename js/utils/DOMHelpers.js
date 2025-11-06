/**
 * DOMHelpers - Utility functions for common DOM operations
 */
export const DOM = {
  /**
   * Attach event handler to element(s) matching selector
   * @param {HTMLElement} parent - Parent element to search within
   * @param {string} selector - CSS selector
   * @param {string} event - Event name (e.g., 'click')
   * @param {Function} handler - Event handler
   */
  attachHandler(parent, selector, event, handler) {
    const elements = parent.querySelectorAll(selector);
    elements.forEach(el => {
      el.addEventListener(event, handler);
    });
  },

  /**
   * Attach click handler with optional event stopping
   * @param {HTMLElement} parent - Parent element
   * @param {string} selector - CSS selector
   * @param {Function} handler - Click handler
   * @param {Object} options - Options { stopPropagation, preventDefault }
   */
  onClick(parent, selector, handler, options = {}) {
    const element = parent.querySelector(selector);
    if (!element) return null;

    element.onclick = (e) => {
      if (options.stopPropagation) e.stopPropagation();
      if (options.preventDefault) e.preventDefault();
      handler(e);
    };

    return element;
  },

  /**
   * Set element content (shorthand for innerHTML)
   * @param {HTMLElement} element - Element to update
   * @param {string} html - HTML content
   */
  setContent(element, html) {
    element.innerHTML = html;
  },

  /**
   * Toggle element display
   * @param {HTMLElement} element - Element to toggle
   * @param {boolean} show - Whether to show or hide
   */
  toggleDisplay(element, show) {
    element.style.display = show ? 'block' : 'none';
  },

  /**
   * Create element with classes and attributes
   * @param {string} tag - HTML tag name
   * @param {Object} options - { classes: [], attributes: {}, innerHTML: '' }
   * @returns {HTMLElement}
   */
  createElement(tag, options = {}) {
    const element = document.createElement(tag);

    if (options.classes) {
      element.className = Array.isArray(options.classes)
        ? options.classes.join(' ')
        : options.classes;
    }

    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }

    if (options.innerHTML) {
      element.innerHTML = options.innerHTML;
    }

    return element;
  }
};
