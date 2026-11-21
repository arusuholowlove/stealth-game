// The screenshot scenes behind ?shot=cover|patrol|alert|clear. Each one composes a real,
// reachable state through the world's own compose() and paints it with the real renderer,
// so every frame is what the game itself draws — never edited or borrowed.
import { SCREEN_CLEAR, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/**
 * Stage `world` into the named scene and return the screen to draw over it.
 * Any other name stages the title screen.
 */
export function stageShot(name, world) {
  if (name === 'cover') {
    world.compose('cover');
    return { screen: SCREEN_PLAY };
  }
  if (name === 'patrol') {
    world.compose('patrol');
    return { screen: SCREEN_PLAY };
  }
  if (name === 'alert') {
    world.compose('alert');
    return { screen: SCREEN_PLAY };
  }
  if (name === 'clear') {
    world.compose('clear');
    return { screen: SCREEN_CLEAR };
  }
  world.compose('patrol');
  return { screen: SCREEN_TITLE };
}
