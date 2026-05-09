import test from "node:test";
import assert from "node:assert/strict";
import { classifyGesture, classifyHands } from "../public/handTracking.js";

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

function makeThumbsUpLandmarks() {
  const landmarks = makeLandmarks();
  landmarks[0] = { x: 0.5, y: 0.8 };
  landmarks[2] = { x: 0.46, y: 0.58 };
  landmarks[3] = { x: 0.46, y: 0.38 };
  landmarks[4] = { x: 0.46, y: 0.2 };

  for (const [pipIndex, tipIndex, x] of [[6, 8, 0.54], [10, 12, 0.59], [14, 16, 0.64], [18, 20, 0.69]]) {
    landmarks[pipIndex] = { x, y: 0.58 };
    landmarks[tipIndex] = { x, y: 0.68 };
  }

  return landmarks;
}

function makeHeartHands() {
  const left = makeLandmarks();
  const right = makeLandmarks();

  left[8] = { x: 0.47, y: 0.35 };
  right[8] = { x: 0.54, y: 0.35 };
  left[4] = { x: 0.49, y: 0.52 };
  right[4] = { x: 0.56, y: 0.52 };

  return [left, right];
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

test("classifyGesture maps a thumbs up to thanks", () => {
  const gesture = classifyGesture(makeThumbsUpLandmarks());

  assert.equal(gesture, "thanks");
});

test("classifyHands maps two hands forming a heart to heart", () => {
  const gesture = classifyHands(makeHeartHands());

  assert.equal(gesture, "heart");
});
