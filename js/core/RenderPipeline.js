// RenderPipeline - Manages the chain of tools/effects
// Each tool processes the output of the previous tool in sequence

export class RenderPipeline {
  constructor(viewerNode) {
    this.viewerNode = viewerNode;
    this.tools = []; // Array of tools in order
    this.canvas = null;
    this.ctx = null;
    this.currentImageData = null;
    this.sourceImage = null;
  }

  /**
   * Add a tool to the end of the pipeline
   */
  addTool(tool) {
    this.tools.push(tool);
    this.render();
  }

  /**
   * Remove a tool from the pipeline
   */
  removeTool(tool) {
    const index = this.tools.indexOf(tool);
    if (index > -1) {
      this.tools.splice(index, 1);

      // If no tools left, show the image instead of canvas
      if (this.tools.length === 0) {
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
    return this.tools;
  }

  /**
   * Check if pipeline has any tools
   */
  hasTools() {
    return this.tools.length > 0;
  }

  /**
   * Load a new image into the pipeline
   */
  async loadImage(imagePath) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.sourceImage = img;
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

    // Calculate scaled size
    const maxWidth = 700;
    const maxHeight = 450;
    const scale = Math.min(
      maxWidth / this.sourceImage.width,
      maxHeight / this.sourceImage.height,
      1,
    );

    canvas.width = this.sourceImage.width * scale;
    canvas.height = this.sourceImage.height * scale;

    // Show canvas in viewer
    this.viewerNode.showCanvas();

    // Start with the source image (don't clear to avoid flash)
    this.ctx.drawImage(this.sourceImage, 0, 0, canvas.width, canvas.height);

    // Get current image data
    this.currentImageData = this.ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    // Apply each tool in sequence
    for (const tool of this.tools) {
      if (tool.process) {
        // Tool processes ImageData and returns new ImageData
        this.currentImageData = await tool.process(
          this.currentImageData,
          this.ctx,
          canvas,
        );
      }
    }

    // Put final result on canvas
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
