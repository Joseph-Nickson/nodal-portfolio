import { CANVAS } from "../config/constants.js";

/**
 * Canvas - Infinite pan/zoom grid system with trackpad/mouse/touch support
 */
export class Canvas {
  constructor(container, connectionManager) {
    this.container = container;
    this.connectionManager = connectionManager;
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.startPan = { x: 0, y: 0 };
    this.nodes = []; // Track all nodes for framing
    this.updateConnectionsScheduled = false;

    this.workspace = document.createElement("div");
    this.workspace.className = "canvas-workspace";
    this.container.appendChild(this.workspace);

    // Create SVG layer inside workspace so it inherits transform
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.classList.add("connections-svg");
    this.workspace.appendChild(this.svg);

    this.attachPanZoomListeners();
  }

  attachPanZoomListeners() {
    this.setupKeyboardControls();
    this.setupMousePanning();
    this.setupWheelZoom();
    this.setupTouchGestures();
  }

  setupKeyboardControls() {
    let spacePressed = false;

    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !e.repeat) {
        spacePressed = true;
        this.workspace.style.cursor = "grab";
      }
    });

    document.addEventListener("keyup", (e) => {
      if (e.code === "Space") {
        spacePressed = false;
        this.workspace.style.cursor = "";
      }
    });

    this.isSpacePressed = () => spacePressed;
  }

  setupMousePanning() {
    // Enable panning with right-click, middle-click, space+left-click, or canvas drag
    this.workspace.addEventListener("mousedown", (e) => {
      if (this.panningDisabled) return;

      const canPan =
        e.button === 2 || // Right-click
        e.button === 1 || // Middle-click
        (e.button === 0 && this.isSpacePressed()) || // Space+left-click
        (e.button === 0 && e.target === this.workspace); // Left-click on canvas

      if (canPan) {
        this.isPanning = true;
        this.startPan = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        this.workspace.style.cursor = "grabbing";
        e.preventDefault();
      }
    });

    // Prevent context menu on right-click
    this.workspace.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("mousemove", (e) => {
      if (!this.isPanning) return;
      this.panX = e.clientX - this.startPan.x;
      this.panY = e.clientY - this.startPan.y;
      this.updateTransform();
    });

    document.addEventListener("mouseup", () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.workspace.style.cursor = this.isSpacePressed() ? "grab" : "";
      }
    });
  }

  setupWheelZoom() {
    this.workspace.addEventListener(
      "wheel",
      (e) => {
        // Allow scrolling in node lists
        if (this.isScrollableElement(e.target)) return;

        if (this.panningDisabled) return;

        e.preventDefault();

        // Trackpad pinch zoom
        if (e.ctrlKey) {
          this.zoomTowardsCursor(e, CANVAS.TRACKPAD_ZOOM_INTENSITY);
        }
        // Trackpad two-finger pan or mouse wheel zoom
        else if (this.isTrackpadPan(e)) {
          this.panX -= e.deltaX;
          this.panY -= e.deltaY;
          this.updateTransform();
        } else {
          // Regular mouse wheel zoom
          this.zoomTowardsCursor(e, CANVAS.ZOOM_INTENSITY);
        }
      },
      { passive: false },
    );
  }

  isScrollableElement(target) {
    while (target && target !== this.workspace) {
      if (target.classList?.contains("node-list")) return true;
      target = target.parentElement;
    }
    return false;
  }

  isTrackpadPan(e) {
    return (
      Math.abs(e.deltaX) > 0 || (Math.abs(e.deltaY) < 50 && e.deltaMode === 0)
    );
  }

  zoomTowardsCursor(e, intensity) {
    const delta = -e.deltaY;
    const zoom = Math.exp(delta * intensity);
    const rect = this.workspace.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newScale = Math.max(
      CANVAS.MIN_SCALE,
      Math.min(CANVAS.MAX_SCALE, this.scale * zoom),
    );

    const scaleDiff = newScale - this.scale;
    this.panX -= (mouseX - this.panX) * (scaleDiff / this.scale);
    this.panY -= (mouseY - this.panY) * (scaleDiff / this.scale);

    this.scale = newScale;
    this.updateTransform();
  }

  setupTouchGestures() {
    // Two-finger touch controls for mobile
    let lastTouchDistance = 0;
    let lastTouchMidpoint = { x: 0, y: 0 };
    let isTwoFingerGesture = false;

    // Attach to container (fixed viewport) instead of workspace (transformed)
    // This ensures touch events work at any zoom/pan distance
    this.container.addEventListener(
      "touchstart",
      (e) => {
        if (this.panningDisabled) return;

        if (e.touches.length === 2) {
          e.preventDefault(); // Prevent browser zoom immediately
          isTwoFingerGesture = true;
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];

          // Store initial distance for pinch zoom
          lastTouchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY,
          );

          // Store midpoint for panning (in screen coordinates)
          lastTouchMidpoint = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2,
          };
        }
      },
      { passive: false },
    );

    this.container.addEventListener(
      "touchmove",
      (e) => {
        if (this.panningDisabled) return;

        if (e.touches.length === 2 && isTwoFingerGesture) {
          e.preventDefault();
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];

          // Calculate current distance and midpoint
          const distance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY,
          );

          const currentMidpoint = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2,
          };

          // Handle pinch zoom
          if (lastTouchDistance > 0) {
            const zoom = distance / lastTouchDistance;
            const oldScale = this.scale;
            this.scale = Math.max(
              CANVAS.MIN_SCALE,
              Math.min(CANVAS.MAX_SCALE, this.scale * zoom),
            );

            // Adjust pan to zoom towards midpoint (screen coordinates)
            const scaleDiff = this.scale - oldScale;
            const zoomPointX = currentMidpoint.x;
            const zoomPointY = currentMidpoint.y;
            this.panX -= (zoomPointX - this.panX) * (scaleDiff / oldScale);
            this.panY -= (zoomPointY - this.panY) * (scaleDiff / oldScale);
          }

          // Handle two-finger panning (screen coordinate deltas)
          const dx = currentMidpoint.x - lastTouchMidpoint.x;
          const dy = currentMidpoint.y - lastTouchMidpoint.y;
          this.panX += dx;
          this.panY += dy;

          // Update for next frame
          lastTouchDistance = distance;
          lastTouchMidpoint = currentMidpoint;

          this.updateTransform();
        }
      },
      { passive: false },
    );

    this.container.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) {
        isTwoFingerGesture = false;
        lastTouchDistance = 0;
      }
    });
  }

  updateTransform() {
    this.workspace.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;

    // Throttle connection updates using requestAnimationFrame
    if (this.connectionManager && !this.updateConnectionsScheduled) {
      this.updateConnectionsScheduled = true;
      requestAnimationFrame(() => {
        this.connectionManager.updateAll();
        this.updateConnectionsScheduled = false;
      });
    }
  }

  addNode(node) {
    node.mount(this.workspace);
    this.nodes.push(node);
  }

  removeNode(node) {
    const index = this.nodes.indexOf(node);
    if (index > -1) {
      this.nodes.splice(index, 1);
    }
  }

  getWorkspace() {
    return this.workspace;
  }

  getSVG() {
    return this.svg;
  }

  disablePanning() {
    this.panningDisabled = true;
  }

  enablePanning() {
    this.panningDisabled = false;
  }

  resetTransform() {
    this.panX = 0;
    this.panY = 0;
    this.scale = 1;
    this.updateTransform();
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(x, y) {
    return {
      x: x * this.scale + this.panX,
      y: y * this.scale + this.panY,
    };
  }

  /**
   * Frame all nodes in view with padding
   */
  frameAllNodes() {
    if (this.nodes.length === 0) return;

    // Calculate bounding box of all nodes using actual DOM dimensions
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    this.nodes.forEach((node) => {
      // Use actual rendered dimensions from DOM instead of stored width/height
      const actualWidth = node.element.offsetWidth;
      const actualHeight = node.element.offsetHeight;

      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + actualWidth);
      maxY = Math.max(maxY, node.y + actualHeight);
    });

    // Add padding
    const padding = CANVAS.HOME_PADDING;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Calculate required scale to fit
    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;
    const containerWidth = this.container.offsetWidth;
    const containerHeight = this.container.offsetHeight;

    const scaleX = containerWidth / bboxWidth;
    const scaleY = containerHeight / bboxHeight;
    this.scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 1

    // Center the bounding box
    const scaledWidth = bboxWidth * this.scale;
    const scaledHeight = bboxHeight * this.scale;
    this.panX = (containerWidth - scaledWidth) / 2 - minX * this.scale;
    this.panY = (containerHeight - scaledHeight) / 2 - minY * this.scale;

    this.updateTransform();
  }
}
