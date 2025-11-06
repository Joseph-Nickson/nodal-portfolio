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
    this.currentImageIndex = 0; // For folder items with multiple images
    this.filterActive = false;
    this.pipeline = new RenderPipeline(this, stateManager);

    // Add viewer-specific class for styling
    this.element.classList.add("viewer-node");

    // Listen for item selection
    stateManager.on("itemSelected", (item) => {
      this.displayItem(item);
    });

    // Listen for static page requests
    stateManager.on("staticPageRequested", (page) => {
      this.displayStaticPage(page);
    });

    this.render();
    this.addResizeHandle();
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
    this.currentImageIndex = 0; // Reset to first image

    this.renderCurrentImage();
  }

  renderCurrentImage() {
    const item = this.currentItem;
    if (!item) return;

    // Determine current media (image or video)
    let currentMedia, imageCount, mediaType;
    if (item.type === "folder") {
      currentMedia = item.images[this.currentImageIndex];
      imageCount = item.images.length;
      mediaType = currentMedia.type; // 'image' or 'youtube'
    } else {
      currentMedia = item;
      imageCount = 1;
      mediaType = item.type; // 'image' or 'youtube'
    }

    const content = this.element.querySelector(".viewer-content");

    // Add navigation arrows if folder with multiple images
    const navHTML =
      item.type === "folder" && imageCount > 1
        ? `
      <button class="carousel-nav carousel-prev" ${this.currentImageIndex === 0 ? "disabled" : ""}>‹</button>
      <button class="carousel-nav carousel-next" ${this.currentImageIndex === imageCount - 1 ? "disabled" : ""}>›</button>
    `
        : "";

    // Render based on media type
    let mediaHTML;
    if (mediaType === "youtube") {
      // YouTube embed
      const embedUrl = `https://www.youtube.com/embed/${currentMedia.videoId}`;
      mediaHTML = `
        <iframe
          src="${embedUrl}"
          class="viewer-video"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen>
        </iframe>
      `;
    } else {
      // Regular image
      mediaHTML = `<img src="${currentMedia.path}" alt="${item.title}" class="viewer-image">`;
    }

    content.innerHTML = `
      ${navHTML}
      ${mediaHTML}
      <div id="canvas-container-${this.id}" class="canvas-container" style="display: none;"></div>
    `;

    // Attach navigation handlers
    if (item.type === "folder" && imageCount > 1) {
      const prevBtn = content.querySelector(".carousel-prev");
      const nextBtn = content.querySelector(".carousel-next");

      if (prevBtn) {
        prevBtn.onclick = (e) => {
          e.stopPropagation();
          if (this.currentImageIndex > 0) {
            this.currentImageIndex--;
            this.renderCurrentImage();
            this.stateManager.emit("imageChanged", this.getCurrentImageData());
          }
        };
      }

      if (nextBtn) {
        nextBtn.onclick = (e) => {
          e.stopPropagation();
          if (this.currentImageIndex < imageCount - 1) {
            this.currentImageIndex++;
            this.renderCurrentImage();
            this.stateManager.emit("imageChanged", this.getCurrentImageData());
          }
        };
      }
    }

    // Update bar with item title and image count
    const bar = this.element.querySelector(".viewer-bar");
    const countText =
      item.type === "folder" && imageCount > 1
        ? ` (${this.currentImageIndex + 1}/${imageCount})`
        : "";
    bar.innerHTML = `
      <span>${item.title.toUpperCase()}${countText}</span>
      <span class="viewer-icon">◉</span>
    `;

    // Load image into pipeline (only for images, not YouTube videos)
    if (mediaType !== "youtube" && this.pipeline.hasTools()) {
      this.pipeline.loadImage(currentMedia.path);
    }

    // Notify that viewer dimensions may have changed (for connection updates)
    // Use setTimeout to allow DOM to update before recalculating connections
    setTimeout(() => {
      this.stateManager.emit("connectionChanged");
    }, 0);
  }

  getCurrentImageData() {
    const item = this.currentItem;
    if (!item) return null;

    if (item.type === "folder") {
      return {
        ...item.images[this.currentImageIndex],
        title: item.title,
        folderInfoPath: item.infoPath,
      };
    } else {
      return item;
    }
  }

  async displayStaticPage(page) {
    const pageContent = {
      info: `INFO & CONTACT

This is a portfolio showcasing creative work across painting, film, and audio.

Get in touch for collaborations or inquiries.`,
    };

    const text = pageContent[page] || "Page not found";

    // Create a synthetic "item" for the static page
    this.currentItem = {
      type: "static",
      title: page.toUpperCase(),
      path: null, // No image path
      text: text, // Store text content
    };

    // Render static page as canvas so tools can work on it
    await this.renderStaticPageAsCanvas(text);

    // Update bar
    const bar = this.element.querySelector(".viewer-bar");
    bar.innerHTML = `
      <span>${page.toUpperCase()}</span>
      <span class="viewer-icon">◉</span>
    `;
  }

  async renderStaticPageAsCanvas(text) {
    // Create a temporary canvas to render text as an image
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    // Size to viewer dimensions
    const viewerContent = this.element.querySelector(".viewer-content");
    tempCanvas.width = viewerContent?.clientWidth || 700;
    tempCanvas.height = viewerContent?.clientHeight || 450;

    // Fill background
    tempCtx.fillStyle = "#e8e6e3";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw text using CanvasRenderer (same as InfoTool)
    const { CanvasRenderer } = await import("../utils/CanvasRenderer.js");
    CanvasRenderer.drawTextBox(tempCtx, tempCanvas, text, {
      font: 'bold 16px "Courier New", monospace',
      textColor: "#1a1a1a",
      bgColor: "transparent",
      padding: 40,
      lineHeight: 24,
    });

    // Convert canvas to data URL
    const dataUrl = tempCanvas.toDataURL("image/png");

    // Load through pipeline as if it were an image
    // This allows all tools (including SmudgeTool) to work on it
    await this.pipeline.loadImage(dataUrl);
  }

  getCanvasContainer() {
    return this.element.querySelector(`#canvas-container-${this.id}`);
  }

  showCanvas() {
    const img = this.element.querySelector(".viewer-image");
    const canvas = this.element.querySelector(`#canvas-container-${this.id}`);
    if (img) {
      img.style.display = "none";
      img.style.visibility = "hidden";
    }
    if (canvas) {
      canvas.style.display = "flex";
      canvas.style.visibility = "visible";
    }
  }

  showImage() {
    const img = this.element.querySelector(".viewer-image");
    const canvas = this.element.querySelector(`#canvas-container-${this.id}`);
    if (img) {
      img.style.display = "block";
      img.style.visibility = "visible";
    }
    if (canvas) {
      canvas.style.display = "none";
      canvas.style.visibility = "hidden";
    }
  }

  setDragHandle(handle) {
    this.dragHandle = handle;
  }

  addResizeHandle() {
    // Create resize handle element
    const handle = document.createElement("div");
    handle.className = "resize-handle";
    handle.innerHTML = "⋰";
    this.element.appendChild(handle);

    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    const startResize = (e) => {
      // Only allow resizing in full mode
      const isSimplified = document
        .querySelector(".canvas-container")
        .classList.contains("view-mode-simplified");
      if (isSimplified) return;

      isResizing = true;
      startX = e.clientX || e.touches[0].clientX;
      startY = e.clientY || e.touches[0].clientY;
      startWidth = this.element.offsetWidth;
      startHeight = this.element.offsetHeight;

      e.preventDefault();
      e.stopPropagation();
    };

    const resize = (e) => {
      if (!isResizing) return;

      const clientX = e.clientX || e.touches[0].clientX;
      const clientY = e.clientY || e.touches[0].clientY;

      const deltaX = clientX - startX;
      const deltaY = clientY - startY;

      const newWidth = Math.max(400, startWidth + deltaX);

      // Calculate minimum height based on content requirements
      // viewer-content min-height (450px) + viewer-bar height (~50px) + borders/padding
      const viewerBar = this.element.querySelector(".viewer-bar");
      const barHeight = viewerBar ? viewerBar.offsetHeight : 50;
      const contentMinHeight = 450; // From CSS .view-mode-full .viewer-content
      const minimumHeight = contentMinHeight + barHeight + 10; // +10 for borders/spacing

      const newHeight = Math.max(minimumHeight, startHeight + deltaY);

      this.element.style.setProperty("width", `${newWidth}px`, "important");
      this.element.style.setProperty("height", `${newHeight}px`, "important");

      // Update connections during resize
      this.stateManager.emit("connectionChanged");
    };

    const stopResize = () => {
      if (isResizing) {
        isResizing = false;
        // Final connection update
        this.stateManager.emit("connectionChanged");
      }
    };

    // Mouse events
    handle.addEventListener("mousedown", startResize);
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stopResize);

    // Touch events
    handle.addEventListener("touchstart", startResize);
    document.addEventListener("touchmove", resize);
    document.addEventListener("touchend", stopResize);
  }
}
