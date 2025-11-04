# Node-Based Portfolio System

A modular, interactive portfolio website inspired by Teenage Engineering's design philosophy. Features a node-based system where artworks flow through tools and filters to a viewer.

## 🎨 Features

- **Node System**: Drag-and-drop nodes on an infinite canvas
- **Pan & Zoom**: Right-click drag to pan, scroll to zoom
- **Interactive Tools**: 
  - 🎨 **Smudge** - Paint and smudge artworks interactively
  - 🔄 **Invert** - Invert colors
  - ⏭️ **Slideshow** - Auto-cycle through works
  - ℹ️ **Info** - Display metadata
- **Home Button**: One-click to frame all nodes in view
- **Clean Grid Aesthetic**: Dot grid background, tight spacing

## 🚀 Quick Start

1. **Open in browser:**
   ```bash
   # Start a local server
   python3 -m http.server 8000
   # or
   npx serve
   
   # Then visit http://localhost:8000
   ```

2. **Navigate:**
   - Click **WORK** node → Select category → Select artwork
   - Click **+** on connection line → Add tools
   - **Right-click + drag** to pan canvas
   - **Scroll** to zoom
   - Click **Home** button (bottom-left) to frame all nodes

## 📁 Project Structure

```
├── index.html              # Entry point
├── css/
│   └── main.css           # All styles
├── js/
│   ├── main.js            # App initialization
│   ├── config/
│   │   ├── constants.js   # Configuration values
│   │   └── ToolRegistry.js # Tool definitions
│   ├── core/
│   │   ├── Node.js        # Base node class
│   │   ├── Canvas.js      # Pan/zoom system
│   │   ├── StateManager.js # State + events
│   │   ├── ConnectionManager.js # SVG connections
│   │   └── NodeRenderer.js # UI helpers
│   ├── nodes/
│   │   ├── WorkNode.js    # Navigation node
│   │   ├── ViewerNode.js  # Display node
│   │   └── ToolNode.js    # Tool container
│   └── tools/
│       ├── Tool.js        # Base tool class
│       ├── SmudgeTool.js  # Interactive painting
│       ├── InvertTool.js  # Color inversion
│       ├── SlideshowTool.js # Auto-cycle
│       └── InfoTool.js    # Metadata display
├── works/                 # Artwork files
└── works_manifest.json    # Artwork metadata
```

## 🔧 Adding New Tools

### 1. Create Tool Class

```javascript
// js/tools/GrayscaleTool.js
import { Tool } from './Tool.js';

export class GrayscaleTool extends Tool {
  constructor() {
    super();
    this.canvas = null;
  }

  activate(viewerNode) {
    super.activate(viewerNode);
    
    if (!viewerNode.currentItem) return;
    
    viewerNode.showCanvas();
    this.applyGrayscale(viewerNode.currentItem.path, viewerNode.getCanvasContainer());
  }

  deactivate(viewerNode) {
    super.deactivate(viewerNode);
    viewerNode.showImage();
  }

  cleanup() {
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
  }

  applyGrayscale(imagePath, container) {
    // Your implementation here
    const img = new Image();
    img.onload = () => {
      this.canvas = document.createElement('canvas');
      // ... grayscale logic
      container.appendChild(this.canvas);
    };
    img.src = imagePath;
  }
}
```

### 2. Register the Tool

```javascript
// js/config/ToolRegistry.js
import { GrayscaleTool } from '../tools/GrayscaleTool.js';

export class ToolRegistry {
  static tools = new Map([
    // ... existing tools
    ['grayscale', { 
      label: 'GRAYSCALE', 
      class: GrayscaleTool,
      description: 'Convert to grayscale'
    }]
  ]);
}
```

### 3. Done! 🎉

The tool will automatically appear in the connection emblem menu.

## 🎨 Adding New Node Types

### Example: Compare Node

```javascript
// js/nodes/CompareNode.js
import { Node } from '../core/Node.js';
import { NODES } from '../config/constants.js';

export class CompareNode extends Node {
  constructor(id, stateManager, options = {}) {
    super(id, stateManager, {
      ...options,
      width: NODES.COMPARE.width,
      height: NODES.COMPARE.height
    });
    
    this.render();
  }

  render() {
    this.setContent(`
      <div class="compare-container">
        <div class="compare-left"></div>
        <div class="compare-right"></div>
      </div>
    `);
  }
}
```

Then instantiate in `main.js`:

```javascript
const compareNode = new CompareNode('compare', this.stateManager, {x: 100, y: 500});
this.canvas.addNode(compareNode);
```

## 📋 Adding Artworks

Edit `works_manifest.json`:

```json
{
  "painting": [
    {
      "filename": "my-artwork.jpg",
      "path": "works/painting/my-artwork.jpg",
      "title": "My Artwork Title"
    }
  ]
}
```

Or use the generator:

```bash
node generate_manifest.js
```

## ⚙️ Configuration

Edit `js/config/constants.js`:

```javascript
export const NODES = {
  WORK: { width: 250, height: 60 },
  VIEWER: { width: 600, height: 400 },
  TOOL: { width: 180, height: 80 }
};

export const BRUSH = {
  SIZE: 60,           // Brush size for smudge
  MAX_SAMPLES: 20,    // Color sampling
  STRENGTH: 0.95      // Blend strength
};

export const CANVAS = {
  MIN_SCALE: 0.1,
  MAX_SCALE: 3,
  ZOOM_INTENSITY: 0.001,
  HOME_PADDING: 100
};
```

## 🎯 Usage Patterns

### Event System

```javascript
// Listen for item selection
this.stateManager.on('itemSelected', (item) => {
  console.log('Selected:', item.title);
});

// Emit custom events
this.stateManager.emit('customEvent', { data: 'value' });
```

### Rendering Helpers

```javascript
import { NodeRenderer } from './core/NodeRenderer.js';

// Create a grid
const grid = NodeRenderer.grid(
  ['Item 1', 'Item 2', 'Item 3'],
  { onClick: (item) => console.log(item) }
);

// Create a list with thumbnails
const list = NodeRenderer.list(
  artworks,
  { onClick: selectArtwork, selectedIndex: 0 }
);

// Create a header with back button
const header = NodeRenderer.header({
  onBack: () => this.goBack(),
  showShuffle: true,
  onShuffle: () => this.shuffle()
});
```

## 🐛 Known Issues & Solutions

### Issue: Tool won't toggle off
**Solution:** Already fixed! Tools now properly cleanup and can be toggled repeatedly.

### Issue: Smudge cursor offset
**Solution:** Already fixed! Canvas position is now set correctly.

### Issue: Can't drag viewer when smudging
**Solution:** Already fixed! Drag restricted to bottom orange bar only.

### Issue: Connections anchor to wrong position
**Solution:** Already fixed! Now use `getBoundingClientRect()` for accurate port positions.

## 🎮 Controls

| Action | Control |
|--------|---------|
| Pan canvas | Right-click + drag |
| Zoom | Scroll wheel |
| Frame all nodes | Click Home button (bottom-left) |
| Add tool | Click **+** on connection line |
| Remove tool | Click **×** on tool node |
| Drag node | Left-click + drag node |
| Drag viewer (when smudging) | Drag bottom orange bar only |

## 🎨 Styling

All styles in `css/main.css`. Key CSS variables:

```css
:root {
  --bg-color: #f5f3f0;
  --node-bg: #ffffff;
  --node-border: #1a1a1a;
  --text-color: #1a1a1a;
  --accent-orange: #f39c12;
  --dot-color: rgba(26, 26, 26, 0.15);
  --grid-size: 20px;
}
```

## 📦 Dependencies

- **p5.js** (CDN) - For SmudgeTool interactive painting
- No other dependencies! Pure vanilla JS.

## 🚢 Deployment

1. **Static hosting:**
   - Upload all files to hosting (Netlify, Vercel, GitHub Pages)
   - Ensure `works_manifest.json` is accessible
   - No build step required!

2. **Optimization (optional):**
   ```bash
   # Minify JS
   npx terser js/**/*.js -o dist/bundle.min.js
   
   # Minify CSS
   npx clean-css-cli css/main.css -o dist/main.min.css
   ```

## 🎓 Architecture Principles

1. **Modular** - Each file has one clear responsibility
2. **Extensible** - Easy to add tools and nodes
3. **DRY** - No duplicate code (ToolRegistry, NodeRenderer)
4. **Event-driven** - Loose coupling via StateManager
5. **Configurable** - Constants file for all magic numbers

## 📝 License

Your portfolio, your rules! 🎨

---

**Built with love, inspired by Teenage Engineering** ⚡
