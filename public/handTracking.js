const MEDIAPIPE_VERSION = "0.10.14";
const TASKS_VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`;
const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const DEFAULT_TRACKING_FPS = 12;
const MODE_STABLE_FRAMES = 2;
const TARGET_SMOOTHING = 0.38;

function fingerIsExtended(landmarks, tipIndex, pipIndex, wristIndex = 0) {
  const tip = landmarks[tipIndex];
  const pip = landmarks[pipIndex];
  const wrist = landmarks[wristIndex];
  const tipDistance = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
  const pipDistance = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
  return tipDistance > pipDistance * 1.12;
}

export function classifyGesture(landmarks) {
  const extended = {
    index: fingerIsExtended(landmarks, 8, 6),
    middle: fingerIsExtended(landmarks, 12, 10),
    ring: fingerIsExtended(landmarks, 16, 14),
    pinky: fingerIsExtended(landmarks, 20, 18)
  };
  const extendedCount = Object.values(extended).filter(Boolean).length;

  if (extendedCount >= 4) {
    return "scatter";
  }
  if (extended.index && extendedCount <= 2) {
    return "follow";
  }
  if (extendedCount <= 1) {
    return "gather";
  }
  return "follow";
}

export class HandTrackingController {
  constructor({ canvas, videoElement, onTarget, onMode, onGesture, onStatus, onError, trackingFps = DEFAULT_TRACKING_FPS }) {
    this.canvas = canvas;
    this.video = videoElement ?? document.createElement("video");
    this.onTarget = onTarget;
    this.onMode = onMode;
    this.onGesture = onGesture;
    this.onStatus = onStatus;
    this.onError = onError;
    this.trackingFps = trackingFps;
    this.video.setAttribute("playsinline", "");
    this.video.autoplay = true;
    this.video.muted = true;
    this.stream = null;
    this.handLandmarker = null;
    this.running = false;
    this.lastVideoTime = -1;
    this.lastDetectTime = 0;
    this.frameHandle = 0;
    this.smoothedTarget = null;
    this.pendingMode = null;
    this.pendingModeFrames = 0;
    this.stableMode = null;
    this.lastError = null;
  }

  async start() {
    this.lastError = null;

    if (!window.isSecureContext && location.hostname !== "localhost") {
      throw new Error("Camera input requires HTTPS or localhost.");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera input is not available in this browser.");
    }

    this.onStatus?.("Requesting camera");
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 320, max: 640 },
        height: { ideal: 240, max: 480 },
        frameRate: { ideal: 24, max: 30 },
        facingMode: "user"
      },
      audio: false
    });

    this.video.srcObject = this.stream;
    await this.video.play();

    this.onStatus?.("Loading hand model");
    const { FilesetResolver, HandLandmarker } = await import(TASKS_VISION_URL);
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
    this.handLandmarker = await this.createHandLandmarker(HandLandmarker, vision);

    this.running = true;
    this.lastVideoTime = -1;
    this.lastDetectTime = 0;
    this.smoothedTarget = null;
    this.pendingMode = null;
    this.pendingModeFrames = 0;
    this.stableMode = null;
    this.onStatus?.("Tracking hand");
    this.detect();
  }

  async createHandLandmarker(HandLandmarker, vision) {
    const options = {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 1
    };

    try {
      return await HandLandmarker.createFromOptions(vision, options);
    } catch (_error) {
      return HandLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "CPU"
        }
      });
    }
  }

  stop() {
    this.running = false;
    window.cancelAnimationFrame(this.frameHandle);
    this.handLandmarker?.close();
    this.handLandmarker = null;
    for (const track of this.stream?.getTracks() ?? []) {
      track.stop();
    }
    this.stream = null;
    this.video.srcObject = null;
    this.smoothedTarget = null;
    this.pendingMode = null;
    this.pendingModeFrames = 0;
    this.stableMode = null;
    this.onGesture?.("none");
    this.onStatus?.("Camera idle");
  }

  async toggle() {
    if (this.running) {
      this.stop();
      return false;
    }

    try {
      await this.start();
      return true;
    } catch (error) {
      this.lastError = error;
      this.stop();
      this.onError?.(error);
      return false;
    }
  }

  updateStableMode(mode) {
    if (mode !== this.pendingMode) {
      this.pendingMode = mode;
      this.pendingModeFrames = 1;
    } else {
      this.pendingModeFrames += 1;
    }

    this.onGesture?.(mode);

    if (this.pendingModeFrames < MODE_STABLE_FRAMES || mode === this.stableMode) {
      return;
    }

    this.stableMode = mode;
    this.onMode?.(mode);
  }

  emitTarget(fingertip) {
    const rect = this.canvas.getBoundingClientRect();
    const rawX = (1 - fingertip.x) * rect.width;
    const rawY = fingertip.y * rect.height;
    const target = {
      x: Math.min(rect.width, Math.max(0, rawX)),
      y: Math.min(rect.height, Math.max(0, rawY))
    };

    if (!this.smoothedTarget) {
      this.smoothedTarget = target;
    } else {
      this.smoothedTarget.x += (target.x - this.smoothedTarget.x) * TARGET_SMOOTHING;
      this.smoothedTarget.y += (target.y - this.smoothedTarget.y) * TARGET_SMOOTHING;
    }

    this.onTarget?.({ ...this.smoothedTarget, source: "camera" });
  }

  detect(now = performance.now()) {
    if (!this.running || !this.handLandmarker) {
      return;
    }

    this.frameHandle = window.requestAnimationFrame((time) => this.detect(time));

    const minDetectInterval = 1000 / this.trackingFps;
    if (now - this.lastDetectTime < minDetectInterval || this.video.readyState < 2) {
      return;
    }

    if (this.video.currentTime !== this.lastVideoTime) {
      this.lastDetectTime = now;
      this.lastVideoTime = this.video.currentTime;
      const result = this.handLandmarker.detectForVideo(this.video, performance.now());
      const landmarks = result.landmarks?.[0];

      if (landmarks) {
        const fingertip = landmarks[8];
        const mode = classifyGesture(landmarks);

        this.emitTarget(fingertip);
        this.updateStableMode(mode);
        this.onStatus?.("Tracking hand");
      } else {
        this.onGesture?.("none");
        this.onStatus?.("No hand detected");
      }
    }
  }
}
