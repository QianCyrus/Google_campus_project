import test from "node:test";
import assert from "node:assert/strict";
import { Boid, Vector, createFlock, resizeFlock, simulateStep } from "../public/boids.js";

test("createFlock returns boids inside the simulation bounds", () => {
  const flock = createFlock(12, 320, 180, { rng: () => 0.5 });

  assert.equal(flock.length, 12);
  for (const boid of flock) {
    assert.ok(boid.position.x >= 0 && boid.position.x <= 320);
    assert.ok(boid.position.y >= 0 && boid.position.y <= 180);
  }
});

test("separation steers away from nearby neighbors", () => {
  const boid = new Boid({ x: 100, y: 100, velocity: new Vector(0, 0), separationRadius: 40, maxForce: 1 });
  const neighbor = new Boid({ x: 110, y: 100, velocity: new Vector(0, 0), separationRadius: 40, maxForce: 1 });

  const force = boid.separation([boid, neighbor]);

  assert.ok(force.x < 0);
  assert.equal(force.y, 0);
});

test("alignment steers toward the average neighbor velocity", () => {
  const boid = new Boid({ x: 100, y: 100, velocity: new Vector(1, 0), perceptionRadius: 80, maxForce: 1 });
  const neighbor = new Boid({ x: 120, y: 100, velocity: new Vector(0, 2), perceptionRadius: 80, maxForce: 1 });

  const force = boid.alignment([boid, neighbor]);

  assert.ok(force.y > 0);
});

test("cohesion steers toward the center of nearby neighbors", () => {
  const boid = new Boid({ x: 100, y: 100, velocity: new Vector(0, 0), perceptionRadius: 120, maxForce: 1 });
  const neighbor = new Boid({ x: 160, y: 100, velocity: new Vector(0, 0), perceptionRadius: 120, maxForce: 1 });

  const force = boid.cohesion([boid, neighbor]);

  assert.ok(force.x > 0);
  assert.equal(force.y, 0);
});

test("resizeFlock grows and trims the existing flock", () => {
  const flock = createFlock(3, 320, 180, { rng: () => 0.25 });
  const grown = resizeFlock(flock, 5, 320, 180, { rng: () => 0.75 });
  const trimmed = resizeFlock(grown, 2, 320, 180);

  assert.equal(grown.length, 5);
  assert.equal(grown[0], flock[0]);
  assert.equal(trimmed.length, 2);
  assert.equal(trimmed[1], flock[1]);
});

test("simulateStep moves boids away from the target in scatter mode", () => {
  const boid = new Boid({
    x: 112,
    y: 100,
    velocity: new Vector(0, 0),
    maxSpeed: 5,
    maxForce: 1,
    perceptionRadius: 1,
    separationRadius: 1
  });

  simulateStep([boid], {
    width: 400,
    height: 300,
    mode: "scatter",
    target: new Vector(100, 100),
    delta: 1
  });

  assert.ok(boid.position.x > 112);
});
