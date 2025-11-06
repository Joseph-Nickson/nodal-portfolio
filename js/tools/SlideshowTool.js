// SlideshowTool - Auto-cycles through items in current category
import { Tool } from "./Tool.js";

export class SlideshowTool extends Tool {
  constructor() {
    super("slideshow");
    this.interval = null;
    this.currentItemIndex = 0;
    this.currentImageIndex = 0;
    this.items = [];
    this.stateManager = null;
    this.viewerNode = null;
    this.delay = 3000; // 3 seconds between images
  }

  activate(viewerNode) {
    super.activate(viewerNode);

    this.viewerNode = viewerNode;
    this.stateManager = viewerNode.stateManager;

    // Get current category items from manifest
    const manifest = this.stateManager.state.manifest;
    if (!manifest) return;

    // Determine current category based on current item
    const currentItem = viewerNode.currentItem;
    let category = null;

    if (currentItem) {
      // Find which category contains this item
      for (const [cat, items] of Object.entries(manifest)) {
        if (items.some((item) => item === currentItem)) {
          category = cat;
          break;
        }
      }
    }

    // Use current category items, or all items if no category found
    if (category && manifest[category]) {
      this.items = manifest[category];
    } else {
      this.items = [
        ...(manifest.painting || []),
        ...(manifest.film || []),
        ...(manifest.music || []),
      ];
    }

    if (this.items.length === 0) return;

    // Find starting index from current item
    if (currentItem) {
      const index = this.items.findIndex((item) => item === currentItem);
      if (index !== -1) {
        this.currentItemIndex = index;
        this.currentImageIndex = viewerNode.currentImageIndex || 0;
      }
    }

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
    this.currentItemIndex = 0;
    this.currentImageIndex = 0;
    this.viewerNode = null;
  }

  startSlideshow() {
    if (this.items.length === 0) return;

    // Set interval for auto-advance
    this.interval = setInterval(() => {
      this.showNextImage();
    }, this.delay);
  }

  stopSlideshow() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  showNextImage() {
    if (this.items.length === 0) return;

    const currentItem = this.items[this.currentItemIndex];

    // For folder items, cycle through images first
    if (currentItem.type === "folder") {
      const imageCount = currentItem.images.length;
      this.currentImageIndex++;

      if (this.currentImageIndex >= imageCount) {
        // Move to next item
        this.currentImageIndex = 0;
        this.currentItemIndex = (this.currentItemIndex + 1) % this.items.length;
        const nextItem = this.items[this.currentItemIndex];
        this.stateManager.selectItem(nextItem);
      } else {
        // Stay on same item, just advance image
        if (this.viewerNode) {
          this.viewerNode.currentImageIndex = this.currentImageIndex;
          this.viewerNode.renderCurrentImage();

          // Notify InfoTool that image changed
          if (this.viewerNode.pipeline) {
            const infoTool = this.viewerNode.pipeline.tools.find(
              (t) => t.type === "info",
            );
            if (infoTool) {
              infoTool.loadInfoText(this.viewerNode);
            }
          }
        }
      }
    } else {
      // Single image item, move to next item
      this.currentItemIndex = (this.currentItemIndex + 1) % this.items.length;
      this.currentImageIndex = 0;
      const nextItem = this.items[this.currentItemIndex];
      this.stateManager.selectItem(nextItem);
    }
  }
}
