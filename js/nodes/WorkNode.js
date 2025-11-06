import { Node } from "../core/Node.js";
import { NODES } from "../config/constants.js";

/**
 * WorkNode - Hierarchical navigation: Root → Categories → Items
 */
export class WorkNode extends Node {
  constructor(id, stateManager, options = {}) {
    super(id, stateManager, {
      width: NODES.WORK.WIDTH,
      showInputPort: false,
      closeable: true,
      ...options,
    });
    this.currentLevel = "categories"; // 'categories' or 'items'
    this.currentCategory = null;
    this.manifest = stateManager.state.manifest; // Get manifest if already loaded
    this.itemSelectedHandler = null; // Store handler reference for cleanup

    // Add class for ViewMode identification
    this.element.classList.add("work-browser");

    // Listen for manifest updates
    this.manifestLoadedHandler = (manifest) => {
      this.manifest = manifest;
      // Re-render if we're waiting for manifest
      if (this.currentLevel === "items") {
        this.render();
      }
    };
    stateManager.on("manifestLoaded", this.manifestLoadedHandler);

    this.render();
  }

  /**
   * Navigate back to a specific level
   * @param {string} level - Target level ('root', 'categories', 'items')
   * @param {string|null} category - Category to set (optional)
   */
  navigateBack(level, category = null) {
    this.currentLevel = level;
    this.currentCategory = category;
    this.render();
    this.stateManager.emit("connectionChanged");
  }

  render() {
    switch (this.currentLevel) {
      case "categories":
        this.renderCategories();
        this.dragHandle = null; // Allow dragging from anywhere (except interactive elements)
        break;
      case "items":
        this.renderItems();
        this.dragHandle = ".node-list-item-back"; // Only allow dragging from top bar
        break;
    }
  }

  renderCategories() {
    const categories = [
      { key: "client", label: "CLIENT" },
      { key: "personal", label: "PERSONAL" },
      { key: "tools", label: "TOOLS" },
      { key: "info", label: "INFO" },
    ];

    this.setContent(`
      <div class="node-grid" style="grid-template-columns: repeat(2, 1fr);">
        ${categories
          .map(
            (cat) =>
              `<div class="node-item" data-category="${cat.key}">${cat.label}</div>`,
          )
          .join("")}
      </div>
    `);

    // Category items
    this.element
      .querySelectorAll(".node-item[data-category]")
      .forEach((item) => {
        item.onclick = () => {
          const category = item.dataset.category;

          // Special handling for Info category - show static page instead of items
          if (category === "info") {
            this.stateManager.emit("staticPageRequested", "info");
          } else {
            this.currentCategory = category;
            this.currentLevel = "items";
            this.render();
            // Update connections after render
            this.stateManager.emit("connectionChanged");
          }
        };
      });
  }

  renderItems() {
    if (!this.manifest) {
      this.setContent('<div class="node-loading">Loading...</div>');
      return;
    }

    const items = this.manifest[this.currentCategory] || [];
    const content =
      items.length === 0 ? this.renderEmptyList() : this.renderItemList(items);

    this.setContent(content);
    this.attachItemHandlers(items);
  }

  renderEmptyList() {
    return `
      <div class="node-list-container">
        ${this.renderBackButton()}
        <div class="node-list">
          <div class="node-empty">No items in ${this.currentCategory}</div>
        </div>
      </div>
    `;
  }

  renderItemList(items) {
    return `
      <div class="node-list-container">
        ${this.renderBackButton()}
        <div class="node-list">
          ${items
            .map(
              (item, idx) => `
            <div class="node-list-item" data-index="${idx}">
              <img src="${item.thumbnail || item.path}" alt="${item.title}" class="item-thumbnail">
              <span class="item-title">${item.title}</span>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  renderBackButton() {
    return `
      <div class="node-list-item-back">
        <span class="back-arrow" data-action="back">&lt;</span>
      </div>
    `;
  }

  attachItemHandlers(items) {
    // Back arrow button
    const backArrow = this.element.querySelector(".back-arrow");
    if (backArrow) {
      backArrow.onclick = (e) => {
        e.stopPropagation();
        this.navigateBack("categories");
      };
    }

    // Item selection handlers
    this.element
      .querySelectorAll(".node-list-item[data-index]")
      .forEach((el) => {
        el.onclick = () => {
          const idx = parseInt(el.dataset.index);
          this.stateManager.selectItem(items[idx]);
        };
      });

    // Remove old listener before adding new one to prevent duplicates
    if (this.itemSelectedHandler) {
      this.stateManager.off("itemSelected", this.itemSelectedHandler);
    }

    // Listen for selection changes to highlight selected item
    if (items.length > 0) {
      this.itemSelectedHandler = (selectedItem) => {
        this.element
          .querySelectorAll(".node-list-item[data-index]")
          .forEach((el) => {
            const idx = parseInt(el.dataset.index);
            el.classList.toggle("selected", items[idx] === selectedItem);
          });
      };
      this.stateManager.on("itemSelected", this.itemSelectedHandler);
    }
  }

  remove() {
    // Clean up event listeners before removal
    if (this.manifestLoadedHandler) {
      this.stateManager.off("manifestLoaded", this.manifestLoadedHandler);
    }
    if (this.itemSelectedHandler) {
      this.stateManager.off("itemSelected", this.itemSelectedHandler);
    }
    super.remove();
  }
}
