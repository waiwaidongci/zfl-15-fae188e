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
  if (Game.isCustomLevel && Game.customLevel) {
    const option = document.createElement("option");
    option.value = Game.levels.length;
    option.textContent = "★ " + (Game.customLevel.name || "自定义关卡");
    Game.levelSelectEl.appendChild(option);
    Game.levelSelectEl.value = Game.levels.length;
  } else {
    Game.levelSelectEl.value = Game.levelIndex;
  }
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
  const current = Game.currentLevel();
  if (current && current.start) {
    return Game.cellAt(current.start[0], current.start[1]);
  }
  return Game.cellAt(0, 0);
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
    item.className = "guide-item" +
      (!Game.isCustomLevel && index === Game.levelIndex ? " active" : "");
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
      Game.isCustomLevel = false;
      Game.reset();
      Game.renderGuide();
      Game.renderLevelOptions();
    });
    guideList.appendChild(item);
  });
  if (Game.isCustomLevel && Game.customLevel) {
    const level = Game.customLevel;
    const stats = Game.countLevelStats(level);
    const item = document.createElement("div");
    item.className = "guide-item active";
    item.innerHTML = `
      <h3>★ ${level.name}</h3>
      <p class="guide-goal">${level.goal}</p>
      <dl>
        <div><dt>初始养分</dt><dd>${level.nutrients}</dd></div>
        <div><dt>树根数量</dt><dd>${stats.trees}</dd></div>
        <div><dt>落叶数量</dt><dd>${stats.leaves}</dd></div>
        <div><dt>微生物数量</dt><dd>${stats.microbes}</dd></div>
      </dl>
    `;
    guideList.appendChild(item);
  }
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

Game.toggleEditor = function() {
  const editor = document.querySelector("#editor");
  const guide = document.querySelector("#guide");
  if (editor.hidden) {
    editor.hidden = false;
    guide.hidden = true;
    Game.editorLoadFromCurrent();
  } else {
    editor.hidden = true;
  }
};

Game.editorLoadFromCurrent = function() {
  const level = Game.currentLevel();
  document.querySelector("#editorName").value = Game.isCustomLevel ? level.name : "";
  document.querySelector("#editorGoal").value = Game.isCustomLevel ? level.goal : "";
  document.querySelector("#editorNutrients").value = level.nutrients;
  document.querySelector("#editorStartX").value = level.start[0];
  document.querySelector("#editorStartY").value = level.start[1];
  document.querySelector("#editorTrees").value = level.winCondition.requiredTrees;
  document.querySelector("#editorLeaves").value = level.winCondition.requiredLeaves;
  const tiles = level.tiles.slice(0, 10);
  while (tiles.length < 10) tiles.push("llllllllll");
  document.querySelector("#editorMap").value = tiles.join("\n");
  document.querySelector("#editorValidation").hidden = true;
  document.querySelector("#editorPreview").hidden = true;
  document.querySelector("#editorApply").disabled = true;
};

Game.editorFillExample = function() {
  const example = [
    "llllllllll",
    "llldflwmll",
    "llwllldlll",
    "ldllmllltd",
    "lllddllwll",
    "llwlllllll",
    "lllfdlmlll",
    "lmllllldtl",
    "lslldlllll",
    "lllltllldl"
  ];
  document.querySelector("#editorMap").value = example.join("\n");
  document.querySelector("#editorName").value = "自定义示例";
  document.querySelector("#editorGoal").value = "连接3处树根，分解至少2片落叶";
  document.querySelector("#editorNutrients").value = 34;
  document.querySelector("#editorStartX").value = 1;
  document.querySelector("#editorStartY").value = 8;
  document.querySelector("#editorTrees").value = 3;
  document.querySelector("#editorLeaves").value = 2;
};

Game.editorClearMap = function() {
  const empty = [];
  for (let i = 0; i < 10; i += 1) empty.push("llllllllll");
  document.querySelector("#editorMap").value = empty.join("\n");
  document.querySelector("#editorValidation").hidden = true;
  document.querySelector("#editorPreview").hidden = true;
  document.querySelector("#editorApply").disabled = true;
};

Game.editorCollectFormData = function() {
  return {
    name: document.querySelector("#editorName").value.trim(),
    goal: document.querySelector("#editorGoal").value.trim(),
    nutrients: Math.max(1, Math.min(200,
      parseInt(document.querySelector("#editorNutrients").value, 10) || 30
    )),
    start: [
      Math.max(0, Math.min(9,
        parseInt(document.querySelector("#editorStartX").value, 10) || 0
      )),
      Math.max(0, Math.min(9,
        parseInt(document.querySelector("#editorStartY").value, 10) || 0
      ))
    ],
    winCondition: {
      requiredTrees: Math.max(0, Math.min(20,
        parseInt(document.querySelector("#editorTrees").value, 10) || 0
      )),
      requiredLeaves: Math.max(0, Math.min(20,
        parseInt(document.querySelector("#editorLeaves").value, 10) || 0
      ))
    }
  };
};

Game.editorValidate = function() {
  const formData = Game.editorCollectFormData();
  const mapText = document.querySelector("#editorMap").value;
  const lines = Game.parseEditorMap(mapText);
  const result = Game.validateLevel(formData, lines);

  const validationEl = document.querySelector("#editorValidation");
  validationEl.hidden = false;
  validationEl.className = "editor-validation " +
    (result.valid ? "validation-success" : "validation-error");

  let html = "";
  html += `<h4>${result.valid ? "✓ 校验通过" : "✕ 校验失败"}</h4>`;
  html += "<ul>";

  const criticalErrors = result.errors.filter(e => e.critical);
  criticalErrors.forEach(e => {
    html += `<li class="error-critical">错误：${e.msg}</li>`;
  });
  result.errors.filter(e => !e.critical).forEach(e => {
    html += `<li>错误：${e.msg}</li>`;
  });
  result.warnings.forEach(w => {
    html += `<li>警告：${w.msg}</li>`;
  });
  result.infos.forEach(i => {
    html += `<li>信息：${i.msg}</li>`;
  });

  html += "</ul>";
  validationEl.innerHTML = html;

  Game.editorRenderPreview(lines, result.finalStart, result.stats);

  const applyBtn = document.querySelector("#editorApply");
  if (result.valid) {
    applyBtn.disabled = false;
    applyBtn.dataset.level = JSON.stringify({
      form: formData,
      lines: lines
    });
  } else {
    applyBtn.disabled = true;
    delete applyBtn.dataset.level;
  }
};

Game.editorRenderPreview = function(lines, start, stats) {
  const previewEl = document.querySelector("#editorPreview");
  const mapEl = document.querySelector("#editorPreviewMap");
  const statsEl = document.querySelector("#editorPreviewStats");

  previewEl.hidden = false;
  mapEl.innerHTML = "";

  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 10; x += 1) {
      const ch = lines[y]?.[x] || "l";
      const cell = document.createElement("div");
      cell.className = "editor-preview-cell";

      let soil = "loam";
      if (ch === "w") soil = "wet";
      else if (ch === "d") soil = "dry";
      else if (ch === "b") soil = "block";
      cell.classList.add(soil);

      if (!Game.validEditorChars.includes(ch)) {
        cell.style.background = "#a23535";
        cell.title = `非法字符: ${ch}`;
      }
      if (ch === "t") cell.classList.add("tree");
      if (ch === "f") cell.classList.add("leaf");
      if (ch === "m") cell.classList.add("microbe");
      if (start && x === start[0] && y === start[1] && ch !== "b") {
        cell.classList.add("start");
      }
      if (ch === "s" && !(start && x === start[0] && y === start[1])) {
        cell.classList.add("start");
      }

      mapEl.appendChild(cell);
    }
  }

  const soilNames = { loam: "壤土", wet: "湿土", dry: "干层", block: "障碍" };
  let totalCells = 100;
  let soilCount = { loam: 0, wet: 0, dry: 0, block: 0 };
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 10; x += 1) {
      const ch = lines[y]?.[x];
      if (ch === "w") soilCount.wet += 1;
      else if (ch === "d") soilCount.dry += 1;
      else if (ch === "b") soilCount.block += 1;
      else soilCount.loam += 1;
    }
  }

  statsEl.innerHTML = `
    <div><dt>壤土</dt><dd>${soilCount.loam}</dd></div>
    <div><dt>湿土</dt><dd>${soilCount.wet}</dd></div>
    <div><dt>干层</dt><dd>${soilCount.dry}</dd></div>
    <div><dt>障碍</dt><dd>${soilCount.block}</dd></div>
    <div><dt>树根</dt><dd>${stats.trees}</dd></div>
    <div><dt>落叶</dt><dd>${stats.leaves}</dd></div>
    <div><dt>微生物</dt><dd>${stats.microbes}</dd></div>
    <div><dt>起点</dt><dd>(${start[0]},${start[1]})</dd></div>
  `;
};

Game.editorApplyLevel = function() {
  const applyBtn = document.querySelector("#editorApply");
  if (applyBtn.disabled || !applyBtn.dataset.level) return;
  try {
    const data = JSON.parse(applyBtn.dataset.level);
    const level = Game.buildLevelFromEditor(data.form, data.lines);
    Game.customLevel = level;
    Game.isCustomLevel = true;
    Game.reset();
    Game.renderLevelOptions();
    document.querySelector("#levelSelect").value = Game.levels.length;
    const editor = document.querySelector("#editor");
    editor.hidden = true;
    Game.announce(`已加载自定义关卡：${level.name}`);
  } catch (e) {
    console.error(e);
    alert("应用关卡失败：" + e.message);
  }
};

Game.editorExportJSON = function() {
  const formData = Game.editorCollectFormData();
  const mapText = document.querySelector("#editorMap").value;
  const lines = Game.parseEditorMap(mapText);
  const result = Game.validateLevel(formData, lines);

  const exportData = {
    name: formData.name || "自定义关卡",
    goal: formData.goal || "完成自定义目标",
    nutrients: formData.nutrients,
    start: result.finalStart,
    winCondition: {
      requiredTrees: formData.winCondition.requiredTrees,
      requiredLeaves: formData.winCondition.requiredLeaves
    },
    tiles: lines.map(l => {
      let out = "";
      for (let x = 0; x < 10; x += 1) {
        out += l[x] || "l";
      }
      return out;
    }),
    _exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `level_${(exportData.name || "custom").replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_")}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

Game.editorTriggerImport = function() {
  document.querySelector("#editorImport").click();
};

Game.editorHandleImport = function(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || !Array.isArray(data.tiles)) {
        throw new Error("无效的关卡文件：缺少 tiles 数组");
      }
      const tiles = data.tiles.slice(0, 10);
      while (tiles.length < 10) tiles.push("llllllllll");
      const normalizedTiles = tiles.map(row => {
        let r = row.slice(0, 10);
        while (r.length < 10) r += "l";
        return r;
      });

      document.querySelector("#editorName").value = data.name || "";
      document.querySelector("#editorGoal").value = data.goal || "";
      document.querySelector("#editorNutrients").value =
        (data.nutrients && data.nutrients > 0) ? data.nutrients : 30;
      if (Array.isArray(data.start) && data.start.length === 2) {
        document.querySelector("#editorStartX").value =
          Math.max(0, Math.min(9, data.start[0]));
        document.querySelector("#editorStartY").value =
          Math.max(0, Math.min(9, data.start[1]));
      }
      if (data.winCondition) {
        document.querySelector("#editorTrees").value =
          Math.max(0, Math.min(20, data.winCondition.requiredTrees || 0));
        document.querySelector("#editorLeaves").value =
          Math.max(0, Math.min(20, data.winCondition.requiredLeaves || 0));
      }
      document.querySelector("#editorMap").value = normalizedTiles.join("\n");

      document.querySelector("#editorValidation").hidden = true;
      document.querySelector("#editorPreview").hidden = true;
      document.querySelector("#editorApply").disabled = true;
      Game.announce("已导入关卡文件，请点击校验按钮检查");
    } catch (err) {
      alert("导入失败：" + err.message);
    }
  };
  reader.readAsText(file);
};
