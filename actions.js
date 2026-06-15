var Game = Game || {};

Game.addLog = function(text) {
  Game.state.log.unshift(text);
  Game.state.log = Game.state.log.slice(0, 6);
};

Game.addLogOnce = function(text) {
  if (!Game.state.log.includes(text)) {
    Game.state.log.unshift(text);
    Game.state.log = Game.state.log.slice(0, 6);
  }
};

Game.simulateGrow = function(cell) {
  const result = {
    canGrow: false,
    reason: "",
    cost: 0,
    nutrientDelta: 0,
    effects: [],
    warnings: []
  };

  if (cell.block) {
    result.reason = "不可通行";
    result.warnings.push("此格子无法通行");
    return result;
  }

  if (cell.mycelium) {
    result.reason = "已占领";
    result.warnings.push("菌丝已占领此格");
    return result;
  }

  if (!Game.neighbors(cell).some((item) => item.mycelium)) {
    result.reason = "未连接菌丝";
    result.warnings.push("需与已有菌丝相邻");
    return result;
  }

  result.canGrow = true;
  result.cost = Game.cost[cell.soil] + (cell.microbe && !cell.competed ? 3 : 0);
  result.nutrientDelta = -result.cost;

  if (cell.leaf && !cell.decomposed) {
    result.effects.push({ type: "leaf", label: "落叶分解", value: 8 });
    result.nutrientDelta += 8;
  } else if (cell.leaf && cell.decomposed) {
    result.warnings.push("落叶已分解，无法再次回收");
  }

  if (cell.tree) {
    const treeValue = cell.soil === "wet" ? 5 : 3;
    result.effects.push({ type: "tree", label: "树根回馈", value: treeValue });
    result.nutrientDelta += treeValue;
  }

  if (cell.microbe && !cell.competed) {
    result.effects.push({ type: "microbe", label: "微生物额外消耗", value: 3 });
    result.warnings.push("微生物竞争将额外消耗3养分");
  } else if (cell.microbe && cell.competed) {
    result.warnings.push("微生物已竞争过");
  }

  if (Game.state.nutrients < result.cost) {
    result.reason = "养分不足";
    result.warnings.push(`需要${result.cost}养分，当前仅${Game.state.nutrients}`);
  }

  return result;
};

Game.grow = function(cell) {
  if (!Game.canGrow(cell)) return false;
  const tileCost = Game.cost[cell.soil] + (cell.microbe && !cell.competed ? 3 : 0);
  if (Game.state.nutrients < tileCost) {
    Game.addLog("养分不足，前沿停止扩张。");
    return false;
  }
  Game.saveHistory();
  cell.mycelium = true;
  Game.state.nutrients -= tileCost;
  if (cell.leaf && !cell.decomposed) {
    cell.decomposed = true;
    Game.state.nutrients += 8;
    Game.addLog("落叶被分解，养分回流。");
  } else if (cell.tree) {
    Game.state.nutrients += cell.soil === "wet" ? 5 : 3;
    Game.addLog("树根被接入网络。");
  } else if (cell.microbe && !cell.competed) {
    cell.competed = true;
    Game.addLog("微生物竞争消耗额外养分。");
  } else {
    Game.addLog(`${cell.soil === "dry" ? "干层" : cell.soil === "wet" ? "湿土" : "壤土"}中新生菌丝。`);
  }
  Game.render();
  return true;
};

Game.nextTurn = function() {
  Game.saveHistory();
  Game.state.turn += 1;
  let upkeep = Math.max(1, Math.floor(Game.state.cells.filter((cell) => cell.mycelium).length / 8));
  const treeLinks = Game.state.cells.filter((cell) => cell.mycelium && cell.tree).length;
  Game.state.nutrients += treeLinks * 2 - upkeep;

  Game.state.cells.forEach((cell) => {
    if (cell.microbe && !cell.mycelium && Game.levelRng() < 0.18) {
      const target = Game.neighbors(cell).find((item) => !item.mycelium && !item.tree && !item.leaf);
      if (target) target.microbe = true;
    }
  });

  Game.addLog(`维持消耗${upkeep}点，树根回馈${treeLinks * 2}点。`);
  Game.render();
};

Game.reset = function() {
  Game.state = Game.parseLevel(Game.currentLevel());
  Game.history = [];
  Game.selectedCell = null;
  Game.hoveredCell = null;
  Game.previewCell = null;
  Game.lastPreview = null;
  Game.hideGrowPreview();
  Game.render();
};
