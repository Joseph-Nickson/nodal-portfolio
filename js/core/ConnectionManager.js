// ConnectionManager - Handles smooth curved SVG connections between nodes
import { ToolRegistry } from "../config/ToolRegistry.js";

export class ConnectionManager {
  constructor(svg, stateManager, canvas, onToolEmblemClick) {
    this.svg = svg;
    this.stateManager = stateManager;
    this.canvas = canvas;
    this.onToolEmblemClick = onToolEmblemClick;
    this.paths = new Map(); // fromId -> path element
    this.emblems = new Map(); // fromId -> emblem element

    // Listen for connection changes
    stateManager.on("connectionChanged", () => this.updateAll());
    stateManager.on("nodeRemoved", ({ id }) => this.removePath(id));
  }

  updateAll() {
    const connections = this.stateManager.getConnections();

    // Remove old paths not in current connections
    this.paths.forEach((path, fromId) => {
      if (!connections.find(([fid]) => fid === fromId)) {
        path.remove();
        this.paths.delete(fromId);
      }
    });

    // Remove old emblems not in current connections
    this.emblems.forEach((emblem, fromId) => {
      if (!connections.find(([fid]) => fid === fromId)) {
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

    // Get port positions relative to the workspace (not screen)
    // Since SVG is now inside workspace, use node positions directly
    // Need to use actual DOM height, not node.height (which is just min-height)
    const fromActualHeight = fromNode.element.offsetHeight;
    const toActualHeight = toNode.element.offsetHeight;

    // Output port: 10px circle at bottom: -5px
    // Center of port is at y + height (5px below bottom edge, 5px of radius above that = at the edge)
    // Input port: 10px circle at top: -5px
    // Center of port is at y (5px above top edge, 5px of radius below that = at the edge)

    const x1 = fromNode.x + fromNode.width / 2;
    const y1 = fromNode.y + fromActualHeight; // Connect to center of output port
    const x2 = toNode.x + toNode.width / 2;
    const y2 = toNode.y; // Connect to center of input port

    // Create smooth curve
    const distance = Math.abs(y2 - y1);
    const curve = Math.min(distance * 0.3, 50);

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

    // Calculate cable length
    const cableLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const minCableLengthForEmblem = 100; // Only show + if cable is at least 100px long

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

      // Add click handlers
      emblem.querySelectorAll(".emblem-option").forEach((option) => {
        option.addEventListener("click", (e) => {
          e.stopPropagation();
          const tool = option.dataset.tool;
          if (this.onToolEmblemClick) {
            this.onToolEmblemClick(tool, fromId, toId);
          }
        });
      });
    }

    // Position emblem at midpoint in workspace coordinates
    // No need to convert to screen coords since it's now inside workspace
    emblem.style.position = "absolute";
    emblem.style.left = `${midX - 20}px`;
    emblem.style.top = `${midY - 20}px`;
    emblem.style.zIndex = "100";

    // Hide emblem if cable is too short
    if (cableLength < minCableLengthForEmblem) {
      emblem.style.display = "none";
    } else {
      emblem.style.display = "block";
    }
  }

  removePath(fromId) {
    const path = this.paths.get(fromId);
    if (path) {
      path.remove();
      this.paths.delete(fromId);
    }

    const emblem = this.emblems.get(fromId);
    if (emblem) {
      emblem.remove();
      this.emblems.delete(fromId);
    }
  }
}
