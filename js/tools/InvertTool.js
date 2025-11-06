// InvertTool - Inverts image colors
import { Tool } from "./Tool.js";

export class InvertTool extends Tool {
  constructor() {
    super("invert");
  }

  /**
   * Process the image data by inverting all colors
   */
  async process(imageData, ctx, canvas) {
    const outputData = ctx.createImageData(imageData);
    const output = outputData.data;
    const input = imageData.data;

    // Invert each color channel
    for (let i = 0; i < input.length; i += 4) {
      output[i] = 255 - input[i]; // Red
      output[i + 1] = 255 - input[i + 1]; // Green
      output[i + 2] = 255 - input[i + 2]; // Blue
      output[i + 3] = input[i + 3]; // Alpha (unchanged)
    }

    return outputData;
  }
}
