// Every tuning number and colour in one place. The playfield is a fixed 960x600 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.
export const FIELD = { width: 960, height: 600 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 11,
  walkSpeed: 108,
  runSpeed: 178,
  /** Steps sound this far apart, in pixels. */
  stepStride: 30,
};

export const GUARD = {
  radius: 12,
  patrolSpeed: 62,
  suspiciousSpeed: 84,
  chaseSpeed: 148,
  /** How far a guard can see, in pixels. */
  viewRange: 195,
  /** Half of the vision cone's angle, in radians. */
  viewHalfAngle: 0.56,
  /** Suspicion gained per second while the player is seen (scaled by closeness). */
  suspicionRate: 1.15,
  /** Suspicion lost per second while the player is unseen. */
  suspicionDecay: 0.45,
  /** Suspicion at which a guard leaves patrol to check the last seen spot. */
  suspiciousAt: 0.55,
  /** Seconds a chasing guard keeps hunting after losing sight. */
  chaseMemory: 2.5,
  stepStride: 44,
};

/** Running is loud: guards this close turn toward the noise. */
export const NOISE = { runRadius: 135, runPulse: 0.35 };

export const NOISEMAKER = { count: 3, range: 280, hearRadius: 230, investigateSeconds: 3.2 };

export const NERVES = 3;

export const PALETTE = {
  backdrop: '#0d0f14',
  floor: '#232833',
  floorDark: '#1d222c',
  floorLine: '#2c3342',
  wall: '#4a3b2c',
  wallTop: '#6b563e',
  wallEdge: '#2e2419',
  coneCalm: 'rgba(242, 201, 76, 0.30)',
  coneWary: 'rgba(242, 153, 60, 0.38)',
  coneAlert: 'rgba(229, 83, 75, 0.45)',
  guard: '#e5534b',
  guardWary: '#f2993c',
  player: '#4fc3f7',
  playerDark: '#1d7fb8',
  file: '#f2c94c',
  exitLocked: '#8b93a3',
  exitOpen: '#58c98a',
  route: 'rgba(139, 147, 163, 0.35)',
  panel: '#171b24',
  panelEdge: '#2c3342',
  text: '#eef1f5',
  muted: '#8b93a3',
  danger: '#e5534b',
  good: '#58c98a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best clear time is kept between visits (this browser only). */
export const BEST_KEY = 'silent-stacks.best-seconds';
