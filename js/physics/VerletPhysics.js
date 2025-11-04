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
    this.length = length || Math.sqrt(
      (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
    );
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
    // Dimensions
    const headR = 15 * scale;
    const torsoH = 40 * scale;
    const armL = 30 * scale;
    const legL = 35 * scale;

    // Head (pinned at top - attached to viewer)
    const head = new Point(centerX, centerY - torsoH / 2 - headR, true);
    this.points.push(head);

    // Neck
    const neck = new Point(centerX, centerY - torsoH / 2);
    this.points.push(neck);

    // Shoulders
    const shoulderL = new Point(centerX - 12 * scale, centerY - torsoH / 2 + 5 * scale);
    const shoulderR = new Point(centerX + 12 * scale, centerY - torsoH / 2 + 5 * scale);
    this.points.push(shoulderL, shoulderR);

    // Hips
    const hipL = new Point(centerX - 8 * scale, centerY + torsoH / 2);
    const hipR = new Point(centerX + 8 * scale, centerY + torsoH / 2);
    this.points.push(hipL, hipR);

    // Left arm
    const elbowL = new Point(shoulderL.x - armL * 0.5, shoulderL.y + armL * 0.3);
    const handL = new Point(shoulderL.x - armL, shoulderL.y + armL * 0.6);
    this.points.push(elbowL, handL);

    // Right arm
    const elbowR = new Point(shoulderR.x + armL * 0.5, shoulderR.y + armL * 0.3);
    const handR = new Point(shoulderR.x + armL, shoulderR.y + armL * 0.6);
    this.points.push(elbowR, handR);

    // Left leg
    const kneeL = new Point(hipL.x, hipL.y + legL * 0.5);
    const footL = new Point(hipL.x, hipL.y + legL);
    this.points.push(kneeL, footL);

    // Right leg
    const kneeR = new Point(hipR.x, hipR.y + legL * 0.5);
    const footR = new Point(hipR.x, hipR.y + legL);
    this.points.push(kneeR, footR);

    // Create constraints (sticks)
    // Head to neck
    this.sticks.push(new Stick(head, neck));

    // Spine
    this.sticks.push(new Stick(neck, shoulderL, 12 * scale));
    this.sticks.push(new Stick(neck, shoulderR, 12 * scale));
    this.sticks.push(new Stick(shoulderL, hipL, torsoH * 0.6));
    this.sticks.push(new Stick(shoulderR, hipR, torsoH * 0.6));
    this.sticks.push(new Stick(hipL, hipR, 16 * scale));
    this.sticks.push(new Stick(shoulderL, shoulderR, 24 * scale));

    // Left arm
    this.sticks.push(new Stick(shoulderL, elbowL));
    this.sticks.push(new Stick(elbowL, handL));

    // Right arm
    this.sticks.push(new Stick(shoulderR, elbowR));
    this.sticks.push(new Stick(elbowR, handR));

    // Left leg
    this.sticks.push(new Stick(hipL, kneeL));
    this.sticks.push(new Stick(kneeL, footL));

    // Right leg
    this.sticks.push(new Stick(hipR, kneeR));
    this.sticks.push(new Stick(kneeR, footR));
  }

  update(dt, gravity, bounds) {
    // Update points with physics
    this.points.forEach(point => {
      point.update(dt, gravity);
      point.constrain(bounds);
    });

    // Solve constraints multiple times for stability
    for (let i = 0; i < 3; i++) {
      this.sticks.forEach(stick => stick.update());
    }
  }

  render(ctx) {
    // Draw sticks (limbs)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    this.sticks.forEach(stick => {
      ctx.beginPath();
      ctx.moveTo(stick.p1.x, stick.p1.y);
      ctx.lineTo(stick.p2.x, stick.p2.y);
      ctx.stroke();
    });

    // Draw points (joints)
    this.points.forEach(point => {
      ctx.fillStyle = point.pinned ? '#f39c12' : '#1a1a1a';
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      ctx.fill();

      // Outline
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw head as circle
    const head = this.points[0];
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(head.x, head.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw simple face
    ctx.fillStyle = '#1a1a1a';
    // Eyes
    ctx.beginPath();
    ctx.arc(head.x - 5, head.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(head.x + 5, head.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    // Smile
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(head.x, head.y + 3, 6, 0, Math.PI);
    ctx.stroke();
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
