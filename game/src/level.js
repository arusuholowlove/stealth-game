// The archive floor: walls are the bookshelves you hide behind, files are what you came
// for, and the exit only opens once every file is in hand. Geometry helpers live here too:
// line of sight and the raycast that shapes each guard's vision cone around the shelves.
import { FIELD } from './config.js';

const WALL = 16;

export const LEVEL = {
  walls: [
    // Outer walls.
    { x: 0, y: 0, w: FIELD.width, h: WALL },
    { x: 0, y: FIELD.height - WALL, w: FIELD.width, h: WALL },
    { x: 0, y: 0, w: WALL, h: FIELD.height },
    { x: FIELD.width - WALL, y: 0, w: WALL, h: FIELD.height },
    // Bookshelves (cover). Horizontal runs.
    { x: 150, y: 96, w: 150, h: 26 },
    { x: 600, y: 150, w: 170, h: 26 },
    { x: 350, y: 292, w: 160, h: 26 },
    { x: 300, y: 462, w: 180, h: 26 },
    { x: 640, y: 492, w: 170, h: 26 },
    // Vertical runs.
    { x: 420, y: 84, w: 26, h: 140 },
    { x: 180, y: 252, w: 26, h: 150 },
    { x: 560, y: 352, w: 26, h: 140 },
    { x: 760, y: 250, w: 26, h: 120 },
    { x: 96, y: 380, w: 26, h: 96 },
  ],
  files: [
    { x: 500, y: 120, label: 'A' },
    { x: 246, y: 300, label: 'B' },
    { x: 700, y: 420, label: 'C' },
  ],
  exit: { x: 872, y: 24, w: 72, h: 56 },
  playerStart: { x: 64, y: 536 },
  guards: [
    {
      name: 'Mara',
      waypoints: [
        { x: 120, y: 50 },
        { x: 850, y: 50 },
      ],
    },
    {
      name: 'Ivo',
      waypoints: [
        { x: 330, y: 200 },
        { x: 330, y: 440 },
      ],
    },
    {
      name: 'Sena',
      waypoints: [
        { x: 120, y: 545 },
        { x: 860, y: 545 },
      ],
    },
  ],
};

/** True when the segment from (x1, y1) to (x2, y2) touches any wall. */
export function segmentBlocked(x1, y1, x2, y2, walls) {
  for (const wall of walls) {
    if (segmentHitsRect(x1, y1, x2, y2, wall)) return true;
  }
  return false;
}

function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  for (const [origin, delta, lo, hi] of [
    [x1, dx, r.x, r.x + r.w],
    [y1, dy, r.y, r.y + r.h],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < lo || origin > hi) return false;
    } else {
      let t1 = (lo - origin) / delta;
      let t2 = (hi - origin) / delta;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

/**
 * Distance from (ox, oy) along `angle` to the nearest wall, capped at `maxDist`.
 * A ray that starts inside a wall reports 0.
 */
export function raycastWall(ox, oy, angle, maxDist, walls) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = maxDist;
  for (const wall of walls) {
    const hit = rayHitsRect(ox, oy, dx, dy, wall);
    if (hit !== null && hit < best) best = hit;
  }
  return best;
}

function rayHitsRect(ox, oy, dx, dy, r) {
  let tMin = 0;
  let tMax = Infinity;
  for (const [origin, delta, lo, hi] of [
    [ox, dx, r.x, r.x + r.w],
    [oy, dy, r.y, r.y + r.h],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < lo || origin > hi) return null;
    } else {
      let t1 = (lo - origin) / delta;
      let t2 = (hi - origin) / delta;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return null;
    }
  }
  return tMin;
}

/**
 * The guard's vision cone as a polygon, clipped by the shelves: one ray per step across
 * the cone, each stopped by the first wall it meets.
 */
export function conePolygon(guard, walls, range, halfAngle, steps = 26) {
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= steps; i += 1) {
    const angle = guard.facing - halfAngle + (2 * halfAngle * i) / steps;
    const dist = raycastWall(guard.x, guard.y, angle, range, walls);
    points.push({ x: guard.x + Math.cos(angle) * dist, y: guard.y + Math.sin(angle) * dist });
  }
  return points;
}
