/**
 * ViewMode - Manages simplified vs full node editing modes
 * Simplified: Work browser + viewer only, no panning, clean layout
 * Full: All nodes, panning, tools, filters
 *
 * IMPORTANT: Both modes use position: absolute for smooth transitions
 */
export class ViewMode {
  constructor(stateManager, canvas) {
    this.stateManager = stateManager;
    this.canvas = canvas;
    this.mode = "simplified";
    this.toggleButton = null;
    this.browserResizeObserver = null;

    // Define fixed positions for each mode
    this.positions = {
      simplified: {
        browser: { x: 0, y: 20, width: 0 }, // x and width calculated on resize
        viewer: { x: 0, y: 0, width: 0 }, // y calculated based on browser height
      },
      full: {
        browser: { x: 0, y: 100, width: 375 }, // x calculated to center
        viewer: { x: 0, y: 400, width: 700, height: 450 }, // x calculated to center, preserve height
      },
    };

    this.createToggleButton();
    this.calculatePositions();

    // Recalculate on resize
    window.addEventListener("resize", () => {
      this.calculatePositions();
      if (this.mode === "simplified") {
        this.applySimplifiedPositions();
        // Reposition toggle button at connection after resize
        setTimeout(() => this.positionToggleButtonAtConnection(), 100);
      }
    });

    // Update toggle button position on scroll in simplified mode
    window.addEventListener("scroll", () => {
      if (this.mode === "simplified") {
        this.positionToggleButtonAtConnection();
      }
    });
  }

  calculatePositions() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 20;
    const gap = 20;
    const centerX = viewportWidth / 2;

    // Simplified mode: full width with padding, but max 840px for desktop (30% smaller than 1200px)
    const maxSimplifiedWidth = 840;
    const simplifiedWidth = Math.min(
      viewportWidth - padding * 2,
      maxSimplifiedWidth,
    );

    // Center nodes horizontally if viewport is wider than max width
    const simplifiedX =
      viewportWidth > maxSimplifiedWidth + padding * 2
        ? (viewportWidth - simplifiedWidth) / 2
        : padding;

    this.positions.simplified.browser.x = simplifiedX;
    this.positions.simplified.browser.y = padding;
    this.positions.simplified.browser.width = simplifiedWidth;

    // Viewer Y depends on browser height (calculated when applying)
    this.positions.simplified.viewer.x = simplifiedX;
    this.positions.simplified.viewer.width = simplifiedWidth;

    // Full mode: centered with fixed widths, increased spacing for + icon visibility
    this.positions.full.browser.x =
      centerX - this.positions.full.browser.width / 2;
    this.positions.full.browser.y = 100;

    this.positions.full.viewer.x =
      centerX - this.positions.full.viewer.width / 2;
    this.positions.full.viewer.y = 500; // Increased from 400 for better + icon visibility
  }

  createToggleButton() {
    this.toggleButton = document.createElement("button");
    this.toggleButton.className = "view-mode-toggle";
    this.toggleButton.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path class="chain-icon" d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" style="display: none;"/>
        <path class="chain-icon" d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" style="display: none;"/>
        <path class="broken-chain-icon" d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path class="broken-chain-icon" d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        <line class="broken-chain-icon" x1="8" y1="8" x2="10" y2="10" stroke-width="3"/>
        <line class="broken-chain-icon" x1="14" y1="14" x2="16" y2="16" stroke-width="3"/>
      </svg>
    `;
    this.toggleButton.title = "Toggle full editing mode";
    this.toggleButton.onclick = () => this.toggle();
    document.body.appendChild(this.toggleButton);
  }

  applyModeImmediate() {
    // Apply initial mode without transition animations
    this.applyMode();
    this.setupBrowserHeightObserver();
  }

  toggle() {
    const nodes = Array.from(this.stateManager.state.nodes.values());
    const workBrowser = nodes.find((n) =>
      n.element?.classList.contains("work-browser"),
    );
    const viewer = nodes.find((n) =>
      n.element?.classList.contains("viewer-node"),
    );

    if (!workBrowser || !viewer) return;

    // Save current viewer dimensions when leaving simplified mode
    if (this.mode === "simplified") {
      const currentWidth = viewer.element.offsetWidth;
      const currentHeight = viewer.element.offsetHeight;
      this.positions.full.viewer.width = currentWidth;
      this.positions.full.viewer.height = currentHeight;

      // CRITICAL: Recalculate positions with new dimensions
      this.calculatePositions();
    }

    // Add transition class
    workBrowser.element.classList.add("mode-transitioning");
    viewer.element.classList.add("mode-transitioning");

    // Switch mode
    this.mode = this.mode === "simplified" ? "full" : "simplified";
    this.applyMode();

    // Smooth cable updates during transition using requestAnimationFrame
    this.animateCablesDuringTransition();

    // Remove transition class and update final positions after animation
    setTimeout(() => {
      workBrowser.element.classList.remove("mode-transitioning");
      viewer.element.classList.remove("mode-transitioning");

      // Now update node.x/y to final values for future cable calculations
      if (this.mode === "simplified") {
        const bPos = this.positions.simplified.browser;
        const vPos = this.positions.simplified.viewer;
        workBrowser.x = bPos.x;
        workBrowser.y = bPos.y;
        viewer.x = vPos.x;
        viewer.y = vPos.y;
      } else {
        const bPos = this.positions.full.browser;
        const vPos = this.positions.full.viewer;
        workBrowser.x = bPos.x;
        workBrowser.y = bPos.y;
        viewer.x = vPos.x;
        viewer.y = vPos.y;
      }

      // Final connection update with accurate positions
      this.stateManager.emit("connectionChanged");
    }, 550);
  }

  applyMode() {
    const workspace = document.querySelector(".canvas-container");
    const workspaceEl = this.canvas.getWorkspace();
    const homeBtn = document.querySelector(".home-btn");

    if (this.mode === "simplified") {
      // Simplified mode setup
      workspace.classList.add("view-mode-simplified");
      workspace.classList.remove("view-mode-full");

      this.canvas.disablePanning();
      this.canvas.resetTransform();

      if (homeBtn) homeBtn.style.display = "none";

      this.removeToolNodes();
      this.applySimplifiedPositions();
      this.disableNodeDragging();
      this.positionToggleButtonAtConnection();

      this.updateToggleIcon(false);
      this.toggleButton.title = "Enable full editing mode";
    } else {
      // Full mode setup
      workspace.classList.remove("view-mode-simplified");
      workspace.classList.add("view-mode-full");

      this.canvas.enablePanning();

      if (homeBtn) homeBtn.style.display = "flex";

      this.applyFullPositions();
      this.enableNodeDragging();
      this.resetToggleButtonPosition();

      this.updateToggleIcon(true);
      this.toggleButton.title = "Return to simplified view";
    }
  }

  positionToggleButtonAtConnection() {
    // Position toggle button at the connection point between work and viewer nodes
    const nodes = Array.from(this.stateManager.state.nodes.values());
    const workBrowser = nodes.find((n) =>
      n.element?.classList.contains("work-browser"),
    );
    const viewer = nodes.find((n) =>
      n.element?.classList.contains("viewer-node"),
    );

    if (!workBrowser || !viewer) return;

    // Calculate connection point (bottom center of work browser)
    const browserRect = workBrowser.element.getBoundingClientRect();
    const connectionX = browserRect.left + browserRect.width / 2;
    const connectionY = browserRect.bottom;

    // Use actual button dimensions for centering
    const buttonWidth = this.toggleButton.offsetWidth || 36;
    const buttonHeight = this.toggleButton.offsetHeight || 36;

    // Position toggle button at connection point
    this.toggleButton.style.position = "fixed";
    this.toggleButton.style.left = `${connectionX - buttonWidth / 2}px`;
    this.toggleButton.style.top = `${connectionY - buttonHeight / 2}px`;
    this.toggleButton.style.bottom = "auto";
  }

  resetToggleButtonPosition() {
    // Reset to bottom-left corner for full mode
    this.toggleButton.style.position = "fixed";
    this.toggleButton.style.left = "20px";
    this.toggleButton.style.top = "auto";
    this.toggleButton.style.bottom = "20px";
  }

  removeToolNodes() {
    const nodes = Array.from(this.stateManager.state.nodes.values());
    nodes.forEach((node) => {
      if (node.element) {
        const isWorkBrowser = node.element.classList.contains("work-browser");
        const isViewer = node.element.classList.contains("viewer-node");
        if (!isWorkBrowser && !isViewer && node.remove) {
          node.remove();
        }
      }
    });
  }

  applySimplifiedPositions() {
    const nodes = Array.from(this.stateManager.state.nodes.values());
    const workBrowser = nodes.find((n) =>
      n.element?.classList.contains("work-browser"),
    );
    const viewer = nodes.find((n) =>
      n.element?.classList.contains("viewer-node"),
    );

    if (!workBrowser || !viewer) return;

    const padding = 20;
    const gap = 20;

    // Both nodes use position: absolute
    const bPos = this.positions.simplified.browser;
    const vPos = this.positions.simplified.viewer;

    // Apply browser position via CSS (will animate if transition class present)
    workBrowser.element.style.position = "absolute";
    workBrowser.element.style.left = `${bPos.x}px`;
    workBrowser.element.style.top = `${bPos.y}px`;
    workBrowser.element.style.width = `${bPos.width}px`;
    workBrowser.element.style.margin = "0";

    // Calculate viewer Y based on browser height
    const browserHeight = workBrowser.element.offsetHeight;
    vPos.y = bPos.y + browserHeight + gap;

    // Apply viewer position via CSS (will animate if transition class present)
    viewer.element.style.position = "absolute";
    viewer.element.style.left = `${vPos.x}px`;
    viewer.element.style.top = `${vPos.y}px`;
    viewer.element.style.setProperty("width", `${vPos.width}px`, "important");
    viewer.element.style.margin = "0";

    // Only update node.x/y if NOT transitioning (ConnectionManager reads from DOM during transitions)
    if (!workBrowser.element.classList.contains("mode-transitioning")) {
      workBrowser.x = bPos.x;
      workBrowser.y = bPos.y;
      viewer.x = vPos.x;
      viewer.y = vPos.y;
    }

    // Update connections with animation frame for smooth rendering
    requestAnimationFrame(() => {
      this.stateManager.emit("connectionChanged");
    });
  }

  applyFullPositions() {
    const nodes = Array.from(this.stateManager.state.nodes.values());
    const workBrowser = nodes.find((n) =>
      n.element?.classList.contains("work-browser"),
    );
    const viewer = nodes.find((n) =>
      n.element?.classList.contains("viewer-node"),
    );

    if (!workBrowser || !viewer) return;

    const bPos = this.positions.full.browser;
    const vPos = this.positions.full.viewer;

    // Apply browser position via CSS (will animate if transition class present)
    workBrowser.element.style.position = "absolute";
    workBrowser.element.style.left = `${bPos.x}px`;
    workBrowser.element.style.top = `${bPos.y}px`;
    workBrowser.element.style.width = `${bPos.width}px`;
    workBrowser.element.style.margin = "0";

    // Apply viewer position and width (let height be natural)
    viewer.element.style.position = "absolute";
    viewer.element.style.left = `${vPos.x}px`;
    viewer.element.style.top = `${vPos.y}px`;
    viewer.element.style.setProperty("width", `${vPos.width}px`, "important");
    viewer.element.style.height = ""; // Clear any explicit height, use natural height
    viewer.element.style.margin = "0";

    // Only update node.x/y if NOT transitioning (ConnectionManager reads from DOM during transitions)
    if (!workBrowser.element.classList.contains("mode-transitioning")) {
      workBrowser.x = bPos.x;
      workBrowser.y = bPos.y;
      viewer.x = vPos.x;
      viewer.y = vPos.y;
    }
  }

  disableNodeDragging() {
    const nodes = Array.from(this.stateManager.state.nodes.values());
    nodes.forEach((node) => {
      if (node.dragHandler) {
        node.dragHandler.disable();
        node.element.style.cursor = "default";
      }
    });
  }

  enableNodeDragging() {
    const nodes = Array.from(this.stateManager.state.nodes.values());
    nodes.forEach((node) => {
      if (node.dragHandler) {
        node.dragHandler.enable();
        node.element.style.cursor = "grab";
      }
    });
  }

  updateToggleIcon(showChain) {
    const chainIcons = this.toggleButton.querySelectorAll(".chain-icon");
    const brokenChainIcons =
      this.toggleButton.querySelectorAll(".broken-chain-icon");

    chainIcons.forEach(
      (icon) => (icon.style.display = showChain ? "block" : "none"),
    );
    brokenChainIcons.forEach(
      (icon) => (icon.style.display = showChain ? "none" : "block"),
    );
  }

  isSimplified() {
    return this.mode === "simplified";
  }

  setupBrowserHeightObserver() {
    const nodes = Array.from(this.stateManager.state.nodes.values());
    const workBrowser = nodes.find((n) =>
      n.element?.classList.contains("work-browser"),
    );
    const viewer = nodes.find((n) =>
      n.element?.classList.contains("viewer-node"),
    );

    if (!workBrowser) return;

    // Use ResizeObserver to watch for height changes in browser node
    this.browserResizeObserver = new ResizeObserver(() => {
      if (this.mode === "simplified") {
        this.applySimplifiedPositions();
        // Reposition toggle button when nodes change size
        this.positionToggleButtonAtConnection();
      }
    });

    this.browserResizeObserver.observe(workBrowser.element);

    // Also observe viewer node for aspect ratio changes
    if (viewer) {
      this.browserResizeObserver.observe(viewer.element);
    }
  }

  animateCablesDuringTransition() {
    // Use requestAnimationFrame to smoothly update cables during CSS transition
    const duration = 550; // Match CSS transition duration
    const startTime = performance.now();
    const fps = 60;
    const frameInterval = 1000 / fps;
    let lastFrameTime = startTime;

    const updateFrame = (currentTime) => {
      const elapsed = currentTime - startTime;

      // Only update at desired FPS to reduce choppiness
      if (currentTime - lastFrameTime >= frameInterval) {
        this.stateManager.emit("connectionChanged");
        lastFrameTime = currentTime;
      }

      // Continue animation until duration completes
      if (elapsed < duration) {
        requestAnimationFrame(updateFrame);
      } else {
        // Final update to ensure accurate positioning
        this.stateManager.emit("connectionChanged");
      }
    };

    requestAnimationFrame(updateFrame);
  }

  destroy() {
    if (this.browserResizeObserver) {
      this.browserResizeObserver.disconnect();
    }
  }
}
