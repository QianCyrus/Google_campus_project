const MODE_POINT_COUNT = 760;
const TEXT_POINT_LIMIT = 980;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const VISIBLE_SHAPES = new Set(["follow", "gather", "scatter", "heart", "thanks"]);
const GESTURE_TEXT = {
  follow: "POINT",
  gather: "CLOSED",
  scatter: "OPEN",
  heart: "心",
  thanks: "THANK YOU!"
};
const SHAPE_COLORS = {
  follow: "#7ff0c4",
  gather: "#ffc857",
  scatter: "#ff6b6b",
  heart: "#d83f63",
  thanks: "#f8faf7"
};

function createParticle(home, fallback = home) {
  const jitter = 18;
  return {
    homeX: home.x,
    homeY: home.y,
    x: fallback.x + (Math.random() - 0.5) * jitter,
    y: fallback.y + (Math.random() - 0.5) * jitter,
    vx: 0,
    vy: 0,
    size: 2.2 + Math.random() * 2.15,
    phase: Math.random() * Math.PI * 2
  };
}

function boundsFor(points) {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y)
  }), {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  });
}

export function buildGesturePoints(gesture, width, height, count = MODE_POINT_COUNT) {
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const scale = Math.min(width, height);
  const points = [];

  for (let index = 0; index < count; index += 1) {
    const fill = Math.sqrt((index + 0.5) / count);
    const angle = index * GOLDEN_ANGLE;

    if (gesture === "gather") {
      const radius = scale * 0.18 * fill;
      points.push({
        x: centerX + Math.cos(angle) * radius * 1.18,
        y: centerY + Math.sin(angle) * radius * 0.82
      });
    } else if (gesture === "scatter") {
      const arm = index % 10;
      const armAngle = (arm / 10) * Math.PI * 2 + fill * 0.34;
      const radius = scale * (0.05 + fill * 0.28);
      const drift = Math.sin(index * 0.73) * scale * 0.018;
      points.push({
        x: centerX + Math.cos(armAngle) * radius + Math.cos(angle) * drift,
        y: centerY + Math.sin(armAngle) * radius + Math.sin(angle) * drift
      });
    } else if (gesture === "follow") {
      const lineProgress = (index % Math.ceil(count * 0.68)) / Math.ceil(count * 0.68);
      const isHead = index > count * 0.68;
      const side = index % 2 === 0 ? -1 : 1;
      const x = centerX - scale * 0.2 + lineProgress * scale * 0.38;
      const y = centerY + Math.sin(lineProgress * Math.PI * 2) * scale * 0.018;

      points.push(isHead ? {
        x: centerX + scale * 0.18 - fill * scale * 0.14,
        y: centerY + side * fill * scale * 0.12
      } : {
        x,
        y: y + Math.sin(angle) * scale * 0.026
      });
    } else {
      const radius = scale * 0.22 * fill;
      points.push({
        x: centerX + Math.cos(angle) * radius * 1.32,
        y: centerY + Math.sin(angle) * radius * 0.72
      });
    }
  }

  return points;
}

export function buildTextPoints(text, width, height, canvas) {
  const sampler = canvas ?? document.createElement("canvas");
  const context = sampler.getContext("2d", { willReadFrequently: true });
  const sampleWidth = 960;
  const sampleHeight = 260;
  sampler.width = sampleWidth;
  sampler.height = sampleHeight;

  context.clearRect(0, 0, sampleWidth, sampleHeight);
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "900 116px Inter, ui-sans-serif, system-ui, sans-serif";
  context.fillText(text, sampleWidth / 2, sampleHeight / 2 + 4);

  const image = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const rawPoints = [];
  const step = 6;

  for (let y = 0; y < sampleHeight; y += step) {
    for (let x = 0; x < sampleWidth; x += step) {
      const alpha = image[(y * sampleWidth + x) * 4 + 3];
      if (alpha > 80) {
        rawPoints.push({ x, y });
      }
    }
  }

  const stride = Math.max(1, Math.ceil(rawPoints.length / TEXT_POINT_LIMIT));
  const sampled = rawPoints.filter((_point, index) => index % stride === 0);
  const bounds = boundsFor(sampled);
  const textWidth = bounds.maxX - bounds.minX || 1;
  const textHeight = bounds.maxY - bounds.minY || 1;
  const scale = Math.min(width * 0.82 / textWidth, height * 0.28 / textHeight);
  const centerX = width * 0.5;
  const centerY = height * 0.46;

  return sampled.map((point) => ({
    x: centerX + (point.x - (bounds.minX + textWidth / 2)) * scale,
    y: centerY + (point.y - (bounds.minY + textHeight / 2)) * scale
  }));
}

export class GestureParticleCloud {
  constructor({ makeCanvas = () => document.createElement("canvas") } = {}) {
    this.makeCanvas = makeCanvas;
    this.particles = [];
    this.colliders = [];
    this.shape = "none";
    this.width = 0;
    this.height = 0;
    this.opacity = 0;
    this.targetOpacity = 0;
  }

  resize(width, height) {
    if (this.width === width && this.height === height) {
      return;
    }

    this.width = width;
    this.height = height;
    if (this.shape !== "none") {
      this.rebuild(this.shape, true);
    }
  }

  setColliders(points) {
    this.colliders = points;
  }

  setGesture(gesture) {
    if (gesture === "none" || !VISIBLE_SHAPES.has(gesture)) {
      this.targetOpacity = 0;
    } else {
      this.rebuild(gesture);
      this.targetOpacity = gesture === "heart" || gesture === "thanks" ? 1 : 0.84;
    }
  }

  rebuild(shape, force = false) {
    if (!force && this.shape === shape && this.particles.length > 0) {
      return;
    }

    const homes = buildTextPoints(
      GESTURE_TEXT[shape] ?? String(shape).toUpperCase(),
      this.width,
      this.height,
      this.makeCanvas()
    );
    const previous = this.particles;

    this.shape = shape;
    this.particles = homes.map((home, index) => createParticle(home, previous[index % Math.max(1, previous.length)]));
  }

  update(delta) {
    this.opacity += (this.targetOpacity - this.opacity) * Math.min(1, 0.08 * delta);
    if (this.opacity < 0.01 && this.targetOpacity === 0) {
      return;
    }

    const collisionRadius = Math.min(this.width, this.height) * 0.105;
    const collisionRadiusSquared = collisionRadius * collisionRadius;
    const spring = 0.038 * delta;
    const damping = 0.84 ** delta;

    for (const particle of this.particles) {
      let forceX = (particle.homeX - particle.x) * spring;
      let forceY = (particle.homeY - particle.y) * spring;

      for (const collider of this.colliders) {
        const dx = particle.x - collider.x;
        const dy = particle.y - collider.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > 0.001 && distanceSquared < collisionRadiusSquared) {
          const distance = Math.sqrt(distanceSquared);
          const strength = ((1 - distance / collisionRadius) ** 2) * 7.5 * delta;
          forceX += (dx / distance) * strength;
          forceY += (dy / distance) * strength;
        }
      }

      particle.vx = (particle.vx + forceX) * damping;
      particle.vy = (particle.vy + forceY) * damping;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
    }
  }

  draw(context, now) {
    if (this.opacity < 0.01 || this.particles.length === 0) {
      return;
    }

    const color = SHAPE_COLORS[this.shape] ?? "#f8faf7";
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const particle of this.particles) {
      const pulse = 0.76 + Math.sin(now * 0.002 + particle.phase) * 0.24;
      const alpha = this.opacity * 0.9 * pulse;
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
}
