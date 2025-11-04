// Base Node class - All nodes inherit from this
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
    let startX, startY;

    const startDrag = (clientX, clientY, target) => {
      // Don't drag if clicking on interactive elements
      if (
        target.classList.contains("close-btn") ||
        target.closest("button") ||
        target.closest(".node-item") ||
        target.closest(".node-list-item")
      ) {
        return false;
      }

      // If dragHandle is specified, only allow drag from that element
      if (this.dragHandle) {
        if (!target.closest(this.dragHandle)) {
          return false;
        }
      }

      this.isDragging = true;
      startX = clientX - this.x;
      startY = clientY - this.y;
      this.element.style.cursor = "grabbing";
      return true;
    };

    const doDrag = (clientX, clientY) => {
      if (!this.isDragging) return;

      this.x = clientX - startX;
      this.y = clientY - startY;
      this.element.style.left = `${this.x}px`;
      this.element.style.top = `${this.y}px`;

      // Update connections
      this.stateManager.emit("connectionChanged");
    };

    const endDrag = () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.element.style.cursor = "grab";
      }
    };

    // Mouse events
    this.element.addEventListener("mousedown", (e) => {
      if (startDrag(e.clientX, e.clientY, e.target)) {
        e.preventDefault();
      }
    });

    document.addEventListener("mousemove", (e) => {
      doDrag(e.clientX, e.clientY);
    });

    document.addEventListener("mouseup", endDrag);

    // Touch events
    this.element.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          const touch = e.touches[0];
          if (startDrag(touch.clientX, touch.clientY, e.target)) {
            e.preventDefault();
          }
        }
      },
      { passive: false },
    );

    document.addEventListener(
      "touchmove",
      (e) => {
        if (this.isDragging && e.touches.length === 1) {
          const touch = e.touches[0];
          doDrag(touch.clientX, touch.clientY);
          e.preventDefault();
        }
      },
      { passive: false },
    );

    document.addEventListener("touchend", endDrag);
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
    this.element.remove();
    this.stateManager.removeNode(this.id);
  }

  mount(container) {
    container.appendChild(this.element);
  }
}
