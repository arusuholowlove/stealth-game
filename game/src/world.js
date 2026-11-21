// The simulation: one fixed-step update of the player, the guards and the detection
// meter. Guards patrol fixed routes, grow suspicious when they see you, chase when the
// meter fills, and go back to patrol when you break away — so a near miss is recoverable.
import { FIELD, GUARD, NOISE, NOISEMAKER, NERVES, PLAYER, STEP } from './config.js';
import { LEVEL, conePolygon, raycastWall, segmentBlocked } from './level.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_CLEAR = 4;
export const EVENT_SPOTTED = 8;
export const EVENT_STEP_PLAYER = 16;
export const EVENT_STEP_GUARD = 32;
export const EVENT_THROW = 64;
export const EVENT_PING = 128;

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function clampAngleTurn(from, to, maxTurn) {
  const d = angleDiff(to, from);
  if (Math.abs(d) <= maxTurn) return to;
  return from + Math.sign(d) * maxTurn;
}

function moveCircle(body, dx, dy, walls) {
  const r = body.radius;
  let x = body.x + dx;
  for (const wall of walls) {
    if (x + r > wall.x && x - r < wall.x + wall.w && body.y + r > wall.y && body.y - r < wall.y + wall.h) {
      x = dx > 0 ? wall.x - r : wall.x + wall.w + r;
    }
  }
  body.x = Math.min(FIELD.width - r - 16, Math.max(r + 16, x));
  let y = body.y + dy;
  for (const wall of walls) {
    if (body.x + r > wall.x && body.x - r < wall.x + wall.w && y + r > wall.y && y - r < wall.y + wall.h) {
      y = dy > 0 ? wall.y - r : wall.y + wall.h + r;
    }
  }
  body.y = Math.min(FIELD.height - r - 16, Math.max(r + 16, y));
}

function seesPlayer(guard, player, walls) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.viewRange) return 0;
  const angle = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(angle, guard.facing)) > GUARD.viewHalfAngle) return 0;
  if (segmentBlocked(guard.x, guard.y, player.x, player.y, walls)) return 0;
  return 1 - dist / GUARD.viewRange;
}

export function createWorld() {
  const state = freshState();
  let noiseTimer = 0;
  let playerStepDebt = 0;
  const guardStepDebt = [0, 0, 0];

  function freshState() {
    return {
      time: 0,
      status: 'playing',
      nerves: NERVES,
      filesGot: 0,
      noisemakers: NOISEMAKER.count,
      player: {
        x: LEVEL.playerStart.x,
        y: LEVEL.playerStart.y,
        radius: PLAYER.radius,
        facing: -Math.PI / 2,
        moving: false,
        running: false,
        invulnerable: 0,
      },
      guards: LEVEL.guards.map((def, index) => ({
        index,
        name: def.name,
        x: def.waypoints[0].x,
        y: def.waypoints[0].y,
        radius: GUARD.radius,
        facing: Math.atan2(
          def.waypoints[1].y - def.waypoints[0].y,
          def.waypoints[1].x - def.waypoints[0].x,
        ),
        waypoint: 1,
        mode: 'patrol',
        suspicion: 0,
        lastSeenX: 0,
        lastSeenY: 0,
        chaseTimer: 0,
        investigateX: 0,
        investigateY: 0,
        investigateTimer: 0,
        pauseTimer: 0,
      })),
      files: LEVEL.files.map((file) => ({ ...file, taken: false })),
      pings: [],
      message: '',
      messageTimer: 0,
      clearSeconds: 0,
    };
  }

  function reset() {
    const next = freshState();
    Object.keys(next).forEach((key) => {
      state[key] = next[key];
    });
    noiseTimer = 0;
    playerStepDebt = 0;
    guardStepDebt.fill(0);
  }

  function respawnAfterCaught() {
    state.player.x = LEVEL.playerStart.x;
    state.player.y = LEVEL.playerStart.y;
    state.player.invulnerable = 2;
    state.player.facing = -Math.PI / 2;
    state.guards.forEach((guard, index) => {
      const def = LEVEL.guards[index];
      guard.x = def.waypoints[0].x;
      guard.y = def.waypoints[0].y;
      guard.waypoint = 1;
      guard.mode = 'patrol';
      guard.suspicion = 0;
      guard.chaseTimer = 0;
      guard.investigateTimer = 0;
    });
    state.pings.length = 0;
    state.message = 'Spotted — slipped back to the entrance.';
    state.messageTimer = 3;
  }

  function throwNoisemaker(targetX, targetY) {
    if (state.noisemakers <= 0 || state.status !== 'playing') return EVENT_NONE;
    const dx = targetX - state.player.x;
    const dy = targetY - state.player.y;
    const dist = Math.hypot(dx, dy);
    const reach = Math.min(dist, NOISEMAKER.range);
    const x = dist === 0 ? state.player.x : state.player.x + (dx / dist) * reach;
    const y = dist === 0 ? state.player.y : state.player.y + (dy / dist) * reach;
    state.noisemakers -= 1;
    state.pings.push({ x, y, age: 0, radius: NOISEMAKER.hearRadius });
    let heard = false;
    for (const guard of state.guards) {
      if (Math.hypot(guard.x - x, guard.y - y) <= NOISEMAKER.hearRadius && guard.mode !== 'chase') {
        guard.mode = 'investigate';
        guard.investigateX = x;
        guard.investigateY = y;
        guard.investigateTimer = NOISEMAKER.investigateSeconds;
        guard.suspicion = Math.max(guard.suspicion, 0.3);
        heard = true;
      }
    }
    state.message = heard ? 'Clink — a guard goes to look.' : 'Clink — nobody heard it.';
    state.messageTimer = 2;
    return EVENT_THROW | EVENT_PING;
  }

  function stepGuard(guard, dt, events) {
    const player = state.player;
    const seen = player.invulnerable > 0 ? 0 : seesPlayer(guard, player, LEVEL.walls);
    if (seen > 0) {
      guard.lastSeenX = player.x;
      guard.lastSeenY = player.y;
      const wasCalm = guard.suspicion < GUARD.suspiciousAt;
      guard.suspicion = Math.min(1, guard.suspicion + GUARD.suspicionRate * (0.55 + seen) * dt);
      if (wasCalm && guard.suspicion >= GUARD.suspiciousAt) events.value |= EVENT_SPOTTED;
      if (guard.suspicion >= 1) {
        guard.mode = 'chase';
        guard.chaseTimer = GUARD.chaseMemory;
      } else if (guard.mode === 'patrol') {
        guard.mode = 'suspicious';
      }
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspicionDecay * dt);
      if (guard.mode === 'chase') {
        guard.chaseTimer -= dt;
        if (guard.chaseTimer <= 0) guard.mode = 'patrol';
      } else if (guard.mode === 'suspicious' && guard.suspicion < 0.2) {
        guard.mode = 'patrol';
      }
    }

    let speed = 0;
    let targetX = guard.x;
    let targetY = guard.y;
    if (guard.mode === 'patrol') {
      const def = LEVEL.guards[guard.index];
      const wp = def.waypoints[guard.waypoint];
      targetX = wp.x;
      targetY = wp.y;
      speed = GUARD.patrolSpeed;
      if (Math.hypot(wp.x - guard.x, wp.y - guard.y) < 6) {
        guard.waypoint = (guard.waypoint + 1) % def.waypoints.length;
        guard.pauseTimer = 0.6;
      }
    } else if (guard.mode === 'suspicious') {
      targetX = guard.lastSeenX;
      targetY = guard.lastSeenY;
      speed = GUARD.suspiciousSpeed;
      if (Math.hypot(targetX - guard.x, targetY - guard.y) < 10) {
        guard.mode = 'patrol';
        guard.suspicion = Math.max(0, guard.suspicion - 0.2);
      }
    } else if (guard.mode === 'chase') {
      targetX = player.x;
      targetY = player.y;
      speed = GUARD.chaseSpeed;
    } else if (guard.mode === 'investigate') {
      targetX = guard.investigateX;
      targetY = guard.investigateY;
      speed = GUARD.suspiciousSpeed;
      guard.investigateTimer -= dt;
      if (Math.hypot(targetX - guard.x, targetY - guard.y) < 12 || guard.investigateTimer <= 0) {
        guard.mode = 'patrol';
      }
    }

    if (guard.pauseTimer > 0) {
      guard.pauseTimer -= dt;
      speed = 0;
    }
    const dx = targetX - guard.x;
    const dy = targetY - guard.y;
    const dist = Math.hypot(dx, dy);
    if (speed > 0 && dist > 0.5) {
      const step = Math.min(dist, speed * dt);
      const nx = guard.x + (dx / dist) * step;
      const ny = guard.y + (dy / dist) * step;
      moveCircle(guard, nx - guard.x, ny - guard.y, LEVEL.walls);
      guard.facing = clampAngleTurn(guard.facing, Math.atan2(dy, dx), 6 * dt);
      guardStepDebt[guard.index] += step;
      if (guardStepDebt[guard.index] >= GUARD.stepStride) {
        guardStepDebt[guard.index] -= GUARD.stepStride;
        events.value |= EVENT_STEP_GUARD;
        events.guardIndex = guard.index;
      }
    } else if (guard.mode !== 'patrol') {
      guard.facing = clampAngleTurn(guard.facing, Math.atan2(targetY - guard.y, targetX - guard.x), 4 * dt);
    }

    if (guard.mode === 'chase' && player.invulnerable <= 0) {
      if (Math.hypot(player.x - guard.x, player.y - guard.y) < guard.radius + player.radius + 2) {
        state.nerves -= 1;
        if (state.nerves <= 0) {
          state.status = 'over';
          events.value |= EVENT_CAUGHT;
        } else {
          respawnAfterCaught();
          events.value |= EVENT_CAUGHT;
        }
      }
    }
  }

  function step(dt, input) {
    const events = { value: EVENT_NONE, guardIndex: -1 };
    if (state.status !== 'playing') return events.value;
    state.time += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    const player = state.player;
    if (player.invulnerable > 0) player.invulnerable -= dt;

    if (input.throwAt) {
      events.value |= throwNoisemaker(input.throwAt.x, input.throwAt.y);
    }

    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const mx = input.mx;
    const my = input.my;
    const moving = mx !== 0 || my !== 0;
    player.moving = moving;
    player.running = input.run && moving;
    if (moving) {
      const len = Math.hypot(mx, my);
      const dx = (mx / len) * speed * dt;
      const dy = (my / len) * speed * dt;
      moveCircle(player, dx, dy, LEVEL.walls);
      player.facing = Math.atan2(dy, dx);
      playerStepDebt += Math.hypot(dx, dy);
      if (playerStepDebt >= PLAYER.stepStride) {
        playerStepDebt -= PLAYER.stepStride;
        events.value |= EVENT_STEP_PLAYER;
      }
      if (player.running) {
        noiseTimer -= dt;
        if (noiseTimer <= 0) {
          noiseTimer = NOISE.runPulse;
          for (const guard of state.guards) {
            if (guard.mode === 'patrol' && Math.hypot(guard.x - player.x, guard.y - player.y) <= NOISE.runRadius) {
              guard.mode = 'investigate';
              guard.investigateX = player.x;
              guard.investigateY = player.y;
              guard.investigateTimer = 1.6;
            }
          }
        }
      }
    }

    for (const file of state.files) {
      if (!file.taken && Math.hypot(file.x - player.x, file.y - player.y) < 26) {
        file.taken = true;
        state.filesGot += 1;
        state.message = `File ${file.label} pocketed — ${3 - state.filesGot} to go.`;
        state.messageTimer = 2.5;
        events.value |= EVENT_PICKUP;
      }
    }

    for (const guard of state.guards) stepGuard(guard, dt, events);

    for (const ping of state.pings) ping.age += dt;
    state.pings = state.pings.filter((ping) => ping.age < 1.2);

    const exit = LEVEL.exit;
    if (
      state.filesGot === LEVEL.files.length &&
      player.x > exit.x - 10 &&
      player.x < exit.x + exit.w + 10 &&
      player.y > exit.y - 10 &&
      player.y < exit.y + exit.h + 10
    ) {
      state.status = 'clear';
      state.clearSeconds = state.time;
      events.value |= EVENT_CLEAR;
    }
    return events.value;
  }

  /** Idle drift for the title screen: guards patrol, nobody is hunted. */
  function stepAttract(dt) {
    const idle = { mx: 0, my: 0, run: false, throwAt: null };
    const saved = state.status;
    state.status = 'playing';
    state.player.invulnerable = 99;
    step(dt, idle);
    state.status = saved;
    state.player.invulnerable = 0;
    state.time = 0;
  }

  /** Place the world into a composed scene for a screenshot (same renderer, real state). */
  function compose(scene) {
    reset();
    if (scene === 'patrol') {
      for (let i = 0; i < 6 / STEP; i += 1) stepAttract(STEP);
      return;
    }
    if (scene === 'cover') {
      for (let i = 0; i < 4 / STEP; i += 1) stepAttract(STEP);
      state.player.x = 400;
      state.player.y = 345;
      state.player.facing = -Math.PI / 2;
      state.files[0].taken = true;
      state.filesGot = 1;
      // Mara sweeps the shelf above: her cone stops at the bookshelf, the player waits below it.
      state.guards[0].x = 400;
      state.guards[0].y = 240;
      state.guards[0].facing = Math.PI / 2;
      state.guards[0].suspicion = 0.45;
      state.guards[0].mode = 'suspicious';
      state.guards[0].lastSeenX = 400;
      state.guards[0].lastSeenY = 345;
      state.message = 'Mara heard something…';
      state.messageTimer = 99;
      return;
    }
    if (scene === 'alert') {
      for (let i = 0; i < 4 / STEP; i += 1) stepAttract(STEP);
      state.player.x = 620;
      state.player.y = 540;
      state.player.facing = -Math.PI / 2;
      state.player.running = true;
      state.player.moving = true;
      state.files[0].taken = true;
      state.files[1].taken = true;
      state.filesGot = 2;
      const guard = state.guards[2];
      guard.x = 620;
      guard.y = 470;
      guard.facing = Math.PI / 2;
      guard.mode = 'chase';
      guard.suspicion = 1;
      guard.chaseTimer = 2.5;
      guard.lastSeenX = 620;
      guard.lastSeenY = 540;
      state.message = 'Spotted! Break line of sight!';
      state.messageTimer = 99;
      return;
    }
    if (scene === 'clear') {
      state.files.forEach((file) => {
        file.taken = true;
      });
      state.filesGot = 3;
      state.player.x = 908;
      state.player.y = 118;
      state.time = 187.4;
      state.clearSeconds = 187.4;
      state.status = 'clear';
    }
  }

  return {
    state,
    reset,
    step,
    stepAttract,
    compose,
    conePolygon: (guard) => conePolygon(guard, LEVEL.walls, GUARD.viewRange, GUARD.viewHalfAngle),
    viewRange: () => GUARD.viewRange,
    raycast: (x, y, angle, max) => raycastWall(x, y, angle, max, LEVEL.walls),
  };
}
