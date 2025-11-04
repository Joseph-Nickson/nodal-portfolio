// Simple Verlet Physics Engine
// Used for ragdoll simulation with constraints

export class Point {
  constructor(x, y, pinned = false) {
    this.x = x;
    this.y = y;
    this.oldX = x;
    this.oldY = y;
    this.pinned = pinned;
    this.radius = 6; // Visual radius for rendering
  }

  update(dt, gravity) {
    if (this.pinned) return;

    const vx = this.x - this.oldX;
    const vy = this.y - this.oldY;

    this.oldX = this.x;
    this.oldY = this.y;

    // Verlet integration
    this.x += vx + gravity.x * dt * dt;
    this.y += vy + gravity.y * dt * dt;
  }

  constrain(bounds) {
    if (this.pinned) return;

    // Keep within bounds
    if (this.x < this.radius) {
      this.x = this.radius;
    } else if (this.x > bounds.width - this.radius) {
      this.x = bounds.width - this.radius;
    }

    if (this.y < this.radius) {
      this.y = this.radius;
    } else if (this.y > bounds.height - this.radius) {
      this.y = bounds.height - this.radius;
    }
  }

  contains(px, py) {
    const dx = this.x - px;
    const dy = this.y - py;
    return Math.sqrt(dx * dx + dy * dy) < this.radius * 2;
  }
}

export class Stick {
  constructor(p1, p2, length = null) {
    this.p1 = p1;
    this.p2 = p2;
    // If no length specified, use current distance
    this.length = length || Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    this.stiffness = 0.5; // 0-1, higher = more rigid
  }

  update() {
    const dx = this.p2.x - this.p1.x;
    const dy = this.p2.y - this.p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const diff = this.length - dist;
    const percent = (diff / dist) * this.stiffness;
    const offsetX = dx * percent * 0.5;
    const offsetY = dy * percent * 0.5;

    if (!this.p1.pinned) {
      this.p1.x -= offsetX;
      this.p1.y -= offsetY;
    }
    if (!this.p2.pinned) {
      this.p2.x += offsetX;
      this.p2.y += offsetY;
    }
  }
}

export class Ragdoll {
  constructor(x, y, scale = 1) {
    this.points = [];
    this.sticks = [];
    this.dragging = null;

    // Create body structure
    this.createBody(x, y, scale);
  }

  createBody(centerX, centerY, scale) {
    // Store scale for emoji sizing
    this.scale = scale;

    // Dimensions - simplified torso as single box
    const headR = 20 * scale;
    const torsoW = 24 * scale; // Torso width
    const torsoH = 50 * scale; // Torso height
    const armL = 35 * scale;
    const legL = 40 * scale;

    // Head (moveable - drag from here for physics)
    this.head = new Point(centerX, centerY - torsoH / 2 - headR, false);
    this.head.radius = 10; // Larger radius for easier grabbing
    this.points.push(this.head);

    // Neck connection
    this.neck = new Point(centerX, centerY - torsoH / 2);
    this.points.push(this.neck);

    // Torso corners (simplified to 4 corners of shirt box)
    const torsoTop = centerY - torsoH / 2;
    const torsoBottom = centerY + torsoH / 2;

    this.shoulderL = new Point(centerX - torsoW / 2, torsoTop);
    this.shoulderR = new Point(centerX + torsoW / 2, torsoTop);
    this.hipL = new Point(centerX - torsoW / 2, torsoBottom);
    this.hipR = new Point(centerX + torsoW / 2, torsoBottom);
    this.points.push(this.shoulderL, this.shoulderR, this.hipL, this.hipR);

    // Left arm (attached to shoulder corner)
    this.elbowL = new Point(
      this.shoulderL.x - armL * 0.5,
      this.shoulderL.y + armL * 0.4,
    );
    this.handL = new Point(
      this.shoulderL.x - armL,
      this.shoulderL.y + armL * 0.8,
    );
    this.points.push(this.elbowL, this.handL);

    // Right arm (attached to shoulder corner)
    this.elbowR = new Point(
      this.shoulderR.x + armL * 0.5,
      this.shoulderR.y + armL * 0.4,
    );
    this.handR = new Point(
      this.shoulderR.x + armL,
      this.shoulderR.y + armL * 0.8,
    );
    this.points.push(this.elbowR, this.handR);

    // Left leg (attached to hip corner)
    this.kneeL = new Point(this.hipL.x, this.hipL.y + legL * 0.5);
    this.footL = new Point(this.hipL.x, this.hipL.y + legL);
    this.points.push(this.kneeL, this.footL);

    // Right leg (attached to hip corner)
    this.kneeR = new Point(this.hipR.x, this.hipR.y + legL * 0.5);
    this.footR = new Point(this.hipR.x, this.hipR.y + legL);
    this.points.push(this.kneeR, this.footR);

    // Create constraints (sticks)
    // Head to neck
    this.sticks.push(new Stick(this.head, this.neck));

    // Neck to torso top
    this.sticks.push(new Stick(this.neck, this.shoulderL));
    this.sticks.push(new Stick(this.neck, this.shoulderR));

    // Torso box (rigid rectangular shape)
    this.sticks.push(new Stick(this.shoulderL, this.shoulderR, torsoW)); // Top
    this.sticks.push(new Stick(this.hipL, this.hipR, torsoW)); // Bottom
    this.sticks.push(new Stick(this.shoulderL, this.hipL, torsoH)); // Left side
    this.sticks.push(new Stick(this.shoulderR, this.hipR, torsoH)); // Right side
    this.sticks.push(new Stick(this.shoulderL, this.hipR)); // Cross-brace
    this.sticks.push(new Stick(this.shoulderR, this.hipL)); // Cross-brace

    // Left arm
    this.sticks.push(new Stick(this.shoulderL, this.elbowL));
    this.sticks.push(new Stick(this.elbowL, this.handL));

    // Right arm
    this.sticks.push(new Stick(this.shoulderR, this.elbowR));
    this.sticks.push(new Stick(this.elbowR, this.handR));

    // Left leg
    this.sticks.push(new Stick(this.hipL, this.kneeL));
    this.sticks.push(new Stick(this.kneeL, this.footL));

    // Right leg
    this.sticks.push(new Stick(this.hipR, this.kneeR));
    this.sticks.push(new Stick(this.kneeR, this.footR));
  }

  update(dt, gravity, bounds) {
    // Update points with physics
    this.points.forEach((point) => {
      point.update(dt, gravity);
      point.constrain(bounds);
    });

    // Solve constraints multiple times for stability
    for (let i = 0; i < 3; i++) {
      this.sticks.forEach((stick) => stick.update());
    }
  }

  render(ctx) {
    // Draw sticks (limbs)
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    this.sticks.forEach((stick) => {
      ctx.beginPath();
      ctx.moveTo(stick.p1.x, stick.p1.y);
      ctx.lineTo(stick.p2.x, stick.p2.y);
      ctx.stroke();
    });

    // Draw emoji body parts
    const fontSize = 20 * this.scale;
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Head
    ctx.fillText("😊", this.head.x, this.head.y);

    // Hands
    ctx.fillText("✋", this.handL.x, this.handL.y);
    ctx.fillText("✋", this.handR.x, this.handR.y);

    // Feet
    ctx.fillText("👟", this.footL.x, this.footL.y);
    ctx.fillText("👟", this.footR.x, this.footR.y);

    // Torso (body)
    const torsoX = (this.shoulderL.x + this.shoulderR.x) / 2;
    const torsoY = (this.shoulderL.y + this.hipL.y) / 2;
    ctx.fillText("👕", torsoX, torsoY);
  }

  startDrag(x, y) {
    // Find closest point that's not pinned
    for (let point of this.points) {
      if (!point.pinned && point.contains(x, y)) {
        this.dragging = point;
        return true;
      }
    }
    return false;
  }

  drag(x, y) {
    if (this.dragging) {
      this.dragging.x = x;
      this.dragging.y = y;
      this.dragging.oldX = x;
      this.dragging.oldY = y;
    }
  }

  stopDrag() {
    this.dragging = null;
  }

  updateHeadPosition(x, y) {
    // Move the pinned head point
    const head = this.points[0];
    head.x = x;
    head.y = y;
    head.oldX = x;
    head.oldY = y;
  }
}
