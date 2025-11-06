/**
 * CanvasRenderer - Reusable canvas rendering utilities with caching
 */
export class CanvasRenderer {
  static cache = new Map();

  /**
   * Draw text overlay on canvas with background box
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {string} text - Text to display
   * @param {Object} options - Rendering options
   */
  static drawTextBox(ctx, canvas, text, options = {}) {
    const {
      font = 'bold 14px "Courier New", monospace',
      textColor = '#f39c12',
      bgColor = 'rgba(0, 0, 0, 0.75)',
      padding = 15,
      lineHeight = 20,
      maxWidth = canvas.width - 40
    } = options;

    // Wrap text (with caching)
    const lines = this.wrapText(ctx, text, maxWidth, font);

    if (lines.length === 0) return;

    // Calculate dimensions
    const bgWidth = maxWidth + padding * 2;
    const bgHeight = lines.length * lineHeight + padding * 2;
    const bgX = (canvas.width - bgWidth) / 2;
    const bgY = (canvas.height - bgHeight) / 2;

    // Draw background
    ctx.fillStyle = bgColor;
    ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

    // Draw text
    ctx.font = font;
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'top';

    lines.forEach((line, i) => {
      const textX = bgX + padding;
      const textY = bgY + padding + i * lineHeight;
      ctx.fillText(line, textX, textY);
    });
  }

  /**
   * Wrap text to fit within maxWidth (with caching)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} text - Text to wrap
   * @param {number} maxWidth - Maximum width
   * @param {string} font - Font specification
   * @returns {Array<string>} Array of text lines
   */
  static wrapText(ctx, text, maxWidth, font) {
    // Create cache key
    const cacheKey = `${text}-${maxWidth}-${font}`;

    // Return cached result if available
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    ctx.font = font;
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    // Cache the result
    this.cache.set(cacheKey, lines);

    // Limit cache size to prevent memory bloat
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    return lines;
  }

  /**
   * Clear the text wrapping cache
   */
  static clearCache() {
    this.cache.clear();
  }
}
