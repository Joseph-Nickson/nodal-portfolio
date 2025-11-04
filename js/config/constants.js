// Configuration constants
export const NODES = {
  WORK: { width: 250, height: 60 },
  VIEWER: { width: 600, height: 400 },
  TOOL: { width: 180, height: 80 }
};

export const BRUSH = {
  SIZE: 60,
  MAX_SAMPLES: 20,
  STRENGTH: 0.95
};

export const CANVAS = {
  MIN_SCALE: 0.1,
  MAX_SCALE: 3,
  ZOOM_INTENSITY: 0.001,
  HOME_PADDING: 100 // Padding around nodes when framing
};

export const CONNECTION = {
  CURVE_FACTOR: 0.3,
  MAX_CURVE: 50
};

export const CATEGORIES = ['painting', 'film', 'audio', 'other'];
