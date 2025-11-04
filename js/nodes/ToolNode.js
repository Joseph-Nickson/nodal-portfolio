import { Node } from "../core/Node.js";

// ToolNode - Container for tools (filter, invert, slideshow, info)
export class ToolNode extends Node {
  constructor(id, stateManager, toolType, options = {}) {
    // Smaller size for tool nodes
    super(id, stateManager, {
      ...options,
      closeable: true,
      width: 140,
      height: 60,
    });
    this.toolType = toolType;
    this.tool = null;
    this.onRemoveCallback = options.onRemoveCallback || null;

    this.render();
  }

  render() {
    const labels = {
      smudge: "SMUDGE",
      info: "PRINT INFO",
      invert: "INVERT",
      slideshow: "SLIDESHOW",
    };

    this.setContent(`
      <div class="tool-label">${labels[this.toolType] || this.toolType.toUpperCase()}</div>
    `);
  }

  setTool(tool) {
    this.tool = tool;
  }

  activate(viewerNode) {
    if (this.tool && this.tool.activate) {
      this.tool.activate(viewerNode);
    }
  }

  deactivate(viewerNode) {
    if (this.tool && this.tool.deactivate) {
      this.tool.deactivate(viewerNode);
    }
  }

  remove() {
    // Call the callback to handle reconnection logic before removing
    if (this.onRemoveCallback) {
      this.onRemoveCallback(this.id);
    }

    // Deactivate tool before removing
    if (this.tool && this.tool.cleanup) {
      this.tool.cleanup();
    }
    super.remove();
  }
}
