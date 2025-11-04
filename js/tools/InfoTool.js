// InfoTool - Displays metadata information on the image
import { Tool } from "./Tool.js";

export class InfoTool extends Tool {
  constructor() {
    super();
    this.item = null;
  }

  activate(viewerNode) {
    super.activate(viewerNode);
    this.item = viewerNode.currentItem;
  }

  /**
   * Process the image data by drawing info text on top
   */
  async process(imageData, ctx, canvas) {
    // First, put the input image data on the canvas
    ctx.putImageData(imageData, 0, 0);

    if (!this.item) return imageData;

    // Setup text styling
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textBaseline = "top";
    ctx.letterSpacing = "0.05em";

    // Draw semi-transparent background for text
    const padding = 15;
    const lineHeight = 20;
    const lines = [
      this.item.title.toUpperCase(),
      `FILENAME: ${this.item.filename}`,
      `TYPE: ${this.getFileType(this.item.filename)}`,
    ];

    // Calculate background dimensions
    let maxWidth = 0;
    lines.forEach((line) => {
      const width = ctx.measureText(line).width;
      if (width > maxWidth) maxWidth = width;
    });

    const bgWidth = maxWidth + padding * 2;
    const bgHeight = lines.length * lineHeight + padding * 2;
    const bgX = 10;
    const bgY = 10;

    // Draw background
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

    // Draw text
    ctx.fillStyle = "#f39c12"; // Orange color
    lines.forEach((line, i) => {
      ctx.fillText(line, bgX + padding, bgY + padding + i * lineHeight);
    });

    // Get the updated image data with text drawn on it
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  getFileType(filename) {
    const ext = filename.split(".").pop().toUpperCase();
    const types = {
      JPG: "JPEG Image",
      JPEG: "JPEG Image",
      PNG: "PNG Image",
      GIF: "GIF Image",
      MP4: "MP4 Video",
      MOV: "MOV Video",
      MP3: "MP3 Audio",
      WAV: "WAV Audio",
    };
    return types[ext] || ext;
  }
}
