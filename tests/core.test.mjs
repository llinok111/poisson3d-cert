import test from 'node:test';
import assert from 'node:assert/strict';
import {
  samplePoisson3D, sampleDartThrowing, certify, packingFraction, mulberry32,
} from '../src/core.mjs';

const box = {x: 1, y: 1, z: 1};

test('every accepted point keeps the requested minimum distance', () => {
  for (const r of [0.12, 0.08, 0.06, 0.05]) {
    for (const seed of [1, 2, 3]) {
      const out = samplePoisson3D(box, r, {seed, k: 20});
      const c = certify(out.points, r, box);
      assert.equal(c.ok, true, `r=${r} seed=${seed} violations=${c.violations}`);
      assert.ok(c.minDistance >= r, `minDistance ${c.minDistance} < r ${r}`);
    }
  }
});

test('same seed is byte-for-byte deterministic', () => {
  const a = samplePoisson3D(box, 0.07, {seed: 42});
  const b = samplePoisson3D(box, 0.07, {seed: 42});
  assert.deepEqual(a.points, b.points);
  assert.equal(a.attempts, b.attempts);
});

test('different seeds produce different sets', () => {
  const a = samplePoisson3D(box, 0.07, {seed: 1});
  const b = samplePoisson3D(box, 0.07, {seed: 2});
  assert.notDeepEqual(a.points, b.points);
});

test('all points stay inside the box', () => {
  const out = samplePoisson3D({x: 2, y: 1, z: 0.5}, 0.08, {seed: 9});
  for (const [x, y, z] of out.points) {
    assert.ok(x >= 0 && x < 2);
    assert.ok(y >= 0 && y < 1);
    assert.ok(z >= 0 && z < 0.5);
  }
});

test('certificate refuses a deliberate violation', () => {
  const c = certify([[0.5, 0.5, 0.5], [0.5, 0.5, 0.51]], 0.05, box);
  assert.equal(c.ok, false);
  assert.equal(c.violations, 1);
  assert.ok(c.worst[0][2] < 0.05);
});

test('radius larger than the diagonal yields one point', () => {
  const out = samplePoisson3D(box, 2, {seed: 1});
  assert.equal(out.points.length, 1);
  assert.equal(certify(out.points, 2, box).ok, true);
});

test('dart throwing honors the target and the radius', () => {
  const out = sampleDartThrowing(box, 0.06, {seed: 5, target: 300, maxAttempts: 500000});
  assert.equal(out.accepted, 300);
  assert.equal(certify(out.points, 0.06, box).ok, true);
});

test('packing fraction is plausible for a maximal disk set', () => {
  const r = 0.05;
  const out = samplePoisson3D(box, r, {seed: 11});
  const f = packingFraction(out.points.length, r, box);
  // Random maximal Poisson-disk sets in 3D land near 0.30-0.40 for this radius;
  // this is a sanity bound, not a claim about optimal sphere packing.
  assert.ok(f > 0.25 && f < 0.45, `fraction ${f}`);
});

test('prng is reproducible', () => {
  const a = mulberry32(7), b = mulberry32(7);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});
