// Canvas - Infinite pan/zoom grid system
import { CANVAS } from "../config/constants.js";

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
    // Pan with middle mouse or space+drag
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

    // Enable panning with right-click, middle-click, space+left-click, or canvas drag
    this.workspace.addEventListener("mousedown", (e) => {
      // Right-click (2), middle-click (1), or space+left-click (0)
      if (
        e.button === 2 ||
        e.button === 1 ||
        (e.button === 0 && spacePressed)
      ) {
        this.isPanning = true;
        this.startPan = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        this.workspace.style.cursor = "grabbing";
        e.preventDefault();
      }
      // Left-click on blank canvas (not on nodes)
      else if (e.button === 0 && e.target === this.workspace) {
        this.isPanning = true;
        this.startPan = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        this.workspace.style.cursor = "grabbing";
        e.preventDefault();
      }
    });

    // Prevent context menu on right-click
    this.workspace.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.isPanning) return;

      this.panX = e.clientX - this.startPan.x;
      this.panY = e.clientY - this.startPan.y;
      this.updateTransform();
    });

    document.addEventListener("mouseup", () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.workspace.style.cursor = spacePressed ? "grab" : "";
      }
    });

    // Zoom with wheel (or trackpad gestures)
    this.workspace.addEventListener(
      "wheel",
      (e) => {
        // Check if scrolling inside a scrollable element (like node-list)
        let target = e.target;
        while (target && target !== this.workspace) {
          if (target.classList && target.classList.contains("node-list")) {
            // Allow default scroll behavior for lists
            return;
          }
          target = target.parentElement;
        }

        e.preventDefault();

        // Trackpad pinch zoom (ctrlKey is set for pinch gestures)
        if (e.ctrlKey) {
          const delta = -e.deltaY;
          const zoomIntensity = 0.01; // More sensitive for trackpad pinch
          const zoom = Math.exp(delta * zoomIntensity);

          // Zoom towards cursor position
          const rect = this.workspace.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          // Calculate new scale
          const newScale = Math.max(0.1, Math.min(3, this.scale * zoom));

          // Adjust pan to zoom towards cursor
          const scaleDiff = newScale - this.scale;
          this.panX -= (mouseX - this.panX) * (scaleDiff / this.scale);
          this.panY -= (mouseY - this.panY) * (scaleDiff / this.scale);

          this.scale = newScale;
          this.updateTransform();
        }
        // Trackpad two-finger pan (no ctrlKey, has both deltaX and deltaY)
        else if (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0) {
          // Check if this is a trackpad gesture (typically has smaller, smoother deltas)
          // Regular mouse wheel usually only has deltaY
          const isTrackpad =
            Math.abs(e.deltaX) > 0 ||
            (Math.abs(e.deltaY) < 50 && e.deltaMode === 0);

          if (isTrackpad) {
            // Two-finger pan on trackpad
            this.panX -= e.deltaX;
            this.panY -= e.deltaY;
            this.updateTransform();
          } else {
            // Regular mouse wheel zoom
            const delta = -e.deltaY;
            const zoomIntensity = 0.001;
            const zoom = Math.exp(delta * zoomIntensity);

            // Zoom towards mouse position
            const rect = this.workspace.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate new scale
            const newScale = Math.max(0.1, Math.min(3, this.scale * zoom));

            // Adjust pan to zoom towards mouse
            const scaleDiff = newScale - this.scale;
            this.panX -= (mouseX - this.panX) * (scaleDiff / this.scale);
            this.panY -= (mouseY - this.panY) * (scaleDiff / this.scale);

            this.scale = newScale;
            this.updateTransform();
          }
        }
      },
      { passive: false },
    );

    // Two-finger touch controls for mobile
    let lastTouchDistance = 0;
    let lastTouchMidpoint = { x: 0, y: 0 };
    let isTwoFingerGesture = false;

    this.workspace.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        isTwoFingerGesture = true;
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        // Store initial distance for pinch zoom
        lastTouchDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY,
        );

        // Store midpoint for panning
        lastTouchMidpoint = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2,
        };
      }
    });

    this.workspace.addEventListener(
      "touchmove",
      (e) => {
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
            this.scale = Math.max(0.1, Math.min(3, this.scale * zoom));

            // Adjust pan to zoom towards midpoint
            const scaleDiff = this.scale - oldScale;
            const rect = this.workspace.getBoundingClientRect();
            const zoomPointX = currentMidpoint.x - rect.left;
            const zoomPointY = currentMidpoint.y - rect.top;
            this.panX -= (zoomPointX - this.panX) * (scaleDiff / oldScale);
            this.panY -= (zoomPointY - this.panY) * (scaleDiff / oldScale);
          }

          // Handle two-finger panning
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

    this.workspace.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) {
        isTwoFingerGesture = false;
        lastTouchDistance = 0;
      }
    });
  }

  updateTransform() {
    this.workspace.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;

    // Update connections immediately after transform
    if (this.connectionManager) {
      // Force layout recalculation before updating connections
      this.workspace.offsetHeight; // Force reflow
      this.connectionManager.updateAll();
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

    // Calculate bounding box of all nodes
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    this.nodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
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
