/**
 * PerformanceMonitor - Tracks FPS and performance metrics
 *
 * Usage:
 *   import PerformanceMonitor from './utils/PerformanceMonitor.js';
 *   const monitor = new PerformanceMonitor();
 *   monitor.show();
 *
 *   // Optionally hide/show
 *   monitor.hide();
 *   monitor.toggle();
 */
export default class PerformanceMonitor {
  constructor(options = {}) {
    this.visible = options.visible !== false;
    this.position = options.position || "top-left"; // 'top-left', 'top-right', 'bottom-left', 'bottom-right'

    // FPS tracking
    this.fps = 0;
    this.frames = 0;
    this.lastTime = performance.now();
    this.fpsHistory = [];
    this.maxHistoryLength = 60; // Store last 60 fps samples

    // Event tracking
    this.eventCounts = {
      connectionChanged: 0,
      itemSelected: 0,
      toolActivated: 0,
      toolDeactivated: 0,
    };

    // Performance tracking
    this.renderTimes = [];
    this.maxRenderTimes = 30;

    this.createElement();
    this.startTracking();

    if (this.visible) {
      this.show();
    }
  }

  createElement() {
    this.element = document.createElement('div');
    this.element.className = 'performance-monitor';
    this.element.innerHTML = `
      <div class="perf-header">PERFORMANCE</div>
      <div class="perf-row">
        <span class="perf-label">FPS:</span>
        <span class="perf-value perf-fps">--</span>
      </div>
      <div class="perf-row">
        <span class="perf-label">AVG:</span>
        <span class="perf-value perf-avg">--</span>
      </div>
      <div class="perf-row">
        <span class="perf-label">MIN:</span>
        <span class="perf-value perf-min">--</span>
      </div>
      <div class="perf-row perf-events-toggle">
        <span class="perf-label">EVENTS</span>
        <span class="perf-toggle">▼</span>
      </div>
      <div class="perf-events">
        <div class="perf-row perf-event-row">
          <span class="perf-label perf-event-label">conn:</span>
          <span class="perf-value perf-event-conn">0</span>
        </div>
        <div class="perf-row perf-event-row">
          <span class="perf-label perf-event-label">item:</span>
          <span class="perf-value perf-event-item">0</span>
        </div>
        <div class="perf-row perf-event-row">
          <span class="perf-label perf-event-label">tool:</span>
          <span class="perf-value perf-event-tool">0</span>
        </div>
      </div>
      <div class="perf-graph"></div>
    `;

    // Toggle events section
    const toggle = this.element.querySelector(".perf-events-toggle");
    const events = this.element.querySelector(".perf-events");
    const toggleIcon = this.element.querySelector(".perf-toggle");

    toggle.addEventListener("click", () => {
      const isHidden = events.style.display === "none";
      events.style.display = isHidden ? "block" : "none";
      toggleIcon.textContent = isHidden ? "▼" : "▶";
    });

    document.body.appendChild(this.element);

    // Apply position
    this.setPosition(this.position);
  }

  setPosition(position) {
    this.position = position;
    const positions = {
      "top-left": { top: "80px", left: "20px", right: "auto", bottom: "auto" },
      "top-right": { top: "20px", right: "20px", left: "auto", bottom: "auto" },
      "bottom-left": {
        bottom: "80px",
        left: "20px",
        right: "auto",
        top: "auto",
      },
      "bottom-right": {
        bottom: "80px",
        right: "20px",
        left: "auto",
        top: "auto",
      },
    };

    const pos = positions[position] || positions["top-left"];
    Object.assign(this.element.style, pos);
  }

  startTracking() {
    // FPS calculation loop
    const updateFPS = () => {
      this.frames++;
      const currentTime = performance.now();
      const elapsed = currentTime - this.lastTime;

      // Update every second
      if (elapsed >= 1000) {
        this.fps = Math.round((this.frames * 1000) / elapsed);
        this.fpsHistory.push(this.fps);

        // Keep history limited
        if (this.fpsHistory.length > this.maxHistoryLength) {
          this.fpsHistory.shift();
        }

        this.frames = 0;
        this.lastTime = currentTime;
        this.updateDisplay();
      }

      this.animationFrame = requestAnimationFrame(updateFPS);
    };

    this.animationFrame = requestAnimationFrame(updateFPS);
  }

  updateDisplay() {
    // Update FPS
    const fpsElement = this.element.querySelector(".perf-fps");
    fpsElement.textContent = this.fps;

    // Color code based on performance
    if (this.fps >= 55) {
      fpsElement.style.color = "#27ae60"; // Green
    } else if (this.fps >= 30) {
      fpsElement.style.color = "#f39c12"; // Orange
    } else {
      fpsElement.style.color = "#e74c3c"; // Red
    }

    // Update averages
    if (this.fpsHistory.length > 0) {
      const avg = Math.round(
        this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length,
      );
      const min = Math.min(...this.fpsHistory);

      this.element.querySelector(".perf-avg").textContent = avg;
      this.element.querySelector(".perf-min").textContent = min;
    }

    // Update event counts
    this.element.querySelector(".perf-event-conn").textContent =
      this.eventCounts.connectionChanged;
    this.element.querySelector(".perf-event-item").textContent =
      this.eventCounts.itemSelected;
    this.element.querySelector(".perf-event-tool").textContent =
      this.eventCounts.toolActivated + this.eventCounts.toolDeactivated;

    // Update graph
    this.updateGraph();
  }

  updateGraph() {
    const graph = this.element.querySelector(".perf-graph");
    const width = 180;
    const height = 40;
    const padding = 2;

    if (this.fpsHistory.length < 2) return;

    // Create SVG if not exists
    let svg = graph.querySelector("svg");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", width);
      svg.setAttribute("height", height);
      graph.appendChild(svg);
    }

    // Clear previous path
    svg.innerHTML = "";

    // Draw grid lines
    const gridLines = [60, 30];
    gridLines.forEach((fps) => {
      const y = height - (fps / 60) * (height - padding * 2) - padding;
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      line.setAttribute("x1", 0);
      line.setAttribute("y1", y);
      line.setAttribute("x2", width);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "rgba(26, 26, 26, 0.1)");
      line.setAttribute("stroke-width", "1");
      svg.appendChild(line);
    });

    // Create path
    const points = this.fpsHistory.slice(-60);
    const pointWidth = width / Math.max(points.length - 1, 1);

    let pathData = "";
    points.forEach((fps, i) => {
      const x = i * pointWidth;
      const normalizedFps = Math.min(fps, 60);
      const y =
        height - (normalizedFps / 60) * (height - padding * 2) - padding;

      if (i === 0) {
        pathData += `M ${x} ${y}`;
      } else {
        pathData += ` L ${x} ${y}`;
      }
    });

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("stroke", "#f39c12");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("fill", "none");
    svg.appendChild(path);
  }

  trackEvent(eventName) {
    if (this.eventCounts.hasOwnProperty(eventName)) {
      this.eventCounts[eventName]++;
    }
  }

  trackRenderTime(ms) {
    this.renderTimes.push(ms);
    if (this.renderTimes.length > this.maxRenderTimes) {
      this.renderTimes.shift();
    }
  }

  resetEventCounts() {
    Object.keys(this.eventCounts).forEach((key) => {
      this.eventCounts[key] = 0;
    });
    this.updateDisplay();
  }

  show() {
    this.visible = true;
    this.element.style.display = "block";
  }

  hide() {
    this.visible = false;
    this.element.style.display = "none";
  }

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.element.remove();
  }
}
