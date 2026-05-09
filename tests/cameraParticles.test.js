import test from "node:test";
import assert from "node:assert/strict";
import { calculateCoverCrop } from "../public/cameraParticles.js";

test("calculateCoverCrop crops wide video to the target ratio", () => {
  const crop = calculateCoverCrop(1280, 720, 800, 800);

  assert.equal(crop.y, 0);
  assert.equal(crop.height, 720);
  assert.ok(crop.x > 0);
  assert.ok(crop.width < 1280);
});

test("calculateCoverCrop crops tall video to the target ratio", () => {
  const crop = calculateCoverCrop(720, 1280, 1200, 600);

  assert.equal(crop.x, 0);
  assert.equal(crop.width, 720);
  assert.ok(crop.y > 0);
  assert.ok(crop.height < 1280);
});
