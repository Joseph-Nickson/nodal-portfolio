// StateManager - Single source of truth with event system
export class StateManager {
  constructor() {
    this.state = {
      nodes: new Map(), // id -> node instance
      connections: new Map(), // fromId -> toId
      selectedItem: null,
      manifest: null
    };
    this.listeners = new Map();
  }

  // Event system
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  // State mutations
  addNode(id, node) {
    this.state.nodes.set(id, node);
    this.emit('nodeAdded', { id, node });
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
    this.emit('nodeRemoved', { id, node });
  }

  connectNodes(fromId, toId) {
    this.state.connections.set(fromId, toId);
    this.emit('connectionChanged');
  }

  disconnectNodes(fromId) {
    this.state.connections.delete(fromId);
    this.emit('connectionChanged');
  }

  selectItem(item) {
    this.state.selectedItem = item;
    this.emit('itemSelected', item);
  }

  async loadManifest() {
    try {
      const response = await fetch('works_manifest.json');
      this.state.manifest = await response.json();
      this.emit('manifestLoaded', this.state.manifest);
      return this.state.manifest;
    } catch (error) {
      console.error('Failed to load manifest:', error);
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
