var Game = Game || {};

Game.levelIndex = 0;
Game.state = null;
Game.history = [];
Game.selectedCell = null;
Game.hoveredCell = null;
Game.focusedCell = null;
Game.previewCell = null;
Game.lastPreview = null;
Game.isRendering = false;

Game.mulberry32Step = function(a) {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value: result, nextState: a };
};

Game.seedForLevel = function(index) {
  return (1779033703 ^ Math.imul(index, 2654435761)) >>> 0;
};

Game.levelRng = function() {
  if (!Game.state || Game.state._rngState === undefined) return Math.random();
  const step = Game.mulberry32Step(Game.state._rngState);
  Game.state._rngState = step.nextState;
  return step.value;
};

Game.parseLevel = function(level) {
  const cells = [];
  for (let y = 0; y < level.tiles.length; y += 1) {
    for (let x = 0; x < level.tiles[y].length; x += 1) {
      const char = level.tiles[y][x];
      cells.push({
        x,
        y,
        soil: char === "w" ? "wet" : char === "d" ? "dry" : "loam",
        tree: char === "t",
        leaf: char === "f",
        microbe: char === "m",
        block: char === "b",
        mycelium: x === level.start[0] && y === level.start[1],
        decomposed: false,
        competed: false
      });
    }
  }
  return {
    turn: 1,
    nutrients: level.nutrients,
    cells,
    log: ["菌核开始伸展。"],
    _rngState: Game.seedForLevel(Game.levelIndex)
  };
};

Game.currentLevel = function() {
  return Game.levels[Game.levelIndex];
};

Game.saveHistory = function() {
  Game.history.push(JSON.stringify(Game.state));
  if (Game.history.length > 40) Game.history.shift();
};

Game.cellAt = function(x, y) {
  return Game.state.cells.find((cell) => cell.x === x && cell.y === y);
};

Game.neighbors = function(cell) {
  return [
    Game.cellAt(cell.x + 1, cell.y),
    Game.cellAt(cell.x - 1, cell.y),
    Game.cellAt(cell.x, cell.y + 1),
    Game.cellAt(cell.x, cell.y - 1)
  ].filter(Boolean);
};

Game.canGrow = function(cell) {
  return !cell.block && !cell.mycelium && Game.neighbors(cell).some((item) => item.mycelium);
};
