import { EventEmitter } from "../utils/EventEmitter.js";

/**
 * Base Tool class - All tools extend this
 * Extends EventEmitter so tools can emit their own events
 */
export class Tool extends EventEmitter {
  constructor(type) {
    super();
    this.type = type; // Tool type identifier (e.g., 'info', 'smudge', 'slideshow')
    this.active = false;
  }

  /**
   * Called when tool is activated (added to pipeline)
   * @param {ViewerNode} viewerNode - The viewer node to operate on
   */
  activate(viewerNode) {
    this.active = true;
    this.emit("activated", { viewerNode });
  }

  /**
   * Called when tool is deactivated (removed from pipeline)
   * @param {ViewerNode} viewerNode - The viewer node
   */
  deactivate(viewerNode) {
    this.active = false;
    this.cleanup();
    this.emit("deactivated", { viewerNode });
  }

  /**
   * Process image data in the pipeline
   * @param {ImageData} imageData - The input image data from previous tool
   * @param {CanvasRenderingContext2D} ctx - Canvas context for drawing
   * @param {HTMLCanvasElement} canvas - The canvas element
   * @returns {ImageData} The processed image data
   */
  async process(imageData, ctx, canvas) {
    // Override in subclasses to implement the effect
    // By default, return imageData unchanged (pass-through)
    return imageData;
  }

  /**
   * Clean up resources (override in subclasses)
   */
  cleanup() {
    // Override in subclasses
  }

  /**
   * Update with new data (optional, override in subclasses)
   */
  update(data) {
    // Override in subclasses if needed
  }
}
