import { Tool } from "./Tool.js";
import { VIEWER } from "../config/constants.js";

/**
 * SmudgeTool - Mixer brush that picks up and blends pixels like Photoshop
 * Uses Canvas 2D API for GPU-accelerated painting
 */
export class SmudgeTool extends Tool {
  constructor() {
    super("smudge");
    this.canvas = null;
    this.ctx = null;
    this.viewerNode = null;
    this.originalImage = null;

    // Brush state
    this.isSmudging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.brushSize = 50;
    this.wetness = 0.5; // How much to pick up new paint vs keep old
    this.flow = 0.5; // How much to apply
    this.brushPaint = null; // The paint on the brush tip

    // Track the last imageData hash to detect when source changes
    this.lastImageDataHash = null;
    this.canvasNeedsRefresh = true;

    // Store event handler references for cleanup
    this.handlers = {
      mousedown: null,
      mousemove: null,
      mouseup: null,
      mouseleave: null,
      touchstart: null,
      touchmove: null,
      touchend: null,
    };
  }

  activate(viewerNode) {
    super.activate(viewerNode);
    this.viewerNode = viewerNode;
    // Restrict dragging to only the viewer-bar for interactive canvas
    viewerNode.setDragHandle(".viewer-bar");
    // Hide the static image, show the canvas container
    viewerNode.showCanvas();
  }

  /**
   * SmudgeTool needs to work differently from other tools:
   * 1. Only refresh canvas when input imageData actually changes
   * 2. Preserve user's painting across renders
   * 3. Return null to prevent pipeline from overwriting canvas
   */
  async process(imageData, ctx, canvas) {
    if (!this.viewerNode.currentItem) {
      return imageData;
    }

    // Calculate simple hash of imageData to detect changes
    const newHash = this.hashImageData(imageData);
    const imageDataChanged = newHash !== this.lastImageDataHash;

    // Use the existing pipeline canvas instead of creating a new one
    if (!this.canvas) {
      this.canvas = canvas;
      this.ctx = ctx;

      // Set cursor for smudge tool
      this.canvas.style.cursor = "crosshair";

      // Put the incoming imageData onto canvas (first time)
      ctx.putImageData(imageData, 0, 0);

      // Attach event listeners to the existing canvas
      this.attachEventListeners();

      // Store hash
      this.lastImageDataHash = newHash;
    } else if (imageDataChanged) {
      // Source image changed (new item loaded or tools changed upstream)
      // Refresh the canvas with new base image
      ctx.putImageData(imageData, 0, 0);

      // Clear brush and reset for new image
      this.brushPaint = null;
      this.lastImageDataHash = newHash;
    }
    // else: imageData hasn't changed, preserve user's painting on canvas

    // IMPORTANT: Return null to signal "don't putImageData after this"
    // The canvas already has the correct state (input + user painting)
    return null;
  }

  /**
   * Simple hash of imageData to detect changes
   * Samples pixels across the image for performance
   */
  hashImageData(imageData) {
    let hash = 0;
    const step = Math.floor(imageData.data.length / 100); // Sample 100 points
    for (let i = 0; i < imageData.data.length; i += step) {
      hash = (hash << 5) - hash + imageData.data[i];
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  deactivate(viewerNode) {
    super.deactivate(viewerNode);
    this.cleanup();
    // Restore static image display when tool is removed
    viewerNode.showImage();
  }

  cleanup() {
    // Remove event listeners properly
    if (this.canvas) {
      Object.entries(this.handlers).forEach(([event, handler]) => {
        if (handler) {
          this.canvas.removeEventListener(event, handler);
        }
      });

      this.canvas = null;
      this.ctx = null;
    }

    // Clear all handler references
    Object.keys(this.handlers).forEach((key) => {
      this.handlers[key] = null;
    });

    // Re-enable full node dragging when smudge is removed
    if (this.viewerNode) {
      this.viewerNode.setDragHandle(null);
      this.viewerNode = null;
    }

    // Reset state
    this.brushPaint = null;
    this.isSmudging = false;
    this.lastImageDataHash = null;
    this.canvasNeedsRefresh = true;
  }

  attachEventListeners() {
    // Mouse down
    this.handlers.mousedown = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      // Convert screen coordinates to canvas pixel coordinates
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      this.isSmudging = true;
      this.lastX = x;
      this.lastY = y;

      // Pick up paint from canvas
      this.pickupPaint(x, y, this.brushSize);

      // Apply paint at starting position
      this.applyPaint(x, y, this.brushSize);
    };
    this.canvas.addEventListener("mousedown", this.handlers.mousedown);

    // Mouse move
    this.handlers.mousemove = (e) => {
      if (!this.isSmudging) return;

      const rect = this.canvas.getBoundingClientRect();
      // Convert screen coordinates to canvas pixel coordinates
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      // Interpolate for smooth painting
      const dist = Math.sqrt((x - this.lastX) ** 2 + (y - this.lastY) ** 2);
      const steps = Math.max(1, Math.ceil(dist / 2));

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const ix = this.lastX + (x - this.lastX) * t;
        const iy = this.lastY + (y - this.lastY) * t;

        // Mix: pick up new paint + keep old paint
        this.mixPaint(ix, iy, this.brushSize, this.wetness);

        // Apply the mixed paint
        this.applyPaint(ix, iy, this.brushSize);
      }

      this.lastX = x;
      this.lastY = y;
    };
    this.canvas.addEventListener("mousemove", this.handlers.mousemove);

    // Mouse up
    this.handlers.mouseup = () => {
      this.isSmudging = false;
    };
    this.canvas.addEventListener("mouseup", this.handlers.mouseup);

    // Mouse leave
    this.handlers.mouseleave = () => {
      this.isSmudging = false;
    };
    this.canvas.addEventListener("mouseleave", this.handlers.mouseleave);

    // Touch support
    this.handlers.touchstart = (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      // Convert screen coordinates to canvas pixel coordinates
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;

      this.isSmudging = true;
      this.lastX = x;
      this.lastY = y;

      this.pickupPaint(x, y, this.brushSize);
      this.applyPaint(x, y, this.brushSize);
    };
    this.canvas.addEventListener("touchstart", this.handlers.touchstart);

    this.handlers.touchmove = (e) => {
      e.preventDefault();
      if (!this.isSmudging) return;

      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      // Convert screen coordinates to canvas pixel coordinates
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;

      const dist = Math.sqrt((x - this.lastX) ** 2 + (y - this.lastY) ** 2);
      const steps = Math.max(1, Math.ceil(dist / 2));

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const ix = this.lastX + (x - this.lastX) * t;
        const iy = this.lastY + (y - this.lastY) * t;

        this.mixPaint(ix, iy, this.brushSize, this.wetness);
        this.applyPaint(ix, iy, this.brushSize);
      }

      this.lastX = x;
      this.lastY = y;
    };
    this.canvas.addEventListener("touchmove", this.handlers.touchmove);

    this.handlers.touchend = () => {
      this.isSmudging = false;
    };
    this.canvas.addEventListener("touchend", this.handlers.touchend);
  }

  /**
   * Pick up paint from the canvas into the brush
   */
  pickupPaint(x, y, size) {
    const radius = size / 2;
    const diameter = Math.ceil(size);

    // Get circular region of pixels
    const imageData = this.ctx.getImageData(
      Math.max(0, Math.floor(x - radius)),
      Math.max(0, Math.floor(y - radius)),
      Math.min(this.canvas.width, diameter),
      Math.min(this.canvas.height, diameter),
    );

    // Store as our brush paint
    this.brushPaint = {
      data: new Uint8ClampedArray(imageData.data),
      width: imageData.width,
      height: imageData.height,
      centerX: radius,
      centerY: radius,
    };
  }

  /**
   * Mix new paint from canvas with existing brush paint
   */
  mixPaint(x, y, size, mixAmount) {
    if (!this.brushPaint) {
      this.pickupPaint(x, y, size);
      return;
    }

    const radius = size / 2;
    const diameter = Math.ceil(size);

    // Get new paint from canvas
    const newPaint = this.ctx.getImageData(
      Math.max(0, Math.floor(x - radius)),
      Math.max(0, Math.floor(y - radius)),
      Math.min(this.canvas.width, diameter),
      Math.min(this.canvas.height, diameter),
    );

    // Mix with existing brush paint
    // mixAmount = 0: keep 100% old paint (dry brush)
    // mixAmount = 1: pick up 100% new paint (wet brush)
    for (let i = 0; i < this.brushPaint.data.length; i += 4) {
      if (i < newPaint.data.length) {
        this.brushPaint.data[i] =
          this.brushPaint.data[i] * (1 - mixAmount) +
          newPaint.data[i] * mixAmount; // R
        this.brushPaint.data[i + 1] =
          this.brushPaint.data[i + 1] * (1 - mixAmount) +
          newPaint.data[i + 1] * mixAmount; // G
        this.brushPaint.data[i + 2] =
          this.brushPaint.data[i + 2] * (1 - mixAmount) +
          newPaint.data[i + 2] * mixAmount; // B
        // Keep alpha at 255
      }
    }
  }

  /**
   * Apply brush paint to canvas with soft circular falloff
   */
  applyPaint(x, y, size) {
    if (!this.brushPaint) return;

    const radius = size / 2;
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = this.brushPaint.width;
    tempCanvas.height = this.brushPaint.height;

    // Put our brush paint data onto temp canvas
    const imageData = tempCtx.createImageData(
      this.brushPaint.width,
      this.brushPaint.height,
    );
    imageData.data.set(this.brushPaint.data);
    tempCtx.putImageData(imageData, 0, 0);

    // Create circular mask with soft edges
    const maskCanvas = document.createElement("canvas");
    const maskCtx = maskCanvas.getContext("2d");
    maskCanvas.width = this.brushPaint.width;
    maskCanvas.height = this.brushPaint.height;

    // Create radial gradient for soft circular brush
    const gradient = maskCtx.createRadialGradient(
      this.brushPaint.centerX,
      this.brushPaint.centerY,
      0,
      this.brushPaint.centerX,
      this.brushPaint.centerY,
      radius,
    );
    gradient.addColorStop(0, `rgba(255, 255, 255, ${this.flow})`);
    gradient.addColorStop(0.7, `rgba(255, 255, 255, ${this.flow * 0.5})`);
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    maskCtx.fillStyle = gradient;
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    // Apply mask to paint using composite operation
    tempCtx.globalCompositeOperation = "destination-in";
    tempCtx.drawImage(maskCanvas, 0, 0);

    // Draw the masked paint onto main canvas
    this.ctx.globalCompositeOperation = "source-over";
    const drawX = Math.floor(x - this.brushPaint.centerX);
    const drawY = Math.floor(y - this.brushPaint.centerY);
    this.ctx.drawImage(tempCanvas, drawX, drawY);
  }
}
