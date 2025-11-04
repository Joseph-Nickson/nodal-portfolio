// RagdollTool - Physics-based ragdoll that responds to viewer movement
import { Tool } from "./Tool.js";
import { Ragdoll } from "../physics/VerletPhysics.js";

export class RagdollTool extends Tool {
  constructor() {
    super();
    this.ragdoll = null;
    this.lastTime = Date.now();
    this.gravity = { x: 0, y: 400 }; // pixels/s^2
    this.animationFrame = null;
    this.canvas = null;
    this.ctx = null;
    this.viewerNode = null;
    this.lastViewerX = 0;
    this.lastViewerY = 0;
    this.isMouseDown = false;
  }

  activate(viewerNode) {
    super.activate(viewerNode);
    this.viewerNode = viewerNode;

    // Track initial viewer position
    this.lastViewerX = viewerNode.x;
    this.lastViewerY = viewerNode.y;
  }

  /**
   * Process the image data by adding a ragdoll overlay
   */
  async process(imageData, ctx, canvas) {
    // Store canvas reference
    this.canvas = canvas;
    this.ctx = ctx;

    // First, put the input image data on the canvas
    ctx.putImageData(imageData, 0, 0);

    // Create ragdoll if it doesn't exist
    if (!this.ragdoll) {
      // Position ragdoll at center of canvas (centerY is the torso center)
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      // Scale ragdoll to be almost as tall as viewer (450px canvas)
      this.ragdoll = new Ragdoll(centerX, centerY, 3.5);

      // Setup mouse interaction
      this.setupMouseInteraction();

      // Start animation loop
      this.startAnimation();
    }

    // Check if viewer has moved (for gravity simulation)
    this.updateGravityFromViewerMovement();

    // Update physics
    const currentTime = Date.now();
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.016); // Cap at 60fps
    this.lastTime = currentTime;

    const bounds = {
      width: canvas.width,
      height: canvas.height,
    };

    this.ragdoll.update(dt, this.gravity, bounds);

    // Render ragdoll
    this.ragdoll.render(ctx);

    // Get the updated image data with ragdoll drawn on it
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  updateGravityFromViewerMovement() {
    if (!this.viewerNode) return;

    // Calculate viewer velocity
    const dx = this.viewerNode.x - this.lastViewerX;
    const dy = this.viewerNode.y - this.lastViewerY;

    // Apply acceleration to gravity based on movement (increased impact)
    // When viewer moves right, gravity pulls left (inertia)
    const accelFactor = 100; // Increased from 30 for stronger effect
    this.gravity.x = -dx * accelFactor;
    this.gravity.y = 400 - dy * accelFactor; // Base gravity + movement

    // Store current position for next frame
    this.lastViewerX = this.viewerNode.x;
    this.lastViewerY = this.viewerNode.y;
  }

  setupMouseInteraction() {
    if (!this.canvas) return;

    const getMousePos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    this.canvas.addEventListener("mousedown", (e) => {
      const pos = getMousePos(e);
      if (this.ragdoll.startDrag(pos.x, pos.y)) {
        this.isMouseDown = true;
        e.stopPropagation();
      }
    });

    this.canvas.addEventListener("mousemove", (e) => {
      if (this.isMouseDown) {
        const pos = getMousePos(e);
        this.ragdoll.drag(pos.x, pos.y);
        e.stopPropagation();
      }
    });

    const stopDragging = () => {
      if (this.isMouseDown) {
        this.ragdoll.stopDrag();
        this.isMouseDown = false;
      }
    };

    this.canvas.addEventListener("mouseup", stopDragging);
    this.canvas.addEventListener("mouseleave", stopDragging);
  }

  startAnimation() {
    const animate = () => {
      if (!this.active) return;

      // Trigger re-render of pipeline
      if (this.viewerNode && this.viewerNode.getPipeline()) {
        this.viewerNode.getPipeline().render();
      }

      this.animationFrame = requestAnimationFrame(animate);
    };

    animate();
  }

  cleanup() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.ragdoll = null;
    this.canvas = null;
    this.ctx = null;
  }
}
