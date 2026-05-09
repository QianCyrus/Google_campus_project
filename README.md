# Gesture Boids Simulator

Browser-based Boids flock simulation for the assignment **Boidsアルゴリズムを用いた鳥の群れのシミュレーション作成**.

## Features

- Canvas-rendered flock animation
- Boids rules: Separation, Alignment, Cohesion
- Modes: Idle, Follow, Gather, Scatter
- Mouse, keyboard, buttons, and sliders
- Optional browser-side camera gesture control with MediaPipe Hand Landmarker
- Node.js server ready for Google Cloud Run
- Unit tests for the Boids algorithm

## Run Locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:8080
```

If dependencies are not installed, `server.js` can still serve the app with its built-in static fallback:

```bash
node server.js
```

## Test

```bash
npm test
```

## Controls

| Input | Action |
| --- | --- |
| Pointer move | Move target point |
| Pointer down in Idle | Switch to Follow |
| I | Idle |
| F | Follow |
| G | Gather |
| S | Scatter |
| Sliders | Adjust birds, speed, and perception radius |
| Camera button | Toggle browser-side hand tracking |

Camera control requires HTTPS or localhost. Cloud Run provides HTTPS by default. Video is processed in the browser and is not sent to the Node.js server.

## Cloud Run Deployment

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud run deploy gesture-boids-simulator \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated
```

## Repository Structure

```text
public/
  index.html
  styles.css
  main.js
  boids.js
  controls.js
  handTracking.js
specs/
  specification.md
tests/
  boids.test.js
  test-plan.md
server.js
Dockerfile
README.md
```
