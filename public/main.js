import { Vector, createFlock, resizeFlock, simulateStep } from "./boids.js";
import { calculateCoverCrop } from "./cameraParticles.js";
import { createControls } from "./controls.js";
import { GestureParticleCloud } from "./gestureParticles.js";
import { HandTrackingController } from "./handTracking.js";

const canvas = document.querySelector("#flockCanvas");
const targetMarker = document.querySelector("#targetMarker");
const cameraPreview = document.querySelector("#cameraPreview");
const appShell = document.querySelector(".app-shell");
const context = canvas.getContext("2d", { alpha: false });

const DEFAULT_BIRD_COUNT = 80;
const DPR_CAP = 1.5;
const CAMERA_DPR_CAP = 1.5;

const state = {
  width: window.innerWidth,
  height: window.innerHeight,
  dpr: Math.min(window.devicePixelRatio || 1, DPR_CAP),
  mode: "follow",
  birdCount: DEFAULT_BIRD_COUNT,
  maxSpeed: 3.2,
  perceptionRadius: 70,
  cameraEnabled: false,
  cameraBackground: false,
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
const gestureCloud = new GestureParticleCloud();

function resizeCanvas() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  state.dpr = Math.min(window.devicePixelRatio || 1, state.cameraEnabled ? CAMERA_DPR_CAP : DPR_CAP);
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  gestureCloud.resize(state.width, state.height);

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
  appShell.style.setProperty("--target-x", `${state.target.x}px`);
  appShell.style.setProperty("--target-y", `${state.target.y}px`);
  targetMarker.classList.toggle("idle", state.mode === "idle");
  targetMarker.classList.toggle("gather", state.mode === "gather");
  targetMarker.classList.toggle("scatter", state.mode === "scatter");
}

function setMode(mode) {
  state.mode = mode;
  updateTargetMarker();
}

function clearCanvas() {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.restore();
}

function setCameraBackground(enabled) {
  state.cameraBackground = Boolean(enabled && state.cameraEnabled);
  appShell.classList.toggle("camera-background", state.cameraBackground);
  clearCanvas();
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
    state.cameraEnabled = enabled;
    if (!enabled) {
      setCameraBackground(false);
      controls.setCameraBackground(false);
    }
    resizeCanvas();
    if (enabled) {
      controls.showToast("Camera gestures enabled.");
    } else if (!handTracking.lastError) {
      controls.showToast("Camera gestures disabled.");
    }
    return enabled;
  },
  async onCameraBackgroundToggle(enabled) {
    if (!enabled) {
      setCameraBackground(false);
      controls.showToast("Web background enabled.");
      return false;
    }

    controls.setCameraStatus("Starting camera");
    if (!state.cameraEnabled) {
      const cameraEnabled = await handTracking.toggle();
      state.cameraEnabled = cameraEnabled;
      controls.setCameraEnabled(cameraEnabled);
      resizeCanvas();
      if (!cameraEnabled) {
        setCameraBackground(false);
        return false;
      }
    }

    setCameraBackground(true);
    controls.showToast("Live camera background enabled.");
    return true;
  }
});

const handTracking = new HandTrackingController({
  canvas,
  videoElement: cameraPreview,
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
  onGesture(gesture) {
    controls.setGesture(gesture);
    gestureCloud.setGesture(gesture);
  },
  onStatus(message) {
    controls.setCameraStatus(message);
  },
  onError(error) {
    controls.setCameraStatus(error.message || "Camera input is unavailable.");
    controls.showToast(error.message || "Camera input is unavailable.");
  }
});

if ("requestIdleCallback" in window) {
  window.requestIdleCallback(() => handTracking.preload(), { timeout: 1800 });
} else {
  window.setTimeout(() => handTracking.preload(), 700);
}

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

function modeRgb() {
  if (state.mode === "gather") {
    return [217, 159, 50];
  }
  if (state.mode === "scatter") {
    return [220, 77, 77];
  }
  if (state.mode === "idle") {
    return [166, 176, 172];
  }
  return [69, 214, 160];
}

function modeColor() {
  const [red, green, blue] = modeRgb();
  return `rgb(${red}, ${green}, ${blue})`;
}

function modeRgba(alpha) {
  const [red, green, blue] = modeRgb();
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function addScatterParticles() {
  const count = state.cameraBackground ? 2 : 3;
  for (let index = 0; index < count; index += 1) {
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

function drawLiveCameraFrame() {
  context.fillStyle = "#050607";
  context.fillRect(0, 0, state.width, state.height);

  if (cameraPreview.readyState < 2 || !cameraPreview.videoWidth || !cameraPreview.videoHeight) {
    const waiting = context.createRadialGradient(
      state.width * 0.5,
      state.height * 0.48,
      0,
      state.width * 0.5,
      state.height * 0.48,
      Math.max(state.width, state.height) * 0.72
    );
    waiting.addColorStop(0, "rgba(48, 72, 76, 0.28)");
    waiting.addColorStop(1, "rgba(5, 6, 7, 1)");
    context.fillStyle = waiting;
    context.fillRect(0, 0, state.width, state.height);
    return;
  }

  const crop = calculateCoverCrop(
    cameraPreview.videoWidth,
    cameraPreview.videoHeight,
    state.width,
    state.height
  );

  context.save();
  context.imageSmoothingEnabled = true;
  context.translate(state.width, 0);
  context.scale(-1, 1);
  context.drawImage(
    cameraPreview,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    state.width,
    state.height
  );
  context.restore();

  context.fillStyle = "rgba(0, 0, 0, 0.16)";
  context.fillRect(0, 0, state.width, state.height);

  const vignette = context.createRadialGradient(
    state.width * 0.52,
    state.height * 0.46,
    Math.min(state.width, state.height) * 0.18,
    state.width * 0.52,
    state.height * 0.46,
    Math.max(state.width, state.height) * 0.72
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.36)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, state.width, state.height);
}

function drawBackground(delta) {
  if (state.cameraBackground) {
    context.globalCompositeOperation = "source-over";
    drawLiveCameraFrame();
    return;
  }

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

function drawFlowField() {
  const radius = state.mode === "scatter" ? 280 : 360;
  const baseAlpha = state.cameraBackground ? 0.035 : 0.055;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";
  for (let index = 0; index < boids.length; index += 3) {
    const boid = boids[index];
    const distance = boid.position.distanceTo(state.target);
    if (distance > radius) {
      continue;
    }

    const influence = 1 - distance / radius;
    context.strokeStyle = modeRgba(baseAlpha + influence * 0.08);
    context.lineWidth = 0.55 + influence * 1.25;
    context.beginPath();
    context.moveTo(
      boid.position.x + boid.velocity.x * 1.5,
      boid.position.y + boid.velocity.y * 1.5
    );
    context.lineTo(state.target.x, state.target.y);
    context.stroke();
  }
  context.restore();
}

function drawBoidTrail(boid, index) {
  const angle = Math.atan2(boid.velocity.y, boid.velocity.x);
  const speed = boid.velocity.magnitude();
  const distance = boid.position.distanceTo(state.target);
  const influenceRadius = state.mode === "scatter" ? 280 : 420;
  const influence = Math.max(0, 1 - distance / influenceRadius);
  const length = 18 + speed * 5.4 + influence * 24;
  const curve = Math.sin(index * 0.83 + performance.now() * 0.0012) * (5 + influence * 11);
  const tailX = boid.position.x - Math.cos(angle) * length;
  const tailY = boid.position.y - Math.sin(angle) * length;
  const controlX = boid.position.x - Math.cos(angle) * length * 0.45 - Math.sin(angle) * curve;
  const controlY = boid.position.y - Math.sin(angle) * length * 0.45 + Math.cos(angle) * curve;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";
  context.strokeStyle = modeRgba((state.cameraBackground ? 0.16 : 0.2) + influence * 0.18);
  context.lineWidth = 0.8 + influence * 1.7;
  context.beginPath();
  context.moveTo(tailX, tailY);
  context.quadraticCurveTo(controlX, controlY, boid.position.x, boid.position.y);
  context.stroke();
  context.restore();
}

function drawBoid(boid) {
  const angle = Math.atan2(boid.velocity.y, boid.velocity.x);
  const size = boid.size;
  const color = modeColor();
  const useGlow = !state.cameraEnabled && state.birdCount <= 100;

  context.save();
  context.translate(boid.position.x, boid.position.y);
  context.rotate(angle);
  context.globalCompositeOperation = "lighter";
  context.fillStyle = color;
  if (useGlow) {
    context.shadowColor = color;
    context.shadowBlur = 6;
  }
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
    context.globalAlpha = alpha * (state.cameraBackground ? 0.32 : 0.42);
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
  drawFlowField();
  drawTarget();
  updateParticles(delta);
  drawParticles();
  gestureCloud.update(delta);
  for (const [index, boid] of boids.entries()) {
    drawBoidTrail(boid, index);
    drawBoid(boid);
  }
  gestureCloud.draw(context, now);
  updateFps(now);

  window.requestAnimationFrame(frame);
}

resizeCanvas();
updateTargetMarker();
drawBackground(1);
window.requestAnimationFrame(frame);
