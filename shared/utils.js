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
 * Normalize an image entry into {src, caption}
 * @param {string|Object} img - Image entry (string filename or {src, caption} object)
 * @returns {{src: string, caption: string|null}} Normalized image data
 */
function normalizeImageEntry(img) {
  if (typeof img === "string") {
    return { src: img, caption: null };
  }
  if (!img || typeof img !== "object") {
    return { src: "", caption: null };
  }
  return {
    src: img.src || "",
    caption: img.caption || null,
  };
}

/**
 * Get image src from image entry (handles both string and object formats)
 * @param {string|Object} img - Image entry (string filename or {src, caption} object)
 * @returns {string} Image filename
 */
function getImageSrc(img) {
  return normalizeImageEntry(img).src;
}

/**
 * Get image caption from image entry
 * @param {string|Object} img - Image entry (string filename or {src, caption} object)
 * @returns {string|null} Caption or null
 */
function getImageCaption(img) {
  return normalizeImageEntry(img).caption;
}

/**
 * Get primary media for a work (prefers images over videos)
 * @param {Object} work - Work object with content/images fields
 * @returns {Object} Media descriptor
 */
function getPrimaryMedia(work) {
  if (work && Array.isArray(work.content) && work.content.length > 0) {
    const firstImage = work.content.find((c) => c.type === "image");
    if (firstImage) {
      const normalized = normalizeImageEntry(firstImage.src || firstImage);
      return { type: "image", src: normalized.src, caption: firstImage.caption || normalized.caption };
    }
    const firstVideo = work.content.find((c) => c.type === "video");
    if (firstVideo) {
      return {
        type: "video",
        videoId: firstVideo.videoId,
        thumbnail: getYouTubeThumbnail(firstVideo.videoId),
      };
    }
  }

  if (work && Array.isArray(work.images) && work.images.length > 0) {
    const normalized = normalizeImageEntry(work.images[0]);
    if (normalized.src) {
      return { type: "image", src: normalized.src, caption: normalized.caption };
    }
  }

  if (work && work.videoId) {
    return {
      type: "video",
      videoId: work.videoId,
      thumbnail: getYouTubeThumbnail(work.videoId),
    };
  }

  if (work && work.thumbnail) {
    return { type: "image", src: work.thumbnail, caption: null };
  }

  return { type: "none" };
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
    normalizeImageEntry,
    getImageSrc,
    getImageCaption,
    getPrimaryMedia,
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
    normalizeImageEntry,
    getImageSrc,
    getImageCaption,
    getPrimaryMedia,
    getMultiValues,
    escapeHtml,
  };
}
