import { ToolRegistry } from "../config/ToolRegistry.js";
import { CONNECTION } from "../config/constants.js";

/**
 * ConnectionManager - Handles smooth curved SVG connections between nodes
 */
export class ConnectionManager {
  constructor(svg, stateManager, canvas, onToolEmblemClick) {
    this.svg = svg;
    this.stateManager = stateManager;
    this.canvas = canvas;
    this.onToolEmblemClick = onToolEmblemClick;
    this.paths = new Map(); // fromId -> path element
    this.emblems = new Map(); // fromId -> emblem element
    this.emblemHandlers = new Map(); // fromId -> array of handler references

    // Listen for connection changes
    stateManager.on("connectionChanged", () => this.updateAll());
    stateManager.on("nodeRemoved", ({ id }) => this.removePath(id));
  }

  updateAll() {
    const connections = this.stateManager.getConnections();

    // Use Set for O(1) lookup instead of O(n) find operations
    const activeConnectionIds = new Set(connections.map(([fromId]) => fromId));

    // Remove old paths not in current connections
    this.paths.forEach((path, fromId) => {
      if (!activeConnectionIds.has(fromId)) {
        path.remove();
        this.paths.delete(fromId);
      }
    });

    // Remove old emblems not in current connections
    this.emblems.forEach((emblem, fromId) => {
      if (!activeConnectionIds.has(fromId)) {
        emblem.remove();
        this.emblems.delete(fromId);
      }
    });

    // Update/create paths for current connections
    connections.forEach(([fromId, toId]) => {
      this.updateConnection(fromId, toId);
    });
  }

  updateConnection(fromId, toId) {
    const fromNode = this.stateManager.getNode(fromId);
    const toNode = this.stateManager.getNode(toId);

    if (!fromNode || !toNode) return;

    const fromPort = fromNode.getConnectionPort("output");
    const toPort = toNode.getConnectionPort("input");

    if (!fromPort || !toPort) return;

    // Check if nodes are currently transitioning (CSS animation in progress)
    const fromTransitioning =
      fromNode.element.classList.contains("mode-transitioning");
    const toTransitioning =
      toNode.element.classList.contains("mode-transitioning");
    const isTransitioning = fromTransitioning || toTransitioning;

    let x1, y1, x2, y2;

    if (isTransitioning) {
      // During transition: read actual rendered position from DOM
      // This syncs with CSS animations for smooth cable rendering
      const workspace = fromNode.element.parentElement;
      const workspaceRect = workspace.getBoundingClientRect();

      const fromRect = fromNode.element.getBoundingClientRect();
      const toRect = toNode.element.getBoundingClientRect();

      // Convert screen coordinates to workspace coordinates
      x1 = fromRect.left - workspaceRect.left + fromRect.width / 2;
      y1 = fromRect.bottom - workspaceRect.top;
      x2 = toRect.left - workspaceRect.left + toRect.width / 2;
      y2 = toRect.top - workspaceRect.top;
    } else {
      // Normal mode: use stored positions for performance
      const fromActualHeight = fromNode.element.offsetHeight;
      const fromActualWidth = fromNode.element.offsetWidth;
      const toActualWidth = toNode.element.offsetWidth;

      x1 = fromNode.x + fromActualWidth / 2;
      y1 = fromNode.y + fromActualHeight;
      x2 = toNode.x + toActualWidth / 2;
      y2 = toNode.y;
    }

    // Create smooth curve
    const distance = Math.abs(y2 - y1);
    const curve = Math.min(
      distance * CONNECTION.CURVE_FACTOR,
      CONNECTION.MAX_CURVE,
    );

    const path = `
      M ${x1} ${y1}
      C ${x1} ${y1 + curve}, ${x2} ${y2 - curve}, ${x2} ${y2}
    `;

    // Get or create path element
    let pathEl = this.paths.get(fromId);
    if (!pathEl) {
      pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
      pathEl.classList.add("connection");
      this.svg.appendChild(pathEl);
      this.paths.set(fromId, pathEl);
    }

    pathEl.setAttribute("d", path.trim());

    // Position tool emblem at midpoint
    this.updateEmblem(fromId, toId, x1, y1, x2, y2);
  }

  updateEmblem(fromId, toId, x1, y1, x2, y2) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    // Calculate cable length and only show emblem if cable is long enough
    const cableLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    // Get or create emblem element
    let emblem = this.emblems.get(fromId);
    if (!emblem) {
      emblem = document.createElement("div");
      emblem.className = "tool-emblem";

      // Build menu from ToolRegistry
      const toolOptions = ToolRegistry.getAll()
        .map(
          ([key, def]) =>
            `<div class="emblem-option" data-tool="${key}">${def.label}</div>`,
        )
        .join("");

      emblem.innerHTML = `
        <div class="emblem-trigger">+</div>
        <div class="emblem-menu">
          ${toolOptions}
        </div>
      `;
      // Append to workspace so it inherits transform
      this.canvas.getWorkspace().appendChild(emblem);
      this.emblems.set(fromId, emblem);

      // Store handlers for cleanup
      const handlers = [];

      // Add click handlers with stored references
      emblem.querySelectorAll(".emblem-option").forEach((option) => {
        const handler = (e) => {
          e.stopPropagation();
          const tool = option.dataset.tool;
          if (this.onToolEmblemClick) {
            this.onToolEmblemClick(tool, fromId, toId);
          }
        };
        option.addEventListener("click", handler);
        handlers.push({ element: option, handler });
      });

      this.emblemHandlers.set(fromId, handlers);
    }

    // Position emblem at midpoint in workspace coordinates
    // No need to convert to screen coords since it's now inside workspace
    emblem.style.position = "absolute";
    emblem.style.left = `${midX - CONNECTION.EMBLEM_OFFSET}px`;
    emblem.style.top = `${midY - CONNECTION.EMBLEM_OFFSET}px`;
    emblem.style.zIndex = "100";

    // Hide emblem if cable is too short
    emblem.style.display =
      cableLength < CONNECTION.MIN_LENGTH_FOR_EMBLEM ? "none" : "block";
  }

  removePath(fromId) {
    const path = this.paths.get(fromId);
    if (path) {
      path.remove();
      this.paths.delete(fromId);
    }

    // Clean up emblem event listeners before removing
    const handlers = this.emblemHandlers.get(fromId);
    if (handlers) {
      handlers.forEach(({ element, handler }) => {
        element.removeEventListener("click", handler);
      });
      this.emblemHandlers.delete(fromId);
    }

    const emblem = this.emblems.get(fromId);
    if (emblem) {
      emblem.remove();
      this.emblems.delete(fromId);
    }
  }
}
