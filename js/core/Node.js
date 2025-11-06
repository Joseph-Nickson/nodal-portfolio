import { DragHandler } from "../utils/DragHandler.js";

/**
 * Base Node class - All nodes inherit from this
 */
export class Node {
  constructor(id, stateManager, options = {}) {
    this.id = id;
    this.stateManager = stateManager;
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.width = options.width || 250;
    this.height = options.height || 60;
    this.closeable = options.closeable || false;
    this.showInputPort = options.showInputPort !== false; // default true
    this.showOutputPort = options.showOutputPort !== false; // default true
    this.dragHandle = options.dragHandle || null; // Optional: CSS selector for drag handle

    this.element = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };

    this.createDOM();
    this.attachDragListeners();

    // Register with state manager
    stateManager.addNode(id, this);
  }

  createDOM() {
    this.element = document.createElement("div");
    this.element.className = "node";
    this.element.style.cssText = `
      position: absolute;
      left: ${this.x}px;
      top: ${this.y}px;
      width: ${this.width}px;
      min-height: ${this.height}px;
    `;

    // Connection ports
    this.inputPort = document.createElement("div");
    this.inputPort.className = "connection-port input";
    if (!this.showInputPort) {
      this.inputPort.style.display = "none";
    }

    this.outputPort = document.createElement("div");
    this.outputPort.className = "connection-port output";
    if (!this.showOutputPort) {
      this.outputPort.style.display = "none";
    }

    // Close button if closeable
    if (this.closeable) {
      this.closeBtn = document.createElement("button");
      this.closeBtn.className = "close-btn";
      this.closeBtn.textContent = "×";
      this.closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.remove();
      };
      this.element.appendChild(this.closeBtn);
    }

    this.element.appendChild(this.inputPort);
    this.element.appendChild(this.outputPort);
  }

  attachDragListeners() {
    // Check if target element allows dragging
    const canDrag = (target) => {
      // If dragHandle is specified, only allow drag from that element
      if (this.dragHandle && !target.closest(this.dragHandle)) {
        return false;
      }

      // Don't drag if clicking on interactive elements (buttons, but allow back-arrow)
      if (
        target.classList.contains("close-btn") ||
        target.closest("button") ||
        (target.closest(".node-item") && !target.closest(this.dragHandle)) ||
        (target.closest(".node-list-item") && !target.closest(this.dragHandle))
      ) {
        return false;
      }

      return true;
    };

    // Create drag handler with throttled updates - store reference for cleanup
    this.dragHandler = new DragHandler(this.element, {
      canDrag,
      throttle: 16, // Max 60fps updates
      onStart: () => {
        this.isDragging = true;
        this.element.style.cursor = "grabbing";

        // Lock width during drag for viewer nodes (prevents scaling)
        if (this.element.classList.contains("viewer-node")) {
          const currentWidth = this.element.offsetWidth;
          this.element.style.setProperty("--drag-width", `${currentWidth}px`);
          this.element.classList.add("dragging");
        }
      },
      onMove: (dx, dy) => {
        this.x += dx;
        this.y += dy;
        this.element.style.left = `${this.x}px`;
        this.element.style.top = `${this.y}px`;
        this.stateManager.emit("connectionChanged");
      },
      onEnd: () => {
        this.isDragging = false;
        this.element.style.cursor = "grab";

        // For viewer nodes, keep the width locked after drag to prevent auto-sizing
        if (this.element.classList.contains("viewer-node")) {
          const finalWidth = this.element.offsetWidth;
          this.element.classList.remove("dragging");
          this.element.style.removeProperty("--drag-width");
          // Set explicit width with !important to override CSS
          this.element.style.setProperty(
            "width",
            `${finalWidth}px`,
            "important",
          );
        }

        // Final update to ensure accurate position
        this.stateManager.emit("connectionChanged");
      },
    });
  }

  getConnectionPort(type) {
    return type === "input" ? this.inputPort : this.outputPort;
  }

  setContent(html) {
    // Find or create content container
    let content = this.element.querySelector(".node-content");
    if (!content) {
      content = document.createElement("div");
      content.className = "node-content";
      this.element.appendChild(content);
    }
    content.innerHTML = html;
  }

  remove() {
    // Clean up drag handler
    if (this.dragHandler) {
      this.dragHandler.destroy();
      this.dragHandler = null;
    }

    this.element.remove();
    this.stateManager.removeNode(this.id);
  }

  mount(container) {
    container.appendChild(this.element);
  }
}
