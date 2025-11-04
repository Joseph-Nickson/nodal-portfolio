// SlideshowTool - Auto-cycles through items in current category
import { Tool } from "./Tool.js";

export class SlideshowTool extends Tool {
  constructor() {
    super();
    this.interval = null;
    this.currentIndex = 0;
    this.items = [];
    this.stateManager = null;
    this.delay = 3000; // 3 seconds between images
  }

  activate(viewerNode) {
    super.activate(viewerNode);

    // Get state manager from viewerNode
    this.stateManager = viewerNode.stateManager;

    // Get current category items from manifest
    const manifest = this.stateManager.state.manifest;
    if (!manifest) return;

    // Find all items across categories
    this.items = [
      ...(manifest.painting || []),
      ...(manifest.film || []),
      ...(manifest.music || []),
    ];

    if (this.items.length === 0) return;

    // Start slideshow
    this.startSlideshow();
  }

  /**
   * Slideshow is a pass-through tool - it just cycles items but doesn't modify the image
   */
  async process(imageData, ctx, canvas) {
    return imageData;
  }

  deactivate(viewerNode) {
    super.deactivate(viewerNode);
    this.stopSlideshow();
  }

  cleanup() {
    this.stopSlideshow();
    this.items = [];
    this.currentIndex = 0;
  }

  startSlideshow() {
    if (this.items.length === 0) return;

    // Show first item immediately
    this.showNextItem();

    // Set interval for auto-advance
    this.interval = setInterval(() => {
      this.showNextItem();
    }, this.delay);
  }

  stopSlideshow() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  showNextItem() {
    if (this.items.length === 0) return;

    const item = this.items[this.currentIndex];
    this.stateManager.selectItem(item);

    this.currentIndex = (this.currentIndex + 1) % this.items.length;
  }
}
