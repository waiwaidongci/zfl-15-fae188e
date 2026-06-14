const levels = [
  {
    name: "松林边缘",
    goal: "连接3处树根，分解至少2片落叶。",
    nutrients: 34,
    start: [1, 8],
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

const mapEl = document.querySelector("#map");
const logEl = document.querySelector("#log");

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
    log: ["菌核开始伸展。"]
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
  if (!canGrow(cell)) return;
  const tileCost = cost[cell.soil] + (cell.microbe && !cell.competed ? 3 : 0);
  if (state.nutrients < tileCost) {
    addLog("养分不足，前沿停止扩张。");
    return;
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
    if (cell.microbe && !cell.mycelium && Math.random() < 0.18) {
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
  return classes.join(" ");
}

function render() {
  const level = currentLevel();
  document.querySelector("#levelName").textContent = level.name;
  document.querySelector("#levelGoal").textContent = level.goal;
  document.querySelector("#nutrients").textContent = state.nutrients;
  document.querySelector("#turn").textContent = state.turn;

  const treeTotal = state.cells.filter((cell) => cell.tree).length;
  const treeDone = state.cells.filter((cell) => cell.tree && cell.mycelium).length;
  const leavesDone = state.cells.filter((cell) => cell.leaf && cell.decomposed).length;
  const length = state.cells.filter((cell) => cell.mycelium).length;
  document.querySelector("#trees").textContent = `${treeDone}/${treeTotal}`;
  document.querySelector("#leaves").textContent = leavesDone;
  document.querySelector("#length").textContent = length;

  mapEl.innerHTML = "";
  state.cells.forEach((cell) => {
    const button = document.createElement("button");
    button.className = tileClass(cell);
    button.type = "button";
    button.title = `${cell.soil} ${cell.x},${cell.y}`;
    button.addEventListener("click", () => grow(cell));
    mapEl.appendChild(button);
  });

  logEl.innerHTML = "";
  state.log.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    logEl.appendChild(li);
  });

  if (treeDone === treeTotal && leavesDone >= 2) addLogOnce("网络稳定，森林进入共生状态。");
  if (state.nutrients < 0) addLogOnce("养分透支，菌丝停止扩张。");
}

function addLogOnce(text) {
  if (!state.log.includes(text)) {
    state.log.unshift(text);
    state.log = state.log.slice(0, 6);
  }
}

function reset() {
  state = parseLevel(currentLevel());
  history = [];
  render();
}

document.querySelector("#nextTurn").addEventListener("click", nextTurn);
document.querySelector("#reset").addEventListener("click", reset);
document.querySelector("#switchLevel").addEventListener("click", () => {
  levelIndex = (levelIndex + 1) % levels.length;
  reset();
});
document.querySelector("#undo").addEventListener("click", () => {
  if (!history.length) return;
  state = JSON.parse(history.pop());
  render();
});

reset();
