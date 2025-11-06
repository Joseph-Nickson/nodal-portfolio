import { StateManager } from "./core/StateManager.js";
import { ConnectionManager } from "./core/ConnectionManager.js";
import { Canvas } from "./core/Canvas.js";
import { ViewMode } from "./core/ViewMode.js";
import { WorkNode } from "./nodes/WorkNode.js";
import { ViewerNode } from "./nodes/ViewerNode.js";
import { ToolNode } from "./nodes/ToolNode.js";
import { ToolRegistry } from "./config/ToolRegistry.js";
import { SmudgeTool } from "./tools/SmudgeTool.js";
import { LAYOUT } from "./config/constants.js";

// Main application entry point
class PortfolioApp {
  constructor() {
    this.stateManager = new StateManager();
    this.toolNodes = new Map(); // Track tool nodes by their ID
    this.toolNodeCounter = 0; // Counter for unique tool node IDs
    this.init();
  }

  async init() {
    // Load manifest data
    await this.stateManager.loadManifest();

    // Setup canvas with pan/zoom first
    const container = document.getElementById("app");
    this.canvas = new Canvas(container, null);

    // Setup connection manager with emblem click handler (use SVG from canvas)
    this.connectionManager = new ConnectionManager(
      this.canvas.getSVG(),
      this.stateManager,
      this.canvas,
      (tool, fromId, toId) => this.handleToolEmblemClick(tool, fromId, toId),
    );

    // Set connection manager in canvas
    this.canvas.connectionManager = this.connectionManager;

    // Create ViewMode BEFORE nodes to prevent flash on initial load
    this.viewMode = new ViewMode(this.stateManager, this.canvas);

    // Create initial nodes (will be positioned correctly from start)
    this.createInitialSetup();

    // Apply initial simplified mode immediately (no transition animation)
    this.viewMode.applyModeImmediate();

    // Setup home button
    this.setupHomeButton();
  }

  setupHomeButton() {
    const homeBtn = document.getElementById("home-btn");
    if (homeBtn) {
      homeBtn.addEventListener("click", () => {
        this.canvas.frameAllNodes();
      });
    }

    const helpBtn = document.getElementById("help-btn");
    const rejectionMsg = document.getElementById("rejection-message");
    if (helpBtn && rejectionMsg) {
      helpBtn.addEventListener("click", () => {
        rejectionMsg.classList.add("show");
        setTimeout(() => {
          rejectionMsg.classList.remove("show");
        }, 2000);
      });
    }
  }

  createInitialSetup() {
    // Create Work node (entry point) - not closeable since it's the main navigation
    const workNode = new WorkNode("work", this.stateManager, {
      x: window.innerWidth / 2 - 125,
      y: 100,
      closeable: false,
    });
    this.canvas.addNode(workNode);

    // Create Viewer node
    this.viewerNode = new ViewerNode("viewer", this.stateManager, {
      x: window.innerWidth / 2 - 300,
      y: 400,
    });
    this.canvas.addNode(this.viewerNode);

    // Connect work to viewer
    this.stateManager.connectNodes("work", "viewer");

    // Listen for item selection to update tool if active
    this.stateManager.on("itemSelected", (item) => {
      this.toolNodes.forEach((toolNode) => {
        if (toolNode.tool instanceof SmudgeTool) {
          toolNode.tool.loadNewImage(item.path);
        }
      });
    });
  }

  checkAndResolveOverlaps(newNode) {
    // Get all nodes except the new one
    const allNodes = Array.from(this.stateManager.state.nodes.values());
    const otherNodes = allNodes.filter((node) => node.id !== newNode.id);

    // Get new node bounds
    const newBounds = {
      x: newNode.x,
      y: newNode.y,
      width: newNode.element.offsetWidth,
      height: newNode.element.offsetHeight,
    };

    // Check for overlaps and collect overlapping nodes
    const overlapping = otherNodes.filter((node) => {
      const bounds = {
        x: node.x,
        y: node.y,
        width: node.element.offsetWidth,
        height: node.element.offsetHeight,
      };

      return !(
        newBounds.x + newBounds.width + LAYOUT.OVERLAP_PADDING < bounds.x ||
        newBounds.x > bounds.x + bounds.width + LAYOUT.OVERLAP_PADDING ||
        newBounds.y + newBounds.height + LAYOUT.OVERLAP_PADDING < bounds.y ||
        newBounds.y > bounds.y + bounds.height + LAYOUT.OVERLAP_PADDING
      );
    });

    if (overlapping.length > 0) {
      // Calculate center of new node
      const newCenterX = newBounds.x + newBounds.width / 2;
      const newCenterY = newBounds.y + newBounds.height / 2;

      // Push overlapping nodes away
      overlapping.forEach((node) => {
        const nodeCenterX = node.x + node.element.offsetWidth / 2;
        const nodeCenterY = node.y + node.element.offsetHeight / 2;

        // Calculate push direction (away from new node)
        const dx = nodeCenterX - newCenterX;
        const dy = nodeCenterY - newCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1; // Avoid division by zero

        // Normalize and scale push distance
        const pushX = (dx / distance) * LAYOUT.OVERLAP_PUSH_DISTANCE;
        const pushY = (dy / distance) * LAYOUT.OVERLAP_PUSH_DISTANCE;

        // Calculate new position
        const newX = node.x + pushX;
        const newY = node.y + pushY;

        // Animate the spread using CSS transition
        node.element.style.transition = `left ${LAYOUT.OVERLAP_ANIMATION_DURATION}ms ease-out, top ${LAYOUT.OVERLAP_ANIMATION_DURATION}ms ease-out`;
        node.element.style.left = `${newX}px`;
        node.element.style.top = `${newY}px`;

        // Update stored position
        node.x = newX;
        node.y = newY;

        // Remove transition after animation completes
        setTimeout(() => {
          node.element.style.transition = "";
        }, LAYOUT.OVERLAP_ANIMATION_DURATION);
      });

      // Trigger connection update after nodes move
      setTimeout(() => {
        this.stateManager.emit("connectionChanged");
      }, 50);
    }
  }

  handleToolNodeRemoval(toolNodeId) {
    const toolNode = this.toolNodes.get(toolNodeId);

    if (!toolNode) return;

    // Find what this tool is connected to
    const connections = this.stateManager.getConnections();
    let fromId = null;
    let toId = null;

    // Find incoming connection (something -> this tool)
    connections.forEach(([fid, tid]) => {
      if (tid === toolNodeId) {
        fromId = fid;
      }
      if (fid === toolNodeId) {
        toId = tid;
      }
    });

    // Remove tool from pipeline by node ID
    if (toolNode.tool) {
      const pipeline = this.viewerNode.getPipeline();
      pipeline.removeTool(toolNodeId);
      toolNode.deactivate(this.viewerNode);
    }

    // Remove from canvas tracking
    this.canvas.removeNode(toolNode);
    this.toolNodes.delete(toolNodeId);

    // Reconnect: from -> to (bypass this tool)
    if (fromId) this.stateManager.disconnectNodes(fromId);
    this.stateManager.disconnectNodes(toolNodeId);
    if (fromId && toId) {
      this.stateManager.connectNodes(fromId, toId);
    }
  }

  handleToolEmblemClick(toolType, fromId, toId) {
    // Always insert a new tool node between fromId and toId
    const fromNode = this.stateManager.getNode(fromId);
    const toNode = this.stateManager.getNode(toId);

    if (!fromNode || !toNode) return;

    // Create unique ID for this tool node
    const toolNodeId = `tool-${this.toolNodeCounter++}`;

    // Calculate actual connection endpoints (same as ConnectionManager does)
    const fromActualWidth = fromNode.element.offsetWidth;
    const fromActualHeight = fromNode.element.offsetHeight;
    const toActualWidth = toNode.element.offsetWidth;
    const toActualHeight = toNode.element.offsetHeight;

    // Connection goes from center-bottom of fromNode to center-top of toNode
    const x1 = fromNode.x + fromActualWidth / 2;
    const y1 = fromNode.y + fromActualHeight;
    const x2 = toNode.x + toActualWidth / 2;
    const y2 = toNode.y;

    // Position tool node at exact cable midpoint (where + emblem is)
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const toolWidth = 140;
    const toolHeight = 60;

    const toolNode = new ToolNode(toolNodeId, this.stateManager, toolType, {
      x: midX - toolWidth / 2,
      y: midY - toolHeight / 2,
      onRemoveCallback: (id) => this.handleToolNodeRemoval(id),
    });

    this.canvas.addNode(toolNode);

    // Check for overlaps and spread nodes if needed
    this.checkAndResolveOverlaps(toolNode);

    // Setup tool using registry
    const tool = ToolRegistry.createTool(toolType);

    if (tool) {
      toolNode.setTool(tool);
      toolNode.activate(this.viewerNode);

      // Add tool to the viewer's render pipeline with its node ID
      const pipeline = this.viewerNode.getPipeline();
      pipeline.addTool(tool, toolNodeId);

      // If there's a current item, load it into the pipeline
      if (this.viewerNode.currentItem) {
        pipeline.loadImage(this.viewerNode.currentItem.path);
      }
    }

    this.toolNodes.set(toolNodeId, toolNode);

    // Update connections: fromId -> tool -> toId
    // We need to replace the connection fromId->toId with fromId->tool->toId
    // But disconnectNodes(fromId) would remove ALL of fromId's connections
    // So we check if there are other downstream connections first

    const currentConnection = this.stateManager
      .getConnections()
      .find(([from]) => from === fromId);

    // Disconnect only the fromId connection
    this.stateManager.disconnectNodes(fromId);

    // Create new connections: fromId -> toolNode -> toId
    this.stateManager.connectNodes(fromId, toolNodeId);
    this.stateManager.connectNodes(toolNodeId, toId);
  }
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.app = new PortfolioApp();
});
