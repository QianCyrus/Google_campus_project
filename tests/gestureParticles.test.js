import test from "node:test";
import assert from "node:assert/strict";
import { GestureParticleCloud, buildGesturePoints } from "../public/gestureParticles.js";

function makeCanvas(record = []) {
  const canvas = {
    width: 0,
    height: 0,
    getContext() {
      return {
        clearRect() {},
        fillText(text) {
          record.push(text);
        },
        getImageData() {
          const data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
          const minX = Math.floor(canvas.width * 0.2);
          const maxX = Math.floor(canvas.width * 0.8);
          const minY = Math.floor(canvas.height * 0.34);
          const maxY = Math.floor(canvas.height * 0.66);

          for (let y = minY; y < maxY; y += 1) {
            for (let x = minX; x < maxX; x += 1) {
              data[(y * canvas.width + x) * 4 + 3] = 255;
            }
          }

          return { data };
        }
      };
    }
  };

  return canvas;
}

test("buildGesturePoints returns finite fallback clouds for boid gestures", () => {
  for (const gesture of ["follow", "gather", "scatter"]) {
    const points = buildGesturePoints(gesture, 900, 600, 160);

    assert.equal(points.length, 160);
    assert.ok(points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
  }
});

test("GestureParticleCloud uses text particles for hand gestures", () => {
  const renderedTexts = [];
  const cloud = new GestureParticleCloud({ makeCanvas: () => makeCanvas(renderedTexts) });

  cloud.resize(900, 600);
  cloud.setGesture("follow");
  cloud.setGesture("gather");
  cloud.setGesture("scatter");
  cloud.setGesture("heart");
  cloud.setGesture("thanks");

  assert.deepEqual(renderedTexts, ["POINT", "CLOSED", "OPEN", "心", "THANK YOU!"]);
  assert.ok(cloud.particles.length > 0);
  assert.ok(cloud.particles.every((particle) => particle.size >= 2.2));
});
