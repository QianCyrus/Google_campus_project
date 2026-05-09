const MEDIAPIPE_VERSION = "0.10.14";
const TASKS_VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`;
const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

function fingerIsExtended(landmarks, tipIndex, pipIndex, wristIndex = 0) {
  const tip = landmarks[tipIndex];
  const pip = landmarks[pipIndex];
  const wrist = landmarks[wristIndex];
  const tipDistance = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
  const pipDistance = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
  return tipDistance > pipDistance * 1.12;
}

function classifyGesture(landmarks) {
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
  constructor({ canvas, onTarget, onMode, onError }) {
    this.canvas = canvas;
    this.onTarget = onTarget;
    this.onMode = onMode;
    this.onError = onError;
    this.video = document.createElement("video");
    this.video.setAttribute("playsinline", "");
    this.video.muted = true;
    this.stream = null;
    this.handLandmarker = null;
    this.running = false;
    this.lastVideoTime = -1;
    this.frameHandle = 0;
  }

  async start() {
    if (!window.isSecureContext && location.hostname !== "localhost") {
      throw new Error("Camera input requires HTTPS or localhost.");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera input is not available in this browser.");
    }

    const { FilesetResolver, HandLandmarker } = await import(TASKS_VISION_URL);
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
    this.handLandmarker = await this.createHandLandmarker(HandLandmarker, vision);

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user"
      },
      audio: false
    });

    this.video.srcObject = this.stream;
    await this.video.play();
    this.running = true;
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
      this.stop();
      this.onError?.(error);
      return false;
    }
  }

  detect() {
    if (!this.running || !this.handLandmarker) {
      return;
    }

    if (this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      const result = this.handLandmarker.detectForVideo(this.video, performance.now());
      const landmarks = result.landmarks?.[0];

      if (landmarks) {
        const fingertip = landmarks[8];
        const rect = this.canvas.getBoundingClientRect();
        const x = (1 - fingertip.x) * rect.width;
        const y = fingertip.y * rect.height;
        const mode = classifyGesture(landmarks);

        this.onTarget?.({ x, y, source: "camera" });
        this.onMode?.(mode);
      }
    }

    this.frameHandle = window.requestAnimationFrame(() => this.detect());
  }
}
