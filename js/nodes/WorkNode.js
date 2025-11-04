import { Node } from "../core/Node.js";

// WorkNode - Hierarchical navigation: Root → Categories → Items
export class WorkNode extends Node {
  constructor(id, stateManager, options = {}) {
    super(id, stateManager, {
      width: 250,
      showInputPort: false,
      closeable: true, // Default to closeable
      ...options, // Allow options to override defaults
    });
    this.currentLevel = "root"; // 'root', 'categories', 'items'
    this.currentCategory = null;
    this.manifest = stateManager.state.manifest; // Get manifest if already loaded

    // Listen for manifest updates
    stateManager.on("manifestLoaded", (manifest) => {
      this.manifest = manifest;
      // Re-render if we're waiting for manifest
      if (this.currentLevel === "items") {
        this.render();
      }
    });

    this.render();
  }

  render() {
    switch (this.currentLevel) {
      case "root":
        this.renderRoot();
        break;
      case "categories":
        this.renderCategories();
        break;
      case "items":
        this.renderItems();
        break;
    }
  }

  renderRoot() {
    this.setContent(`
      <div class="node-grid">
        <div class="node-item" data-action="work">WORK</div>
        <div class="node-item" data-action="info">INFO</div>
        <div class="node-item" data-action="contact">CONTACT</div>
      </div>
    `);

    this.element.querySelectorAll(".node-item").forEach((item) => {
      item.onclick = () => {
        const action = item.dataset.action;
        if (action === "work") {
          this.currentLevel = "categories";
          this.render();
          // Update connections after render to account for size change
          this.stateManager.emit("connectionChanged");
        } else {
          // INFO/CONTACT - emit event for other nodes to handle
          this.stateManager.emit("staticPageRequested", action);
        }
      };
    });
  }

  renderCategories() {
    const categories = ["PAINTING", "FILM", "AUDIO"];

    this.setContent(`
      <div class="node-grid">
        <div class="node-item node-item-back" data-action="back">&lt;</div>
        ${categories
          .map(
            (cat) =>
              `<div class="node-item" data-category="${cat.toLowerCase()}">${cat}</div>`,
          )
          .join("")}
      </div>
    `);

    // Back button
    const backBtn = this.element.querySelector(".node-item-back");
    if (backBtn) {
      backBtn.onclick = (e) => {
        e.stopPropagation();
        this.currentLevel = "root";
        this.currentCategory = null;
        this.render();
        // Update connections after render
        this.stateManager.emit("connectionChanged");
      };
    }

    // Category items (skip the back button)
    this.element
      .querySelectorAll(".node-item[data-category]")
      .forEach((item) => {
        item.onclick = () => {
          this.currentCategory = item.dataset.category;
          this.currentLevel = "items";
          this.render();
          // Update connections after render
          this.stateManager.emit("connectionChanged");
        };
      });
  }

  renderItems() {
    if (!this.manifest) {
      this.setContent('<div class="node-loading">Loading...</div>');
      return;
    }

    const items = this.manifest[this.currentCategory] || [];

    if (items.length === 0) {
      this.setContent(`
        <div class="node-list">
          <div class="node-list-item node-list-item-back">
            <span class="back-arrow" data-action="back">&lt;</span>
          </div>
          <div class="node-empty">No items in ${this.currentCategory}</div>
        </div>
      `);
    } else {
      this.setContent(`
        <div class="node-list">
          <div class="node-list-item node-list-item-back">
            <span class="back-arrow" data-action="back">&lt;</span>
          </div>
          ${items
            .map(
              (item, idx) => `
            <div class="node-list-item" data-index="${idx}">
              <img src="${item.path}" alt="${item.title}" class="item-thumbnail">
              <span class="item-title">${item.title}</span>
            </div>
          `,
            )
            .join("")}
        </div>
      `);

      // Listen for selected item changes to highlight
      this.stateManager.on("itemSelected", (selectedItem) => {
        this.element.querySelectorAll(".node-list-item").forEach((el) => {
          const idx = parseInt(el.dataset.index);
          if (items[idx] === selectedItem) {
            el.classList.add("selected");
          } else {
            el.classList.remove("selected");
          }
        });
      });
    }

    // Back arrow button (only the < is clickable, bar is draggable)
    const backArrow = this.element.querySelector(".back-arrow");
    if (backArrow) {
      backArrow.onclick = (e) => {
        e.stopPropagation();
        this.currentLevel = "categories";
        this.currentCategory = null;
        this.render();
        // Update connections after render
        this.stateManager.emit("connectionChanged");
      };
    }

    // Item clicks (skip the back button)
    this.element
      .querySelectorAll(".node-list-item[data-index]")
      .forEach((el) => {
        el.onclick = () => {
          const idx = parseInt(el.dataset.index);
          const item = items[idx];
          this.stateManager.selectItem(item);
        };
      });
  }
}
