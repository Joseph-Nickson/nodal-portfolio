/**
 * Configuration constants - Single source of truth for dimensions and settings
 */

export const NODES = {
  WORK: { WIDTH: 375, HEIGHT: 60 }, // Increased by 50% from 250
  VIEWER: { WIDTH: 700, HEIGHT: 450 },
  TOOL: { WIDTH: 140, HEIGHT: 60 },
};

// Viewer content display dimensions
export const VIEWER = {
  CONTENT_WIDTH: 700,
  CONTENT_HEIGHT: 450,
  // Canvas rendering dimensions for tools
  CANVAS_MAX_WIDTH: 700,
  CANVAS_MAX_HEIGHT: 450,
};

export const BRUSH = {
  SIZE: 60,
  MAX_SAMPLES: 20,
  STRENGTH: 0.95,
};

export const CANVAS = {
  MIN_SCALE: 0.1,
  MAX_SCALE: 3,
  ZOOM_INTENSITY: 0.001,
  TRACKPAD_ZOOM_INTENSITY: 0.01,
  HOME_PADDING: 100,
};

export const CONNECTION = {
  CURVE_FACTOR: 0.3,
  MAX_CURVE: 50,
  MIN_LENGTH_FOR_EMBLEM: 100, // Minimum cable length to show tool emblem
  EMBLEM_SIZE: 40, // Tool emblem button size (width/height)
  EMBLEM_OFFSET: 20, // Half of emblem size for centering
};

export const LAYOUT = {
  OVERLAP_PADDING: 20, // Padding for overlap detection
  OVERLAP_PUSH_DISTANCE: 80, // Distance to push overlapping nodes
  OVERLAP_ANIMATION_DURATION: 300, // ms for smooth spreading animation
  SIMPLIFIED_NODE_PADDING: 20, // Padding in simplified mode
  SIMPLIFIED_NODE_GAP: 20, // Gap between nodes in simplified mode
};

export const CATEGORIES = ["painting", "film", "audio", "other"];
