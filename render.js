var Game = Game || {};

Game.cacheDom = function() {
  Game.mapEl = document.querySelector("#map");
  Game.logEl = document.querySelector("#log");
  Game.levelSelectEl = document.querySelector("#levelSelect");
  Game.srAnnounceEl = document.querySelector("#srAnnounce");
  Game.srLogEl = document.querySelector("#srLog");
  Game._tileButtons = null;
};

Game.renderLevelOptions = function() {
  Game.levelSelectEl.innerHTML = "";
  Game.levels.forEach((level, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = level.name;
    Game.levelSelectEl.appendChild(option);
  });
  Game.levelSelectEl.value = Game.levelIndex;
};

Game.ensureMapDom = function() {
  if (Game._tileButtons) return;
  Game._tileButtons = [];
  Game.mapEl.innerHTML = "";

  for (let y = 0; y < 10; y += 1) {
    const row = [];
    for (let x = 0; x < 10; x += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.x = x;
      button.dataset.y = y;
      button.className = "cell";

      button.addEventListener("keydown", (e) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (e.key === "ArrowUp") Game.moveFocus(0, -1);
        else if (e.key === "ArrowDown") Game.moveFocus(0, 1);
        else if (e.key === "ArrowLeft") Game.moveFocus(-1, 0);
        else if (e.key === "ArrowRight") Game.moveFocus(1, 0);
        else if (e.key === "Enter" || e.key === " ") Game.activateFocused();
      });

      button.addEventListener("mouseenter", () => {
        if (Game.isRendering) return;
        const bx = parseInt(button.dataset.x, 10);
        const by = parseInt(button.dataset.y, 10);
        const cell = Game.cellAt(bx, by);
        if (!cell) return;
        Game.hoveredCell = cell;
        Game.previewCell = cell;
        Game.focusedCell = cell;
        Game.showTileInfo(cell);
        Game.showGrowPreview(cell);
        Game.render();
      });

      button.addEventListener("mouseleave", () => {
        if (Game.isRendering) return;
        Game.hoveredCell = null;
        Game.previewCell = null;
        Game.hideGrowPreview();
        Game.showTileInfo(Game.selectedCell || Game.focusedCell);
        Game.render();
      });

      button.addEventListener("touchstart", (e) => {
        e.preventDefault();
        const bx = parseInt(button.dataset.x, 10);
        const by = parseInt(button.dataset.y, 10);
        const cell = Game.cellAt(bx, by);
        if (!cell) return;
        if (Game.previewCell && Game.previewCell.x === cell.x && Game.previewCell.y === cell.y) {
          Game.selectedCell = cell;
          Game.focusedCell = cell;
          Game.hideGrowPreview();
          Game.previewCell = null;
          if (!Game.grow(cell)) Game.render();
        } else {
          Game.hoveredCell = cell;
          Game.previewCell = cell;
          Game.selectedCell = cell;
          Game.focusedCell = cell;
          Game.showTileInfo(cell);
          Game.showGrowPreview(cell);
          Game.render();
        }
      }, { passive: false });

      button.addEventListener("focus", () => {
        if (Game.isRendering) return;
        const bx = parseInt(button.dataset.x, 10);
        const by = parseInt(button.dataset.y, 10);
        const cell = Game.cellAt(bx, by);
        if (!cell) return;
        if (Game.focusedCell && Game.focusedCell.x === bx && Game.focusedCell.y === by) return;
        Game.focusedCell = cell;
        Game.hoveredCell = cell;
        Game.previewCell = cell;
        Game.showTileInfo(cell);
        Game.showGrowPreview(cell);
        Game.render();
      });

      button.addEventListener("blur", () => {
        if (Game.isRendering) return;
        setTimeout(() => {
          const stillInMap = document.activeElement &&
            document.activeElement.closest &&
            document.activeElement.closest("#map") !== null;
          if (stillInMap) return;
          Game.hoveredCell = null;
          Game.previewCell = null;
          Game.hideGrowPreview();
          Game.showTileInfo(Game.selectedCell);
          Game.render();
        }, 0);
      });

      button.addEventListener("click", () => {
        const bx = parseInt(button.dataset.x, 10);
        const by = parseInt(button.dataset.y, 10);
        const cell = Game.cellAt(bx, by);
        if (!cell) return;
        Game.selectedCell = cell;
        Game.focusedCell = cell;
        Game.hideGrowPreview();
        Game.previewCell = null;
        if (!Game.grow(cell)) Game.render();
      });

      Game.mapEl.appendChild(button);
      row.push(button);
    }
    Game._tileButtons.push(row);
  }
};

Game.updateTileDom = function(cell) {
  if (!Game._tileButtons || !Game._tileButtons[cell.y]) return;
  const button = Game._tileButtons[cell.y][cell.x];
  if (!button) return;
  button.className = Game.tileClass(cell);
  button.title = `${cell.soil} ${cell.x},${cell.y}`;
  button.setAttribute("aria-label", Game.buildTileLabel(cell));
  if (cell.block) {
    button.setAttribute("aria-disabled", "true");
  } else {
    button.removeAttribute("aria-disabled");
  }
  if (cell.mycelium) {
    button.setAttribute("aria-pressed", "true");
  } else {
    button.removeAttribute("aria-pressed");
  }
};

Game.announce = function(text) {
  if (!Game.srAnnounceEl) return;
  Game.srAnnounceEl.textContent = "";
  setTimeout(() => { Game.srAnnounceEl.textContent = text; }, 30);
};

Game.buildTileLabel = function(cell) {
  const soilNames = { loam: "壤土", wet: "湿土", dry: "干层" };
  const parts = [];
  parts.push(`坐标 (${cell.x}, ${cell.y})`);
  parts.push(soilNames[cell.soil]);

  if (cell.block) {
    parts.push("不可通行");
  }
  if (cell.mycelium) {
    parts.push("已占领");
  }
  if (cell.tree) {
    parts.push(cell.mycelium ? "树根已连接" : "树根");
  }
  if (cell.leaf) {
    parts.push(cell.decomposed ? "落叶已分解" : "落叶");
  }
  if (cell.microbe) {
    parts.push(cell.competed ? "微生物已竞争" : "存在微生物");
  }
  if (!cell.block && !cell.mycelium) {
    const canGrowTo = Game.canGrow(cell);
    const tileCost = Game.cost[cell.soil] + (cell.microbe && !cell.competed ? 3 : 0);
    if (canGrowTo) {
      if (Game.state.nutrients >= tileCost) {
        parts.push(`可扩张，消耗${tileCost}养分`);
      } else {
        parts.push(`可扩张但养分不足，需要${tileCost}养分`);
      }
    } else {
      parts.push("未连接菌丝");
    }
  }
  return parts.join("，");
};

Game.moveFocus = function(dx, dy) {
  const startCell = Game._getFocusStartCell();
  if (!startCell) return;
  const newX = startCell.x + dx;
  const newY = startCell.y + dy;
  if (newX < 0 || newX >= 10 || newY < 0 || newY >= 10) return;
  const target = Game.cellAt(newX, newY);
  if (!target) return;
  Game.focusedCell = target;
  Game.hoveredCell = target;
  Game.previewCell = target;
  Game.showTileInfo(target);
  Game.showGrowPreview(target);
  Game.render();
  const btn = Game._tileButtons && Game._tileButtons[newY] && Game._tileButtons[newY][newX];
  if (btn && document.activeElement !== btn) {
    btn.focus({ preventScroll: true });
  }
  Game.announce(Game.buildTileLabel(target));
};

Game._getFocusStartCell = function() {
  if (Game.focusedCell) return Game.focusedCell;
  if (Game.selectedCell) return Game.selectedCell;
  const activeEl = document.activeElement;
  if (activeEl && activeEl.closest && activeEl.closest("#map")) {
    const bx = parseInt(activeEl.getAttribute("data-x"), 10);
    const by = parseInt(activeEl.getAttribute("data-y"), 10);
    const cell = Game.cellAt(bx, by);
    if (cell) return cell;
  }
  const start = Game.currentLevel().start;
  return Game.cellAt(start[0], start[1]);
};

Game.activateFocused = function() {
  const target = Game.focusedCell || Game.selectedCell;
  if (!target) return;
  Game.selectedCell = target;
  Game.hideGrowPreview();
  Game.previewCell = null;
  if (!Game.grow(target)) {
    Game.render();
  }
};

Game.tileClass = function(cell) {
  const classes = ["cell", cell.soil];
  if (cell.block) classes.push("block");
  if (cell.tree) classes.push("tree");
  if (cell.leaf && !cell.decomposed) classes.push("leaf");
  if (cell.microbe && !cell.competed) classes.push("microbe");
  if (cell.mycelium) classes.push("mycelium");
  if (Game.canGrow(cell)) classes.push("frontier");
  if (Game.selectedCell && Game.selectedCell.x === cell.x && Game.selectedCell.y === cell.y) classes.push("selected");
  if (Game.hoveredCell && Game.hoveredCell.x === cell.x && Game.hoveredCell.y === cell.y) classes.push("hovered");
  if (Game.focusedCell && Game.focusedCell.x === cell.x && Game.focusedCell.y === cell.y) classes.push("focused");
  if (Game.previewCell && Game.previewCell.x === cell.x && Game.previewCell.y === cell.y) {
    classes.push("previewing");
    if (Game.lastPreview) {
      if (!Game.lastPreview.canGrow) {
        classes.push("preview-blocked");
      } else if (Game.lastPreview.nutrientDelta >= 0) {
        classes.push("preview-positive");
      } else {
        const after = Game.state.nutrients + Game.lastPreview.nutrientDelta;
        if (after < 0) {
          classes.push("preview-negative-danger");
        } else if (Game.state.nutrients < Game.lastPreview.cost) {
          classes.push("preview-negative-low");
        } else {
          classes.push("preview-negative");
        }
      }
    }
  }
  return classes.join(" ");
};

Game.showTileInfo = function(cell) {
  const hintEl = document.querySelector(".tile-hint");
  const detailsEl = document.querySelector("#tileDetails");

  if (!cell) {
    hintEl.hidden = false;
    detailsEl.hidden = true;
    return;
  }

  hintEl.hidden = true;
  detailsEl.hidden = false;

  const soilNames = { loam: "壤土", wet: "湿土", dry: "干层" };
  const tileCost = Game.cost[cell.soil] + (cell.microbe && !cell.competed ? 3 : 0);
  const canGrowTo = Game.canGrow(cell);

  document.querySelector("#tileCoord").textContent = `(${cell.x}, ${cell.y})`;
  document.querySelector("#tileSoil").textContent = soilNames[cell.soil];
  document.querySelector("#tileCost").textContent = `${tileCost} 养分`;

  const treeEl = document.querySelector("#tileTree");
  if (cell.tree) {
    treeEl.textContent = cell.mycelium ? "有（已连接）" : "有";
    treeEl.className = "status-yes";
  } else {
    treeEl.textContent = "无";
    treeEl.className = "status-no";
  }

  const leafEl = document.querySelector("#tileLeaf");
  if (cell.leaf) {
    leafEl.textContent = cell.decomposed ? "有（已分解）" : "有";
    leafEl.className = "status-yes";
  } else {
    leafEl.textContent = "无";
    leafEl.className = "status-no";
  }

  const microbeEl = document.querySelector("#tileMicrobe");
  if (cell.microbe) {
    microbeEl.textContent = cell.competed ? "有（已竞争）" : "有";
    microbeEl.className = "status-yes";
  } else {
    microbeEl.textContent = "无";
    microbeEl.className = "status-no";
  }

  const canGrowEl = document.querySelector("#tileCanGrow");
  if (cell.mycelium) {
    canGrowEl.textContent = "已占领";
    canGrowEl.className = "status-yes";
  } else if (cell.block) {
    canGrowEl.textContent = "不可通行";
    canGrowEl.className = "status-cannot";
  } else if (canGrowTo) {
    canGrowEl.textContent = Game.state.nutrients >= tileCost ? "可以扩张" : "养分不足";
    canGrowEl.className = Game.state.nutrients >= tileCost ? "status-can" : "status-cannot";
  } else {
    canGrowEl.textContent = "未连接菌丝";
    canGrowEl.className = "status-cannot";
  }
};

Game.showGrowPreview = function(cell) {
  const previewEl = document.querySelector("#growPreview");
  const previewEffects = document.querySelector("#previewEffects");
  const previewWarnings = document.querySelector("#previewWarnings");
  const deltaEl = document.querySelector("#previewDelta");
  const afterEl = document.querySelector("#previewAfter");

  if (!cell) {
    previewEl.hidden = true;
    Game.previewCell = null;
    Game.lastPreview = null;
    return;
  }

  const result = Game.simulateGrow(cell);
  Game.previewCell = cell;
  Game.lastPreview = result;

  previewEl.hidden = false;

  previewEffects.innerHTML = "";
  previewWarnings.innerHTML = "";

  if (result.canGrow) {
    const hasEnoughNutrients = Game.state.nutrients >= result.cost;
    const baseSoilCost = Game.cost[cell.soil];
    const hasMicrobeCost = cell.microbe && !cell.competed;

    deltaEl.textContent = (result.nutrientDelta >= 0 ? "+" : "") + result.nutrientDelta;
    deltaEl.className = result.nutrientDelta >= 0 ? "delta-positive" : "delta-negative";

    const afterValue = Game.state.nutrients + result.nutrientDelta;
    afterEl.textContent = afterValue;
    afterEl.className = afterValue >= 0 ? (hasEnoughNutrients ? "after-ok" : "after-low") : "after-negative";

    const costLi = document.createElement("li");
    costLi.className = "effect-cost";
    costLi.innerHTML = `<span class="effect-label">土壤消耗${hasMicrobeCost ? "（基础）" : ""}</span><span class="effect-value">-${baseSoilCost}</span>`;
    previewEffects.appendChild(costLi);

    result.effects.forEach((effect) => {
      const li = document.createElement("li");
      li.className = `effect-${effect.type}`;
      const sign = effect.type === "microbe" ? "-" : "+";
      li.innerHTML = `<span class="effect-label">${effect.label}</span><span class="effect-value">${sign}${effect.value}</span>`;
      previewEffects.appendChild(li);
    });

    const summary = document.createElement("li");
    summary.className = `effect-summary ${result.nutrientDelta >= 0 ? "summary-positive" : "summary-negative"}`;
    summary.innerHTML = `<span class="effect-label">净变化</span><span class="effect-value">${result.nutrientDelta >= 0 ? "+" : ""}${result.nutrientDelta}</span>`;
    previewEffects.appendChild(summary);

    if (!hasEnoughNutrients) {
      const warn = document.createElement("li");
      warn.className = "warning-blocker";
      warn.textContent = `养分不足：需要 ${result.cost}，当前 ${Game.state.nutrients}`;
      previewWarnings.appendChild(warn);
    }
  } else {
    deltaEl.textContent = "—";
    deltaEl.className = "delta-na";
    afterEl.textContent = "—";
    afterEl.className = "after-na";

    const blocker = document.createElement("li");
    blocker.className = "warning-blocker";
    blocker.textContent = `无法扩张：${result.reason}`;
    previewWarnings.appendChild(blocker);
  }

  result.warnings.forEach((warning) => {
    const li = document.createElement("li");
    li.className = "warning-item";
    li.textContent = warning;
    previewWarnings.appendChild(li);
  });
};

Game.hideGrowPreview = function() {
  const previewEl = document.querySelector("#growPreview");
  previewEl.hidden = true;
  Game.previewCell = null;
  Game.lastPreview = null;
};

Game.render = function() {
  Game.isRendering = true;
  const level = Game.currentLevel();
  const winCondition = level.winCondition;
  Game.levelSelectEl.value = Game.levelIndex;
  document.querySelector("#levelGoal").textContent = level.goal;

  const nutrientEl = document.querySelector("#nutrients");
  if (Game.previewCell && Game.lastPreview && Game.lastPreview.canGrow) {
    const previewVal = Game.state.nutrients + Game.lastPreview.nutrientDelta;
    const delta = Game.lastPreview.nutrientDelta;
    nutrientEl.innerHTML = `<span class="nutrient-base">${Game.state.nutrients}</span> <span class="nutrient-preview-arrow">→</span> <span class="nutrient-preview ${delta >= 0 ? "nutrient-up" : "nutrient-down"}">${previewVal}</span> <span class="nutrient-delta ${delta >= 0 ? "delta-up" : "delta-down"}">(${delta >= 0 ? "+" : ""}${delta})</span>`;
  } else {
    nutrientEl.textContent = Game.state.nutrients;
    nutrientEl.className = "";
  }
  document.querySelector("#turn").textContent = Game.state.turn;

  const treeDone = Game.state.cells.filter((cell) => cell.tree && cell.mycelium).length;
  const leavesDone = Game.state.cells.filter((cell) => cell.leaf && cell.decomposed).length;
  const length = Game.state.cells.filter((cell) => cell.mycelium).length;
  document.querySelector("#trees").textContent = `${treeDone}/${winCondition.requiredTrees}`;
  document.querySelector("#leaves").textContent = `${leavesDone}/${winCondition.requiredLeaves}`;
  document.querySelector("#length").textContent = length;

  Game.ensureMapDom();

  const prevLogLength = Game.state ? Game.state._lastLogLen || 0 : 0;

  Game.state.cells.forEach((cell) => {
    Game.updateTileDom(cell);
  });

  if (Game.hoveredCell) {
    const currentCell = Game.cellAt(Game.hoveredCell.x, Game.hoveredCell.y);
    if (currentCell) {
      Game.hoveredCell = currentCell;
      Game.previewCell = currentCell;
      Game.showTileInfo(currentCell);
      Game.showGrowPreview(currentCell);
    }
  } else if (Game.selectedCell) {
    const currentCell = Game.cellAt(Game.selectedCell.x, Game.selectedCell.y);
    if (currentCell) {
      Game.selectedCell = currentCell;
      Game.showTileInfo(currentCell);
    }
  } else {
    Game.showTileInfo(null);
    Game.hideGrowPreview();
  }

  if (treeDone >= winCondition.requiredTrees && leavesDone >= winCondition.requiredLeaves) {
    const treeMet = winCondition.requiredTrees > 0 ? `已连接${treeDone}处树根` : "";
    const leafMet = winCondition.requiredLeaves > 0 ? `已分解${leavesDone}片落叶` : "";
    const parts = [treeMet, leafMet].filter(Boolean);
    Game.addLogOnce(`网络稳定，森林进入共生状态。（${parts.join("，")}）`);
  }
  if (Game.state.nutrients < 0) Game.addLogOnce("养分透支，菌丝停止扩张。");

  Game.logEl.innerHTML = "";
  Game.state.log.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    Game.logEl.appendChild(li);
  });

  const currentLogLen = Game.state.log.length;
  if (currentLogLen > prevLogLength) {
    const newEntries = Game.state.log.slice(0, currentLogLen - prevLogLength);
    if (Game.srLogEl) Game.srLogEl.textContent = newEntries.join("；");
    Game.state._lastLogLen = currentLogLen;
  } else {
    Game.state._lastLogLen = currentLogLen;
  }

  Game.isRendering = false;
};

Game.countLevelStats = function(level) {
  let trees = 0;
  let leaves = 0;
  let microbes = 0;
  for (const row of level.tiles) {
    for (const char of row) {
      if (char === "t") trees += 1;
      else if (char === "f") leaves += 1;
      else if (char === "m") microbes += 1;
    }
  }
  return { trees, leaves, microbes };
};

Game.renderGuide = function() {
  const guideList = document.querySelector("#guideList");
  guideList.innerHTML = "";
  Game.levels.forEach((level, index) => {
    const stats = Game.countLevelStats(level);
    const item = document.createElement("div");
    item.className = "guide-item" + (index === Game.levelIndex ? " active" : "");
    item.innerHTML = `
      <h3>${level.name}</h3>
      <p class="guide-goal">${level.goal}</p>
      <dl>
        <div><dt>初始养分</dt><dd>${level.nutrients}</dd></div>
        <div><dt>树根数量</dt><dd>${stats.trees}</dd></div>
        <div><dt>落叶数量</dt><dd>${stats.leaves}</dd></div>
        <div><dt>微生物数量</dt><dd>${stats.microbes}</dd></div>
      </dl>
    `;
    item.addEventListener("click", () => {
      Game.levelIndex = index;
      Game.reset();
      Game.renderGuide();
    });
    guideList.appendChild(item);
  });
};

Game.toggleGuide = function() {
  const guide = document.querySelector("#guide");
  if (guide.hidden) {
    guide.hidden = false;
    Game.renderGuide();
  } else {
    guide.hidden = true;
  }
};
