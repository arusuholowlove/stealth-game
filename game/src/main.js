// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, caught and clear.
//
// ?shot=cover|patrol|alert|clear stages that scene instead of running the loop, paints
// it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_CAUGHT, EVENT_CLEAR, EVENT_PICKUP, EVENT_SPOTTED, EVENT_STEP_GUARD, EVENT_STEP_PLAYER } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CLEAR, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseFloat(window.localStorage.getItem(BEST_KEY) ?? '0') || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best time then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, world.state, scene.screen, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toLogical(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Three files to steal, then reach the exit unseen.');
  }

  function endGame(cleared) {
    if (cleared) {
      screen = SCREEN_CLEAR;
      if (best === 0 || world.state.clearSeconds < best) {
        best = world.state.clearSeconds;
        saveBest(best);
      }
      audio.clear();
      announce(`Clear in ${renderer.formatTime(world.state.clearSeconds)}.`);
    } else {
      screen = SCREEN_OVER;
      audio.caught();
      announce('Caught. No nerves left.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_CLEAR) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function handleEvents(events) {
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_SPOTTED) {
      audio.spotted();
      announce('A guard is getting suspicious.');
    }
    if (events & EVENT_STEP_PLAYER) audio.stepPlayer(world.state.player.running);
    if (events & EVENT_STEP_GUARD) {
      const nearest = Math.min(...world.state.guards.map((g) => Math.hypot(g.x - world.state.player.x, g.y - world.state.player.y)));
      audio.stepGuard(nearest);
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.stepAttract(STEP);
      return;
    }
    const direction = input.direction();
    const events = world.step(STEP, {
      mx: direction.mx,
      my: direction.my,
      run: direction.run,
      throwAt: input.takeThrow(),
    });
    handleEvents(events);
    if (events & EVENT_CLEAR) endGame(true);
    else if (events & EVENT_CAUGHT && world.state.status === 'over') endGame(false);
    else if (events & EVENT_CAUGHT) announce('Spotted! Back to the entrance.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Silent Stacks. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
