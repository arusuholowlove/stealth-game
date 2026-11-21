// Everything the eye sees: the archive floor, the shelves, each guard's vision cone, the
// player, and the HUD — the detection meter, the files, the noisemakers and the nerves.
// Screens: title, play, paused, caught (game over) and clear.
import { FIELD, FONT, PALETTE } from './config.js';
import { LEVEL } from './level.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_CLEAR = 'clear';

const TAU = Math.PI * 2;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    offsetX = (canvas.width - FIELD.width * scale) / 2;
    offsetY = (canvas.height - FIELD.height * scale) / 2;
  }

  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / Math.max(1, rect.width);
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;
    return { x: (x - offsetX) / scale, y: (y - offsetY) / scale };
  }

  function coneColor(suspicion) {
    if (suspicion >= 1) return PALETTE.coneAlert;
    if (suspicion >= 0.55) return PALETTE.coneWary;
    return PALETTE.coneCalm;
  }

  function drawFloor() {
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const tile = 60;
    for (let y = 0; y < FIELD.height; y += tile) {
      for (let x = 0; x < FIELD.width; x += tile) {
        if (((x + y) / tile) % 2 === 0) {
          ctx.fillStyle = PALETTE.floorDark;
          ctx.fillRect(x, y, tile, tile);
        }
      }
    }
    ctx.strokeStyle = PALETTE.floorLine;
    ctx.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += tile) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
      ctx.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += tile) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
      ctx.stroke();
    }
  }

  function drawRoutes(state) {
    ctx.save();
    ctx.strokeStyle = PALETTE.route;
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 8]);
    ctx.lineCap = 'round';
    for (const def of LEVEL.guards) {
      ctx.beginPath();
      def.waypoints.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
    void state;
  }

  function drawExit(state) {
    const exit = LEVEL.exit;
    const open = state.filesGot === LEVEL.files.length;
    ctx.fillStyle = open ? PALETTE.exitOpen : PALETTE.exitLocked;
    ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(exit.x, exit.y + exit.h - 10, exit.w, 10);
    ctx.fillStyle = '#0d0f14';
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'EXIT' : 'LOCKED', exit.x + exit.w / 2, exit.y + exit.h / 2 - 4);
    ctx.font = `11px ${FONT}`;
    ctx.fillText(open ? 'go!' : `${state.filesGot}/3 files`, exit.x + exit.w / 2, exit.y + exit.h / 2 + 12);
  }

  function drawFiles(state) {
    for (const file of state.files) {
      if (file.taken) continue;
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 3 + file.x);
      ctx.save();
      ctx.shadowColor = PALETTE.file;
      ctx.shadowBlur = 10 + 8 * pulse;
      ctx.fillStyle = PALETTE.file;
      ctx.fillRect(file.x - 9, file.y - 12, 18, 24);
      ctx.restore();
      ctx.fillStyle = '#0d0f14';
      ctx.fillRect(file.x - 5, file.y - 7, 10, 2);
      ctx.fillRect(file.x - 5, file.y - 2, 10, 2);
      ctx.fillRect(file.x - 5, file.y + 3, 6, 2);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(file.label, file.x, file.y - 20);
    }
  }

  function drawWalls() {
    for (const wall of LEVEL.walls) {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(wall.x, wall.y, wall.w, 4);
      ctx.strokeStyle = PALETTE.wallEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);
      // Book spines along the long side.
      ctx.fillStyle = 'rgba(238, 241, 245, 0.16)';
      const horizontal = wall.w >= wall.h;
      const length = horizontal ? wall.w : wall.h;
      for (let d = 8; d < length - 6; d += 12) {
        if (horizontal) ctx.fillRect(wall.x + d, wall.y + 7, 5, wall.h - 12);
        else ctx.fillRect(wall.x + 7, wall.y + d, wall.w - 12, 5);
      }
    }
  }

  function drawPings(state) {
    for (const ping of state.pings) {
      const t = ping.age / 1.2;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = PALETTE.file;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ping.x, ping.y, 8 + ping.radius * t, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawCones(world, state) {
    for (const guard of state.guards) {
      const polygon = world.conePolygon(guard);
      ctx.fillStyle = coneColor(guard.suspicion);
      ctx.beginPath();
      polygon.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = coneColor(guard.suspicion).replace(/[\d.]+\)$/, '0.55)');
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      ctx.fillStyle = guard.suspicion >= 1 ? PALETTE.danger : guard.suspicion >= 0.55 ? PALETTE.guardWary : PALETTE.guard;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, guard.radius, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Facing tick.
      ctx.strokeStyle = '#0d0f14';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      ctx.lineTo(guard.x + Math.cos(guard.facing) * (guard.radius + 5), guard.y + Math.sin(guard.facing) * (guard.radius + 5));
      ctx.stroke();
      // Eyes.
      const ex = Math.cos(guard.facing);
      const ey = Math.sin(guard.facing);
      ctx.fillStyle = '#0d0f14';
      ctx.beginPath();
      ctx.arc(guard.x + ex * 4 - ey * 4, guard.y + ey * 4 + ex * 4, 1.8, 0, TAU);
      ctx.arc(guard.x + ex * 4 + ey * 4, guard.y + ey * 4 - ex * 4, 1.8, 0, TAU);
      ctx.fill();
      // Suspicion mark.
      if (guard.suspicion >= 0.55) {
        ctx.fillStyle = guard.suspicion >= 1 ? PALETTE.danger : PALETTE.guardWary;
        ctx.font = `bold 20px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(guard.suspicion >= 1 ? '!' : '?', guard.x, guard.y - guard.radius - 12);
      }
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(guard.name, guard.x, guard.y + guard.radius + 11);
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.invulnerable > 0 && Math.floor(state.time * 8) % 2 === 0) return;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = PALETTE.playerDark;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#0d0f14';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(player.facing) * (player.radius + 4), player.y + Math.sin(player.facing) * (player.radius + 4));
    ctx.stroke();
    if (player.running) {
      ctx.fillStyle = 'rgba(79, 195, 247, 0.25)';
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 7, 0, TAU);
      ctx.fill();
    }
  }

  function drawHud(state, screen, bestSeconds) {
    const barW = 220;
    const barX = (FIELD.width - barW) / 2;
    const barY = 10;
    const maxSuspicion = Math.max(0, ...state.guards.map((g) => g.suspicion));
    ctx.fillStyle = 'rgba(13, 15, 20, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, 40);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`FILES ${state.filesGot}/3`, 16, 21);
    ctx.fillText(`◉ ${state.noisemakers}`, 110, 21);
    ctx.fillStyle = PALETTE.danger;
    ctx.fillText(`♥ ${'♥'.repeat(Math.max(0, state.nerves))}${'·'.repeat(Math.max(0, 3 - state.nerves))}`, 168, 21);
    // Detection meter.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('DETECTION', barX + barW / 2, barY + 5);
    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(barX, barY + 12, barW, 10);
    ctx.fillStyle = maxSuspicion >= 1 ? PALETTE.danger : maxSuspicion >= 0.55 ? PALETTE.guardWary : PALETTE.file;
    ctx.fillRect(barX, barY + 12, barW * maxSuspicion, 10);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.strokeRect(barX, barY + 12, barW, 10);
    // Timer and best.
    ctx.fillStyle = PALETTE.text;
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'right';
    const seconds = screen === SCREEN_CLEAR ? state.clearSeconds : state.time;
    ctx.fillText(formatTime(seconds), FIELD.width - 16, 21);
    if (bestSeconds > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `11px ${FONT}`;
      ctx.fillText(`best ${formatTime(bestSeconds)}`, FIELD.width - 16, 34);
    }
    // Transient message.
    if (state.messageTimer > 0 && state.message) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = `13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(state.message, FIELD.width / 2, FIELD.height - 18);
    }
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }

  function drawOverlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(13, 15, 20, 0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = accent;
    ctx.font = `bold 44px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, FIELD.width / 2, FIELD.height / 2 - 90);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `16px ${FONT}`;
    lines.forEach((line, i) => {
      ctx.fillText(line, FIELD.width / 2, FIELD.height / 2 - 30 + i * 26);
    });
  }

  function draw(world, state, screen, bestSeconds) {
    resize();
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(-offsetX / scale, -offsetY / scale, FIELD.width + (2 * offsetX) / scale, FIELD.height + (2 * offsetY) / scale);
    drawFloor();
    drawRoutes(state);
    drawExit(state);
    drawFiles(state);
    drawWalls();
    drawPings(state);
    if (screen !== SCREEN_TITLE) drawCones(world, state);
    if (screen !== SCREEN_TITLE) drawGuards(state);
    drawPlayer(state);
    drawHud(state, screen, bestSeconds);

    if (screen === SCREEN_TITLE) {
      drawOverlay('SILENT STACKS', [
        'The archive closes at midnight. Three files. Three guards. One exit.',
        'WASD / arrows — move    Shift — run (loud)    Click — throw a noisemaker',
        'Stay out of the yellow cones. If the meter fills, break line of sight.',
        'Dotted lines are the guards’ patrol routes — learn them, then slip through.',
        '',
        'Press Space or click to start',
      ], PALETTE.player);
    } else if (screen === SCREEN_PAUSED) {
      drawOverlay('PAUSED', ['Press P or Space to keep sneaking.'], PALETTE.muted);
    } else if (screen === SCREEN_OVER) {
      drawOverlay('CAUGHT', [
        'The guards walk you back to the entrance.',
        'Press Space to try again.',
      ], PALETTE.danger);
    } else if (screen === SCREEN_CLEAR) {
      const rating = state.clearSeconds <= 150 ? 'S — ghost' : state.clearSeconds <= 210 ? 'A — clean' : 'B — lucky';
      drawOverlay('CLEAN GETAWAY', [
        `All three files, out unseen, in ${formatTime(state.clearSeconds)}.`,
        `Rating: ${rating}`,
        bestSeconds > 0 ? `Best: ${formatTime(bestSeconds)}` : '',
        'Press Space to play again.',
      ].filter(Boolean), PALETTE.good);
    }
  }

  return { draw, toLogical, formatTime };
}
