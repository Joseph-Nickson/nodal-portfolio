import { StateManager } from "./core/StateManager.js";
import { ConnectionManager } from "./core/ConnectionManager.js";
import { Canvas } from "./core/Canvas.js";
import { WorkNode } from "./nodes/WorkNode.js";
import { ViewerNode } from "./nodes/ViewerNode.js";
import { ToolNode } from "./nodes/ToolNode.js";
import { ToolRegistry } from "./config/ToolRegistry.js";
import { SmudgeTool } from "./tools/SmudgeTool.js";

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

    // Create initial nodes
    this.createInitialSetup();

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

    // Remove tool from pipeline
    if (toolNode.tool) {
      const pipeline = this.viewerNode.getPipeline();
      pipeline.removeTool(toolNode.tool);
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
    // Check if clicking on a connection that goes TO a tool node
    // If so, remove that tool node
    if (this.toolNodes.has(toId)) {
      const existingToolNode = this.toolNodes.get(toId);

      // Find what the tool is connected to
      const connections = this.stateManager.getConnections();
      let nextNodeId = null;
      connections.forEach(([fid, tid]) => {
        if (fid === toId) {
          nextNodeId = tid;
        }
      });

      // Remove tool from pipeline and deactivate
      if (existingToolNode.tool) {
        const pipeline = this.viewerNode.getPipeline();
        pipeline.removeTool(existingToolNode.tool);
        existingToolNode.deactivate(this.viewerNode);
      }

      // Remove from canvas
      this.canvas.removeNode(existingToolNode);
      existingToolNode.remove();
      this.toolNodes.delete(toId);

      // Reconnect directly: fromId -> nextNode (bypass the tool)
      this.stateManager.disconnectNodes(fromId);
      this.stateManager.disconnectNodes(toId);
      if (nextNodeId) {
        this.stateManager.connectNodes(fromId, nextNodeId);
      }
      return;
    }

    // No existing tool, create new one
    const fromNode = this.stateManager.getNode(fromId);
    const toNode = this.stateManager.getNode(toId);

    if (!fromNode || !toNode) return;

    // Create unique ID for this tool node
    const toolNodeId = `tool-${this.toolNodeCounter++}`;

    // Position tool node at cable midpoint (where + emblem is)
    const midX = (fromNode.x + toNode.x) / 2;
    const midY = (fromNode.y + toNode.y) / 2;
    const toolWidth = 140;
    const toolHeight = 60;

    const toolNode = new ToolNode(toolNodeId, this.stateManager, toolType, {
      x: midX - toolWidth / 2,
      y: midY - toolHeight / 2,
      onRemoveCallback: (id) => this.handleToolNodeRemoval(id),
    });

    this.canvas.addNode(toolNode);

    // Setup tool using registry
    const tool = ToolRegistry.createTool(toolType);

    if (tool) {
      toolNode.setTool(tool);
      toolNode.activate(this.viewerNode);

      // Add tool to the viewer's render pipeline
      const pipeline = this.viewerNode.getPipeline();
      pipeline.addTool(tool);

      // If there's a current item, load it into the pipeline
      if (this.viewerNode.currentItem) {
        pipeline.loadImage(this.viewerNode.currentItem.path);
      }
    }

    this.toolNodes.set(toolNodeId, toolNode);

    // Update connections: fromId -> tool -> toId
    // Only disconnect the specific connection fromId -> toId
    this.stateManager.disconnectNodes(fromId);
    this.stateManager.connectNodes(fromId, toolNodeId);
    this.stateManager.connectNodes(toolNodeId, toId);

    // Note: toId's outgoing connections are preserved automatically
    // since they're keyed by toId in the connections Map
  }
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.app = new PortfolioApp();
});
