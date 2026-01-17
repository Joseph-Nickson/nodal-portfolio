/**
 * Shared utility functions for portfolio website
 * Used by: build-data.js, admin/server.js, script.js (via browser bundle)
 */

/**
 * Convert text to URL-friendly slug
 * @param {string} text - Text to slugify
 * @returns {string} URL-friendly slug
 */
function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/**
 * Extract YouTube video ID from various URL formats
 * @param {string} url - YouTube URL or video ID
 * @returns {string} YouTube video ID or empty string
 */
function extractYouTubeId(url) {
  if (!url) return "";
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Already just an ID
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return "";
}

/**
 * Get YouTube thumbnail URL from video ID
 * @param {string} videoId - YouTube video ID
 * @returns {string} Thumbnail URL or empty string
 */
function getYouTubeThumbnail(videoId) {
  if (!videoId) return "";
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

/**
 * Format semicolon-separated values for display
 * @param {string} value - Semicolon-separated string
 * @returns {string} Comma-separated display string
 */
function formatMultiValue(value) {
  if (!value) return "";
  return value
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v)
    .join(", ");
}

/**
 * Get array from semicolon-separated value
 * @param {string} value - Semicolon-separated string
 * @returns {string[]} Array of trimmed values
 */
function getMultiValues(value) {
  if (!value) return [];
  return value
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v);
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML string
 */
function escapeHtml(text) {
  if (!text) return "";
  const escapeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => escapeMap[char]);
}

// Export for Node.js (CommonJS)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    slugify,
    extractYouTubeId,
    getYouTubeThumbnail,
    formatMultiValue,
    getMultiValues,
    escapeHtml,
  };
}

// Export for browser (window global)
if (typeof window !== "undefined") {
  window.PortfolioUtils = {
    slugify,
    extractYouTubeId,
    getYouTubeThumbnail,
    formatMultiValue,
    getMultiValues,
    escapeHtml,
  };
}
