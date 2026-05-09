const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

export class Vector {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  clone() {
    return new Vector(this.x, this.y);
  }

  add(vector) {
    this.x += vector.x;
    this.y += vector.y;
    return this;
  }

  subtract(vector) {
    this.x -= vector.x;
    this.y -= vector.y;
    return this;
  }

  multiply(value) {
    this.x *= value;
    this.y *= value;
    return this;
  }

  divide(value) {
    if (value !== 0) {
      this.x /= value;
      this.y /= value;
    }
    return this;
  }

  magnitude() {
    return Math.hypot(this.x, this.y);
  }

  magnitudeSquared() {
    return this.x * this.x + this.y * this.y;
  }

  normalize() {
    const magnitude = this.magnitude();
    if (magnitude > 0) {
      this.divide(magnitude);
    }
    return this;
  }

  setMagnitude(value) {
    return this.normalize().multiply(value);
  }

  limit(maximum) {
    if (this.magnitudeSquared() > maximum * maximum) {
      this.setMagnitude(maximum);
    }
    return this;
  }

  distanceTo(vector) {
    return Math.hypot(this.x - vector.x, this.y - vector.y);
  }

  static subtract(left, right) {
    return new Vector(left.x - right.x, left.y - right.y);
  }

  static random2D(rng = Math.random) {
    const angle = rng() * Math.PI * 2;
    return new Vector(Math.cos(angle), Math.sin(angle));
  }
}

export class Boid {
  constructor({
    x,
    y,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    velocity,
    maxSpeed = 3.2,
    maxForce = 0.055,
    perceptionRadius = 70,
    separationRadius = 30,
    rng = Math.random
  } = {}) {
    this.position = new Vector(x ?? rng() * width, y ?? rng() * height);
    this.velocity = velocity ? velocity.clone() : Vector.random2D(rng).setMagnitude(maxSpeed * (0.45 + rng() * 0.55));
    this.acceleration = new Vector();
    this.maxSpeed = maxSpeed;
    this.maxForce = maxForce;
    this.perceptionRadius = perceptionRadius;
    this.separationRadius = separationRadius;
    this.size = 6 + rng() * 4;
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  setParameters({ maxSpeed, perceptionRadius, separationRadius } = {}) {
    if (Number.isFinite(maxSpeed)) {
      this.maxSpeed = maxSpeed;
    }
    if (Number.isFinite(perceptionRadius)) {
      this.perceptionRadius = perceptionRadius;
    }
    if (Number.isFinite(separationRadius)) {
      this.separationRadius = separationRadius;
    }
  }

  edges(width, height) {
    const margin = this.size * 2;
    if (this.position.x < -margin) {
      this.position.x = width + margin;
    } else if (this.position.x > width + margin) {
      this.position.x = -margin;
    }

    if (this.position.y < -margin) {
      this.position.y = height + margin;
    } else if (this.position.y > height + margin) {
      this.position.y = -margin;
    }
  }

  alignment(boids) {
    const steering = new Vector();
    let total = 0;

    for (const other of boids) {
      if (other === this) {
        continue;
      }
      const distance = this.position.distanceTo(other.position);
      if (distance > 0 && distance < this.perceptionRadius) {
        steering.add(other.velocity);
        total += 1;
      }
    }

    if (total === 0) {
      return steering;
    }

    return steering
      .divide(total)
      .setMagnitude(this.maxSpeed)
      .subtract(this.velocity)
      .limit(this.maxForce);
  }

  cohesion(boids) {
    const steering = new Vector();
    let total = 0;

    for (const other of boids) {
      if (other === this) {
        continue;
      }
      const distance = this.position.distanceTo(other.position);
      if (distance > 0 && distance < this.perceptionRadius) {
        steering.add(other.position);
        total += 1;
      }
    }

    if (total === 0) {
      return steering;
    }

    return steering
      .divide(total)
      .subtract(this.position)
      .setMagnitude(this.maxSpeed)
      .subtract(this.velocity)
      .limit(this.maxForce);
  }

  separation(boids) {
    const steering = new Vector();
    let total = 0;

    for (const other of boids) {
      if (other === this) {
        continue;
      }
      const distance = this.position.distanceTo(other.position);
      if (distance > 0 && distance < this.separationRadius) {
        const difference = Vector.subtract(this.position, other.position);
        difference.divide(distance * distance);
        steering.add(difference);
        total += 1;
      }
    }

    if (total === 0) {
      return steering;
    }

    return steering
      .divide(total)
      .setMagnitude(this.maxSpeed)
      .subtract(this.velocity)
      .limit(this.maxForce * 1.45);
  }

  seek(target, strength = 1, slowRadius = 0) {
    const desired = Vector.subtract(target, this.position);
    const distance = desired.magnitude();
    if (distance === 0) {
      return new Vector();
    }

    let speed = this.maxSpeed;
    if (slowRadius > 0 && distance < slowRadius) {
      speed = Math.max(this.maxSpeed * 0.2, (distance / slowRadius) * this.maxSpeed);
    }

    return desired
      .setMagnitude(speed)
      .subtract(this.velocity)
      .limit(this.maxForce * strength);
  }

  flee(target, strength = 1, radius = 180) {
    const desired = Vector.subtract(this.position, target);
    const distance = desired.magnitude();
    if (distance === 0 || distance > radius) {
      return new Vector();
    }

    const falloff = 1 - distance / radius;
    return desired
      .setMagnitude(this.maxSpeed)
      .subtract(this.velocity)
      .limit(this.maxForce * strength * (0.35 + falloff));
  }

  flock(boids, weights = {}) {
    const separationForce = this.separation(boids).multiply(weights.separation ?? 1.55);
    const alignmentForce = this.alignment(boids).multiply(weights.alignment ?? 1.0);
    const cohesionForce = this.cohesion(boids).multiply(weights.cohesion ?? 0.85);

    this.applyForce(separationForce);
    this.applyForce(alignmentForce);
    this.applyForce(cohesionForce);
  }

  update(width, height, delta = 1) {
    this.velocity.add(this.acceleration.multiply(delta)).limit(this.maxSpeed);
    this.position.add(this.velocity.clone().multiply(delta));
    this.acceleration.multiply(0);
    this.edges(width, height);
  }
}

export function createFlock(count, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, options = {}) {
  return Array.from({ length: count }, () => new Boid({ width, height, ...options }));
}

export function resizeFlock(boids, count, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, options = {}) {
  const next = boids.slice(0, count);
  while (next.length < count) {
    next.push(new Boid({ width, height, ...options }));
  }
  return next;
}

export function simulateStep(boids, environment = {}) {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    mode = "idle",
    target = new Vector(width / 2, height / 2),
    delta = 1,
    weights
  } = environment;

  for (const boid of boids) {
    boid.flock(boids, weights);

    if (mode === "follow") {
      boid.applyForce(boid.seek(target, 0.72, 220));
    } else if (mode === "gather") {
      boid.applyForce(boid.seek(target, 2.6, 90));
    } else if (mode === "scatter") {
      boid.applyForce(boid.flee(target, 4.2, 260));
    }
  }

  for (const boid of boids) {
    boid.update(width, height, delta);
  }

  return boids;
}
