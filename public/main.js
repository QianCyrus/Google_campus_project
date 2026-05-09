import { Vector, createFlock, resizeFlock, simulateStep } from "./boids.js";
import { createControls } from "./controls.js";
import { HandTrackingController } from "./handTracking.js";

const canvas = document.querySelector("#flockCanvas");
const targetMarker = document.querySelector("#targetMarker");
const context = canvas.getContext("2d", { alpha: false });

const state = {
  width: window.innerWidth,
  height: window.innerHeight,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  mode: "follow",
  birdCount: 140,
  maxSpeed: 3.2,
  perceptionRadius: 70,
  target: new Vector(window.innerWidth * 0.52, window.innerHeight * 0.56),
  lastFrame: performance.now(),
  fpsTime: performance.now(),
  fpsFrames: 0,
  particles: []
};

let boids = createFlock(state.birdCount, state.width, state.height, {
  maxSpeed: state.maxSpeed,
  perceptionRadius: state.perceptionRadius
});

function resizeCanvas() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  if (state.target.x === 0 && state.target.y === 0) {
    state.target = new Vector(state.width / 2, state.height / 2);
  }
}

function applyBoidParameters() {
  for (const boid of boids) {
    boid.setParameters({
      maxSpeed: state.maxSpeed,
      perceptionRadius: state.perceptionRadius,
      separationRadius: Math.max(18, state.perceptionRadius * 0.42)
    });
  }
}

function updateTargetMarker() {
  targetMarker.style.left = `${state.target.x}px`;
  targetMarker.style.top = `${state.target.y}px`;
  targetMarker.classList.toggle("idle", state.mode === "idle");
  targetMarker.classList.toggle("gather", state.mode === "gather");
  targetMarker.classList.toggle("scatter", state.mode === "scatter");
}

function setMode(mode) {
  state.mode = mode;
  updateTargetMarker();
}

const controls = createControls({
  state,
  onModeChange: setMode,
  onBirdCountChange(count) {
    state.birdCount = count;
    boids = resizeFlock(boids, count, state.width, state.height, {
      maxSpeed: state.maxSpeed,
      perceptionRadius: state.perceptionRadius,
      separationRadius: Math.max(18, state.perceptionRadius * 0.42)
    });
  },
  onSpeedChange(value) {
    state.maxSpeed = value;
    applyBoidParameters();
  },
  onRadiusChange(value) {
    state.perceptionRadius = value;
    applyBoidParameters();
  },
  async onCameraToggle() {
    const enabled = await handTracking.toggle();
    controls.showToast(enabled ? "Camera gestures enabled." : "Camera gestures disabled.");
    return enabled;
  }
});

const handTracking = new HandTrackingController({
  canvas,
  onTarget({ x, y }) {
    state.target.x = x;
    state.target.y = y;
    updateTargetMarker();
  },
  onMode(mode) {
    if (mode !== state.mode) {
      controls.setMode(mode);
    }
  },
  onError(error) {
    controls.showToast(error.message || "Camera input is unavailable.");
  }
});

function setTargetFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  state.target.x = event.clientX - rect.left;
  state.target.y = event.clientY - rect.top;
  updateTargetMarker();
}

canvas.addEventListener("pointermove", setTargetFromEvent);
canvas.addEventListener("pointerdown", (event) => {
  setTargetFromEvent(event);
  if (state.mode === "idle") {
    controls.setMode("follow");
  }
});

window.addEventListener("resize", () => {
  resizeCanvas();
  applyBoidParameters();
});

function modeColor() {
  if (state.mode === "gather") {
    return "#ffc857";
  }
  if (state.mode === "scatter") {
    return "#ff6b6b";
  }
  if (state.mode === "idle") {
    return "#b8c0bc";
  }
  return "#7ff0c4";
}

function addScatterParticles() {
  for (let index = 0; index < 5; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.4 + Math.random() * 2.8;
    state.particles.push({
      x: state.target.x,
      y: state.target.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 34 + Math.random() * 18,
      maxLife: 52,
      color: "#ff6b6b"
    });
  }
}

function drawBackground(delta) {
  context.globalCompositeOperation = "source-over";
  context.fillStyle = `rgba(16, 17, 19, ${Math.min(0.32, 0.13 + delta * 0.06)})`;
  context.fillRect(0, 0, state.width, state.height);

  const gradient = context.createLinearGradient(0, 0, state.width, state.height);
  gradient.addColorStop(0, "rgba(127, 240, 196, 0.04)");
  gradient.addColorStop(0.48, "rgba(255, 200, 87, 0.025)");
  gradient.addColorStop(1, "rgba(255, 107, 107, 0.035)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, state.width, state.height);
}

function drawTarget() {
  const color = modeColor();
  context.save();
  context.globalCompositeOperation = "lighter";
  context.strokeStyle = color;
  context.lineWidth = state.mode === "gather" ? 3 : 2;
  context.globalAlpha = state.mode === "idle" ? 0.25 : 0.65;
  context.beginPath();
  context.arc(state.target.x, state.target.y, state.mode === "scatter" ? 34 : 25, 0, Math.PI * 2);
  context.stroke();

  if (state.mode === "gather") {
    context.globalAlpha = 0.13;
    context.fillStyle = color;
    context.beginPath();
    context.arc(state.target.x, state.target.y, 118, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawBoid(boid) {
  const angle = Math.atan2(boid.velocity.y, boid.velocity.x);
  const size = boid.size;
  const color = modeColor();

  context.save();
  context.translate(boid.position.x, boid.position.y);
  context.rotate(angle);
  context.globalCompositeOperation = "lighter";
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = 8;
  context.beginPath();
  context.moveTo(size * 1.35, 0);
  context.lineTo(-size * 0.85, -size * 0.52);
  context.lineTo(-size * 0.35, 0);
  context.lineTo(-size * 0.85, size * 0.52);
  context.closePath();
  context.fill();
  context.restore();
}

function updateParticles(delta) {
  if (state.mode === "scatter") {
    addScatterParticles();
  }

  for (const particle of state.particles) {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 0.986;
    particle.vy *= 0.986;
    particle.life -= delta;
  }

  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function drawParticles() {
  context.save();
  context.globalCompositeOperation = "lighter";
  for (const particle of state.particles) {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    context.globalAlpha = alpha * 0.58;
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, 2.2 + alpha * 2.6, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function updateFps(now) {
  state.fpsFrames += 1;
  if (now - state.fpsTime >= 500) {
    controls.setFps(String(Math.round((state.fpsFrames * 1000) / (now - state.fpsTime))));
    state.fpsFrames = 0;
    state.fpsTime = now;
  }
}

function frame(now) {
  const rawDelta = (now - state.lastFrame) / 16.6667;
  const delta = Math.min(2.4, Math.max(0.45, rawDelta || 1));
  state.lastFrame = now;

  simulateStep(boids, {
    width: state.width,
    height: state.height,
    mode: state.mode,
    target: state.target,
    delta,
    weights: {
      separation: state.mode === "gather" ? 1.1 : 1.58,
      alignment: state.mode === "scatter" ? 0.6 : 0.98,
      cohesion: state.mode === "scatter" ? 0.22 : 0.88
    }
  });

  drawBackground(delta);
  drawTarget();
  updateParticles(delta);
  drawParticles();
  for (const boid of boids) {
    drawBoid(boid);
  }
  updateFps(now);

  window.requestAnimationFrame(frame);
}

resizeCanvas();
updateTargetMarker();
drawBackground(1);
window.requestAnimationFrame(frame);
