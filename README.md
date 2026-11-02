# poisson3d-cert

Deterministic 3D Poisson-disk sampling with a **minimum-distance certificate** — and a
measured answer to the question most samplers dodge: when you already know how many
points you need, is Bridson actually better than grid-accelerated dart throwing?

Short answer from this repository's benchmark: **no, not in speed or coverage at these
radii.** Dart throwing reaches the same count slightly faster. Bridson's real advantage
is that it needs no target count and terminates with a maximal set. The numbers below
are the evidence, including the part that argues against the headline.

Upstream: 原创 (Bridson 2007 algorithm; the certificate, deterministic PRNG and the
negative comparison are this repository's).

## What it does

- `samplePoisson3D(bounds, r, {seed, k})` — Bridson's active-list sampler, uniform
  sphere candidates in the `[r, 2r]` shell, spatial grid of cell `r/√3`.
- `sampleDartThrowing(bounds, r, {seed, target, maxAttempts})` — uniform rejection
  sampling on the same grid, so the comparison is not rigged by a slow baseline.
- `certify(points, r, bounds)` — independent grid sweep over all point pairs; returns
  `ok`, `minDistance`, and the first violations with their distances.
- `coverageStats(...)` — 50,000 deterministic probes, nearest-point distance expressed
  in units of `r` (p50/p90/p99/max/mean).
- `packingFraction(...)` — uses spheres of radius **r/2** (a set with minimum distance
  `r` is non-overlapping at radius r/2; using `r` would report impossible fractions >1).

## Measured results

Unit cube, 3 seeds (median time), k=30, 50,000 coverage probes, radius `r`:

| r | sampler | points | time | density (r/2 spheres) | cert | p99 gap | max gap |
|---|---|---|---|---|---|---|---|
| 0.04 | Bridson | 11,849 | 67.1 ms | 0.3971 | 0 violations | 0.923r | 1.425r |
| 0.04 | dart | 11,849 | 65.5 ms | 0.3971 | 0 violations | 0.918r | 1.217r |
| 0.05 | Bridson | 6,097 | 32.8 ms | 0.3990 | 0 violations | 0.927r | 1.330r |
| 0.05 | dart | 6,097 | 28.0 ms | 0.3990 | 0 violations | 0.934r | 1.282r |
| 0.06 | Bridson | 3,543 | 16.2 ms | 0.4007 | 0 violations | 0.924r | 1.245r |
| 0.06 | dart | 3,543 | 15.3 ms | 0.4007 | 0 violations | 0.927r | 1.197r |

At the same accepted count, dart throwing is **1.02× / 1.17× / 1.06× faster** and its
p99 gap is within 0.7% of Bridson's (sometimes better). Density is dictated by the
radius, not the sampler. This is the honest result: with a grid-accelerated rejection
test, the classic "Bridson is faster" claim does not hold in JavaScript at these sizes.

What Bridson *does* give you: no target count, one pass, and a set that the active-list
termination makes maximal (no further point can be added at distance `r`). Dart
throwing needs `target` and silently returns fewer points when `maxAttempts` runs out;
the return value exposes `attempts` and `accepted` so that failure is visible.

## Run

Node 20+, no dependencies.

```bash
node --test tests/*.test.mjs     # 9 tests
node bench/bench.mjs             # writes bench/result.json
```

```js
import {samplePoisson3D, certify} from './src/core.mjs';

const out = samplePoisson3D({x: 1, y: 1, z: 1}, 0.05, {seed: 7});
const check = certify(out.points, 0.05, {x: 1, y: 1, z: 1});
console.log(out.accepted, check.ok, check.minDistance);
// 6097 true 0.058208519220352216
```

Determinism: the same `seed` reproduces the same points and attempt count exactly
(tested). Different seeds produce different sets (tested).

## What the certificate proves — and what it does not

`certify()` checks **every pair of points** using a grid of cell `r/√3`; it is not a
sample. `ok: true` therefore proves the minimum-distance invariant for the whole set.
It does **not** prove maximality in the continuous domain, and it does not prove
blue-noise spectral quality. The coverage numbers are a 50k-probe estimate, not a
proof. No GPU, no three.js, no browser claim in this repository.

## License

MIT.
