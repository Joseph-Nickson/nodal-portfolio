// SmudgeTool - Smudge painting effect using p5.js
import { Tool } from "./Tool.js";
import { BRUSH } from "../config/constants.js";

export class SmudgeTool extends Tool {
  constructor() {
    super();
    this.sketch = null;
    this.viewerNode = null;
    this.currentImageData = null;
  }

  activate(viewerNode) {
    super.activate(viewerNode);
    this.viewerNode = viewerNode;
  }

  /**
   * SmudgeTool is interactive and uses p5.js, so it takes over the canvas
   * It processes the input imageData by displaying it in an interactive p5 canvas
   */
  async process(imageData, ctx, canvas) {
    // Store the current image data to initialize the sketch with
    this.currentImageData = imageData;

    if (!this.viewerNode.currentItem) {
      return imageData;
    }

    // If sketch doesn't exist, create it
    if (!this.sketch) {
      this.initSketch(
        this.viewerNode.currentItem.path,
        this.viewerNode.getCanvasContainer(),
      );
    }

    // Return the imageData (smudge tool is interactive and doesn't pass through)
    return imageData;
  }

  deactivate(viewerNode) {
    super.deactivate(viewerNode);
    this.cleanup();
  }

  cleanup() {
    if (this.sketch) {
      this.sketch.remove();
      this.sketch = null;
    }
    this.currentImageData = null;
  }

  loadNewImage(imagePath) {
    if (this.sketch && this.sketch.loadNewImage) {
      this.sketch.loadNewImage(imagePath);
    }
  }

  initSketch(imagePath, container) {
    const sketch = (p) => {
      let img, brushAlpha, paintingBuffer;
      let brushSize = 60;
      let isSmudging = false;
      let prevMouseX, prevMouseY;
      let sampleColors = [];
      const maxSamples = 20;
      let scaleFactor = 1;
      let displayWidth, displayHeight;

      p.preload = function () {
        img = p.loadImage(imagePath);
        brushAlpha = p.loadImage("brush_alpha_1.png");
      };

      p.setup = function () {
        if (!img || img.width === 0) {
          console.error("Image failed to load");
          return;
        }

        const maxWidth = 600;
        const maxHeight = 400;
        scaleFactor = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        displayWidth = img.width * scaleFactor;
        displayHeight = img.height * scaleFactor;

        let canvas = p.createCanvas(displayWidth, displayHeight);
        canvas.parent(container);

        // Critical: Set position to relative so p5 mouseX/mouseY work correctly
        canvas.elt.style.position = "relative";
        canvas.elt.style.display = "block";

        // Create graphics buffer
        paintingBuffer = p.createGraphics(img.width, img.height);
        // Set willReadFrequently flag for better pixel manipulation performance
        paintingBuffer.drawingContext.getContextAttributes = () => ({
          willReadFrequently: true,
        });
        paintingBuffer.image(img, 0, 0);

        if (brushAlpha && brushAlpha.width > 0) {
          brushAlpha.loadPixels();
        }

        p.pixelDensity(1);
      };

      p.draw = function () {
        if (!paintingBuffer) return;
        p.image(paintingBuffer, 0, 0, displayWidth, displayHeight);
        p.cursor(p.CROSS);
      };

      p.mousePressed = function () {
        if (
          p.mouseX > 0 &&
          p.mouseX < p.width &&
          p.mouseY > 0 &&
          p.mouseY < p.height
        ) {
          isSmudging = true;
          prevMouseX = p.mouseX;
          prevMouseY = p.mouseY;

          paintingBuffer.loadPixels();
          let imgX = p.mouseX / scaleFactor;
          let imgY = p.mouseY / scaleFactor;
          let imgBrushSize = brushSize / scaleFactor;

          sampleColors = sampleRegion(imgX, imgY, imgBrushSize);
        }
      };

      p.mouseDragged = function () {
        if (
          isSmudging &&
          p.mouseX > 0 &&
          p.mouseX < p.width &&
          p.mouseY > 0 &&
          p.mouseY < p.height
        ) {
          let imgX = p.mouseX / scaleFactor;
          let imgY = p.mouseY / scaleFactor;
          let imgPrevX = prevMouseX / scaleFactor;
          let imgPrevY = prevMouseY / scaleFactor;
          let imgBrushSize = brushSize / scaleFactor;

          smudgePaint(imgX, imgY, imgPrevX, imgPrevY, imgBrushSize);

          prevMouseX = p.mouseX;
          prevMouseY = p.mouseY;
        }
      };

      p.mouseReleased = function () {
        isSmudging = false;
        sampleColors = [];
      };

      function sampleRegion(x, y, radius) {
        let samples = [];
        const sampleCount = 12;

        for (let i = 0; i < sampleCount; i++) {
          let angle = (p.TWO_PI / sampleCount) * i;
          let r = p.random(radius * 0.3, radius * 0.7);
          let sx = Math.floor(x + p.cos(angle) * r);
          let sy = Math.floor(y + p.sin(angle) * r);

          if (sx >= 0 && sx < img.width && sy >= 0 && sy < img.height) {
            let index = (sy * img.width + sx) * 4;
            samples.push({
              r: paintingBuffer.pixels[index],
              g: paintingBuffer.pixels[index + 1],
              b: paintingBuffer.pixels[index + 2],
              a: paintingBuffer.pixels[index + 3],
            });
          }
        }
        return samples;
      }

      function averageColors(colorArray) {
        if (colorArray.length === 0) return { r: 0, g: 0, b: 0, a: 255 };

        let totalR = 0,
          totalG = 0,
          totalB = 0,
          totalA = 0;
        for (let col of colorArray) {
          totalR += col.r;
          totalG += col.g;
          totalB += col.b;
          totalA += col.a;
        }

        let count = colorArray.length;
        return {
          r: totalR / count,
          g: totalG / count,
          b: totalB / count,
          a: totalA / count,
        };
      }

      function smudgePaint(x, y, prevX, prevY, size) {
        paintingBuffer.loadPixels();

        let newSamples = sampleRegion(x, y, size * 0.8);
        sampleColors = [...sampleColors, ...newSamples];
        if (sampleColors.length > maxSamples) {
          sampleColors = sampleColors.slice(-maxSamples);
        }

        let avgColor = averageColors(sampleColors);
        let steps = p.dist(prevX, prevY, x, y);
        steps = p.max(1, steps);

        for (let i = 0; i <= steps; i++) {
          let t = i / steps;
          let ix = p.lerp(prevX, x, t);
          let iy = p.lerp(prevY, y, t);
          paintSoftBrush(ix, iy, size, avgColor);
        }

        paintingBuffer.updatePixels();
      }

      function paintSoftBrush(x, y, size, col) {
        if (!brushAlpha || brushAlpha.width === 0) return;

        let radius = size / 2;
        let startX = Math.floor(Math.max(0, x - radius));
        let endX = Math.floor(Math.min(img.width - 1, x + radius));
        let startY = Math.floor(Math.max(0, y - radius));
        let endY = Math.floor(Math.min(img.height - 1, y + radius));

        for (let py = startY; py <= endY; py++) {
          for (let px = startX; px <= endX; px++) {
            let d = p.dist(px, py, x, y);

            if (d < radius) {
              let brushX = Math.floor(
                p.map(px - (x - radius), 0, size, 0, brushAlpha.width),
              );
              let brushY = Math.floor(
                p.map(py - (y - radius), 0, size, 0, brushAlpha.height),
              );

              if (
                brushX >= 0 &&
                brushX < brushAlpha.width &&
                brushY >= 0 &&
                brushY < brushAlpha.height
              ) {
                let brushIndex = (brushY * brushAlpha.width + brushX) * 4;
                let alphaValue = brushAlpha.pixels[brushIndex];
                let strength = (alphaValue / 255) * 0.95;

                let index = (py * img.width + px) * 4;

                paintingBuffer.pixels[index] = p.lerp(
                  paintingBuffer.pixels[index],
                  col.r,
                  strength,
                );
                paintingBuffer.pixels[index + 1] = p.lerp(
                  paintingBuffer.pixels[index + 1],
                  col.g,
                  strength,
                );
                paintingBuffer.pixels[index + 2] = p.lerp(
                  paintingBuffer.pixels[index + 2],
                  col.b,
                  strength,
                );
              }
            }
          }
        }
      }

      // Method to load new image
      p.loadNewImage = function (newImagePath) {
        p.loadImage(newImagePath, (newImg) => {
          img = newImg;
          paintingBuffer = p.createGraphics(img.width, img.height);
          paintingBuffer.image(img, 0, 0);

          scaleFactor = Math.min(600 / img.width, 400 / img.height, 1);
          displayWidth = img.width * scaleFactor;
          displayHeight = img.height * scaleFactor;

          p.resizeCanvas(displayWidth, displayHeight);
        });
      };
    };

    this.sketch = new p5(sketch);
  }
}
