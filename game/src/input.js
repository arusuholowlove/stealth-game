// Keyboard and mouse: WASD or arrows to move, Shift to run (loud), click to throw a
// noisemaker, Space or Enter to confirm, P or Escape to pause.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const KEY_DIRECTION = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

export function createInput(canvas, toLogical) {
  const keys = new Set();
  let actions = 0;
  let throwAt = null;

  function onKeyDown(event) {
    if (event.code in KEY_DIRECTION) {
      keys.add(event.code);
      event.preventDefault();
    } else if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onClick(event) {
    const point = toLogical(event.clientX, event.clientY);
    if (point) throwAt = point;
  }

  function onBlur() {
    keys.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('click', onClick);

  return {
    direction() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const dir = KEY_DIRECTION[code];
        if (dir) {
          x += dir[0];
          y += dir[1];
        }
      }
      return { mx: x, my: y, run: keys.has('ShiftLeft') || keys.has('ShiftRight') };
    },
    takeThrow() {
      const point = throwAt;
      throwAt = null;
      return point;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
