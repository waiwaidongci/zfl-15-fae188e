import { seedForLevel, hashString } from './rng.js';

export function parseLevel(level, isCustom = false, customName = null) {
  const cells = [];
  for (let y = 0; y < level.tiles.length; y += 1) {
    for (let x = 0; x < level.tiles[y].length; x += 1) {
      const char = level.tiles[y][x];
      cells.push({
        x,
        y,
        soil: char === 'w' ? 'wet' : char === 'd' ? 'dry' : 'loam',
        tree: char === 't',
        leaf: char === 'f',
        microbe: char === 'm',
        block: char === 'b',
        mycelium: x === level.start[0] && y === level.start[1],
        decomposed: false,
        competed: false,
      });
    }
  }
  const seed = isCustom
    ? hashString(customName || 'custom')
    : seedForLevel(level._index ?? 0);
  return {
    turn: 1,
    nutrients: level.nutrients,
    cells,
    log: ['菌核开始伸展。'],
    _rngState: seed,
    _lastLogLen: 0,
  };
}

export function cellAt(state, x, y) {
  return state.cells.find((cell) => cell.x === x && cell.y === y);
}

export function neighbors(state, cell) {
  return [
    cellAt(state, cell.x + 1, cell.y),
    cellAt(state, cell.x - 1, cell.y),
    cellAt(state, cell.x, cell.y + 1),
    cellAt(state, cell.x, cell.y - 1),
  ].filter(Boolean);
}

export function canGrow(state, cell) {
  return !cell.block && !cell.mycelium && neighbors(state, cell).some((item) => item.mycelium);
}

export function saveHistory(history, state, maxLen = 40) {
  const next = [...history, JSON.stringify(state)];
  if (next.length > maxLen) next.shift();
  return next;
}

export function countLevelStats(level) {
  let trees = 0;
  let leaves = 0;
  let microbes = 0;
  for (const row of level.tiles) {
    for (const char of row) {
      if (char === 't') trees += 1;
      else if (char === 'f') leaves += 1;
      else if (char === 'm') microbes += 1;
    }
  }
  return { trees, leaves, microbes };
}
