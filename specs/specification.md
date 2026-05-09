# Gesture Boids Simulator 仕様書

## 1. Project

本项目选择课题 **Boidsアルゴリズムを用いた鳥の群れのシミュレーション作成**。

应用在浏览器中运行，通过 Canvas 实时渲染鸟群。每只鸟按照 Boids 的 Separation、Alignment、Cohesion 三条规则运动，并额外响应鼠标目标点或浏览器端摄像头手势。

## 2. Goal

- 实现可观察的鸟群自然飞行模拟。
- 提供 Idle、Follow、Gather、Scatter 四种交互模式。
- 支持鼠标、键盘、按钮和可选摄像头手势控制。
- 以 Node.js Web 应用形式部署到 Google Cloud Run。
- 提供 README、测试计划、单元测试和部署说明。

## 3. Scope

### MVP

| ID | Requirement | Description |
| --- | --- | --- |
| FR-1 | Bird initialization | 页面加载后生成默认鸟群 |
| FR-2 | Boids rules | 实现 Separation、Alignment、Cohesion |
| FR-3 | Real-time animation | 使用 Canvas 持续渲染鸟群 |
| FR-4 | Mouse control | 鼠标移动更新目标点 |
| FR-5 | Gather mode | 鸟群向目标点聚集 |
| FR-6 | Scatter mode | 鸟群从目标点散开 |
| FR-7 | Status display | 显示模式、鸟数量、FPS |
| FR-8 | Responsive layout | 桌面和移动窗口下可操作 |

### Bonus

| ID | Requirement | Description |
| --- | --- | --- |
| BFR-1 | Camera gesture control | 浏览器端启用摄像头，不上传视频流 |
| BFR-2 | Index finger tracking | 食指指尖映射为目标点 |
| BFR-3 | Fist gather | 低伸展手指数识别为 Gather |
| BFR-4 | Open palm scatter | 多手指伸展识别为 Scatter |

## 4. Non-functional Requirements

| ID | Requirement | Description |
| --- | --- | --- |
| NFR-1 | Performance | 默认 140 只鸟，支持 40 到 220 只鸟 |
| NFR-2 | Deployability | 通过 `npm start` 监听 `PORT`，适合 Cloud Run |
| NFR-3 | Privacy | 摄像头只在浏览器端处理 |
| NFR-4 | Maintainability | 算法、控制、手势识别分模块 |
| NFR-5 | Testability | Boids 核心逻辑由 Node test 覆盖 |

## 5. Interaction

| Operation | Result |
| --- | --- |
| Pointer move | 更新目标点 |
| Pointer down in Idle | 切换到 Follow |
| I / F / G / S | 切换 Idle / Follow / Gather / Scatter |
| Mode buttons | 切换当前模式 |
| Birds slider | 修改鸟数量 |
| Speed slider | 修改最大速度 |
| Radius slider | 修改感知半径 |
| Camera button | 启用或关闭浏览器端手势识别 |

## 6. Algorithm

Each boid stores:

```text
position
velocity
acceleration
maxSpeed
maxForce
perceptionRadius
separationRadius
```

Every animation frame:

1. Separation: avoid neighbors that are too close.
2. Alignment: steer toward average velocity of nearby neighbors.
3. Cohesion: steer toward center of nearby neighbors.
4. Interaction force:
   - Idle: no target force.
   - Follow: softly seek target.
   - Gather: strongly seek target.
   - Scatter: flee target within a radius.
5. Velocity is limited by `maxSpeed`.
6. Boids wrap around screen edges.

## 7. Deployment

Recommended Cloud Run source deployment:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud run deploy gesture-boids-simulator \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated
```

The service reads `PORT` from the environment and serves `public/` through Node.js.
