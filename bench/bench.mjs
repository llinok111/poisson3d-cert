// Bench: Bridson vs dart throwing at the same radius and the same accepted count.
// Run: node bench/bench.mjs   (writes bench/result.json)

import {writeFileSync} from 'node:fs';
import {samplePoisson3D, sampleDartThrowing, certify, packingFraction, coverageStats} from '../src/core.mjs';

const box = {x: 1, y: 1, z: 1};
const radii = [0.04, 0.05, 0.06];
const seeds = [1, 2, 3];

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function ms(fn) {
  const t0 = process.hrtime.bigint();
  const out = fn();
  return {seconds: Number(process.hrtime.bigint() - t0) / 1e9, out};
}

const rows = [];
for (const r of radii) {
  const bridsonRuns = [];
  for (const seed of seeds) {
    const {seconds, out} = ms(() => samplePoisson3D(box, r, {seed, k: 30}));
    bridsonRuns.push({seconds, ...out, cert: certify(out.points, r, box)});
  }
  const rep = bridsonRuns[0];
  const target = rep.accepted;
  const dart = ms(() => sampleDartThrowing(box, r, {seed: 1, target, maxAttempts: 5_000_000}));
  const dartCert = certify(dart.out.points, r, box);
  const bridsonCoverage = coverageStats(rep.points, r, box, {probes: 50_000, seed: 99});
  const dartCoverage = coverageStats(dart.out.points, r, box, {probes: 50_000, seed: 99});

  rows.push({
    r,
    bridson: {
      points: rep.accepted,
      seconds: median(bridsonRuns.map(x => x.seconds)),
      attempts: rep.attempts,
      density: packingFraction(rep.accepted, r, box),
      cert: rep.cert,
      coverage: bridsonCoverage,
    },
    dart: {
      points: dart.out.accepted,
      seconds: dart.seconds,
      attempts: dart.out.attempts,
      density: packingFraction(dart.out.accepted, r, box),
      cert: dartCert,
      coverage: dartCoverage,
    },
  });
  console.log(JSON.stringify(rows.at(-1)));
}

writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify({
  box,
  radii,
  seeds,
  bridson_k: 30,
  dart_max_attempts: 5_000_000,
  rows,
}, null, 2) + '\n');
