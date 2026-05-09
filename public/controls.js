const MODE_LABELS = {
  idle: "Idle",
  follow: "Follow",
  gather: "Gather",
  scatter: "Scatter"
};

const GESTURE_LABELS = {
  none: "None",
  follow: "Point",
  gather: "Closed",
  scatter: "Open",
  heart: "心",
  thanks: "Thank you"
};

export function createControls({
  state,
  onModeChange,
  onBirdCountChange,
  onSpeedChange,
  onRadiusChange,
  onCameraToggle,
  onCameraBackgroundToggle
}) {
  const modeButtons = [...document.querySelectorAll(".mode-button")];
  const modeLabel = document.querySelector("#modeLabel");
  const birdCountLabel = document.querySelector("#birdCountLabel");
  const fpsLabel = document.querySelector("#fpsLabel");
  const birdCountInput = document.querySelector("#birdCount");
  const speedInput = document.querySelector("#speed");
  const radiusInput = document.querySelector("#radius");
  const cameraButton = document.querySelector("#cameraButton");
  const backgroundButton = document.querySelector("#backgroundButton");
  const cameraPanel = document.querySelector("#cameraPanel");
  const cameraStatus = document.querySelector("#cameraStatus");
  const gestureLabel = document.querySelector("#gestureLabel");
  const toast = document.querySelector("#toast");
  let toastTimeout = 0;

  function setMode(mode) {
    state.mode = mode;
    modeLabel.textContent = MODE_LABELS[mode] ?? mode;
    for (const button of modeButtons) {
      button.classList.toggle("active", button.dataset.mode === mode);
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    }
    onModeChange?.(mode);
  }

  function setCameraEnabled(enabled) {
    cameraButton.classList.toggle("enabled", enabled);
    cameraButton.textContent = enabled ? "Camera On" : "Camera Off";
    cameraButton.setAttribute("aria-pressed", String(enabled));
    cameraPanel?.classList.toggle("active", enabled);
    if (!enabled) {
      setCameraBackground(false);
    }
  }

  function setCameraBackground(enabled) {
    backgroundButton.classList.toggle("enabled", enabled);
    backgroundButton.textContent = enabled ? "Web BG" : "Camera BG";
    backgroundButton.setAttribute("aria-pressed", String(enabled));
  }

  function setCameraStatus(message) {
    if (cameraStatus) {
      cameraStatus.textContent = message;
    }
  }

  function setGesture(gesture) {
    if (gestureLabel) {
      gestureLabel.textContent = GESTURE_LABELS[gesture] ?? gesture;
    }
  }

  function setBirdCount(count) {
    birdCountLabel.textContent = String(count);
    birdCountInput.value = String(count);
  }

  function setFps(value) {
    fpsLabel.textContent = value;
  }

  function showToast(message) {
    window.clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.classList.add("visible");
    toastTimeout = window.setTimeout(() => {
      toast.classList.remove("visible");
    }, 3200);
  }

  for (const button of modeButtons) {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  }

  birdCountInput.addEventListener("input", () => {
    const count = Number.parseInt(birdCountInput.value, 10);
    setBirdCount(count);
    onBirdCountChange?.(count);
  });

  speedInput.addEventListener("input", () => {
    onSpeedChange?.(Number.parseFloat(speedInput.value));
  });

  radiusInput.addEventListener("input", () => {
    onRadiusChange?.(Number.parseInt(radiusInput.value, 10));
  });

  cameraButton.addEventListener("click", async () => {
    cameraButton.disabled = true;
    try {
      const enabled = await onCameraToggle?.();
      setCameraEnabled(Boolean(enabled));
    } catch (error) {
      const message = error?.message || "Camera input is unavailable.";
      setCameraStatus(message);
      showToast(message);
      setCameraEnabled(false);
    } finally {
      cameraButton.disabled = false;
    }
  });

  backgroundButton.addEventListener("click", async () => {
    backgroundButton.disabled = true;
    cameraButton.disabled = true;
    try {
      const enabled = await onCameraBackgroundToggle?.(!backgroundButton.classList.contains("enabled"));
      setCameraBackground(Boolean(enabled));
    } catch (error) {
      const message = error?.message || "Camera background is unavailable.";
      setCameraStatus(message);
      showToast(message);
      setCameraBackground(false);
    } finally {
      backgroundButton.disabled = false;
      cameraButton.disabled = false;
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "i") {
      setMode("idle");
    } else if (key === "f") {
      setMode("follow");
    } else if (key === "g") {
      setMode("gather");
    } else if (key === "s") {
      setMode("scatter");
    }
  });

  setMode(state.mode);
  setBirdCount(state.birdCount);
  setCameraEnabled(false);
  setCameraBackground(false);
  setCameraStatus("Camera idle");
  setGesture("none");

  return {
    setMode,
    setCameraEnabled,
    setCameraBackground,
    setCameraStatus,
    setGesture,
    setBirdCount,
    setFps,
    showToast
  };
}
