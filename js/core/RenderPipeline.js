import { VIEWER } from "../config/constants.js";

/**
 * RenderPipeline - Manages the chain of tools/effects
 * Each tool processes the output of the previous tool in sequence
 */
export class RenderPipeline {
  constructor(viewerNode, stateManager) {
    this.viewerNode = viewerNode;
    this.stateManager = stateManager;
    this.toolMap = new Map(); // nodeId -> tool instance
    this.canvas = null;
    this.ctx = null;
    this.currentImageData = null;
    this.sourceImage = null;
  }

  /**
   * Add a tool associated with a node ID
   */
  addTool(tool, nodeId) {
    this.toolMap.set(nodeId, tool);
    this.render();
  }

  /**
   * Remove a tool by node ID
   */
  removeTool(nodeId) {
    if (this.toolMap.has(nodeId)) {
      this.toolMap.delete(nodeId);

      // If no tools left, show the image instead of canvas
      if (this.toolMap.size === 0) {
        this.viewerNode.showImage();
      } else {
        this.render();
      }
    }
  }

  /**
   * Get all tools in the pipeline
   */
  getTools() {
    return Array.from(this.toolMap.values());
  }

  /**
   * Check if pipeline has any tools
   */
  hasTools() {
    return this.toolMap.size > 0;
  }

  /**
   * Traverse the connection graph to get tools in correct order
   * Starts from viewer node and walks backwards through connections
   */
  getToolsInOrder() {
    const connections = this.stateManager.getConnections();
    const orderedTools = [];

    // Build a map of toId -> fromId for reverse traversal
    const parents = new Map();
    connections.forEach(([fromId, toId]) => {
      parents.set(toId, fromId);
    });

    console.log(
      "Connection graph:",
      Array.from(parents.entries())
        .map(([to, from]) => `${from}→${to}`)
        .join(", "),
    );

    // Start from viewer and walk backwards
    let currentId = this.viewerNode.id;
    const visited = new Set();
    const path = [currentId];

    while (parents.has(currentId) && !visited.has(currentId)) {
      visited.add(currentId);
      const parentId = parents.get(currentId);
      path.push(parentId);

      // If this parent is a tool node, add it to the front of the list
      if (this.toolMap.has(parentId)) {
        orderedTools.unshift(this.toolMap.get(parentId));
      }

      currentId = parentId;
    }

    console.log("Traversal path:", path.join(" ← "));
    console.log("Tool nodes found:", Array.from(this.toolMap.keys()));

    return orderedTools;
  }

  /**
   * Load a new image into the pipeline
   */
  async loadImage(imagePath) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.sourceImage = img;
        // Reset canvas initialization flag when loading new image
        this.canvasInitialized = false;
        this.render();
        resolve();
      };
      img.onerror = reject;
      img.src = imagePath;
    });
  }

  /**
   * Get or create the canvas element
   */
  getCanvas() {
    // Check if canvas exists and is still in the DOM
    if (!this.canvas || !this.canvas.isConnected) {
      const container = this.viewerNode.getCanvasContainer();
      this.canvas = document.createElement("canvas");
      this.canvas.style.display = "block";
      this.canvas.style.maxWidth = "100%";
      this.canvas.style.maxHeight = "100%";
      container.innerHTML = "";
      container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    }
    return this.canvas;
  }

  /**
   * Render the entire pipeline
   */
  async render() {
    if (!this.sourceImage) return;

    const canvas = this.getCanvas();

    // Use viewer-content dimensions directly for canvas size
    // This ensures tools work at the displayed resolution (efficient, appropriate scale)
    const viewerContent =
      this.viewerNode.element.querySelector(".viewer-content");

    let canvasWidth, canvasHeight;

    if (viewerContent && viewerContent.clientWidth > 0) {
      // Calculate size to fit source image within viewer-content while maintaining aspect ratio
      const containerWidth = viewerContent.clientWidth;
      const containerHeight = viewerContent.clientHeight;

      const scale = Math.min(
        containerWidth / this.sourceImage.width,
        containerHeight / this.sourceImage.height,
        1, // Don't scale up beyond original size
      );

      canvasWidth = Math.floor(this.sourceImage.width * scale);
      canvasHeight = Math.floor(this.sourceImage.height * scale);
    } else {
      // Fallback to constants
      const scale = Math.min(
        VIEWER.CANVAS_MAX_WIDTH / this.sourceImage.width,
        VIEWER.CANVAS_MAX_HEIGHT / this.sourceImage.height,
        1,
      );
      canvasWidth = Math.floor(this.sourceImage.width * scale);
      canvasHeight = Math.floor(this.sourceImage.height * scale);
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Show canvas in viewer
    this.viewerNode.showCanvas();

    // Draw source image at canvas resolution
    this.ctx.drawImage(this.sourceImage, 0, 0, canvasWidth, canvasHeight);

    // Get current image data
    this.currentImageData = this.ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    // Get tools in connection graph order (not insertion order!)
    const orderedTools = this.getToolsInOrder();

    // DEBUG: Log the tool execution order
    console.log(
      "Pipeline order:",
      orderedTools.map((t) => t.type || "unknown").join(" → "),
    );

    // Apply each tool in sequence with error handling
    for (let i = 0; i < orderedTools.length; i++) {
      const tool = orderedTools[i];
      const isLastTool = i === orderedTools.length - 1;

      if (tool.process) {
        try {
          // Tool processes ImageData and returns new ImageData (or null)
          const result = await tool.process(
            this.currentImageData,
            this.ctx,
            canvas,
          );

          // If tool returns null, it's managing canvas directly (like SmudgeTool)
          if (result === null) {
            // Read current canvas state for next tool
            this.currentImageData = this.ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            );
          } else {
            this.currentImageData = result;

            // If not the last tool, put imageData on canvas for next tool to see
            if (!isLastTool) {
              this.ctx.putImageData(this.currentImageData, 0, 0);
            }
          }
        } catch (error) {
          console.error(
            `Tool ${tool.type || "unknown"} failed at position ${i}:`,
            error,
          );
          // Continue with other tools - don't let one failure break the whole pipeline
          // Keep the previous imageData and skip this tool
        }
      }
    }

    // Put final result on canvas (last tool's output)
    this.ctx.putImageData(this.currentImageData, 0, 0);
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.tools.forEach((tool) => {
      if (tool.cleanup) tool.cleanup();
    });
    this.tools = [];

    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.ctx = null;
    }

    this.currentImageData = null;
    this.sourceImage = null;
  }
}
