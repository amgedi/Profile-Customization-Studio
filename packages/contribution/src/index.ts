/**
 * Deterministic contribution-graph simulations.
 *
 * A simulation is a pure function: (config) => frames.
 * The same config (including seed) must always produce the same animation,
 * which makes preview, animated SVG export and static fallbacks consistent.
 */

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dailySeed(): number {
  const d = new Date();
  return seedFromString(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
}

// ---------------------------------------------------------------- grid

export interface ContributionConfig {
  /** columns (weeks) */
  weeks: number;
  /** always 7 rows for GitHub parity */
  rows?: number;
  /** 0..4 contribution intensity per cell */
  levels?: number[];
}

export interface SimConfig {
  mode: "snake-classic" | "snake-long" | "snake-random" | "tetris";
  seed: number;
  rows?: number;
  weeks: number;
  /** seconds for the whole loop */
  duration: number;
  fps: number;
  levels: number[];
}

export interface Cell { x: number; y: number; }
export interface SimFrame {
  /** snake body / falling piece cells */
  actor: Cell[];
  /** eaten highlight */
  eaten?: Cell;
  /** falling tetromino letter for tetris */
  piece?: string;
}

export interface SimResult {
  config: SimConfig;
  rows: number;
  frames: SimFrame[];
}

// ---------------------------------------------------------------- snake

interface SnakeOptions {
  mode: SimConfig["mode"];
  grid: { weeks: number; rows: number };
  levels: number[];
  rand: () => number;
}

/**
 * Snake walks the contribution grid eating "contribution" cells.
 * classic: eats dark cells (level >= 3) with a fresh body each row sweep
 * long:    grows continuously across the panorama
 * random:  randomized direction changes from the seed
 */
export function simulateSnakeFrameTimed(opts: SnakeOptions): SimFrame[] {
  const { weeks, rows } = opts.grid;
  const frames: SimFrame[] = [];
  const cells: Cell[] = [];
  for (let x = 0; x < weeks; x++) {
    for (let y = 0; y < rows; y++) {
      if ((opts.levels[x * rows + y] ?? 0) >= 3 || opts.rand() < 0.08) cells.push({ x, y });
    }
  }
  const targets = cells.length > 0 ? cells : [{ x: 0, y: 0 }];
  const speed = opts.mode === "snake-long" ? 1 : 2; // cells per frame-step

  let body: Cell[] = [{ x: -1, y: 0 }];
  let dir: Cell = { x: 1, y: 0 };
  let targetIdx = 0;
  const frameCount = Math.max(8, Math.round(weeks * rows * 0.9));

  for (let f = 0; f < frameCount; f++) {
    const head = body[0]!;
    let target = targets[targetIdx % targets.length]!;
    const dx = target.x - head.x, dy = target.y - head.y;
    if (opts.mode === "snake-random" && opts.rand() < 0.15) {
      dir = opts.rand() < 0.5 ? { x: 0, y: opts.rand() < 0.5 ? 1 : -1 } : { x: opts.rand() < 0.5 ? 1 : -1, y: 0 };
    } else {
      dir = Math.abs(dx) > Math.abs(dy)
        ? { x: Math.sign(dx), y: 0 }
        : { x: 0, y: Math.sign(dy) };
    }
    let nx = head.x + dir.x * speed;
    let ny = head.y + dir.y * speed;
    nx = Math.max(-1, Math.min(weeks, nx));
    ny = Math.max(0, Math.min(rows - 1, ny));
    const newHead: Cell = { x: nx, y: ny };

    const ate = nx === target.x && ny === target.y;
    body = [newHead, ...body];
    if (!ate) {
      const maxLen = opts.mode === "snake-long" ? body.length + 1 : Math.max(4, Math.round(weeks / 3));
      if (body.length > maxLen) body.pop();
    } else {
      targetIdx++;
    }
    if (nx >= weeks) {
      // wrapped to a new sweep
      body = [{ x: -1, y: opts.rand() < 0.5 ? 0 : rows - 1 }];
    }
    frames.push({ actor: body.slice(0, 40), eaten: ate ? target : undefined });
  }
  return frames;
}

// ---------------------------------------------------------------- tetris

const PIECES: Record<string, Cell[]> = {
  I: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
  O: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  T: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
  L: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 0 }],
  S: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
};

/**
 * Deterministic Tetris over the contribution grid: pieces fall into columns,
 * rows clear when "filled" by contribution darkness. Simplified visual sim.
 */
export function simulateTetris(opts: Omit<SnakeOptions, "mode">): SimFrame[] {
  const { weeks, rows } = opts.grid;
  const letters = Object.keys(PIECES);
  const occupied = new Set<string>();
  const frames: SimFrame[] = [];
  const frameCount = Math.max(16, weeks * 3);

  for (let f = 0; f < frameCount; f++) {
    const letter = letters[Math.floor(opts.rand() * letters.length)]!;
    const shape = PIECES[letter]!;
    const col = Math.floor(opts.rand() * Math.max(1, weeks - 4));
    const fallSteps = rows + 2;
    const dropCol = (f % Math.max(4, weeks - 4)) + 1;
    let landed: Cell[] = [];
    for (let step = 0; step < fallSteps; step++) {
      const piece = shape.map((c) => ({ x: col + c.x, y: step + c.y }));
      const bottom = Math.max(...piece.map((c) => c.y));
      frames.push({ actor: piece, piece: letter });
      if (bottom >= rows - 1 || piece.some((c) => occupied.has(`${c.x},${c.y + 1}`))) {
        landed = piece;
        break;
      }
    }
    for (const c of landed) occupied.add(`${c.x},${c.y}`);
    void dropCol;
    // occasional clear for visual interest
    if (f % 6 === 5) occupied.clear();
  }
  return frames;
}

// ---------------------------------------------------------------- entry

export function runSimulation(config: SimConfig): SimResult {
  const rand = rng(config.seed);
  const grid = { weeks: config.weeks, rows: config.rows ?? 7 };
  const frames =
    config.mode === "tetris"
      ? simulateTetris({ grid, levels: config.levels, rand })
      : simulateSnakeFrameTimed({ mode: config.mode, grid, levels: config.levels, rand });
  return { config, rows: grid.rows, frames };
}

// ---------------------------------------------------------------- render

export const GITHUB_PALETTE = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

export interface RenderConfig {
  cell: number;
  gap: number;
  palette: string[];
  snakeColor: string;
  glow: boolean;
  background: string;
}

/**
 * Render a simulation to a standalone SVG. With `animate: true` the frames
 * become SMIL show/hide groups (GitHub-compatible animated SVG).
 */
export function renderSimSvg(result: SimResult, cfg: RenderConfig, animate = false): string {
  const { weeks } = result.config;
  const rows = result.rows;
  const cell = cfg.cell, gap = cfg.gap;
  const w = weeks * (cell + gap) + gap;
  const h = rows * (cell + gap) + gap;
  const dur = (result.config.duration / result.frames.length).toFixed(3);

  const gridRects: string[] = [];
  for (let x = 0; x < weeks; x++) {
    for (let y = 0; y < rows; y++) {
      const level = result.config.levels[x * rows + y] ?? 0;
      gridRects.push(
        `<rect x="${gap + x * (cell + gap)}" y="${gap + y * (cell + gap)}" width="${cell}" height="${cell}" rx="2" fill="${cfg.palette[level] ?? cfg.palette[0]}"/>`,
      );
    }
  }

  const frameGroups = result.frames.map((fr, i) => {
    const begin = (i * result.config.duration / result.frames.length).toFixed(3);
    const actor = fr.actor
      .map((c) => `<rect x="${gap + c.x * (cell + gap)}" y="${gap + c.y * (cell + gap)}" width="${cell}" height="${cell}" rx="2" fill="${cfg.snakeColor}"${cfg.glow ? ' filter="url(#sim-glow)"' : ""}/>`)
      .join("");
    const anim = animate
      ? `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.9;1" dur="${result.config.duration}s" begin="${begin}s" fill="freeze"/>`
      : "";
    const shown = animate ? ` opacity="0"` : "";
    return `<g${shown}>${actor}${anim}</g>`;
  }).join("\n  ");

  const visibleFrame = Math.min(result.frames.length - 1, Math.floor((0 / 1) * result.frames.length));
  const staticGroup = !animate && result.frames[visibleFrame]
    ? result.frames[visibleFrame]!.actor
        .map((c) => `<rect x="${gap + c.x * (cell + gap)}" y="${gap + c.y * (cell + gap)}" width="${cell}" height="${cell}" rx="2" fill="${cfg.snakeColor}"/>`)
        .join("")
    : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    cfg.glow
      ? `  <defs><filter id="sim-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
      : "",
    `  <rect width="${w}" height="${h}" fill="${cfg.background}"/>`,
    `  ${gridRects.join("")}`,
    `  ${staticGroup}`,
    animate ? frameGroups : "",
    `</svg>`,
    "",
  ].filter((s) => s !== "").join("\n").replace(`  \n`, "");
}

export function defaultLevels(weeks: number, seed: number): number[] {
  const rand = rng(seed);
  return Array.from({ length: weeks * 7 }, () => {
    const r = rand();
    return r < 0.35 ? 0 : r < 0.6 ? 1 : r < 0.8 ? 2 : r < 0.93 ? 3 : 4;
  });
}
