const levels = [
  {
    name: "松林边缘",
    goal: "连接3处树根，分解至少2片落叶。",
    nutrients: 34,
    start: [1, 8],
    winCondition: {
      requiredTrees: 3,
      requiredLeaves: 2
    },
    tiles: [
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
    ]
  },
  {
    name: "桦树湿沟",
    goal: "绕过干层连接4处树根。",
    nutrients: 38,
    start: [0, 5],
    winCondition: {
      requiredTrees: 4,
      requiredLeaves: 0
    },
    tiles: [
      "lllddflltl",
      "lwwldlmlll",
      "lldddllwll",
      "lllmllldll",
      "dldlllwllt",
      "sllllmllll",
      "lwwfdddfll",
      "lllmdllltl",
      "llldllwlll",
      "tlllllldll"
    ]
  }
];

const cost = { loam: 3, wet: 2, dry: 6 };
let levelIndex = 0;
let state;
let history = [];
let selectedCell = null;
let hoveredCell = null;
let previewCell = null;
let lastPreview = null;
let isRendering = false;

function mulberry32Step(a) {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value: result, nextState: a };
}

function seedForLevel(index) {
  return (1779033703 ^ Math.imul(index, 2654435761)) >>> 0;
}

function levelRng() {
  if (!state || state._rngState === undefined) return Math.random();
  const step = mulberry32Step(state._rngState);
  state._rngState = step.nextState;
  return step.value;
}

const mapEl = document.querySelector("#map");
const logEl = document.querySelector("#log");
const levelSelectEl = document.querySelector("#levelSelect");

function renderLevelOptions() {
  levelSelectEl.innerHTML = "";
  levels.forEach((level, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = level.name;
    levelSelectEl.appendChild(option);
  });
  levelSelectEl.value = levelIndex;
}

function parseLevel(level) {
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
    _rngState: seedForLevel(levelIndex)
  };
}

function currentLevel() {
  return levels[levelIndex];
}

function saveHistory() {
  history.push(JSON.stringify(state));
  if (history.length > 40) history.shift();
}

function cellAt(x, y) {
  return state.cells.find((cell) => cell.x === x && cell.y === y);
}

function neighbors(cell) {
  return [
    cellAt(cell.x + 1, cell.y),
    cellAt(cell.x - 1, cell.y),
    cellAt(cell.x, cell.y + 1),
    cellAt(cell.x, cell.y - 1)
  ].filter(Boolean);
}

function canGrow(cell) {
  return !cell.block && !cell.mycelium && neighbors(cell).some((item) => item.mycelium);
}

function grow(cell) {
  if (!canGrow(cell)) return false;
  const tileCost = cost[cell.soil] + (cell.microbe && !cell.competed ? 3 : 0);
  if (state.nutrients < tileCost) {
    addLog("养分不足，前沿停止扩张。");
    return false;
  }
  saveHistory();
  cell.mycelium = true;
  state.nutrients -= tileCost;
  if (cell.leaf && !cell.decomposed) {
    cell.decomposed = true;
    state.nutrients += 8;
    addLog("落叶被分解，养分回流。");
  } else if (cell.tree) {
    state.nutrients += cell.soil === "wet" ? 5 : 3;
    addLog("树根被接入网络。");
  } else if (cell.microbe && !cell.competed) {
    cell.competed = true;
    addLog("微生物竞争消耗额外养分。");
  } else {
    addLog(`${cell.soil === "dry" ? "干层" : cell.soil === "wet" ? "湿土" : "壤土"}中新生菌丝。`);
  }
  render();
  return true;
}

function simulateGrow(cell) {
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

  if (!neighbors(cell).some((item) => item.mycelium)) {
    result.reason = "未连接菌丝";
    result.warnings.push("需与已有菌丝相邻");
    return result;
  }

  result.canGrow = true;
  result.cost = cost[cell.soil] + (cell.microbe && !cell.competed ? 3 : 0);
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

  if (state.nutrients < result.cost) {
    result.reason = "养分不足";
    result.warnings.push(`需要${result.cost}养分，当前仅${state.nutrients}`);
  }

  return result;
}

function addLog(text) {
  state.log.unshift(text);
  state.log = state.log.slice(0, 6);
}

function nextTurn() {
  saveHistory();
  state.turn += 1;
  let upkeep = Math.max(1, Math.floor(state.cells.filter((cell) => cell.mycelium).length / 8));
  const treeLinks = state.cells.filter((cell) => cell.mycelium && cell.tree).length;
  state.nutrients += treeLinks * 2 - upkeep;

  state.cells.forEach((cell) => {
    if (cell.microbe && !cell.mycelium && levelRng() < 0.18) {
      const target = neighbors(cell).find((item) => !item.mycelium && !item.tree && !item.leaf);
      if (target) target.microbe = true;
    }
  });

  addLog(`维持消耗${upkeep}点，树根回馈${treeLinks * 2}点。`);
  render();
}

function tileClass(cell) {
  const classes = ["cell", cell.soil];
  if (cell.block) classes.push("block");
  if (cell.tree) classes.push("tree");
  if (cell.leaf && !cell.decomposed) classes.push("leaf");
  if (cell.microbe && !cell.competed) classes.push("microbe");
  if (cell.mycelium) classes.push("mycelium");
  if (canGrow(cell)) classes.push("frontier");
  if (selectedCell && selectedCell.x === cell.x && selectedCell.y === cell.y) classes.push("selected");
  if (hoveredCell && hoveredCell.x === cell.x && hoveredCell.y === cell.y) classes.push("hovered");
  if (previewCell && previewCell.x === cell.x && previewCell.y === cell.y) {
    classes.push("previewing");
    if (lastPreview) {
      if (!lastPreview.canGrow) {
        classes.push("preview-blocked");
      } else if (lastPreview.nutrientDelta >= 0) {
        classes.push("preview-positive");
      } else {
        const after = state.nutrients + lastPreview.nutrientDelta;
        if (after < 0) {
          classes.push("preview-negative-danger");
        } else if (state.nutrients < lastPreview.cost) {
          classes.push("preview-negative-low");
        } else {
          classes.push("preview-negative");
        }
      }
    }
  }
  return classes.join(" ");
}

function showTileInfo(cell) {
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
  const tileCost = cost[cell.soil] + (cell.microbe && !cell.competed ? 3 : 0);
  const canGrowTo = canGrow(cell);

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
    canGrowEl.textContent = state.nutrients >= tileCost ? "可以扩张" : "养分不足";
    canGrowEl.className = state.nutrients >= tileCost ? "status-can" : "status-cannot";
  } else {
    canGrowEl.textContent = "未连接菌丝";
    canGrowEl.className = "status-cannot";
  }
}

function showGrowPreview(cell) {
  const previewEl = document.querySelector("#growPreview");
  const previewEffects = document.querySelector("#previewEffects");
  const previewWarnings = document.querySelector("#previewWarnings");
  const deltaEl = document.querySelector("#previewDelta");
  const afterEl = document.querySelector("#previewAfter");

  if (!cell) {
    previewEl.hidden = true;
    previewCell = null;
    lastPreview = null;
    return;
  }

  const result = simulateGrow(cell);
  previewCell = cell;
  lastPreview = result;

  previewEl.hidden = false;

  previewEffects.innerHTML = "";
  previewWarnings.innerHTML = "";

  if (result.canGrow) {
    const hasEnoughNutrients = state.nutrients >= result.cost;
    const baseSoilCost = cost[cell.soil];
    const hasMicrobeCost = cell.microbe && !cell.competed;

    deltaEl.textContent = (result.nutrientDelta >= 0 ? "+" : "") + result.nutrientDelta;
    deltaEl.className = result.nutrientDelta >= 0 ? "delta-positive" : "delta-negative";

    const afterValue = state.nutrients + result.nutrientDelta;
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
      warn.textContent = `养分不足：需要 ${result.cost}，当前 ${state.nutrients}`;
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
}

function hideGrowPreview() {
  const previewEl = document.querySelector("#growPreview");
  previewEl.hidden = true;
  previewCell = null;
  lastPreview = null;
}

function render() {
  isRendering = true;
  const level = currentLevel();
  const winCondition = level.winCondition;
  levelSelectEl.value = levelIndex;
  document.querySelector("#levelGoal").textContent = level.goal;

  const nutrientEl = document.querySelector("#nutrients");
  if (previewCell && lastPreview && lastPreview.canGrow) {
    const previewVal = state.nutrients + lastPreview.nutrientDelta;
    const delta = lastPreview.nutrientDelta;
    nutrientEl.innerHTML = `<span class="nutrient-base">${state.nutrients}</span> <span class="nutrient-preview-arrow">→</span> <span class="nutrient-preview ${delta >= 0 ? "nutrient-up" : "nutrient-down"}">${previewVal}</span> <span class="nutrient-delta ${delta >= 0 ? "delta-up" : "delta-down"}">(${delta >= 0 ? "+" : ""}${delta})</span>`;
  } else {
    nutrientEl.textContent = state.nutrients;
    nutrientEl.className = "";
  }
  document.querySelector("#turn").textContent = state.turn;

  const treeDone = state.cells.filter((cell) => cell.tree && cell.mycelium).length;
  const leavesDone = state.cells.filter((cell) => cell.leaf && cell.decomposed).length;
  const length = state.cells.filter((cell) => cell.mycelium).length;
  document.querySelector("#trees").textContent = `${treeDone}/${winCondition.requiredTrees}`;
  document.querySelector("#leaves").textContent = `${leavesDone}/${winCondition.requiredLeaves}`;
  document.querySelector("#length").textContent = length;

  const savedHovered = hoveredCell ? { x: hoveredCell.x, y: hoveredCell.y } : null;
  const savedSelected = selectedCell ? { x: selectedCell.x, y: selectedCell.y } : null;
  const hadPreview = previewCell !== null;

  mapEl.innerHTML = "";

  if (savedHovered) {
    const restored = cellAt(savedHovered.x, savedHovered.y);
    if (restored) {
      hoveredCell = restored;
      previewCell = restored;
      showTileInfo(restored);
      showGrowPreview(restored);
    }
  } else if (savedSelected && hadPreview) {
    const restored = cellAt(savedSelected.x, savedSelected.y);
    if (restored) {
      previewCell = restored;
      showGrowPreview(restored);
    }
  }

  state.cells.forEach((cell) => {
    const button = document.createElement("button");
    button.className = tileClass(cell);
    button.type = "button";
    button.title = `${cell.soil} ${cell.x},${cell.y}`;
    button.addEventListener("mouseenter", () => {
      if (isRendering) return;
      hoveredCell = cell;
      previewCell = cell;
      showTileInfo(cell);
      showGrowPreview(cell);
      render();
    });
    button.addEventListener("mouseleave", () => {
      if (isRendering) return;
      hoveredCell = null;
      previewCell = null;
      hideGrowPreview();
      showTileInfo(selectedCell);
      render();
    });
    button.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (previewCell && previewCell.x === cell.x && previewCell.y === cell.y) {
        selectedCell = cell;
        hideGrowPreview();
        previewCell = null;
        if (!grow(cell)) render();
      } else {
        hoveredCell = cell;
        previewCell = cell;
        selectedCell = cell;
        showTileInfo(cell);
        showGrowPreview(cell);
        render();
      }
    }, { passive: false });
    button.addEventListener("focus", () => {
      if (isRendering) return;
      hoveredCell = cell;
      previewCell = cell;
      showTileInfo(cell);
      showGrowPreview(cell);
      render();
    });
    button.addEventListener("blur", () => {
      if (isRendering) return;
      hoveredCell = null;
      previewCell = null;
      hideGrowPreview();
      showTileInfo(selectedCell);
      render();
    });
    button.addEventListener("click", () => {
      selectedCell = cell;
      hideGrowPreview();
      previewCell = null;
      if (!grow(cell)) render();
    });
    mapEl.appendChild(button);
  });

  if (hoveredCell) {
    const currentCell = cellAt(hoveredCell.x, hoveredCell.y);
    if (currentCell) {
      hoveredCell = currentCell;
      previewCell = currentCell;
      showTileInfo(currentCell);
      showGrowPreview(currentCell);
    }
  } else if (selectedCell) {
    const currentCell = cellAt(selectedCell.x, selectedCell.y);
    if (currentCell) {
      selectedCell = currentCell;
      showTileInfo(currentCell);
    }
  } else {
    showTileInfo(null);
    hideGrowPreview();
  }

  if (treeDone >= winCondition.requiredTrees && leavesDone >= winCondition.requiredLeaves) {
    const treeMet = winCondition.requiredTrees > 0 ? `已连接${treeDone}处树根` : "";
    const leafMet = winCondition.requiredLeaves > 0 ? `已分解${leavesDone}片落叶` : "";
    const parts = [treeMet, leafMet].filter(Boolean);
    addLogOnce(`网络稳定，森林进入共生状态。（${parts.join("，")}）`);
  }
  if (state.nutrients < 0) addLogOnce("养分透支，菌丝停止扩张。");

  logEl.innerHTML = "";
  state.log.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    logEl.appendChild(li);
  });

  isRendering = false;
}

function addLogOnce(text) {
  if (!state.log.includes(text)) {
    state.log.unshift(text);
    state.log = state.log.slice(0, 6);
  }
}

function countLevelStats(level) {
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
}

function renderGuide() {
  const guideList = document.querySelector("#guideList");
  guideList.innerHTML = "";
  levels.forEach((level, index) => {
    const stats = countLevelStats(level);
    const item = document.createElement("div");
    item.className = "guide-item" + (index === levelIndex ? " active" : "");
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
      levelIndex = index;
      reset();
      renderGuide();
    });
    guideList.appendChild(item);
  });
}

function toggleGuide() {
  const guide = document.querySelector("#guide");
  if (guide.hidden) {
    guide.hidden = false;
    renderGuide();
  } else {
    guide.hidden = true;
  }
}

function reset() {
  state = parseLevel(currentLevel());
  history = [];
  selectedCell = null;
  hoveredCell = null;
  previewCell = null;
  lastPreview = null;
  hideGrowPreview();
  render();
}

document.querySelector("#nextTurn").addEventListener("click", nextTurn);
document.querySelector("#reset").addEventListener("click", reset);
document.querySelector("#toggleGuide").addEventListener("click", toggleGuide);
levelSelectEl.addEventListener("change", (e) => {
  levelIndex = parseInt(e.target.value, 10);
  reset();
  if (!document.querySelector("#guide").hidden) renderGuide();
});
document.querySelector("#undo").addEventListener("click", () => {
  if (!history.length) return;
  state = JSON.parse(history.pop());
  if (selectedCell) {
    const currentCell = cellAt(selectedCell.x, selectedCell.y);
    if (currentCell) selectedCell = currentCell;
  }
  render();
});

renderLevelOptions();
reset();
