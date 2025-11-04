// Tool Registry - Centralized tool definitions
import { SmudgeTool } from "../tools/SmudgeTool.js";
import { InvertTool } from "../tools/InvertTool.js";
import { SlideshowTool } from "../tools/SlideshowTool.js";
import { InfoTool } from "../tools/InfoTool.js";
import { RagdollTool } from "../tools/RagdollTool.js";

export class ToolRegistry {
  static tools = new Map([
    [
      "info",
      {
        label: "INFO",
        class: InfoTool,
        description: "Display metadata information",
      },
    ],
    [
      "ragdoll",
      {
        label: "RAGDOLL",
        class: RagdollTool,
        description: "Physics-based ragdoll character",
      },
    ],
    [
      "invert",
      {
        label: "INVERT",
        class: InvertTool,
        description: "Invert image colors",
      },
    ],
    [
      "smudge",
      {
        label: "SMUDGE",
        class: SmudgeTool,
        description: "Interactive smudge painting effect",
      },
    ],
    [
      "slideshow",
      {
        label: "SLIDESHOW",
        class: SlideshowTool,
        description: "Auto-cycle through items",
      },
    ],
  ]);

  static get(toolType) {
    return this.tools.get(toolType);
  }

  static getAll() {
    return Array.from(this.tools.entries());
  }

  static createTool(toolType) {
    const toolDef = this.tools.get(toolType);
    if (!toolDef) {
      console.warn(`Unknown tool type: ${toolType}`);
      return null;
    }
    return new toolDef.class();
  }
}
