import { Node } from "../core/Node.js";
import { RenderPipeline } from "../core/RenderPipeline.js";

// ViewerNode - Displays selected artwork with bottom info bar
export class ViewerNode extends Node {
  constructor(id, stateManager, options = {}) {
    super(id, stateManager, {
      ...options,
      width: 700,
      height: 450,
      showOutputPort: false,
    });
    this.currentItem = null;
    this.filterActive = false;
    this.pipeline = new RenderPipeline(this);

    // Listen for item selection
    stateManager.on("itemSelected", (item) => {
      this.displayItem(item);
    });

    // Listen for static page requests
    stateManager.on("staticPageRequested", (page) => {
      this.displayStaticPage(page);
    });

    this.render();
  }

  /**
   * Get the render pipeline
   */
  getPipeline() {
    return this.pipeline;
  }

  // Override setContent to not use node-content wrapper
  setContent(html) {
    // Remove existing content (except ports and close btn)
    const existingContent = this.element.querySelectorAll(
      ".viewer-content, .viewer-bar",
    );
    existingContent.forEach((el) => el.remove());

    // Insert new content before output port
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    while (tempDiv.firstChild) {
      this.element.insertBefore(tempDiv.firstChild, this.outputPort);
    }
  }

  render() {
    this.setContent(`
      <div class="viewer-content">
        <div class="viewer-empty">Select an artwork</div>
      </div>
      <div class="viewer-bar">
        <span>VIEWER #1</span>
        <span class="viewer-icon">◉</span>
      </div>
    `);
  }

  displayItem(item) {
    this.currentItem = item;

    const content = this.element.querySelector(".viewer-content");
    content.innerHTML = `
      <img src="${item.path}" alt="${item.title}" class="viewer-image">
      <div id="canvas-container-${this.id}" class="canvas-container" style="display: none;"></div>
    `;

    // Update bar with item title
    const bar = this.element.querySelector(".viewer-bar");
    bar.innerHTML = `
      <span>${item.title.toUpperCase()}</span>
      <span class="viewer-icon">◉</span>
    `;

    // Load image into pipeline
    if (this.pipeline.hasTools()) {
      this.pipeline.loadImage(item.path);
    }
  }

  displayStaticPage(page) {
    const content = this.element.querySelector(".viewer-content");

    const pageContent = {
      info: `
        <div class="static-page">
          <h2>INFO</h2>
          <p>This is a portfolio showcasing creative work across<br>
          painting, film, audio, and other media.</p>
        </div>
      `,
      contact: `
        <div class="static-page">
          <h2>CONTACT</h2>
          <p>Get in touch for collaborations<br>or inquiries.</p>
        </div>
      `,
    };

    content.innerHTML =
      pageContent[page] || '<div class="viewer-empty">Page not found</div>';

    // Reset bar
    const bar = this.element.querySelector(".viewer-bar");
    bar.innerHTML = `
      <span>VIEWER #1</span>
      <span class="viewer-icon">◉</span>
    `;
  }

  getCanvasContainer() {
    return this.element.querySelector(`#canvas-container-${this.id}`);
  }

  showCanvas() {
    const img = this.element.querySelector(".viewer-image");
    const canvas = this.element.querySelector(`#canvas-container-${this.id}`);
    if (img) img.style.display = "none";
    if (canvas) canvas.style.display = "flex";

    // Restrict dragging to only the viewer-bar when canvas is active
    this.dragHandle = ".viewer-bar";
  }

  showImage() {
    const img = this.element.querySelector(".viewer-image");
    const canvas = this.element.querySelector(`#canvas-container-${this.id}`);
    if (img) img.style.display = "block";
    if (canvas) canvas.style.display = "none";

    // Re-enable full node dragging
    this.dragHandle = null;
  }
}
