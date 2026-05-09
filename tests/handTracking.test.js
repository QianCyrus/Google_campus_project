import test from "node:test";
import assert from "node:assert/strict";
import { classifyGesture } from "../public/handTracking.js";

function makeLandmarks(extendedFingers = {}) {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  landmarks[0] = { x: 0, y: 0 };

  const fingers = [
    ["index", 6, 8, 0.1],
    ["middle", 10, 12, 0.2],
    ["ring", 14, 16, 0.3],
    ["pinky", 18, 20, 0.4]
  ];

  for (const [name, pipIndex, tipIndex, x] of fingers) {
    const isExtended = Boolean(extendedFingers[name]);
    landmarks[pipIndex] = { x, y: 0.2 };
    landmarks[tipIndex] = { x, y: isExtended ? 0.5 : 0.12 };
  }

  return landmarks;
}

test("classifyGesture maps an open hand to scatter", () => {
  const gesture = classifyGesture(makeLandmarks({
    index: true,
    middle: true,
    ring: true,
    pinky: true
  }));

  assert.equal(gesture, "scatter");
});

test("classifyGesture maps an index point to follow", () => {
  const gesture = classifyGesture(makeLandmarks({ index: true }));

  assert.equal(gesture, "follow");
});

test("classifyGesture maps a closed hand to gather", () => {
  const gesture = classifyGesture(makeLandmarks());

  assert.equal(gesture, "gather");
});
