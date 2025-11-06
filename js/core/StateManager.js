import { EventEmitter } from "../utils/EventEmitter.js";

/**
 * StateManager - Single source of truth with event system
 * Extends EventEmitter for consistent event handling
 */
export class StateManager extends EventEmitter {
  constructor() {
    super();
    this.state = {
      nodes: new Map(), // id -> node instance
      connections: new Map(), // fromId -> toId
      selectedItem: null,
      manifest: null,
    };
  }

  // State mutations
  addNode(id, node) {
    this.state.nodes.set(id, node);
    this.emit("nodeAdded", { id, node });
  }

  removeNode(id) {
    const node = this.state.nodes.get(id);
    this.state.nodes.delete(id);
    // Remove connections involving this node
    this.state.connections.forEach((toId, fromId) => {
      if (fromId === id || toId === id) {
        this.state.connections.delete(fromId);
      }
    });
    this.emit("nodeRemoved", { id, node });
  }

  connectNodes(fromId, toId) {
    this.state.connections.set(fromId, toId);
    this.emit("connectionChanged");
  }

  disconnectNodes(fromId) {
    this.state.connections.delete(fromId);
    this.emit("connectionChanged");
  }

  selectItem(item) {
    this.state.selectedItem = item;
    this.emit("itemSelected", item);
  }

  async loadManifest() {
    try {
      const response = await fetch("works_manifest.json");
      this.state.manifest = await response.json();
      this.emit("manifestLoaded", this.state.manifest);
      return this.state.manifest;
    } catch (error) {
      // Silently fail and return empty manifest - error logged in pipeline
      this.state.manifest = { painting: [], film: [], audio: [], other: [] };
      return this.state.manifest;
    }
  }

  getNode(id) {
    return this.state.nodes.get(id);
  }

  getConnections() {
    return Array.from(this.state.connections.entries());
  }
}
