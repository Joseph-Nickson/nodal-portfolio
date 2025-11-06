import { throttle } from "./debounce.js";

/**
 * DragHandler - Reusable mouse and touch drag functionality
 * Handles both mouse and touch events with throttled updates
 */
export class DragHandler {
  constructor(element, options = {}) {
    this.element = element;
    this.isDragging = false;
    this.startOffset = { x: 0, y: 0 };
    this.disabled = false;

    // Callbacks
    this.canDrag = options.canDrag || (() => true);
    this.onStart = options.onStart || (() => {});
    this.onMove = options.onMove || (() => {});
    this.onEnd = options.onEnd || (() => {});

    // Throttle move events if specified
    const throttleMs = options.throttle || 0;
    this.throttledOnMove =
      throttleMs > 0 ? throttle(this.onMove, throttleMs) : this.onMove;

    // Store handler references for cleanup
    this.handlers = {
      elementMouseDown: null,
      documentMouseMove: null,
      documentMouseUp: null,
      elementTouchStart: null,
      documentTouchMove: null,
      documentTouchEnd: null,
    };

    this.attachListeners();
  }

  attachListeners() {
    const startDrag = (clientX, clientY, target) => {
      // Check if disabled
      if (this.disabled) {
        return false;
      }

      // Check if drag is allowed
      if (!this.canDrag(target)) {
        return false;
      }

      this.isDragging = true;
      this.startOffset = { x: clientX, y: clientY };
      this.onStart(clientX, clientY, target);
      return true;
    };

    const doDrag = (clientX, clientY) => {
      if (!this.isDragging) return;

      const dx = clientX - this.startOffset.x;
      const dy = clientY - this.startOffset.y;
      this.startOffset = { x: clientX, y: clientY };

      this.throttledOnMove(dx, dy);
    };

    const endDrag = () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.onEnd();
      }
    };

    // Mouse events
    this.handlers.elementMouseDown = (e) => {
      if (startDrag(e.clientX, e.clientY, e.target)) {
        e.preventDefault();
      }
    };
    this.element.addEventListener("mousedown", this.handlers.elementMouseDown);

    this.handlers.documentMouseMove = (e) => {
      doDrag(e.clientX, e.clientY);
    };
    document.addEventListener("mousemove", this.handlers.documentMouseMove);

    this.handlers.documentMouseUp = endDrag;
    document.addEventListener("mouseup", this.handlers.documentMouseUp);

    // Touch events
    this.handlers.elementTouchStart = (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (startDrag(touch.clientX, touch.clientY, e.target)) {
          e.preventDefault();
        }
      }
    };
    this.element.addEventListener(
      "touchstart",
      this.handlers.elementTouchStart,
      { passive: false },
    );

    this.handlers.documentTouchMove = (e) => {
      if (this.isDragging && e.touches.length === 1) {
        const touch = e.touches[0];
        doDrag(touch.clientX, touch.clientY);
        e.preventDefault();
      }
    };
    document.addEventListener("touchmove", this.handlers.documentTouchMove, {
      passive: false,
    });

    this.handlers.documentTouchEnd = endDrag;
    document.addEventListener("touchend", this.handlers.documentTouchEnd);
  }

  /**
   * Manually stop dragging
   */
  stop() {
    this.isDragging = false;
  }

  /**
   * Disable dragging
   */
  disable() {
    this.disabled = true;
    this.stop();
  }

  /**
   * Enable dragging
   */
  enable() {
    this.disabled = false;
  }

  /**
   * Clean up all event listeners
   */
  destroy() {
    // Remove element listeners
    if (this.handlers.elementMouseDown) {
      this.element.removeEventListener(
        "mousedown",
        this.handlers.elementMouseDown,
      );
    }
    if (this.handlers.elementTouchStart) {
      this.element.removeEventListener(
        "touchstart",
        this.handlers.elementTouchStart,
      );
    }

    // Remove document listeners
    if (this.handlers.documentMouseMove) {
      document.removeEventListener(
        "mousemove",
        this.handlers.documentMouseMove,
      );
    }
    if (this.handlers.documentMouseUp) {
      document.removeEventListener("mouseup", this.handlers.documentMouseUp);
    }
    if (this.handlers.documentTouchMove) {
      document.removeEventListener(
        "touchmove",
        this.handlers.documentTouchMove,
      );
    }
    if (this.handlers.documentTouchEnd) {
      document.removeEventListener("touchend", this.handlers.documentTouchEnd);
    }

    // Clear references
    Object.keys(this.handlers).forEach((key) => {
      this.handlers[key] = null;
    });

    this.element = null;
  }
}
