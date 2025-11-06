import { Tool } from "./Tool.js";
import { CanvasRenderer } from "../utils/CanvasRenderer.js";

/**
 * InfoTool - Displays info text from .txt files on the image
 */
export class InfoTool extends Tool {
  constructor() {
    super("info");
    this.infoText = null;
    this.loading = false;
  }

  activate(viewerNode) {
    super.activate(viewerNode);
    this.loadInfoText(viewerNode);
  }

  /**
   * Load info text from .txt file
   */
  async loadInfoText(viewerNode) {
    this.loading = true;
    this.infoText = null;

    const imageData = viewerNode.getCurrentImageData();
    if (!imageData) {
      this.loading = false;
      return;
    }

    // Determine which .txt file to load
    // Priority: image-specific infoPath, then folder-level infoPath
    let txtPath = imageData.infoPath;
    if (!txtPath && imageData.folderInfoPath) {
      txtPath = imageData.folderInfoPath;
    }

    if (!txtPath) {
      this.infoText = "No info available";
      this.loading = false;
      return;
    }

    try {
      const response = await fetch(txtPath);
      if (!response.ok) {
        throw new Error(`Failed to load: ${response.status}`);
      }
      this.infoText = await response.text();
    } catch (error) {
      console.warn(`Could not load info from ${txtPath}:`, error);
      this.infoText = "Info file not found";
    }

    this.loading = false;

    // Trigger re-render if pipeline is active
    if (viewerNode.pipeline) {
      viewerNode.pipeline.render();
    }
  }

  /**
   * Process the image data by drawing info text on top
   */
  async process(imageData, ctx, canvas) {
    // First, put the input image data on the canvas
    ctx.putImageData(imageData, 0, 0);

    // Determine text to display
    const text = this.loading ? "Loading info..." : this.infoText;

    // Use CanvasRenderer utility with caching
    if (text) {
      CanvasRenderer.drawTextBox(ctx, canvas, text, {
        padding: 15,
        lineHeight: 20,
      });
    }

    // Get the updated image data with text drawn on it
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}
