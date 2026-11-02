// Deterministic 3D Poisson-disk sampling (Bridson) with a verifiable
// minimum-distance certificate.  Pure ES module: no DOM, no three.js, no network.

const SQRT3 = Math.sqrt(3);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGrid(bounds, r) {
  const cell = r / SQRT3;
  const nx = Math.max(1, Math.ceil(bounds.x / cell));
  const ny = Math.max(1, Math.ceil(bounds.y / cell));
  const nz = Math.max(1, Math.ceil(bounds.z / cell));
  return { cell, nx, ny, nz, cells: new Int32Array(nx * ny * nz).fill(-1) };
}

function cellIndex(grid, x, y, z) {
  const ix = Math.min(grid.nx - 1, Math.max(0, Math.floor(x / grid.cell)));
  const iy = Math.min(grid.ny - 1, Math.max(0, Math.floor(y / grid.cell)));
  const iz = Math.min(grid.nz - 1, Math.max(0, Math.floor(z / grid.cell)));
  return [ix, iy, iz];
}

function hasNeighbor(grid, points, x, y, z, r) {
  const [ix, iy, iz] = cellIndex(grid, x, y, z);
  const r2 = r * r;
  for (let dx = -1; dx <= 1; dx++) {
    const jx = ix + dx;
    if (jx < 0 || jx >= grid.nx) continue;
    for (let dy = -1; dy <= 1; dy++) {
      const jy = iy + dy;
      if (jy < 0 || jy >= grid.ny) continue;
      for (let dz = -1; dz <= 1; dz++) {
        const jz = iz + dz;
        if (jz < 0 || jz >= grid.nz) continue;
        const id = grid.cells[jx + grid.nx * (jy + grid.ny * jz)];
        if (id < 0) continue;
        const p = points[id];
        const ddx = p[0] - x, ddy = p[1] - y, ddz = p[2] - z;
        if (ddx * ddx + ddy * ddy + ddz * ddz < r2) return true;
      }
    }
  }
  return false;
}

function mark(grid, p, id) {
  const [ix, iy, iz] = cellIndex(grid, p[0], p[1], p[2]);
  grid.cells[ix + grid.nx * (iy + grid.ny * iz)] = id;
}

function insert(grid, points, p) {
  const id = points.length;
  points.push(p);
  mark(grid, p, id);
}

function unitVector(rng) {
  // Marsaglia: uniform on the unit sphere, no trigonometry.
  let x, y, s;
  do {
    x = 2 * rng() - 1;
    y = 2 * rng() - 1;
    s = x * x + y * y;
  } while (s === 0 || s >= 1);
  const f = 2 * Math.sqrt(1 - s);
  return [x * f, y * f, 1 - 2 * s];
}

export function samplePoisson3D(bounds, r, opts = {}) {
  const seed = opts.seed ?? 1;
  const k = opts.k ?? 30;
  if (!(r > 0)) throw new Error("radius must be > 0");
  if (r > Math.hypot(bounds.x, bounds.y, bounds.z)) {
    return { points: [[0, 0, 0]], attempts: 0, accepted: 1, r, seed };
  }
  const rng = mulberry32(seed);
  const grid = makeGrid(bounds, r);
  const points = [];
  insert(grid, points, [rng() * bounds.x, rng() * bounds.y, rng() * bounds.z]);
  const active = [0];
  let attempts = 0;

  while (active.length > 0) {
    const ai = Math.floor(rng() * active.length);
    const origin = points[active[ai]];
    let placed = false;
    for (let t = 0; t < k; t++) {
      attempts++;
      const dir = unitVector(rng);
      const radius = r * (1 + rng());
      const q = [origin[0] + dir[0] * radius,
                 origin[1] + dir[1] * radius,
                 origin[2] + dir[2] * radius];
      if (q[0] < 0 || q[0] >= bounds.x || q[1] < 0 || q[1] >= bounds.y ||
          q[2] < 0 || q[2] >= bounds.z) continue;
      if (hasNeighbor(grid, points, q[0], q[1], q[2], r)) continue;
      insert(grid, points, q);
      active.push(points.length - 1);
      placed = true;
      break;
    }
    if (!placed) {
      active[ai] = active[active.length - 1];
      active.pop();
    }
  }
  return { points, attempts, accepted: points.length, r, seed };
}

export function sampleDartThrowing(bounds, r, opts = {}) {
  const seed = opts.seed ?? 1;
  const target = opts.target ?? Infinity;
  const maxAttempts = opts.maxAttempts ?? 5_000_000;
  if (!(r > 0)) throw new Error("radius must be > 0");
  const rng = mulberry32(seed);
  const grid = makeGrid(bounds, r);
  const points = [];
  let attempts = 0;
  while (attempts < maxAttempts && points.length < target) {
    attempts++;
    const q = [rng() * bounds.x, rng() * bounds.y, rng() * bounds.z];
    if (hasNeighbor(grid, points, q[0], q[1], q[2], r)) continue;
    insert(grid, points, q);
  }
  return { points, attempts, accepted: points.length, r, seed };
}

export function certify(points, r, bounds) {
  const grid = makeGrid(bounds, r);
  for (let i = 0; i < points.length; i++) mark(grid, points[i], i);
  let minDistance = Infinity;
  const violations = [];
  const r2 = r * r;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const [ix, iy, iz] = cellIndex(grid, p[0], p[1], p[2]);
    for (let dx = -1; dx <= 1; dx++) {
      const jx = ix + dx;
      if (jx < 0 || jx >= grid.nx) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const jy = iy + dy;
        if (jy < 0 || jy >= grid.ny) continue;
        for (let dz = -1; dz <= 1; dz++) {
          const jz = iz + dz;
          if (jz < 0 || jz >= grid.nz) continue;
          const id = grid.cells[jx + grid.nx * (jy + grid.ny * jz)];
          if (id < 0 || id <= i) continue;
          const q = points[id];
          const ddx = q[0] - p[0], ddy = q[1] - p[1], ddz = q[2] - p[2];
          const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
          if (d2 < minDistance) minDistance = Math.sqrt(d2);
          if (d2 < r2) violations.push([i, id, Math.sqrt(d2)]);
        }
      }
    }
  }
  return {
    ok: violations.length === 0,
    points: points.length,
    minDistance: points.length < 2 ? null : minDistance,
    violations: violations.length,
    worst: violations.slice(0, 5),
  };
}

export function packingFraction(points, r, bounds) {
  // A Poisson-disk set with minimum distance r corresponds to non-overlapping
  // spheres of radius r/2, not r.  Using r would report fractions above 1.
  const sphere = (4 / 3) * Math.PI * (r / 2) ** 3;
  return (points * sphere) / (bounds.x * bounds.y * bounds.z);
}

export function coverageStats(points, r, bounds, opts = {}) {
  const probes = opts.probes ?? 50_000;
  const rng = mulberry32(opts.seed ?? 99);
  const grid = makeGrid(bounds, r);
  for (let i = 0; i < points.length; i++) mark(grid, points[i], i);
  const ds = [];
  for (let n = 0; n < probes; n++) {
    const q = [rng() * bounds.x, rng() * bounds.y, rng() * bounds.z];
    const [ix, iy, iz] = cellIndex(grid, q[0], q[1], q[2]);
    let best = Infinity;
    for (let ring = 0; ring <= 4 && best > ring * r; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dy = -ring; dy <= ring; dy++) {
          for (let dz = -ring; dz <= ring; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== ring) continue;
            const jx = ix + dx, jy = iy + dy, jz = iz + dz;
            if (jx < 0 || jx >= grid.nx || jy < 0 || jy >= grid.ny || jz < 0 || jz >= grid.nz) continue;
            const id = grid.cells[jx + grid.nx * (jy + grid.ny * jz)];
            if (id < 0) continue;
            const p = points[id];
            const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
            if (d < best) best = d;
          }
        }
      }
    }
    ds.push(best / r);
  }
  ds.sort((a, b) => a - b);
  const at = (p) => ds[Math.min(ds.length - 1, Math.floor(p * ds.length))];
  return {probes, p50: at(0.50), p90: at(0.90), p99: at(0.99), max: ds.at(-1),
          mean: ds.reduce((a, b) => a + b, 0) / ds.length};
}
